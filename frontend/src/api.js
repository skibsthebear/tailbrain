import axios from 'axios';

// In production, API calls will be served from the same server
// In development, use localhost:3001
const API_URL = import.meta.env.PROD 
  ? '/api' 
  : (import.meta.env.VITE_API_URL || 'http://localhost:3001/api');

export const fetchHealthCheck = async () => {
  try {
    const response = await axios.get(`${API_URL}/health`);
    return response.data;
  } catch (error) {
    console.error('Error fetching health status:', error);
    throw error;
  }
};

export const fetchServeStatus = async () => {
  try {
    const response = await axios.get(`${API_URL}/tailscale/serve`);
    return response.data;
  } catch (error) {
    console.error('Error fetching Tailscale serve status:', error);
    throw error;
  }
};

export const fetchFunnelStatus = async () => {
  try {
    const response = await axios.get(`${API_URL}/tailscale/funnel`);
    return response.data;
  } catch (error) {
    console.error('Error fetching Tailscale funnel status:', error);
    throw error;
  }
};

export const fetchDockerContainers = async () => {
  try {
    const response = await axios.get(`${API_URL}/docker/containers`);
    return response.data;
  } catch (error) {
    console.error('Error fetching Docker containers:', error);
    throw error;
  }
};

// New functions for adding and removing ports

export const addServePort = async (port, service, localUrl) => {
  try {
    const response = await axios.post(`${API_URL}/tailscale/serve`, {
      port,
      service,
      localUrl
    });
    return response.data;
  } catch (error) {
    console.error('Error adding Tailscale serve port:', error);
    throw error;
  }
};

export const removeServePort = async (port) => {
  try {
    const response = await axios.delete(`${API_URL}/tailscale/serve/${port}`);
    return response.data;
  } catch (error) {
    console.error('Error removing Tailscale serve port:', error);
    throw error;
  }
};

export const addFunnelPort = async (port, protocol = 'tcp') => {
  try {
    const response = await axios.post(`${API_URL}/tailscale/funnel`, {
      port,
      protocol
    });
    return response.data;
  } catch (error) {
    console.error('Error adding Tailscale funnel port:', error);
    throw error;
  }
};

export const removeFunnelPort = async (port, protocol = 'tcp') => {
  try {
    const response = await axios.delete(`${API_URL}/tailscale/funnel/${port}`, {
      params: { protocol }
    });
    return response.data;
  } catch (error) {
    console.error('Error removing Tailscale funnel port:', error);
    throw error;
  }
};

// Docker Compose API functions
export const getDockerComposeApps = async () => {
  try {
    const response = await axios.get(`${API_URL}/docker-compose/apps`);
    return response.data;
  } catch (error) {
    console.error('Error fetching Docker Compose apps:', error);
    throw error;
  }
};

export const addDockerComposeApp = async (name, path) => {
  try {
    const response = await axios.post(`${API_URL}/docker-compose/apps`, { name, path });
    return response.data;
  } catch (error) {
    console.error('Error adding Docker Compose app:', error);
    throw error;
  }
};

export const removeDockerComposeApp = async (id) => {
  try {
    const response = await axios.delete(`${API_URL}/docker-compose/apps/${id}`);
    return response.data;
  } catch (error) {
    console.error('Error removing Docker Compose app:', error);
    throw error;
  }
};

export const dockerComposeUp = async (filePath) => {
  try {
    const response = await axios.post(`${API_URL}/docker-compose/up`, { filePath });
    return response.data;
  } catch (error) {
    console.error('Error executing docker-compose up:', error);
    throw error;
  }
};

export const dockerComposeDown = async (filePath) => {
  try {
    const response = await axios.post(`${API_URL}/docker-compose/down`, { filePath });
    return response.data;
  } catch (error) {
    console.error('Error executing docker-compose down:', error);
    throw error;
  }
}; 