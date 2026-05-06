"""
llm_utils.py — Groq LLM helpers (merged from ems-chatbot/utils/llm_utils.py)
"""

import re
import os
import requests
from dotenv import load_dotenv

load_dotenv()
GROQ_API_KEY = os.getenv("GROQ_API_KEY")

SENSITIVE_KEYWORDS = [
    "password", "passwd", "pwd", "secret", "token",
    "key", "hash", "salt", "otp", "pin", "ssn",
    "credit_card", "cvv", "card_number", "auth",
]

CHART_INTENT_KEYWORDS = [
    "chart", "graph", "plot", "visualize", "visualise",
    "bar chart", "pie chart", "line chart", "histogram",
    "donut", "trend", "distribution", "breakdown",
]

CHART_TYPE_MAP = {
    "bar": ["bar chart", "bar graph", "bar"],
    "line": ["line chart", "line graph", "line", "trend"],
    "pie": ["pie chart", "pie", "donut", "doughnut"],
    "histogram": ["histogram", "distribution"],
    "area": ["area chart", "area graph", "area"],
    "scatter": ["scatter chart", "scatter plot", "scatter"],
}

CHART_NOISE_WORDS = [
    "bar chart", "pie chart", "line chart", "donut chart", "area chart",
    "scatter chart", "histogram chart", "bar graph", "line graph", "pie graph",
    "donut graph", "scatter plot", "area graph",
    "bar", "pie", "donut", "doughnut",
    "chart", "graph", "plot", "visualize", "visualise",
    "trend", "distribution", "breakdown",
]

CRUD_INTENT = {
    "add": ["add", "create", "insert", "new", "register"],
    "update": ["update", "edit", "modify", "change"],
    "delete": ["delete", "remove"],
}

ENTITY_MAP = ["employee", "leave", "attendance", "timesheet", "user", "role", "holiday", "salary"]


def detect_chart_intent(prompt: str) -> dict | None:
    pl = prompt.lower()
    if not any(kw in pl for kw in CHART_INTENT_KEYWORDS):
        return None
    chart_type = "bar"
    for ctype, keywords in CHART_TYPE_MAP.items():
        if any(kw in pl for kw in keywords):
            chart_type = ctype
            break
    clean = pl
    for kw in sorted(CHART_NOISE_WORDS, key=len, reverse=True):
        clean = clean.replace(kw, " ")
    clean = re.sub(r"[,.\s]+", " ", clean).strip()
    return {"chart_type": chart_type, "sql_prompt": clean or prompt}


def detect_crud_intent(prompt: str) -> dict | None:
    pl = prompt.lower()
    detected_action = None
    for action, keywords in CRUD_INTENT.items():
        if any(kw in pl for kw in keywords):
            detected_action = action
            break
    if not detected_action:
        return None
    read_signals = ["show", "list", "get", "fetch", "find", "how many", "count", "who", "which", "what"]
    if any(sig in pl for sig in read_signals):
        return None
    detected_entity = "employee"
    for entity in ENTITY_MAP:
        if entity in pl:
            detected_entity = entity
            break
    return {"action": detected_action, "entity": detected_entity}


def validate_sql(sql: str) -> tuple[bool, str]:
    if not sql or not sql.strip():
        return False, "Empty SQL generated."
    sql_clean = sql.strip().rstrip(";")
    forbidden = re.findall(r'\b(DROP|TRUNCATE)\b', sql_clean, re.IGNORECASE)
    if forbidden:
        return False, f"Forbidden SQL operation detected: {forbidden[0]}"
    depth = 0
    top_level_selects = 0
    tokens = re.split(r'(\(|\)|\bSELECT\b)', sql_clean, flags=re.IGNORECASE)
    for token in tokens:
        if token == '(':
            depth += 1
        elif token == ')':
            depth -= 1
        elif token.upper() == 'SELECT' and depth == 0:
            top_level_selects += 1
    union_connectors = len(re.findall(r'\b(UNION\s+ALL|UNION|INTERSECT|EXCEPT)\b', sql_clean, re.IGNORECASE))
    if top_level_selects > union_connectors + 1:
        return False, f"Multiple disconnected SELECT statements detected ({top_level_selects} SELECTs, {union_connectors} UNION connectors)."
    return True, ""


def get_sql_query_from_nl(prompt: str, schema: dict, db_type: str) -> str | None:
    schema_parts = []
    for table, cols in schema.items():
        col_strings = []
        for c in cols:
            nullability = "NULL" if c["nullable"] else "NOT NULL"
            sensitivity = " [SENSITIVE - NEVER SELECT]" if c.get("sensitive") else ""
            col_strings.append(f"{c['name']} ({nullability}){sensitivity}")
        schema_parts.append(f"Table {table}: {', '.join(col_strings)}")
    schema_text = "\n".join(schema_parts)

    sensitive_col_names = [c["name"] for cols in schema.values() for c in cols if c.get("sensitive")]
    sensitive_col_list = ", ".join(sensitive_col_names) or "none"

    db_rules = """
- Use ILIKE for case-insensitive text search.
- Use TRUE/FALSE for booleans.
- For "compare X vs rest" use CASE-WHEN-GROUP-BY.
""" if db_type == "postgres" else "- Use LIKE for text search.\n"

    full_prompt = f"""You are a SQL expert for {db_type}. Output EXACTLY ONE valid SQL SELECT statement.

DATABASE SCHEMA:
{schema_text}

RULES:
1. Output ONE SQL statement only. No semicolons in the middle.
2. NEVER output two separate queries. Use JOIN, subquery, CTE, or UNION ALL.
3. FORBIDDEN: DROP, TRUNCATE. INSERT/UPDATE/DELETE allowed when needed.
4. NEVER select sensitive columns: {sensitive_col_list}
5. Return ONLY raw SQL — no explanation, no markdown.
{db_rules}

Question: {prompt}

SQL:"""

    try:
        response = requests.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers={"Authorization": f"Bearer {GROQ_API_KEY}"},
            json={"model": "llama-3.3-70b-versatile",
                  "messages": [{"role": "user", "content": full_prompt}],
                  "temperature": 0},
        )
        sql = response.json()["choices"][0]["message"]["content"].strip()
        sql = re.sub(r"```sql\s*", "", sql, flags=re.IGNORECASE)
        sql = re.sub(r"```\s*", "", sql)
        sql = sql.strip().rstrip(";")

        is_valid, error = validate_sql(sql)
        if not is_valid:
            retry_prompt = f"""The SQL was invalid: {error}
Regenerate a SINGLE valid SQL SELECT for: {prompt}
Schema: {schema_text}
Output ONLY raw SQL."""
            retry = requests.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers={"Authorization": f"Bearer {GROQ_API_KEY}"},
                json={"model": "llama-3.3-70b-versatile",
                      "messages": [{"role": "user", "content": retry_prompt}],
                      "temperature": 0},
            )
            sql = retry.json()["choices"][0]["message"]["content"].strip()
            sql = re.sub(r"```sql\s*", "", sql, flags=re.IGNORECASE)
            sql = re.sub(r"```\s*", "", sql)
            sql = sql.strip().rstrip(";")
        return sql
    except Exception:
        return None
