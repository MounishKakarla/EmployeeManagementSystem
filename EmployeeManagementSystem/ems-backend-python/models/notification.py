"""Notification ORM model — maps to the 'notifications' table."""

from sqlalchemy import BigInteger, Boolean, Column, DateTime, String, Text, func

from core.database import Base


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    emp_id = Column(String(20), nullable=False)
    title = Column(String(255))
    body = Column(Text)
    category = Column(String(50))
    related_id = Column(BigInteger)
    read = Column("is_read", Boolean, default=False)
    created_at = Column(DateTime, server_default=func.now())
