import { Worker } from 'bullmq';
import axios from 'axios';
import FormData from 'form-data';
import { redisConnectionOptions } from '../config/redis.js';
import { QUEUE_NAME } from '../queues/indexing.queue.js';
import Photo from '../models/Photo.js';
import FaceEmbedding from '../models/FaceEmbedding.js';
import Room from '../models/Room.js';
import User from '../models/User.js';
import { getStorageProvider } from '../services/storage.service.js';
import { emitToRoom } from '../config/socket.js';
import env from '../config/env.js';
import logger from '../utils/logger.js';

/**
 * Emit aggregated processing progress summary for room UI
 */
export const broadcastRoomProgressSummary = async (roomId) => {
  try {
    const [total, uploaded, queued, processing, indexed, failed] = await Promise.all([
      Photo.countDocuments({ roomId }),
      Photo.countDocuments({ roomId, 'processing.uploadStatus': 'UPLOADED' }),
      Photo.countDocuments({ roomId, 'processing.indexingStatus': 'QUEUED' }),
      Photo.countDocuments({ roomId, 'processing.indexingStatus': 'PROCESSING' }),
      Photo.countDocuments({ roomId, indexed: true }),
      Photo.countDocuments({
        roomId,
        'processing.indexingStatus': { $in: ['FAILED', 'PERMANENTLY_FAILED'] },
      }),
    ]);

    const isComplete = (indexed + failed) >= total && total > 0;
    const roomStatus = isComplete ? 'ready' : 'indexing';

    await Room.findByIdAndUpdate(roomId, {
      totalPhotos: total,
      processedPhotos: indexed,
      status: roomStatus,
      'sync.status': isComplete ? 'idle' : 'syncing',
    });

    // Emit light metadata summary to room channel
    emitToRoom(roomId, 'processing:summary', {
      roomId: roomId.toString(),
      total,
      uploaded,
      queued,
      processing,
      indexed,
      failed,
      status: roomStatus,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    logger.error(`Error broadcasting summary for room ${roomId}: ${err.message}`);
  }
};

/**
 * Parse & tag error codes for user UI diagnostics
 */

const categorizeError = (err) => {
  const msg = err.message || '';
  if (msg.includes('Drive') || msg.includes('download') || msg.includes('storage') || err.code === 'ENOENT') {
    return 'DRIVE_DOWNLOAD_FAILED';
  }
  if (msg.includes('ECONNREFUSED') || msg.includes('ENOTFOUND') || msg.includes('502') || msg.includes('503')) {
    return 'FACE_SERVICE_UNAVAILABLE';
  }
  if (msg.includes('timeout') || msg.includes('ETIMEDOUT') || err.code === 'ECONNABORTED') {
    return 'TIMEOUT';
  }
  if (msg.includes('invalid') || msg.includes('corrupt') || msg.includes('image')) {
    return 'INVALID_IMAGE';
  }
  if (msg.includes('auth') || msg.includes('401') || msg.includes('403') || msg.includes('token')) {
    return 'GOOGLE_AUTH_ERROR';
  }
  return 'UNKNOWN';
};

/**
 * Create Indexing BullMQ Worker Process
 */
export const createIndexingWorker = () => {
  const workerConcurrency = env.INDEXING_CONCURRENCY || 3;

  logger.info(`[Worker] Initializing indexing worker with concurrency = ${workerConcurrency}...`);

  const worker = new Worker(
    QUEUE_NAME,
    async (job) => {
      const { photoId, roomId, userId } = job.data;
      const attempt = job.attemptsMade + 1;

      logger.info(`[Worker Job ${job.id}] Attempt ${attempt}/${job.opts.attempts} processing photo ${photoId}...`);

      const photo = await Photo.findById(photoId);
      if (!photo) {
        throw new Error(`Photo ${photoId} not found in database.`);
      }

      const user = userId ? await User.findById(userId) : null;
      const room = await Room.findById(roomId);

      // Transition status to PROCESSING
      photo.processing.indexingStatus = 'PROCESSING';
      photo.processing.status = 'PROCESSING';
      photo.processing.jobId = job.id;
      photo.processing.attempts = attempt;
      photo.processing.lastAttemptAt = new Date();
      await photo.save();

      // Emit processing start summary
      await broadcastRoomProgressSummary(roomId);

      let imageBuffer;
      try {
        const providerName = photo.storageProvider || room?.storageProvider || 'google-drive';
        const provider = getStorageProvider(providerName);

        if (providerName === 'google-drive') {
          imageBuffer = await provider.getFileBuffer(user, photo.storage.fileId);
        } else {
          const imagePath = photo.storage?.localPath || photo.localPath;
          imageBuffer = await provider.getFileBuffer(user, imagePath);
        }
      } catch (storageErr) {
        const failureCode = categorizeError(storageErr);
        photo.processing.failureCode = failureCode;
        photo.processing.lastError = `Storage Fetch Error: ${storageErr.message}`;
        await photo.save();
        throw storageErr;
      }

      // Send to FastAPI Python Face Detection Service
      const formData = new FormData();
      formData.append('file', imageBuffer, {
        filename: photo.storage?.fileName || 'photo.jpg',
        contentType: photo.storage?.mimeType || 'image/jpeg',
      });

      let response;
      try {
        response = await axios.post(`${env.FACE_SERVICE_URL}/detect`, formData, {
          headers: formData.getHeaders(),
          timeout: 60000,
        });
      } catch (serviceErr) {
        const failureCode = categorizeError(serviceErr);
        photo.processing.failureCode = failureCode;
        photo.processing.lastError = `Face Service Error: ${serviceErr.message}`;
        await photo.save();
        throw serviceErr;
      }

      const { faces } = response.data;

      // Idempotency guarantee: delete any previous embeddings for this photo before inserting fresh ones
      await FaceEmbedding.deleteMany({ roomId, photoId });

      if (faces && faces.length > 0) {
        const embeddings = faces.map((face, index) => ({
          roomId,
          photoId,
          faceIndex: index,
          embedding: face.embedding,
          boundingBox: face.bounding_box,
          qualityScore: face.quality_score || 0,
          confidence: face.confidence || 0,
        }));

        await FaceEmbedding.insertMany(embeddings, { ordered: false });
      }

      // Mark photo as INDEXED
      photo.indexed = true;
      photo.facesFound = faces?.length || 0;
      photo.processing.indexingStatus = 'INDEXED';
      photo.processing.status = 'INDEXED';
      photo.processing.failureCode = null;
      photo.processing.lastError = null;
      photo.processing.processedAt = new Date();
      await photo.save();

      // Emit metadata events
      emitToRoom(roomId, 'photo:indexed', {
        roomId,
        photoId,
        facesFound: faces?.length || 0,
        indexedAt: new Date().toISOString(),
      });

      await broadcastRoomProgressSummary(roomId);
      logger.info(`[Worker Job ${job.id}] Photo ${photoId} INDEXED successfully (${faces?.length || 0} faces).`);

      return { photoId, facesFound: faces?.length || 0 };
    },
    {
      connection: redisConnectionOptions,
      concurrency: workerConcurrency,
    }
  );

  worker.on('failed', async (job, err) => {
    if (!job) return;
    const { photoId, roomId } = job.data;
    const isPermanent = job.attemptsMade >= (job.opts.attempts || 3);
    const failureCode = categorizeError(err);

    logger.error(`[Worker Job ${job.id}] Failed attempt ${job.attemptsMade} for photo ${photoId}: ${err.message}`);

    await Photo.findByIdAndUpdate(photoId, {
      'processing.indexingStatus': isPermanent ? 'PERMANENTLY_FAILED' : 'FAILED',
      'processing.status': isPermanent ? 'PERMANENTLY_FAILED' : 'FAILED',
      'processing.lastError': err.message,
      'processing.failureCode': failureCode,
      'processing.nextRetryAt': isPermanent ? null : new Date(Date.now() + Math.pow(2, job.attemptsMade) * 5000),
    });

    emitToRoom(roomId, 'photo:failed', {
      roomId,
      photoId,
      error: err.message,
      failureCode,
      isPermanent,
    });

    await broadcastRoomProgressSummary(roomId);
  });

  return worker;
};

export default createIndexingWorker;
