"""Repository layer — equivalent to Spring Data JPA repositories.

Each repository class encapsulates all SQLAlchemy queries for a single model.
Services contain only business logic and call repository methods — never db.query() directly.
"""

from repositories.employee_repository import EmployeeRepository
from repositories.user_repository import UserRepository
from repositories.role_repository import RoleRepository
from repositories.attendance_repository import AttendanceRepository
from repositories.leave_repository import LeaveRequestRepository, LeaveBalanceRepository
from repositories.timesheet_repository import TimesheetRepository
from repositories.holiday_repository import HolidayRepository
from repositories.notification_repository import NotificationRepository
from repositories.audit_repository import AuditRepository

__all__ = [
    "EmployeeRepository",
    "UserRepository",
    "RoleRepository",
    "AttendanceRepository",
    "LeaveRequestRepository",
    "LeaveBalanceRepository",
    "TimesheetRepository",
    "HolidayRepository",
    "NotificationRepository",
    "AuditRepository",
]
