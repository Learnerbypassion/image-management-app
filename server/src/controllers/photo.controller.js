import fs from 'fs';
import path from 'path';
import axios from 'axios';
import FormData from 'form-data';
import Photo from '../models/Photo.js';
import FaceEmbedding from '../models/FaceEmbedding.js';
import Room from '../models/Room.js';
import env from '../config/env.js';
import logger from '../utils/logger.js';
import { getStorageProvider } from '../services/storage.service.js';
import { enqueuePhotoIndexingBatch } from '../queues/indexing.queue.js';

// POST /api/rooms/:roomId/photos — Upload photos (Upload Job -> BullMQ addBulk enqueueing -> Worker process)
export const uploadPhotos = async (req, res, next) => {
  try {
    if (!req.canUpload) {
      return res.status(403).json({ error: 'You do not have upload permission for this room.' });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No photos uploaded.' });
    }

    const room = req.room;
    const user = req.user;

    // Check if room has Google Drive linked & user connected
    const hasDrive = (room.storageProvider === 'google-drive' || !room.storageProvider) &&
                      room.driveFolderId &&
                      user?.googleTokens?.isConnected;

    const driveProvider = hasDrive ? getStorageProvider('google-drive') : null;
    const photos = [];

    for (const file of req.files) {
      try {
        if (hasDrive) {
          // --- UPLOAD JOB: Stream directly to Google Drive ---
          logger.info(`[Upload Job] Streaming "${file.originalname}" directly to Google Drive folder ${room.driveFolderId}...`);

          const driveFile = await driveProvider.uploadFile(user, file, room.driveFolderId);

          // Delete temporary local file immediately (Never keep permanently on Node server)
          if (file.path && fs.existsSync(file.path)) {
            try {
              fs.unlinkSync(file.path);
            } catch (unlinkErr) {
              logger.warn(`Could not delete temp file ${file.path}: ${unlinkErr.message}`);
            }
          }

          // Create Photo document in MongoDB with UPLOADED uploadStatus & QUEUED indexingStatus
          const photo = await Photo.create({
            roomId: room._id,
            storageProvider: 'google-drive',
            storage: {
              fileId: driveFile.id,
              folderId: room.driveFolderId,
              fileName: file.originalname,
              mimeType: file.mimetype,
              size: file.size,
            },
            processing: {
              uploadStatus: 'UPLOADED',
              indexingStatus: 'QUEUED',
              status: 'QUEUED',
            },
            indexed: false,
          });

          photos.push(photo);
        } else {
          // --- UPLOAD JOB: Upload to Local Storage ---
          const photo = await Photo.create({
            roomId: room._id,
            storageProvider: 'local',
            storage: {
              fileId: file.filename,
              fileName: file.originalname,
              mimeType: file.mimetype,
              size: file.size,
              localPath: file.path,
            },
            processing: {
              uploadStatus: 'UPLOADED',
              indexingStatus: 'QUEUED',
              status: 'QUEUED',
            },
            indexed: false,
          });

          photos.push(photo);
        }
      } catch (fileErr) {
        logger.error(`[Upload Job Failed] File ${file.originalname}:`, fileErr.message);
      }
    }

    if (photos.length === 0) {
      return res.status(500).json({ error: 'Failed to process photo upload.' });
    }

    // High-performance bulk enqueue operation into BullMQ Redis Queue
    await enqueuePhotoIndexingBatch(photos, room._id, user);

    // Respond immediately to client
    res.status(201).json({
      message: `${photos.length} photo(s) uploaded and safely queued into BullMQ Redis queue.`,
      photosCount: photos.length,
      storageProvider: hasDrive ? 'google-drive' : 'local',
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/rooms/:roomId/photos
export const getRoomPhotos = async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const photos = await Photo.find({ roomId: req.room._id })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Photo.countDocuments({ roomId: req.room._id });

    res.json({
      photos,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/photos/:photoId — Serve a photo image (Local file or Drive proxy via StorageService)
export const getPhoto = async (req, res, next) => {
  try {
    const photo = await Photo.findById(req.params.photoId);
    if (!photo) {
      return res.status(404).json({ error: 'Photo not found.' });
    }

    const providerName = photo.storageProvider || (photo.driveFileId ? 'google-drive' : 'local');
    const fileId = photo.storage?.fileId || photo.driveFileId || photo.storage?.localPath || photo.localPath;

    if (!fileId) {
      return res.status(404).json({ error: 'Photo file identifier missing.' });
    }

    try {
      const { getStorageProvider } = await import('../services/storage.service.js');
      const provider = getStorageProvider(providerName);
      res.setHeader('Content-Type', photo.mimeType || 'image/jpeg');
      const stream = await provider.getFileStream(req.user, fileId);
      return stream.pipe(res);
    } catch (err) {
      logger.error(`Failed to stream photo ${photo._id} via ${providerName}:`, err.message);
      return res.status(502).json({ error: 'Failed to retrieve photo file from storage provider.' });
    }
  } catch (error) {
    next(error);
  }
};

// POST /api/rooms/:roomId/index — Trigger face indexing via BullMQ Queue
export const indexPhotos = async (req, res, next) => {
  try {
    if (!req.canUpload) {
      return res.status(403).json({ error: 'You do not have permission to start indexing.' });
    }

    const unindexedPhotos = await Photo.find({
      roomId: req.room._id,
      indexed: false,
    });

    if (unindexedPhotos.length === 0) {
      return res.json({ message: 'All photos are already indexed.' });
    }

    // Bulk enqueue into BullMQ Redis Queue
    await enqueuePhotoIndexingBatch(unindexedPhotos, req.room._id, req.user);

    res.json({ message: `Indexing safely queued into BullMQ for ${unindexedPhotos.length} photo(s).` });
  } catch (error) {
    next(error);
  }
};

// GET /api/rooms/:roomId/index/status
export const getIndexStatus = async (req, res) => {
  const room = req.room;
  res.json({
    status: room.status,
    total: room.totalPhotos,
    processed: room.processedPhotos,
    facesDetected: room.facesDetected,
  });
};
