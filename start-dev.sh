#!/bin/bash
# Script to start TailBrain with proper initialization sequence

echo "Stopping any running Docker containers..."
docker-compose down

echo "==================================================="
echo "IMPORTANT: Make sure to run \"npm run relay:install\"" 
echo "before continuing if you haven't already installed"
echo "the required dependencies."
echo "==================================================="
echo ""
read -p "Press any key to continue..." -n1 -s
echo ""

echo "Starting Host Command Relay in the background..."
node start-relay.js &
RELAY_PID=$!

# Give the relay a moment to start
echo "Waiting for relay to initialize..."
sleep 3

echo "Building Docker images..."
docker-compose build

echo "Starting Docker Compose services in detached mode..."
docker-compose up -d

echo ""
echo "TailBrain should be starting up."
echo "Attempting to open TailBrain in your default browser..."
# For Linux:
(xdg-open http://localhost:7654 &)
# For macOS, you might use:
# (open http://localhost:7654 &)

echo "The Host Command Relay is running with PID: $RELAY_PID"
echo "You can stop the relay manually if needed using 'kill $RELAY_PID'"
echo "To stop Docker services, run 'docker-compose down'" 