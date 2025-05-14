import React from 'react';
import { Box, Heading, Text, Table, Thead, Tbody, Tr, Th, Td, TableContainer, Spinner, Tag, Link, Tooltip, HStack, Icon } from '@chakra-ui/react';
import { ExternalLinkIcon } from '@chakra-ui/icons';
import { useAppContext } from '../context/AppContext';

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
  const { dockerData, isLoading, error } = useAppContext();

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
          <Table variant="simple" size="sm">
            <Thead>
              <Tr>
                <Th>ID</Th>
                <Th>Name</Th>
                <Th>Image</Th>
                <Th>Status</Th>
                <Th>Ports</Th>
                <Th>Created</Th>
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
                
                return (
                  <Tr key={container.ID || container.Id}>
                    <Td fontFamily="monospace">{shortenId(container.ID || container.Id)}</Td>
                    <Td>
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
                    <Td>{container.Image}</Td>
                    <Td>{getStatusTag(container.Status || (container.State && container.State.Status))}</Td>
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
                    <Td>{formatCreatedAt(container.CreatedAt || (container.Created && new Date(container.Created * 1000).toISOString() ))}</Td>
                  </Tr>
                );
              })}
            </Tbody>
          </Table>
        </TableContainer>
      )}
      {/* Error display is handled globally */}
    </Box>
  );
};

export default DockerContainersView; 