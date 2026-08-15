import axios from 'axios';
import FormData from 'form-data';
import FaceEmbedding from '../models/FaceEmbedding.js';
import Photo from '../models/Photo.js';
import env from '../config/env.js';
import logger from '../utils/logger.js';

const SIMILARITY_THRESHOLD = parseFloat(process.env.SIMILARITY_THRESHOLD || '0.35');

function cosineSimilarity(vecA, vecB) {
  if (!vecA || !vecB || vecA.length !== vecB.length) return 0;
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

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
    if (faces[0].quality_score < 0.2) {
      return res.status(400).json({
        error: 'Selfie quality is too low. Please ensure good lighting and face visibility.',
      });
    }

    // 4. Hybrid Matching (Atlas Vector Search + High-Speed Fallback)
    const roomId = req.room._id;
    let matchingFaces = [];

    // Strategy A: Atlas Vector Search
    try {
      matchingFaces = await FaceEmbedding.aggregate([
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
    } catch (vectorErr) {
      logger.warn(`Atlas $vectorSearch notice (${vectorErr.message}). Switching to room cosine similarity search...`);
    }

    // Strategy B: Exact Room Cosine Similarity Fallback (if Atlas returns empty or error)
    if (!matchingFaces || matchingFaces.length === 0) {
      logger.info(`Running room Cosine Similarity search for room ${roomId}...`);
      const roomEmbeddings = await FaceEmbedding.find({ roomId }).lean();

      matchingFaces = roomEmbeddings
        .map((face) => {
          const sim = cosineSimilarity(selfieEmbedding, face.embedding);
          return {
            photoId: face.photoId,
            score: sim,
            boundingBox: face.boundingBox,
          };
        })
        .filter((face) => face.score >= SIMILARITY_THRESHOLD);
    }

    // 5. Deduplicate by photoId & record highest match score per photo
    const photoScoreMap = new Map();
    for (const face of matchingFaces) {
      const photoIdStr = face.photoId.toString();
      const currentHighest = photoScoreMap.get(photoIdStr) || 0;
      if (face.score > currentHighest) {
        photoScoreMap.set(photoIdStr, face.score);
      }
    }

    // 6. Fetch photo details
    const photoIds = Array.from(photoScoreMap.keys());
    const photos = await Photo.find({ _id: { $in: photoIds } });

    // Attach match scores to photos
    const photosWithScores = photos.map((photo) => {
      const score = photoScoreMap.get(photo._id.toString()) || 0;
      return {
        ...photo.toObject(),
        matchScore: score,
      };
    });

    // Sort by match score descending
    photosWithScores.sort((a, b) => b.matchScore - a.matchScore);

    logger.info(`Match request complete for room ${roomId}: found ${photosWithScores.length} matching photo(s).`);

    res.json({
      count: photosWithScores.length,
      photos: photosWithScores,
    });
  } catch (error) {
    next(error);
  }
};
