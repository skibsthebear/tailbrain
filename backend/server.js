const express = require('express');
const cors = require('cors');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

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

// In-memory store for Docker Compose applications
let dockerComposeApps = [];

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
  // Basic validation for path (ends with .yml or .yaml)
  if (!composePath.endsWith('.yml') && !composePath.endsWith('.yaml')) {
    return res.status(400).json({ error: 'Path must be a .yml or .yaml file' });
  }
  const newApp = { id: uuidv4(), name, path: composePath };
  dockerComposeApps.push(newApp);
  console.log('Added Docker Compose app:', newApp);
  res.status(201).json(newApp);
});

app.delete('/api/docker-compose/apps/:id', (req, res) => {
  const { id } = req.params;
  const initialLength = dockerComposeApps.length;
  dockerComposeApps = dockerComposeApps.filter(app => app.id !== id);
  if (dockerComposeApps.length < initialLength) {
    console.log('Deleted Docker Compose app with id:', id);
    res.status(200).json({ message: 'Docker Compose app removed' });
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
  // IMPORTANT: Set up middleware to handle URLs with colons properly
  // This disables the automatic route parameter functionality for static files
  // and prevents errors like "Missing parameter name" with URLs like "https://..."
  app.use((req, res, next) => {
    // Store the original URL parsing method
    const originalUrl = req.url;
    
    // Call next middleware
    next();
    
    // Restore original URL after middleware
    req.url = originalUrl;
  });
  
  // Serve static files from the React app
  const frontendPath = path.join(__dirname, '../frontend/dist');
  app.use(express.static(frontendPath));
  
  // Update the catch-all route to be more specific about which paths to handle
  // This prevents Express from trying to parse URLs in asset files
  app.get('/*', (req, res) => {
    if (!req.path.startsWith('/api') && 
        !req.path.includes('.') && // Skip files with extensions like .js, .css
        !req.path.includes(':')) { // Skip paths with colons (like in URLs)
      res.sendFile(path.join(frontendPath, 'index.html'));
    } else if (!req.path.startsWith('/api')) {
      // For asset files that may contain URLs with colons
      res.sendFile(path.join(frontendPath, req.path), (err) => {
        if (err) {
          // If the specific file isn't found, default to index.html for client-side routing
          res.sendFile(path.join(frontendPath, 'index.html'));
        }
      });
    } else {
      // Let API requests fall through to 404
      next();
    }
  });
}

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
}); 