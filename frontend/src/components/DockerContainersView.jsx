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
  Badge
} from '@chakra-ui/react';
import { ExternalLinkIcon, RepeatIcon } from '@chakra-ui/icons';
import { FaStop, FaSkull, FaPlay, FaFileAlt, FaChartLine } from 'react-icons/fa';
import { useAppContext } from '../context/AppContext';
import { stopDockerContainer, killDockerContainer, restartDockerContainer, getDockerContainerLogs, getDockerContainerStats } from '../api';

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
const shortenId = (id) => id ? String(id).substring(0, 12) : 'N/A';

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
  
  const { isOpen: isLogsOpen, onOpen: onLogsOpen, onClose: onLogsClose } = useDisclosure();
  const { 
    isOpen: isStatsOpen, 
    onOpen: onStatsOpen, 
    onClose: onStatsClose 
  } = useDisclosure();
  const toast = useToast();

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
    if (!status) return <Tag>Unknown</Tag>;
    const s = String(status).toLowerCase();
    if (s.startsWith('up') || s.includes('running')) return <Tag colorScheme="green">{status}</Tag>;
    if (s.startsWith('exited') || s.includes('stopped')) return <Tag colorScheme="red">{status}</Tag>;
    return <Tag colorScheme="gray">{status}</Tag>;
  };

  return (
    <Box borderWidth="1px" borderRadius="lg" p={4}>
      <Heading size="md" mb={4}>Docker Containers</Heading>
      {isLoading && (!dockerData || dockerData.length === 0) && (
         <Box display="flex" justifyContent="center" my={8}>
          <Spinner size="xl" />
        </Box>
      )}

      {!isLoading && !error && dockerData && dockerData.length === 0 && (
        <Text>No running Docker containers found.</Text>
      )}

      {!isLoading && dockerData && dockerData.length > 0 && (
        <TableContainer overflowX="auto">
          <Table variant="simple" size="sm" layout="fixed">
            <Thead>
              <Tr>
                <Th width="10%">ID</Th>
                <Th width="15%">Name</Th>
                <Th width="20%">Image</Th>
                <Th width="15%">Status</Th>
                <Th width="20%">Ports</Th>
                <Th width="10%">Created</Th>
                <Th width="10%" textAlign="center">Actions</Th>
              </Tr>
            </Thead>
            <Tbody>
              {dockerData.map((container) => {
                const containerName = container.Names || 
                  (container.Name && container.Name.startsWith('/') ? container.Name.substring(1) : container.Name) || 
                  'N/A';
                  
                const portLinks = parsePortsToLinks(container.Ports);
                
                // Try to determine if container has a web UI by checking for HTTP ports
                const hasWebUI = portLinks && portLinks.some(p => p.hostPort !== null);
                
                // Generate clickable name based on first available web port
                const nameLink = hasWebUI ? 
                  portLinks.find(p => p.hostPort !== null)?.url : 
                  null;
                
                // Check if container is running
                const containerStatus = container.Status || (container.State && container.State.Status) || '';
                const isRunning = containerStatus.toLowerCase().includes('up') || 
                                 containerStatus.toLowerCase().includes('running');
                
                return (
                  <Tr key={container.ID || container.Id}>
                    <Td fontFamily="monospace" isTruncated>{shortenId(container.ID || container.Id)}</Td>
                    <Td isTruncated>
                      {nameLink ? (
                        <Tooltip label={`Open ${containerName} in browser`}>
                          <Link 
                            href={nameLink} 
                            color="teal.500" 
                            isExternal
                            display="inline-flex"
                            alignItems="center"
                          >
                            {containerName}
                            <ExternalLinkIcon mx="2px" />
                          </Link>
                        </Tooltip>
                      ) : (
                        containerName
                      )}
                    </Td>
                    <Td isTruncated>{container.Image}</Td>
                    <Td>{getStatusTag(containerStatus)}</Td>
                    <Td>
                      {portLinks && portLinks.length > 0 ? (
                        <Box>
                          {portLinks.map((portInfo, idx) => (
                            <Box key={idx} mb={1}>
                              {portInfo.hostPort ? (
                                <Link
                                  href={portInfo.url}
                                  color="teal.500"
                                  isExternal
                                  display="inline-flex"
                                  alignItems="center"
                                >
                                  {portInfo.displayText}
                                  <ExternalLinkIcon mx="2px" />
                                </Link>
                              ) : (
                                <Text>{portInfo.displayText}</Text>
                              )}
                            </Box>
                          ))}
                        </Box>
                      ) : (
                        <Text>N/A</Text>
                      )}
                    </Td>
                    <Td isTruncated>{formatCreatedAt(container.CreatedAt || (container.Created && new Date(container.Created * 1000).toISOString() ))}</Td>
                    <Td textAlign="center">
                      <Flex 
                        justifyContent="center" 
                        wrap="wrap" 
                        gap={1} 
                        borderWidth="1px" 
                        borderColor="gray.200" 
                        borderRadius="md" 
                        p={1}
                      >
                        <Tooltip label="View logs" hasArrow>
                          <IconButton
                            aria-label="View logs"
                            icon={<FaFileAlt />}
                            colorScheme="blue"
                            onClick={() => handleViewLogs(container.ID || container.Id, containerName)}
                            isDisabled={actionLoading}
                            size="xs"
                          />
                        </Tooltip>
                        <Tooltip label="View stats" hasArrow>
                          <IconButton
                            aria-label="View stats"
                            icon={<FaChartLine />}
                            colorScheme="purple"
                            onClick={() => handleViewStats(container.ID || container.Id, containerName)}
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
                                onClick={() => handleStopContainer(container.ID || container.Id, containerName)}
                                isDisabled={actionLoading}
                                size="xs"
                              />
                            </Tooltip>
                            <Tooltip label="Kill container" hasArrow>
                              <IconButton
                                aria-label="Kill container"
                                icon={<FaSkull />}
                                colorScheme="red"
                                onClick={() => handleKillContainer(container.ID || container.Id, containerName)}
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
                            onClick={() => handleRestartContainer(container.ID || container.Id, containerName)}
                            isDisabled={actionLoading}
                            size="xs"
                          />
                        </Tooltip>
                      </Flex>
                    </Td>
                  </Tr>
                );
              })}
            </Tbody>
          </Table>
        </TableContainer>
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