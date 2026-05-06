"""Role service — mirrors RoleServiceImpl.java."""

from sqlalchemy.orm import Session

from core.exceptions import EmployeeNotFoundException
from models.employee import Employee
from models.roles import Roles, UserRoles
from models.enums import RolesEnum
from services import audit_service


def assign_role(db: Session, emp_id: str, role_name: str, actor: str) -> None:
    if actor == emp_id:
        raise ValueError("You cannot assign roles to your own account. Another ADMIN must perform this action.")
    role = db.query(Roles).filter(Roles.role == RolesEnum(role_name)).first()
    if not role:
        raise ValueError(f"Invalid role: {role_name}")
    emp = db.query(Employee).filter(Employee.emp_id == emp_id).first()
    if not emp:
        raise EmployeeNotFoundException(f"Employee not found: {emp_id}")

    existing = db.query(UserRoles).filter(UserRoles.emp_id == emp_id, UserRoles.role_id == role.role_id).first()
    if existing:
        raise ValueError("Role already assigned to this employee")

    db.add(UserRoles(emp_id=emp_id, role_id=role.role_id))
    db.commit()
    audit_service.log(db, actor, f"ASSIGN_ROLE_{role_name}", f"Assigned role {role_name} to employee {emp_id}")


def remove_role(db: Session, emp_id: str, role_name: str, actor: str) -> None:
    if actor == emp_id:
        raise ValueError("You cannot revoke roles from your own account. Another ADMIN must perform this action.")
    role = db.query(Roles).filter(Roles.role == RolesEnum(role_name)).first()
    if not role:
        raise ValueError(f"Invalid role: {role_name}")
    ur = db.query(UserRoles).filter(UserRoles.emp_id == emp_id, UserRoles.role_id == role.role_id).first()
    if not ur:
        raise ValueError("Role not assigned to this employee")
    db.delete(ur)
    db.commit()
    audit_service.log(db, actor, f"REMOVE_ROLE_{role_name}", f"Removed role {role_name} from employee {emp_id}")


def get_roles(db: Session, emp_id: str) -> list[str]:
    urs = db.query(UserRoles).filter(UserRoles.emp_id == emp_id).all()
    return [ur.role.role.value for ur in urs]
