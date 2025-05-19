import os
import json
import logging
import uuid # For generating IDs for compose apps
from pathlib import Path # For path manipulations
from flask import Flask, jsonify, request, send_from_directory, send_file # Added send_from_directory and send_file
from flask_cors import CORS

# Assuming host_caller.py is in the same directory or PYTHONPATH is set up
from host_caller import exec_host_command

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

app = Flask(__name__)
CORS(app) # Enable CORS for all origins; configure as needed for production

# --- Configuration for Docker Compose apps (to be expanded) ---
DATA_DIR = os.environ.get('DATA_DIR', os.path.join(os.path.dirname(__file__), '../data'))
COMPOSE_CONFIG_FILE = os.path.join(DATA_DIR, 'compose-apps.json')

# Ensure data directory exists (simplified, full logic later)
if not os.path.exists(DATA_DIR):
    try:
        os.makedirs(DATA_DIR, exist_ok=True)
        logging.info(f"Created data directory at {DATA_DIR}")
    except OSError as e:
        logging.error(f"Could not create data directory at {DATA_DIR}: {e}")

# Load Docker Compose apps (simplified, full logic later)
docker_compose_apps = []
if os.path.exists(COMPOSE_CONFIG_FILE):
    try:
        with open(COMPOSE_CONFIG_FILE, 'r', encoding='utf-8') as f:
            docker_compose_apps = json.load(f)
        logging.info(f"Loaded {len(docker_compose_apps)} Docker Compose apps from {COMPOSE_CONFIG_FILE}")
    except Exception as e:
        logging.error(f"Error loading Docker Compose apps: {e}")
else:
    try:
        with open(COMPOSE_CONFIG_FILE, 'w', encoding='utf-8') as f:
            json.dump([], f)
        logging.info(f"Created empty Docker Compose apps file at {COMPOSE_CONFIG_FILE}")
    except Exception as e:
        logging.error(f"Error creating empty Docker Compose apps file: {e}")


# --- API Endpoints ---

@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({"status": "UP", "message": "Python backend is running"}), 200

# --- Tailscale Endpoints ---

def _parse_tailscale_serve_output(stdout_str):
    """
    Parses the output of 'tailscale serve status'.
    This is a Python port of the JavaScript version's logic.
    The actual output format of 'tailscale serve status' can be complex
    and might need more robust parsing based on real examples.
    """
    logging.debug(f"Parsing Tailscale Serve Output: {stdout_str}")
    if not stdout_str or not stdout_str.strip():
        return []
    
    lines = stdout_str.strip().split('\n')
    if not lines:
        return []

    # Example from JS: "No services"
    if lines[0].startswith("No services"):
        return []

    parsed_services = []
    for index, line in enumerate(lines):
        line = line.strip()
        if not line:
            continue

        # Naive parsing based on the JS example. This will need refinement.
        # Example line: localhost:8080 (Funnel off) http://machine-name:8080
        # Example line: https://custom.domain.com (Funnel on) https://machine-name.ts.net (TLS)
        parts = line.split() # Split by whitespace
        
        port_str = "N/A"
        service_identifier = parts[0] if parts else "N/A"
        
        # Attempt to extract port
        port_match = None
        if ':' in service_identifier:
            try:
                port_str = service_identifier.split(':')[-1]
                int(port_str) # Validate if it's a number
            except (ValueError, IndexError):
                port_str = "N/A" # Reset if not a valid port part
        elif service_identifier.lower() == 'http':
            port_str = '80'
        elif service_identifier.lower() == 'https':
            port_str = '443'

        status_text = "Status unknown"
        if "(Funnel on)" in line:
            status_text = "Funnel on"
        elif "(Funnel off)" in line:
            status_text = "Funnel off"
            
        parsed_services.append({
            "id": f"serve-{index}",
            "rawLine": line,
            "port": port_str,
            "service": service_identifier, # This might be URL/hostname
            "statusText": status_text,
            "active": True, # Assuming listed means configured
            "details": " ".join(parts[1:]) if len(parts) > 1 else ""
        })
    return parsed_services

@app.route('/api/tailscale/serve', methods=['GET'])
def get_tailscale_serve_status_route():
    try:
        result = exec_host_command('tailscale serve status')
        # Note: 'tailscale serve status' might not have a --json flag yet.
        # Parsing its plain text output can be brittle.
        parsed_data = _parse_tailscale_serve_output(result['stdout'])
        return jsonify(parsed_data), 200
    except ValueError as e:
        logging.error(f"Error getting Tailscale serve status: {e}")
        return jsonify({"error": "Failed to get Tailscale serve status", "details": str(e)}), 500
    except Exception as e:
        logging.exception("Unexpected error in /api/tailscale/serve (GET):")
        return jsonify({"error": "An unexpected error occurred", "details": str(e)}), 500

@app.route('/api/tailscale/funnel', methods=['GET'])
def get_tailscale_funnel_status_route():
    try:
        # 'tailscale funnel status --json' is the preferred command if available and working.
        result = exec_host_command('tailscale funnel status --json')
        try:
            # Assuming stdout contains valid JSON string
            funnel_data = json.loads(result['stdout']) 
            return jsonify(funnel_data), 200
        except json.JSONDecodeError as je:
            logging.error(f"Failed to parse JSON from tailscale funnel status: {je}")
            logging.debug(f"Funnel status stdout: {result['stdout']}")
            # Fallback or error if JSON parsing fails
            return jsonify({"error": "Failed to parse JSON output for funnel status", "raw_output": result['stdout']}), 500
    except ValueError as e: # Error from exec_host_command
        logging.error(f"Error getting Tailscale funnel status: {e}")
        return jsonify({"error": "Failed to get Tailscale funnel status", "details": str(e)}), 500
    except Exception as e:
        logging.exception("Unexpected error in /api/tailscale/funnel (GET):")
        return jsonify({"error": "An unexpected error occurred", "details": str(e)}), 500

@app.route('/api/tailscale/serve', methods=['POST'])
def add_tailscale_serve_port_route():
    req_data = request.get_json()
    if not req_data or not req_data.get('port') or not req_data.get('localUrl'):
        return jsonify({"error": "Port and localUrl are required"}), 400
    
    port = req_data['port']
    # service = req_data.get('service', '') # 'service' param was in JS but not used in command
    local_url = req_data['localUrl']
    
    # Command from JS: `tailscale serve add :${port} ${localUrl}`
    # Assuming 'port' is just the number, and 'localUrl' is like 'http://localhost:8080'
    command = f"tailscale serve add :{port} {local_url}"
    try:
        result = exec_host_command(command)
        return jsonify({"success": True, "message": "Port added successfully", "output": result['stdout']}), 200
    except ValueError as e:
        logging.error(f"Error adding Tailscale serve port: {e}")
        return jsonify({"error": "Failed to add Tailscale serve port", "details": str(e)}), 500
    except Exception as e:
        logging.exception("Unexpected error in /api/tailscale/serve (POST):")
        return jsonify({"error": "An unexpected error occurred", "details": str(e)}), 500

@app.route('/api/tailscale/funnel', methods=['POST'])
def add_tailscale_funnel_port_route():
    req_data = request.get_json()
    if not req_data or not req_data.get('port'):
        return jsonify({"error": "Port is required"}), 400
        
    port = req_data['port']
    protocol = req_data.get('protocol', 'tcp') # Default to tcp as in JS
    
    # Command from JS: `tailscale funnel ${port} ${protocol}`
    command = f"tailscale funnel {port} {protocol}"
    try:
        result = exec_host_command(command)
        return jsonify({"success": True, "message": "Port funneled successfully", "output": result['stdout']}), 200
    except ValueError as e:
        logging.error(f"Error adding Tailscale funnel port: {e}")
        return jsonify({"error": "Failed to add Tailscale funnel port", "details": str(e)}), 500
    except Exception as e:
        logging.exception("Unexpected error in /api/tailscale/funnel (POST):")
        return jsonify({"error": "An unexpected error occurred", "details": str(e)}), 500

@app.route('/api/tailscale/serve/<port_str>', methods=['DELETE'])
def remove_tailscale_serve_port_route(port_str):
    if not port_str: # Should be caught by Flask routing if param is missing
        return jsonify({"error": "Port is required"}), 400
    
    # Command from JS: `tailscale serve remove :${port}`
    command = f"tailscale serve remove :{port_str}"
    try:
        result = exec_host_command(command)
        return jsonify({"success": True, "message": "Port removed successfully", "output": result['stdout']}), 200
    except ValueError as e:
        logging.error(f"Error removing Tailscale serve port: {e}")
        return jsonify({"error": "Failed to remove Tailscale serve port", "details": str(e)}), 500
    except Exception as e:
        logging.exception("Unexpected error in /api/tailscale/serve (DELETE):")
        return jsonify({"error": "An unexpected error occurred", "details": str(e)}), 500

@app.route('/api/tailscale/funnel/<port_str>', methods=['DELETE'])
def remove_tailscale_funnel_port_route(port_str):
    if not port_str:
        return jsonify({"error": "Port is required"}), 400
    
    protocol = request.args.get('protocol', 'tcp') # Default to tcp, was in query in JS
    
    # Command from JS:
    # if (protocol.toLowerCase() === 'tcp') { command = `tailscale funnel --tcp=${port} off`; }
    # else if (protocol.toLowerCase() === 'http') { command = `tailscale funnel --http=${port} off`; }
    # else { command = `tailscale funnel ${port} off`; }
    
    command = ""
    if protocol.lower() == 'tcp':
        command = f"tailscale funnel --tcp={port_str} off"
    elif protocol.lower() == 'http':
        command = f"tailscale funnel --http={port_str} off"
    else: # Fallback, or if protocol is something else like 'https' (though 'tcp' is common for https)
        command = f"tailscale funnel {port_str} off" # General form
        
    try:
        result = exec_host_command(command)
        return jsonify({"success": True, "message": "Port funnel removed successfully", "output": result['stdout']}), 200
    except ValueError as e:
        logging.error(f"Error removing Tailscale funnel port: {e}")
        return jsonify({"error": "Failed to remove Tailscale funnel port", "details": str(e)}), 500
    except Exception as e:
        logging.exception("Unexpected error in /api/tailscale/funnel (DELETE):")
        return jsonify({"error": "An unexpected error occurred", "details": str(e)}), 500

# --- Docker Endpoints ---

def _parse_docker_ps_output(stdout_str):
    """Parses the JSON line-formatted output of 'docker ps --format "{{json .}}"'."""
    # Ensure it's placed after Tailscale endpoints and before the get_docker_containers_route or adjust if it's a general utility
    if not stdout_str or not stdout_str.strip():
        return []
    lines = stdout_str.strip().split('\n')
    containers = []
    for line in lines:
        if line.strip():
            try:
                containers.append(json.loads(line))
            except json.JSONDecodeError as e:
                logging.error(f"Failed to parse Docker ps JSON line: {line} - Error: {e}")
    return containers

@app.route('/api/docker/containers', methods=['GET'])
def get_docker_containers_route():
    try:
        result = exec_host_command('docker ps --format "{{json .}}"')
        # result is {"stdout": "...", "stderr": "..."}
        
        # The original Node.js commandExecutor.js would check for errors from execHostCommand.
        # Our Python exec_host_command raises ValueError on relay/HTTP errors.
        # If the command itself failed (e.g., docker command error), host_command_relay.py returns 500,
        # which exec_host_command also turns into a ValueError.
        
        containers = _parse_docker_ps_output(result['stdout'])
        return jsonify(containers), 200
    except ValueError as e: # Catch errors from exec_host_command (relay/HTTP issues or command failure via relay)
        logging.error(f"Error getting Docker containers: {e}")
        return jsonify({"error": "Failed to get Docker containers", "details": str(e)}), 500
    except Exception as e: # Catch any other unexpected errors
        logging.exception("Unexpected error in /api/docker/containers:")
        return jsonify({"error": "An unexpected error occurred", "details": str(e)}), 500

# --- Docker Compose Management Endpoints ---

# Helper to save docker-compose apps to file
def _save_docker_compose_apps():
    global docker_compose_apps # Ensure we're modifying the global list
    try:
        # Ensure DATA_DIR exists before writing
        data_dir_path = Path(DATA_DIR)
        data_dir_path.mkdir(parents=True, exist_ok=True)
        
        with open(COMPOSE_CONFIG_FILE, 'w', encoding='utf-8') as f:
            json.dump(docker_compose_apps, f, indent=2)
        logging.info(f"Saved {len(docker_compose_apps)} Docker Compose apps to {COMPOSE_CONFIG_FILE}")
        return True
    except Exception as e:
        logging.error(f"Error saving Docker Compose apps to file: {e}")
        return False

@app.route('/api/docker-compose/apps', methods=['GET'])
def get_docker_compose_apps_route():
    return jsonify(docker_compose_apps)

@app.route('/api/docker-compose/apps', methods=['POST'])
def add_docker_compose_app_route():
    global docker_compose_apps
    req_data = request.get_json()
    name = req_data.get('name')
    compose_path = req_data.get('path') # 'path' is used in frontend/JS
    up_command = req_data.get('upCommand', 'up -d --pull=always') # Default from JS

    if not name or not compose_path:
        return jsonify({"error": "Name and path are required for Docker Compose app"}), 400
    if not compose_path.endswith(('.yml', '.yaml')):
        return jsonify({"error": "Path must be a .yml or .yaml file"}), 400

    new_app = {
        "id": str(uuid.uuid4()),
        "name": name,
        "path": compose_path,
        "upCommand": up_command if up_command and up_command.strip() else 'up -d --pull=always'
    }
    docker_compose_apps.append(new_app)
    logging.info(f"Added Docker Compose app: {new_app}")

    if _save_docker_compose_apps():
        return jsonify(new_app), 201
    else:
        # Revert add if save fails? For now, simple error.
        return jsonify({"error": "Failed to save Docker Compose app configuration"}), 500

@app.route('/api/docker-compose/apps/<app_id>', methods=['PUT'])
def update_docker_compose_app_route(app_id):
    global docker_compose_apps
    req_data = request.get_json()
    name = req_data.get('name')
    compose_path = req_data.get('path')
    up_command = req_data.get('upCommand') # If None, keep old or use default

    if not name or not compose_path:
        return jsonify({"error": "Name and path are required"}), 400
    if not compose_path.endswith(('.yml', '.yaml')):
        return jsonify({"error": "Path must be a .yml or .yaml file"}), 400

    app_index = -1
    for i, app_item in enumerate(docker_compose_apps):
        if app_item['id'] == app_id:
            app_index = i
            break
    
    if app_index == -1:
        return jsonify({"error": "Docker Compose app not found"}), 404

    updated_app = {
        **docker_compose_apps[app_index], # Spread existing values
        "name": name,
        "path": compose_path,
        "upCommand": up_command if up_command and up_command.strip() else docker_compose_apps[app_index].get('upCommand', 'up -d --pull=always')
    }
    docker_compose_apps[app_index] = updated_app
    logging.info(f"Updated Docker Compose app: {updated_app}")

    if _save_docker_compose_apps():
        return jsonify(updated_app), 200
    else:
        return jsonify({"error": "Failed to save updated Docker Compose app configuration"}), 500

@app.route('/api/docker-compose/apps/<app_id>', methods=['DELETE'])
def delete_docker_compose_app_route(app_id):
    global docker_compose_apps
    initial_length = len(docker_compose_apps)
    docker_compose_apps = [app for app in docker_compose_apps if app['id'] != app_id]

    if len(docker_compose_apps) < initial_length:
        logging.info(f"Deleted Docker Compose app with id: {app_id}")
        if _save_docker_compose_apps():
            return jsonify({"message": "Docker Compose app removed"}), 200
        else:
            return jsonify({"error": "Failed to save updated Docker Compose app configuration after deletion"}), 500
    else:
        return jsonify({"error": "Docker Compose app not found"}), 404

@app.route('/api/docker-compose/up', methods=['POST'])
def docker_compose_up_route():
    global docker_compose_apps
    req_data = request.get_json()
    file_path_str = req_data.get('filePath')
    if not file_path_str:
        return jsonify({"error": "filePath is required"}), 400

    app_config = next((app for app in docker_compose_apps if app['path'] == file_path_str), None)
    
    custom_up_command = 'up -d --pull=always' # Default
    if app_config and app_config.get('upCommand') and app_config['upCommand'].strip():
        custom_up_command = app_config['upCommand']
    elif not app_config:
         logging.warning(f"Compose up called for an unconfigured path: {file_path_str}. Using default up command.")


    compose_file_path = Path(file_path_str)
    work_dir = str(compose_file_path.parent.resolve())
    file_name = compose_file_path.name
    
    # Command from JS: `cd "${workDir}" && docker-compose -f "${fileName}" ${customUpCommand}`
    # Note: Ensure paths with spaces are handled if necessary (quotes help).
    # subprocess.run with shell=True handles cd and &&.
    command = f"cd \"{work_dir}\" && docker-compose -f \"{file_name}\" {custom_up_command}"
    
    try:
        result = exec_host_command(command)
        return jsonify({"success": True, "message": "Docker Compose up executed successfully", "output": result['stdout']}), 200
    except ValueError as e:
        logging.error(f"Error executing docker-compose up for {file_name} in {work_dir}: {e}")
        return jsonify({"error": "Failed to execute docker-compose up", "details": str(e)}), 500
    except Exception as e:
        logging.exception(f"Unexpected error in docker-compose up for {file_name}:")
        return jsonify({"error": "An unexpected error occurred", "details": str(e)}), 500

@app.route('/api/docker-compose/down', methods=['POST'])
def docker_compose_down_route():
    req_data = request.get_json()
    file_path_str = req_data.get('filePath')
    if not file_path_str:
        return jsonify({"error": "filePath is required"}), 400

    compose_file_path = Path(file_path_str)
    work_dir = str(compose_file_path.parent.resolve())
    file_name = compose_file_path.name

    command = f"cd \"{work_dir}\" && docker-compose -f \"{file_name}\" down"
    try:
        result = exec_host_command(command)
        return jsonify({"success": True, "message": "Docker Compose down executed successfully", "output": result['stdout']}), 200
    except ValueError as e:
        logging.error(f"Error executing docker-compose down for {file_name} in {work_dir}: {e}")
        return jsonify({"error": "Failed to execute docker-compose down", "details": str(e)}), 500
    except Exception as e:
        logging.exception(f"Unexpected error in docker-compose down for {file_name}:")
        return jsonify({"error": "An unexpected error occurred", "details": str(e)}), 500

# --- Individual Docker Container Management Endpoints (copied from previous step for context) ---
@app.route('/api/docker/containers/<container_id>/stop', methods=['POST'])
def stop_docker_container_route(container_id):
    if not container_id:
        return jsonify({"error": "Container ID is required"}), 400
    command = f"docker stop {container_id}"
    try:
        result = exec_host_command(command)
        return jsonify({"success": True, "message": "Container stopped successfully", "output": result['stdout']}), 200
    except ValueError as e:
        logging.error(f"Error stopping container {container_id}: {e}")
        return jsonify({"error": f"Failed to stop container {container_id}", "details": str(e)}), 500
    except Exception as e:
        logging.exception(f"Unexpected error stopping container {container_id}:")
        return jsonify({"error": "An unexpected error occurred", "details": str(e)}), 500

@app.route('/api/docker/containers/<container_id>/kill', methods=['POST'])
def kill_docker_container_route(container_id):
    if not container_id:
        return jsonify({"error": "Container ID is required"}), 400
    command = f"docker kill {container_id}"
    try:
        result = exec_host_command(command)
        return jsonify({"success": True, "message": "Container killed successfully", "output": result['stdout']}), 200
    except ValueError as e:
        logging.error(f"Error killing container {container_id}: {e}")
        return jsonify({"error": f"Failed to kill container {container_id}", "details": str(e)}), 500
    except Exception as e:
        logging.exception(f"Unexpected error killing container {container_id}:")
        return jsonify({"error": "An unexpected error occurred", "details": str(e)}), 500

@app.route('/api/docker/containers/<container_id>/restart', methods=['POST'])
def restart_docker_container_route(container_id):
    if not container_id:
        return jsonify({"error": "Container ID is required"}), 400
    command = f"docker restart {container_id}"
    try:
        result = exec_host_command(command)
        return jsonify({"success": True, "message": "Container restarted successfully", "output": result['stdout']}), 200
    except ValueError as e:
        logging.error(f"Error restarting container {container_id}: {e}")
        return jsonify({"error": f"Failed to restart container {container_id}", "details": str(e)}), 500
    except Exception as e:
        logging.exception(f"Unexpected error restarting container {container_id}:")
        return jsonify({"error": "An unexpected error occurred", "details": str(e)}), 500

@app.route('/api/docker/containers/<container_id>/logs', methods=['GET'])
def get_docker_container_logs_route(container_id):
    if not container_id:
        return jsonify({"error": "Container ID is required"}), 400
    
    lines = request.args.get('lines', '100') # Default to 100 lines
    command = f"docker logs --tail={lines} {container_id}"
    try:
        result = exec_host_command(command)
        # The result from exec_host_command contains 'stdout' and 'stderr'
        # The original Node.js version returned { success: true, logs: stdout, error: stderr }
        return jsonify({"success": True, "logs": result['stdout'], "error_output": result['stderr']}), 200
    except ValueError as e:
        logging.error(f"Error getting logs for container {container_id}: {e}")
        return jsonify({"error": f"Failed to get logs for container {container_id}", "details": str(e)}), 500
    except Exception as e:
        logging.exception(f"Unexpected error getting logs for container {container_id}:")
        return jsonify({"error": "An unexpected error occurred", "details": str(e)}), 500

@app.route('/api/docker/containers/<container_id>/stats', methods=['GET'])
def get_docker_container_stats_route(container_id):
    if not container_id:
        return jsonify({"error": "Container ID is required"}), 400
    
    # --no-stream gets a single snapshot, --format "{{json .}}" ensures JSON output
    command = f"docker stats {container_id} --no-stream --format \"{{{{json .}}}}\"" # Double braces for f-string, then for docker
    try:
        result = exec_host_command(command)
        # stdout from 'docker stats ... --format "{{json .}}"' should be a single JSON line
        try:
            stats_data = json.loads(result['stdout'].strip()) if result['stdout'].strip() else {}
            return jsonify({"success": True, "stats": stats_data}), 200
        except json.JSONDecodeError as je:
            logging.error(f"Failed to parse JSON from docker stats for {container_id}: {je}")
            logging.debug(f"Docker stats stdout: {result['stdout']}")
            return jsonify({"error": "Failed to parse stats output", "raw_output": result['stdout']}), 500
    except ValueError as e:
        logging.error(f"Error getting stats for container {container_id}: {e}")
        return jsonify({"error": f"Failed to get stats for container {container_id}", "details": str(e)}), 500
    except Exception as e:
        logging.exception(f"Unexpected error getting stats for container {container_id}:")
        return jsonify({"error": "An unexpected error occurred", "details": str(e)}), 500

# --- Docker Network Management Endpoints ---

@app.route('/api/docker/networks', methods=['GET'])
def list_docker_networks_route():
    command = 'docker network ls --format "{{json .}}"'
    try:
        result = exec_host_command(command)
        lines = result['stdout'].strip().split('\n')
        networks = [json.loads(line) for line in lines if line.strip()]
        return jsonify(networks), 200
    except json.JSONDecodeError as je:
        logging.error(f"Failed to parse JSON from docker network ls: {je}")
        return jsonify({"error": "Failed to parse Docker network list output", "raw_output": result.get('stdout', '')}), 500
    except ValueError as e:
        logging.error(f"Error listing Docker networks: {e}")
        return jsonify({"error": "Failed to list Docker networks", "details": str(e)}), 500
    except Exception as e:
        logging.exception("Unexpected error listing Docker networks:")
        return jsonify({"error": "An unexpected error occurred", "details": str(e)}), 500

@app.route('/api/docker/networks/<network_id>', methods=['GET'])
def inspect_docker_network_route(network_id):
    if not network_id:
        return jsonify({"error": "Network ID is required"}), 400
    command = f"docker network inspect {network_id}" # Output is a JSON array with one element
    try:
        result = exec_host_command(command)
        # docker network inspect returns a JSON array containing a single object
        network_details_list = json.loads(result['stdout'])
        if network_details_list:
            return jsonify(network_details_list[0]), 200
        else:
            return jsonify({"error": "Network not found or invalid output"}), 404
    except json.JSONDecodeError as je:
        logging.error(f"Failed to parse JSON from docker network inspect {network_id}: {je}")
        return jsonify({"error": "Failed to parse Docker network details", "raw_output": result.get('stdout', '')}), 500
    except ValueError as e:
        logging.error(f"Error inspecting Docker network {network_id}: {e}")
        return jsonify({"error": f"Failed to inspect Docker network {network_id}", "details": str(e)}), 500
    except Exception as e:
        logging.exception(f"Unexpected error inspecting Docker network {network_id}:")
        return jsonify({"error": "An unexpected error occurred", "details": str(e)}), 500

@app.route('/api/docker/containers/<container_id>/networks', methods=['GET'])
def get_container_networks_route(container_id):
    if not container_id:
        return jsonify({"error": "Container ID is required"}), 400
    # Command from JS: `docker container inspect --format "{{json .NetworkSettings.Networks}}" ${containerId}`
    # Need to be careful with f-string and docker format braces
    command = f"docker container inspect --format \"{{{{json .NetworkSettings.Networks}}}}\" {container_id}"
    try:
        result = exec_host_command(command)
        stdout_trimmed = result['stdout'].strip()
        if not stdout_trimmed or stdout_trimmed == 'null':
            logging.info(f"No network data returned for container {container_id}")
            return jsonify({}), 200 # Return empty object as per original JS
        
        networks = json.loads(stdout_trimmed)
        return jsonify(networks), 200
    except json.JSONDecodeError as je:
        logging.error(f"Failed to parse JSON for container networks {container_id}: {je}")
        logging.debug(f"Raw stdout for container networks: {result.get('stdout', '')}")
        return jsonify({}), 200 # Return empty object on parse error as per original JS
    except ValueError as e:
        logging.error(f"Error getting networks for container {container_id}: {e}")
        return jsonify({}), 200 # Return empty object on other errors as per original JS
    except Exception as e:
        logging.exception(f"Unexpected error getting networks for container {container_id}:")
        return jsonify({"error": "An unexpected error occurred", "details": str(e)}), 500


@app.route('/api/docker/containers/<container_id>/networks/<network_id>/connect', methods=['POST'])
def connect_container_to_network_route(container_id, network_id):
    if not container_id or not network_id:
        return jsonify({"error": "Container ID and Network ID are required"}), 400
    command = f"docker network connect {network_id} {container_id}"
    try:
        result = exec_host_command(command)
        return jsonify({"success": True, "message": f"Container {container_id} connected to network {network_id} successfully", "output": result['stdout']}), 200
    except ValueError as e:
        logging.error(f"Error connecting container {container_id} to network {network_id}: {e}")
        return jsonify({"error": "Failed to connect container to network", "details": str(e)}), 500
    except Exception as e:
        logging.exception(f"Unexpected error connecting container {container_id} to network {network_id}:")
        return jsonify({"error": "An unexpected error occurred", "details": str(e)}), 500

@app.route('/api/docker/containers/<container_id>/networks/<network_id>/disconnect', methods=['POST'])
def disconnect_container_from_network_route(container_id, network_id):
    if not container_id or not network_id:
        return jsonify({"error": "Container ID and Network ID are required"}), 400
    command = f"docker network disconnect {network_id} {container_id}"
    try:
        result = exec_host_command(command)
        return jsonify({"success": True, "message": f"Container {container_id} disconnected from network {network_id} successfully", "output": result['stdout']}), 200
    except ValueError as e:
        logging.error(f"Error disconnecting container {container_id} from network {network_id}: {e}")
        return jsonify({"error": "Failed to disconnect container from network", "details": str(e)}), 500
    except Exception as e:
        logging.exception(f"Unexpected error disconnecting container {container_id} from network {network_id}:")
        return jsonify({"error": "An unexpected error occurred", "details": str(e)}), 500

@app.route('/api/docker/networks', methods=['POST'])
def create_docker_network_route():
    req_data = request.get_json()
    name = req_data.get('name')
    driver = req_data.get('driver', 'bridge')
    options = req_data.get('options', []) # Expect a list of strings like "foo=bar"

    if not name:
        return jsonify({"error": "Network name is required"}), 400
    
    options_str = " ".join([f"--opt {opt}" for opt in options])
    command = f"docker network create --driver {driver} {options_str} {name}".strip()
    
    try:
        result = exec_host_command(command)
        # 'docker network create' outputs the network ID on success
        return jsonify({"success": True, "message": f"Network {name} created successfully", "networkId": result['stdout'].strip()}), 201
    except ValueError as e:
        logging.error(f"Error creating Docker network {name}: {e}")
        return jsonify({"error": "Failed to create Docker network", "details": str(e)}), 500
    except Exception as e:
        logging.exception(f"Unexpected error creating Docker network {name}:")
        return jsonify({"error": "An unexpected error occurred", "details": str(e)}), 500

@app.route('/api/docker/networks/<network_id>', methods=['DELETE'])
def remove_docker_network_route(network_id):
    if not network_id:
        return jsonify({"error": "Network ID is required"}), 400
    command = f"docker network rm {network_id}"
    try:
        result = exec_host_command(command)
        return jsonify({"success": True, "message": f"Network {network_id} removed successfully", "output": result['stdout']}), 200
    except ValueError as e:
        logging.error(f"Error removing Docker network {network_id}: {e}")
        return jsonify({"error": "Failed to remove Docker network", "details": str(e)}), 500
    except Exception as e:
        logging.exception(f"Unexpected error removing Docker network {network_id}:")
        return jsonify({"error": "An unexpected error occurred", "details": str(e)}), 500

# --- Static file serving for production ---
# This assumes that the frontend has been built and its static files are in ../frontend/dist
# The Dockerfile will need to ensure this path is correct relative to where app.py is run.
FRONTEND_DIST_PATH = os.environ.get(
    'FRONTEND_DIST_PATH', 
    str(Path(__file__).resolve().parent.parent / 'frontend' / 'dist')
)

# Serve static files from the frontend's dist directory
# Note: For production, it's often better to let a dedicated web server (like Nginx) handle static files.
# However, Flask can serve them for simplicity or smaller deployments.
# The static_folder path must be correct for where the app is run (e.g., inside Docker).
# We use a variable static path and a catch-all for index.html for SPA routing.

# Check if we are in production mode (e.g., via an environment variable)
IS_PRODUCTION = os.environ.get('NODE_ENV', '').lower() == 'production' or \
                os.environ.get('FLASK_ENV', '').lower() == 'production'


if IS_PRODUCTION:
    logging.info(f"Production mode detected. Serving static files from: {FRONTEND_DIST_PATH}")
    if not Path(FRONTEND_DIST_PATH).exists():
        logging.warning(
            f"Frontend distribution path {FRONTEND_DIST_PATH} does not exist. "
            "Static file serving will likely fail. Ensure frontend is built and path is correct."
        )

    # Serve files from the root of FRONTEND_DIST_PATH (e.g., /assets/*)
    @app.route('/assets/<path:filename>')
    def serve_assets(filename):
        return send_from_directory(Path(FRONTEND_DIST_PATH) / 'assets', filename)

    # Serve other static files like vite.svg, index.html from the root of FRONTEND_DIST_PATH
    # This route needs to be more specific or come after the SPA catch-all if it's too greedy.
    # For now, let's make it specific for known static file extensions or index.html.
    @app.route('/<path:filename>')
    def serve_root_static_files(filename):
        # Only serve specific files or files with common static extensions from root
        known_static_files = ['favicon.ico', 'robots.txt', 'manifest.json', 'vite.svg'] # Add more as needed
        if filename in known_static_files or filename.endswith(('.css', '.js', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.webmanifest')):
            return send_from_directory(FRONTEND_DIST_PATH, filename)
        # If it's not a recognized static file, it should be handled by the SPA catch-all.
        # This specific /<path:filename> might be too greedy if not careful.
        # The SPA catch-all below is usually better.
        # For simplicity, we'll rely on the SPA catch-all for index.html and other paths.
        # This route can be refined or removed if SPA catch-all is sufficient.
        # Let's make it serve index.html specifically if requested directly.
        if filename == 'index.html':
             return send_from_directory(FRONTEND_DIST_PATH, 'index.html')
        # Fall through to SPA handler for other paths
        return serve_spa(filename)


    # Catch-all for SPA: if no other route matches, serve index.html
    # This should be defined after all API routes.
    @app.route('/', defaults={'path': ''})
    @app.route('/<path:path>') # Matches any path not caught by API routes or specific static file routes
    def serve_spa(path): # path variable is not strictly used here but captures the route
        # Check if the path looks like a file request that wasn't caught by more specific static routes
        # This helps avoid serving index.html for missing static assets if those routes are not exhaustive.
        if '.' in path and not path.endswith('.html'): # Heuristic: if it has an extension but isn't html
             logging.warning(f"Potential missing static file request: {path}. Returning 404.")
             return jsonify({"error": "Static file not found"}), 404

        logging.debug(f"SPA catch-all route triggered for path: {path}. Serving index.html.")
        index_html_path = Path(FRONTEND_DIST_PATH) / 'index.html'
        if index_html_path.exists():
            return send_file(index_html_path)
        else:
            logging.error(f"index.html not found at {index_html_path}")
            return jsonify({"error": "Frontend entry point not found. Please build the frontend."}), 404
else:
    logging.info("Not in production mode. Static files will not be served by Flask backend.")
    logging.info("Ensure frontend dev server (e.g., Vite) is running and CORS is configured.")


# --- Main execution ---
if __name__ == '__main__':
    backend_port = int(os.environ.get("PYTHON_BACKEND_PORT", 7654)) # Using a different env var name
    logging.info(f"Starting Python backend server on port {backend_port}")
    # For development, Flask's built-in server is fine.
    # For production, use a proper WSGI server like Gunicorn.
    # debug=True should be False in production if Flask itself serves requests.
    # Gunicorn or other WSGI servers will handle the production serving.
    app.run(host='0.0.0.0', port=backend_port, debug=not IS_PRODUCTION)
