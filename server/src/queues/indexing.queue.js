import { Queue } from 'bullmq';
import { redisConnectionOptions } from '../config/redis.js';
import Photo from '../models/Photo.js';
import Room from '../models/Room.js';
import logger from '../utils/logger.js';

export const QUEUE_NAME = 'photo-indexing';

export const indexingQueue = new Queue(QUEUE_NAME, {
  connection: redisConnectionOptions,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000, // 5s, 10s, 20s backoff
    },
    removeOnComplete: 500, // keep last 500 completed for audit
    removeOnFail: 1000,
  },
});

indexingQueue.on('error', (err) => {
  // Suppress unhandled connection errors when Redis server is offline
});

/**
 * Bulk enqueue photos into BullMQ Redis Queue
 * @param {Array<Object>} photos - Array of Photo Mongoose documents or plain objects
 * @param {string} roomId - Room ObjectId
 * @param {Object} user - User document / auth context
 */
export const enqueuePhotoIndexingBatch = async (photos, roomId, user) => {
  if (!photos || photos.length === 0) return [];

  const photoIds = photos.map((p) => p._id || p.id);
  await Photo.updateMany(
    { _id: { $in: photoIds } },
    {
      'processing.indexingStatus': 'QUEUED',
      'processing.status': 'QUEUED',
      'processing.queueName': QUEUE_NAME,
    }
  );

  const totalInRoom = await Photo.countDocuments({ roomId });
  const indexedCount = await Photo.countDocuments({ roomId, indexed: true });

  await Room.findByIdAndUpdate(roomId, {
    status: 'indexing',
    'sync.status': 'syncing',
    totalPhotos: totalInRoom,
    processedPhotos: indexedCount,
  });

  try {
    const jobs = photos.map((photo) => {
      const photoId = photo._id ? photo._id.toString() : photo.id;
      return {
        name: 'index-photo',
        data: {
          photoId,
          roomId: roomId.toString(),
          userId: user ? user._id?.toString() : null,
        },
        opts: {
          jobId: `index:${photoId}`, // Deterministic Job ID for Idempotency
        },
      };
    });

    // Execute ONE high-performance bulk enqueue operation into Redis
    const createdJobs = await indexingQueue.addBulk(jobs);
    logger.info(`[BullMQ] Enqueued ${createdJobs.length} photo(s) into "${QUEUE_NAME}" for room ${roomId}.`);
    return createdJobs;
  } catch (err) {
    logger.warn(`[BullMQ] Redis server offline (${err.message}). Falling back to in-memory background processing...`);
    const { processPhotoIndexingQueue } = await import('../services/indexing.queue.js');
    processPhotoIndexingQueue(roomId, user);
    return [];
  }
};

/**
 * Pause queue execution (waiting jobs pause, active jobs complete)
 */
export const pauseIndexingQueue = async () => {
  await indexingQueue.pause();
  logger.info(`[BullMQ] Queue "${QUEUE_NAME}" PAUSED.`);
};

/**
 * Resume queue execution
 */
export const resumeIndexingQueue = async () => {
  await indexingQueue.resume();
  logger.info(`[BullMQ] Queue "${QUEUE_NAME}" RESUMED.`);
};

export default {
  indexingQueue,
  enqueuePhotoIndexingBatch,
  pauseIndexingQueue,
  resumeIndexingQueue,
};
