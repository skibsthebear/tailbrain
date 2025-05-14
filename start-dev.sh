#!/bin/bash
# Script to start the host command relay and then build and run Docker Compose

echo "Starting Host Command Relay in the background..."
node start-relay.js &
RELAY_PID=$!

# Give the relay a moment to start
sleep 2

echo "Building Docker images..."
docker-compose build

echo "Starting Docker Compose services in detached mode..."
docker-compose up -d

echo ""
echo "TailBrain should be starting up."
echo "The Host Command Relay is running with PID: $RELAY_PID"
echo "You can stop the relay manually if needed using 'kill $RELAY_PID'"
echo "To stop Docker services, run 'docker-compose down'" 