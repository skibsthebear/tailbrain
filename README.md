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

## Running with Docker

### Option 1: Using Docker Compose (Recommended)

1. Clone this repository:
   ```bash
   git clone <repository-url>
   cd tailbrain
   ```

2. Build and run the application:
   ```bash
   docker-compose build  # Build the image with your latest changes
   docker-compose up -d  # Run in detached mode
   ```

The application will be available at http://localhost:7654

### Option 2: Using Docker Directly

1. Clone this repository:
   ```bash
   git clone <repository-url>
   cd tailbrain
   ```

2. Build the Docker image:
   ```bash
   docker build -t tailbrain .
   ```

3. Run the container:
   ```bash
   # Linux
   docker run -d -p 7654:7654 -v /var/run/docker.sock:/var/run/docker.sock:ro --name tailbrain tailbrain
   
   # Windows (PowerShell)
   docker run -d -p 7654:7654 -v //var/run/docker.sock:/var/run/docker.sock:ro --name tailbrain tailbrain
   ```

The application will be available at http://localhost:7654

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
