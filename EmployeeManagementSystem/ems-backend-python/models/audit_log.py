"""AuditLog ORM model — maps to the 'audit_logs' table."""

from sqlalchemy import BigInteger, Column, DateTime, String, Text, func

from core.database import Base


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    user = Column(String(50))
    action = Column(String(100))
    target = Column(Text)
    created_at = Column(DateTime, server_default=func.now())
