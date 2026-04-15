"""
llm_utils.py — Groq LLM helpers (no Streamlit dependency)
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
    "bar":       ["bar chart", "bar graph", "bar"],
    "line":      ["line chart", "line graph", "line", "trend"],
    "pie":       ["pie chart", "pie", "donut", "doughnut"],
    "histogram": ["histogram", "distribution"],
    "area":      ["area chart", "area graph", "area"],
    "scatter":   ["scatter chart", "scatter plot", "scatter"],
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
    "add":    ["add", "create", "insert", "new", "register"],
    "update": ["update", "edit", "modify", "change"],
    "delete": ["delete", "remove"],
}

ENTITY_MAP = [
    "employee", "leave", "attendance", "timesheet",
    "user", "role", "holiday", "salary",
]


# ── Chart intent ───────────────────────────────────────────────────────────────

def detect_chart_intent(prompt: str) -> dict | None:
    """
    Returns { chart_type, sql_prompt } if the prompt requests a chart,
    otherwise None.
    """
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


# ── CRUD intent ────────────────────────────────────────────────────────────────

def detect_crud_intent(prompt: str) -> dict | None:
    """
    Returns { action, entity } if the prompt is a CRUD request.
    e.g. 'add employee' → { action: 'add', entity: 'employee' }
    Returns None for pure read/query requests.
    """
    pl = prompt.lower()

    detected_action = None
    for action, keywords in CRUD_INTENT.items():
        if any(kw in pl for kw in keywords):
            detected_action = action
            break

    if not detected_action:
        return None

    # Don't treat read-only questions as CRUD
    read_signals = ["show", "list", "get", "fetch", "find", "how many", "count", "who", "which", "what"]
    if any(sig in pl for sig in read_signals):
        return None

    detected_entity = "employee"
    for entity in ENTITY_MAP:
        if entity in pl:
            detected_entity = entity
            break

    return {"action": detected_action, "entity": detected_entity}


# ── SQL Validation ─────────────────────────────────────────────────────────────

def validate_sql(sql: str) -> tuple[bool, str]:
    """
    Validates that the generated SQL is a single, well-formed statement.
    Returns (is_valid, error_message).
    """
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

    union_connectors = len(re.findall(
        r'\b(UNION\s+ALL|UNION|INTERSECT|EXCEPT)\b',
        sql_clean, re.IGNORECASE
    ))

    if top_level_selects > union_connectors + 1:
        return False, (
            f"Multiple disconnected SELECT statements detected "
            f"({top_level_selects} SELECTs, {union_connectors} UNION connectors). "
            "The LLM generated two separate queries — please rephrase."
        )

    return True, ""


# ── NL → SQL ───────────────────────────────────────────────────────────────────

def get_sql_query_from_nl(prompt: str, schema: dict, db_type: str) -> str | None:
    """Convert a natural-language question to raw SQL using Groq LLM."""
    schema_parts = []
    for table, cols in schema.items():
        col_strings = []
        for c in cols:
            nullability = "NULL" if c["nullable"] else "NOT NULL"
            sensitivity = " [SENSITIVE - NEVER SELECT]" if c.get("sensitive") else ""
            col_strings.append(f"{c['name']} ({nullability}){sensitivity}")
        schema_parts.append(f"Table {table}: {', '.join(col_strings)}")
    schema_text = "\n".join(schema_parts)

    sensitive_col_names = [
        c["name"]
        for cols in schema.values()
        for c in cols
        if c.get("sensitive")
    ]
    sensitive_col_list = ", ".join(sensitive_col_names) or "none"

    if db_type == "postgres":
        db_rules = """
- Use ILIKE for case-insensitive text search (e.g. WHERE city ILIKE '%hyderabad%').
- Use TRUE/FALSE for booleans.
- For "compare X vs rest" use CASE-WHEN-GROUP-BY:
    SELECT CASE WHEN <cond> THEN '<Label>' ELSE 'Rest' END AS label,
           COUNT(*) AS count FROM <table> GROUP BY label;
- For city/location filters: WHERE city ILIKE '%<city>%'
- For department filters: WHERE department ILIKE '%<dept>%'
"""
    elif db_type == "mysql":
        db_rules = """
- Use LIKE for text search (e.g. WHERE city LIKE '%hyderabad%').
- Use 1/0 for booleans.
- For "compare X vs rest" use CASE-WHEN-GROUP-BY.
"""
    else:
        db_rules = """
- Use LIKE for text search.
- For "compare X vs rest" use CASE-WHEN-GROUP-BY.
"""

    full_prompt = f"""You are a SQL expert for {db_type}. Your ONLY job is to output a single valid SQL SELECT statement. Nothing else.

DATABASE SCHEMA:
{schema_text}

ABSOLUTE RULES (violating any rule makes the output invalid):
1. Output EXACTLY ONE SQL statement. No semicolons in the middle. No second SELECT after the first query ends.
2. NEVER output two separate queries concatenated together. If the question seems to need two things, combine them into ONE query using JOIN, subquery, CTE (WITH), or UNION ALL.
3. FORBIDDEN operations: DROP, TRUNCATE. All other DML/DDL (INSERT, UPDATE, DELETE, ALTER, CREATE) are allowed when the question requires them.
4. NEVER select or expose these sensitive columns: {sensitive_col_list}
5. Return ONLY raw SQL — no explanation, no markdown, no backticks, no comments.
6. Do NOT reuse aliases like 'label' or 'count' unless the current question is an aggregation/grouping query.
7. For plain row-fetching questions (e.g. "show employees from Hyderabad"), select the actual columns (emp_id, name, city, etc.) with a WHERE filter — do NOT use GROUP BY or COUNT.
8. For aggregation/chart queries: include one label column and one numeric column with short aliases (AS count, AS total, AS avg_salary).
{db_rules}

IMPORTANT — Match query type to question intent:
- "show / list / give / find" → plain SELECT with WHERE filter, no aggregation
- "how many / count / group by / breakdown / distribution" → aggregation with GROUP BY
- "compare X vs rest" → CASE-WHEN-GROUP-BY pattern

Question: {prompt}

SQL:"""

    try:
        response = requests.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers={"Authorization": f"Bearer {GROQ_API_KEY}"},
            json={
                "model": "llama-3.3-70b-versatile",
                "messages": [{"role": "user", "content": full_prompt}],
                "temperature": 0,
            },
        )
        sql = response.json()["choices"][0]["message"]["content"].strip()

        sql = re.sub(r"```sql\s*", "", sql, flags=re.IGNORECASE)
        sql = re.sub(r"```\s*", "", sql)
        sql = sql.strip().rstrip(";")

        is_valid, error = validate_sql(sql)
        if not is_valid:
            correction_prompt = f"""The SQL you generated was invalid: {error}

Regenerate a SINGLE valid SQL SELECT statement for this question: {prompt}

Schema:
{schema_text}

Output ONLY the raw SQL with no explanation."""
            retry_response = requests.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers={"Authorization": f"Bearer {GROQ_API_KEY}"},
                json={
                    "model": "llama-3.3-70b-versatile",
                    "messages": [{"role": "user", "content": correction_prompt}],
                    "temperature": 0,
                },
            )
            sql = retry_response.json()["choices"][0]["message"]["content"].strip()
            sql = re.sub(r"```sql\s*", "", sql, flags=re.IGNORECASE)
            sql = re.sub(r"```\s*", "", sql)
            sql = sql.strip().rstrip(";")

        return sql

    except Exception:
        return None