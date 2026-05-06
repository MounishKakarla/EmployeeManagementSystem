"""
JWT token creation / validation + BCrypt password utilities.
Compatible with the Spring Boot JwtUtils.java (HS256, same secret & claims).
"""

import time
from datetime import datetime, timezone
from typing import Optional

from jose import JWTError, jwt
from passlib.context import CryptContext

from core.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

ALGORITHM = "HS256"


# ── Password helpers ─────────────────────────────────────────────────────────

def hash_password(plain: str) -> str:
    return pwd_context.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


# ── JWT helpers ──────────────────────────────────────────────────────────────

def _now_ms() -> int:
    return int(time.time() * 1000)


def create_access_token(
    emp_id: str,
    company_email: str,
    name: str,
    roles: list[str],
) -> str:
    """Generate an ACCESS JWT with the same claims as Spring Boot."""
    now = _now_ms()
    payload = {
        "sub": emp_id,
        "email": company_email,
        "name": name,
        "roles": roles,
        "type": "ACCESS",
        "iat": now // 1000,
        "exp": (now + settings.jwt_access_expiration_ms) // 1000,
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=ALGORITHM)


def create_refresh_token(emp_id: str) -> str:
    now = _now_ms()
    payload = {
        "sub": emp_id,
        "type": "REFRESH",
        "iat": now // 1000,
        "exp": (now + settings.jwt_refresh_expiration_ms) // 1000,
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=ALGORITHM)


def decode_token(token: str) -> Optional[dict]:
    """Decode and validate a JWT. Returns claims dict or None."""
    try:
        return jwt.decode(token, settings.jwt_secret, algorithms=[ALGORITHM])
    except JWTError:
        return None


def extract_emp_id(token: str) -> Optional[str]:
    claims = decode_token(token)
    return claims.get("sub") if claims else None


def extract_roles(token: str) -> list[str]:
    claims = decode_token(token)
    return claims.get("roles", []) if claims else []


def extract_token_type(token: str) -> Optional[str]:
    claims = decode_token(token)
    return claims.get("type") if claims else None


def is_access_token(token: str) -> bool:
    return extract_token_type(token) == "ACCESS"


def is_refresh_token(token: str) -> bool:
    return extract_token_type(token) == "REFRESH"
