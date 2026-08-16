import { Router } from 'express';
import {
  getConnectUrl,
  handleDriveCallback,
  getDriveStatus,
  getDriveFolders,
  selectDriveFolder,
  indexDrivePhotos,
  triggerSync,
  getSyncStatus,
  updateSyncSettings,
} from '../controllers/drive.controller.js';
import auth from '../middleware/auth.js';
import roomAccess from '../middleware/roomAccess.js';

const router = Router();

// OAuth Callback handler (redirect from Google)
router.get('/callback', (req, res, next) => {
  auth(req, res, () => {
    handleDriveCallback(req, res, next);
  }).catch(() => {
    handleDriveCallback(req, res, next);
  });
});

// Authenticated Drive endpoints
router.get('/connect', auth, getConnectUrl);
router.get('/status', auth, getDriveStatus);
router.get('/folders', auth, getDriveFolders);
router.post('/select-folder', auth, selectDriveFolder);
router.post('/rooms/:roomId/index-drive', auth, roomAccess, indexDrivePhotos);

// Sync endpoints
router.post('/rooms/:roomId/sync/trigger', auth, roomAccess, triggerSync);
router.get('/rooms/:roomId/sync/status', auth, roomAccess, getSyncStatus);
router.post('/rooms/:roomId/sync/settings', auth, roomAccess, updateSyncSettings);

export default router;
