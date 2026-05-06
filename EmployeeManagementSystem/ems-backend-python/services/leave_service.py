"""Leave service — business logic only; all DB access via repositories."""

from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo
from sqlalchemy.orm import Session

from core.exceptions import EmployeeNotFoundException, EntityNotFoundException
from models.attendance import Attendance
from models.employee import Employee
from models.leave_request import LeaveRequest
from models.enums import LeaveStatus, LeaveType, AttendanceStatus
from repositories.attendance_repository import AttendanceRepository
from repositories.employee_repository import EmployeeRepository
from repositories.holiday_repository import HolidayRepository
from repositories.leave_repository import LeaveRequestRepository, LeaveBalanceRepository
from repositories.role_repository import RoleRepository
from services import leave_calculation_service as calc_service
from services import audit_service, notification_service

IST = ZoneInfo("Asia/Kolkata")


# ── DTO mapper ────────────────────────────────────────────────────────────────

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


# ── Internal helpers ──────────────────────────────────────────────────────────

def _get_active(db: Session, emp_id: str) -> Employee:
    emp = EmployeeRepository(db).find_active(emp_id)
    if not emp:
        raise EmployeeNotFoundException(f"Employee not found: {emp_id}")
    return emp


def _count_working_days(db: Session, start: date, end: date) -> int:
    holidays = HolidayRepository(db).find_dates_in_range(start, end)
    count = 0
    cur = start
    while cur <= end:
        if cur.weekday() < 5 and cur not in holidays:
            count += 1
        cur += timedelta(days=1)
    return count


def _deduct_balance(db: Session, emp_id: str, leave_type: LeaveType, days: int, year: int):
    emp = _get_active(db, emp_id)
    bal_repo = LeaveBalanceRepository(db)
    bal = bal_repo.find_by_emp_year(emp_id, year)
    if not bal:
        prev = bal_repo.find_by_emp_year(emp_id, year - 1)
        bal = calc_service.compute(emp, year, None, prev)
        bal_repo.save(bal)
        bal_repo.flush()
    mapping = {
        LeaveType.ANNUAL: "annual_used", LeaveType.SICK: "sick_used",
        LeaveType.CASUAL: "casual_used", LeaveType.SICK_CASUAL: "sick_casual_used",
        LeaveType.UNPAID: "unpaid_used", LeaveType.MATERNITY: "maternity_used",
        LeaveType.PATERNITY: "paternity_used", LeaveType.COMPENSATORY: "comp_off_used",
    }
    field = mapping.get(leave_type)
    if field:
        setattr(bal, field, (getattr(bal, field) or 0) + days)


def _refund_balance(db: Session, emp_id: str, leave_type: LeaveType, days: int, year: int):
    bal = LeaveBalanceRepository(db).find_by_emp_year(emp_id, year)
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
        setattr(bal, field, max(0, (getattr(bal, field) or 0) - days))


def _create_on_leave_attendance(db: Session, emp: Employee, start: date, end: date):
    att_repo = AttendanceRepository(db)
    cur = start
    while cur <= end:
        if cur.weekday() < 5:
            existing = att_repo.find_by_emp_and_date(emp.emp_id, cur)
            if existing:
                existing.status = AttendanceStatus.ON_LEAVE
                existing.notes = "On approved leave"
                existing.recorded_by = "SYSTEM"
            else:
                rec = Attendance(emp_id=emp.emp_id, attendance_date=cur,
                                 status=AttendanceStatus.ON_LEAVE,
                                 notes="On approved leave", recorded_by="SYSTEM")
                rec.employee = emp
                att_repo.save(rec)
        cur += timedelta(days=1)


def _remove_on_leave_attendance(db: Session, emp_id: str, start: date, end: date):
    att_repo = AttendanceRepository(db)
    cur = start
    while cur <= end:
        if cur.weekday() < 5:
            rec = att_repo.find_by_emp_and_date(emp_id, cur)
            if rec and rec.status == AttendanceStatus.ON_LEAVE and rec.recorded_by == "SYSTEM":
                att_repo.delete(rec)
        cur += timedelta(days=1)


# ── Service methods ───────────────────────────────────────────────────────────

def submit_leave(db: Session, emp_id: str, dto: dict) -> dict:
    emp = _get_active(db, emp_id)
    leave_repo = LeaveRequestRepository(db)
    start_date = dto["startDate"]
    end_date   = dto["endDate"]
    leave_type = LeaveType(dto["leaveType"])

    today = datetime.now(IST).date()
    if start_date < today:
        raise ValueError("Start date cannot be in the past.")
    if end_date < start_date:
        raise ValueError("End date must be on or after start date.")

    if leave_repo.count_overlapping(emp_id, start_date, end_date) > 0:
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
            LeaveType.ANNUAL:       balance.get("annualRemaining"),
            LeaveType.SICK:         balance.get("sickRemaining"),
            LeaveType.CASUAL:       balance.get("casualRemaining"),
            LeaveType.SICK_CASUAL:  balance.get("sickCasualRemaining"),
            LeaveType.MATERNITY:    balance.get("maternityRemaining"),
            LeaveType.PATERNITY:    balance.get("paternityRemaining"),
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
    leave_repo.save(req)
    leave_repo.commit()
    leave_repo.refresh(req)

    audit_service.log(db, emp_id, "SUBMIT_LEAVE",
                      f"{leave_type.value} leave {start_date} to {end_date} ({days} working days)")
    return _to_dto(req)


def cancel_leave(db: Session, emp_id: str, leave_id: int) -> dict:
    leave_repo = LeaveRequestRepository(db)
    req = leave_repo.find_by_id(leave_id)
    if not req:
        raise EntityNotFoundException(f"Leave request not found: {leave_id}")
    if req.emp_id != emp_id:
        raise ValueError("You can only cancel your own leave requests.")
    if req.status != LeaveStatus.PENDING:
        raise ValueError(f"Only PENDING leave requests can be cancelled. This request has already been {req.status.value}.")
    req.status = LeaveStatus.CANCELLED
    _remove_on_leave_attendance(db, emp_id, req.start_date, req.end_date)
    leave_repo.commit()
    audit_service.log(db, emp_id, "CANCEL_LEAVE", f"Cancelled leave request id={leave_id}")
    return _to_dto(req)


def review_leave(db: Session, leave_id: int, action: str, reviewed_by: str, review_notes: str | None) -> dict:
    action_enum = LeaveStatus(action)
    if action_enum not in (LeaveStatus.APPROVED, LeaveStatus.REJECTED):
        raise ValueError("Action must be APPROVED or REJECTED.")

    leave_repo = LeaveRequestRepository(db)
    req = leave_repo.find_by_id(leave_id)
    if not req:
        raise EntityNotFoundException(f"Leave request not found: {leave_id}")
    if req.status != LeaveStatus.PENDING:
        raise ValueError(f"Only PENDING leave requests can be reviewed. This request has already been {req.status.value}.")
    if req.emp_id == reviewed_by:
        raise ValueError("You cannot review your own leave request.")

    if action_enum == LeaveStatus.APPROVED:
        if leave_repo.count_approved_conflicts(req.emp_id, req.start_date, req.end_date, exclude_id=leave_id) > 0:
            raise ValueError("Cannot approve: an approved leave already exists for these dates.")
        _deduct_balance(db, req.emp_id, req.leave_type, req.days_requested, req.start_date.year)
        _create_on_leave_attendance(db, req.employee, req.start_date, req.end_date)

    req.status      = action_enum
    req.reviewed_by = reviewed_by
    req.reviewed_at = datetime.now()
    req.review_notes = review_notes
    leave_repo.commit()

    audit_service.log(db, reviewed_by, f"{action}_LEAVE",
                      f"{action} leave id={leave_id} for {req.emp_id} ({req.days_requested} days)")
    notification_service.send_leave_status_notification(
        db, req.emp_id, action, req.leave_type.value, review_notes, req.id)
    return _to_dto(req)


def grant_leave(db: Session, admin_emp_id: str, target_emp_id: str, dto: dict) -> dict:
    emp = _get_active(db, target_emp_id)
    leave_repo = LeaveRequestRepository(db)
    start_date = dto["startDate"]
    end_date   = dto["endDate"]
    leave_type = LeaveType(dto["leaveType"])

    if end_date < start_date:
        raise ValueError("End date must be on or after start date.")

    if leave_repo.count_approved_conflicts(target_emp_id, start_date, end_date) > 0:
        raise ValueError("Cannot grant leave: an approved leave already exists for these dates.")

    days = _count_working_days(db, start_date, end_date)
    if days == 0:
        raise ValueError("Selected date range falls entirely on weekends or public holidays.")

    gender = (emp.gender or "").upper()
    if leave_type == LeaveType.MATERNITY and gender == "MALE":
        raise ValueError("Maternity leave is not applicable for male employees.")
    if leave_type == LeaveType.PATERNITY and gender != "MALE":
        raise ValueError("Paternity leave is only applicable for male employees.")

    for p in leave_repo.find_pending_overlapping(target_emp_id, start_date, end_date):
        p.status      = LeaveStatus.REJECTED
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
    leave_repo.save(granted)
    leave_repo.commit()
    leave_repo.refresh(granted)

    _create_on_leave_attendance(db, emp, start_date, end_date)
    audit_service.log(db, admin_emp_id, "GRANT_LEAVE",
                      f"{leave_type.value} leave granted for {target_emp_id} from {start_date} to {end_date} ({days} working days)")
    return _to_dto(granted)


def get_balance(db: Session, emp_id: str) -> dict:
    today = datetime.now(IST).date()
    year  = today.year
    emp   = _get_active(db, emp_id)
    bal_repo = LeaveBalanceRepository(db)

    existing = bal_repo.find_by_emp_year(emp_id, year)
    prev     = bal_repo.find_by_emp_year(emp_id, year - 1)
    balance  = calc_service.compute(emp, year, existing, prev)
    bal_repo.save(balance)
    bal_repo.commit()
    bal_repo.refresh(balance)

    annual_accrued = balance.annual_total - balance.annual_carried_forward
    months_worked  = calc_service.compute_months_worked_in_year(emp.date_of_join, year, today)
    accrual_note   = (
        f"Accruing 1.25 days/month. Balance after next month: {int((months_worked + 1) * 1.25)} days accrued"
        if months_worked < 12 else "Full year accrual reached (15 days)"
    )
    gender  = (emp.gender or "").upper()
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
    items, total = LeaveRequestRepository(db).find_by_emp_paginated(emp_id, page * size, size)
    return [_to_dto(r) for r in items], total


def get_pending_leaves(db: Session, reviewer_emp_id: str, page: int, size: int):
    reviewer  = _get_active(db, reviewer_emp_id)
    is_admin  = "ADMIN" in RoleRepository(db).get_role_values(reviewer_emp_id)
    leave_repo = LeaveRequestRepository(db)
    if is_admin:
        items, total = leave_repo.find_pending_admin(page * size, size)
    else:
        items, total = leave_repo.find_pending_for_dept(reviewer.department or "", page * size, size)
    return [_to_dto(r) for r in items], total


def get_all_leaves(db: Session, emp_id: str | None, status: str | None, page: int, size: int):
    items, total = LeaveRequestRepository(db).find_all_filtered(emp_id, status, page * size, size)
    return [_to_dto(r) for r in items], total


def recalculate_affected_leaves(db: Session, new_holiday_date: date):
    leave_repo = LeaveRequestRepository(db)
    for req in leave_repo.find_approved_covering_date(new_holiday_date):
        old_days = req.days_requested
        new_days = _count_working_days(db, req.start_date, req.end_date)
        diff = old_days - new_days
        if diff > 0 and req.leave_type != LeaveType.UNPAID:
            req.days_requested = new_days
            _refund_balance(db, req.emp_id, req.leave_type, diff, req.start_date.year)
            audit_service.log(db, "SYSTEM", "LEAVE_RECALCULATED",
                              f"Leave id={req.id} for {req.emp_id} adjusted {old_days}→{new_days} days (new holiday: {new_holiday_date})")
    leave_repo.commit()
