"""
Resume Router
=============
POST /api/resume/upload — Upload a PDF resume and extract structured data
"""

import os
import re
import json
from datetime import datetime

import pdfplumber
from fastapi import APIRouter, UploadFile, File
from groq import Groq
from dotenv import load_dotenv

load_dotenv()

router = APIRouter()

client = Groq(api_key=os.getenv("GROQ_API_KEY"))

TEMP_FILE = "temp_resume.pdf"


# ── Helpers ────────────────────────────────────────────────────────────────────

def extract_text(file_path: str) -> str:
    text = ""
    with pdfplumber.open(file_path) as pdf:
        for page in pdf.pages:
            text += page.extract_text() or ""
    return text


def clean_json(raw: str) -> dict:
    match = re.search(r"\{.*\}", raw, re.DOTALL)
    if not match:
        return {}
    try:
        return json.loads(match.group())
    except Exception:
        return {}


def normalize_dob(dob_str: str) -> str:
    if not dob_str:
        return ""
    formats = [
        "%d/%m/%Y", "%m/%d/%Y", "%d-%m-%Y",
        "%B %d, %Y", "%d %B %Y", "%Y-%m-%d",
        "%b %d, %Y",  "%d %b %Y",
    ]
    for fmt in formats:
        try:
            return datetime.strptime(dob_str.strip(), fmt).strftime("%Y-%m-%d")
        except ValueError:
            continue
    return ""


# ── Endpoint ───────────────────────────────────────────────────────────────────

@router.post("/upload")
async def upload_resume(file: UploadFile = File(...)):
    """
    Accept a PDF resume, extract text with pdfplumber, then call Groq LLM
    to parse it into a structured JSON object.
    """
    try:
        content = await file.read()
        with open(TEMP_FILE, "wb") as f:
            f.write(content)

        text = extract_text(TEMP_FILE)

        prompt = f"""Return ONLY a raw JSON object. No markdown, no code blocks, no explanation.

{{
  "fName": "",
  "lName": "",
  "pEmail": "",
  "phoneNumber": "",
  "dob": "",
  "address": {{
    "street": "",
    "city": "",
    "state": "",
    "zip": "",
    "country": ""
  }},
  "skills": []
}}

Rules:
- Extract only factual data from the resume
- Missing values must be empty string "" or empty array []
- dob must be in YYYY-MM-DD format only
- phoneNumber should not include country code if present
- skills must be a flat array of strings e.g. ["Python", "React", "Docker"]
- Extract all technical and soft skills mentioned anywhere in the resume
- Do not add, rename, or nest extra fields
- Return nothing except the JSON object

Resume:
{text}
"""

        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": prompt}],
            temperature=0,
        )
        raw    = response.choices[0].message.content
        parsed = clean_json(raw)

        result = {
            "fName":       parsed.get("fName", ""),
            "lName":       parsed.get("lName", ""),
            "pEmail":      parsed.get("pEmail", ""),
            "phoneNumber": parsed.get("phoneNumber", ""),
            "dob":         normalize_dob(parsed.get("dob", "")),
            "address": {
                "street":  parsed.get("address", {}).get("street",  ""),
                "city":    parsed.get("address", {}).get("city",    ""),
                "state":   parsed.get("address", {}).get("state",   ""),
                "zip":     parsed.get("address", {}).get("zip",     ""),
                "country": parsed.get("address", {}).get("country", ""),
            },
            "skills": (
                parsed.get("skills", [])
                if isinstance(parsed.get("skills"), list)
                else []
            ),
        }

        return result

    except Exception as exc:
        return {"error": "Failed to process resume", "details": str(exc)}

    finally:
        if os.path.exists(TEMP_FILE):
            os.remove(TEMP_FILE)