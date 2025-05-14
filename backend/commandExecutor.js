const axios = require('axios');
const path = require('path'); // Added path module

// Configuration for host command relay
const HOST_RELAY_URL = process.env.HOST_RELAY_URL || 'http://host.docker.internal:7655';

// Execute a command on the host system via the host-command-relay service
function execHostCommand(command) {
  return new Promise((resolve, reject) => {
    console.log(`Executing host command via relay: ${command}`);
    
    axios.post(`${HOST_RELAY_URL}/execute`, { command })
      .then(response => {
        const { stdout, stderr } = response.data;
        if (stderr) {
          console.warn(`Warning from host command '${command}':`, stderr);
        }
        resolve({ stdout, stderr });
      })
      .catch(error => {
        console.error(`Error executing host command '${command}':`, 
          error.response ? error.response.data : error.message);
        reject(error);
      });
  });
}

// Placeholder for actual parsing logic, to be implemented in the next step
function parseServeOutput(stdout) {
  console.log('Parsing Tailscale Serve Output:', stdout);
  const lines = stdout.trim().split('\n');
  if (lines.length > 0 && lines[0].startsWith("No services")) return []; // Handle no services case
  // Skip header if any, or adjust based on actual output.
  // For now, assume each non-empty line is a service.
  return lines.filter(line => line.trim() !== '').map((line, index) => {
    // This is a very naive parser. Real output is more complex.
    // Example line: localhost:8080 (Funnel off) http://machine-name:8080
    // Example line: https://custom.domain.com (Funnel on) https://machine-name.ts.net (TLS)
    const parts = line.trim().split(/\s+/);
    let port = 'N/A';
    let service = parts[0]; // Default to the first part as service/identifier
    const statusText = line.includes('(Funnel on)') ? 'Funnel on' : (line.includes('(Funnel off)') ? 'Funnel off' : 'Status unknown');
    const active = true; // Assuming if listed, it's configured/active in some sense

    // Attempt to extract port from common patterns like localhost:PORT or *:PORT
    const portMatch = service.match(/:(\d+)/);
    if (portMatch) {
      port = portMatch[1];
    } else if (service.toLowerCase() === 'http') {
        port = '80';
    } else if (service.toLowerCase() === 'https') {
        port = '443';
    }


    return {
      id: `serve-${index}`, // Generate a simple ID
      rawLine: line,
      port: port,
      service: service, // This might be the exposed URL/hostname rather than an internal service name
      statusText: statusText, // e.g. "(Funnel off)"
      active: active, // For UI: true if entry exists, "active" could mean different things
      details: parts.slice(1).join(' ') // The rest of the line
    };
  });
}

function getTailscaleServeStatus() {
  return new Promise((resolve, reject) => {
    execHostCommand('tailscale serve status').then(({ stdout, stderr }) => {
      resolve(parseServeOutput(stdout));
    }).catch(error => {
      console.error('Error executing tailscale serve status:', error);
      reject(error);
    });
  });
}

function getTailscaleFunnelStatus() {
  return new Promise((resolve, reject) => {
    execHostCommand('tailscale funnel status --json').then(({ stdout, stderr }) => {
      try {
        const data = JSON.parse(stdout);
        resolve(data);
      } catch (e) {
        console.error('Failed to parse JSON from tailscale funnel status:', e);
        reject(new Error('Failed to parse JSON output for funnel status'));
      }
    }).catch(error => {
      console.error('Error executing tailscale funnel status:', error);
      reject(error);
    });
  });
}

function getDockerContainers() {
  return new Promise((resolve, reject) => {
    execHostCommand('docker ps --format "{{json .}}"').then(({ stdout, stderr }) => {
      try {
        const lines = stdout.trim().split('\n').filter(line => line.length > 0);
        const containers = lines.map(line => JSON.parse(line));
        resolve(containers);
      } catch (e) {
        console.error('Failed to parse JSON from docker ps:', e);
        reject(new Error('Failed to parse Docker output'));
      }
    }).catch(error => {
      console.error('Error executing docker ps:', error);
      reject(error);
    });
  });
}

// Add Tailscale serve port
function addTailscaleServePort(port, service, localUrl) {
  return new Promise((resolve, reject) => {
    if (!port || !localUrl) {
      reject(new Error('Port and local URL are required'));
      return;
    }

    // Example command: tailscale serve add :80 http://localhost:8080
    const command = `tailscale serve add :${port} ${localUrl}`;
    
    execHostCommand(command).then(({ stdout, stderr }) => {
      console.log('Added tailscale serve port:', stdout);
      resolve({ success: true, message: 'Port added successfully', output: stdout });
    }).catch(error => {
      console.error('Error executing tailscale serve add:', error);
      reject(error);
    });
  });
}

// Remove Tailscale serve port
function removeTailscaleServePort(port) {
  return new Promise((resolve, reject) => {
    if (!port) {
      reject(new Error('Port is required'));
      return;
    }

    // Example command: tailscale serve remove :80
    const command = `tailscale serve remove :${port}`;
    
    execHostCommand(command).then(({ stdout, stderr }) => {
      console.log('Removed tailscale serve port:', stdout);
      resolve({ success: true, message: 'Port removed successfully', output: stdout });
    }).catch(error => {
      console.error('Error executing tailscale serve remove:', error);
      reject(error);
    });
  });
}

// Add Tailscale funnel port
function addTailscaleFunnelPort(port, protocol = 'tcp') {
  return new Promise((resolve, reject) => {
    if (!port) {
      reject(new Error('Port is required'));
      return;
    }

    // Example command: tailscale funnel 443 tcp
    const command = `tailscale funnel ${port} ${protocol}`;
    
    execHostCommand(command).then(({ stdout, stderr }) => {
      console.log('Added tailscale funnel port:', stdout);
      resolve({ success: true, message: 'Port funneled successfully', output: stdout });
    }).catch(error => {
      console.error('Error executing tailscale funnel add:', error);
      reject(error);
    });
  });
}

// Remove Tailscale funnel port
function removeTailscaleFunnelPort(port, protocol = 'tcp') {
  return new Promise((resolve, reject) => {
    if (!port) {
      reject(new Error('Port is required'));
      return;
    }

    // Example command: tailscale funnel --tcp=443 off
    let command;
    if (protocol.toLowerCase() === 'tcp') {
      command = `tailscale funnel --tcp=${port} off`;
    } else if (protocol.toLowerCase() === 'http') {
      command = `tailscale funnel --http=${port} off`;
    } else {
      command = `tailscale funnel ${port} off`;
    }
    
    execHostCommand(command).then(({ stdout, stderr }) => {
      console.log('Removed tailscale funnel port:', stdout);
      resolve({ success: true, message: 'Port funnel removed successfully', output: stdout });
    }).catch(error => {
      console.error('Error executing tailscale funnel remove:', error);
      reject(error);
    });
  });
}

// New function to execute docker-compose up
function executeDockerComposeUp(composeFilePath) {
  return new Promise((resolve, reject) => {
    if (!composeFilePath) {
      return reject(new Error('Docker Compose file path is required'));
    }
    const workDir = path.dirname(composeFilePath);
    const fileName = path.basename(composeFilePath);
    const command = `cd "${workDir}" && docker-compose -f "${fileName}" up -d`;

    execHostCommand(command).then(({ stdout, stderr }) => {
      console.log(`docker-compose up successful for ${fileName} in ${workDir}:`, stdout);
      resolve({ success: true, message: 'Docker Compose up executed successfully', output: stdout });
    }).catch(error => {
      console.error(`Error executing docker-compose up for ${fileName} in ${workDir}:`, error);
      reject(new Error(`Failed to run docker-compose up: ${error.message}`));
    });
  });
}

// New function to execute docker-compose down
function executeDockerComposeDown(composeFilePath) {
  return new Promise((resolve, reject) => {
    if (!composeFilePath) {
      return reject(new Error('Docker Compose file path is required'));
    }
    const workDir = path.dirname(composeFilePath);
    const fileName = path.basename(composeFilePath);
    const command = `cd "${workDir}" && docker-compose -f "${fileName}" down`;

    execHostCommand(command).then(({ stdout, stderr }) => {
      console.log(`docker-compose down successful for ${fileName} in ${workDir}:`, stdout);
      resolve({ success: true, message: 'Docker Compose down executed successfully', output: stdout });
    }).catch(error => {
      console.error(`Error executing docker-compose down for ${fileName} in ${workDir}:`, error);
      reject(new Error(`Failed to run docker-compose down: ${error.message}`));
    });
  });
}

// New functions for Docker container operations
function stopDockerContainer(containerId) {
  return new Promise((resolve, reject) => {
    if (!containerId) {
      reject(new Error('Container ID is required'));
      return;
    }

    const command = `docker stop ${containerId}`;
    
    execHostCommand(command).then(({ stdout, stderr }) => {
      console.log(`Docker container stopped: ${containerId}`, stdout);
      resolve({ success: true, message: 'Container stopped successfully', output: stdout });
    }).catch(error => {
      console.error(`Error executing docker stop for ${containerId}:`, error);
      reject(error);
    });
  });
}

function killDockerContainer(containerId) {
  return new Promise((resolve, reject) => {
    if (!containerId) {
      reject(new Error('Container ID is required'));
      return;
    }

    const command = `docker kill ${containerId}`;
    
    execHostCommand(command).then(({ stdout, stderr }) => {
      console.log(`Docker container killed: ${containerId}`, stdout);
      resolve({ success: true, message: 'Container killed successfully', output: stdout });
    }).catch(error => {
      console.error(`Error executing docker kill for ${containerId}:`, error);
      reject(error);
    });
  });
}

function restartDockerContainer(containerId) {
  return new Promise((resolve, reject) => {
    if (!containerId) {
      reject(new Error('Container ID is required'));
      return;
    }

    const command = `docker restart ${containerId}`;
    
    execHostCommand(command).then(({ stdout, stderr }) => {
      console.log(`Docker container restarted: ${containerId}`, stdout);
      resolve({ success: true, message: 'Container restarted successfully', output: stdout });
    }).catch(error => {
      console.error(`Error executing docker restart for ${containerId}:`, error);
      reject(error);
    });
  });
}

function getDockerContainerLogs(containerId, lines = 100) {
  return new Promise((resolve, reject) => {
    if (!containerId) {
      reject(new Error('Container ID is required'));
      return;
    }

    const command = `docker logs --tail=${lines} ${containerId}`;
    
    execHostCommand(command).then(({ stdout, stderr }) => {
      console.log(`Retrieved logs for Docker container: ${containerId}`);
      resolve({ 
        success: true, 
        logs: stdout,
        error: stderr 
      });
    }).catch(error => {
      console.error(`Error retrieving logs for ${containerId}:`, error);
      reject(error);
    });
  });
}

// Function to get container statistics
function getDockerContainerStats(containerId) {
  return new Promise((resolve, reject) => {
    if (!containerId) {
      reject(new Error('Container ID is required'));
      return;
    }

    // Using --no-stream to get a single snapshot of stats instead of continuous stream
    const command = `docker stats ${containerId} --no-stream --format "{{json .}}"`;
    
    execHostCommand(command).then(({ stdout, stderr }) => {
      console.log(`Retrieved stats for Docker container: ${containerId}`);
      try {
        // Docker stats outputs a single line JSON object
        const stats = JSON.parse(stdout.trim());
        resolve({ 
          success: true, 
          stats
        });
      } catch (error) {
        console.error(`Error parsing stats output for ${containerId}:`, error);
        reject(new Error(`Failed to parse container stats: ${error.message}`));
      }
    }).catch(error => {
      console.error(`Error retrieving stats for ${containerId}:`, error);
      reject(error);
    });
  });
}

// Function to list all Docker networks
function listDockerNetworks() {
  return new Promise((resolve, reject) => {
    const command = `docker network ls --format "{{json .}}"`;
    
    execHostCommand(command).then(({ stdout, stderr }) => {
      try {
        const lines = stdout.trim().split('\n').filter(line => line.length > 0);
        const networks = lines.map(line => JSON.parse(line));
        resolve(networks);
      } catch (e) {
        console.error('Failed to parse JSON from docker network ls:', e);
        reject(new Error('Failed to parse Docker network output'));
      }
    }).catch(error => {
      console.error('Error executing docker network ls:', error);
      reject(error);
    });
  });
}

// Function to get detailed information about a specific network
function inspectDockerNetwork(networkId) {
  return new Promise((resolve, reject) => {
    if (!networkId) {
      reject(new Error('Network ID is required'));
      return;
    }

    const command = `docker network inspect ${networkId}`;
    
    execHostCommand(command).then(({ stdout, stderr }) => {
      try {
        const networkDetails = JSON.parse(stdout);
        resolve(networkDetails);
      } catch (e) {
        console.error(`Failed to parse JSON from docker network inspect ${networkId}:`, e);
        reject(new Error('Failed to parse Docker network details'));
      }
    }).catch(error => {
      console.error(`Error executing docker network inspect ${networkId}:`, error);
      reject(error);
    });
  });
}

// Function to get all networks a container is connected to
function getContainerNetworks(containerId) {
  return new Promise((resolve, reject) => {
    if (!containerId) {
      reject(new Error('Container ID is required'));
      return;
    }

    // Fix potential JSON parsing issues with proper quoting
    const command = `docker container inspect --format "{{json .NetworkSettings.Networks}}" ${containerId}`;
    
    execHostCommand(command).then(({ stdout, stderr }) => {
      try {
        console.log(`Raw network data for ${containerId}:`, stdout);
        
        // Handle empty output
        if (!stdout || stdout.trim() === '' || stdout.trim() === 'null') {
          console.log(`No network data returned for container ${containerId}`);
          resolve({});
          return;
        }
        
        const networks = JSON.parse(stdout.trim());
        console.log(`Parsed network data for ${containerId}:`, networks);
        
        resolve(networks);
      } catch (e) {
        console.error(`Failed to parse JSON from container networks for ${containerId}:`, e);
        console.error(`Raw stdout was: ${stdout}`);
        // Return empty object instead of rejecting to avoid UI errors
        resolve({});
      }
    }).catch(error => {
      console.error(`Error retrieving networks for container ${containerId}:`, error);
      // Return empty object instead of rejecting to avoid UI errors
      resolve({});
    });
  });
}

// Function to connect a container to a network
function connectContainerToNetwork(containerId, networkId) {
  return new Promise((resolve, reject) => {
    if (!containerId || !networkId) {
      reject(new Error('Container ID and Network ID are required'));
      return;
    }

    const command = `docker network connect ${networkId} ${containerId}`;
    
    execHostCommand(command).then(({ stdout, stderr }) => {
      console.log(`Connected container ${containerId} to network ${networkId}`);
      resolve({ 
        success: true, 
        message: `Container connected to ${networkId} successfully` 
      });
    }).catch(error => {
      console.error(`Error connecting container ${containerId} to network ${networkId}:`, error);
      reject(error);
    });
  });
}

// Function to disconnect a container from a network
function disconnectContainerFromNetwork(containerId, networkId) {
  return new Promise((resolve, reject) => {
    if (!containerId || !networkId) {
      reject(new Error('Container ID and Network ID are required'));
      return;
    }

    const command = `docker network disconnect ${networkId} ${containerId}`;
    
    execHostCommand(command).then(({ stdout, stderr }) => {
      console.log(`Disconnected container ${containerId} from network ${networkId}`);
      resolve({ 
        success: true, 
        message: `Container disconnected from ${networkId} successfully` 
      });
    }).catch(error => {
      console.error(`Error disconnecting container ${containerId} from network ${networkId}:`, error);
      reject(error);
    });
  });
}

// Function to create a new Docker network
function createDockerNetwork(name, driver = 'bridge', options = []) {
  return new Promise((resolve, reject) => {
    if (!name) {
      reject(new Error('Network name is required'));
      return;
    }

    const optionsString = options.map(opt => `--opt ${opt}`).join(' ');
    const command = `docker network create --driver ${driver} ${optionsString} ${name}`;
    
    execHostCommand(command).then(({ stdout, stderr }) => {
      console.log(`Created Docker network ${name} with driver ${driver}`);
      resolve({ 
        success: true, 
        message: `Network ${name} created successfully`,
        networkId: stdout.trim() 
      });
    }).catch(error => {
      console.error(`Error creating Docker network ${name}:`, error);
      reject(error);
    });
  });
}

// Function to remove a Docker network
function removeDockerNetwork(networkId) {
  return new Promise((resolve, reject) => {
    if (!networkId) {
      reject(new Error('Network ID is required'));
      return;
    }

    const command = `docker network rm ${networkId}`;
    
    execHostCommand(command).then(({ stdout, stderr }) => {
      console.log(`Removed Docker network ${networkId}`);
      resolve({ 
        success: true, 
        message: `Network removed successfully`
      });
    }).catch(error => {
      console.error(`Error removing Docker network ${networkId}:`, error);
      reject(error);
    });
  });
}

// Export the functions
module.exports = {
  getTailscaleServeStatus,
  getTailscaleFunnelStatus,
  getDockerContainers,
  addTailscaleServePort,
  removeServePort: removeTailscaleServePort,
  addTailscaleFunnelPort,
  removeTailscaleFunnelPort,
  executeDockerComposeUp,
  executeDockerComposeDown,
  stopDockerContainer,
  killDockerContainer,
  restartDockerContainer,
  getDockerContainerLogs,
  getDockerContainerStats,
  listDockerNetworks,
  inspectDockerNetwork,
  getContainerNetworks,
  connectContainerToNetwork,
  disconnectContainerFromNetwork,
  createDockerNetwork,
  removeDockerNetwork
}; 