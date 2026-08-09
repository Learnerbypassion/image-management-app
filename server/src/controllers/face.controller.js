import axios from 'axios';
import FormData from 'form-data';
import FaceEmbedding from '../models/FaceEmbedding.js';
import Photo from '../models/Photo.js';
import env from '../config/env.js';
import logger from '../utils/logger.js';

const SIMILARITY_THRESHOLD = parseFloat(process.env.SIMILARITY_THRESHOLD || '0.5');

// POST /api/rooms/:roomId/match — Selfie matching
export const matchSelfie = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No selfie image provided.' });
    }

    // 1. Send selfie to face service
    const formData = new FormData();
    formData.append('file', req.file.buffer, {
      filename: 'selfie.jpg',
      contentType: req.file.mimetype,
    });

    let faceResponse;
    try {
      faceResponse = await axios.post(
        `${env.FACE_SERVICE_URL}/detect`,
        formData,
        {
          headers: formData.getHeaders(),
          timeout: 30000,
        }
      );
    } catch (err) {
      logger.error('Face service error:', err.message);
      return res.status(503).json({
        error: 'Face detection service is unavailable. Please try again.',
      });
    }

    const { faces } = faceResponse.data;

    // 2. Validate: exactly one face
    if (!faces || faces.length === 0) {
      return res.status(400).json({
        error: 'No face detected in your selfie. Please take another photo with your face clearly visible.',
      });
    }

    if (faces.length > 1) {
      return res.status(400).json({
        error: 'Multiple faces detected. Please take a selfie with only your face visible.',
      });
    }

    const selfieEmbedding = faces[0].embedding;

    // 3. Quality check
    if (faces[0].quality_score < 0.3) {
      return res.status(400).json({
        error: 'Selfie quality is too low. Please ensure good lighting and face visibility.',
      });
    }

    // 4. MongoDB Vector Search
    const roomId = req.room._id;

    const matchingFaces = await FaceEmbedding.aggregate([
      {
        $vectorSearch: {
          index: 'face_vector_index',
          path: 'embedding',
          queryVector: selfieEmbedding,
          numCandidates: 200,
          limit: 100,
          filter: {
            roomId: roomId,
          },
        },
      },
      {
        $addFields: {
          score: { $meta: 'vectorSearchScore' },
        },
      },
      {
        $match: {
          score: { $gte: SIMILARITY_THRESHOLD },
        },
      },
      {
        $project: {
          photoId: 1,
          score: 1,
          boundingBox: 1,
        },
      },
    ]);

    // 5. Deduplicate by photoId
    const photoIdSet = new Set();
    const uniqueMatches = [];
    for (const face of matchingFaces) {
      const photoIdStr = face.photoId.toString();
      if (!photoIdSet.has(photoIdStr)) {
        photoIdSet.add(photoIdStr);
        uniqueMatches.push({
          photoId: face.photoId,
          score: face.score,
        });
      }
    }

    // 6. Fetch photo details
    const photoIds = uniqueMatches.map((m) => m.photoId);
    const photos = await Photo.find({ _id: { $in: photoIds } });

    // Attach scores to photos
    const photosWithScores = photos.map((photo) => {
      const match = uniqueMatches.find(
        (m) => m.photoId.toString() === photo._id.toString()
      );
      return {
        ...photo.toObject(),
        matchScore: match?.score || 0,
      };
    });

    // Sort by score descending
    photosWithScores.sort((a, b) => b.matchScore - a.matchScore);

    res.json({
      count: photosWithScores.length,
      photos: photosWithScores,
    });
  } catch (error) {
    next(error);
  }
};
