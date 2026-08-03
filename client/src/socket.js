import { io } from 'socket.io-client';

// In development (Vite dev server): connect to the Node server on localhost:3001
// In production: server serves the client, so connect to same origin
const SERVER_URL = import.meta.env.DEV
  ? (import.meta.env.VITE_SERVER_URL || 'http://localhost:3001')
  : window.location.origin;

// Persistent client identity — survives page refresh + brief disconnects.
// This is what lets the server recognise a returning player.
function getClientId() {
  let id = localStorage.getItem('beanie_client_id');
  if (!id) {
    id = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2) + Date.now().toString(36);
    localStorage.setItem('beanie_client_id', id);
  }
  return id;
}

export const CLIENT_ID = getClientId();

// Single shared socket instance — not connected until connect() is called.
// clientId is sent as socket auth so the server can match the connection
// to an existing session even after socket.id changes.
const socket = io(SERVER_URL, {
  autoConnect: false,
  auth: { clientId: CLIENT_ID },
});

export default socket;
