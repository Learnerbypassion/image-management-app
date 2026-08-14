import { Router } from 'express';
import {
  createUploadRequest,
  getUploadRequests,
  getMyRequestStatus,
  approveUploadRequest,
  rejectUploadRequest,
  revokeUploadRequest,
} from '../controllers/uploadRequest.controller.js';
import auth from '../middleware/auth.js';
import roomAccess from '../middleware/roomAccess.js';

const router = Router();

// All routes require authentication
router.use(auth);

// Room-scoped routes (require membership)
router.post('/rooms/:roomId/upload-requests', roomAccess, createUploadRequest);
router.get('/rooms/:roomId/upload-requests', roomAccess, getUploadRequests);
router.get('/rooms/:roomId/upload-requests/my-status', roomAccess, getMyRequestStatus);

// Request-scoped actions (owner verifies inside controller)
router.patch('/upload-requests/:id/approve', approveUploadRequest);
router.patch('/upload-requests/:id/reject', rejectUploadRequest);
router.patch('/upload-requests/:id/revoke', revokeUploadRequest);

export default router;
