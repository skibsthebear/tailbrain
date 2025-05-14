@echo off
REM Script to start TailBrain with proper initialization sequence

echo Stopping any running Docker containers...
docker-compose down

echo ===================================================
echo IMPORTANT: Make sure to run "npm run relay:install" 
echo before continuing if you haven't already installed
echo the required dependencies.
echo ===================================================
echo.
pause

echo Starting Host Command Relay in a new window...
REM Start the relay in a new command prompt window.
start "Host Relay" node start-relay.js

REM Give the relay a moment to start
echo Waiting for relay to initialize...
timeout /t 5 /nobreak > nul

echo Building Docker images...
docker-compose build

echo Starting Docker Compose services in detached mode...
docker-compose up -d

echo.
echo TailBrain should be starting up.
echo The Host Command Relay is running in a separate window.
echo Close that window manually to stop the relay.
echo To stop Docker services, run "docker-compose down" 