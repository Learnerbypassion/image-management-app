import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

import connectDB from './config/db.js';
import env from './config/env.js';
import logger from './utils/logger.js';

import authRoutes from './routes/auth.routes.js';
import roomRoutes from './routes/room.routes.js';
import photoRoutes from './routes/photo.routes.js';
import faceRoutes from './routes/face.routes.js';
import singlePhotoRoutes from './routes/singlePhoto.routes.js';
import driveRoutes from './routes/drive.routes.js';
import uploadRequestRoutes from './routes/uploadRequest.routes.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();

// Ensure uploads directory exists (Phase 2)
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Middleware
app.use(helmet());
app.use(cors({
  origin: env.CLIENT_URL,
  credentials: true,
}));
app.use(morgan('dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/drive', driveRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/rooms', photoRoutes);
app.use('/api/rooms', faceRoutes);
app.use('/api/photos', singlePhotoRoutes);
app.use('/api', uploadRequestRoutes);

// Global error handler
app.use((err, req, res, next) => {
  logger.error(err.stack || err.message);

  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map((e) => e.message);
    return res.status(400).json({ error: messages.join(', ') });
  }

  if (err.code === 11000) {
    return res.status(409).json({ error: 'Duplicate entry.' });
  }

  res.status(err.status || 500).json({
    error: env.NODE_ENV === 'production'
      ? 'Internal server error.'
      : err.message,
  });
});

// Start server
const start = async () => {
  await connectDB();

  app.listen(env.PORT, () => {
    logger.success(`Server running on port ${env.PORT}`);
    logger.info(`Environment: ${env.NODE_ENV}`);
    logger.info(`Face service: ${env.FACE_SERVICE_URL}`);
  });
};

start();
