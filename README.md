# TailBrain

A web dashboard to monitor and manage Tailscale serve/funnel ports, Docker containers, and Docker Compose applications.

## Features

- Monitor Tailscale serve ports
- Monitor Tailscale funnel configurations
- View Docker containers with clickable links to services
- Add/remove Tailscale serve ports
- Add/remove Tailscale funnel ports
- Manage Docker Compose applications (up/down)

## Requirements

- Docker
- Docker Compose (for deployment and Docker Compose management)
- Tailscale installed on the host machine
- Node.js v16+ (for development only)

## Platform Compatibility

TailBrain is designed to work on both Windows and Linux systems. However, there are some important considerations:

### Windows Users

- Ensure Docker Desktop is installed and running
- Use Windows paths for Docker Compose file locations (e.g., `C:\path\to\docker-compose.yml`)
- If using WSL2, make sure paths are accessible to the backend service

### Linux Users

- Ensure Docker and Docker Compose are installed
- Use Linux paths for Docker Compose file locations (e.g., `/path/to/docker-compose.yml`)
- Make sure the user running TailBrain has permissions to access the Docker socket

## Running with Docker (Recommended)

This method uses Docker Compose and includes starting the Host Command Relay automatically.

1.  Clone this repository:

    ```bash
    git clone <repository-url>
    cd tailbrain
    ```

2.  Install Host Command Relay dependencies (if you haven't already):

    ```bash
    npm run relay:install
    ```

    This step only needs to be run once, or when `express` or `cors` dependencies for the relay need an update.

3.  Run the appropriate start script for your OS:

    - **For Linux/macOS:**
      Make the script executable (if you haven't already):

      ```bash
      chmod +x start-dev.sh
      ```

      Then run:

      ```bash
      ./start-dev.sh
      ```

      This will start the Host Command Relay in the background, build the Docker images, and then start the services.

    - **For Windows:**
      ```bash
      start-dev.bat
      ```
      This will start the Host Command Relay in a new window, build the Docker images, and then start the services.

The application will be available at `http://localhost:7654`. The Host Command Relay will be running on port `7655`.

To stop the Docker services, navigate to the `tailbrain` directory in a terminal and run:

```bash
docker-compose down
```

To stop the Host Command Relay:

- On Linux/macOS, if you noted the PID, use `kill <PID>`. Otherwise, you may need to find and kill the `node start-relay.js` process.
- On Windows, close the "Host Relay" command prompt window.

## Host Command Relay

TailBrain uses a special Host Command Relay system that allows the Docker container to execute commands on the host machine. This is particularly useful for running Tailscale and Docker commands that need to operate on the host system.

The `start-dev.sh` (for Linux/macOS) and `start-dev.bat` (for Windows) scripts handle starting the Host Command Relay for you.

The relay script (`host-command-relay.js`) runs on your host machine and listens on port `7655` by default. The Docker container is configured via the `HOST_RELAY_URL` environment variable in the `docker-compose.yml` file to communicate with `http://host.docker.internal:7655`.

This relay approach is more secure than giving the container full access to the host system, as it only allows execution of specific commands via a controlled API.

## Accessing the Application

Once running, access the dashboard by navigating to:

```
http://localhost:7654
```

## Using with Tailscale

For the application to work properly, you need to have Tailscale installed and running on the host machine. The application uses the `tailscale` CLI commands to manage serve and funnel ports.

- Ensure the `tailscale` command is available in your system's PATH
- On Windows, you may need to add the Tailscale installation directory to your PATH if it's not already there
- The container maps to the host's Tailscale configuration, so all commands affect your host's Tailscale setup

## Docker Compose Management

The Docker Compose management feature allows you to:

1. Add Docker Compose applications with a friendly name and path to the compose file
2. Run `docker-compose up -d` on your compose files with a single click
3. Run `docker-compose down` to stop and remove containers
4. View all registered Docker Compose applications

### Data Persistence

The Docker Compose configurations you add are now stored persistently in a Docker volume. This means:

- Your configurations will survive container restarts
- You won't lose your registered Docker Compose applications when upgrading TailBrain
- The configurations are stored in a JSON file at `/app/data/compose-apps.json` inside the container

Important notes:

- The path you provide must be accessible to the TailBrain backend
- When running in Docker, the path must be accessible from within the container
- Consider using volume mounts if needed to make your Docker Compose files accessible

## Development Setup

If you want to run the application in development mode:

1. Clone the repository:

   ```bash
   git clone <repository-url>
   cd tailbrain
   ```

2. Install dependencies:

   ```bash
   npm install
   npm install --prefix frontend
   npm install --prefix backend
   ```

3. Start the development servers:
   ```bash
   npm run dev
   ```

This will start both the frontend and backend in development mode.

## Troubleshooting

### Docker Socket Access

If you encounter permission errors accessing the Docker socket:

```
Error: Got permission denied while trying to connect to the Docker daemon socket
```

Ensure your user has the necessary permissions:

```bash
# Linux
sudo usermod -aG docker $USER
# Then log out and back in
```

### Tailscale Command Not Found

If the application can't find the Tailscale command:

1. Ensure Tailscale is installed
2. Make sure the Tailscale command is in your PATH
3. If running in Docker, you may need to install Tailscale in the container or make the host's Tailscale accessible

### Path to Docker Compose Files

When using the Docker Compose management feature:

- **In Docker:** Paths should be accessible from within the container. You may need to add volume mounts in your docker-compose.yml.
- **Native:** Paths should be absolute and accessible to the backend process.

### Docker Build Issues

#### Failed to Prepare Extraction Snapshot Error

If you encounter an error like this during docker-compose build:

```
failed to solve: failed to prepare extraction snapshot "extract-XXXXXXXXX-XXXX sha256:XXXXXXX": parent snapshot sha256:XXXXXXX does not exist: not found
```

This is commonly seen on Windows with Docker Desktop and can be resolved by trying one of the following:

1. **Clean Docker Resources**:

   ```powershell
   # Windows PowerShell
   docker system prune -a
   ```

2. **Restart Docker Desktop**:

   - Right-click the Docker Desktop icon in the system tray
   - Select "Restart Docker Desktop"

3. **Run Docker with Buildkit Disabled**:

   ```powershell
   # Windows PowerShell
   $env:DOCKER_BUILDKIT=0
   docker-compose build
   ```

4. **Use Bake for Better Performance** (as suggested in the error message):

   ```powershell
   # Windows PowerShell
   $env:COMPOSE_BAKE=true
   docker-compose build
   ```

5. **Last Resort**: Completely reset Docker Desktop
   - Open Docker Desktop Settings
   - Go to "Troubleshoot"
   - Click "Clean / Purge data"
   - Restart Docker Desktop

## Building from Source

If you've made changes to the code, you need to rebuild the Docker image:

```bash
# Using Docker Compose
docker-compose build

# Using Docker directly
docker build -t tailbrain .
```

Then restart the container:

```bash
# Using Docker Compose
docker-compose up -d

# Using Docker directly
docker stop tailbrain
docker rm tailbrain
docker run -d -p 7654:7654 -v /var/run/docker.sock:/var/run/docker.sock:ro --name tailbrain tailbrain
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
