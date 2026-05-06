"""AuditLog schema."""

from datetime import datetime
from typing import Optional
from pydantic import BaseModel


class AuditLogDTO(BaseModel):
    id: int
    user: Optional[str] = None
    action: Optional[str] = None
    target: Optional[str] = None
    createdAt: Optional[datetime] = None

    class Config:
        from_attributes = True
