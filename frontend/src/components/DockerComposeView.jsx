import React, { useState, useCallback } from 'react';
import {
  Box,
  Heading,
  Text,
  Button,
  VStack,
  HStack,
  IconButton,
  Spinner,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  TableContainer,
  useDisclosure,
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
  useToast,
  AlertDialog,
  AlertDialogBody,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogContent,
  AlertDialogOverlay,
  Tooltip,
} from '@chakra-ui/react';
import { AddIcon, DeleteIcon, ArrowUpIcon, ArrowDownIcon } from '@chakra-ui/icons';
import { useAppContext } from '../context/AppContext';
import {
  addDockerComposeApp,
  removeDockerComposeApp,
  dockerComposeUp,
  dockerComposeDown,
} from '../api';

const DockerComposeView = () => {
  const { dockerComposeApps, loadAllData, isLoading: isGlobalLoading } = useAppContext();
  const { isOpen: isAddModalOpen, onOpen: onAddModalOpen, onClose: onAddModalClose } = useDisclosure();
  const { isOpen: isConfirmDeleteOpen, onOpen: onConfirmDeleteOpen, onClose: onConfirmDeleteClose } = useDisclosure();
  
  const [newName, setNewName] = useState('');
  const [newPath, setNewPath] = useState('');
  const [selectedApp, setSelectedApp] = useState(null); // For delete confirmation and actions
  const [isSubmitting, setIsSubmitting] = useState(false);
  const toast = useToast();
  const cancelRef = React.useRef();

  const handleAddApp = async () => {
    if (!newName || !newPath) {
      toast({ title: 'Error', description: 'Name and path are required.', status: 'error', duration: 3000, isClosable: true });
      return;
    }
    if (!newPath.endsWith('.yml') && !newPath.endsWith('.yaml')) {
        toast({ title: 'Error', description: 'Path must be a .yml or .yaml file.', status: 'error', duration: 3000, isClosable: true });
        return;
    }
    setIsSubmitting(true);
    try {
      await addDockerComposeApp(newName, newPath);
      toast({ title: 'Success', description: `Docker Compose app '${newName}' added.`, status: 'success', duration: 3000, isClosable: true });
      setNewName('');
      setNewPath('');
      onAddModalClose();
      loadAllData(); // Refresh the list of apps and potentially container statuses
    } catch (error) {
      toast({ title: 'Error adding app', description: error.message || 'Could not add app.', status: 'error', duration: 5000, isClosable: true });
    }
    setIsSubmitting(false);
  };

  const openDeleteConfirmation = (app) => {
    setSelectedApp(app);
    onConfirmDeleteOpen();
  };

  const handleDeleteApp = async () => {
    if (!selectedApp) return;
    setIsSubmitting(true);
    try {
      await removeDockerComposeApp(selectedApp.id);
      toast({ title: 'Success', description: `'${selectedApp.name}' removed.`, status: 'success', duration: 3000, isClosable: true });
      onConfirmDeleteClose();
      setSelectedApp(null);
      loadAllData();
    } catch (error) {
      toast({ title: 'Error removing app', description: error.message || 'Could not remove app.', status: 'error', duration: 5000, isClosable: true });
    }
    setIsSubmitting(false);
  };

  const handleComposeAction = async (app, action) => {
    setSelectedApp(app); // For loading state on the specific row
    setIsSubmitting(true);
    const actionVerb = action === 'up' ? 'starting' : 'stopping';
    const actionCommand = action === 'up' ? dockerComposeUp : dockerComposeDown;
    try {
      const result = await actionCommand(app.path);
      toast({ title: 'Success', description: `${app.name} ${action} command executed. Output: ${result.message || '-'}`, status: 'success', duration: 5000, isClosable: true });
      loadAllData(); // Refresh everything, especially Docker containers
    } catch (error) {
      toast({ title: `Error ${actionVerb} ${app.name}`, description: error.message || `Could not ${action} app.`, status: 'error', duration: 5000, isClosable: true });
    }
    setIsSubmitting(false);
    setSelectedApp(null);
  };

  return (
    <Box borderWidth="1px" borderRadius="lg" p={4}>
      <HStack justifyContent="space-between" mb={4}>
        <Heading size="md">Docker Compose Applications</Heading>
        <Button leftIcon={<AddIcon />} colorScheme="teal" onClick={onAddModalOpen}>
          Add Compose App
        </Button>
      </HStack>

      {isGlobalLoading && (!dockerComposeApps || dockerComposeApps.length === 0) && (
        <Box display="flex" justifyContent="center" my={8}><Spinner size="xl" /></Box>
      )}

      {!isGlobalLoading && dockerComposeApps && dockerComposeApps.length === 0 && (
        <Text>No Docker Compose applications configured yet. Click "Add Compose App" to get started.</Text>
      )}

      {!isGlobalLoading && dockerComposeApps && dockerComposeApps.length > 0 && (
        <TableContainer>
          <Table variant="simple" size="sm">
            <Thead>
              <Tr>
                <Th>Name</Th>
                <Th>Path to compose file</Th>
                <Th>Actions</Th>
              </Tr>
            </Thead>
            <Tbody>
              {dockerComposeApps.map((app) => (
                <Tr key={app.id}>
                  <Td>{app.name}</Td>
                  <Td fontFamily="monospace">{app.path}</Td>
                  <Td>
                    <HStack spacing={2}>
                      <Tooltip label={`Run docker-compose up -d for ${app.name}`}>
                        <IconButton
                          icon={<ArrowUpIcon />}
                          colorScheme="green"
                          aria-label={`Start ${app.name}`}
                          onClick={() => handleComposeAction(app, 'up')}
                          isLoading={isSubmitting && selectedApp?.id === app.id}
                          size="sm"
                        />
                      </Tooltip>
                      <Tooltip label={`Run docker-compose down for ${app.name}`}>
                        <IconButton
                          icon={<ArrowDownIcon />}
                          colorScheme="orange"
                          aria-label={`Stop ${app.name}`}
                          onClick={() => handleComposeAction(app, 'down')}
                          isLoading={isSubmitting && selectedApp?.id === app.id}
                          size="sm"
                        />
                      </Tooltip>
                      <Tooltip label={`Remove ${app.name} configuration`}>
                        <IconButton
                          icon={<DeleteIcon />}
                          colorScheme="red"
                          aria-label={`Delete ${app.name}`}
                          onClick={() => openDeleteConfirmation(app)}
                          size="sm"
                        />
                      </Tooltip>
                    </HStack>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </TableContainer>
      )}

      {/* Add App Modal */}
      <Modal isOpen={isAddModalOpen} onClose={onAddModalClose}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Add New Docker Compose App</ModalHeader>
          <ModalCloseButton />
          <ModalBody pb={6}>
            <FormControl isRequired>
              <FormLabel>App Name</FormLabel>
              <Input placeholder="My Awesome App" value={newName} onChange={(e) => setNewName(e.target.value)} />
            </FormControl>
            <FormControl mt={4} isRequired>
              <FormLabel>Path to docker-compose.yml</FormLabel>
              <Input placeholder="/path/to/your/docker-compose.yml" value={newPath} onChange={(e) => setNewPath(e.target.value)} />
               <Text fontSize="xs" color="gray.500" mt={1}>Ensure this path is accessible by the backend server.</Text>
            </FormControl>
          </ModalBody>
          <ModalFooter>
            <Button colorScheme="teal" mr={3} onClick={handleAddApp} isLoading={isSubmitting}>
              Save
            </Button>
            <Button onClick={onAddModalClose}>Cancel</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Confirm Delete Dialog */}
      {selectedApp && (
        <AlertDialog
          isOpen={isConfirmDeleteOpen}
          leastDestructiveRef={cancelRef}
          onClose={onConfirmDeleteClose}
        >
          <AlertDialogOverlay>
            <AlertDialogContent>
              <AlertDialogHeader fontSize="lg" fontWeight="bold">
                Delete {selectedApp.name}
              </AlertDialogHeader>
              <AlertDialogBody>
                Are you sure you want to remove the Docker Compose configuration for '{selectedApp.name}'? This will not affect running containers but will remove it from this list.
              </AlertDialogBody>
              <AlertDialogFooter>
                <Button ref={cancelRef} onClick={onConfirmDeleteClose} isDisabled={isSubmitting}>
                  Cancel
                </Button>
                <Button colorScheme="red" onClick={handleDeleteApp} ml={3} isLoading={isSubmitting}>
                  Delete
                </Button>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialogOverlay>
        </AlertDialog>
      )}
    </Box>
  );
};

export default DockerComposeView; 