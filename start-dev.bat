@echo off
REM Script to start the host command relay and then build and run Docker Compose

echo Starting Host Command Relay in a new window...
REM Start the relay in a new command prompt window.
REM The "" is for the title of the new window, can be left empty.
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