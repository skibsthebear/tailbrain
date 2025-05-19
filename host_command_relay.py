#!/usr/bin/env python3

"""
Host Command Relay (Python/Flask)

This script runs on the host system and executes commands on behalf of a container.
It listens on a specified port for command requests.
"""

import subprocess
import json
import os
import logging
import shutil # For shutil.which as a fallback
from datetime import datetime
from flask import Flask, request, jsonify
from flask_cors import CORS

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

app = Flask(__name__)
CORS(app)  # Enable CORS for all origins

PORT = int(os.environ.get("PORT", 7655))

@app.before_request
def log_request_info():
    logging.info(f"{request.method} {request.url}")

@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({"status": "ok"}), 200

@app.route('/test', methods=['GET'])
def test_endpoint():
    logging.info('Test endpoint called')
    try:
        hostname = os.uname().nodename # More portable for hostname
    except AttributeError:
        hostname = os.getenv('COMPUTERNAME', 'N/A') # Fallback for Windows

    return jsonify({
        "status": "ok",
        "message": "Host command relay (Python) is working correctly",
        "timestamp": json.dumps(datetime.utcnow().isoformat()),
        "hostname": hostname
    }), 200

@app.route('/execute', methods=['POST'])
def execute_command():
    data = request.get_json()
    if not data or 'command' not in data:
        logging.error("Command is required but not provided.")
        return jsonify({"error": "Command is required"}), 400

    command_to_execute = data['command']
    
    # Determine the actual executable path
    final_command_parts = []
    cmd_base = command_to_execute.split()[0]
    cmd_args = command_to_execute.split()[1:]

    if cmd_base == "docker":
        exe_path = os.environ.get("DOCKER_CMD_PATH") or shutil.which("docker") or "docker"
        final_command_parts = [exe_path] + cmd_args
    elif cmd_base == "tailscale":
        exe_path = os.environ.get("TAILSCALE_CMD_PATH") or shutil.which("tailscale") or "tailscale"
        final_command_parts = [exe_path] + cmd_args
    elif cmd_base == "docker-compose": # Handle if docker-compose is sent as a single command
        # start.py now tries to use 'docker compose' if available.
        # If 'docker-compose' standalone is sent, try to find it.
        exe_path = shutil.which("docker-compose") or "docker-compose"
        final_command_parts = [exe_path] + cmd_args
    else:
        # For other commands, or if the command is complex and needs shell interpretation for cd && ...,
        # we might still need to use shell=True with the original command string.
        # For now, let's assume simple commands or that the full path is provided if needed.
        # If final_command_parts is empty, it means we use command_to_execute with shell=True.
        pass

    if final_command_parts:
        logging.info(f"Executing command with resolved path: {' '.join(final_command_parts)}")
        # When using a list of arguments, shell=False is generally preferred and safer.
        # However, if the original command relied on shell features (like cd ... && ...),
        # this direct execution might fail. The backend sends such commands.
        # The `docker-compose` commands from backend are `cd "..." && docker-compose ...`
        # These *require* shell=True.
        # So, if we resolve `docker-compose` to a full path, the `cd` part is lost if shell=False.
        #
        # Decision: If the command is complex (contains '&&', '||', ';', '>', '<', '|'), use shell=True with original string.
        # Otherwise, use the resolved path with shell=False if possible, or shell=True if it's simpler.
        # Given that commands like `cd /d "path" && docker-compose ...` are sent,
        # we MUST use shell=True.
        # So, we modify command_to_execute to include full paths if found, then run with shell=True.

        if cmd_base == "docker" and os.environ.get("DOCKER_CMD_PATH"):
            command_to_execute = f"\"{os.environ.get('DOCKER_CMD_PATH')}\" {' '.join(cmd_args)}"
        elif cmd_base == "tailscale" and os.environ.get("TAILSCALE_CMD_PATH"):
            command_to_execute = f"\"{os.environ.get('TAILSCALE_CMD_PATH')}\" {' '.join(cmd_args)}"
        # For docker-compose, the backend constructs `cd ... && docker-compose ...`.
        # If DOCKER_COMPOSE_CMD_PATH (which might be `docker compose` or `docker-compose`) is available,
        # it's harder to inject. For now, rely on it being in PATH for complex `cd &&` commands.
        # The most critical are direct `docker` and `tailscale` calls.
    
    logging.info(f"Final command for subprocess: {command_to_execute}")

    try:
        process = subprocess.run(
            command_to_execute, # Use the (potentially modified) full string
            shell=True, # Essential for commands like 'cd ... && ...'
            capture_output=True,
            text=True,
            check=False # Don't raise exception for non-zero exit codes automatically
        )

        stdout = process.stdout
        stderr = process.stderr
        return_code = process.returncode

        if return_code != 0:
            logging.error(f"Error executing command '{command_to_execute}'. Code: {return_code}")
            logging.error(f"Stderr: {stderr.strip()}")
            logging.info(f"Stdout: {stdout.strip()}") # Log stdout even on error
            return jsonify({
                "error": f"Command failed with exit code {return_code}",
                "stderr": stderr.strip(),
                "stdout": stdout.strip(),
                "code": return_code
            }), 500
        
        logging.info(f"Command '{command_to_execute}' executed successfully.")
        if stderr: # Log stderr even if command is successful, as it might contain warnings
             logging.warn(f"Stderr from successful command '{command_to_execute}': {stderr.strip()}")

        return jsonify({
            "stdout": stdout.strip(),
            "stderr": stderr.strip() # Ensure stderr is always a string
        }), 200

    except Exception as e:
        logging.exception(f"Exception while executing command '{command_to_execute}':")
        return jsonify({"error": "Internal server error during command execution", "message": str(e)}), 500

@app.errorhandler(Exception)
def handle_generic_error(e):
    logging.exception("An unhandled exception occurred:")
    return jsonify(error=str(e), message="An internal server error occurred."), 500

if __name__ == '__main__':
    logging.info(f"Host command relay server (Python) starting on port {PORT}")
    logging.info(f"Run container with -e HOST_RELAY_URL=http://host.docker.internal:{PORT}")
    
    # Log the PATH environment variable for diagnostics
    current_path = os.environ.get('PATH', 'PATH environment variable not found.')
    logging.info(f"Relay process PATH: {current_path}")
    
    app.run(host='0.0.0.0', port=PORT)
