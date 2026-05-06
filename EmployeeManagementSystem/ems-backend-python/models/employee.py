"""Employee ORM model — maps to the 'employees' table."""

from datetime import date, datetime

from sqlalchemy import Boolean, Column, Date, DateTime, String, Text, func
from sqlalchemy.orm import relationship

from core.database import Base


class Employee(Base):
    __tablename__ = "employees"

    emp_id = Column("emp_id", String(20), primary_key=True)
    name = Column(String(100), nullable=False)
    company_email = Column(String(100), unique=True, nullable=False)
    personal_email = Column(String(100), unique=True)
    phone_number = Column(String(20), unique=True)
    address = Column(Text)
    department = Column(String(100))
    designation = Column(String(100))
    skills = Column(Text)
    date_of_join = Column(Date)
    date_of_birth = Column(Date)
    date_of_exit = Column(Date)
    description = Column(Text)
    gender = Column(String(20))
    profile_image = Column(Text)
    is_employee_active = Column("is_employee_active", Boolean, default=True, nullable=False)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    # Relationships
    user = relationship("User", back_populates="employee", uselist=False)
    roles = relationship("UserRoles", back_populates="employee", lazy="joined")
