const { exec } = require('child_process');

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
    exec('tailscale serve status', (error, stdout, stderr) => {
      if (error) {
        console.error('Error executing tailscale serve status:', stderr);
        reject(error);
        return;
      }
      if (stderr) {
        // Tailscale might output warnings to stderr even on success
        console.warn('Stderr from tailscale serve status:', stderr);
      }
      resolve(parseServeOutput(stdout));
    });
  });
}

function getTailscaleFunnelStatus() {
  return new Promise((resolve, reject) => {
    exec('tailscale funnel status --json', (error, stdout, stderr) => {
      if (error) {
        console.error('Error executing tailscale funnel status:', stderr);
        reject(error);
        return;
      }
      if (stderr) {
        console.warn('Stderr from tailscale funnel status:', stderr);
      }
      try {
        const data = JSON.parse(stdout);
        resolve(data);
      } catch (e) {
        console.error('Failed to parse JSON from tailscale funnel status:', e);
        reject(new Error('Failed to parse JSON output for funnel status'));
      }
    });
  });
}

function getDockerContainers() {
  return new Promise((resolve, reject) => {
    exec('docker ps --format "{{json .}}"', (error, stdout, stderr) => {
      if (error) {
        console.error('Error executing docker ps:', stderr);
        reject(error);
        return;
      }
      if (stderr) {
         console.warn('Stderr from docker ps:', stderr);
      }
      try {
        const lines = stdout.trim().split('\n').filter(line => line.length > 0);
        const containers = lines.map(line => JSON.parse(line));
        resolve(containers);
      } catch (e) {
        console.error('Failed to parse JSON from docker ps:', e);
        reject(new Error('Failed to parse Docker output'));
      }
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
    
    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error('Error executing tailscale serve add:', stderr);
        reject(error);
        return;
      }
      if (stderr) {
        console.warn('Stderr from tailscale serve add:', stderr);
      }
      console.log('Added tailscale serve port:', stdout);
      resolve({ success: true, message: 'Port added successfully', output: stdout });
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
    
    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error('Error executing tailscale serve remove:', stderr);
        reject(error);
        return;
      }
      if (stderr) {
        console.warn('Stderr from tailscale serve remove:', stderr);
      }
      console.log('Removed tailscale serve port:', stdout);
      resolve({ success: true, message: 'Port removed successfully', output: stdout });
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
    
    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error('Error executing tailscale funnel add:', stderr);
        reject(error);
        return;
      }
      if (stderr) {
        console.warn('Stderr from tailscale funnel add:', stderr);
      }
      console.log('Added tailscale funnel port:', stdout);
      resolve({ success: true, message: 'Port funneled successfully', output: stdout });
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
    
    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error('Error executing tailscale funnel remove:', stderr);
        reject(error);
        return;
      }
      if (stderr) {
        console.warn('Stderr from tailscale funnel remove:', stderr);
      }
      console.log('Removed tailscale funnel port:', stdout);
      resolve({ success: true, message: 'Port funnel removed successfully', output: stdout });
    });
  });
}

module.exports = {
  getTailscaleServeStatus,
  getTailscaleFunnelStatus,
  getDockerContainers,
  addTailscaleServePort,
  removeTailscaleServePort,
  addTailscaleFunnelPort,
  removeTailscaleFunnelPort,
}; 