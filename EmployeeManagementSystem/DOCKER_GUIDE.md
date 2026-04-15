# Running EMS with Docker 🐳

This guide explains how to build and run the complete Employee Management System (EMS) using Docker Compose.

## Prerequisites

- **Docker Desktop** installed and running.
- **Docker Compose** (included with Docker Desktop).

## Getting Started

### 1. Project Structure
The project is orchestrated using the root `docker-compose.yml` which manages:
- **Database**: PostgreSQL (Port 5432)
- **Backend**: Spring Boot (Port 8080)
- **Chatbot**: FastAPI (Port 8000)
- **Frontend**: React/Vite (Port 5173)

### 2. Launch the System
Open your terminal in the project root directory and run:

```bash
docker compose up -d --build
```

- `-d`: Runs the containers in "detached" mode (background).
- `--build`: Forces a rebuild of the images (ensures all recent code changes are included).

### 3. Accessing the Application
Once the containers are running, you can access the services at:

| Service | URL |
| :--- | :--- |
| **Frontend UI** | [http://localhost:5173](http://localhost:5173) |
| **Backend API** | [http://localhost:8080](http://localhost:8080) |
| **Chatbot API** | [http://localhost:8000](http://localhost:8000) |
| **Swagger Docs** | [http://localhost:8080/swagger-ui.html](http://localhost:8080/swagger-ui.html) |

### 4. Default Login Credentials
The system is pre-initialized with a dummy user via `init.sql`:
- **Employee ID**: `TT0001`
- **Password**: `password` (if using the default hash in init.sql) or check your manual inserts.
- **Roles**: `ADMIN`, `MANAGER`, `EMPLOYEE`

---

## Maintenance Commands

### Resetting the Database
If you want to clear all data and re-run the `init.sql` script from scratch:
```bash
docker compose down -v
docker compose up -d
```
*Note: The `-v` flag deletes the persistent database volume.*

### Viewing Logs
If a service isn't working as expected, check the logs:
```bash
# All services
docker compose logs -f

# Specific service (e.g., chatbot)
docker logs ems-chatbot
```

### Stopping the Project
To stop all containers:
```bash
docker compose stop
```

To stop and remove containers/networks:
```bash
docker compose down
```
