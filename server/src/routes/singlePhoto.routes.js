import { Router } from 'express';
import { getPhoto } from '../controllers/photo.controller.js';
import auth from '../middleware/auth.js';

const router = Router();

// GET /api/photos/:photoId — Serve individual photo
router.get('/:photoId', auth, getPhoto);

export default router;
