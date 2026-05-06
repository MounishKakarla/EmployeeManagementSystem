"""NotificationRepository — mirrors Spring Data JPA NotificationRepository."""

from sqlalchemy.orm import Session

from models.notification import Notification
from repositories.base import BaseRepository


class NotificationRepository(BaseRepository[Notification]):

    def __init__(self, db: Session) -> None:
        super().__init__(Notification, db)

    def find_by_emp_paginated(
        self, emp_id: str, offset: int, limit: int
    ) -> tuple[list[Notification], int]:
        q = (
            self.db.query(Notification)
            .filter(Notification.emp_id == emp_id)
            .order_by(Notification.created_at.desc())
        )
        return q.offset(offset).limit(limit).all(), q.count()

    def count_unread(self, emp_id: str) -> int:
        return (
            self.db.query(Notification)
            .filter(Notification.emp_id == emp_id, Notification.read == False)
            .count()
        )

    def find_unread_by_emp(self, emp_id: str) -> list[Notification]:
        return (
            self.db.query(Notification)
            .filter(Notification.emp_id == emp_id, Notification.read == False)
            .all()
        )

    def mark_all_read(self, emp_id: str) -> None:
        self.db.query(Notification).filter(
            Notification.emp_id == emp_id, Notification.read == False
        ).update({"read": True})
