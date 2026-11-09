#!/bin/bash

# 切換到腳本所在目錄底下的 backend 資料夾
cd "$(dirname "$0")/backend" || exit 1

echo "Starting NTOU Marketplace at http://localhost:8080/login.html"

# 確保 mvnw 有執行權限並啟動 Spring Boot
chmod +x ./mvnw
./mvnw spring-boot:run -Dspring-boot.run.profiles=demo

# 對應 Windows 的 pause
read -n 1 -s -r -p "Press any key to continue..."
echo