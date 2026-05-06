"""User ORM model — maps to the 'users' table."""

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, String, Text, func
from sqlalchemy.orm import relationship

from core.database import Base


class User(Base):
    __tablename__ = "users"

    emp_id = Column(String(20), ForeignKey("employees.emp_id"), primary_key=True)
    password = Column(String(255), nullable=False)
    is_user_active = Column("is_user_active", Boolean, default=True, nullable=False)
    push_token = Column(String(255))
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    employee = relationship("Employee", back_populates="user")
