# TailBrain

A web dashboard to monitor and manage Tailscale serve/funnel ports and Docker containers.

## Features

- Monitor Tailscale serve ports
- Monitor Tailscale funnel configurations
- View Docker containers with clickable links to services
- Add/remove Tailscale serve ports
- Add/remove Tailscale funnel ports

## Requirements

- Docker
- Docker Compose (optional, for easier deployment)
- Tailscale installed on the host machine

## Running with Docker

### Option 1: Using Docker Compose (Recommended)

1. Clone this repository
2. Run the following command:

```bash
docker-compose up -d
```

The application will be available at http://localhost:7654

### Option 2: Using Docker Directly

1. Clone this repository
2. Build the Docker image:

```bash
docker build -t tailbrain .
```

3. Run the container:

```bash
docker run -d -p 7654:7654 -v /var/run/docker.sock:/var/run/docker.sock:ro --name tailbrain tailbrain
```

The application will be available at http://localhost:7654

## Accessing the Application

Once running, access the dashboard by navigating to:

```
http://localhost:7654
```

## Using with Tailscale

For the application to work properly, you need to have Tailscale installed and running on the host machine. The application uses the `tailscale` CLI commands to manage serve and funnel ports.

## Development

If you want to run the application in development mode:

```bash
npm run dev
```

This will start both the frontend and backend in development mode.
