import * as driveService from '../services/googleDrive.service.js';
import { getStorageProvider } from '../services/storage.service.js';
import { syncRoom, getNextSyncAt } from '../services/driveSync.service.js';
import { registerRoomForSync, unregisterRoomFromSync } from '../services/syncScheduler.js';
import Room from '../models/Room.js';
import Photo from '../models/Photo.js';
import env from '../config/env.js';
import logger from '../utils/logger.js';
import { enqueuePhotoIndexingBatch } from '../queues/indexing.queue.js';

// GET /api/drive/connect
export const getConnectUrl = async (req, res, next) => {
  try {
    const authUrl = driveService.getAuthUrl(req.userId?.toString());
    res.json({ url: authUrl });
  } catch (error) {
    next(error);
  }
};

// GET /api/drive/callback
export const handleDriveCallback = async (req, res, next) => {
  try {
    const { code, state } = req.query;
    if (!code) {
      return res.status(400).json({ error: 'Authorization code is missing.' });
    }

    const userId = req.userId || state;
    if (!userId) {
      return res.status(401).json({ error: 'User context is missing for OAuth callback.' });
    }

    await driveService.handleCallback(code, userId);

    // Redirect user back to frontend client
    res.redirect(`${env.CLIENT_URL}/?driveConnected=true`);
  } catch (error) {
    logger.error('Drive OAuth callback error:', error.message);
    res.redirect(`${env.CLIENT_URL}/?driveError=${encodeURIComponent(error.message)}`);
  }
};

// GET /api/drive/status
export const getDriveStatus = async (req, res) => {
  res.json({
    isConnected: !!req.user.googleTokens?.isConnected,
  });
};

// GET /api/drive/folders
export const getDriveFolders = async (req, res, next) => {
  try {
    if (!req.user.googleTokens?.isConnected) {
      return res.status(400).json({ error: 'Google Drive is not connected.' });
    }

    const driveProvider = getStorageProvider('google-drive');
    const folders = await driveProvider.listFolders(req.user);
    res.json({ folders });
  } catch (error) {
    next(error);
  }
};

// POST /api/drive/select-folder
export const selectDriveFolder = async (req, res, next) => {
  try {
    const { roomId, folderId, folderName } = req.body;

    if (!roomId || !folderId) {
      return res.status(400).json({ error: 'roomId and folderId are required.' });
    }

    const room = await Room.findById(roomId);
    if (!room) {
      return res.status(404).json({ error: 'Room not found.' });
    }

    if (room.ownerId.toString() !== req.userId.toString()) {
      return res.status(403).json({ error: 'Only room owner can select drive folder.' });
    }

    room.driveFolderId = folderId;
    room.driveFolderName = folderName || 'Selected Drive Folder';
    room.storageProvider = 'google-drive';
    room.sync.enabled = true;
    room.sync.nextSyncAt = getNextSyncAt(room.sync?.interval || '5m');
    await room.save();

    // Register for automatic sync
    await registerRoomForSync(room._id, room.sync?.interval || '5m');

    res.json({ message: 'Drive folder linked successfully.', room });
  } catch (error) {
    next(error);
  }
};

// POST /api/rooms/:roomId/index-drive — Trigger sync (replaces old inline indexing)
export const indexDrivePhotos = async (req, res, next) => {
  try {
    if (!req.canUpload) {
      return res.status(403).json({ error: 'You do not have permission to start Drive sync.' });
    }

    const room = req.room;
    if (!room.driveFolderId) {
      return res.status(400).json({ error: 'No Google Drive folder linked to this room.' });
    }

    if (!req.user.googleTokens?.isConnected) {
      return res.status(400).json({ error: 'Google Drive is not connected for your account.' });
    }

    const result = await syncRoom(room, req.user);

    res.json({
      message: `Drive sync complete: ${result.newCount} new, ${result.modifiedCount} modified, ${result.deletedCount} deleted, ${result.unchangedCount} unchanged.`,
      ...result,
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/rooms/:roomId/sync/trigger — Manual sync now
export const triggerSync = async (req, res, next) => {
  try {
    if (!req.isRoomOwner) {
      return res.status(403).json({ error: 'Only the room owner can trigger sync.' });
    }

    const room = req.room;
    if (!room.driveFolderId) {
      return res.status(400).json({ error: 'No Google Drive folder linked to this room.' });
    }

    if (!req.user.googleTokens?.isConnected) {
      return res.status(400).json({ error: 'Google Drive is not connected.' });
    }

    if (room.sync?.status === 'syncing') {
      return res.status(409).json({ error: 'A sync is already in progress.' });
    }

    const result = await syncRoom(room, req.user);

    res.json({
      message: `Sync complete: ${result.newCount} new, ${result.modifiedCount} modified, ${result.deletedCount} deleted.`,
      ...result,
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/rooms/:roomId/sync/status — Detailed sync state
export const getSyncStatus = async (req, res) => {
  const room = req.room;
  res.json({
    enabled: room.sync?.enabled ?? true,
    interval: room.sync?.interval || '5m',
    status: room.sync?.status || 'idle',
    lastSyncedAt: room.sync?.lastSyncedAt || null,
    lastSyncCompletedAt: room.sync?.lastSyncCompletedAt || null,
    nextSyncAt: room.sync?.nextSyncAt || null,
    error: room.sync?.error || null,
    driveFolderId: room.driveFolderId || null,
    driveFolderName: room.driveFolderName || null,
  });
};

// POST /api/rooms/:roomId/sync/settings — Update sync interval
export const updateSyncSettings = async (req, res, next) => {
  try {
    if (!req.isRoomOwner) {
      return res.status(403).json({ error: 'Only the room owner can change sync settings.' });
    }

    const { interval, enabled } = req.body;

    const updates = {};

    if (typeof enabled === 'boolean') {
      updates['sync.enabled'] = enabled;
    }

    if (interval) {
      const validIntervals = ['5m', '15m', '30m', '1h', 'manual'];
      if (!validIntervals.includes(interval)) {
        return res.status(400).json({ error: `Invalid interval. Valid: ${validIntervals.join(', ')}` });
      }
      updates['sync.interval'] = interval;
      updates['sync.nextSyncAt'] = getNextSyncAt(interval);
      if (interval === 'manual') {
        updates['sync.status'] = 'idle';
      }
    }

    const room = await Room.findByIdAndUpdate(req.room._id, updates, { new: true });

    // Register/unregister from scheduler
    const finalEnabled = room.sync?.enabled ?? true;
    const finalInterval = room.sync?.interval || '5m';

    if (finalEnabled && finalInterval !== 'manual' && room.driveFolderId) {
      await registerRoomForSync(room._id, finalInterval);
    } else {
      await unregisterRoomFromSync(room._id);
    }

    res.json({
      message: 'Sync settings updated.',
      sync: room.sync,
    });
  } catch (error) {
    next(error);
  }
};
