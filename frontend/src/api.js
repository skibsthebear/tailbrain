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

// Docker Container Management API functions
export const stopDockerContainer = async (containerId) => {
  try {
    const response = await axios.post(`${API_URL}/docker/containers/${containerId}/stop`);
    return response.data;
  } catch (error) {
    console.error('Error stopping Docker container:', error);
    throw error;
  }
};

export const killDockerContainer = async (containerId) => {
  try {
    const response = await axios.post(`${API_URL}/docker/containers/${containerId}/kill`);
    return response.data;
  } catch (error) {
    console.error('Error killing Docker container:', error);
    throw error;
  }
};

export const restartDockerContainer = async (containerId) => {
  try {
    const response = await axios.post(`${API_URL}/docker/containers/${containerId}/restart`);
    return response.data;
  } catch (error) {
    console.error('Error restarting Docker container:', error);
    throw error;
  }
};

export const getDockerContainerLogs = async (containerId, lines = 100) => {
  try {
    const response = await axios.get(`${API_URL}/docker/containers/${containerId}/logs`, {
      params: { lines }
    });
    return response.data;
  } catch (error) {
    console.error('Error getting Docker container logs:', error);
    throw error;
  }
};

export const getDockerContainerStats = async (containerId) => {
  try {
    const response = await axios.get(`${API_URL}/docker/containers/${containerId}/stats`);
    return response.data;
  } catch (error) {
    console.error('Error getting Docker container stats:', error);
    throw error;
  }
};

// Docker Network Management API functions
export const listDockerNetworks = async () => {
  try {
    const response = await axios.get(`${API_URL}/docker/networks`);
    return response.data;
  } catch (error) {
    console.error('Error fetching Docker networks:', error);
    throw error;
  }
};

export const getDockerNetworkDetails = async (networkId) => {
  try {
    const response = await axios.get(`${API_URL}/docker/networks/${networkId}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching Docker network details:', error);
    throw error;
  }
};

export const getContainerNetworks = async (containerId) => {
  try {
    const response = await axios.get(`${API_URL}/docker/containers/${containerId}/networks`);
    return response.data;
  } catch (error) {
    console.error('Error fetching container networks:', error);
    throw error;
  }
};

export const connectContainerToNetwork = async (containerId, networkId) => {
  try {
    const response = await axios.post(`${API_URL}/docker/containers/${containerId}/networks/${networkId}/connect`);
    return response.data;
  } catch (error) {
    console.error('Error connecting container to network:', error);
    throw error;
  }
};

export const disconnectContainerFromNetwork = async (containerId, networkId) => {
  try {
    const response = await axios.post(`${API_URL}/docker/containers/${containerId}/networks/${networkId}/disconnect`);
    return response.data;
  } catch (error) {
    console.error('Error disconnecting container from network:', error);
    throw error;
  }
};

export const createDockerNetwork = async (name, driver = 'bridge', options = []) => {
  try {
    const response = await axios.post(`${API_URL}/docker/networks`, { name, driver, options });
    return response.data;
  } catch (error) {
    console.error('Error creating Docker network:', error);
    throw error;
  }
};

export const removeDockerNetwork = async (networkId) => {
  try {
    const response = await axios.delete(`${API_URL}/docker/networks/${networkId}`);
    return response.data;
  } catch (error) {
    console.error('Error removing Docker network:', error);
    throw error;
  }
}; 