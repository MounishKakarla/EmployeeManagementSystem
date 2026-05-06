"""Notification schema."""

from datetime import datetime
from typing import Optional
from pydantic import BaseModel


class NotificationDTO(BaseModel):
    id: int
    empId: str
    title: Optional[str] = None
    body: Optional[str] = None
    category: Optional[str] = None
    relatedId: Optional[int] = None
    read: bool = False
    createdAt: Optional[datetime] = None

    class Config:
        from_attributes = True
