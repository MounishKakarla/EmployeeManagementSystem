"""Timesheet service — mirrors TimesheetServiceImpl.java."""

from datetime import date, datetime, timedelta
from decimal import Decimal
from sqlalchemy.orm import Session

from core.exceptions import EmployeeNotFoundException, EntityNotFoundException
from models.timesheet import Timesheet
from models.employee import Employee
from models.leave_request import LeaveRequest
from models.holiday_calendar import HolidayCalendar
from models.enums import TimesheetStatus, LeaveStatus
from services import audit_service, notification_service


def _get_active(db: Session, emp_id: str) -> Employee:
    emp = db.query(Employee).filter(Employee.emp_id == emp_id, Employee.is_employee_active == True).first()
    if not emp:
        raise EmployeeNotFoundException(f"Employee not found: {emp_id}")
    return emp


def _to_monday(d: date) -> date:
    return d - timedelta(days=d.weekday())


def _or_zero(v) -> Decimal:
    return Decimal(str(v)) if v is not None else Decimal("0")


def _to_dto(t: Timesheet) -> dict:
    emp = t.employee
    total = sum(_or_zero(getattr(t, f"{d}_hours")) for d in
                ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"])
    return {
        "id": t.id, "empId": emp.emp_id, "employeeName": emp.name,
        "department": emp.department, "profileImage": emp.profile_image,
        "weekStartDate": t.week_start_date.isoformat(),
        "project": t.project, "taskDescription": t.task_description,
        "startTime": t.start_time.isoformat() if t.start_time else None,
        "endTime": t.end_time.isoformat() if t.end_time else None,
        "mondayHours": float(t.monday_hours or 0), "tuesdayHours": float(t.tuesday_hours or 0),
        "wednesdayHours": float(t.wednesday_hours or 0), "thursdayHours": float(t.thursday_hours or 0),
        "fridayHours": float(t.friday_hours or 0), "saturdayHours": float(t.saturday_hours or 0),
        "sundayHours": float(t.sunday_hours or 0), "totalHours": float(total),
        "status": t.status.value if t.status else None,
        "submittedAt": t.submitted_at.isoformat() if t.submitted_at else None,
        "approvedBy": t.approved_by,
        "approvedAt": t.approved_at.isoformat() if t.approved_at else None,
        "reviewNotes": t.review_notes,
        "createdAt": t.created_at.isoformat() if t.created_at else None,
    }


def _get_week_non_working(db: Session, monday: date) -> set[date]:
    friday = monday + timedelta(days=4)
    holidays = db.query(HolidayCalendar).filter(
        HolidayCalendar.holiday_date >= monday, HolidayCalendar.holiday_date <= friday
    ).all()
    return {h.holiday_date for h in holidays}


def _get_approved_leave_dates(db: Session, emp_id: str, start: date, end: date) -> set[date]:
    leaves = db.query(LeaveRequest).filter(
        LeaveRequest.emp_id == emp_id, LeaveRequest.status == LeaveStatus.APPROVED,
        LeaveRequest.start_date <= end, LeaveRequest.end_date >= start
    ).all()
    dates = set()
    for leave in leaves:
        d = max(leave.start_date, start)
        e = min(leave.end_date, end)
        while d <= e:
            dates.add(d)
            d += timedelta(days=1)
    return dates


def _validate_hours(hours, dt: date, non_working: set[date]) -> Decimal:
    if dt in non_working:
        return Decimal("0")
    return _or_zero(hours)


def save_entry(db: Session, emp_id: str, dto: dict) -> dict:
    emp = _get_active(db, emp_id)
    week_start = _to_monday(dto["weekStartDate"])

    ts = None
    if dto.get("id"):
        ts = db.query(Timesheet).filter(Timesheet.id == dto["id"]).first()
        if not ts:
            raise EntityNotFoundException(f"Timesheet entry not found: {dto['id']}")
    if not ts:
        ts = Timesheet(emp_id=emp_id, week_start_date=week_start,
                       project=dto.get("project"), status=TimesheetStatus.DRAFT)
        ts.employee = emp
        db.add(ts)

    if ts.status == TimesheetStatus.APPROVED:
        raise ValueError("This timesheet has already been approved and cannot be edited.")

    was_submitted = ts.status == TimesheetStatus.SUBMITTED
    if dto.get("project") is not None: ts.project = dto["project"]
    if dto.get("taskDescription") is not None: ts.task_description = dto["taskDescription"]
    if dto.get("startTime") is not None: ts.start_time = dto["startTime"]
    if dto.get("endTime") is not None: ts.end_time = dto["endTime"]

    non_working = _get_week_non_working(db, week_start)
    ts.monday_hours = _validate_hours(dto.get("mondayHours"), week_start, non_working)
    ts.tuesday_hours = _validate_hours(dto.get("tuesdayHours"), week_start + timedelta(days=1), non_working)
    ts.wednesday_hours = _validate_hours(dto.get("wednesdayHours"), week_start + timedelta(days=2), non_working)
    ts.thursday_hours = _validate_hours(dto.get("thursdayHours"), week_start + timedelta(days=3), non_working)
    ts.friday_hours = _validate_hours(dto.get("fridayHours"), week_start + timedelta(days=4), non_working)
    ts.saturday_hours = _or_zero(dto.get("saturdayHours"))
    ts.sunday_hours = _or_zero(dto.get("sundayHours"))
    ts.total_hours = ts.compute_total()

    if not was_submitted:
        ts.status = TimesheetStatus.DRAFT

    db.commit()
    db.refresh(ts)
    audit_service.log(db, emp_id, "SAVE_TIMESHEET_DRAFT" if not was_submitted else "UPDATE_SUBMITTED_TIMESHEET",
                      f"{'Saved draft' if not was_submitted else 'Updated submitted entry'} for week {week_start} project={ts.project}")
    return _to_dto(ts)


def submit_week(db: Session, emp_id: str, week_start_date: date) -> dict:
    week_start = _to_monday(week_start_date)
    entries = db.query(Timesheet).filter(
        Timesheet.emp_id == emp_id, Timesheet.week_start_date == week_start
    ).all()
    if not entries:
        raise ValueError(f"No timesheet entries found for the week of {week_start}.")

    today = date.today()
    holidays = _get_week_non_working(db, week_start)
    leave_days = _get_approved_leave_dates(db, emp_id, week_start, week_start + timedelta(days=4))

    day_fields = ["monday_hours", "tuesday_hours", "wednesday_hours", "thursday_hours", "friday_hours"]
    day_names = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]
    for day_idx in range(5):
        workday = week_start + timedelta(days=day_idx)
        if workday > today or workday in holidays or workday in leave_days:
            continue
        total_for_day = sum(_or_zero(getattr(t, day_fields[day_idx])) for t in entries)
        if total_for_day == 0:
            raise ValueError(f"Hours missing for {day_names[day_idx]} {workday}. Fill all working days before submitting.")

    now = datetime.now()
    for t in entries:
        t.status = TimesheetStatus.SUBMITTED
        t.submitted_at = now
    db.commit()
    audit_service.log(db, emp_id, "SUBMIT_TIMESHEET", f"Submitted timesheet for week {week_start} ({len(entries)} entries)")
    return _to_dto(entries[0])


def get_current_week(db: Session, emp_id: str):
    return get_week(db, emp_id, date.today())


def get_week(db: Session, emp_id: str, week_start_date: date):
    monday = _to_monday(week_start_date)
    entries = db.query(Timesheet).filter(
        Timesheet.emp_id == emp_id, Timesheet.week_start_date == monday
    ).all()
    return [_to_dto(t) for t in entries]


def get_my_timesheets(db: Session, emp_id: str, from_date: date | None, to_date: date | None, page: int, size: int):
    f = from_date or date(2000, 1, 1)
    t = to_date or date(2100, 12, 31)
    query = db.query(Timesheet).filter(
        Timesheet.emp_id == emp_id, Timesheet.week_start_date >= f, Timesheet.week_start_date <= t
    ).order_by(Timesheet.week_start_date.desc())
    total = query.count()
    items = query.offset(page * size).limit(size).all()
    return [_to_dto(ts) for ts in items], total


def review_entry(db: Session, ts_id: int, action: str, reviewed_by: str, review_notes: str | None) -> dict:
    action_enum = TimesheetStatus(action)
    if action_enum not in (TimesheetStatus.APPROVED, TimesheetStatus.REJECTED):
        raise ValueError("Action must be APPROVED or REJECTED.")

    ts = db.query(Timesheet).filter(Timesheet.id == ts_id).first()
    if not ts:
        raise EntityNotFoundException(f"Timesheet not found: {ts_id}")
    if ts.status != TimesheetStatus.SUBMITTED:
        raise ValueError(f"Only SUBMITTED timesheets can be reviewed. This one is currently {ts.status.value}.")

    week_friday = ts.week_start_date + timedelta(days=4)
    if week_friday >= date.today():
        raise ValueError(f"This week (ending {week_friday}) is still in progress. Timesheets can only be reviewed from Saturday onwards.")
    if ts.emp_id == reviewed_by:
        raise ValueError("You cannot review your own timesheet.")

    ts.status = action_enum
    ts.approved_by = reviewed_by
    ts.approved_at = datetime.now()
    ts.review_notes = review_notes
    db.commit()

    audit_service.log(db, reviewed_by, f"{action}_TIMESHEET",
                      f"{action} timesheet id={ts_id} for {ts.emp_id} week={ts.week_start_date}")
    notification_service.send_timesheet_status_notification(
        db, ts.emp_id, action, str(ts.week_start_date), review_notes, ts.id)
    return _to_dto(ts)


def get_team_timesheets(db: Session, emp_id: str | None, status: str | None,
                        from_date: date | None, to_date: date | None, page: int, size: int):
    from sqlalchemy import func as sa_func
    f = from_date or date(2000, 1, 1)
    t = to_date or date(2100, 12, 31)
    query = db.query(Timesheet).join(Employee).filter(
        Timesheet.status != TimesheetStatus.DRAFT,
        Timesheet.week_start_date >= f, Timesheet.week_start_date <= t
    )
    if emp_id:
        query = query.filter(
            (sa_func.lower(Employee.emp_id).like(f"%{emp_id.lower()}%")) |
            (sa_func.lower(Employee.name).like(f"%{emp_id.lower()}%"))
        )
    if status:
        query = query.filter(Timesheet.status == TimesheetStatus(status))
    query = query.order_by(Timesheet.week_start_date.desc(), Employee.name.asc())
    total = query.count()
    items = query.offset(page * size).limit(size).all()
    return [_to_dto(ts) for ts in items], total


def get_pending_timesheets(db: Session, page: int, size: int):
    query = db.query(Timesheet).filter(Timesheet.status == TimesheetStatus.SUBMITTED).order_by(Timesheet.submitted_at.asc())
    total = query.count()
    items = query.offset(page * size).limit(size).all()
    return [_to_dto(ts) for ts in items], total


def delete_entry(db: Session, emp_id: str, ts_id: int) -> None:
    ts = db.query(Timesheet).filter(Timesheet.id == ts_id).first()
    if not ts:
        raise EntityNotFoundException(f"Timesheet not found: {ts_id}")
    if ts.emp_id != emp_id:
        raise ValueError("You can only delete your own timesheet entries.")
    if ts.status == TimesheetStatus.APPROVED:
        raise ValueError("Approved timesheets cannot be deleted.")
    db.delete(ts)
    db.commit()
    audit_service.log(db, emp_id, "DELETE_TIMESHEET", f"Deleted timesheet id={ts_id} week={ts.week_start_date}")
