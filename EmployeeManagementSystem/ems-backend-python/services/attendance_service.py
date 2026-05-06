"""Attendance service — business logic only; all DB access via repositories."""

from datetime import date, time, datetime, timedelta
from zoneinfo import ZoneInfo
from sqlalchemy.orm import Session

from core.exceptions import EmployeeNotFoundException, EntityNotFoundException, AccessDeniedException
from models.attendance import Attendance
from models.employee import Employee
from models.enums import AttendanceStatus
from repositories.attendance_repository import AttendanceRepository
from repositories.employee_repository import EmployeeRepository

IST = ZoneInfo("Asia/Kolkata")


def _get_active(db: Session, emp_id: str) -> Employee:
    emp = EmployeeRepository(db).find_active(emp_id)
    if not emp:
        raise EmployeeNotFoundException(f"Employee not found with id: {emp_id}")
    return emp


def _to_dto(a: Attendance) -> dict:
    emp = a.employee
    total_hours = Attendance.compute_total_hours(a.check_in_time, a.check_out_time)
    return {
        "id": a.id, "empId": emp.emp_id, "employeeName": emp.name,
        "department": emp.department, "profileImage": emp.profile_image,
        "attendanceDate": a.attendance_date.isoformat() if a.attendance_date else None,
        "checkInTime": a.check_in_time.isoformat() if a.check_in_time else None,
        "checkOutTime": a.check_out_time.isoformat() if a.check_out_time else None,
        "totalHours": total_hours if total_hours is not None else (float(a.total_hours) if a.total_hours else None),
        "status": a.status.value if a.status else None,
        "notes": a.notes, "recordedBy": a.recorded_by,
    }


def check_in(db: Session, emp_id: str, notes: str | None) -> dict:
    emp = _get_active(db, emp_id)
    att_repo = AttendanceRepository(db)
    today = datetime.now(IST).date()
    now = datetime.now(IST).time()

    existing = att_repo.find_by_emp_and_date(emp_id, today)
    if existing:
        if existing.check_in_time is not None:
            raise ValueError("You have already checked in today. Use check-out or contact your manager.")
        existing.check_in_time = now
        existing.status = AttendanceStatus.LATE if now > time(9, 30) else AttendanceStatus.PRESENT
        existing.recorded_by = emp_id
        if notes:
            existing.notes = notes
        att_repo.commit()
        return _to_dto(existing)

    status = AttendanceStatus.LATE if now > time(9, 30) else AttendanceStatus.PRESENT
    record = Attendance(emp_id=emp_id, attendance_date=today, check_in_time=now,
                        status=status, notes=notes, recorded_by=emp_id)
    record.employee = emp
    att_repo.save(record)
    att_repo.commit()
    att_repo.refresh(record)
    return _to_dto(record)


def check_out(db: Session, emp_id: str) -> dict:
    att_repo = AttendanceRepository(db)
    today = datetime.now(IST).date()
    record = att_repo.find_by_emp_and_date(emp_id, today)
    if not record:
        raise ValueError("No check-in record found for today. Please check in first.")
    if record.check_in_time is None:
        raise ValueError("You have not checked in today yet.")
    if record.check_out_time is not None:
        raise ValueError(f"You have already checked out today at {str(record.check_out_time)[:5]}.")

    now = datetime.now(IST).time()
    record.check_out_time = now
    total_hours = Attendance.compute_total_hours(record.check_in_time, now)
    record.total_hours = total_hours
    if total_hours and total_hours < 4 and record.status == AttendanceStatus.PRESENT:
        record.status = AttendanceStatus.HALF_DAY
    att_repo.commit()
    return _to_dto(record)


def get_today_status(db: Session, emp_id: str):
    today = datetime.now(IST).date()
    record = AttendanceRepository(db).find_by_emp_and_date(emp_id, today)
    return _to_dto(record) if record else None


def get_my_attendance(db: Session, emp_id: str, page: int, size: int):
    items, total = AttendanceRepository(db).find_by_emp_paginated(emp_id, page * size, size)
    return [_to_dto(a) for a in items], total


def get_my_attendance_range(db: Session, emp_id: str, start: date, end: date):
    return [_to_dto(a) for a in AttendanceRepository(db).find_by_emp_range(emp_id, start, end)]


def get_my_summary(db: Session, emp_id: str, month: int, year: int) -> dict:
    emp = _get_active(db, emp_id)
    att_repo = AttendanceRepository(db)

    def count_status(status):
        return att_repo.count_by_status_month_year(emp_id, status, month, year)

    present  = count_status(AttendanceStatus.PRESENT)
    absent   = count_status(AttendanceStatus.ABSENT)
    half_day = count_status(AttendanceStatus.HALF_DAY)
    late     = count_status(AttendanceStatus.LATE)
    on_leave = count_status(AttendanceStatus.ON_LEAVE)
    wfh      = count_status(AttendanceStatus.WORK_FROM_HOME)
    holiday  = count_status(AttendanceStatus.HOLIDAY)
    weekend  = count_status(AttendanceStatus.WEEKEND)
    total_hours = att_repo.sum_hours_month_year(emp_id, month, year)

    working_days = present + late + half_day + wfh
    pct = round((working_days * 100.0) / (working_days + absent) * 100.0) / 100.0 if (working_days + absent) > 0 else 0.0
    avg_hours = round((total_hours / working_days) * 100.0) / 100.0 if working_days > 0 else 0.0

    return {
        "empId": emp_id, "employeeName": emp.name, "month": month, "year": year,
        "totalWorkingDays": working_days, "presentDays": present, "absentDays": absent,
        "halfDays": half_day, "lateDays": late, "onLeaveDays": on_leave,
        "workFromHomeDays": wfh, "holidayDays": holiday, "weekendDays": weekend,
        "totalHoursWorked": total_hours, "averageHoursPerDay": avg_hours,
        "attendancePercentage": pct,
    }


def create_or_override(db: Session, dto: dict, recorded_by: str) -> dict:
    if dto["empId"] != recorded_by:
        raise AccessDeniedException("Users can only log or override their own attendance")
    emp = _get_active(db, dto["empId"])
    att_repo = AttendanceRepository(db)

    record = att_repo.find_by_emp_and_date(dto["empId"], dto["attendanceDate"])
    if not record:
        record = Attendance(emp_id=dto["empId"], attendance_date=dto["attendanceDate"])
        record.employee = emp
        att_repo.save(record)

    record.check_in_time  = dto.get("checkInTime")
    record.check_out_time = dto.get("checkOutTime")
    record.status         = AttendanceStatus(dto["status"]) if dto.get("status") else AttendanceStatus.PRESENT
    record.notes          = dto.get("notes")
    record.recorded_by    = recorded_by
    if record.check_in_time and record.check_out_time:
        record.total_hours = Attendance.compute_total_hours(record.check_in_time, record.check_out_time)
    att_repo.commit()
    att_repo.refresh(record)
    return _to_dto(record)


def update_attendance(db: Session, att_id: int, dto: dict, updated_by: str) -> dict:
    att_repo = AttendanceRepository(db)
    record = att_repo.find_by_id(att_id)
    if not record:
        raise EntityNotFoundException(f"Attendance record not found with id: {att_id}")
    if record.emp_id != updated_by:
        raise AccessDeniedException("Users can only update their own attendance")

    if dto.get("checkInTime") is not None:  record.check_in_time  = dto["checkInTime"]
    if dto.get("checkOutTime") is not None: record.check_out_time = dto["checkOutTime"]
    if dto.get("status") is not None:       record.status         = AttendanceStatus(dto["status"])
    if dto.get("notes") is not None:        record.notes          = dto["notes"]
    record.recorded_by = updated_by
    if record.check_in_time and record.check_out_time:
        record.total_hours = Attendance.compute_total_hours(record.check_in_time, record.check_out_time)
    att_repo.commit()
    return _to_dto(record)


def delete_attendance(db: Session, att_id: int) -> None:
    att_repo = AttendanceRepository(db)
    record = att_repo.find_by_id(att_id)
    if not record:
        raise EntityNotFoundException(f"Attendance record not found with id: {att_id}")
    att_repo.delete(record)
    att_repo.commit()


def get_team_attendance(db: Session, start: date, end: date, emp_id: str | None, page: int, size: int):
    items, total = AttendanceRepository(db).find_team_paginated(start, end, emp_id, page * size, size)
    return [_to_dto(a) for a in items], total


def get_daily_attendance(db: Session, dt: date, department: str | None):
    return [_to_dto(a) for a in AttendanceRepository(db).find_daily(dt, department)]
