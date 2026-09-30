// Import Socket.IO client library
import { io } from 'socket.io-client';

// Determine backend server URL:
// 1. If VITE_SERVER_URL is provided in .env, use that.
// 2. In production (single-origin deployment on Render), use undefined so Socket.IO connects to the same origin.
// 3. In local development without env variable, default to http://localhost:3001.
const SERVER_URL = import.meta.env.VITE_SERVER_URL
  ? import.meta.env.VITE_SERVER_URL
  : import.meta.env.PROD
  ? undefined
  : 'http://localhost:3001';

// Create and export the shared socket instance
export const socket = io(SERVER_URL);
