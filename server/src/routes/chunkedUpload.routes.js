import { Router } from 'express';
import multer from 'multer';
import {
  initUpload,
  uploadChunk,
  completeUpload,
} from '../controllers/chunkedUpload.controller.js';
import auth from '../middleware/auth.js';
import roomAccess from '../middleware/roomAccess.js';

const router = Router();

// Multer for receiving individual chunks (memory storage, no file size limit per chunk)
const chunkUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max per chunk
});

// Initialize a chunked upload session
router.post('/:roomId/upload/init', auth, roomAccess, initUpload);

// Upload a single chunk
router.post('/:roomId/upload/chunk', auth, roomAccess, chunkUpload.single('chunk'), uploadChunk);

// Finalize and complete the upload
router.post('/:roomId/upload/complete', auth, roomAccess, completeUpload);

export default router;
