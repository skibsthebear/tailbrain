import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Heading, 
  Text, 
  Table, 
  Thead, 
  Tbody, 
  Tr, 
  Th, 
  Td, 
  TableContainer, 
  Spinner, 
  Tag, 
  Link, 
  Tooltip, 
  HStack, 
  Icon,
  Button,
  ButtonGroup,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalCloseButton,
  ModalFooter,
  useDisclosure,
  useToast,
  Code,
  Divider,
  Flex,
  IconButton,
  Select,
  Spacer,
  StatGroup,
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText,
  Progress,
  Badge,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  MenuDivider,
  Grid,
  SimpleGrid,
  VStack,
  Wrap,
  WrapItem,
  Stack,
  useBreakpointValue
} from '@chakra-ui/react';
import { ExternalLinkIcon, RepeatIcon, ChevronDownIcon } from '@chakra-ui/icons';
import { FaStop, FaSkull, FaPlay, FaFileAlt, FaChartLine, FaNetworkWired } from 'react-icons/fa';
import { useAppContext } from '../context/AppContext';
import { 
  stopDockerContainer,
  killDockerContainer, 
  restartDockerContainer, 
  getDockerContainerLogs, 
  getDockerContainerStats,
  listDockerNetworks,
  getContainerNetworks,
  connectContainerToNetwork,
  disconnectContainerFromNetwork
} from '../api';

// Helper to format creation time (example)
const formatCreatedAt = (dockerTimestamp) => {
  // Docker's {{json .}} output for CreatedAt is a Unix timestamp (seconds)
  // Or sometimes it's a string like "2024-01-15 10:05:47 +0000 UTC"
  // The PRD example data has "2023-10-26T10:00:00Z" which is ISO 8601
  // Let's assume ISO 8601 based on PRD's mock for now.
  // If it's a number (unix timestamp), new Date(dockerTimestamp * 1000)
  if (!dockerTimestamp) return 'N/A';
  try {
    return new Date(dockerTimestamp).toLocaleString();
  } catch (e) {
    return String(dockerTimestamp); // Fallback to string if parsing fails
  }
};

// Helper to shorten container ID
const shortenId = (id) => id ? String(id).substring(0, 8) : 'N/A';

// Helper to parse ports from Docker format
const parsePortsToLinks = (portsStr) => {
  if (!portsStr || portsStr === 'N/A') return null;
  
  // Common Docker port format: 0.0.0.0:8080->80/tcp, 0.0.0.0:8081->81/tcp
  // or sometimes just: 80/tcp, 81/tcp (when not published)
  const portMappings = [];
  
  // Split by comma for multiple port mappings
  const parts = String(portsStr).split(',').map(p => p.trim());
  
  parts.forEach(part => {
    // Try to find the published port (the one after 0.0.0.0: and before ->)
    const publishedMatch = part.match(/(?:\d+\.\d+\.\d+\.\d+:)?(\d+)(?:->)?/);
    const containerPort = part.match(/->(\d+)\//)?.[1]; // Extract container port if in format
    
    if (publishedMatch && publishedMatch[1]) {
      const hostPort = publishedMatch[1];
      const protocol = part.includes('/tcp') ? 'http' : 'https';
      const url = `${protocol}://localhost:${hostPort}`;
      
      portMappings.push({
        hostPort,
        containerPort: containerPort || hostPort,
        protocol: part.includes('/tcp') ? 'tcp' : part.includes('/udp') ? 'udp' : '',
        url,
        displayText: part
      });
    } else {
      // If no published port found, just store the display text
      portMappings.push({
        displayText: part,
        hostPort: null // Not published/mapped to host
      });
    }
  });
  
  return portMappings;
};

const DockerContainersView = () => {
  const { dockerData, isLoading, error, loadAllData } = useAppContext();
  const [actionLoading, setActionLoading] = useState(false);
  const [activeContainer, setActiveContainer] = useState(null);
  const [containerLogs, setContainerLogs] = useState({ logs: '', error: '' });
  const [logsLoading, setLogsLoading] = useState(false);
  const [logLines, setLogLines] = useState(100);
  const [containerStats, setContainerStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsRefreshTimer, setStatsRefreshTimer] = useState(null);
  const [networks, setNetworks] = useState([]);
  const [networksLoading, setNetworksLoading] = useState(false);
  const [containerNetworks, setContainerNetworks] = useState({});
  
  const { isOpen: isLogsOpen, onOpen: onLogsOpen, onClose: onLogsClose } = useDisclosure();
  const { 
    isOpen: isStatsOpen, 
    onOpen: onStatsOpen, 
    onClose: onStatsClose 
  } = useDisclosure();
  const toast = useToast();

  // Responsive value for card content direction
  const cardContentDirection = useBreakpointValue({ base: "column", sm: "row" });
  const actionsDirection = useBreakpointValue({ base: "column", sm: "row" });
  const detailsFontSize = useBreakpointValue({ base: "2xs", md: "xs"});
  const headingFontSize = useBreakpointValue({ base: "xs", md: "sm"});
  const iconBoxSize = useBreakpointValue({base: "0.7em", md: "0.8em"});
  const cardMinHeight = useBreakpointValue({ base: "230px", sm: "240px", md: "250px" });

  // Fetch networks on component mount
  useEffect(() => {
    fetchNetworks();
  }, []);

  // Fetch container networks when dockerData changes
  useEffect(() => {
    if (dockerData && dockerData.length > 0) {
      const fetchAllNetworks = async () => {
        setNetworksLoading(true);
        try {
          await Promise.all(
            dockerData.map(container => 
              fetchContainerNetworks(container.ID || container.Id)
            )
          );
        } catch (error) {
          console.error('Error fetching container networks:', error);
        } finally {
          setNetworksLoading(false);
        }
      };
      
      fetchAllNetworks();
    }
  }, [dockerData]);

  // Function to fetch available networks
  const fetchNetworks = async () => {
    setNetworksLoading(true);
    try {
      const networkList = await listDockerNetworks();
      setNetworks(networkList);
    } catch (error) {
      console.error('Error fetching networks:', error);
      toast({
        title: 'Error fetching networks',
        description: error.message,
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setNetworksLoading(false);
    }
  };

  // Function to fetch networks for a specific container
  const fetchContainerNetworks = async (containerId) => {
    try {
      const containerNetworksList = await getContainerNetworks(containerId);
      console.log(`Networks for container ${containerId}:`, containerNetworksList);
      
      // Ensure we have valid network data before updating state
      if (containerNetworksList && typeof containerNetworksList === 'object') {
        setContainerNetworks(prev => ({
          ...prev,
          [containerId]: containerNetworksList
        }));
        return containerNetworksList;
      } else {
        console.warn(`Invalid network data for container ${containerId}:`, containerNetworksList);
        return {};
      }
    } catch (error) {
      console.error(`Error fetching networks for container ${containerId}:`, error);
      return {};
    }
  };

  // Function to handle network change
  const handleNetworkChange = async (containerId, containerName, networkId, action = 'connect') => {
    setActionLoading(true);
    try {
      if (action === 'connect') {
        await connectContainerToNetwork(containerId, networkId);
        toast({
          title: 'Network connected',
          description: `Container ${containerName} connected to network`,
          status: 'success',
          duration: 3000,
          isClosable: true,
        });
      } else if (action === 'disconnect') {
        // Get current networks for this container
        const currentNetworks = containerNetworks[containerId];
        // Get current network IDs
        const currentNetworkIds = currentNetworks ? Object.keys(currentNetworks) : [];
        
        // Prevent disconnecting from all networks
        if (currentNetworkIds.length <= 1) {
          toast({
            title: 'Cannot disconnect',
            description: 'Container must be connected to at least one network',
            status: 'warning',
            duration: 3000,
            isClosable: true,
          });
          setActionLoading(false);
          return;
        }
        
        await disconnectContainerFromNetwork(containerId, networkId);
        toast({
          title: 'Network disconnected',
          description: `Container ${containerName} disconnected from network`,
          status: 'success',
          duration: 3000,
          isClosable: true,
        });
      }
      
      // Refresh data
      await loadAllData();
      await fetchContainerNetworks(containerId);
    } catch (error) {
      toast({
        title: `Failed to ${action} network`,
        description: error.message,
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setActionLoading(false);
    }
  };

  // Clean up timer when stats modal is closed
  useEffect(() => {
    return () => {
      if (statsRefreshTimer) {
        clearInterval(statsRefreshTimer);
      }
    };
  }, [statsRefreshTimer]);

  // Handler for closing stats modal - clear interval
  const handleStatsClose = () => {
    if (statsRefreshTimer) {
      clearInterval(statsRefreshTimer);
      setStatsRefreshTimer(null);
    }
    onStatsClose();
  };

  // Handler for showing container stats
  const handleViewStats = async (containerId, containerName) => {
    setActiveContainer({ id: containerId, name: containerName });
    setStatsLoading(true);
    setContainerStats(null);
    onStatsOpen();
    
    try {
      const result = await getDockerContainerStats(containerId);
      setContainerStats(result.stats);
      
      // Set up auto-refresh timer for stats
      const timer = setInterval(async () => {
        try {
          const refreshedResult = await getDockerContainerStats(containerId);
          setContainerStats(refreshedResult.stats);
        } catch (error) {
          console.error('Error refreshing stats:', error);
        }
      }, 3000); // Refresh every 3 seconds
      
      setStatsRefreshTimer(timer);
    } catch (error) {
      toast({
        title: "Error fetching container stats",
        description: error.message,
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setStatsLoading(false);
    }
  };

  // Refresh stats manually
  const refreshStats = async () => {
    if (!activeContainer) return;
    
    setStatsLoading(true);
    try {
      const result = await getDockerContainerStats(activeContainer.id);
      setContainerStats(result.stats);
    } catch (error) {
      toast({
        title: "Error refreshing stats",
        description: error.message,
        status: "error",
        duration: 3000,
        isClosable: true,
      });
    } finally {
      setStatsLoading(false);
    }
  };

  // Handler for showing container logs
  const handleViewLogs = async (containerId, containerName) => {
    setActiveContainer({ id: containerId, name: containerName });
    setLogsLoading(true);
    setContainerLogs({ logs: '', error: '' });
    onLogsOpen();
    
    try {
      const result = await getDockerContainerLogs(containerId, logLines);
      setContainerLogs({ 
        logs: result.logs, 
        error: result.error 
      });
    } catch (error) {
      setContainerLogs({
        logs: '',
        error: `Failed to fetch logs: ${error.message}`
      });
      toast({
        title: "Error fetching logs",
        description: error.message,
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setLogsLoading(false);
    }
  };

  // Refresh logs with selected number of lines
  const refreshLogs = async () => {
    if (!activeContainer) return;
    
    setLogsLoading(true);
    try {
      const result = await getDockerContainerLogs(activeContainer.id, logLines);
      setContainerLogs({ 
        logs: result.logs, 
        error: result.error 
      });
    } catch (error) {
      setContainerLogs({
        logs: '',
        error: `Failed to fetch logs: ${error.message}`
      });
    } finally {
      setLogsLoading(false);
    }
  };

  // Handler for stopping container
  const handleStopContainer = async (containerId, containerName) => {
    setActionLoading(true);
    try {
      await stopDockerContainer(containerId);
      toast({
        title: "Container stopped",
        description: `Container ${containerName} has been stopped`,
        status: "success",
        duration: 3000,
        isClosable: true,
      });
      loadAllData(); // Refresh the container list
    } catch (error) {
      toast({
        title: "Failed to stop container",
        description: error.message,
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setActionLoading(false);
    }
  };

  // Handler for killing container
  const handleKillContainer = async (containerId, containerName) => {
    setActionLoading(true);
    try {
      await killDockerContainer(containerId);
      toast({
        title: "Container killed",
        description: `Container ${containerName} has been forcibly stopped`,
        status: "success",
        duration: 3000,
        isClosable: true,
      });
      loadAllData(); // Refresh the container list
    } catch (error) {
      toast({
        title: "Failed to kill container",
        description: error.message,
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setActionLoading(false);
    }
  };

  // Handler for restarting container
  const handleRestartContainer = async (containerId, containerName) => {
    setActionLoading(true);
    try {
      await restartDockerContainer(containerId);
      toast({
        title: "Container restarted",
        description: `Container ${containerName} has been restarted`,
        status: "success",
        duration: 3000,
        isClosable: true,
      });
      loadAllData(); // Refresh the container list
    } catch (error) {
      toast({
        title: "Failed to restart container",
        description: error.message,
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusTag = (status) => {
    if (!status) return <Tag size="sm">Unknown</Tag>;
    const s = String(status).toLowerCase();
    if (s.startsWith('up') || s.includes('running')) return <Tag size="sm" variant="subtle" colorScheme="green">{status}</Tag>;
    if (s.startsWith('exited') || s.includes('stopped')) return <Tag size="sm" variant="subtle" colorScheme="red">{status}</Tag>;
    return <Tag size="sm" variant="subtle" colorScheme="gray">{status}</Tag>;
  };

  // Render network dropdown menu for a container
  const renderNetworkMenu = (container) => {
    const containerId = container.ID || container.Id;
    const containerName = container.Names || 
      (container.Name && container.Name.startsWith('/') ? container.Name.substring(1) : container.Name) || 
      'N/A';
    
    const containerNetworkList = containerNetworks[containerId] || {};
    const containerNetworkIds = Object.keys(containerNetworkList);
    
    // Debug network information
    console.log(`Rendering networks for container ${containerId}:`, {
      containerNetworkList,
      containerNetworkIds
    });
    
    // Map network IDs to network names
    const networkNames = containerNetworkIds.map(netId => {
      // Try to find network name from various possible structures
      const networkObj = containerNetworkList[netId];
      let networkName;
      
      if (typeof networkObj === 'object' && networkObj !== null) {
        // First try to get the name from the network object itself
        networkName = networkObj.Name || networkObj.name;
        
        // If that fails, try to find it in the networks list
        if (!networkName) {
          const foundNetwork = networks.find(n => n.ID === netId || n.Id === netId);
          networkName = foundNetwork ? (foundNetwork.Name || foundNetwork.name) : null;
        }
      }
      
      // If nothing worked, just use the ID
      return networkName || netId;
    });

    // Format for display in button
    const displayText = networkNames.length > 0 
      ? networkNames.join(', ')
      : 'No Networks';
    
    const isTooltipNeeded = displayText.length > 20; // Example threshold for when tooltip is useful

    return (
      <Menu closeOnSelect={false}>
        <Tooltip label={displayText} isDisabled={!isTooltipNeeded} placement="top" openDelay={300}>
          <MenuButton 
            as={Button} 
            size="xs" 
            rightIcon={<ChevronDownIcon />} 
            isLoading={networksLoading}
            variant="outline"
            width="100%" // Explicitly set to 100% of its parent
            minW="100px" // Minimum width for the button
            maxW="180px" // Maximum width for the button to ensure consistency
            textAlign="left"
            overflow="hidden" // Hide overflow on the button itself
          >
            <HStack 
              spacing={1} 
              justifyContent="flex-start" 
              width="full" 
              title={displayText}
            >
              <Icon as={FaNetworkWired} boxSize={iconBoxSize} flexShrink={0} />
              <Text 
                noOfLines={1} 
                fontSize={detailsFontSize} 
                flexGrow={1} // Allow text to take available space
                minW={0} // Essential for truncation within flex
                // Removed explicit width/maxWidth from Text, relying on parent MenuButton's maxW and noOfLines
              >
                {displayText}
              </Text>
            </HStack>
          </MenuButton>
        </Tooltip>
        <MenuList 
          maxW="280px" // Adjusted maxW for a bit more space if needed
          minW="200px" // Ensure a reasonable minimum width
          maxH="200px" // Set a maximum height for the dropdown
          overflowY="auto" // Enable vertical scrolling
          zIndex={1500} // Keep zIndex for visibility
          fontSize={detailsFontSize} // Apply base font size to the list
        >
          <MenuItem isDisabled fontWeight="bold" fontSize={detailsFontSize}>Current Networks</MenuItem>
          {containerNetworkIds.length > 0 ? (
            containerNetworkIds.map(netId => {
              // Similar logic to get network name
              const networkObj = containerNetworkList[netId];
              let networkName;
              
              if (typeof networkObj === 'object' && networkObj !== null) {
                networkName = networkObj.Name || networkObj.name;
                if (!networkName) {
                  const foundNetwork = networks.find(n => n.ID === netId || n.Id === netId);
                  networkName = foundNetwork ? (foundNetwork.Name || foundNetwork.name) : null;
                }
              }
              
              return (
                <MenuItem 
                  key={netId} 
                  closeOnSelect={false}
                  onClick={() => handleNetworkChange(containerId, containerName, netId, 'disconnect')}
                  icon={<Icon as={FaNetworkWired} color="red.500" boxSize={iconBoxSize} />}
                  fontSize={detailsFontSize} // Apply font size to menu items
                  py={1} // Adjust padding for items
                >
                  <Tooltip label={`Disconnect from ${networkName || netId}`} placement="left" openDelay={300}>
                    <Text noOfLines={1}> Disconnect from {networkName || netId} </Text>
                  </Tooltip>
                </MenuItem>
              );
            })
          ) : (
            <MenuItem isDisabled fontSize={detailsFontSize}>No connected networks</MenuItem>
          )}

          <MenuDivider />
          <MenuItem isDisabled fontWeight="bold" fontSize={detailsFontSize}>Connect to Network</MenuItem>
          {networks.filter(network => 
            !containerNetworkIds.includes(network.ID) && 
            network.Driver !== 'host' && 
            network.Driver !== 'null'
          ).map(network => (
            <MenuItem 
              key={network.ID} 
              closeOnSelect={false}
              onClick={() => handleNetworkChange(containerId, containerName, network.ID, 'connect')}
              icon={<Icon as={FaNetworkWired} color="green.500" boxSize={iconBoxSize} />}
              fontSize={detailsFontSize} // Apply font size to menu items
              py={1} // Adjust padding for items
            >
              <Tooltip label={`Connect to ${network.Name}`} placement="left" openDelay={300}>
                <Text noOfLines={1}>Connect to {network.Name}</Text>
              </Tooltip>
            </MenuItem>
          ))}
        </MenuList>
      </Menu>
    );
  };

  // Render a container card for the responsive view
  const renderContainerCard = (container) => {
    const containerId = container.ID || container.Id;
    const containerName = container.Names || 
      (container.Name && container.Name.startsWith('/') ? container.Name.substring(1) : container.Name) || 
      'N/A';
    
    const portLinks = parsePortsToLinks(container.Ports);
    const hasWebUI = portLinks && portLinks.some(p => p.hostPort !== null);
    const nameLink = hasWebUI ? portLinks.find(p => p.hostPort !== null)?.url : null;
    const containerStatus = container.Status || (container.State && container.State.Status) || '';
    const isRunning = containerStatus.toLowerCase().includes('up') || containerStatus.toLowerCase().includes('running');
    
    return (
      <Box 
        borderWidth="1px" 
        borderRadius="md" 
        p={3}
        bg="white" 
        shadow="sm"
        w="100%"
        display="flex" 
        flexDirection="column" 
        justifyContent="space-between" 
        minH={cardMinHeight} // Use responsive min height
        h="100%" // Make card take full height of its grid cell
      >
        <VStack align="stretch" spacing={2} flexGrow={1}>
          {/* Top Row: Name, ID, Status */}
          <Flex justify="space-between" align="flex-start" wrap="wrap" gap={1}>
            <Box flex="1 1 auto" minW={{base: "calc(100% - 100px)", sm:"120px"}} mr={2}> 
              {nameLink ? (
                <Tooltip label={containerName} placement="top" openDelay={300}>
                  <Link 
                    href={nameLink} 
                    color="teal.500" 
                    isExternal
                    display="inline-flex"
                    alignItems="center"
                    fontWeight="bold"
                    fontSize={headingFontSize}
                    noOfLines={2} // Allow up to 2 lines before truncating name
                    wordBreak="break-word" 
                  >
                    {containerName}
                    <ExternalLinkIcon ml={1} boxSize={iconBoxSize} />
                  </Link>
                </Tooltip>
              ) : (
                <Tooltip label={containerName} placement="top" openDelay={300}>
                  <Text fontWeight="bold" fontSize={headingFontSize} wordBreak="break-word" noOfLines={2}>
                    {containerName}
                  </Text>
                </Tooltip>
              )}
            </Box>
            <Stack direction={{base: "row", sm: "column", md: "row"}} spacing={1} align={{base: "center", sm: "flex-end", md: "center"}} flexShrink={0}> 
              <Tag size="sm" variant="outline" colorScheme="gray" whiteSpace="nowrap">{shortenId(containerId)}</Tag>
              {getStatusTag(containerStatus)}
            </Stack>
          </Flex>
          
          {/* Middle Section: Image, Created, Ports, Network */}
          <Grid 
            templateColumns={{ base: "1fr", sm: "repeat(2, 1fr)" }}
            gap={{base: 2, md:3}} 
            alignItems="flex-start"
            flexGrow={1} // Allow middle section to grow
          >
            <VStack align="stretch" spacing={1} minH="70px"> {/* Ensure min height for this column */}
              <Text fontSize={detailsFontSize} color="gray.500" fontWeight="medium">Image</Text>
              <Tooltip label={container.Image} placement="top" openDelay={300}>
                <Text fontSize={detailsFontSize} noOfLines={1} title={container.Image}>{container.Image}</Text>
              </Tooltip>
              
              <Text fontSize={detailsFontSize} color="gray.500" fontWeight="medium" mt={2}>Ports</Text>
              <Box maxH="45px" overflowY="auto" pr={1} className="custom-scrollbar">
                {portLinks && portLinks.length > 0 ? (
                  portLinks.map((portInfo, idx) => (
                    <Box key={idx} mb={0}>
                     <Tooltip label={portInfo.displayText} placement="top" openDelay={300}>
                        <span> {/* Tooltip needs a DOM element child if Link is conditionally rendered or complex */}
                          {portInfo.hostPort ? (
                            <Link
                              href={portInfo.url}
                              color="teal.500"
                              isExternal
                              display="inline-flex"
                              alignItems="center"
                              fontSize={detailsFontSize}
                              noOfLines={1} // Truncate individual port lines
                            >
                              {portInfo.displayText}
                              <ExternalLinkIcon mx="2px" boxSize="0.7em" />
                            </Link>
                          ) : (
                            <Text fontSize={detailsFontSize} noOfLines={1}>{portInfo.displayText}</Text>
                          )}
                        </span>
                      </Tooltip>
                    </Box>
                  ))
                ) : (
                  <Text fontSize={detailsFontSize}>N/A</Text>
                )}
              </Box>
            </VStack>

            <VStack align="stretch" spacing={1} minH="70px"> {/* Ensure min height for this column */}
              <Text fontSize={detailsFontSize} color="gray.500" fontWeight="medium">Created</Text>
              <Text fontSize={detailsFontSize}>{formatCreatedAt(container.CreatedAt || (container.Created && new Date(container.Created * 1000).toISOString()))}</Text>
              
              <Text fontSize={detailsFontSize} color="gray.500" fontWeight="medium" mt={2}>Network</Text>
              {/* The parent Box for MenuButton already has w="full" from previous edit, 
                  which is good. We rely on MenuButton's own maxW for consistent sizing. */}
              {renderNetworkMenu(container)}
            </VStack>
          </Grid>
        </VStack>
          
        {/* Bottom Row: Actions */}
        <Flex justify="center" mt={3} pt={2} borderTopWidth="1px" borderColor="gray.100">
          <ButtonGroup size="xs" spacing={1} variant="ghost">
            <Tooltip label="View logs" hasArrow>
              <IconButton
                aria-label="View logs"
                icon={<FaFileAlt />}
                colorScheme="blue"
                onClick={() => handleViewLogs(containerId, containerName)}
                isDisabled={actionLoading}
                size="xs"
              />
            </Tooltip>
            <Tooltip label="View stats" hasArrow>
              <IconButton
                aria-label="View stats"
                icon={<FaChartLine />}
                colorScheme="purple"
                onClick={() => handleViewStats(containerId, containerName)}
                isDisabled={actionLoading}
                size="xs"
              />
            </Tooltip>
            {isRunning && (
              <>
                <Tooltip label="Stop container" hasArrow>
                  <IconButton
                    aria-label="Stop container"
                    icon={<FaStop />}
                    colorScheme="yellow"
                    onClick={() => handleStopContainer(containerId, containerName)}
                    isDisabled={actionLoading}
                    size="xs"
                  />
                </Tooltip>
                <Tooltip label="Kill container" hasArrow>
                  <IconButton
                    aria-label="Kill container"
                    icon={<FaSkull />}
                    colorScheme="red"
                    onClick={() => handleKillContainer(containerId, containerName)}
                    isDisabled={actionLoading}
                    size="xs"
                  />
                </Tooltip>
              </>
            )}
            <Tooltip label="Restart container" hasArrow>
              <IconButton
                aria-label="Restart container"
                icon={<RepeatIcon />}
                colorScheme="green"
                onClick={() => handleRestartContainer(containerId, containerName)}
                isDisabled={actionLoading}
                size="xs"
              />
            </Tooltip>
          </ButtonGroup>
        </Flex>
      </Box>
    );
  };

  return (
    <Box borderWidth="1px" borderRadius="lg" p={3} bg="gray.50" minH="100vh">
      <Heading size="lg" mb={4} color="gray.700">Docker Containers</Heading>
      {isLoading && (!dockerData || dockerData.length === 0) && (
         <Flex justifyContent="center" alignItems="center" minH="200px">
          <Spinner size="xl" color="teal.500"/>
        </Flex>
      )}

      {!isLoading && !error && dockerData && dockerData.length === 0 && (
        <Text color="gray.600">No running Docker containers found.</Text>
      )}

      {!isLoading && dockerData && dockerData.length > 0 && (
        <SimpleGrid columns={{ base: 1, md: 2, lg: 3, xl:3, "2xl": 4 }} spacing={4}>
          {dockerData.map((container) => (
            <WrapItem key={container.ID || container.Id} w="100%">
              {renderContainerCard(container)}
            </WrapItem>
          ))}
        </SimpleGrid>
      )}

      {/* Container Logs Modal */}
      <Modal isOpen={isLogsOpen} onClose={onLogsClose} size="xl" scrollBehavior="inside">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>
            <Flex alignItems="center">
              <Text>Container Logs: {activeContainer?.name}</Text>
              <Spacer />
              <Select 
                size="xs" 
                width="100px" 
                value={logLines} 
                onChange={(e) => setLogLines(Number(e.target.value))}
                marginRight={2}
              >
                <option value="50">50 lines</option>
                <option value="100">100 lines</option>
                <option value="500">500 lines</option>
                <option value="1000">1000 lines</option>
              </Select>
              <IconButton
                size="xs"
                icon={<RepeatIcon />}
                colorScheme="teal"
                onClick={refreshLogs}
                isLoading={logsLoading}
                aria-label="Refresh logs"
              />
            </Flex>
          </ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            {logsLoading ? (
              <Box display="flex" justifyContent="center" my={8}>
                <Spinner size="xl" />
              </Box>
            ) : (
              <>
                {containerLogs.error && (
                  <Box mb={4} p={3} bg="red.100" color="red.800" borderRadius="md">
                    <Heading size="sm" mb={1}>Error Output:</Heading>
                    <Code display="block" whiteSpace="pre-wrap" overflowX="auto" p={2} borderRadius="md">
                      {containerLogs.error}
                    </Code>
                  </Box>
                )}
                
                {containerLogs.logs ? (
                  <Box p={1} borderWidth="1px" borderRadius="md" bg="gray.50">
                    <Code display="block" whiteSpace="pre-wrap" overflowX="auto" p={2} borderRadius="md" fontSize="xs">
                      {containerLogs.logs}
                    </Code>
                  </Box>
                ) : !containerLogs.error && !logsLoading ? (
                  <Text>No logs available for this container.</Text>
                ) : null}
              </>
            )}
          </ModalBody>
          <ModalFooter>
            <Button colorScheme="blue" mr={3} onClick={onLogsClose}>
              Close
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Container Stats Modal */}
      <Modal isOpen={isStatsOpen} onClose={handleStatsClose} size="xl">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>
            <Flex alignItems="center">
              <Text>Container Stats: {activeContainer?.name}</Text>
              <Spacer />
              <IconButton
                size="xs"
                icon={<RepeatIcon />}
                colorScheme="teal"
                onClick={refreshStats}
                isLoading={statsLoading}
                aria-label="Refresh stats"
              />
            </Flex>
          </ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            {statsLoading && !containerStats ? (
              <Box display="flex" justifyContent="center" my={8}>
                <Spinner size="xl" />
              </Box>
            ) : containerStats ? (
              <>
                <Text fontSize="xs" color="gray.500" mb={4}>
                  Auto-refreshes every 3 seconds. Last updated: {new Date().toLocaleTimeString()}
                </Text>
                
                <StatGroup mb={6}>
                  <Stat>
                    <StatLabel>CPU Usage</StatLabel>
                    <StatNumber>{containerStats.CPUPerc || '0%'}</StatNumber>
                    <Progress 
                      value={parseFloat(containerStats.CPUPerc?.replace('%', '') || 0)} 
                      max={100} 
                      colorScheme="blue" 
                      size="sm"
                      mt={2}
                    />
                  </Stat>
                </StatGroup>
                
                <StatGroup mb={6}>
                  <Stat>
                    <StatLabel>Memory Usage</StatLabel>
                    <StatNumber>{containerStats.MemUsage?.split('/')[0] || '0'}</StatNumber>
                    <StatHelpText>
                      of {containerStats.MemUsage?.split('/')[1] || '0'} 
                      ({containerStats.MemPerc || '0%'})
                    </StatHelpText>
                    <Progress 
                      value={parseFloat(containerStats.MemPerc?.replace('%', '') || 0)} 
                      max={100} 
                      colorScheme="green" 
                      size="sm"
                    />
                  </Stat>
                </StatGroup>
                
                <Divider my={4} />
                
                <Heading size="sm" mb={3}>Network I/O</Heading>
                <StatGroup mb={6}>
                  <Stat>
                    <StatLabel>Network In</StatLabel>
                    <StatNumber>{containerStats.NetIO?.split('/')[0] || '0'}</StatNumber>
                  </Stat>
                  <Stat>
                    <StatLabel>Network Out</StatLabel>
                    <StatNumber>{containerStats.NetIO?.split('/')[1] || '0'}</StatNumber>
                  </Stat>
                </StatGroup>
                
                <Heading size="sm" mb={3}>Block I/O</Heading>
                <StatGroup mb={6}>
                  <Stat>
                    <StatLabel>Block In</StatLabel>
                    <StatNumber>{containerStats.BlockIO?.split('/')[0] || '0'}</StatNumber>
                  </Stat>
                  <Stat>
                    <StatLabel>Block Out</StatLabel>
                    <StatNumber>{containerStats.BlockIO?.split('/')[1] || '0'}</StatNumber>
                  </Stat>
                </StatGroup>
                
                <Heading size="sm" mb={3}>PIDs</Heading>
                <Box mb={4}>
                  <Badge colorScheme="blue" px={2} py={1} borderRadius="md">{containerStats.PIDs}</Badge>
                </Box>
              </>
            ) : (
              <Text>No stats available for this container.</Text>
            )}
          </ModalBody>
          <ModalFooter>
            <Button colorScheme="blue" mr={3} onClick={handleStatsClose}>
              Close
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  );
};

export default DockerContainersView; 