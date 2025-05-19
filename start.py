#!/usr/bin/env python3

import subprocess
import os
import sys
import time
import signal
import webbrowser
import shutil
import platform
from pathlib import Path

# --- Dependency Check ---
missing_deps = []
try:
    import requests
except ImportError:
    missing_deps.append("requests")

try:
    import flask # Used by the relay, check if start.py can see it for the relay's sake
except ImportError:
    missing_deps.append("Flask (for relay)") # Clarify it's for the relay

if missing_deps:
    print(f"[ERROR] Missing critical Python dependencies: {', '.join(missing_deps)}.")
    print(f"[WARNING] Please install them by running the following command in your terminal:")
    print(f"  {sys.executable} -m pip install -r requirements.txt")
    print(f"[WARNING] Then, re-run this script (python start.py).")
    sys.exit(1)


# --- Configuration ---
RELAY_COMMAND_SCRIPT = "start_relay.py" # Script name
DOCKER_COMPOSE_CMD_NAME = "docker-compose" # Default, can be "docker compose"
APP_URL = "http://localhost:7654"
RELAY_HEALTH_URL = "http://localhost:7655/health"
APP_HEALTH_URL = f"{APP_URL}/api/health"

processes = {
    "relay": None,
    "docker_compose_process": None
}
COMMAND_PATHS = {
    "docker": None,
    "docker-compose": None,
    "tailscale": None,
    "npm": None,
    "python": sys.executable
}

# --- Helper Functions ---
def print_header(message):
    print("\n" + "=" * 60)
    print(f"=== {message.upper()} ")
    print("=" * 60)

def print_success(message):
    print(f"[SUCCESS] {message}")

def print_warning(message):
    print(f"[WARNING] {message}")

def print_error(message):
    print(f"[ERROR] {message}")

def ask_yes_no(question, default_yes=True):
    prompt = "(Y/n)" if default_yes else "(y/N)"
    while True:
        choice = input(f"{question} {prompt}: ").strip().lower()
        if not choice:
            return default_yes
        if choice in ['y', 'yes']:
            return True
        if choice in ['n', 'no']:
            return False
        print_warning("Invalid input. Please enter 'y' or 'n'.")

def run_subprocess_command(command_parts, description, shell=False, check=True, capture_output=False, text=True, working_dir=None):
    cmd_str = ' '.join(command_parts) if isinstance(command_parts, list) else command_parts
    print(f"Running: {cmd_str} ({description})...")
    try:
        process = subprocess.run(
            command_parts,
            shell=shell,
            check=check,
            capture_output=capture_output,
            text=text,
            cwd=working_dir
        )
        if capture_output:
            if process.stdout and process.stdout.strip(): print(f"Output:\n{process.stdout.strip()}")
            if process.stderr and process.stderr.strip(): print_warning(f"Errors/Warnings from {description}:\n{process.stderr.strip()}")
        print_success(f"{description} completed.")
        return process
    except subprocess.CalledProcessError as e:
        print_error(f"Failed to {description.lower()}. Return code: {e.returncode}")
        if e.stdout and e.stdout.strip(): print(f"Stdout:\n{e.stdout.strip()}")
        if e.stderr and e.stderr.strip(): print_error(f"Stderr:\n{e.stderr.strip()}")
        raise
    except FileNotFoundError:
        cmd_name = command_parts[0] if isinstance(command_parts, list) else command_parts.split()[0]
        print_error(f"Command '{cmd_name}' not found for '{description}'. Ensure it's installed and in your PATH or full path is correct.")
        raise
    except Exception as e:
        print_error(f"An unexpected error occurred while trying to {description.lower()}: {e}")
        raise

def start_background_process(command_parts, name, log_file_name_base=None):
    print(f"Starting {name} in background...")
    try:
        stdout_log = f"{log_file_name_base}_stdout.log" if log_file_name_base else os.devnull
        stderr_log = f"{log_file_name_base}_stderr.log" if log_file_name_base else os.devnull
        
        if log_file_name_base:
            stdout_dest = open(stdout_log, "wb")
            stderr_dest = open(stderr_log, "wb")
        else:
            stdout_dest = subprocess.DEVNULL
            stderr_dest = subprocess.DEVNULL

        current_env = os.environ.copy()
        if COMMAND_PATHS["docker"]:
            current_env["DOCKER_CMD_PATH"] = COMMAND_PATHS["docker"]
        if COMMAND_PATHS["tailscale"]:
            current_env["TAILSCALE_CMD_PATH"] = COMMAND_PATHS["tailscale"]

        creationflags = 0
        if platform.system() == "Windows" and name == "Relay Service":
            proc = subprocess.Popen(f"start \"{name}\" {' '.join(command_parts)}", shell=True, env=current_env)
            print_success(f"{name} started in a new window.")
            return proc
        else:
            proc = subprocess.Popen(
                command_parts,
                stdout=stdout_dest,
                stderr=stderr_dest,
                env=current_env,
                creationflags=creationflags
            )
            print_success(f"{name} started with PID: {proc.pid}. Logs (if any): {stdout_log}, {stderr_log}")
            return proc
            
    except FileNotFoundError:
        cmd_name = command_parts[0]
        print_error(f"Command '{cmd_name}' not found for {name}. Ensure it's installed and in your PATH.")
        return None
    except Exception as e:
        print_error(f"Failed to start {name}: {e}")
        return None

def check_service_health(url, service_name, retries=5, delay=3):
    print(f"Checking {service_name} health at {url}...")
    for i in range(retries):
        try:
            response = requests.get(url, timeout=5)
            if response.status_code == 200:
                print_success(f"{service_name} is up and running!")
                return True
        except requests.ConnectionError:
            if i == 0: print_warning(f"Could not connect to {service_name} at {url}. Retrying...")
        except requests.Timeout:
            if i == 0: print_warning(f"Connection to {service_name} at {url} timed out. Retrying...")
        
        if i < retries - 1:
            print(f"Retrying {service_name} health check ({i+1}/{retries})...")
            time.sleep(delay)
    print_error(f"{service_name} did not become healthy after {retries} retries.")
    return False

def cleanup_processes(sig=None, frame=None):
    print_header("Shutting down application")
    
    relay_proc_obj = processes.get("relay")
    if relay_proc_obj:
        is_windows_start_cmd = (platform.system() == "Windows" and \
                                isinstance(relay_proc_obj.args, str) and \
                                relay_proc_obj.args.startswith("start "))
        
        if not is_windows_start_cmd:
            print("Stopping Relay Service...")
            try:
                if platform.system() == "Windows":
                    relay_proc_obj.terminate()
                else:
                    os.kill(relay_proc_obj.pid, signal.SIGINT)
                relay_proc_obj.wait(timeout=10)
            except ProcessLookupError:
                print_warning("Relay process already exited.")
            except subprocess.TimeoutExpired:
                print_warning("Relay did not stop gracefully, killing.")
                relay_proc_obj.kill()
            except Exception as e:
                print_warning(f"Error stopping relay: {e}. Attempting to kill.")
                try: relay_proc_obj.kill()
                except: pass 
            processes["relay"] = None
        else:
            print_warning("Relay service was started in a separate window on Windows. Please close it manually.")
            processes["relay"] = None 

    print_success("Cleanup finished. If Docker services were run with '-d', stop them with 'docker-compose down'.")
    sys.exit(0)

def main():
    signal.signal(signal.SIGINT, cleanup_processes)
    signal.signal(signal.SIGTERM, cleanup_processes)

    print_header("TailBrain Application Starter")

    print_header("Step 1: Checking Prerequisites and Locating Commands")
    prereqs_fully_met = True 

    COMMAND_PATHS["python"] = sys.executable
    print_success(f"Python found: {COMMAND_PATHS['python']}")

    COMMAND_PATHS["docker"] = shutil.which("docker")
    if not COMMAND_PATHS["docker"] and platform.system() == "Windows":
        common_paths = [Path(r"C:\Program Files\Docker\Docker\resources\bin\docker.exe")]
        for p in common_paths:
            if p.is_file(): COMMAND_PATHS["docker"] = str(p); break
    
    DOCKER_COMPOSE_CMD_NAME_local = DOCKER_COMPOSE_CMD_NAME # Default to global
    if COMMAND_PATHS["docker"]:
        print_success(f"Docker found: {COMMAND_PATHS['docker']}")
        try:
            # Corrected line: removed stderr=subprocess.PIPE
            subprocess.run([COMMAND_PATHS["docker"], "compose", "version"], check=True, capture_output=True, text=True)
            COMMAND_PATHS["docker-compose"] = [COMMAND_PATHS["docker"], "compose"]
            DOCKER_COMPOSE_CMD_NAME_local = "docker compose" 
            print_success(f"Docker Compose (plugin) found: {' '.join(COMMAND_PATHS['docker-compose'])}")
        except (subprocess.CalledProcessError, FileNotFoundError):
            COMMAND_PATHS["docker-compose"] = shutil.which("docker-compose")
            if COMMAND_PATHS["docker-compose"]:
                DOCKER_COMPOSE_CMD_NAME_local = "docker-compose"
                print_success(f"Docker Compose (standalone) found: {COMMAND_PATHS['docker-compose']}")
            else:
                print_error("Docker Compose not found. Please install it.")
                prereqs_fully_met = False
    else:
        print_error("Docker command not found. Please install Docker Desktop or ensure 'docker' is in PATH.")
        prereqs_fully_met = False

    COMMAND_PATHS["tailscale"] = shutil.which("tailscale")
    if not COMMAND_PATHS["tailscale"] and platform.system() == "Windows":
        common_paths = [Path(r"C:\Program Files\Tailscale\tailscale.exe"), Path(r"C:\Program Files (x86)\Tailscale\tailscale.exe")]
        for p in common_paths:
            if p.is_file(): COMMAND_PATHS["tailscale"] = str(p); break
    if COMMAND_PATHS["tailscale"]:
        print_success(f"Tailscale found: {COMMAND_PATHS['tailscale']}")
    else:
        print_error("Tailscale command not found. Please install or ensure 'tailscale' is in PATH.")
        prereqs_fully_met = False
        
    COMMAND_PATHS["npm"] = shutil.which("npm")
    if COMMAND_PATHS["npm"]:
        print_success(f"npm found: {COMMAND_PATHS['npm']}")
    else:
        print_warning("npm (Node.js) not found. Needed for 'docker-compose build' (frontend).")

    if not prereqs_fully_met:
        if not ask_yes_no("Critical prerequisites (Docker/Tailscale) missing or not found. Attempt to continue anyway?", default_yes=False):
            sys.exit(1)
    
    if COMMAND_PATHS["docker"]: os.environ["DOCKER_CMD_PATH"] = COMMAND_PATHS["docker"]
    if COMMAND_PATHS["tailscale"]: os.environ["TAILSCALE_CMD_PATH"] = COMMAND_PATHS["tailscale"]

    print_header("Step 2: Initial Cleanup")
    if COMMAND_PATHS["docker-compose"]:
        print(f"Attempting to stop and remove any existing TailBrain Docker containers ({DOCKER_COMPOSE_CMD_NAME_local} down)...")
        cmd_parts_down = COMMAND_PATHS["docker-compose"] if isinstance(COMMAND_PATHS["docker-compose"], list) else [COMMAND_PATHS["docker-compose"]]
        try:
            run_subprocess_command(cmd_parts_down + ["down"], f"{DOCKER_COMPOSE_CMD_NAME_local} down")
        except Exception:
            print_warning(f"'{DOCKER_COMPOSE_CMD_NAME_local} down' encountered an issue (this might be okay if no services were running).")
            if not ask_yes_no("Problem during cleanup. Continue with startup?", default_yes=True):
                cleanup_processes()
    else:
        print_warning("Docker Compose not found, skipping initial cleanup.")

    print_header("Step 3: Start Host Command Relay")
    relay_start_cmd = [COMMAND_PATHS["python"], RELAY_COMMAND_SCRIPT]
    if processes["relay"] and processes["relay"].poll() is None:
        print_warning("Relay service seems to be already running or managed externally. Skipping start.")
    else:
        print("Attempting to start Python Host Command Relay service...")
        processes["relay"] = start_background_process(relay_start_cmd, "Relay Service", "relay_service")
        if not processes["relay"]:
            print_error("Failed to start relay service.")
            if not ask_yes_no("Continue without relay (application will likely not work)?", default_yes=False):
                cleanup_processes()
        else:
            print("Waiting for relay to initialize...")
            time.sleep(3) 
            if not check_service_health(RELAY_HEALTH_URL, "Relay Service"):
                print_error("Relay service started but is not healthy.")
                relay_proc_obj = processes.get("relay")
                if relay_proc_obj:
                    is_windows_start_cmd = (platform.system() == "Windows" and \
                                            isinstance(relay_proc_obj.args, str) and \
                                            relay_proc_obj.args.startswith("start "))
                    if not is_windows_start_cmd:
                        try: relay_proc_obj.terminate()
                        except: pass 
                if not ask_yes_no("Continue without a healthy relay (application will likely not work)?", default_yes=False):
                    cleanup_processes()

    print_header("Step 4: Build Docker Images")
    if COMMAND_PATHS["docker-compose"]:
        if ask_yes_no(f"Build/rebuild Docker images ({DOCKER_COMPOSE_CMD_NAME_local} build)?", default_yes=True):
            cmd_parts_build = COMMAND_PATHS["docker-compose"] if isinstance(COMMAND_PATHS["docker-compose"], list) else [COMMAND_PATHS["docker-compose"]]
            try:
                run_subprocess_command(cmd_parts_build + ["build"], f"{DOCKER_COMPOSE_CMD_NAME_local} build")
            except Exception:
                if not ask_yes_no("Failed to build Docker images. Continue with existing images (if any)?", default_yes=False):
                    cleanup_processes()
        else:
            print("Skipping Docker image build.")
    else:
        print_warning("Docker Compose not found, skipping build.")

    print_header("Step 5: Start Main Application (Docker Compose)")
    if COMMAND_PATHS["docker-compose"]:
        print(f"Attempting to start TailBrain application services ({DOCKER_COMPOSE_CMD_NAME_local} up -d)...")
        cmd_parts_up = COMMAND_PATHS["docker-compose"] if isinstance(COMMAND_PATHS["docker-compose"], list) else [COMMAND_PATHS["docker-compose"]]
        try:
            run_subprocess_command(cmd_parts_up + ["up", "-d"], f"{DOCKER_COMPOSE_CMD_NAME_local} up -d")
            print("Waiting for application to initialize...")
            time.sleep(5) 
            if not check_service_health(APP_HEALTH_URL, "TailBrain Application"):
                print_error(f"TailBrain application started but is not healthy. Check Docker logs: `{DOCKER_COMPOSE_CMD_NAME_local} logs`")
                print_warning(f"You may need to manually open {APP_URL} once the issue is resolved.")
            else:
                print_success(f"Application is healthy. Opening {APP_URL} in your default browser...")
                webbrowser.open(APP_URL)
        except Exception as e:
            print_error(f"Failed to start Docker Compose services: {e}")
            print_warning(f"You may need to manually open {APP_URL} once the issue is resolved.")
            if not ask_yes_no("Problem starting Docker services. Continue this script (e.g., to keep relay running if it was started separately)?", default_yes=False):
                cleanup_processes()
    else:
        print_warning("Docker Compose not found, skipping application start.")

    print_header("Setup Steps Complete")
    print("The Python Host Relay (if started by this script and not on Windows via 'start') is a background child process.")
    print("On Windows, if relay was started with 'start', its window needs to be closed manually to stop it.")
    print("Docker services (if started) are running in detached mode.")
    print(f"To stop Docker services, run: {DOCKER_COMPOSE_CMD_NAME_local} down") # Use the found name
    print("The start.py script will now exit.")

if __name__ == "__main__":
    main()
