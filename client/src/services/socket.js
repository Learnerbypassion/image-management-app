import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_API_URL
  ? import.meta.env.VITE_API_URL.replace('/api', '')
  : 'http://localhost:5000';

let socket = null;

export const getSocket = () => {
  if (!socket) {
    socket = io(SOCKET_URL, {
      withCredentials: true,
      autoConnect: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
    });

    socket.on('connect', () => {
      console.log('⚡ Socket connected to server:', socket.id);
    });

    socket.on('disconnect', (reason) => {
      console.log('⚡ Socket disconnected:', reason);
    });
  }

  return socket;
};

export const joinRoomChannel = (roomId) => {
  const socketInstance = getSocket();
  if (socketInstance && roomId) {
    socketInstance.emit('join:room', roomId.toString());
  }
};

export const leaveRoomChannel = (roomId) => {
  const socketInstance = getSocket();
  if (socketInstance && roomId) {
    socketInstance.emit('leave:room', roomId.toString());
  }
};

export default {
  getSocket,
  joinRoomChannel,
  leaveRoomChannel,
};
