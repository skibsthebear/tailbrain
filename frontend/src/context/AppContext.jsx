import React, { createContext, useState, useCallback, useContext } from 'react';
import {
  fetchServeStatus,
  fetchFunnelStatus,
  fetchDockerContainers,
  getDockerComposeApps,
  listDockerNetworks,
} from '../api';

// Create context with a default value to prevent null context errors
const defaultContextValue = {
  serveData: [],
  funnelData: {},
  dockerData: [],
  dockerComposeApps: [],
  networkData: [],
  isLoading: false,
  error: null,
  lastUpdated: null,
  loadAllData: () => console.warn("Default loadAllData called - context not initialized"),
  setServeData: () => console.warn("Default setServeData called - context not initialized"),
  setFunnelData: () => console.warn("Default setFunnelData called - context not initialized"),
  setDockerData: () => console.warn("Default setDockerData called - context not initialized"),
  setDockerComposeApps: () => console.warn("Default setDockerComposeApps called - context not initialized"),
  setNetworkData: () => console.warn("Default setNetworkData called - context not initialized"),
};

const AppContext = createContext(defaultContextValue);

export const useAppContext = () => useContext(AppContext);

export const AppProvider = ({ children }) => {
  console.log("AppProvider initializing");
  const [serveData, setServeData] = useState([]);
  const [funnelData, setFunnelData] = useState({});
  const [dockerData, setDockerData] = useState([]);
  const [dockerComposeApps, setDockerComposeApps] = useState([]);
  const [networkData, setNetworkData] = useState([]);
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  const loadAllData = useCallback(async () => {
    console.log("loadAllData called");
    setIsLoading(true);
    setError(null);
    try {
      const [serve, funnel, docker, composeApps, networks] = await Promise.all([
        fetchServeStatus().catch(err => {
          console.error("Error fetching serve status:", err);
          return [];
        }),
        fetchFunnelStatus().catch(err => {
          console.error("Error fetching funnel status:", err);
          return {};
        }),
        fetchDockerContainers().catch(err => {
          console.error("Error fetching docker containers:", err);
          return [];
        }),
        getDockerComposeApps().catch(err => {
          console.error("Error fetching docker compose apps:", err);
          return [];
        }),
        listDockerNetworks().catch(err => {
          console.error("Error fetching docker networks:", err);
          return [];
        })
      ]);
      console.log("Data fetched successfully:", { serve, funnel, docker, composeApps, networks });
      setServeData(serve);
      setFunnelData(funnel);
      setDockerData(docker);
      setDockerComposeApps(composeApps);
      setNetworkData(networks);
      setLastUpdated(new Date().toLocaleString());
    } catch (err) {
      console.error("Error loading all data in root Promise.all:", err);
      setError('Failed to load some data. Please check console for details or if backend is running.');
      setServeData([]);
      setFunnelData({});
      setDockerData([]);
      setDockerComposeApps([]);
      setNetworkData([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const value = {
    serveData,
    funnelData,
    dockerData,
    dockerComposeApps,
    networkData,
    isLoading,
    error,
    lastUpdated,
    loadAllData,
    setServeData,
    setFunnelData,
    setDockerData,
    setDockerComposeApps,
    setNetworkData,
  };
  
  console.log("AppProvider returning with value:", value);
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}; 