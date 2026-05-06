"""Roles + UserRoles ORM models — maps to 'roles' and 'user_roles' tables."""

from sqlalchemy import BigInteger, Column, DateTime, Enum, ForeignKey, String, func
from sqlalchemy.orm import relationship

from core.database import Base
from models.enums import RolesEnum


class Roles(Base):
    __tablename__ = "roles"

    role_id = Column("role_id", BigInteger, primary_key=True, autoincrement=True)
    role = Column(Enum(RolesEnum, name="roles_enum", create_type=False), nullable=False, unique=True)


class UserRoles(Base):
    __tablename__ = "user_roles"

    emp_id = Column(String(20), ForeignKey("employees.emp_id"), primary_key=True)
    role_id = Column(BigInteger, ForeignKey("roles.role_id"), primary_key=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    employee = relationship("Employee", back_populates="roles")
    role = relationship("Roles", lazy="joined")
