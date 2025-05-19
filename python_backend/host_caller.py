import os
import requests
import logging

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

HOST_RELAY_URL = os.environ.get('HOST_RELAY_URL', 'http://host.docker.internal:7655')

def exec_host_command(command_string):
    """
    Executes a command on the host system via the host-command-relay service.
    Args:
        command_string (str): The command to execute.
    Returns:
        dict: A dictionary containing 'stdout' and 'stderr' from the command execution.
    Raises:
        requests.exceptions.RequestException: If the request to the relay fails.
        ValueError: If the relay returns an unexpected error or response format.
    """
    logging.info(f"Executing host command via relay: {command_string}")
    
    try:
        response = requests.post(
            f"{HOST_RELAY_URL}/execute",
            json={"command": command_string},
            timeout=60  # Set a timeout for the request (e.g., 60 seconds)
        )
        response.raise_for_status()  # Raise an HTTPError for bad responses (4XX or 5XX)

        response_data = response.json()
        
        stdout = response_data.get("stdout", "")
        stderr = response_data.get("stderr", "")
        
        if response_data.get("error"): # Check if the relay reported a command execution error
            logging.error(
                f"Error from host command '{command_string}': {response_data.get('error')}\n"
                f"Stderr: {stderr}\n"
                f"Stdout: {stdout}\n"
                f"Code: {response_data.get('code')}"
            )
            # We still return stdout/stderr as the original Node.js version did,
            # but the caller in the new Python backend should check for an error indication.
            # For simplicity, we'll let the relay's 500 status (if command failed) be caught by raise_for_status.
            # If the relay returns 200 but with an error payload (as per host_command_relay.py logic for command failure),
            # this part is less critical as the relay itself would have returned 500.
            # However, the current host_command_relay.py returns 500 if command fails.

        if stderr:
            logging.warning(f"Stderr from host command '{command_string}': {stderr}")
            
        return {"stdout": stdout, "stderr": stderr}

    except requests.exceptions.HTTPError as http_err:
        logging.error(f"HTTP error occurred while calling relay for command '{command_string}': {http_err} - Response: {http_err.response.text}")
        # Attempt to parse error response from relay if possible
        try:
            err_details = http_err.response.json()
            raise ValueError(f"Relay returned HTTP error: {err_details.get('error', http_err.response.text)}") from http_err
        except ValueError: # Includes JSONDecodeError
             raise ValueError(f"Relay returned HTTP error: {http_err.response.status_code} - {http_err.response.text}") from http_err
    except requests.exceptions.RequestException as req_err:
        logging.error(f"Request error occurred while calling relay for command '{command_string}': {req_err}")
        raise ValueError(f"Failed to connect to relay: {req_err}") from req_err
    except ValueError as json_err: # Includes JSONDecodeError if response is not valid JSON
        logging.error(f"Error decoding JSON response from relay for command '{command_string}': {json_err}")
        raise ValueError(f"Invalid JSON response from relay: {json_err}") from json_err

if __name__ == '__main__':
    # Example usage (for testing this module directly)
    logging.info("Testing host_caller.py...")
    try:
        # Test 1: Simple command
        print("\n--- Test 1: echo hello ---")
        result = exec_host_command("echo hello from host_caller")
        print(f"Stdout: {result['stdout']}")
        print(f"Stderr: {result['stderr']}")

        # Test 2: Command that produces stderr (e.g., on Linux 'ls /nonexistentfolder')
        # On Windows, 'dir ZZZNonExistentPath'
        print("\n--- Test 2: dir ZZZNonExistentPath (expect error) ---")
        # This command will likely cause the relay to return a 500, which exec_host_command will raise as ValueError
        try:
            result_err_cmd = exec_host_command("dir ZZZNonExistentPath" if os.name == 'nt' else "ls /nonexistentfolder")
            print(f"Stdout: {result_err_cmd['stdout']}")
            print(f"Stderr: {result_err_cmd['stderr']}")
        except ValueError as e:
            print(f"Caught expected error for failing command: {e}")
        
        # Test 3: Relay not running (to test connection error)
        # To test this, stop host_command_relay.py and then run:
        # HOST_RELAY_URL="http://localhost:7655" python python_backend/host_caller.py
        # print("\n--- Test 3: Relay not running (manual test) ---")
        # result_conn_err = exec_host_command("echo test_connection_error")
        # print(f"Result: {result_conn_err}")


    except ValueError as e:
        print(f"Error during test: {e}")
    except Exception as e:
        print(f"An unexpected error occurred during test: {e}")
