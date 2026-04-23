@echo off
echo ========================================================
echo Starting Employee Management System (ALL SERVICES)
echo ========================================================

echo.
echo [1/3] Starting Database, Backend, Python Chatbot, and React Web...
docker compose up -d

echo.
echo [2/3] Waiting for Spring Boot to create tables and injecting data...
echo (Waiting 30 seconds for backend schema generation...)
timeout /t 30 /nobreak >nul
docker exec -i ems-postgres psql -U postgres -d EMSNew < init.sql

echo.
echo [3/3] Opening a new terminal window for Native Expo Server...
cd ems-frontendNative
start cmd /k "npx expo start --lan"

echo.
echo All background services are started. You can safely close THIS window.
pause
