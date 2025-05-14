const express = require('express');
const cors = require('cors');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');

const {
  getTailscaleServeStatus,
  getTailscaleFunnelStatus,
  getDockerContainers,
  addTailscaleServePort,
  removeTailscaleServePort,
  addTailscaleFunnelPort,
  removeTailscaleFunnelPort,
  executeDockerComposeUp,
  executeDockerComposeDown,
} = require('./commandExecutor');

const app = express();
const PORT = process.env.PORT || 3001;

// File storage for Docker Compose applications
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '../data');
const COMPOSE_CONFIG_FILE = path.join(DATA_DIR, 'compose-apps.json');

// Create data directory if it doesn't exist
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  console.log(`Created data directory at ${DATA_DIR}`);
}

// Load Docker Compose apps from file or initialize with empty array
let dockerComposeApps = [];
try {
  if (fs.existsSync(COMPOSE_CONFIG_FILE)) {
    const data = fs.readFileSync(COMPOSE_CONFIG_FILE, 'utf8');
    dockerComposeApps = JSON.parse(data);
    console.log(`Loaded ${dockerComposeApps.length} Docker Compose apps from ${COMPOSE_CONFIG_FILE}`);
  } else {
    // Create empty file if it doesn't exist
    fs.writeFileSync(COMPOSE_CONFIG_FILE, JSON.stringify([], null, 2));
    console.log(`Created empty Docker Compose apps file at ${COMPOSE_CONFIG_FILE}`);
  }
} catch (err) {
  console.error(`Error loading Docker Compose apps from file: ${err.message}`);
}

// Function to save Docker Compose apps to file
function saveDockerComposeApps() {
  try {
    fs.writeFileSync(COMPOSE_CONFIG_FILE, JSON.stringify(dockerComposeApps, null, 2));
    console.log(`Saved ${dockerComposeApps.length} Docker Compose apps to ${COMPOSE_CONFIG_FILE}`);
    return true;
  } catch (err) {
    console.error(`Error saving Docker Compose apps to file: ${err.message}`);
    return false;
  }
}

app.use(cors());
app.use(express.json());

// API endpoints - these are defined before any static file handling
app.get('/api/health', (req, res) => {
  res.json({ status: 'UP', message: 'Backend is running' });
});

app.get('/api/tailscale/serve', async (req, res) => {
  try {
    const data = await getTailscaleServeStatus();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get Tailscale serve status', details: error.message });
  }
});

app.get('/api/tailscale/funnel', async (req, res) => {
  try {
    const data = await getTailscaleFunnelStatus();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get Tailscale funnel status', details: error.message });
  }
});

app.get('/api/docker/containers', async (req, res) => {
  try {
    const data = await getDockerContainers();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get Docker containers', details: error.message });
  }
});

app.post('/api/tailscale/serve', async (req, res) => {
  try {
    const { port, service, localUrl } = req.body;
    if (!port || !localUrl) {
      return res.status(400).json({ error: 'Port and localUrl are required' });
    }
    
    const result = await addTailscaleServePort(port, service, localUrl);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to add Tailscale serve port', details: error.message });
  }
});

app.post('/api/tailscale/funnel', async (req, res) => {
  try {
    const { port, protocol } = req.body;
    if (!port) {
      return res.status(400).json({ error: 'Port is required' });
    }
    
    const result = await addTailscaleFunnelPort(port, protocol);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to add Tailscale funnel port', details: error.message });
  }
});

app.delete('/api/tailscale/serve/:port', async (req, res) => {
  try {
    const { port } = req.params;
    if (!port) {
      return res.status(400).json({ error: 'Port is required' });
    }
    
    const result = await removeTailscaleServePort(port);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to remove Tailscale serve port', details: error.message });
  }
});

app.delete('/api/tailscale/funnel/:port', async (req, res) => {
  try {
    const { port } = req.params;
    const { protocol } = req.query;
    if (!port) {
      return res.status(400).json({ error: 'Port is required' });
    }
    
    const result = await removeTailscaleFunnelPort(port, protocol);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to remove Tailscale funnel port', details: error.message });
  }
});

// Docker Compose Management Endpoints
app.get('/api/docker-compose/apps', (req, res) => {
  res.json(dockerComposeApps);
});

app.post('/api/docker-compose/apps', (req, res) => {
  const { name, path: composePath } = req.body;
  if (!name || !composePath) {
    return res.status(400).json({ error: 'Name and path are required for Docker Compose app' });
  }
  if (!composePath.endsWith('.yml') && !composePath.endsWith('.yaml')) {
    return res.status(400).json({ error: 'Path must be a .yml or .yaml file' });
  }
  const newApp = { id: uuidv4(), name, path: composePath };
  dockerComposeApps.push(newApp);
  console.log('Added Docker Compose app:', newApp);
  
  // Save to file
  if (saveDockerComposeApps()) {
    res.status(201).json(newApp);
  } else {
    res.status(500).json({ error: 'Failed to save Docker Compose app configuration' });
  }
});

app.delete('/api/docker-compose/apps/:id', (req, res) => {
  const { id } = req.params;
  const initialLength = dockerComposeApps.length;
  dockerComposeApps = dockerComposeApps.filter(app => app.id !== id);
  if (dockerComposeApps.length < initialLength) {
    console.log('Deleted Docker Compose app with id:', id);
    
    // Save to file
    if (saveDockerComposeApps()) {
      res.status(200).json({ message: 'Docker Compose app removed' });
    } else {
      res.status(500).json({ error: 'Failed to save updated Docker Compose app configuration' });
    }
  } else {
    res.status(404).json({ error: 'Docker Compose app not found' });
  }
});

app.post('/api/docker-compose/up', async (req, res) => {
  const { filePath } = req.body;
  if (!filePath) {
    return res.status(400).json({ error: 'filePath is required' });
  }
  try {
    const result = await executeDockerComposeUp(filePath);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to execute docker-compose up', details: error.message });
  }
});

app.post('/api/docker-compose/down', async (req, res) => {
  const { filePath } = req.body;
  if (!filePath) {
    return res.status(400).json({ error: 'filePath is required' });
  }
  try {
    const result = await executeDockerComposeDown(filePath);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to execute docker-compose down', details: error.message });
  }
});

// Serve static frontend files in production
if (process.env.NODE_ENV === 'production') {
  const frontendDistPath = path.join(__dirname, '../frontend/dist');

  // Serve static assets from the 'dist' directory
  app.use(express.static(frontendDistPath));

  // For any other GET requests not handled by API routes or static assets, serve index.html.
  // In Express 5, wildcard routes need a proper regex pattern
  app.get('/{*filepath}', (req, res) => {
    res.sendFile(path.join(frontendDistPath, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
}); 