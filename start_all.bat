@echo off
cd /d "%~dp0"
start cmd /k "cd backend && npm start"
start cmd /k "cd frontend && npm run dev"
echo Servers started...
