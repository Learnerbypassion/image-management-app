import axios from 'axios';
import FormData from 'form-data';
import * as driveService from '../services/googleDrive.service.js';
import { getStorageProvider } from '../services/storage.service.js';
import Room from '../models/Room.js';
import Photo from '../models/Photo.js';
import FaceEmbedding from '../models/FaceEmbedding.js';
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
    await room.save();

    res.json({ message: 'Drive folder linked successfully.', room });
  } catch (error) {
    next(error);
  }
};

// POST /api/rooms/:roomId/index-drive
export const indexDrivePhotos = async (req, res, next) => {
  try {
    if (!req.canUpload) {
      return res.status(403).json({ error: 'You do not have permission to start Drive indexing.' });
    }

    const room = req.room;
    if (!room.driveFolderId) {
      return res.status(400).json({ error: 'No Google Drive folder linked to this room.' });
    }

    if (!req.user.googleTokens?.isConnected) {
      return res.status(400).json({ error: 'Google Drive is not connected for your account.' });
    }

    const driveProvider = getStorageProvider('google-drive');

    // 1. Query files in Drive folder
    logger.info(`Fetching photos from Drive folder ${room.driveFolderId}...`);
    const driveFiles = await driveProvider.listFiles(req.user, room.driveFolderId);

    if (driveFiles.length === 0) {
      return res.status(400).json({ error: 'No image files (JPEG, PNG, WebP, HEIC) found directly inside the selected Google Drive folder.' });
    }

    // 2. Identify unindexed photos
    const existingPhotos = await Photo.find({ roomId: room._id });
    const existingDriveIds = new Set(existingPhotos.map((p) => p.storage?.fileId || p.driveFileId));

    const unindexedDriveFiles = driveFiles.filter((f) => !existingDriveIds.has(f.id));
    const alreadyIndexedCount = driveFiles.length - unindexedDriveFiles.length;

    if (unindexedDriveFiles.length === 0) {
      room.status = 'ready';
      room.totalPhotos = driveFiles.length;
      room.processedPhotos = driveFiles.length;
      await room.save();
      return res.json({ message: 'All photos in this Drive folder are already indexed.' });
    }

    // 3. Create Photo records for DISCOVERED drive files with status UPLOADED & QUEUED
    const createdPhotos = [];
    for (const driveFile of unindexedDriveFiles) {
      const photo = await Photo.create({
        roomId: room._id,
        storageProvider: 'google-drive',
        storage: {
          fileId: driveFile.id,
          folderId: room.driveFolderId,
          fileName: driveFile.name,
          mimeType: driveFile.mimeType || 'image/jpeg',
          size: driveFile.size ? parseInt(driveFile.size) : 0,
          width: driveFile.imageMediaMetadata?.width || null,
          height: driveFile.imageMediaMetadata?.height || null,
        },
        processing: {
          uploadStatus: 'UPLOADED',
          indexingStatus: 'QUEUED',
          status: 'QUEUED',
        },
        indexed: false,
      });
      createdPhotos.push(photo);
    }

    // 4. Bulk enqueue into BullMQ Redis Queue
    await enqueuePhotoIndexingBatch(createdPhotos, room._id, req.user);

    // Respond immediately to client (Upload/Discovery Job complete!)
    res.json({
      message: `Indexing started and safely queued into BullMQ for ${unindexedDriveFiles.length} Drive photo(s).`,
      total: unindexedDriveFiles.length,
    });
  } catch (error) {
    next(error);
  }
};

