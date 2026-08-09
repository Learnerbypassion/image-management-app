import { Router } from 'express';
import multer from 'multer';
import { matchSelfie } from '../controllers/face.controller.js';
import auth from '../middleware/auth.js';
import roomAccess from '../middleware/roomAccess.js';

// Selfie uses memory storage — no need to persist
const selfieUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

const router = Router();

router.use(auth);

// POST /api/rooms/:roomId/match
router.post('/:roomId/match', roomAccess, selfieUpload.single('selfie'), matchSelfie);

export default router;
