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
import { AddIcon, DeleteIcon, ArrowUpIcon, ArrowDownIcon, EditIcon } from '@chakra-ui/icons';
import { useAppContext } from '../context/AppContext';
import {
  addDockerComposeApp,
  removeDockerComposeApp,
  dockerComposeUp,
  dockerComposeDown,
  updateDockerComposeApp,
} from '../api';

const DockerComposeView = () => {
  const { dockerComposeApps, loadAllData, isLoading: isGlobalLoading } = useAppContext();
  const { isOpen: isAddModalOpen, onOpen: onAddModalOpen, onClose: onAddModalClose } = useDisclosure();
  const { isOpen: isEditModalOpen, onOpen: onEditModalOpen, onClose: onEditModalClose } = useDisclosure();
  const { isOpen: isConfirmDeleteOpen, onOpen: onConfirmDeleteOpen, onClose: onConfirmDeleteClose } = useDisclosure();
  
  const [newName, setNewName] = useState('');
  const [newPath, setNewPath] = useState('');
  const [newUpCommand, setNewUpCommand] = useState('up -d --pull=always');
  const [currentApp, setCurrentApp] = useState(null);

  const [selectedApp, setSelectedApp] = useState(null);
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
      await addDockerComposeApp(newName, newPath, newUpCommand);
      toast({ title: 'Success', description: `Docker Compose app '${newName}' added.`, status: 'success', duration: 3000, isClosable: true });
      setNewName('');
      setNewPath('');
      setNewUpCommand('up -d --pull=always');
      onAddModalClose();
      loadAllData();
    } catch (error) {
      toast({ title: 'Error adding app', description: error.message || 'Could not add app.', status: 'error', duration: 5000, isClosable: true });
    }
    setIsSubmitting(false);
  };

  const openEditModal = (app) => {
    setCurrentApp(app);
    setNewName(app.name);
    setNewPath(app.path);
    setNewUpCommand(app.upCommand || 'up -d --pull=always');
    onEditModalOpen();
  };

  const handleEditApp = async () => {
    if (!currentApp || !newName || !newPath) {
      toast({ title: 'Error', description: 'Name and path are required.', status: 'error', duration: 3000, isClosable: true });
      return;
    }
    if (!newPath.endsWith('.yml') && !newPath.endsWith('.yaml')) {
        toast({ title: 'Error', description: 'Path must be a .yml or .yaml file.', status: 'error', duration: 3000, isClosable: true });
        return;
    }
    setIsSubmitting(true);
    try {
      await updateDockerComposeApp(currentApp.id, newName, newPath, newUpCommand);
      toast({ title: 'Success', description: `'${newName}' updated.`, status: 'success', duration: 3000, isClosable: true });
      onEditModalClose();
      setCurrentApp(null);
      loadAllData();
    } catch (error) {
      toast({ title: 'Error updating app', description: error.message || 'Could not update app.', status: 'error', duration: 5000, isClosable: true });
    }
    setIsSubmitting(false);
  };

  const openDeleteConfirmation = (app) => {
    setCurrentApp(app);
    onConfirmDeleteOpen();
  };

  const handleDeleteApp = async () => {
    if (!currentApp) return;
    setIsSubmitting(true);
    try {
      await removeDockerComposeApp(currentApp.id);
      toast({ title: 'Success', description: `'${currentApp.name}' removed.`, status: 'success', duration: 3000, isClosable: true });
      onConfirmDeleteClose();
      setCurrentApp(null);
      loadAllData();
    } catch (error) {
      toast({ title: 'Error removing app', description: error.message || 'Could not remove app.', status: 'error', duration: 5000, isClosable: true });
    }
    setIsSubmitting(false);
  };

  const handleComposeAction = async (app, action) => {
    setCurrentApp(app);
    setIsSubmitting(true);
    const actionVerb = action === 'up' ? 'starting' : 'stopping';
    const actionCommand = action === 'up' ? dockerComposeUp : dockerComposeDown;
    try {
      const result = await actionCommand(app.path);
      toast({ title: 'Success', description: `${app.name} ${action} command executed. Output: ${result.message || '-'}`, status: 'success', duration: 5000, isClosable: true });
      loadAllData();
    } catch (error) {
      toast({ title: `Error ${actionVerb} ${app.name}`, description: error.message || `Could not ${action} app.`, status: 'error', duration: 5000, isClosable: true });
    }
    setIsSubmitting(false);
    setCurrentApp(null);
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
                <Th>Custom Up Command</Th>
                <Th>Actions</Th>
              </Tr>
            </Thead>
            <Tbody>
              {dockerComposeApps.map((app) => (
                <Tr key={app.id}>
                  <Td>{app.name}</Td>
                  <Td fontFamily="monospace">{app.path}</Td>
                  <Td fontFamily="monospace">{app.upCommand || 'up -d --pull=always'}</Td>
                  <Td>
                    <HStack spacing={2}>
                      <Tooltip label={`Run docker-compose -f ... ${app.upCommand || 'up -d --pull=always'} for ${app.name}`}>
                        <IconButton
                          icon={<ArrowUpIcon />}
                          colorScheme="green"
                          aria-label={`Start ${app.name}`}
                          onClick={() => handleComposeAction(app, 'up')}
                          isLoading={isSubmitting && currentApp?.id === app.id}
                          size="sm"
                        />
                      </Tooltip>
                      <Tooltip label={`Run docker-compose down for ${app.name}`}>
                        <IconButton
                          icon={<ArrowDownIcon />}
                          colorScheme="orange"
                          aria-label={`Stop ${app.name}`}
                          onClick={() => handleComposeAction(app, 'down')}
                          isLoading={isSubmitting && currentApp?.id === app.id}
                          size="sm"
                        />
                      </Tooltip>
                      <Tooltip label={`Edit ${app.name} configuration`}>
                        <IconButton
                          icon={<EditIcon />}
                          colorScheme="blue"
                          aria-label={`Edit ${app.name}`}
                          onClick={() => openEditModal(app)}
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
            <FormControl mt={4}>
              <FormLabel>Custom Up Command Arguments</FormLabel>
              <Input 
                placeholder="e.g., up -d --pull=always --build"
                value={newUpCommand} 
                onChange={(e) => setNewUpCommand(e.target.value)} 
              />
              <Text fontSize="xs" color="gray.500" mt={1}>
                Arguments to append after 'docker-compose -f &lt;file&gt;'. Defaults to 'up -d --pull=always'.
              </Text>
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

      {/* Edit App Modal */}
      {currentApp && (
        <Modal isOpen={isEditModalOpen} onClose={onEditModalClose}>
          <ModalOverlay />
          <ModalContent>
            <ModalHeader>Edit Docker Compose App: {currentApp.name}</ModalHeader>
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
              <FormControl mt={4}>
                <FormLabel>Custom Up Command Arguments</FormLabel>
                <Input 
                  placeholder="e.g., up -d --pull=always --build"
                  value={newUpCommand} 
                  onChange={(e) => setNewUpCommand(e.target.value)} 
                />
                <Text fontSize="xs" color="gray.500" mt={1}>
                  Arguments to append after 'docker-compose -f &lt;file&gt;'. Defaults to 'up -d --pull=always'.
                </Text>
              </FormControl>
            </ModalBody>
            <ModalFooter>
              <Button colorScheme="teal" mr={3} onClick={handleEditApp} isLoading={isSubmitting}>
                Save Changes
              </Button>
              <Button onClick={onEditModalClose}>Cancel</Button>
            </ModalFooter>
          </ModalContent>
        </Modal>
      )}

      {/* Confirm Delete Dialog */}
      {currentApp && (
        <AlertDialog
          isOpen={isConfirmDeleteOpen}
          leastDestructiveRef={cancelRef}
          onClose={onConfirmDeleteClose}
        >
          <AlertDialogOverlay>
            <AlertDialogContent>
              <AlertDialogHeader fontSize="lg" fontWeight="bold">
                Delete {currentApp.name}
              </AlertDialogHeader>
              <AlertDialogBody>
                Are you sure you want to remove the Docker Compose configuration for '{currentApp.name}'? This will not affect running containers but will remove it from this list.
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