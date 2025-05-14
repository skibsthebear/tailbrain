import React, { createContext, useState, useCallback, useContext } from 'react';
import {
  fetchServeStatus,
  fetchFunnelStatus,
  fetchDockerContainers
} from '../api';

// Create context with a default value to prevent null context errors
const defaultContextValue = {
  serveData: [],
  funnelData: {},
  dockerData: [],
  isLoading: false,
  error: null,
  lastUpdated: null,
  loadAllData: () => console.warn("Default loadAllData called - context not initialized"),
  setServeData: () => console.warn("Default setServeData called - context not initialized"),
  setFunnelData: () => console.warn("Default setFunnelData called - context not initialized"),
  setDockerData: () => console.warn("Default setDockerData called - context not initialized"),
};

const AppContext = createContext(defaultContextValue);

export const useAppContext = () => useContext(AppContext);

export const AppProvider = ({ children }) => {
  console.log("AppProvider initializing");
  const [serveData, setServeData] = useState([]);
  const [funnelData, setFunnelData] = useState({});
  const [dockerData, setDockerData] = useState([]);
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  const loadAllData = useCallback(async () => {
    console.log("loadAllData called");
    setIsLoading(true);
    setError(null);
    try {
      const [serve, funnel, docker] = await Promise.all([
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
        })
      ]);
      console.log("Data fetched successfully:", { serve, funnel, docker });
      setServeData(serve);
      setFunnelData(funnel);
      setDockerData(docker);
      setLastUpdated(new Date().toLocaleString());
    } catch (err) {
      console.error("Error loading all data:", err);
      setError('Failed to load data. Please check console for details or if backend is running.');
      // Clear data on error to avoid showing stale info
      setServeData([]);
      setFunnelData({});
      setDockerData([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const value = {
    serveData,
    funnelData,
    dockerData,
    isLoading,
    error,
    lastUpdated,
    loadAllData,
    setServeData,
    setFunnelData,
    setDockerData,
  };
  
  console.log("AppProvider returning with value:", value);
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}; 