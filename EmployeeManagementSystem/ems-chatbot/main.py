"""
Tektalis Python Services — FastAPI only (no Streamlit)
=======================================================
Exposes:
  /api/resume    — PDF resume parser
  /api/chatbot   — SQL chatbot (query, schema, add, update, delete)

Run:
  uvicorn main:app --reload --port 8000
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import resume, chatbot

app = FastAPI(
    title="Tektalis Python Services",
    description="Resume parser + SQL chatbot for Tektalis EMS",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",  # Vite dev
        "http://localhost:3000",  # alternate
        "http://localhost:8080",  # Spring Boot proxy
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(resume.router,  prefix="/api/resume",  tags=["Resume"])
app.include_router(chatbot.router, prefix="/api/chatbot", tags=["Chatbot"])


@app.get("/health")
def health():
    return {"status": "ok", "service": "tektalis-python"}