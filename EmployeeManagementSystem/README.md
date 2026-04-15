# Tektalis EMS — Complete Employee Management System

## Architecture
| Service | Port | Stack |
|---------|------|-------|
| Spring Boot Backend | 8080 | Java 25, Spring Boot 4, Spring Security, JPA |
| FastAPI Python | 8000 | FastAPI, Groq LLaMA, pdfplumber, psycopg2 |
| React Frontend | 5173 | React 18, Vite, TanStack Query, Zustand |

## Database Setup
```sql
CREATE DATABASE "EMSNew";
\c Tekdb
CREATE SEQUENCE IF NOT EXISTS emp_id_seq START WITH 1 INCREMENT BY 1;
INSERT INTO roles (role) VALUES ('ADMIN'),('MANAGER'),('EMPLOYEE') ON CONFLICT DO NOTHING;
```

## 1. Run the Spring Boot Backend
Open a terminal and run the following commands:
```bash
cd ems-backend

# Run using Maven (if installed globally)
mvn spring-boot:run

# Or run using the Maven wrapper:
# .\mvnw.cmd spring-boot:run (Windows)
# ./mvnw spring-boot:run (Linux/macOS)
```

## 2. Run the Chatbot Service (FastAPI)
Open a new terminal and run:
```bash
cd ems-chatbot

# Create and activate a virtual environment
python -m venv venv
venv\Scripts\activate      # Windows
# source venv/bin/activate # Linux/macOS

# Install dependencies
pip install -r requirements.txt

# Copy environment variables and configure keys (e.g., GROQ_API_KEY)
copy .env.example .env     # Windows
# cp .env.example .env     # Linux/macOS

# Start the server
uvicorn main:app --reload --port 8000
```

## 3. Run the Frontend (React)
Open a new terminal and run:
```bash
cd ems-frontend

# Install dependencies
npm install

# Copy environment variables
copy .env.example .env     # Windows
# cp .env.example .env     # Linux/macOS

# Start the development server
npm run dev
```
