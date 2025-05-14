const express = require('express');
const cors = require('cors');
const path = require('path');
const {
  getTailscaleServeStatus,
  getTailscaleFunnelStatus,
  getDockerContainers,
  addTailscaleServePort,
  removeTailscaleServePort,
  addTailscaleFunnelPort,
  removeTailscaleFunnelPort,
} = require('./commandExecutor'); // Import the functions

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

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

// Serve static frontend files in production
if (process.env.NODE_ENV === 'production') {
  // Serve static files from the React app
  const frontendPath = path.join(__dirname, '../frontend/dist');
  app.use(express.static(frontendPath));
  
  // Handle React routing, return all requests to React app
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
      res.sendFile(path.join(frontendPath, 'index.html'));
    }
  });
}

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
}); 