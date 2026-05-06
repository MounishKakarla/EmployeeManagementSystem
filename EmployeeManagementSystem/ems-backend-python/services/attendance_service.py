"""Attendance service — mirrors AttendanceServiceImpl.java."""

from datetime import date, time, datetime, timedelta
from zoneinfo import ZoneInfo
from sqlalchemy.orm import Session
from sqlalchemy import func as sa_func, extract

from core.exceptions import EmployeeNotFoundException, EntityNotFoundException, AccessDeniedException
from models.attendance import Attendance
from models.employee import Employee
from models.enums import AttendanceStatus

IST = ZoneInfo("Asia/Kolkata")


def _get_active(db: Session, emp_id: str) -> Employee:
    emp = db.query(Employee).filter(Employee.emp_id == emp_id, Employee.is_employee_active == True).first()
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
    today = datetime.now(IST).date()
    now = datetime.now(IST).time()

    existing = db.query(Attendance).filter(
        Attendance.emp_id == emp_id, Attendance.attendance_date == today
    ).first()

    if existing:
        if existing.check_in_time is not None:
            raise ValueError("You have already checked in today. Use check-out or contact your manager.")
        existing.check_in_time = now
        existing.status = AttendanceStatus.LATE if now > time(9, 30) else AttendanceStatus.PRESENT
        existing.recorded_by = emp_id
        if notes:
            existing.notes = notes
        db.commit()
        return _to_dto(existing)

    status = AttendanceStatus.LATE if now > time(9, 30) else AttendanceStatus.PRESENT
    record = Attendance(emp_id=emp_id, attendance_date=today, check_in_time=now,
                        status=status, notes=notes, recorded_by=emp_id)
    record.employee = emp
    db.add(record)
    db.commit()
    db.refresh(record)
    return _to_dto(record)


def check_out(db: Session, emp_id: str) -> dict:
    today = datetime.now(IST).date()
    record = db.query(Attendance).filter(
        Attendance.emp_id == emp_id, Attendance.attendance_date == today
    ).first()
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
    db.commit()
    return _to_dto(record)


def get_today_status(db: Session, emp_id: str):
    today = datetime.now(IST).date()
    record = db.query(Attendance).filter(
        Attendance.emp_id == emp_id, Attendance.attendance_date == today
    ).first()
    return _to_dto(record) if record else None


def get_my_attendance(db: Session, emp_id: str, page: int, size: int):
    query = db.query(Attendance).filter(Attendance.emp_id == emp_id).order_by(Attendance.attendance_date.desc())
    total = query.count()
    items = query.offset(page * size).limit(size).all()
    return [_to_dto(a) for a in items], total


def get_my_attendance_range(db: Session, emp_id: str, start: date, end: date):
    items = db.query(Attendance).filter(
        Attendance.emp_id == emp_id,
        Attendance.attendance_date >= start, Attendance.attendance_date <= end
    ).order_by(Attendance.attendance_date.asc()).all()
    return [_to_dto(a) for a in items]


def get_my_summary(db: Session, emp_id: str, month: int, year: int) -> dict:
    emp = _get_active(db, emp_id)

    def count_status(status):
        return db.query(Attendance).filter(
            Attendance.emp_id == emp_id,
            extract("month", Attendance.attendance_date) == month,
            extract("year", Attendance.attendance_date) == year,
            Attendance.status == status
        ).count()

    present = count_status(AttendanceStatus.PRESENT)
    absent = count_status(AttendanceStatus.ABSENT)
    half_day = count_status(AttendanceStatus.HALF_DAY)
    late = count_status(AttendanceStatus.LATE)
    on_leave = count_status(AttendanceStatus.ON_LEAVE)
    wfh = count_status(AttendanceStatus.WORK_FROM_HOME)
    holiday = count_status(AttendanceStatus.HOLIDAY)
    weekend = count_status(AttendanceStatus.WEEKEND)

    total_hours_result = db.query(sa_func.coalesce(sa_func.sum(Attendance.total_hours), 0.0)).filter(
        Attendance.emp_id == emp_id,
        extract("month", Attendance.attendance_date) == month,
        extract("year", Attendance.attendance_date) == year
    ).scalar()
    total_hours = float(total_hours_result) if total_hours_result else 0.0

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

    record = db.query(Attendance).filter(
        Attendance.emp_id == dto["empId"], Attendance.attendance_date == dto["attendanceDate"]
    ).first()
    if not record:
        record = Attendance(emp_id=dto["empId"], attendance_date=dto["attendanceDate"])
        record.employee = emp
        db.add(record)

    record.check_in_time = dto.get("checkInTime")
    record.check_out_time = dto.get("checkOutTime")
    record.status = AttendanceStatus(dto["status"]) if dto.get("status") else AttendanceStatus.PRESENT
    record.notes = dto.get("notes")
    record.recorded_by = recorded_by
    if record.check_in_time and record.check_out_time:
        record.total_hours = Attendance.compute_total_hours(record.check_in_time, record.check_out_time)
    db.commit()
    db.refresh(record)
    return _to_dto(record)


def update_attendance(db: Session, att_id: int, dto: dict, updated_by: str) -> dict:
    record = db.query(Attendance).filter(Attendance.id == att_id).first()
    if not record:
        raise EntityNotFoundException(f"Attendance record not found with id: {att_id}")
    if record.emp_id != updated_by:
        raise AccessDeniedException("Users can only update their own attendance")

    if dto.get("checkInTime") is not None: record.check_in_time = dto["checkInTime"]
    if dto.get("checkOutTime") is not None: record.check_out_time = dto["checkOutTime"]
    if dto.get("status") is not None: record.status = AttendanceStatus(dto["status"])
    if dto.get("notes") is not None: record.notes = dto["notes"]
    record.recorded_by = updated_by
    if record.check_in_time and record.check_out_time:
        record.total_hours = Attendance.compute_total_hours(record.check_in_time, record.check_out_time)
    db.commit()
    return _to_dto(record)


def delete_attendance(db: Session, att_id: int) -> None:
    record = db.query(Attendance).filter(Attendance.id == att_id).first()
    if not record:
        raise EntityNotFoundException(f"Attendance record not found with id: {att_id}")
    db.delete(record)
    db.commit()


def get_team_attendance(db: Session, start: date, end: date, emp_id: str | None, page: int, size: int):
    query = db.query(Attendance).join(Employee).filter(
        Attendance.attendance_date >= start, Attendance.attendance_date <= end
    )
    if emp_id:
        query = query.filter(Employee.emp_id == emp_id)
    query = query.order_by(Attendance.attendance_date.desc(), Employee.name.asc())
    total = query.count()
    items = query.offset(page * size).limit(size).all()
    return [_to_dto(a) for a in items], total


def get_daily_attendance(db: Session, dt: date, department: str | None):
    query = db.query(Attendance).join(Employee).filter(Attendance.attendance_date == dt)
    if department and department.strip():
        query = query.filter(sa_func.upper(Employee.department).like(f"%{department.strip().upper()}%"))
    query = query.order_by(Employee.name.asc())
    return [_to_dto(a) for a in query.all()]
