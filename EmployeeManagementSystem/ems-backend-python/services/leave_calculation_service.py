"""
Leave calculation service — mirrors LeaveCalculationService.java.
All policy constants and accrual logic replicated exactly.
"""

import math
from datetime import date

from models.employee import Employee
from models.leave_balance import LeaveBalance

# ── Policy constants ─────────────────────────────────────────────────────────
ANNUAL_FULL_YEAR = 15
ANNUAL_PER_MONTH = 1.25
ANNUAL_CARRY_CAP = 30

SICK_FULL_YEAR = 6
CASUAL_FULL_YEAR = 4
SICK_CASUAL_FULL_YEAR = 10

MATERNITY_DAYS = 182
PATERNITY_DAYS = 15


def _null_safe(value: int | None) -> int:
    return value if value is not None else 0


def _pro_rate(full_year_days: int, months_worked: int) -> int:
    if months_worked >= 12:
        return full_year_days
    return math.ceil(months_worked / 12.0 * full_year_days)


def compute_months_worked_in_year(joining_date: date | None, year: int, as_of: date) -> int:
    if joining_date is None:
        return 0
    year_start = date(year, 1, 1)
    year_end = date(year, 12, 31)
    if joining_date > year_end:
        return 0
    from_date = joining_date if joining_date > year_start else year_start
    to_date = as_of if as_of < year_end else year_end
    if from_date > to_date:
        return 0
    return to_date.month - from_date.month + 1


def compute(employee: Employee, year: int,
            existing: LeaveBalance | None,
            prev_year: LeaveBalance | None) -> LeaveBalance:
    """Build or refresh a LeaveBalance record."""
    from datetime import date as date_type
    from zoneinfo import ZoneInfo
    from datetime import datetime

    today = datetime.now(ZoneInfo("Asia/Kolkata")).date()
    joining_date = employee.date_of_join

    months_worked = compute_months_worked_in_year(joining_date, year, today)

    if months_worked == 0:
        if existing is not None:
            return existing
        bal = LeaveBalance(emp_id=employee.emp_id, year=year)
        return bal

    is_joining_year = joining_date is not None and joining_date.year == year

    # Annual
    annual_accrued = (
        int(math.floor(months_worked * ANNUAL_PER_MONTH))
        if is_joining_year else ANNUAL_FULL_YEAR
    )

    carry_forward = 0
    if prev_year is not None:
        carry_forward = min(prev_year.remaining_annual, ANNUAL_CARRY_CAP)
    elif existing is not None:
        carry_forward = _null_safe(existing.annual_carried_forward)

    annual_total = annual_accrued + carry_forward

    # Sick
    sick_total = _pro_rate(SICK_FULL_YEAR, months_worked) if is_joining_year else SICK_FULL_YEAR
    # Casual
    casual_total = _pro_rate(CASUAL_FULL_YEAR, months_worked) if is_joining_year else CASUAL_FULL_YEAR
    # Sick/Casual combined
    sick_casual_total = _pro_rate(SICK_CASUAL_FULL_YEAR, months_worked) if is_joining_year else SICK_CASUAL_FULL_YEAR

    gender = (employee.gender or "").upper()
    is_male = gender == "MALE"

    if existing is not None:
        existing.annual_total = annual_total
        existing.annual_carried_forward = carry_forward
        existing.sick_total = sick_total
        existing.casual_total = casual_total
        if _null_safe(existing.sick_casual_total) == 0:
            existing.sick_casual_total = sick_casual_total
        if not is_male:
            if not existing.maternity_total:
                existing.maternity_total = MATERNITY_DAYS
            existing.paternity_total = 0
        else:
            if not existing.paternity_total:
                existing.paternity_total = PATERNITY_DAYS
            existing.maternity_total = 0
        return existing

    bal = LeaveBalance(
        emp_id=employee.emp_id,
        year=year,
        annual_total=annual_total,
        annual_used=0,
        annual_carried_forward=carry_forward,
        sick_total=sick_total,
        sick_used=0,
        casual_total=casual_total,
        casual_used=0,
        sick_casual_total=sick_casual_total,
        sick_casual_used=0,
        maternity_total=0 if is_male else MATERNITY_DAYS,
        maternity_used=0,
        paternity_total=PATERNITY_DAYS if is_male else 0,
        paternity_used=0,
        comp_off_earned=0,
        comp_off_used=0,
        unpaid_used=0,
    )
    bal.employee = employee
    return bal


def year_end_reset(employee: Employee, prev_balance: LeaveBalance | None, new_year: int) -> LeaveBalance:
    carry_forward = 0
    if prev_balance is not None:
        carry_forward = min(prev_balance.remaining_annual, ANNUAL_CARRY_CAP)

    gender = (employee.gender or "").upper()
    is_male = gender == "MALE"

    bal = LeaveBalance(
        emp_id=employee.emp_id,
        year=new_year,
        annual_total=ANNUAL_FULL_YEAR + carry_forward,
        annual_used=0,
        annual_carried_forward=carry_forward,
        sick_total=SICK_FULL_YEAR,
        sick_used=0,
        casual_total=CASUAL_FULL_YEAR,
        casual_used=0,
        sick_casual_total=SICK_CASUAL_FULL_YEAR,
        sick_casual_used=0,
        maternity_total=0 if is_male else MATERNITY_DAYS,
        maternity_used=0,
        paternity_total=PATERNITY_DAYS if is_male else 0,
        paternity_used=0,
        comp_off_earned=0,
        comp_off_used=0,
        unpaid_used=0,
    )
    bal.employee = employee
    return bal
