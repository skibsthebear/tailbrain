import React, { useEffect, useState } from 'react';
import { 
  Box, 
  Heading, 
  Text, 
  List, 
  ListItem, 
  Spinner, 
  useClipboard, 
  Button, 
  HStack, 
  Tag,
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
  Select,
  useDisclosure,
  useToast,
  AlertDialog,
  AlertDialogBody,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogContent,
  AlertDialogOverlay,
  Code
} from '@chakra-ui/react';
import { CheckCircleIcon, LinkIcon, AddIcon, DeleteIcon } from '@chakra-ui/icons';
import { useAppContext } from '../context/AppContext';
import { addFunnelPort, removeFunnelPort } from '../api';

const FunnelPortsView = () => {
  const { funnelData, isLoading, loadAllData } = useAppContext();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const toast = useToast();
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [portToRemove, setPortToRemove] = useState(null);
  const [protocolToRemove, setProtocolToRemove] = useState(null);
  const [showRemoveDialog, setShowRemoveDialog] = useState(false);
  const cancelRef = React.useRef();

  // Form state
  const [newPort, setNewPort] = useState('');
  const [newProtocol, setNewProtocol] = useState('tcp');
  
  // Debug log when funnelData changes
  useEffect(() => {
    console.log("FunnelPortsView received data:", funnelData);
  }, [funnelData]);

  const FunnelEntry = ({ protocol, port, url }) => {
    // Ensure url is a string - otherwise stringify it for display
    const urlStr = typeof url === 'string' ? url : JSON.stringify(url);
    const { hasCopied, onCopy } = useClipboard(urlStr);
    
    return (
      <ListItem display="flex" justifyContent="space-between" alignItems="center" py={1}>
        <HStack flex="1">
          <Tag size="sm" colorScheme="blue">{protocol}</Tag>
          <Text>Port {port}: {urlStr}</Text>
        </HStack>
        <HStack>
          <Button size="sm" onClick={onCopy} leftIcon={hasCopied ? <CheckCircleIcon /> : <LinkIcon />}>
            {hasCopied ? 'Copied!' : 'Copy URL'}
          </Button>
          <IconButton
            icon={<DeleteIcon />}
            aria-label="Remove funnel"
            size="sm"
            colorScheme="red"
            variant="ghost"
            onClick={() => confirmRemovePort(port, protocol)}
          />
        </HStack>
      </ListItem>
    );
  };

  const renderFunnelEntries = () => {
    const entries = [];
    
    // Helper function to safely process entries
    const processEntries = (protocol, data) => {
      if (!data || typeof data !== 'object') return;
      
      Object.entries(data).forEach(([port, url]) => {
        // Skip if url is null or undefined
        if (url === null || url === undefined) return;
        
        entries.push(
          <FunnelEntry 
            key={`${protocol}-${port}`} 
            protocol={protocol} 
            port={port} 
            url={url} 
          />
        );
      });
    };
    
    // Process standard TCP/HTTP entries
    if (funnelData.TCP) processEntries('TCP', funnelData.TCP);
    if (funnelData.HTTP) processEntries('HTTP', funnelData.HTTP);
    
    // Process TCPForward if present (possible in actual tailscale output)
    if (funnelData.TCPForward) processEntries('TCPForward', funnelData.TCPForward);
    
    // Handle other possible root-level keys
    Object.keys(funnelData)
      .filter(key => !['TCP', 'HTTP', 'TCPForward'].includes(key))
      .forEach(key => {
        if (typeof funnelData[key] === 'object' && funnelData[key] !== null) {
          processEntries(key, funnelData[key]);
        }
      });

    if (entries.length === 0 && !isLoading) {
      // If no entries but data exists, show the raw structure for debugging
      if (Object.keys(funnelData || {}).length > 0) {
        return (
          <Box>
            <Text mb={2}>No recognizable Tailscale funnel configurations found. Raw data structure:</Text>
            <Code p={2} fontSize="xs" whiteSpace="pre-wrap" overflowX="auto" maxHeight="200px" overflowY="auto">
              {JSON.stringify(funnelData, null, 2)}
            </Code>
          </Box>
        );
      }
      return <Text>No Tailscale funnel configurations found.</Text>;
    }
    
    return <List spacing={3}>{entries}</List>;
  };
  
  // Handle adding a new funnel port
  const handleAddPort = async () => {
    if (!newPort) {
      toast({
        title: "Missing information",
        description: "Port is required",
        status: "error",
        duration: 3000,
        isClosable: true,
      });
      return;
    }
    
    try {
      setIsSubmitting(true);
      await addFunnelPort(newPort, newProtocol);
      await loadAllData();
      
      toast({
        title: "Port funneled",
        description: `Port ${newPort} is now being funneled with protocol ${newProtocol}`,
        status: "success",
        duration: 3000,
        isClosable: true,
      });
      
      // Reset form and close modal
      setNewPort('');
      setNewProtocol('tcp');
      onClose();
    } catch (error) {
      toast({
        title: "Error adding funnel",
        description: error.response?.data?.details || error.message,
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  // Handle removing a funnel port
  const handleRemovePort = async () => {
    if (!portToRemove) return;
    
    try {
      setIsSubmitting(true);
      await removeFunnelPort(portToRemove, protocolToRemove);
      await loadAllData();
      
      toast({
        title: "Funnel removed",
        description: `Port ${portToRemove} is no longer being funneled`,
        status: "success",
        duration: 3000,
        isClosable: true,
      });
    } catch (error) {
      toast({
        title: "Error removing funnel",
        description: error.response?.data?.details || error.message,
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsSubmitting(false);
      setShowRemoveDialog(false);
      setPortToRemove(null);
      setProtocolToRemove(null);
    }
  };
  
  // Open the confirmation dialog for removing a port
  const confirmRemovePort = (port, protocol) => {
    setPortToRemove(port);
    setProtocolToRemove(protocol);
    setShowRemoveDialog(true);
  };

  return (
    <Box borderWidth="1px" borderRadius="lg" p={4}>
      <HStack justifyContent="space-between" alignItems="center" mb={4}>
        <Heading size="md">Tailscale Funnel Ports</Heading>
        <Button 
          leftIcon={<AddIcon />} 
          colorScheme="teal" 
          size="sm"
          onClick={onOpen}
        >
          Add Funnel
        </Button>
      </HStack>
      
      {isLoading && Object.keys(funnelData || {}).length === 0 && (
        <Box display="flex" justifyContent="center" my={8}>
          <Spinner size="xl" />
        </Box>
      )}
      
      {!isLoading && renderFunnelEntries()}
      
      {/* Add Funnel Modal */}
      <Modal isOpen={isOpen} onClose={onClose}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Add Tailscale Funnel</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <FormControl isRequired mb={4}>
              <FormLabel>Port to expose</FormLabel>
              <Input 
                placeholder="80" 
                value={newPort} 
                onChange={(e) => setNewPort(e.target.value)}
              />
              <FormHelperText>The port that will be accessible through Tailscale Funnel</FormHelperText>
            </FormControl>
            
            <FormControl>
              <FormLabel>Protocol</FormLabel>
              <Select 
                value={newProtocol} 
                onChange={(e) => setNewProtocol(e.target.value)}
              >
                <option value="tcp">TCP</option>
                <option value="http">HTTP</option>
                <option value="https">HTTPS</option>
              </Select>
              <FormHelperText>The protocol to use for this funnel</FormHelperText>
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
              Add Funnel
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
      
      {/* Remove Funnel Confirmation Dialog */}
      <AlertDialog
        isOpen={showRemoveDialog}
        leastDestructiveRef={cancelRef}
        onClose={() => setShowRemoveDialog(false)}
      >
        <AlertDialogOverlay>
          <AlertDialogContent>
            <AlertDialogHeader fontSize="lg" fontWeight="bold">
              Remove Funnel
            </AlertDialogHeader>

            <AlertDialogBody>
              Are you sure you want to remove the {protocolToRemove} funnel for port {portToRemove}? This will stop exposing this port to the public internet.
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

export default FunnelPortsView; 