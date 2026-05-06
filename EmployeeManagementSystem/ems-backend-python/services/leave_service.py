"""Leave service — mirrors LeaveServiceImpl.java (full business logic)."""

from datetime import date, datetime, DayOfWeek
from datetime import date as date_type
from zoneinfo import ZoneInfo
from sqlalchemy.orm import Session
from sqlalchemy import func as sa_func, and_, or_

from core.exceptions import EmployeeNotFoundException, EntityNotFoundException
from models.employee import Employee
from models.leave_request import LeaveRequest
from models.leave_balance import LeaveBalance
from models.attendance import Attendance
from models.holiday_calendar import HolidayCalendar
from models.roles import UserRoles
from models.enums import LeaveStatus, LeaveType, AttendanceStatus
from services import leave_calculation_service as calc_service
from services import audit_service, notification_service

IST = ZoneInfo("Asia/Kolkata")


def _get_active(db: Session, emp_id: str) -> Employee:
    emp = db.query(Employee).filter(Employee.emp_id == emp_id, Employee.is_employee_active == True).first()
    if not emp:
        raise EmployeeNotFoundException(f"Employee not found: {emp_id}")
    return emp


def _to_dto(r: LeaveRequest) -> dict:
    emp = r.employee
    return {
        "id": r.id, "empId": emp.emp_id, "employeeName": emp.name,
        "department": emp.department, "profileImage": emp.profile_image,
        "leaveType": r.leave_type.value, "startDate": r.start_date.isoformat(),
        "endDate": r.end_date.isoformat(), "daysRequested": r.days_requested,
        "reason": r.reason, "status": r.status.value,
        "reviewedBy": r.reviewed_by,
        "reviewedAt": r.reviewed_at.isoformat() if r.reviewed_at else None,
        "reviewNotes": r.review_notes,
        "createdAt": r.created_at.isoformat() if r.created_at else None,
    }


def _count_working_days(db: Session, start: date, end: date) -> int:
    holidays = {h.holiday_date for h in db.query(HolidayCalendar).filter(
        HolidayCalendar.holiday_date >= start, HolidayCalendar.holiday_date <= end
    ).all()}
    count = 0
    cur = start
    while cur <= end:
        if cur.weekday() < 5 and cur not in holidays:  # Mon=0..Fri=4
            count += 1
        cur += __import__("datetime").timedelta(days=1)
    return count


def _deduct_balance(db: Session, emp_id: str, leave_type: LeaveType, days: int, year: int):
    emp = _get_active(db, emp_id)
    bal = db.query(LeaveBalance).filter(LeaveBalance.emp_id == emp_id, LeaveBalance.year == year).first()
    if not bal:
        prev = db.query(LeaveBalance).filter(LeaveBalance.emp_id == emp_id, LeaveBalance.year == year - 1).first()
        bal = calc_service.compute(emp, year, None, prev)
        db.add(bal)
        db.flush()
    mapping = {
        LeaveType.ANNUAL: ("annual_used",), LeaveType.SICK: ("sick_used",),
        LeaveType.CASUAL: ("casual_used",), LeaveType.SICK_CASUAL: ("sick_casual_used",),
        LeaveType.UNPAID: ("unpaid_used",), LeaveType.MATERNITY: ("maternity_used",),
        LeaveType.PATERNITY: ("paternity_used",), LeaveType.COMPENSATORY: ("comp_off_used",),
    }
    field = mapping.get(leave_type)
    if field:
        current = getattr(bal, field[0]) or 0
        setattr(bal, field[0], current + days)


def _refund_balance(db: Session, emp_id: str, leave_type: LeaveType, days: int, year: int):
    emp = _get_active(db, emp_id)
    bal = db.query(LeaveBalance).filter(LeaveBalance.emp_id == emp_id, LeaveBalance.year == year).first()
    if not bal:
        return
    mapping = {
        LeaveType.ANNUAL: "annual_used", LeaveType.SICK: "sick_used",
        LeaveType.CASUAL: "casual_used", LeaveType.SICK_CASUAL: "sick_casual_used",
        LeaveType.UNPAID: "unpaid_used", LeaveType.MATERNITY: "maternity_used",
        LeaveType.PATERNITY: "paternity_used", LeaveType.COMPENSATORY: "comp_off_used",
    }
    field = mapping.get(leave_type)
    if field:
        current = getattr(bal, field) or 0
        setattr(bal, field, max(0, current - days))


def _create_on_leave_attendance(db: Session, emp: Employee, start: date, end: date):
    import datetime as dt_mod
    cur = start
    while cur <= end:
        if cur.weekday() < 5:
            existing = db.query(Attendance).filter(
                Attendance.emp_id == emp.emp_id, Attendance.attendance_date == cur
            ).first()
            if existing:
                existing.status = AttendanceStatus.ON_LEAVE
                existing.notes = "On approved leave"
                existing.recorded_by = "SYSTEM"
            else:
                rec = Attendance(emp_id=emp.emp_id, attendance_date=cur,
                                 status=AttendanceStatus.ON_LEAVE,
                                 notes="On approved leave", recorded_by="SYSTEM")
                rec.employee = emp
                db.add(rec)
        cur += dt_mod.timedelta(days=1)


def _remove_on_leave_attendance(db: Session, emp_id: str, start: date, end: date):
    import datetime as dt_mod
    cur = start
    while cur <= end:
        if cur.weekday() < 5:
            rec = db.query(Attendance).filter(
                Attendance.emp_id == emp_id, Attendance.attendance_date == cur,
                Attendance.status == AttendanceStatus.ON_LEAVE,
                Attendance.recorded_by == "SYSTEM"
            ).first()
            if rec:
                db.delete(rec)
        cur += dt_mod.timedelta(days=1)


def submit_leave(db: Session, emp_id: str, dto: dict) -> dict:
    emp = _get_active(db, emp_id)
    start_date = dto["startDate"]
    end_date = dto["endDate"]
    leave_type = LeaveType(dto["leaveType"])

    today = datetime.now(IST).date()
    if start_date < today:
        raise ValueError("Start date cannot be in the past.")
    if end_date < start_date:
        raise ValueError("End date must be on or after start date.")

    overlap = db.query(LeaveRequest).filter(
        LeaveRequest.emp_id == emp_id,
        LeaveRequest.status.in_([LeaveStatus.PENDING, LeaveStatus.APPROVED]),
        LeaveRequest.start_date <= end_date, LeaveRequest.end_date >= start_date
    ).count()
    if overlap > 0:
        raise ValueError("You already have a leave request overlapping these dates.")

    days = _count_working_days(db, start_date, end_date)
    if days == 0:
        raise ValueError("Selected date range falls entirely on weekends or public holidays.")

    gender = (emp.gender or "").upper()
    if leave_type == LeaveType.MATERNITY and gender == "MALE":
        raise ValueError("Maternity leave is not applicable for male employees.")
    if leave_type == LeaveType.PATERNITY and gender != "MALE":
        raise ValueError("Paternity leave is only applicable for male employees.")

    if leave_type != LeaveType.UNPAID:
        balance = get_balance(db, emp_id)
        remaining_map = {
            LeaveType.ANNUAL: balance.get("annualRemaining"),
            LeaveType.SICK: balance.get("sickRemaining"),
            LeaveType.CASUAL: balance.get("casualRemaining"),
            LeaveType.SICK_CASUAL: balance.get("sickCasualRemaining"),
            LeaveType.MATERNITY: balance.get("maternityRemaining"),
            LeaveType.PATERNITY: balance.get("paternityRemaining"),
            LeaveType.COMPENSATORY: balance.get("compOffRemaining"),
        }
        remaining = remaining_map.get(leave_type)
        if remaining is not None and days > remaining:
            raise ValueError(
                f"Insufficient {leave_type.value.lower()} balance. "
                f"Requested: {days} working days. Available: {remaining} day(s)."
            )

    req = LeaveRequest(emp_id=emp_id, leave_type=leave_type,
                       start_date=start_date, end_date=end_date,
                       days_requested=days, reason=dto.get("reason"),
                       status=LeaveStatus.PENDING)
    req.employee = emp
    db.add(req)
    db.commit()
    db.refresh(req)

    audit_service.log(db, emp_id, "SUBMIT_LEAVE",
                      f"{leave_type.value} leave {start_date} to {end_date} ({days} working days)")
    return _to_dto(req)


def cancel_leave(db: Session, emp_id: str, leave_id: int) -> dict:
    req = db.query(LeaveRequest).filter(LeaveRequest.id == leave_id).first()
    if not req:
        raise EntityNotFoundException(f"Leave request not found: {leave_id}")
    if req.emp_id != emp_id:
        raise ValueError("You can only cancel your own leave requests.")
    if req.status != LeaveStatus.PENDING:
        raise ValueError(f"Only PENDING leave requests can be cancelled. This request has already been {req.status.value}.")
    req.status = LeaveStatus.CANCELLED
    _remove_on_leave_attendance(db, emp_id, req.start_date, req.end_date)
    db.commit()
    audit_service.log(db, emp_id, "CANCEL_LEAVE", f"Cancelled leave request id={leave_id}")
    return _to_dto(req)


def review_leave(db: Session, leave_id: int, action: str, reviewed_by: str, review_notes: str | None) -> dict:
    action_enum = LeaveStatus(action)
    if action_enum not in (LeaveStatus.APPROVED, LeaveStatus.REJECTED):
        raise ValueError("Action must be APPROVED or REJECTED.")

    req = db.query(LeaveRequest).filter(LeaveRequest.id == leave_id).first()
    if not req:
        raise EntityNotFoundException(f"Leave request not found: {leave_id}")
    if req.status != LeaveStatus.PENDING:
        raise ValueError(f"Only PENDING leave requests can be reviewed. This request has already been {req.status.value}.")
    if req.emp_id == reviewed_by:
        raise ValueError("You cannot review your own leave request.")

    if action_enum == LeaveStatus.APPROVED:
        conflicts = db.query(LeaveRequest).filter(
            LeaveRequest.emp_id == req.emp_id, LeaveRequest.id != leave_id,
            LeaveRequest.status == LeaveStatus.APPROVED,
            LeaveRequest.start_date <= req.end_date, LeaveRequest.end_date >= req.start_date
        ).count()
        if conflicts > 0:
            raise ValueError("Cannot approve: an approved leave already exists for these dates.")
        _deduct_balance(db, req.emp_id, req.leave_type, req.days_requested, req.start_date.year)
        _create_on_leave_attendance(db, req.employee, req.start_date, req.end_date)

    req.status = action_enum
    req.reviewed_by = reviewed_by
    req.reviewed_at = datetime.now()
    req.review_notes = review_notes
    db.commit()

    audit_service.log(db, reviewed_by, f"{action}_LEAVE",
                      f"{action} leave id={leave_id} for {req.emp_id} ({req.days_requested} days)")
    notification_service.send_leave_status_notification(
        db, req.emp_id, action, req.leave_type.value, review_notes, req.id)
    return _to_dto(req)


def grant_leave(db: Session, admin_emp_id: str, target_emp_id: str, dto: dict) -> dict:
    emp = _get_active(db, target_emp_id)
    start_date = dto["startDate"]
    end_date = dto["endDate"]
    leave_type = LeaveType(dto["leaveType"])

    if end_date < start_date:
        raise ValueError("End date must be on or after start date.")

    conflicts = db.query(LeaveRequest).filter(
        LeaveRequest.emp_id == target_emp_id, LeaveRequest.status == LeaveStatus.APPROVED,
        LeaveRequest.start_date <= end_date, LeaveRequest.end_date >= start_date
    ).count()
    if conflicts > 0:
        raise ValueError("Cannot grant leave: an approved leave already exists for these dates.")

    days = _count_working_days(db, start_date, end_date)
    if days == 0:
        raise ValueError("Selected date range falls entirely on weekends or public holidays.")

    gender = (emp.gender or "").upper()
    if leave_type == LeaveType.MATERNITY and gender == "MALE":
        raise ValueError("Maternity leave is not applicable for male employees.")
    if leave_type == LeaveType.PATERNITY and gender != "MALE":
        raise ValueError("Paternity leave is only applicable for male employees.")

    # Auto-reject overlapping PENDING requests
    pending = db.query(LeaveRequest).filter(
        LeaveRequest.emp_id == target_emp_id, LeaveRequest.status == LeaveStatus.PENDING,
        LeaveRequest.start_date <= end_date, LeaveRequest.end_date >= start_date
    ).all()
    for p in pending:
        p.status = LeaveStatus.REJECTED
        p.reviewed_by = admin_emp_id
        p.reviewed_at = datetime.now()
        p.review_notes = "Superseded by admin-granted leave."
        audit_service.log(db, admin_emp_id, "AUTO_REJECT_LEAVE",
                          f"Auto-rejected pending leave id={p.id} for {target_emp_id} (superseded by grant)")

    if leave_type != LeaveType.UNPAID:
        _deduct_balance(db, target_emp_id, leave_type, days, start_date.year)

    granted = LeaveRequest(
        emp_id=target_emp_id, leave_type=leave_type,
        start_date=start_date, end_date=end_date, days_requested=days,
        reason=dto.get("reason", "Granted by admin"),
        status=LeaveStatus.APPROVED, reviewed_by=admin_emp_id,
        reviewed_at=datetime.now(), review_notes="Leave granted directly by admin."
    )
    granted.employee = emp
    db.add(granted)
    db.commit()
    db.refresh(granted)

    _create_on_leave_attendance(db, emp, start_date, end_date)
    audit_service.log(db, admin_emp_id, "GRANT_LEAVE",
                      f"{leave_type.value} leave granted for {target_emp_id} from {start_date} to {end_date} ({days} working days)")
    return _to_dto(granted)


def get_balance(db: Session, emp_id: str) -> dict:
    today = datetime.now(IST).date()
    year = today.year
    emp = _get_active(db, emp_id)

    existing = db.query(LeaveBalance).filter(LeaveBalance.emp_id == emp_id, LeaveBalance.year == year).first()
    prev = db.query(LeaveBalance).filter(LeaveBalance.emp_id == emp_id, LeaveBalance.year == year - 1).first()

    balance = calc_service.compute(emp, year, existing, prev)
    db.add(balance)
    db.commit()
    db.refresh(balance)

    annual_accrued = balance.annual_total - balance.annual_carried_forward
    months_worked = calc_service.compute_months_worked_in_year(emp.date_of_join, year, today)
    accrual_note = (
        f"Accruing 1.25 days/month. Balance after next month: {int((months_worked + 1) * 1.25)} days accrued"
        if months_worked < 12 else "Full year accrual reached (15 days)"
    )

    gender = (emp.gender or "").upper()
    is_male = gender == "MALE"

    return {
        "empId": emp.emp_id, "employeeName": emp.name, "year": year,
        "annualTotal": balance.annual_total, "annualUsed": balance.annual_used,
        "annualRemaining": balance.remaining_annual,
        "annualCarriedForward": balance.annual_carried_forward,
        "annualAccruedThisYear": annual_accrued,
        "sickTotal": balance.sick_total, "sickUsed": balance.sick_used,
        "sickRemaining": balance.remaining_sick,
        "casualTotal": balance.casual_total, "casualUsed": balance.casual_used,
        "casualRemaining": balance.remaining_casual,
        "sickCasualTotal": balance.sick_casual_total or calc_service.SICK_CASUAL_FULL_YEAR,
        "sickCasualUsed": balance.sick_casual_used or 0,
        "sickCasualRemaining": balance.remaining_sick_casual,
        "maternityTotal": None if is_male else balance.maternity_total,
        "maternityUsed": None if is_male else balance.maternity_used,
        "maternityRemaining": None if is_male else balance.remaining_maternity,
        "paternityTotal": balance.paternity_total if is_male else None,
        "paternityUsed": balance.paternity_used if is_male else None,
        "paternityRemaining": balance.remaining_paternity if is_male else None,
        "compOffEarned": balance.comp_off_earned, "compOffUsed": balance.comp_off_used,
        "compOffRemaining": balance.remaining_comp_off,
        "unpaidUsed": balance.unpaid_used, "accrualNote": accrual_note,
    }


def get_my_leaves(db: Session, emp_id: str, page: int, size: int):
    query = db.query(LeaveRequest).filter(LeaveRequest.emp_id == emp_id).order_by(LeaveRequest.created_at.desc())
    total = query.count()
    items = query.offset(page * size).limit(size).all()
    return [_to_dto(r) for r in items], total


def get_pending_leaves(db: Session, reviewer_emp_id: str, page: int, size: int):
    reviewer = _get_active(db, reviewer_emp_id)
    is_admin = any(ur.role.role.value == "ADMIN" for ur in
                   db.query(UserRoles).filter(UserRoles.emp_id == reviewer_emp_id).all())
    if is_admin:
        query = db.query(LeaveRequest).filter(LeaveRequest.status == LeaveStatus.PENDING).order_by(LeaveRequest.created_at.asc())
    else:
        dept = reviewer.department
        query = db.query(LeaveRequest).join(Employee).filter(
            LeaveRequest.status == LeaveStatus.PENDING,
            sa_func.upper(Employee.department) == (dept.upper() if dept else "")
        ).order_by(LeaveRequest.created_at.asc())
    total = query.count()
    items = query.offset(page * size).limit(size).all()
    return [_to_dto(r) for r in items], total


def get_all_leaves(db: Session, emp_id: str | None, status: str | None, page: int, size: int):
    from sqlalchemy import func as sa_func
    query = db.query(LeaveRequest)
    if emp_id:
        query = query.filter(LeaveRequest.emp_id == emp_id)
    if status:
        query = query.filter(LeaveRequest.status == LeaveStatus(status))
    query = query.order_by(LeaveRequest.created_at.desc())
    total = query.count()
    items = query.offset(page * size).limit(size).all()
    return [_to_dto(r) for r in items], total


def recalculate_affected_leaves(db: Session, new_holiday_date: date):
    reqs = db.query(LeaveRequest).filter(
        LeaveRequest.status == LeaveStatus.APPROVED,
        LeaveRequest.start_date <= new_holiday_date,
        LeaveRequest.end_date >= new_holiday_date
    ).all()
    for req in reqs:
        old_days = req.days_requested
        new_days = _count_working_days(db, req.start_date, req.end_date)
        diff = old_days - new_days
        if diff > 0 and req.leave_type != LeaveType.UNPAID:
            req.days_requested = new_days
            _refund_balance(db, req.emp_id, req.leave_type, diff, req.start_date.year)
            audit_service.log(db, "SYSTEM", "LEAVE_RECALCULATED",
                              f"Leave id={req.id} for {req.emp_id} adjusted {old_days}→{new_days} days (new holiday: {new_holiday_date})")
    db.commit()
