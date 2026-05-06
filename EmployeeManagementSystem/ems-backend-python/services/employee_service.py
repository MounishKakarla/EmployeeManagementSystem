"""Employee service — business logic only; all DB access via EmployeeRepository."""

from datetime import date
from sqlalchemy.orm import Session

from core.exceptions import DuplicateEmployeeException, EmployeeNotFoundException
from core.id_generator import next_employee_id
from core.password_generator import generate_password
from core.security import hash_password
from models.employee import Employee
from models.user import User
from models.roles import UserRoles
from models.enums import RolesEnum
from repositories.employee_repository import EmployeeRepository
from repositories.user_repository import UserRepository
from repositories.role_repository import RoleRepository
from services import audit_service, email_service


# ── DTO mapper ────────────────────────────────────────────────────────────────

def _to_dto(role_repo: RoleRepository, emp: Employee) -> dict:
    return {
        "empId": emp.emp_id,
        "name": emp.name,
        "companyEmail": emp.company_email,
        "personalEmail": emp.personal_email,
        "phoneNumber": emp.phone_number,
        "address": emp.address,
        "department": emp.department,
        "designation": emp.designation,
        "skills": emp.skills,
        "dateOfJoin": emp.date_of_join.isoformat() if emp.date_of_join else None,
        "dateOfBirth": emp.date_of_birth.isoformat() if emp.date_of_birth else None,
        "dateOfExit": emp.date_of_exit.isoformat() if emp.date_of_exit else None,
        "description": emp.description,
        "gender": emp.gender,
        "profileImage": emp.profile_image,
        "isEmployeeActive": emp.is_employee_active,
        "roles": role_repo.get_role_values(emp.emp_id),
    }


# ── Service methods ───────────────────────────────────────────────────────────

def create_employee(db: Session, dto: dict, actor: str) -> dict:
    emp_repo  = EmployeeRepository(db)
    user_repo = UserRepository(db)
    role_repo = RoleRepository(db)

    if emp_repo.exists_by_company_email(dto["companyEmail"]):
        raise DuplicateEmployeeException(f"Company email already in use: {dto['companyEmail']}")
    if dto.get("personalEmail") and emp_repo.exists_by_personal_email(dto["personalEmail"]):
        raise DuplicateEmployeeException(f"Personal email already in use: {dto['personalEmail']}")
    if dto.get("phoneNumber") and emp_repo.exists_by_phone(dto["phoneNumber"]):
        raise DuplicateEmployeeException(f"Phone number already in use: {dto['phoneNumber']}")

    emp = Employee(
        emp_id=next_employee_id(db),
        name=dto["name"],
        company_email=dto["companyEmail"],
        personal_email=dto.get("personalEmail"),
        phone_number=dto.get("phoneNumber"),
        address=dto.get("address"),
        department=dto.get("department"),
        designation=dto.get("designation"),
        skills=dto.get("skills"),
        date_of_join=dto.get("dateOfJoin"),
        date_of_birth=dto.get("dateOfBirth"),
        description=dto.get("description"),
        gender=dto.get("gender"),
        profile_image=dto.get("profileImage"),
    )
    emp_repo.save(emp)
    emp_repo.flush()

    raw_password = generate_password(8)
    user_repo.save(User(emp_id=emp.emp_id, password=hash_password(raw_password)))
    emp_repo.flush()

    for rn in dto.get("roles", ["EMPLOYEE"]):
        role = role_repo.find_by_role_enum(RolesEnum(rn))
        if not role:
            raise ValueError(f"Role not found: {rn}")
        role_repo.save_user_role(UserRoles(emp_id=emp.emp_id, role_id=role.role_id))

    emp_repo.commit()

    try:
        email_service.send_login_details(
            emp.personal_email or emp.company_email,
            emp.emp_id, emp.company_email, raw_password, emp.name,
        )
    except Exception:
        pass  # Don't fail creation if email fails

    audit_service.log(db, actor, "CREATE_EMPLOYEE", f"Created employee {emp.emp_id} ({emp.name})")
    return _to_dto(role_repo, emp)


def get_employee_by_id(db: Session, emp_id: str) -> dict:
    emp = EmployeeRepository(db).find_active(emp_id)
    if not emp:
        raise EmployeeNotFoundException(f"Employee not found: {emp_id}")
    return _to_dto(RoleRepository(db), emp)


def get_employees(
    db: Session,
    name: str | None,
    department: str | None,
    date_param: date | None,
    skill: str | None,
    page: int,
    size: int,
):
    repo      = EmployeeRepository(db)
    role_repo = RoleRepository(db)
    offset    = page * size

    if name and name.strip():
        items, total = repo.search_by_name(name.strip(), offset, size)
    elif department and department.strip():
        items, total = repo.search_by_department(department.strip(), offset, size)
    elif date_param:
        items, total = repo.search_by_join_date(date_param, offset, size)
    elif skill and skill.strip():
        items, total = repo.search_by_skill(skill.strip(), offset, size)
    else:
        items, total = repo.find_all_active(offset, size)

    return [_to_dto(role_repo, e) for e in items], total


def get_inactive_employees(db: Session, page: int, size: int):
    items, total = EmployeeRepository(db).find_all_inactive(page * size, size)
    role_repo    = RoleRepository(db)
    return [_to_dto(role_repo, e) for e in items], total


def get_inactive_employee_by_id(db: Session, emp_id: str) -> dict:
    emp = EmployeeRepository(db).find_inactive(emp_id)
    if not emp:
        raise EmployeeNotFoundException(f"Inactive employee not found: {emp_id}")
    return _to_dto(RoleRepository(db), emp)


def delete_employee(db: Session, emp_id: str, actor: str) -> None:
    emp_repo  = EmployeeRepository(db)
    user_repo = UserRepository(db)

    emp = emp_repo.find_active(emp_id)
    if not emp:
        raise EmployeeNotFoundException(f"Employee not found: {emp_id}")

    emp.is_employee_active = False
    emp.date_of_exit       = date.today()

    user = user_repo.find_by_emp_id(emp_id)
    if user:
        user.is_user_active = False

    emp_repo.commit()
    audit_service.log(db, actor, "DEACTIVATE_EMPLOYEE", f"Deactivated employee {emp_id} ({emp.name})")


def update_fields(db: Session, emp_id: str, dto: dict, actor: str) -> dict:
    emp_repo = EmployeeRepository(db)
    emp      = emp_repo.find_active(emp_id)
    if not emp:
        raise EmployeeNotFoundException(f"Employee not found: {emp_id}")

    changes = []
    for field, attr in [
        ("name",          "name"),
        ("phoneNumber",   "phone_number"),
        ("address",       "address"),
        ("personalEmail", "personal_email"),
        ("department",    "department"),
        ("designation",   "designation"),
        ("description",   "description"),
        ("skills",        "skills"),
        ("gender",        "gender"),
        ("profileImage",  "profile_image"),
    ]:
        if field in dto and dto[field] is not None:
            setattr(emp, attr, dto[field])
            changes.append(field)

    emp_repo.commit()
    audit_service.log(db, actor, "UPDATE_EMPLOYEE", f"Updated [{'; '.join(changes)}] for employee {emp_id}")
    return _to_dto(RoleRepository(db), emp)


def update_profile_image(db: Session, emp_id: str, base64_image: str | None) -> dict:
    emp_repo = EmployeeRepository(db)
    emp      = emp_repo.find_active(emp_id)
    if not emp:
        raise EmployeeNotFoundException(f"Employee not found: {emp_id}")
    emp.profile_image = base64_image
    emp_repo.commit()
    return _to_dto(RoleRepository(db), emp)
