import React, { useState } from 'react';
import {
  Box, Heading, Text, Table, Thead, Tbody, Tr, Th, Td, TableContainer, Spinner, Button, Tag,
  useToast, AlertDialog, AlertDialogBody, AlertDialogFooter, AlertDialogHeader,
  AlertDialogContent, AlertDialogOverlay, IconButton, Tooltip, HStack, VStack
} from '@chakra-ui/react';
import { DeleteIcon, QuestionOutlineIcon } from '@chakra-ui/icons';
import { useAppContext } from '../context/AppContext';
import { killHostProcessByPid } from '../api';

const HostProcessView = () => {
  const { hostProcesses, hostOsInfo, isLoading, error, loadAllData } = useAppContext();
  const toast = useToast();
  const [selectedProcess, setSelectedProcess] = useState(null);
  const [isConfirmKillOpen, setIsConfirmKillOpen] = useState(false);
  const [isKilling, setIsKilling] = useState(false);
  const cancelRef = React.useRef();

  const openKillConfirmation = (process) => {
    setSelectedProcess(process);
    setIsConfirmKillOpen(true);
  };

  const handleKillProcess = async () => {
    if (!selectedProcess) return;
    setIsKilling(true);
    try {
      const result = await killHostProcessByPid(selectedProcess.pid);
      toast({
        title: `Process ${selectedProcess.name} (PID: ${selectedProcess.pid}) kill attempt.`,
        description: result.message || 'Kill command sent.',
        status: result.success || (result.output && result.output.stderr === '') ? 'success' : 'warning',
        duration: 5000,
        isClosable: true,
      });
      loadAllData(); // Refresh the process list
    } catch (err) {
      toast({
        title: 'Error killing process',
        description: err.message || 'Could not kill process.',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    }
    setIsKilling(false);
    setIsConfirmKillOpen(false);
    setSelectedProcess(null);
  };

  const getPlatformSpecificInfo = () => {
    if (!hostOsInfo) return 'Loading OS info...';
    return `Host Platform: ${hostOsInfo.platform || 'Unknown'}`;
  };

  return (
    <Box borderWidth="1px" borderRadius="lg" p={4}>
      <HStack justifyContent="space-between" mb={4}>
        <Heading size="md">Host Processes & Ports</Heading>
        <Text fontSize="sm" color="gray.500">{getPlatformSpecificInfo()}</Text>
      </HStack>

      {isLoading && (!hostProcesses || hostProcesses.length === 0) && (
        <Box display="flex" justifyContent="center" my={8}><Spinner size="xl" /></Box>
      )}
      {!isLoading && error && <Text color="red.500">Error loading processes: {error}</Text>}
      {!isLoading && !error && hostProcesses && hostProcesses.length === 0 && (
        <Text>No listening processes found or an error occurred fetching them.</Text>
      )}

      {!isLoading && !error && hostProcesses && hostProcesses.length > 0 && (
        <TableContainer>
          <Table variant="simple" size="sm">
            <Thead>
              <Tr>
                <Th>PID</Th>
                <Th>Name</Th>
                <Th>Ports (Proto:Addr:Port)</Th>
                <Th>Actions</Th>
              </Tr>
            </Thead>
            <Tbody>
              {hostProcesses.map((proc) => (
                <Tr key={proc.pid}>
                  <Td>{proc.pid}</Td>
                  <Td>{proc.name}</Td>
                  <Td>
                    {proc.ports && proc.ports.length > 0 ? (
                      <VStack align="start" spacing={0}>
                        {proc.ports.map((p, index) => (
                          <Tag size="sm" key={index} colorScheme="blue" m={0.5}>
                            {p.protocol}:{p.address}:{p.port}
                          </Tag>
                        ))}
                      </VStack>
                    ) : <Text as="i">No listening ports</Text>}
                  </Td>
                  <Td>
                    <Tooltip label={`Kill process ${proc.name} (PID: ${proc.pid})`}>
                      <IconButton
                        icon={<DeleteIcon />}
                        colorScheme="red"
                        aria-label={`Kill ${proc.name}`}
                        onClick={() => openKillConfirmation(proc)}
                        size="sm"
                        isDisabled={isKilling && selectedProcess?.pid === proc.pid}
                      />
                    </Tooltip>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </TableContainer>
      )}

      {/* Confirm Kill Dialog */}
      {selectedProcess && (
        <AlertDialog
          isOpen={isConfirmKillOpen}
          leastDestructiveRef={cancelRef}
          onClose={() => setIsConfirmKillOpen(false)}
        >
          <AlertDialogOverlay>
            <AlertDialogContent>
              <AlertDialogHeader fontSize="lg" fontWeight="bold">
                Kill Process {selectedProcess.name} (PID: {selectedProcess.pid})?
              </AlertDialogHeader>
              <AlertDialogBody>
                Are you sure you want to attempt to kill this process?
                This action can be disruptive.
                <Text mt={2} fontSize="sm">Command will be: 
                  {hostOsInfo?.platform === 'win32' ? 
                  `taskkill /PID ${selectedProcess.pid} /F` : 
                  `kill -9 ${selectedProcess.pid}`}
                </Text>
              </AlertDialogBody>
              <AlertDialogFooter>
                <Button ref={cancelRef} onClick={() => setIsConfirmKillOpen(false)} isDisabled={isKilling}>
                  Cancel
                </Button>
                <Button colorScheme="red" onClick={handleKillProcess} ml={3} isLoading={isKilling}>
                  Kill Process
                </Button>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialogOverlay>
        </AlertDialog>
      )}
    </Box>
  );
};

export default HostProcessView; 