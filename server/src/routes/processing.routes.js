import express from 'express';
import auth from '../middleware/auth.js';
import roomAccess from '../middleware/roomAccess.js';
import {
  getProcessingStatus,
  retryFailedJobs,
  pauseProcessing,
  resumeProcessing,
} from '../controllers/processing.controller.js';

const router = express.Router();

// REST API for Processing Engine 2.0
router.get('/:roomId/processing', auth, roomAccess, getProcessingStatus);
router.post('/:roomId/processing/retry', auth, roomAccess, retryFailedJobs);
router.post('/:roomId/processing/pause', auth, roomAccess, pauseProcessing);
router.post('/:roomId/processing/resume', auth, roomAccess, resumeProcessing);

export default router;
