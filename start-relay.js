#!/usr/bin/env node

/**
 * Start Relay Script
 * 
 * This script installs the necessary dependencies and starts the host-command-relay.
 * It's a convenient way to start the relay on the host system.
 */

const { spawn, exec } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('Starting TailBrain Host Command Relay...');

// Check if dependencies are installed
const checkDependencies = () => {
  return new Promise((resolve, reject) => {
    exec('npm list -g express cors', (error, stdout, stderr) => {
      if (stdout.includes('(empty)') || error) {
        console.log('Installing required dependencies...');
        exec('npm install -g express cors', (error, stdout, stderr) => {
          if (error) {
            console.error('Failed to install dependencies:', error);
            reject(error);
            return;
          }
          console.log('Dependencies installed successfully');
          resolve();
        });
      } else {
        console.log('Dependencies already installed');
        resolve();
      }
    });
  });
};

// Start the relay server
const startRelay = () => {
  console.log('Starting host command relay server...');
  
  // Check if host-command-relay.js exists
  if (!fs.existsSync(path.join(__dirname, 'host-command-relay.js'))) {
    console.error('Error: host-command-relay.js not found. Make sure you are in the correct directory.');
    process.exit(1);
  }
  
  const relay = spawn('node', ['host-command-relay.js'], { 
    stdio: 'inherit',
    shell: true 
  });
  
  relay.on('error', (error) => {
    console.error('Failed to start relay server:', error);
  });
  
  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log('Shutting down relay server...');
    relay.kill();
    process.exit(0);
  });
};

// Main function
const main = async () => {
  try {
    await checkDependencies();
    startRelay();
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
};

main(); 