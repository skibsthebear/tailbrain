import React, { useEffect, useMemo, useState } from 'react';
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
  Tooltip, 
  VStack, 
  Divider,
  Button,
  IconButton,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  FormControl,
  FormLabel,
  Input,
  FormHelperText,
  useDisclosure,
  useToast,
  HStack,
  AlertDialog,
  AlertDialogBody,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogContent,
  AlertDialogOverlay,
} from '@chakra-ui/react';
import { AddIcon, DeleteIcon } from '@chakra-ui/icons';
import { useAppContext } from '../context/AppContext';
import { addServePort, removeServePort } from '../api';

const ServePortsView = () => {
  const { serveData, isLoading, loadAllData } = useAppContext();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const toast = useToast();
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [portToRemove, setPortToRemove] = useState(null);
  const [showRemoveDialog, setShowRemoveDialog] = useState(false);
  const cancelRef = React.useRef();

  // Form state
  const [newPort, setNewPort] = useState('');
  const [newLocalUrl, setNewLocalUrl] = useState('');
  
  // Debug log when serveData changes
  useEffect(() => {
    console.log("ServePortsView received data:", serveData);
  }, [serveData]);
  
  // Group entries by actual port numbers extracted from details
  const groupedData = useMemo(() => {
    if (!serveData || !serveData.length) return [];
    
    // Extract actual port from the tcp:// URLs (the last number in the URL)
    const getActualPort = (detail) => {
      if (!detail) return null;
      const match = detail.match(/tcp:\/\/.*?:(\d+)$/);
      return match ? match[1] : null;
    };
    
    // Group entries by actual port
    const portGroups = {};
    
    serveData.forEach(item => {
      const actualPort = getActualPort(item.details || item.rawLine);
      if (!actualPort) return;
      
      if (!portGroups[actualPort]) {
        portGroups[actualPort] = {
          port: actualPort,
          service: item.service,
          statusText: item.statusText,
          active: item.active,
          addresses: []
        };
      }
      
      // Add this address to the group
      portGroups[actualPort].addresses.push(item.details || item.rawLine);
    });
    
    return Object.values(portGroups);
  }, [serveData]);

  const getStatusBadge = (statusText, active) => {
    let colorScheme = "gray";
    if (statusText && statusText.toLowerCase().includes("funnel on")) colorScheme = "green";
    else if (statusText && statusText.toLowerCase().includes("funnel off")) colorScheme = "yellow";
    else if (active) colorScheme = "blue"; // Generic "active" if no funnel info
  
    return <Badge colorScheme={colorScheme}>{statusText || (active ? 'Active' : 'Unknown')}</Badge>;
  };
  
  // Handle adding a new serve port
  const handleAddPort = async () => {
    if (!newPort || !newLocalUrl) {
      toast({
        title: "Missing information",
        description: "Both port and local URL are required",
        status: "error",
        duration: 3000,
        isClosable: true,
      });
      return;
    }
    
    try {
      setIsSubmitting(true);
      await addServePort(newPort, "Custom Service", newLocalUrl);
      await loadAllData();
      
      toast({
        title: "Port added",
        description: `Port ${newPort} is now being served`,
        status: "success",
        duration: 3000,
        isClosable: true,
      });
      
      // Reset form and close modal
      setNewPort('');
      setNewLocalUrl('');
      onClose();
    } catch (error) {
      toast({
        title: "Error adding port",
        description: error.response?.data?.details || error.message,
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  // Handle removing a serve port
  const handleRemovePort = async () => {
    if (!portToRemove) return;
    
    try {
      setIsSubmitting(true);
      await removeServePort(portToRemove);
      await loadAllData();
      
      toast({
        title: "Port removed",
        description: `Port ${portToRemove} has been removed`,
        status: "success",
        duration: 3000,
        isClosable: true,
      });
    } catch (error) {
      toast({
        title: "Error removing port",
        description: error.response?.data?.details || error.message,
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsSubmitting(false);
      setShowRemoveDialog(false);
      setPortToRemove(null);
    }
  };
  
  // Open the confirmation dialog for removing a port
  const confirmRemovePort = (port) => {
    setPortToRemove(port);
    setShowRemoveDialog(true);
  };

  return (
    <Box borderWidth="1px" borderRadius="lg" p={4}>
      <HStack justifyContent="space-between" alignItems="center" mb={4}>
        <Heading size="md">Tailscale Serve Ports</Heading>
        <Button 
          leftIcon={<AddIcon />} 
          colorScheme="teal" 
          size="sm"
          onClick={onOpen}
        >
          Add Port
        </Button>
      </HStack>
      
      {isLoading && (!serveData || serveData.length === 0) && (
        <Box display="flex" justifyContent="center" my={8}>
          <Spinner size="xl" />
        </Box>
      )}

      {!isLoading && groupedData.length === 0 && (
        <Text>No Tailscale serve configurations found.</Text>
      )}
      
      {!isLoading && groupedData.length > 0 && (
        <TableContainer overflowX="auto">
          <Table variant="simple" size="sm">
            <Thead>
              <Tr>
                <Th>Port</Th>
                <Th>Service/Source</Th>
                <Th>Status</Th>
                <Th>Addresses</Th>
                <Th width="50px">Actions</Th>
              </Tr>
            </Thead>
            <Tbody>
              {groupedData.map((item, index) => (
                <Tr key={`port-${item.port}-${index}`}>
                  <Td>{item.port}</Td>
                  <Td>{item.service}</Td>
                  <Td>{getStatusBadge(item.statusText, item.active)}</Td>
                  <Td>
                    <VStack align="start" spacing={1} divider={<Divider />}>
                      {item.addresses.map((address, i) => (
                        <Tooltip key={i} label={address} placement="top">
                          <Text 
                            fontSize="sm" 
                            noOfLines={1} 
                            maxWidth="350px" 
                            overflow="hidden" 
                            textOverflow="ellipsis"
                            whiteSpace="nowrap"
                          >
                            {address}
                          </Text>
                        </Tooltip>
                      ))}
                    </VStack>
                  </Td>
                  <Td>
                    <IconButton
                      icon={<DeleteIcon />}
                      aria-label="Remove port"
                      size="sm"
                      colorScheme="red"
                      variant="ghost"
                      onClick={() => confirmRemovePort(item.port)}
                    />
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </TableContainer>
      )}
      
      {/* Add Port Modal */}
      <Modal isOpen={isOpen} onClose={onClose}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Add Tailscale Serve Port</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <FormControl isRequired mb={4}>
              <FormLabel>Port to expose</FormLabel>
              <Input 
                placeholder="80" 
                value={newPort} 
                onChange={(e) => setNewPort(e.target.value)}
              />
              <FormHelperText>The port that will be accessible through Tailscale</FormHelperText>
            </FormControl>
            
            <FormControl isRequired>
              <FormLabel>Local URL</FormLabel>
              <Input 
                placeholder="http://localhost:8080" 
                value={newLocalUrl} 
                onChange={(e) => setNewLocalUrl(e.target.value)}
              />
              <FormHelperText>The local service to forward to (e.g., http://localhost:8080)</FormHelperText>
            </FormControl>
          </ModalBody>

          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={onClose}>
              Cancel
            </Button>
            <Button 
              colorScheme="teal" 
              onClick={handleAddPort}
              isLoading={isSubmitting}
              loadingText="Adding..."
            >
              Add Port
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
      
      {/* Remove Port Confirmation Dialog */}
      <AlertDialog
        isOpen={showRemoveDialog}
        leastDestructiveRef={cancelRef}
        onClose={() => setShowRemoveDialog(false)}
      >
        <AlertDialogOverlay>
          <AlertDialogContent>
            <AlertDialogHeader fontSize="lg" fontWeight="bold">
              Remove Port
            </AlertDialogHeader>

            <AlertDialogBody>
              Are you sure you want to remove port {portToRemove}? This will stop serving this port through Tailscale.
            </AlertDialogBody>

            <AlertDialogFooter>
              <Button ref={cancelRef} onClick={() => setShowRemoveDialog(false)}>
                Cancel
              </Button>
              <Button 
                colorScheme="red" 
                onClick={handleRemovePort} 
                ml={3}
                isLoading={isSubmitting}
                loadingText="Removing..."
              >
                Remove
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>
    </Box>
  );
};

export default ServePortsView; 