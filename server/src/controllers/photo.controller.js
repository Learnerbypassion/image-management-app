import fs from 'fs';
import path from 'path';
import axios from 'axios';
import Photo from '../models/Photo.js';
import FaceEmbedding from '../models/FaceEmbedding.js';
import Room from '../models/Room.js';
import env from '../config/env.js';
import logger from '../utils/logger.js';

// POST /api/rooms/:roomId/photos — Upload photos (Phase 2: local upload)
export const uploadPhotos = async (req, res, next) => {
  try {
    if (!req.isRoomOwner) {
      return res.status(403).json({ error: 'Only the room owner can upload photos.' });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No photos uploaded.' });
    }

    const photos = [];
    for (const file of req.files) {
      const photo = await Photo.create({
        roomId: req.room._id,
        fileName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        localPath: file.path,
        indexed: false,
      });
      photos.push(photo);
    }

    // Update room photo count
    await Room.findByIdAndUpdate(req.room._id, {
      $inc: { totalPhotos: photos.length },
    });

    res.status(201).json({
      message: `${photos.length} photo(s) uploaded.`,
      photos,
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
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/photos/:photoId — Serve a photo image (Phase 2: local file)
export const getPhoto = async (req, res, next) => {
  try {
    const photo = await Photo.findById(req.params.photoId);
    if (!photo) {
      return res.status(404).json({ error: 'Photo not found.' });
    }

    // Phase 2: serve from local disk
    if (photo.localPath && fs.existsSync(photo.localPath)) {
      return res.sendFile(path.resolve(photo.localPath));
    }

    // Phase 4: would proxy from Google Drive here
    return res.status(404).json({ error: 'Photo file not available.' });
  } catch (error) {
    next(error);
  }
};

// POST /api/rooms/:roomId/index — Trigger face indexing
export const indexPhotos = async (req, res, next) => {
  try {
    if (!req.isRoomOwner) {
      return res.status(403).json({ error: 'Only the room owner can start indexing.' });
    }

    const unindexedPhotos = await Photo.find({
      roomId: req.room._id,
      indexed: false,
    });

    if (unindexedPhotos.length === 0) {
      return res.json({ message: 'All photos are already indexed.' });
    }

    // Update room status
    await Room.findByIdAndUpdate(req.room._id, { status: 'indexing' });

    // Process photos synchronously for Phase 2 (Phase 5 adds BullMQ)
    let processedCount = 0;
    let facesCount = 0;

    for (const photo of unindexedPhotos) {
      try {
        // Read the image file
        const imagePath = photo.localPath;
        if (!imagePath || !fs.existsSync(imagePath)) {
          logger.warn(`Skipping photo ${photo._id}: file not found at ${imagePath}`);
          continue;
        }

        // Send to face service
        const imageBuffer = fs.readFileSync(imagePath);
        const formData = new FormData();
        formData.append('file', new Blob([imageBuffer], { type: photo.mimeType }), photo.fileName);

        const response = await axios.post(
          `${env.FACE_SERVICE_URL}/detect`,
          formData,
          {
            headers: { 'Content-Type': 'multipart/form-data' },
            timeout: 30000, // 30s per photo
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
    await Room.findByIdAndUpdate(req.room._id, { status: 'ready' });

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
