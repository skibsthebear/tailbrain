import { Container, Heading, Tabs, TabList, TabPanels, Tab, TabPanel, VStack, HStack, Button, Text, Alert, AlertIcon, Box, Image } from '@chakra-ui/react';
import { RepeatIcon } from '@chakra-ui/icons';
import ServePortsView from './components/ServePortsView';
import FunnelPortsView from './components/FunnelPortsView';
import DockerContainersView from './components/DockerContainersView';
import DockerComposeView from './components/DockerComposeView';
import DockerNetworksView from './components/DockerNetworksView';
import React, { useEffect, useState } from 'react'; // Added useState
import { useAppContext } from './context/AppContext'; // Import useAppContext
import logoImage from '../../logo.png'; // Import the logo image

// Error boundary component to catch runtime errors
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Error caught by error boundary:", error, errorInfo);
    this.setState({ error, errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <Box p={4} bg="red.100" borderRadius="md">
          <Heading size="md" mb={2}>Something went wrong</Heading>
          <Text mb={2}>{this.state.error && this.state.error.toString()}</Text>
          <Text whiteSpace="pre-wrap" fontFamily="monospace" fontSize="xs">
            {this.state.errorInfo && this.state.errorInfo.componentStack}
          </Text>
        </Box>
      );
    }
    return this.props.children;
  }
}

function App() {
  const [appMounted, setAppMounted] = useState(false);
  const [contextLoaded, setContextLoaded] = useState(false);
  
  // For debugging only - log component lifecycle
  useEffect(() => {
    console.log("App component mounted");
    setAppMounted(true);
    return () => console.log("App component unmounted");
  }, []);
  
  // Use try-catch to handle any potential context errors
  let contextValue;
  try {
    contextValue = useAppContext();
    useEffect(() => {
      console.log("Context loaded:", contextValue);
      setContextLoaded(true);
    }, [contextValue]);
  } catch (error) {
    console.error("Error accessing AppContext:", error);
    return (
      <Container maxW="container.xl" py={8}>
        <Alert status="error">
          <AlertIcon />
          <Box>
            <Heading size="md">Context Error</Heading>
            <Text>{error.message}</Text>
          </Box>
        </Alert>
      </Container>
    );
  }
  
  const { isLoading, error, lastUpdated, loadAllData } = contextValue || {};
  
  useEffect(() => {
    console.log("Attempting to load data...");
    try {
      loadAllData && loadAllData(); // Load data on initial mount
      console.log("Data load initiated");
    } catch (error) {
      console.error("Error in loadAllData:", error);
    }
  }, [loadAllData]);

  return (
    <ErrorBoundary>
      <Container maxW="container.xl" py={8}>
        <VStack spacing={8} align="stretch">
          <HStack justifyContent="space-between" alignItems="center">
            <HStack spacing={3}>
              <Image src={logoImage} alt="TailBrain Logo" boxSize="40px" />
              <Heading as="h1" size="xl">TailBrain Dashboard</Heading>
            </HStack>
            <VStack align="flex-end" spacing={1}>
              <Button
                leftIcon={<RepeatIcon />}
                colorScheme="teal"
                onClick={() => {
                  console.log("Refresh button clicked");
                  loadAllData && loadAllData();
                }}
                isLoading={isLoading}
                loadingText="Refreshing..."
              >
                Refresh All
              </Button>
              {lastUpdated && !error && <Text fontSize="sm" color="gray.500">Last updated: {lastUpdated}</Text>}
            </VStack>
          </HStack>

          {error && (
            <Alert status="error" borderRadius="md">
              <AlertIcon />
              <Box flex="1">
                {error}
              </Box>
            </Alert>
          )}

          <Tabs variant="enclosed-colored" colorScheme="teal">
            <TabList>
              <Tab>Tailscale Serve</Tab>
              <Tab>Tailscale Funnel</Tab>
              <Tab>Docker Containers</Tab>
              <Tab>Docker Compose</Tab>
              <Tab>Docker Networks</Tab>
            </TabList>
            <TabPanels>
              <TabPanel>
                <ErrorBoundary>
                  <ServePortsView />
                </ErrorBoundary>
              </TabPanel>
              <TabPanel>
                <ErrorBoundary>
                  <FunnelPortsView />
                </ErrorBoundary>
              </TabPanel>
              <TabPanel>
                <ErrorBoundary>
                  <DockerContainersView />
                </ErrorBoundary>
              </TabPanel>
              <TabPanel>
                <ErrorBoundary>
                  <DockerComposeView />
                </ErrorBoundary>
              </TabPanel>
              <TabPanel>
                <ErrorBoundary>
                  <DockerNetworksView />
                </ErrorBoundary>
              </TabPanel>
            </TabPanels>
          </Tabs>
        </VStack>
      </Container>
    </ErrorBoundary>
  );
}

export default App;
