"""UserRepository — mirrors Spring Data JPA UserRepository interface."""

from sqlalchemy.orm import Session

from models.user import User
from models.employee import Employee
from repositories.base import BaseRepository


class UserRepository(BaseRepository[User]):

    def __init__(self, db: Session) -> None:
        super().__init__(User, db)

    def find_by_emp_id(self, emp_id: str) -> User | None:
        return self.db.query(User).filter(User.emp_id == emp_id).first()

    def find_by_company_email(self, email: str) -> User | None:
        """Join to Employee to look up by company email."""
        return self.db.query(User).join(Employee).filter(
            Employee.company_email == email
        ).first()
