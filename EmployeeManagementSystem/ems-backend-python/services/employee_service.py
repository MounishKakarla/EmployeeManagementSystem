"""Employee service — mirrors EmployeeServiceImpl.java."""

from datetime import date
from sqlalchemy.orm import Session
from sqlalchemy import func as sa_func

from core.exceptions import (DuplicateEmployeeException, EmployeeNotFoundException,
                              InactiveEmployeeException)
from core.security import hash_password
from core.id_generator import next_employee_id
from core.password_generator import generate_password
from models.employee import Employee
from models.user import User
from models.roles import Roles, UserRoles
from models.enums import RolesEnum
from services import audit_service, email_service


def _get_active(db: Session, emp_id: str) -> Employee:
    emp = db.query(Employee).filter(Employee.emp_id == emp_id, Employee.is_employee_active == True).first()
    if not emp:
        raise EmployeeNotFoundException(f"Employee not found: {emp_id}")
    return emp


def _to_dto(db: Session, emp: Employee) -> dict:
    roles = [ur.role.role.value for ur in db.query(UserRoles).filter(UserRoles.emp_id == emp.emp_id).all()]
    return {
        "empId": emp.emp_id, "name": emp.name, "companyEmail": emp.company_email,
        "personalEmail": emp.personal_email, "phoneNumber": emp.phone_number,
        "address": emp.address, "department": emp.department, "designation": emp.designation,
        "skills": emp.skills, "dateOfJoin": emp.date_of_join.isoformat() if emp.date_of_join else None,
        "dateOfBirth": emp.date_of_birth.isoformat() if emp.date_of_birth else None,
        "dateOfExit": emp.date_of_exit.isoformat() if emp.date_of_exit else None,
        "description": emp.description, "gender": emp.gender, "profileImage": emp.profile_image,
        "isEmployeeActive": emp.is_employee_active, "roles": roles,
    }


def create_employee(db: Session, dto: dict, actor: str) -> dict:
    if db.query(Employee).filter(Employee.company_email == dto["companyEmail"]).first():
        raise DuplicateEmployeeException(f"Company email already in use: {dto['companyEmail']}")
    if dto.get("personalEmail") and db.query(Employee).filter(Employee.personal_email == dto["personalEmail"]).first():
        raise DuplicateEmployeeException(f"Personal email already in use: {dto['personalEmail']}")
    if dto.get("phoneNumber") and db.query(Employee).filter(Employee.phone_number == dto["phoneNumber"]).first():
        raise DuplicateEmployeeException(f"Phone number already in use: {dto['phoneNumber']}")

    emp = Employee(
        emp_id=next_employee_id(db), name=dto["name"], company_email=dto["companyEmail"],
        personal_email=dto.get("personalEmail"), phone_number=dto.get("phoneNumber"),
        address=dto.get("address"), department=dto.get("department"),
        designation=dto.get("designation"), skills=dto.get("skills"),
        date_of_join=dto.get("dateOfJoin"), date_of_birth=dto.get("dateOfBirth"),
        description=dto.get("description"), gender=dto.get("gender"),
        profile_image=dto.get("profileImage"),
    )
    db.add(emp)
    db.flush()

    raw_password = generate_password(8)
    user = User(emp_id=emp.emp_id, password=hash_password(raw_password))
    db.add(user)
    db.flush()

    role_names = dto.get("roles", ["EMPLOYEE"])
    for rn in role_names:
        role = db.query(Roles).filter(Roles.role == RolesEnum(rn)).first()
        if not role:
            raise ValueError(f"Role not found: {rn}")
        db.add(UserRoles(emp_id=emp.emp_id, role_id=role.role_id))
    db.commit()

    try:
        email_service.send_login_details(emp.personal_email or emp.company_email,
                                          emp.emp_id, emp.company_email, raw_password, emp.name)
    except Exception:
        pass  # Don't fail creation if email fails

    audit_service.log(db, actor, "CREATE_EMPLOYEE", f"Created employee {emp.emp_id} ({emp.name})")
    return _to_dto(db, emp)


def get_employee_by_id(db: Session, emp_id: str) -> dict:
    emp = _get_active(db, emp_id)
    return _to_dto(db, emp)


def get_employees(db: Session, name: str | None, department: str | None,
                  date_param: date | None, skill: str | None, page: int, size: int):
    query = db.query(Employee).filter(Employee.is_employee_active == True)
    if name and name.strip():
        query = query.filter(sa_func.lower(Employee.name).like(f"%{name.strip().lower()}%"))
    elif department and department.strip():
        query = query.filter(sa_func.upper(Employee.department).like(f"%{department.strip().upper()}%"))
    elif date_param:
        query = query.filter(Employee.date_of_join >= date_param)
    elif skill and skill.strip():
        query = query.filter(sa_func.upper(Employee.skills).like(f"%{skill.strip().upper()}%"))
    total = query.count()
    items = query.offset(page * size).limit(size).all()
    return [_to_dto(db, e) for e in items], total


def get_inactive_employees(db: Session, page: int, size: int):
    query = db.query(Employee).filter(Employee.is_employee_active == False)
    total = query.count()
    items = query.offset(page * size).limit(size).all()
    return [_to_dto(db, e) for e in items], total


def get_inactive_employee_by_id(db: Session, emp_id: str) -> dict:
    emp = db.query(Employee).filter(Employee.emp_id == emp_id, Employee.is_employee_active == False).first()
    if not emp:
        raise EmployeeNotFoundException(f"Inactive employee not found: {emp_id}")
    return _to_dto(db, emp)


def delete_employee(db: Session, emp_id: str, actor: str) -> None:
    emp = _get_active(db, emp_id)
    emp.is_employee_active = False
    emp.date_of_exit = date.today()
    user = db.query(User).filter(User.emp_id == emp_id).first()
    if user:
        user.is_user_active = False
    db.commit()
    audit_service.log(db, actor, "DEACTIVATE_EMPLOYEE", f"Deactivated employee {emp_id} ({emp.name})")


def update_fields(db: Session, emp_id: str, dto: dict, actor: str) -> dict:
    emp = _get_active(db, emp_id)
    changes = []
    for field, attr in [("name", "name"), ("phoneNumber", "phone_number"), ("address", "address"),
                        ("personalEmail", "personal_email"), ("department", "department"),
                        ("designation", "designation"), ("description", "description"),
                        ("skills", "skills"), ("gender", "gender"), ("profileImage", "profile_image")]:
        if field in dto and dto[field] is not None:
            setattr(emp, attr, dto[field])
            changes.append(field)
    db.commit()
    audit_service.log(db, actor, "UPDATE_EMPLOYEE", f"Updated [{'; '.join(changes)}] for employee {emp_id}")
    return _to_dto(db, emp)


def update_profile_image(db: Session, emp_id: str, base64_image: str | None) -> dict:
    emp = _get_active(db, emp_id)
    emp.profile_image = base64_image
    db.commit()
    return _to_dto(db, emp)
