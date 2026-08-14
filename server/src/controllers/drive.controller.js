import axios from 'axios';
import FormData from 'form-data';
import * as driveService from '../services/googleDrive.service.js';
import { getStorageProvider } from '../services/storage.service.js';
import Room from '../models/Room.js';
import Photo from '../models/Photo.js';
import FaceEmbedding from '../models/FaceEmbedding.js';
import env from '../config/env.js';
import logger from '../utils/logger.js';

// GET /api/drive/connect
export const getConnectUrl = async (req, res, next) => {
  try {
    const authUrl = driveService.getAuthUrl();
    res.json({ url: authUrl });
  } catch (error) {
    next(error);
  }
};

// GET /api/drive/callback
export const handleDriveCallback = async (req, res, next) => {
  try {
    const { code } = req.query;
    if (!code) {
      return res.status(400).json({ error: 'Authorization code is missing.' });
    }

    await driveService.handleCallback(code, req.userId);

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
    const driveFiles = await driveProvider.listFolderFiles(req.user, room.driveFolderId);

    if (driveFiles.length === 0) {
      return res.status(400).json({ error: 'No image files (JPEG, PNG, WebP, HEIC) found directly inside the selected Google Drive folder.' });
    }

    // 2. Identify unindexed photos
    const existingPhotos = await Photo.find({ roomId: room._id });
    const existingDriveIds = new Set(existingPhotos.map((p) => p.storage?.fileId || p.driveFileId));

    const unindexedDriveFiles = driveFiles.filter((f) => !existingDriveIds.has(f.id));

    if (unindexedDriveFiles.length === 0) {
      return res.json({ message: 'All photos in this Drive folder are already indexed.' });
    }

    // 3. Mark room status & sync analytics
    room.status = 'indexing';
    room.sync.status = 'syncing';
    room.sync.lastSyncStartedAt = new Date();
    room.totalPhotos = existingPhotos.length + unindexedDriveFiles.length;
    room.processing.total = room.totalPhotos;
    room.processing.pending = unindexedDriveFiles.length;
    await room.save();

    // Respond immediately so HTTP proxy doesn't time out or cause ECONNRESET
    res.json({
      message: `Indexing started for ${unindexedDriveFiles.length} Drive photo(s).`,
      total: unindexedDriveFiles.length,
    });

    // 4. Background processing (Async job execution)
    (async () => {
      let processedCount = room.processedPhotos || 0;
      let facesCount = 0;

      for (const driveFile of unindexedDriveFiles) {
        try {
          logger.info(`Processing Drive file ${driveFile.name} (${driveFile.id})...`);

          // Create Photo metadata document with provider-agnostic storage schema
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
              status: 'downloading',
            },
            indexed: false,
          });

          // Download image binary directly into RAM buffer using StorageService
          const imageBuffer = await driveProvider.getFileBuffer(req.user, driveFile.id);

          photo.processing.status = 'face_detection';
          await photo.save();

          // Send buffer to Python face service via form-data
          const formData = new FormData();
          formData.append('file', imageBuffer, {
            filename: driveFile.name,
            contentType: driveFile.mimeType || 'image/jpeg',
          });

          const response = await axios.post(
            `${env.FACE_SERVICE_URL}/detect`,
            formData,
            {
              headers: formData.getHeaders(),
              timeout: 60000,
            }
          );

          const { faces } = response.data;

          // Store face embeddings in MongoDB
          if (faces && faces.length > 0) {
            const embeddings = faces.map((face) => ({
              roomId: room._id,
              photoId: photo._id,
              embedding: face.embedding,
              boundingBox: face.bounding_box,
              qualityScore: face.quality_score,
              confidence: face.confidence,
            }));

            await FaceEmbedding.insertMany(embeddings);
            facesCount += faces.length;
          }

          // Mark photo as completed
          photo.indexed = true;
          photo.facesFound = faces?.length || 0;
          photo.processing.status = 'completed';
          photo.processing.processedAt = new Date();
          await photo.save();

          processedCount++;

          // Update room status
          await Room.findByIdAndUpdate(room._id, {
            processedPhotos: processedCount,
            'processing.completed': processedCount,
            $inc: { facesDetected: faces?.length || 0 },
          });
        } catch (err) {
          logger.error(`Error processing Drive photo ${driveFile.name}:`, err.message);
        }
      }

      // Mark room ready when background processing finishes
      const now = new Date();
      await Room.findByIdAndUpdate(room._id, {
        status: 'ready',
        'sync.status': 'idle',
        'sync.lastSyncedAt': now,
        'sync.lastSyncCompletedAt': now,
      });
      logger.success(`Google Drive indexing finished for room ${room._id}. Total faces detected: ${facesCount}`);
    })().catch((err) => {
      logger.error('Background Drive indexing error:', err);
      Room.findByIdAndUpdate(room._id, { status: 'ready', 'sync.status': 'error', 'sync.error': err.message }).catch(() => {});
    });

  } catch (error) {
    next(error);
  }
};

