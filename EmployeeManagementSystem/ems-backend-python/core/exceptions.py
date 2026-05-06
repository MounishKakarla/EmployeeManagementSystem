"""
Custom exceptions + global FastAPI exception handlers.
Mirrors GlobalExceptionHandler.java error response shape.
"""

from datetime import datetime

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse


# ── Domain exceptions ─────────────────────────────────────────────────────────

class EmployeeNotFoundException(Exception):
    def __init__(self, message: str = "Employee not found"):
        self.message = message

class InactiveEmployeeException(Exception):
    def __init__(self, message: str = "Employee is inactive"):
        self.message = message

class DuplicateEmployeeException(Exception):
    def __init__(self, message: str = "Duplicate employee"):
        self.message = message

class InvalidTokenException(Exception):
    def __init__(self, message: str = "Invalid token"):
        self.message = message

class EmailSendException(Exception):
    def __init__(self, message: str = "Failed to send email"):
        self.message = message

class EntityNotFoundException(Exception):
    def __init__(self, message: str = "Entity not found"):
        self.message = message

class AccessDeniedException(Exception):
    def __init__(self, message: str = "Access denied"):
        self.message = message


# ── Error response shape (matches ErrorResponse.java) ─────────────────────────

def _error_body(status_code: int, message: str) -> dict:
    return {
        "status": status_code,
        "message": message,
        "timestamp": datetime.now().isoformat(),
    }


# ── Register handlers ────────────────────────────────────────────────────────

def register_exception_handlers(app: FastAPI) -> None:

    @app.exception_handler(EmployeeNotFoundException)
    async def _(req: Request, exc: EmployeeNotFoundException):
        return JSONResponse(status_code=404, content=_error_body(404, exc.message))

    @app.exception_handler(InactiveEmployeeException)
    async def _(req: Request, exc: InactiveEmployeeException):
        return JSONResponse(status_code=403, content=_error_body(403, exc.message))

    @app.exception_handler(DuplicateEmployeeException)
    async def _(req: Request, exc: DuplicateEmployeeException):
        return JSONResponse(status_code=409, content=_error_body(409, exc.message))

    @app.exception_handler(InvalidTokenException)
    async def _(req: Request, exc: InvalidTokenException):
        return JSONResponse(status_code=401, content=_error_body(401, exc.message))

    @app.exception_handler(EmailSendException)
    async def _(req: Request, exc: EmailSendException):
        return JSONResponse(status_code=503, content=_error_body(503, exc.message))

    @app.exception_handler(EntityNotFoundException)
    async def _(req: Request, exc: EntityNotFoundException):
        return JSONResponse(status_code=404, content=_error_body(404, exc.message))

    @app.exception_handler(AccessDeniedException)
    async def _(req: Request, exc: AccessDeniedException):
        return JSONResponse(status_code=403, content=_error_body(403, exc.message))

    @app.exception_handler(ValueError)
    async def _(req: Request, exc: ValueError):
        return JSONResponse(status_code=400, content=_error_body(400, str(exc)))

    @app.exception_handler(Exception)
    async def _(req: Request, exc: Exception):
        # Don't swallow HTTPExceptions from FastAPI itself
        if isinstance(exc, HTTPException):
            return JSONResponse(
                status_code=exc.status_code,
                content=_error_body(exc.status_code, exc.detail),
            )
        import traceback
        traceback.print_exc()
        return JSONResponse(
            status_code=500,
            content=_error_body(500, "An unexpected error occurred. Please try again or contact support."),
        )
