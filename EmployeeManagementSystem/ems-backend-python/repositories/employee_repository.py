"""EmployeeRepository — mirrors Spring Data JPA EmployeeRepository interface."""

from datetime import date
from sqlalchemy.orm import Session
from sqlalchemy import func as sa_func

from models.employee import Employee
from repositories.base import BaseRepository


class EmployeeRepository(BaseRepository[Employee]):

    def __init__(self, db: Session) -> None:
        super().__init__(Employee, db)

    # ── Single-record lookups ─────────────────────────────────────────────────

    def find_active(self, emp_id: str) -> Employee | None:
        """findByEmpIdAndIsEmployeeActiveTrue"""
        return self.db.query(Employee).filter(
            Employee.emp_id == emp_id,
            Employee.is_employee_active == True,
        ).first()

    def find_inactive(self, emp_id: str) -> Employee | None:
        """findByEmpIdAndIsEmployeeActiveFalse"""
        return self.db.query(Employee).filter(
            Employee.emp_id == emp_id,
            Employee.is_employee_active == False,
        ).first()

    # ── Uniqueness checks (used during creation) ──────────────────────────────

    def exists_by_company_email(self, email: str) -> bool:
        return self.db.query(Employee).filter(
            Employee.company_email == email
        ).first() is not None

    def exists_by_personal_email(self, email: str) -> bool:
        return self.db.query(Employee).filter(
            Employee.personal_email == email
        ).first() is not None

    def exists_by_phone(self, phone: str) -> bool:
        return self.db.query(Employee).filter(
            Employee.phone_number == phone
        ).first() is not None

    # ── Paginated list queries ────────────────────────────────────────────────

    def find_all_active(self, offset: int, limit: int) -> tuple[list[Employee], int]:
        q = self.db.query(Employee).filter(Employee.is_employee_active == True)
        return q.offset(offset).limit(limit).all(), q.count()

    def find_all_inactive(self, offset: int, limit: int) -> tuple[list[Employee], int]:
        q = self.db.query(Employee).filter(Employee.is_employee_active == False)
        return q.offset(offset).limit(limit).all(), q.count()

    def search_by_name(self, name: str, offset: int, limit: int) -> tuple[list[Employee], int]:
        q = self.db.query(Employee).filter(
            Employee.is_employee_active == True,
            sa_func.lower(Employee.name).like(f"%{name.lower()}%"),
        )
        return q.offset(offset).limit(limit).all(), q.count()

    def search_by_department(self, dept: str, offset: int, limit: int) -> tuple[list[Employee], int]:
        q = self.db.query(Employee).filter(
            Employee.is_employee_active == True,
            sa_func.upper(Employee.department).like(f"%{dept.upper()}%"),
        )
        return q.offset(offset).limit(limit).all(), q.count()

    def search_by_join_date(self, join_date: date, offset: int, limit: int) -> tuple[list[Employee], int]:
        q = self.db.query(Employee).filter(
            Employee.is_employee_active == True,
            Employee.date_of_join >= join_date,
        )
        return q.offset(offset).limit(limit).all(), q.count()

    def search_by_skill(self, skill: str, offset: int, limit: int) -> tuple[list[Employee], int]:
        q = self.db.query(Employee).filter(
            Employee.is_employee_active == True,
            sa_func.upper(Employee.skills).like(f"%{skill.upper()}%"),
        )
        return q.offset(offset).limit(limit).all(), q.count()
