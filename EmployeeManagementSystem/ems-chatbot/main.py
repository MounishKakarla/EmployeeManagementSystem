"""
Tektalis Python Services — FastAPI only (no Streamlit)
=======================================================
Exposes:
  /api/resume    — PDF resume parser
  /api/chatbot   — SQL chatbot (query, schema, add, update, delete)

Run:
  uvicorn main:app --reload --port 8000
"""

import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import resume, chatbot

app = FastAPI(
    title="Tektalis Python Services",
    description="Resume parser + SQL chatbot for Tektalis EMS",
    version="1.0.0",
)

_default_origins = [
    "http://localhost:5173",
    "http://localhost:3000",
    "http://localhost:8080",
]
_extra = [o.strip() for o in os.getenv("ALLOWED_ORIGINS", "").split(",") if o.strip()]
_allowed_origins = _default_origins + _extra

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(resume.router,  prefix="/api/resume",  tags=["Resume"])
app.include_router(chatbot.router, prefix="/api/chatbot", tags=["Chatbot"])


@app.get("/health")
def health():
    return {"status": "ok", "service": "tektalis-python"}