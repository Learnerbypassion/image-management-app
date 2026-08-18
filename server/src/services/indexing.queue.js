import Photo from '../models/Photo.js';
import FaceEmbedding from '../models/FaceEmbedding.js';
import Room from '../models/Room.js';
import { getStorageProvider } from './storage.service.js';
import env from '../config/env.js';
import logger from '../utils/logger.js';
import axios from 'axios';
import FormData from 'form-data';

/**
 * Asynchronous Indexing Job Processor
 * Processes photos transitioning through: QUEUED -> PROCESSING -> INDEXED / FAILED
 *
 * @param {string} roomId - Room ObjectId
 * @param {Object} user - Authenticated user document
 */
export const processPhotoIndexingQueue = async (roomId, user) => {
  try {
    const room = await Room.findById(roomId);
    if (!room) return;

    // Find all photos ready to be indexed
    const photosToProcess = await Photo.find({
      roomId,
      'processing.status': { $in: ['UPLOADED', 'QUEUED', 'DISCOVERED', 'pending'] },
    });

    if (photosToProcess.length === 0) {
      const finalProcessed = await Photo.countDocuments({ roomId, indexed: true });
      const finalTotal = await Photo.countDocuments({ roomId });
      await Room.findByIdAndUpdate(roomId, {
        status: 'ready',
        totalPhotos: finalTotal,
        processedPhotos: finalProcessed,
        'sync.status': 'idle',
      });
      return;
    }

    // Mark photos as QUEUED
    const photoIds = photosToProcess.map((p) => p._id);
    await Photo.updateMany(
      { _id: { $in: photoIds } },
      { 'processing.status': 'QUEUED' }
    );

    const totalInRoom = await Photo.countDocuments({ roomId });
    const alreadyIndexedCount = await Photo.countDocuments({ roomId, indexed: true });

    await Room.findByIdAndUpdate(roomId, {
      status: 'indexing',
      'sync.status': 'syncing',
      totalPhotos: totalInRoom,
      processedPhotos: alreadyIndexedCount,
    });

    logger.info(`Started Indexing Job for ${photosToProcess.length} photo(s) in room ${roomId}...`);

    const BATCH_SIZE = 3; // Process 3 photos concurrently

    const processOnePhoto = async (photo) => {
      try {
        // Transition state to PROCESSING
        photo.processing.status = 'PROCESSING';
        await photo.save();

        const providerName = photo.storageProvider || room.storageProvider || 'google-drive';
        const provider = getStorageProvider(providerName);
        let imageBuffer;

        if (providerName === 'google-drive') {
          imageBuffer = await provider.getFileBuffer(user, photo.storage.fileId);
        } else {
          const imagePath = photo.storage?.localPath || photo.localPath;
          imageBuffer = await provider.getFileBuffer(user, imagePath);
        }

        const formData = new FormData();
        formData.append('file', imageBuffer, {
          filename: photo.storage?.fileName || 'photo.jpg',
          contentType: photo.storage?.mimeType || 'image/jpeg',
        });

        // Send to Python face detection service
        const response = await axios.post(
          `${env.FACE_SERVICE_URL}/detect`,
          formData,
          {
            headers: formData.getHeaders(),
            timeout: 60000,
          }
        );

        const { faces } = response.data;

        // Store embeddings in MongoDB Vector Search (Idempotent: delete previous embeddings first)
        await FaceEmbedding.deleteMany({ roomId, photoId: photo._id });

        if (faces && faces.length > 0) {
          const embeddings = faces.map((face, index) => ({
            roomId,
            photoId: photo._id,
            faceIndex: index,
            embedding: face.embedding,
            boundingBox: face.bounding_box,
            qualityScore: face.quality_score || 0,
            confidence: face.confidence || 0,
          }));

          await FaceEmbedding.insertMany(embeddings, { ordered: false });
        }

        // Transition state to INDEXED
        photo.indexed = true;
        photo.facesFound = faces?.length || 0;
        photo.processing.status = 'INDEXED';
        photo.processing.processedAt = new Date();
        await photo.save();

        const currentProcessedCount = await Photo.countDocuments({ roomId, indexed: true });
        await Room.findByIdAndUpdate(roomId, {
          processedPhotos: currentProcessedCount,
          $inc: { facesDetected: faces?.length || 0 },
        });

        logger.info(`Photo ${photo._id} successfully INDEXED (${faces?.length || 0} faces).`);
      } catch (err) {
        logger.error(`Photo ${photo._id} indexing FAILED:`, err.message);
        photo.processing.status = 'FAILED';
        photo.processing.error = err.message;
        await photo.save();
      }
    };

    // Process photos in concurrent batches
    for (let i = 0; i < photosToProcess.length; i += BATCH_SIZE) {
      const batch = photosToProcess.slice(i, i + BATCH_SIZE);
      await Promise.allSettled(batch.map(processOnePhoto));
    }

    // Mark room ready when index job completes
    const finalProcessed = await Photo.countDocuments({ roomId, indexed: true });
    const finalTotal = await Photo.countDocuments({ roomId });
    const now = new Date();

    await Room.findByIdAndUpdate(roomId, {
      status: 'ready',
      totalPhotos: finalTotal,
      processedPhotos: finalProcessed,
      'sync.status': 'idle',
      'sync.lastSyncedAt': now,
      'sync.lastSyncCompletedAt': now,
    });

    logger.success(`Indexing Job complete for room ${roomId}. Total: ${finalTotal}, Indexed: ${finalProcessed}`);
  } catch (error) {
    logger.error(`Error processing indexing queue for room ${roomId}:`, error.message);
  }
};

export default {
  processPhotoIndexingQueue,
};
