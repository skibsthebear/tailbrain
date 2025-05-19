#!/usr/bin/env python3

"""
Start Relay Script (Python)

This script starts the host_command_relay.py server.
It's a convenient way to start the relay on the host system.
"""

import subprocess
import signal
import os
import sys
import logging
import time # Added import for time.sleep

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

# Global variable to hold the relay process
relay_process = None

def signal_handler(sig, frame):
    """Handles SIGINT and SIGTERM signals for graceful shutdown."""
    logging.info("Shutting down relay server...")
    if relay_process and relay_process.poll() is None: # Check if process is running
        try:
            # On Windows, process.terminate() is an alias for kill().
            # Sending SIGINT (Ctrl+C) is more graceful if the child process handles it.
            if sys.platform == "win32":
                relay_process.terminate() # or relay_process.send_signal(signal.CTRL_C_EVENT)
            else:
                relay_process.send_signal(signal.SIGINT)
            
            relay_process.wait(timeout=10) # Wait for graceful shutdown
        except subprocess.TimeoutExpired:
            logging.warning("Relay server did not terminate gracefully, killing.")
            relay_process.kill()
        except Exception as e:
            logging.error(f"Error during relay shutdown: {e}")
            relay_process.kill() # Ensure it's killed if other methods fail
    logging.info("Relay server shutdown complete.")
    sys.exit(0)

def start_relay_server():
    """Starts the host_command_relay.py server as a subprocess."""
    global relay_process
    
    script_dir = os.path.dirname(os.path.abspath(__file__))
    relay_script_path = os.path.join(script_dir, 'host_command_relay.py')

    if not os.path.exists(relay_script_path):
        logging.error(f"Error: host_command_relay.py not found at {relay_script_path}")
        sys.exit(1)

    logging.info("Starting TailBrain Host Command Relay (Python)...")
    
    try:
        # Start the Flask server (host_command_relay.py)
        # Ensure Python executable is found, especially in virtual environments or specific installations
        python_executable = sys.executable # Uses the same python that runs this script
        
        # Pass current environment variables to the subprocess
        # This ensures it can find installed packages if running in a virtual env
        env = os.environ.copy()

        relay_process = subprocess.Popen(
            [python_executable, relay_script_path],
            env=env,
            # stdout=subprocess.PIPE, # Optional: capture output
            # stderr=subprocess.PIPE, # Optional: capture error
            # text=True
        )
        logging.info(f"Host command relay server started with PID: {relay_process.pid}")

        # Optional: If you want to stream stdout/stderr from the relay process
        # for line in relay_process.stdout:
        #     logging.info(f"[Relay STDOUT] {line.strip()}")
        # for line in relay_process.stderr:
        #     logging.error(f"[Relay STDERR] {line.strip()}")

        # Wait for the process to complete (it won't, as it's a server, unless it crashes)
        # relay_process.wait() 
        # If it exits unexpectedly:
        # if relay_process.returncode != 0 and relay_process.returncode is not None:
        #    logging.error(f"Relay server exited unexpectedly with code {relay_process.returncode}")

    except FileNotFoundError:
        logging.error(f"Error: Python executable '{python_executable}' not found or host_command_relay.py script not found.")
        sys.exit(1)
    except Exception as e:
        logging.exception("Failed to start relay server:")
        sys.exit(1)

if __name__ == '__main__':
    # Register signal handlers for graceful shutdown
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)

    start_relay_server()

    # Keep the main script alive while the subprocess is running,
    # otherwise it might exit if Popen is not waited on and has no output pipes.
    # The signal handlers will manage exit.
    try:
        while relay_process and relay_process.poll() is None:
            # Sleep for a short duration to prevent busy-waiting
            # This loop allows the main script to stay alive and responsive to signals
            # while the relay_process (Flask app) runs in the background.
            signal.pause() if hasattr(signal, 'pause') else os.system("pause >nul") if os.name == "nt" else time.sleep(0.1)
    except KeyboardInterrupt: # This might be caught here if not by the signal handler first
        logging.info("Main script interrupted, initiating shutdown via signal handler.")
        signal_handler(signal.SIGINT, None) # Manually trigger handler
    finally:
        # Ensure cleanup if loop exits for other reasons
        if relay_process and relay_process.poll() is None:
            logging.info("Main script ending, ensuring relay process is terminated.")
            signal_handler(signal.SIGINT, None) # Manually trigger handler
