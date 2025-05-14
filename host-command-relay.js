#!/usr/bin/env node

/**
 * Host Command Relay
 * 
 * This script runs on the host system and executes commands on behalf of the container.
 * It listens on a specified port for command requests from the Docker container.
 */

const express = require('express');
const { exec } = require('child_process');
const cors = require('cors');
const app = express();
const port = process.env.PORT || 7655; // Use a different port than the main app

// Enable CORS for all origins in development
app.use(cors());
app.use(express.json());

// Middleware to log requests
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Test endpoint that always succeeds
app.get('/test', (req, res) => {
  console.log('Test endpoint called');
  res.status(200).json({ 
    status: 'ok', 
    message: 'Host command relay is working correctly',
    timestamp: new Date().toISOString(),
    hostname: require('os').hostname()
  });
});

// Execute command endpoint
app.post('/execute', (req, res) => {
  const { command } = req.body;
  
  if (!command) {
    return res.status(400).json({ error: 'Command is required' });
  }
  
  console.log(`Executing command: ${command}`);
  
  exec(command, (error, stdout, stderr) => {
    if (error) {
      console.error(`Error executing command: ${error.message}`);
      return res.status(500).json({
        error: error.message,
        stderr,
        stdout,
        code: error.code
      });
    }
    
    res.status(200).json({
      stdout,
      stderr: stderr || ''
    });
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message
  });
});

// Start the server
app.listen(port, () => {
  console.log(`Host command relay server running on port ${port}`);
  console.log(`Run container with -e HOST_RELAY_URL=http://host.docker.internal:${port}`);
}); 