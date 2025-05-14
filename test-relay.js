#!/usr/bin/env node

/**
 * Test Relay Script
 * 
 * This script tests the connection to the host command relay.
 */

const axios = require('axios');

// Configuration for host command relay
const HOST_RELAY_URL = process.env.HOST_RELAY_URL || 'http://localhost:7655';

async function testRelay() {
  console.log(`Testing connection to host relay at ${HOST_RELAY_URL}...`);
  
  try {
    // Test the health endpoint
    console.log('Testing health endpoint...');
    const healthResponse = await axios.get(`${HOST_RELAY_URL}/health`);
    console.log('Health check response:', healthResponse.data);
    
    // Test the test endpoint
    console.log('\nTesting test endpoint...');
    const testResponse = await axios.get(`${HOST_RELAY_URL}/test`);
    console.log('Test endpoint response:', testResponse.data);
    
    // Test executing a simple command
    console.log('\nTesting command execution...');
    const commandResponse = await axios.post(`${HOST_RELAY_URL}/execute`, { 
      command: 'echo "Hello from the host system"' 
    });
    console.log('Command execution response:', commandResponse.data);
    
    console.log('\n✅ All tests passed! The host command relay is working correctly.');
  } catch (error) {
    console.error('❌ Error testing relay:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
      console.error('Response status:', error.response.status);
    } else if (error.request) {
      console.error('No response received from the relay server.');
      console.error('Make sure the relay is running on the host at', HOST_RELAY_URL);
    } else {
      console.error('Error details:', error);
    }
    process.exit(1);
  }
}

testRelay(); 