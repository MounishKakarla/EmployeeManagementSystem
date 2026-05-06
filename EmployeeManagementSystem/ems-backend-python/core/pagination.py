"""
Pagination helper — converts Spring Data's page/size/sort params
to SQLAlchemy offset/limit and returns Spring-compatible Page response.
"""

from __future__ import annotations

from typing import Any, Callable, TypeVar

from fastapi import Query as QueryParam
from sqlalchemy.orm import Query


def paginate_params(
    page: int = QueryParam(0, ge=0, description="Zero-based page index"),
    size: int = QueryParam(10, ge=1, le=200, description="Page size"),
):
    """FastAPI dependency returning (page, size)."""
    return {"page": page, "size": size}


def spring_page_response(
    items: list[Any],
    total: int,
    page: int,
    size: int,
) -> dict:
    """Build a Spring Data Page-compatible JSON response."""
    total_pages = (total + size - 1) // size if size > 0 else 0
    return {
        "content": items,
        "totalElements": total,
        "totalPages": total_pages,
        "size": size,
        "number": page,
        "first": page == 0,
        "last": page >= total_pages - 1 if total_pages > 0 else True,
        "empty": len(items) == 0,
        "numberOfElements": len(items),
    }
