@echo off
setlocal
cd /d "%~dp0backend"
echo Starting NTOU Marketplace at http://localhost:8080/login.html
call mvnw.cmd spring-boot:run -Dspring-boot.run.profiles=demo
pause
