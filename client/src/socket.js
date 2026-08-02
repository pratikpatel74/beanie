import { io } from 'socket.io-client';

// In development: connects to localhost:3001
// In production:  VITE_SERVER_URL is empty → same origin (server serves the client)
const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';

// Single shared socket instance — not connected until connect() is called
const socket = io(SERVER_URL || window.location.origin, { autoConnect: false });

export default socket;
