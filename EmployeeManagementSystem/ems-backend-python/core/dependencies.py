"""
FastAPI dependency functions for authentication & authorisation.
Replaces @PreAuthorize and JwtAuthenticationFilter from Spring Boot.
"""

from typing import Optional

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from core.database import get_db
from core.security import decode_token


def _extract_token(request: Request) -> Optional[str]:
    """Extract JWT from Authorization header or access_token cookie."""
    # 1. Authorization: Bearer <token>
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        return auth_header[7:]
    # 2. Cookie
    return request.cookies.get("access_token")


def get_current_user(request: Request, db: Session = Depends(get_db)) -> dict:
    """
    Returns the authenticated user's claims dict:
        { "emp_id": str, "roles": list[str], "email": str, "name": str }
    Raises 401 if unauthenticated.
    """
    token = _extract_token(request)
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")

    claims = decode_token(token)
    if not claims or claims.get("type") != "ACCESS":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")

    return {
        "emp_id": claims["sub"],
        "roles": claims.get("roles", []),
        "email": claims.get("email", ""),
        "name": claims.get("name", ""),
    }


def require_role(*allowed_roles: str):
    """
    Returns a dependency that checks the current user has at least one of the
    allowed roles.  Usage:

        @router.post("/employee")
        def add(user=Depends(require_role("ADMIN"))):
            ...
    """
    def dependency(user: dict = Depends(get_current_user)) -> dict:
        user_roles = user.get("roles", [])
        if not any(r in user_roles for r in allowed_roles):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
        return user
    return dependency


def require_authenticated(user: dict = Depends(get_current_user)) -> dict:
    """Any authenticated user — same as @PreAuthorize("isAuthenticated()")."""
    return user
