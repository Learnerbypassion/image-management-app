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

// POST /api/rooms/:roomId/photos — Upload photos (Direct Local -> Google Drive / Local Storage)
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
          // --- YES: Upload directly to Google Drive ---
          logger.info(`Streaming uploaded file "${file.originalname}" directly to Google Drive folder ${room.driveFolderId}...`);

          const driveFile = await driveProvider.uploadFile(user, file, room.driveFolderId);

          // Delete temporary local file immediately (Never keep permanently on Node server)
          if (file.path && fs.existsSync(file.path)) {
            try {
              fs.unlinkSync(file.path);
            } catch (unlinkErr) {
              logger.warn(`Could not delete temp file ${file.path}: ${unlinkErr.message}`);
            }
          }

          // Create Photo document in MongoDB
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
              status: 'pending',
            },
            indexed: false,
          });

          photos.push(photo);
        } else {
          // --- NO: Upload to Local Storage ---
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
              status: 'pending',
            },
            indexed: false,
          });

          photos.push(photo);
        }
      } catch (fileErr) {
        logger.error(`Failed to process upload for file ${file.originalname}:`, fileErr.message);
      }
    }

    if (photos.length === 0) {
      return res.status(500).json({ error: 'Failed to process photo upload.' });
    }

    // Update room photo count & status
    const totalPhotos = await Photo.countDocuments({ roomId: room._id });
    await Room.findByIdAndUpdate(room._id, {
      totalPhotos,
      status: 'indexing',
    });

    // Respond immediately to client
    res.status(201).json({
      message: `${photos.length} photo(s) uploaded to ${hasDrive ? 'Google Drive' : 'Local Storage'} and queued for indexing.`,
      photosCount: photos.length,
      storageProvider: hasDrive ? 'google-drive' : 'local',
    });

    // --- Background Face Indexing Queue Execution ---
    (async () => {
      let processedCount = await Photo.countDocuments({ roomId: room._id, indexed: true });

      for (const photo of photos) {
        try {
          const formData = new FormData();

          if (photo.storageProvider === 'google-drive') {
            const imageBuffer = await driveProvider.getFileBuffer(user, photo.storage.fileId);
            formData.append('file', imageBuffer, {
              filename: photo.storage.fileName || 'photo.jpg',
              contentType: photo.storage.mimeType || 'image/jpeg',
            });
          } else {
            const imagePath = photo.storage?.localPath || photo.localPath;
            if (!imagePath || !fs.existsSync(imagePath)) continue;
            formData.append('file', fs.createReadStream(imagePath), {
              filename: photo.storage?.fileName || photo.fileName || 'photo.jpg',
              contentType: photo.storage?.mimeType || photo.mimeType || 'image/jpeg',
            });
          }

          const response = await axios.post(
            `${env.FACE_SERVICE_URL}/detect`,
            formData,
            {
              headers: formData.getHeaders(),
              timeout: 60000,
            }
          );

          const { faces } = response.data;

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
          }

          photo.indexed = true;
          photo.facesFound = faces?.length || 0;
          photo.processing.status = 'completed';
          await photo.save();

          processedCount++;

          await Room.findByIdAndUpdate(room._id, {
            processedPhotos: processedCount,
            $inc: { facesDetected: faces?.length || 0 },
          });
        } catch (err) {
          logger.error(`Error auto-indexing uploaded photo ${photo._id}:`, err.message);
        }
      }

      await Room.findByIdAndUpdate(room._id, {
        status: 'ready',
        processedPhotos: totalPhotos,
      });
    })();
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
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
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

// POST /api/rooms/:roomId/index — Trigger face indexing
export const indexPhotos = async (req, res, next) => {
  try {
    if (!req.canUpload) {
      return res.status(403).json({ error: 'You do not have permission to start indexing.' });
    }

    const totalPhotos = await Photo.countDocuments({ roomId: req.room._id });
    const indexedPhotosCount = await Photo.countDocuments({ roomId: req.room._id, indexed: true });
    const unindexedPhotos = await Photo.find({
      roomId: req.room._id,
      indexed: false,
    });

    if (unindexedPhotos.length === 0) {
      await Room.findByIdAndUpdate(req.room._id, {
        status: 'ready',
        totalPhotos,
        processedPhotos: indexedPhotosCount,
      });
      return res.json({ message: 'All photos are already indexed.' });
    }

    // Update room status
    await Room.findByIdAndUpdate(req.room._id, {
      status: 'indexing',
      totalPhotos,
      processedPhotos: indexedPhotosCount,
    });

    // Process photos
    let processedCount = indexedPhotosCount;
    let facesCount = 0;

    for (const photo of unindexedPhotos) {
      try {
        // Read the image file
        const imagePath = photo.storage?.localPath || photo.localPath;
        if (!imagePath || !fs.existsSync(imagePath)) {
          logger.warn(`Skipping photo ${photo._id}: file not found at ${imagePath}`);
          continue;
        }

        const fileName = photo.storage?.fileName || photo.fileName || 'photo.jpg';
        const mimeType = photo.storage?.mimeType || photo.mimeType || 'image/jpeg';

        // Send to face service using form-data stream
        const formData = new FormData();
        formData.append('file', fs.createReadStream(imagePath), {
          filename: fileName,
          contentType: mimeType,
        });

        const response = await axios.post(
          `${env.FACE_SERVICE_URL}/detect`,
          formData,
          {
            headers: formData.getHeaders(),
            timeout: 60000, // 60s per photo
          }
        );

        const { faces } = response.data;

        // Store face embeddings
        if (faces && faces.length > 0) {
          const embeddings = faces.map((face) => ({
            roomId: req.room._id,
            photoId: photo._id,
            embedding: face.embedding,
            boundingBox: face.bounding_box,
            qualityScore: face.quality_score,
            confidence: face.confidence,
          }));

          await FaceEmbedding.insertMany(embeddings);
          facesCount += faces.length;
        }

        // Mark photo as indexed
        await Photo.findByIdAndUpdate(photo._id, {
          indexed: true,
          facesFound: faces?.length || 0,
        });

        processedCount++;

        // Update room progress
        await Room.findByIdAndUpdate(req.room._id, {
          processedPhotos: processedCount,
          $inc: { facesDetected: faces?.length || 0 },
        });
      } catch (err) {
        logger.error(`Error processing photo ${photo._id}:`, err.message);
      }
    }

    // Update room status to ready
    await Room.findByIdAndUpdate(req.room._id, {
      status: 'ready',
      processedPhotos: totalPhotos,
    });

    res.json({
      message: 'Indexing complete.',
      processed: processedCount,
      facesDetected: facesCount,
    });
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
