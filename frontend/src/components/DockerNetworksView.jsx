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
  Badge,
  Button,
  Flex,
  IconButton,
  useDisclosure,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalCloseButton,
  ModalFooter,
  FormControl,
  FormLabel,
  Input,
  Select,
  useToast,
  Tag,
  Tooltip,
  Divider,
  HStack,
  VStack,
  List,
  ListItem,
} from '@chakra-ui/react';
import { AddIcon, DeleteIcon, RepeatIcon } from '@chakra-ui/icons';
import { useAppContext } from '../context/AppContext';
import {
  listDockerNetworks,
  getDockerNetworkDetails,
  createDockerNetwork,
  removeDockerNetwork,
} from '../api';

const DockerNetworksView = () => {
  const { networkData, isLoading, error, loadAllData } = useAppContext();
  const [selectedNetwork, setSelectedNetwork] = useState(null);
  const [networkDetails, setNetworkDetails] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  
  // New network form state
  const [newNetworkName, setNewNetworkName] = useState('');
  const [newNetworkDriver, setNewNetworkDriver] = useState('bridge');
  
  const { 
    isOpen: isDetailsOpen, 
    onOpen: onDetailsOpen, 
    onClose: onDetailsClose 
  } = useDisclosure();
  
  const { 
    isOpen: isCreateOpen, 
    onOpen: onCreateOpen, 
    onClose: onCreateClose 
  } = useDisclosure();
  
  const toast = useToast();

  // Function to view network details
  const handleViewNetworkDetails = async (networkId, networkName) => {
    setSelectedNetwork({ id: networkId, name: networkName });
    setDetailsLoading(true);
    setNetworkDetails(null);
    onDetailsOpen();
    
    try {
      const details = await getDockerNetworkDetails(networkId);
      setNetworkDetails(details);
    } catch (error) {
      toast({
        title: "Error fetching network details",
        description: error.message,
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setDetailsLoading(false);
    }
  };

  // Function to create a new network
  const handleCreateNetwork = async () => {
    if (!newNetworkName.trim()) {
      toast({
        title: "Network name is required",
        status: "error",
        duration: 3000,
        isClosable: true,
      });
      return;
    }
    
    setActionLoading(true);
    try {
      await createDockerNetwork(newNetworkName.trim(), newNetworkDriver);
      toast({
        title: "Network created",
        description: `Network "${newNetworkName}" has been created`,
        status: "success",
        duration: 3000,
        isClosable: true,
      });
      onCreateClose();
      setNewNetworkName('');
      setNewNetworkDriver('bridge');
      loadAllData(); // Refresh the networks list
    } catch (error) {
      toast({
        title: "Failed to create network",
        description: error.message,
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setActionLoading(false);
    }
  };

  // Function to delete a network
  const handleDeleteNetwork = async (networkId, networkName) => {
    setActionLoading(true);
    try {
      await removeDockerNetwork(networkId);
      toast({
        title: "Network deleted",
        description: `Network "${networkName}" has been deleted`,
        status: "success",
        duration: 3000,
        isClosable: true,
      });
      loadAllData(); // Refresh the networks list
    } catch (error) {
      toast({
        title: "Failed to delete network",
        description: error.message,
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setActionLoading(false);
    }
  };

  // Helper to get network driver badge color
  const getDriverBadgeColor = (driver) => {
    switch (driver.toLowerCase()) {
      case 'bridge':
        return 'blue';
      case 'host':
        return 'green';
      case 'overlay':
        return 'purple';
      case 'ipvlan':
        return 'orange';
      case 'macvlan':
        return 'teal';
      case 'none':
        return 'gray';
      default:
        return 'gray';
    }
  };

  return (
    <Box borderWidth="1px" borderRadius="lg" p={4}>
      <Flex justify="space-between" align="center" mb={4}>
        <Heading size="md">Docker Networks</Heading>
        <HStack>
          <Button 
            leftIcon={<AddIcon />} 
            colorScheme="teal" 
            size="sm"
            onClick={onCreateOpen}
            isDisabled={actionLoading}
          >
            Create Network
          </Button>
          <Tooltip label="Refresh networks">
            <IconButton
              aria-label="Refresh networks"
              icon={<RepeatIcon />}
              colorScheme="blue"
              size="sm"
              onClick={loadAllData}
              isLoading={isLoading}
            />
          </Tooltip>
        </HStack>
      </Flex>

      {isLoading && (!networkData || networkData.length === 0) && (
        <Box display="flex" justifyContent="center" my={8}>
          <Spinner size="xl" />
        </Box>
      )}

      {!isLoading && !error && networkData && networkData.length === 0 && (
        <Text>No Docker networks found.</Text>
      )}

      {!isLoading && networkData && networkData.length > 0 && (
        <TableContainer overflowX="auto">
          <Table variant="simple" size="sm">
            <Thead>
              <Tr>
                <Th>ID</Th>
                <Th>Name</Th>
                <Th>Driver</Th>
                <Th>Scope</Th>
                <Th>Created</Th>
                <Th>Actions</Th>
              </Tr>
            </Thead>
            <Tbody>
              {networkData.map((network) => {
                // Format the network ID to be shorter
                const shortId = network.ID ? network.ID.substring(0, 12) : 'N/A';
                
                // Default driver is bridge if not specified
                const driver = network.Driver || 'bridge';
                
                return (
                  <Tr key={network.ID}>
                    <Td fontFamily="monospace" isTruncated>{shortId}</Td>
                    <Td>{network.Name}</Td>
                    <Td>
                      <Badge colorScheme={getDriverBadgeColor(driver)}>
                        {driver}
                      </Badge>
                    </Td>
                    <Td>{network.Scope || 'local'}</Td>
                    <Td>{network.Created ? new Date(network.Created).toLocaleString() : 'N/A'}</Td>
                    <Td>
                      <Flex gap={2}>
                        <Tooltip label="View network details">
                          <Button 
                            size="xs" 
                            colorScheme="blue"
                            onClick={() => handleViewNetworkDetails(network.ID, network.Name)}
                            isDisabled={actionLoading}
                          >
                            Details
                          </Button>
                        </Tooltip>
                        <Tooltip label="Delete network">
                          <IconButton
                            aria-label="Delete network"
                            icon={<DeleteIcon />}
                            colorScheme="red"
                            size="xs"
                            onClick={() => handleDeleteNetwork(network.ID, network.Name)}
                            isDisabled={actionLoading || ['bridge', 'host', 'none'].includes(driver)}
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

      {/* Network Details Modal */}
      <Modal isOpen={isDetailsOpen} onClose={onDetailsClose} size="xl">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Network Details: {selectedNetwork?.name}</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            {detailsLoading ? (
              <Box display="flex" justifyContent="center" my={8}>
                <Spinner size="xl" />
              </Box>
            ) : networkDetails ? (
              <VStack align="stretch" spacing={4}>
                <Box>
                  <Heading size="sm" mb={2}>Basic Information</Heading>
                  <Flex flexWrap="wrap" gap={2}>
                    <Tag colorScheme="blue">ID: {networkDetails[0]?.Id?.substring(0, 12)}</Tag>
                    <Tag colorScheme="green">Driver: {networkDetails[0]?.Driver}</Tag>
                    <Tag colorScheme="purple">Scope: {networkDetails[0]?.Scope}</Tag>
                    <Tag colorScheme="orange">Internal: {networkDetails[0]?.Internal ? 'Yes' : 'No'}</Tag>
                  </Flex>
                </Box>
                
                <Divider />
                
                <Box>
                  <Heading size="sm" mb={2}>IPAM Configuration</Heading>
                  <Text>Driver: {networkDetails[0]?.IPAM?.Driver || 'default'}</Text>
                  {networkDetails[0]?.IPAM?.Config && networkDetails[0].IPAM.Config.length > 0 && (
                    <Box mt={2}>
                      <Text fontWeight="bold">Subnets:</Text>
                      <List styleType="disc" pl={5} mt={1}>
                        {networkDetails[0].IPAM.Config.map((config, idx) => (
                          <ListItem key={idx}>
                            {config.Subnet} {config.Gateway ? `(Gateway: ${config.Gateway})` : ''}
                          </ListItem>
                        ))}
                      </List>
                    </Box>
                  )}
                </Box>
                
                <Divider />
                
                <Box>
                  <Heading size="sm" mb={2}>Connected Containers</Heading>
                  {networkDetails[0]?.Containers && Object.keys(networkDetails[0].Containers).length > 0 ? (
                    <TableContainer>
                      <Table size="sm" variant="simple">
                        <Thead>
                          <Tr>
                            <Th>Name</Th>
                            <Th>IPv4 Address</Th>
                            <Th>MAC Address</Th>
                          </Tr>
                        </Thead>
                        <Tbody>
                          {Object.entries(networkDetails[0].Containers).map(([id, container]) => (
                            <Tr key={id}>
                              <Td>{container.Name}</Td>
                              <Td fontFamily="monospace">{container.IPv4Address}</Td>
                              <Td fontFamily="monospace">{container.MacAddress}</Td>
                            </Tr>
                          ))}
                        </Tbody>
                      </Table>
                    </TableContainer>
                  ) : (
                    <Text>No containers connected to this network</Text>
                  )}
                </Box>
              </VStack>
            ) : (
              <Text>No details available for this network.</Text>
            )}
          </ModalBody>
          <ModalFooter>
            <Button colorScheme="blue" mr={3} onClick={onDetailsClose}>
              Close
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Create Network Modal */}
      <Modal isOpen={isCreateOpen} onClose={onCreateClose}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Create New Network</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <FormControl id="networkName" isRequired mb={4}>
              <FormLabel>Network Name</FormLabel>
              <Input 
                value={newNetworkName} 
                onChange={(e) => setNewNetworkName(e.target.value)}
                placeholder="e.g., my-network"
              />
            </FormControl>
            
            <FormControl id="networkDriver" mb={4}>
              <FormLabel>Driver</FormLabel>
              <Select 
                value={newNetworkDriver} 
                onChange={(e) => setNewNetworkDriver(e.target.value)}
              >
                <option value="bridge">bridge</option>
                <option value="overlay">overlay</option>
                <option value="host">host</option>
                <option value="ipvlan">ipvlan</option>
                <option value="macvlan">macvlan</option>
                <option value="none">none</option>
              </Select>
            </FormControl>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={onCreateClose}>
              Cancel
            </Button>
            <Button 
              colorScheme="blue" 
              onClick={handleCreateNetwork} 
              isLoading={actionLoading}
            >
              Create
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  );
};

export default DockerNetworksView; 