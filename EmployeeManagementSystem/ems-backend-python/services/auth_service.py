"""Auth service — mirrors AuthServiceImpl.java."""

from sqlalchemy.orm import Session
from core.exceptions import EmployeeNotFoundException, InvalidTokenException
from core.security import (create_access_token, create_refresh_token,
                            decode_token, hash_password, verify_password)
from core.password_generator import generate_password
from models.employee import Employee
from models.user import User
from models.roles import UserRoles
from services import audit_service, email_service


def login(db: Session, username: str, password: str) -> dict:
    if "@" in username:
        user = db.query(User).join(Employee).filter(Employee.company_email == username).first()
    else:
        user = db.query(User).filter(User.emp_id == username).first()

    if not user:
        raise EmployeeNotFoundException("User not found")
    if not verify_password(password, user.password):
        raise InvalidTokenException("Invalid username or password.")
    if not user.is_user_active or not user.employee.is_employee_active:
        raise InvalidTokenException("This account has been deactivated.")

    roles = [ur.role.role.value for ur in db.query(UserRoles).filter(UserRoles.emp_id == user.emp_id).all()]
    access_token = create_access_token(user.emp_id, user.employee.company_email, user.employee.name, roles)
    refresh_token = create_refresh_token(user.emp_id)
    audit_service.log(db, user.emp_id, "LOGIN", f"Employee {user.emp_id} logged in")
    return {"token": access_token, "refreshToken": refresh_token}


def refresh_token_fn(db: Session, refresh_tok: str) -> dict:
    claims = decode_token(refresh_tok)
    if not claims or claims.get("type") != "REFRESH":
        raise InvalidTokenException("Invalid or expired refresh token")
    emp_id = claims["sub"]
    user = db.query(User).filter(User.emp_id == emp_id).first()
    if not user:
        raise EmployeeNotFoundException(f"User not found: {emp_id}")
    if not user.is_user_active or not user.employee.is_employee_active:
        raise InvalidTokenException("Account deactivated.")
    roles = [ur.role.role.value for ur in db.query(UserRoles).filter(UserRoles.emp_id == emp_id).all()]
    new_access = create_access_token(emp_id, user.employee.company_email, user.employee.name, roles)
    return {"token": new_access, "refreshToken": refresh_tok}


def get_current_user_info(db: Session, emp_id: str) -> dict:
    user = db.query(User).filter(User.emp_id == emp_id).first()
    if not user:
        raise EmployeeNotFoundException(f"User not found: {emp_id}")
    emp = user.employee
    roles = [ur.role.role.value for ur in db.query(UserRoles).filter(UserRoles.emp_id == emp_id).all()]
    return {"empId": emp.emp_id, "name": emp.name, "companyEmail": emp.company_email,
            "roles": roles, "profileImage": emp.profile_image}


def change_password(db: Session, emp_id: str, old_pw: str, new_pw: str) -> None:
    user = db.query(User).filter(User.emp_id == emp_id).first()
    if not user:
        raise EmployeeNotFoundException(f"User not found: {emp_id}")
    if not verify_password(old_pw, user.password):
        raise ValueError("Current password is incorrect")
    user.password = hash_password(new_pw)
    db.commit()
    audit_service.log(db, emp_id, "CHANGE_PASSWORD", f"Employee {emp_id} changed their own password")


def save_push_token(db: Session, emp_id: str, push_token: str) -> None:
    user = db.query(User).filter(User.emp_id == emp_id).first()
    if not user:
        raise EmployeeNotFoundException(f"User not found: {emp_id}")
    user.push_token = push_token
    db.commit()


def reset_password(db: Session, emp_id: str) -> None:
    user = db.query(User).filter(User.emp_id == emp_id).first()
    if not user:
        raise EmployeeNotFoundException(f"User not found: {emp_id}")
    emp = user.employee
    raw_password = generate_password(8)
    user.password = hash_password(raw_password)
    db.commit()
    email_service.send_reset_password_email(emp.emp_id, emp.name, emp.company_email, raw_password)
    audit_service.log(db, "ADMIN_ACTION", "RESET_PASSWORD", f"Password reset triggered for employee {emp_id}")
