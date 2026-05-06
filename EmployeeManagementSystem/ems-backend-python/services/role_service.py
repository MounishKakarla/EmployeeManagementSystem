"""Role service — business logic only; all DB access via repositories."""

from sqlalchemy.orm import Session

from core.exceptions import EmployeeNotFoundException
from models.roles import UserRoles
from models.enums import RolesEnum
from repositories.employee_repository import EmployeeRepository
from repositories.role_repository import RoleRepository
from services import audit_service


def assign_role(db: Session, emp_id: str, role_name: str, actor: str) -> None:
    if actor == emp_id:
        raise ValueError("You cannot assign roles to your own account. Another ADMIN must perform this action.")
    role_repo = RoleRepository(db)
    emp_repo  = EmployeeRepository(db)

    role = role_repo.find_by_role_enum(RolesEnum(role_name))
    if not role:
        raise ValueError(f"Invalid role: {role_name}")
    emp = emp_repo.find_active(emp_id)
    if not emp:
        raise EmployeeNotFoundException(f"Employee not found: {emp_id}")

    existing = role_repo.find_user_role(emp_id, role.role_id)
    if existing:
        raise ValueError("Role already assigned to this employee")

    role_repo.save_user_role(UserRoles(emp_id=emp_id, role_id=role.role_id))
    role_repo.commit()
    audit_service.log(db, actor, f"ASSIGN_ROLE_{role_name}", f"Assigned role {role_name} to employee {emp_id}")


def remove_role(db: Session, emp_id: str, role_name: str, actor: str) -> None:
    if actor == emp_id:
        raise ValueError("You cannot revoke roles from your own account. Another ADMIN must perform this action.")
    role_repo = RoleRepository(db)

    role = role_repo.find_by_role_enum(RolesEnum(role_name))
    if not role:
        raise ValueError(f"Invalid role: {role_name}")
    ur = role_repo.find_user_role(emp_id, role.role_id)
    if not ur:
        raise ValueError("Role not assigned to this employee")
    role_repo.delete_user_role(ur)
    role_repo.commit()
    audit_service.log(db, actor, f"REMOVE_ROLE_{role_name}", f"Removed role {role_name} from employee {emp_id}")


def get_roles(db: Session, emp_id: str) -> list[str]:
    return RoleRepository(db).get_role_values(emp_id)
