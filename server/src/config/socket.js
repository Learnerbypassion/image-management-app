import { Server } from 'socket.io';
import env from './env.js';
import logger from '../utils/logger.js';

let io = null;

export const initSocketServer = (httpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin: env.CLIENT_URL,
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  io.on('connection', (socket) => {
    logger.info(`Socket connected: ${socket.id}`);

    // Join room isolation channel
    socket.on('join:room', (roomId) => {
      if (roomId) {
        const roomChannel = `room:${roomId}`;
        socket.join(roomChannel);
        logger.info(`Socket ${socket.id} joined channel ${roomChannel}`);
      }
    });

    socket.on('leave:room', (roomId) => {
      if (roomId) {
        const roomChannel = `room:${roomId}`;
        socket.leave(roomChannel);
        logger.info(`Socket ${socket.id} left channel ${roomChannel}`);
      }
    });

    socket.on('disconnect', () => {
      logger.info(`Socket disconnected: ${socket.id}`);
    });
  });

  return io;
};

export const getIO = () => {
  return io;
};

export const emitToRoom = (roomId, event, payload) => {
  if (io && roomId) {
    io.to(`room:${roomId}`).emit(event, payload);
  }
};

export default {
  initSocketServer,
  getIO,
  emitToRoom,
};
