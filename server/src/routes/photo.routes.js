import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  uploadPhotos,
  getRoomPhotos,
  getPhoto,
  indexPhotos,
  getIndexStatus,
} from '../controllers/photo.controller.js';
import auth from '../middleware/auth.js';
import roomAccess from '../middleware/roomAccess.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Configure multer for local photo uploads (Phase 2)
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads');
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB per file
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|webp|heic/;
    const ext = allowed.test(path.extname(file.originalname).toLowerCase());
    const mime = allowed.test(file.mimetype.split('/')[1]);
    if (ext || mime) {
      cb(null, true);
    } else {
      cb(new Error('Only image files (JPEG, PNG, WebP, HEIC) are allowed.'));
    }
  },
});

// Multer for selfie (memory storage — no need to persist)
const selfieUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

const router = Router();

// All routes require auth
router.use(auth);

// Photo management
router.post('/:roomId/photos', roomAccess, upload.array('photos', 50), uploadPhotos);
router.get('/:roomId/photos', roomAccess, getRoomPhotos);

// Indexing
router.post('/:roomId/index', roomAccess, indexPhotos);
router.get('/:roomId/index/status', roomAccess, getIndexStatus);

export default router;
