import { io } from 'socket.io-client';

// In development (Vite dev server): connect to the Node server on localhost:3001
// In production: server serves the client, so connect to same origin
const SERVER_URL = import.meta.env.DEV
  ? (import.meta.env.VITE_SERVER_URL || 'http://localhost:3001')
  : window.location.origin;

// Single shared socket instance — not connected until connect() is called
const socket = io(SERVER_URL, { autoConnect: false });

export default socket;
