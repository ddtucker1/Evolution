import { io } from 'socket.io-client';
import { getToken } from './api';

let socket = null;

export function connectSocket() {
  if (socket?.connected) return socket;
  const token = getToken();
  if (!token) return null;

  socket = io(import.meta.env.VITE_API_URL || '', {
    auth: { token },
    autoConnect: true,
  });

  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

export function getSocket() {
  return socket;
}
