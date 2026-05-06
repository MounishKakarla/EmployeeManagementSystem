"""RoleRepository — mirrors Spring Data JPA RoleRepository / UserRoleRepository."""

from sqlalchemy.orm import Session

from models.roles import Roles, UserRoles
from models.enums import RolesEnum
from repositories.base import BaseRepository


class RoleRepository(BaseRepository[Roles]):

    def __init__(self, db: Session) -> None:
        super().__init__(Roles, db)

    def find_by_role_enum(self, role: RolesEnum) -> Roles | None:
        return self.db.query(Roles).filter(Roles.role == role).first()

    def find_user_roles(self, emp_id: str) -> list[UserRoles]:
        return self.db.query(UserRoles).filter(UserRoles.emp_id == emp_id).all()

    def find_user_role(self, emp_id: str, role_id: int) -> UserRoles | None:
        return self.db.query(UserRoles).filter(
            UserRoles.emp_id == emp_id,
            UserRoles.role_id == role_id,
        ).first()

    def get_role_values(self, emp_id: str) -> list[str]:
        """Returns role string values (e.g. ["ADMIN", "EMPLOYEE"]) for a given employee."""
        return [ur.role.role.value for ur in self.find_user_roles(emp_id)]

    def save_user_role(self, user_role: UserRoles) -> UserRoles:
        self.db.add(user_role)
        return user_role

    def delete_user_role(self, user_role: UserRoles) -> None:
        self.db.delete(user_role)
