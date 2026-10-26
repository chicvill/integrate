@echo off
chcp 65001 > nul
echo Stopping MQnet Photos Microservice...
docker compose down
pause
