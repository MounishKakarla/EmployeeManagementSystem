"""AuditRepository — mirrors Spring Data JPA AuditLogRepository."""

from sqlalchemy.orm import Session
from sqlalchemy import func as sa_func

from models.audit_log import AuditLog
from repositories.base import BaseRepository


class AuditRepository(BaseRepository[AuditLog]):

    def __init__(self, db: Session) -> None:
        super().__init__(AuditLog, db)

    def find_all_paginated(self, offset: int, limit: int) -> tuple[list[AuditLog], int]:
        q = self.db.query(AuditLog).order_by(AuditLog.created_at.desc())
        return q.offset(offset).limit(limit).all(), q.count()

    def search(
        self,
        user: str | None,
        action: str | None,
        target: str | None,
        offset: int,
        limit: int,
    ) -> tuple[list[AuditLog], int]:
        q = self.db.query(AuditLog)
        if user and user.strip():
            q = q.filter(AuditLog.user == user.strip())
        if action and action.strip():
            q = q.filter(sa_func.lower(AuditLog.action).like(f"%{action.strip().lower()}%"))
        if target and target.strip():
            q = q.filter(sa_func.lower(AuditLog.target).like(f"%{target.strip().lower()}%"))
        q = q.order_by(AuditLog.created_at.desc())
        return q.offset(offset).limit(limit).all(), q.count()

    def find_by_user(self, emp_id: str, offset: int, limit: int) -> tuple[list[AuditLog], int]:
        q = (
            self.db.query(AuditLog)
            .filter(AuditLog.user == emp_id)
            .order_by(AuditLog.created_at.desc())
        )
        return q.offset(offset).limit(limit).all(), q.count()
