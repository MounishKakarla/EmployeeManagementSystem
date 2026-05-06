"""
Employee ID generator — produces TT0001, TT0002, ... format IDs.
Mirrors EmployeeIdGenerator.java which uses a PostgreSQL sequence.
"""

from sqlalchemy import text
from sqlalchemy.orm import Session


def next_employee_id(db: Session) -> str:
    """Fetch the next value from the emp_id_seq sequence and format as TT####."""
    result = db.execute(text("SELECT nextval('emp_id_seq')"))
    seq_val = result.scalar()
    return f"TT{str(seq_val).zfill(4)}"
