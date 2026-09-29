// Import Socket.IO client library
import { io } from 'socket.io-client';

// Get backend server URL from environment or default to http://localhost:3001
const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';

// Create and export the socket instance
export const socket = io(SERVER_URL);
