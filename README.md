<div align="center">
  <img src="logo.png" alt="TailBrain Logo" width="150"/>
  <h1>✨ TailBrain ✨</h1>
</div>

**A web dashboard to monitor and manage Tailscale serve/funnel ports, Docker containers, and Docker Compose applications.**

---

## 🚀 Features

- 👀 Monitor Tailscale `serve` ports
- 📡 Monitor Tailscale `funnel` configurations
- 🐳 View Docker containers with clickable links to services
- ➕ Add/remove Tailscale `serve` ports
- ➖ Add/remove Tailscale `funnel` ports
- 🚢 Manage Docker Compose applications (`up`/`down`)

---

## 📋 Requirements

- 🐳 **Docker & Docker Compose**: For deployment and Docker Compose management.
- <img src="https://tailscale.com/static/images/logo.svg" width="16"/> **Tailscale**: Installed and configured on the host machine.
- <img src="https://nodejs.org/static/images/logo.svg" width="16"/> **Node.js**: v16+ (primarily for the Host Command Relay and optional local development).

---

## 🖥️ Platform Compatibility

TailBrain is designed to work on both Windows and Linux systems.

### 🪟 Windows Users

- Ensure Docker Desktop is installed and running.
- Use standard Windows paths for Docker Compose file locations (e.g., `C:\path\to\docker-compose.yml`).
- If using WSL2, ensure paths are accessible to the backend service.

### 🐧 Linux Users

- Ensure Docker and Docker Compose are installed.
- Use standard Linux paths for Docker Compose file locations (e.g., `/path/to/docker-compose.yml`).
- Make sure the user running TailBrain has permissions to access the Docker socket (see [Troubleshooting](#docker-socket-access)).

---

## 🐳 Running TailBrain with Docker (Recommended)

This is the easiest and recommended way to get TailBrain up and running! It uses Docker Compose and includes starting the Host Command Relay automatically.

1.  **📥 Clone the Repository:**

    ```bash
    git clone <repository-url> # Replace <repository-url> with the actual URL
    cd tailbrain
    ```

2.  **🛠️ Install Host Command Relay Dependencies:**
    (This step only needs to be run once, or when `express` or `cors` dependencies for the relay need an update.)

    ```bash
    npm run relay:install
    ```

3.  **🚀 Start the Application:**
    Run the appropriate start script for your Operating System:

    - **🐧 For Linux/macOS:**
      Make the script executable (if you haven't already):

      ```bash
      chmod +x start-dev.sh
      ```

      Then run:

      ```bash
      ./start-dev.sh
      ```

      This will start the Host Command Relay in the background, build/rebuild the Docker images, and then start the services.

    - **🪟 For Windows:**
      ```bash
      start-dev.bat
      ```
      This will start the Host Command Relay in a new command prompt window, build/rebuild the Docker images, and then start the services.

    🎉 **Access TailBrain:** Once everything is up, open your browser and go to `http://localhost:7654`.
    The Host Command Relay will be running on port `7655`.

4.  **🛑 Stopping TailBrain:**
    - **Docker Services:** Navigate to the `tailbrain` directory in a terminal and run:
      ```bash
      docker-compose down
      ```
    - **Host Command Relay:**
      - On Linux/macOS: If you noted the PID from the `start-dev.sh` script, use `kill <PID>`. Otherwise, you may need to find and kill the `node start-relay.js` process manually.
      - On Windows: Close the "Host Relay" command prompt window that was opened by `start-dev.bat`.

---

## 📡 Understanding the Host Command Relay

TailBrain uses a special **Host Command Relay** system. This allows the Docker container (where TailBrain's backend runs) to securely execute specific commands (like `tailscale` and `docker-compose`) on your host machine.

- **How it works:** The `start-dev.sh` or `start-dev.bat` script starts a small Node.js server (`host-command-relay.js`) directly on your host.
- This server listens on port `7655` by default.
- The TailBrain Docker container (configured in `docker-compose.yml`) sends commands to this relay server at `http://host.docker.internal:7655`.
- **Security:** This is more secure than giving the container full Docker socket access or other broad permissions on the host, as only predefined command patterns are allowed.

---

## 🎆 Using with Tailscale

For TailBrain to manage Tailscale `serve` and `funnel` ports:

- Ensure Tailscale is installed and running on your host machine.
- The `tailscale` command must be available in your system's PATH.
  - On Windows, you might need to add the Tailscale installation directory to your PATH.
- Commands executed by TailBrain affect your host's Tailscale configuration directly.

---

## 🗂️ Docker Compose Management

TailBrain allows you to manage your Docker Compose applications through its interface:

- 📝 Add Docker Compose applications with a friendly name and the path to the compose file.
- 🚀 Run `docker-compose up -d` on your applications with a single click.
- 🛑 Run `docker-compose down` to stop and remove application containers.
- 📋 View all registered Docker Compose applications.

### 💾 Data Persistence for Compose Apps

Your Docker Compose application configurations (name and path) are stored persistently:

- Stored in a Docker volume named `tailbrain_data`.
- Located at `/app/data/compose-apps.json` inside the TailBrain container.
- This means your configurations will survive container restarts and updates.

> **Important Note:** Paths to `docker-compose.yml` files must be accessible _from the context where the command relay executes them on the host_. Usually, these would be absolute paths on your host machine.

---

## 🛠️ Development Setup (Advanced)

If you want to contribute to TailBrain or run the frontend/backend services locally _without Docker_ for development purposes:

1.  **📥 Clone Repository** (if not already done).
2.  **📦 Install Dependencies:**
    ```bash
    npm install # For root dependencies & relay
    npm install --prefix frontend
    npm install --prefix backend
    ```
3.  **⚙️ Start Development Servers:**
    ```bash
    npm run dev
    ```
    This will start the Vite frontend dev server and the Node.js backend dev server concurrently. You'll also need to manually run the **Host Command Relay** (`npm run relay` or `node start-relay.js`) on your host if the backend needs to execute host commands.

---

## 🔍 Troubleshooting

### ⚠️ Docker Socket Access Denied

If you see an error like: `Got permission denied while trying to connect to the Docker daemon socket`

- **Linux:** Ensure your user is part of the `docker` group:
  ```bash
  sudo usermod -aG docker $USER
  ```
  Then, **log out and log back in** for the group change to take effect.

### ❓ Tailscale Command Not Found

If TailBrain reports it can't find the `tailscale` command:

1.  Verify Tailscale is installed on your host.
2.  Ensure the `tailscale` command is in your system's PATH.
3.  The Host Command Relay executes `tailscale` commands on the host, so Tailscale doesn't need to be installed _inside_ the TailBrain Docker container itself.

### 📂 Path to Docker Compose Files

When adding Docker Compose applications in TailBrain:

- Provide the **absolute path** to the `docker-compose.yml` file as it exists on your host machine. The command relay will use this path to execute `docker-compose` commands.

### 🤯 Docker Build Issues

#### `Failed to prepare extraction snapshot` Error

This error is sometimes seen on Windows with Docker Desktop. Try these solutions:

1.  **🧹 Clean Docker Resources:**
    ```powershell
    # Windows PowerShell
    docker system prune -a
    ```
2.  **🔄 Restart Docker Desktop.**
3.  **🚫 Run Docker with Buildkit Disabled (Temporary):**
    ```powershell
    # Windows PowerShell
    $env:DOCKER_BUILDKIT=0
    docker-compose build
    # Unset after: $env:DOCKER_BUILDKIT=$null (or just for that command)
    ```
4.  **🔥 Use Bake for Better Performance (Experimental):**
    ```powershell
    # Windows PowerShell
    $env:COMPOSE_BAKE=true
    docker-compose build
    ```
5.  ** Nukes Everything! Last Resort - Reset Docker Desktop:**
    Open Docker Desktop Settings -> Troubleshoot -> "Clean / Purge data" -> Restart.

---

## 🏗️ Building from Source (After Code Changes)

If you've modified TailBrain's code and are using the Docker setup, you'll need to rebuild the Docker image:

```bash
# This is handled by the start-dev.sh and start-dev.bat scripts,
# but if you need to do it manually:
docker-compose build
```

Then, restart the services:

```bash
docker-compose up -d
```

(Or simply re-run `start-dev.sh`/`start-dev.bat`)

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

---

<div align="center">
  <small>Happy Tailgating & Dockering!</small>
</div>
