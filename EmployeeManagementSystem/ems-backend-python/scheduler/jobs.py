"""Scheduler jobs — mirrors AbsenceScheduler.java and LeaveYearEndScheduler.java."""

import logging
from datetime import date, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy.orm import Session

from core.database import SessionLocal
from models.attendance import Attendance
from models.employee import Employee
from models.leave_balance import LeaveBalance
from models.enums import AttendanceStatus
from services import holiday_service, leave_calculation_service as calc_service

logger = logging.getLogger(__name__)
IST = ZoneInfo("Asia/Kolkata")


def mark_absent_employees():
    """10:00 AM IST, Mon-Fri — mark absent any employee with no attendance record."""
    from datetime import datetime
    today = datetime.now(IST).date()
    db: Session = SessionLocal()
    try:
        if holiday_service.is_holiday_or_weekend(db, today):
            logger.info("AbsenceScheduler: %s is a holiday/weekend — skipping.", today)
            return

        # Find employees with no record today
        all_active = db.query(Employee.emp_id).filter(Employee.is_employee_active == True).all()
        have_record = {r[0] for r in db.query(Attendance.emp_id).filter(Attendance.attendance_date == today).all()}
        absent_ids = [eid for (eid,) in all_active if eid not in have_record]

        count = 0
        for emp_id in absent_ids:
            emp = db.query(Employee).filter(Employee.emp_id == emp_id).first()
            if not emp:
                continue
            rec = Attendance(emp_id=emp_id, attendance_date=today,
                             status=AttendanceStatus.ABSENT,
                             notes="Auto-marked ABSENT at 10:00 AM IST",
                             recorded_by="SYSTEM")
            rec.employee = emp
            db.add(rec)
            count += 1
        db.commit()
        logger.info("AbsenceScheduler: Marked %d ABSENT on %s", count, today)
    except Exception as e:
        db.rollback()
        logger.error("AbsenceScheduler error: %s", e)
    finally:
        db.close()


def mark_holidays_and_weekends():
    """00:01 AM IST daily — create WEEKEND/HOLIDAY records for calendar completeness."""
    from datetime import datetime
    today = datetime.now(IST).date()
    db: Session = SessionLocal()
    try:
        is_weekend = today.weekday() >= 5
        is_holiday = holiday_service.is_holiday_or_weekend(db, today) and not is_weekend
        if not is_weekend and not is_holiday:
            return

        status = AttendanceStatus.WEEKEND if is_weekend else AttendanceStatus.HOLIDAY
        note = "Weekend" if is_weekend else "Public Holiday"

        all_active = db.query(Employee.emp_id).filter(Employee.is_employee_active == True).all()
        have_record = {r[0] for r in db.query(Attendance.emp_id).filter(Attendance.attendance_date == today).all()}

        count = 0
        for (emp_id,) in all_active:
            if emp_id in have_record:
                continue
            emp = db.query(Employee).filter(Employee.emp_id == emp_id).first()
            if not emp:
                continue
            rec = Attendance(emp_id=emp_id, attendance_date=today,
                             status=status, notes=note, recorded_by="SYSTEM")
            rec.employee = emp
            db.add(rec)
            count += 1
        db.commit()
        if count > 0:
            logger.info("AbsenceScheduler: Created %d %s records for %s", count, status.value, today)
    except Exception as e:
        db.rollback()
        logger.error("Holiday/Weekend scheduler error: %s", e)
    finally:
        db.close()


def leave_year_end_reset():
    """00:05 AM Jan 1 — carry-forward and reset balances for the new year."""
    from datetime import datetime
    new_year = datetime.now(IST).date().year
    prev_year = new_year - 1
    db: Session = SessionLocal()
    try:
        logger.info("LeaveYearEndScheduler: Starting reset %d → %d", prev_year, new_year)
        active = db.query(Employee).filter(Employee.is_employee_active == True).all()
        created = 0
        for emp in active:
            try:
                existing = db.query(LeaveBalance).filter(
                    LeaveBalance.emp_id == emp.emp_id, LeaveBalance.year == new_year
                ).first()
                if existing:
                    continue
                prev = db.query(LeaveBalance).filter(
                    LeaveBalance.emp_id == emp.emp_id, LeaveBalance.year == prev_year
                ).first()
                new_balance = calc_service.year_end_reset(emp, prev, new_year)
                db.add(new_balance)
                created += 1
            except Exception as e:
                logger.error("LeaveYearEndScheduler: Failed for %s: %s", emp.emp_id, e)
        db.commit()
        logger.info("LeaveYearEndScheduler: Done. Created=%d, Total=%d", created, len(active))
    except Exception as e:
        db.rollback()
        logger.error("LeaveYearEndScheduler error: %s", e)
    finally:
        db.close()
