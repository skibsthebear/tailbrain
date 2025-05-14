# Host Command Relay

This system allows Docker containers to execute commands on the host machine securely via a simple HTTP API.

## How It Works

1. A small Express.js server runs on the host machine
2. The Docker container makes HTTP requests to the relay server
3. The relay executes commands on the host and returns the results
4. No need to mount host directories or give excessive privileges

## Setup

### On the Host Machine

1. Install Node.js if not already installed
2. Install dependencies:

   ```
   npm install -g express cors
   ```

   or

   ```
   npm install --prefix . -f relay-package.json
   ```

3. Start the relay:
   ```
   node host-command-relay.js
   ```

### In the Docker Container

1. Make sure your container can reach the host
2. Set the environment variable `HOST_RELAY_URL` (e.g., `http://host.docker.internal:7655`)
3. Use axios or another HTTP client to make requests to the relay

## Security Considerations

This relay provides access to execute commands on the host system. Consider:

- Using authentication for the relay API
- Limiting which commands can be executed
- Running the relay on a local-only interface
- Implementing proper input validation

## API

- `GET /health` - Check if the relay is running
- `POST /execute` - Execute a command on the host
  - Request body: `{ "command": "your command here" }`
  - Response: `{ "stdout": "...", "stderr": "..." }`
