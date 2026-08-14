import { Router } from 'express';
import { getPhoto } from '../controllers/photo.controller.js';
import { downloadPhotosZip } from '../controllers/zip.controller.js';
import auth from '../middleware/auth.js';

const router = Router();

// POST /api/photos/download-zip — Stream ZIP archive of selected photos
router.post('/download-zip', auth, downloadPhotosZip);

// GET /api/photos/:photoId — Serve individual photo
router.get('/:photoId', auth, getPhoto);

export default router;
