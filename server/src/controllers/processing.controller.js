import Photo from '../models/Photo.js';
import Room from '../models/Room.js';
import { enqueuePhotoIndexingBatch, pauseIndexingQueue, resumeIndexingQueue } from '../queues/indexing.queue.js';
import { checkRedisHealth } from '../config/redis.js';
import env from '../config/env.js';
import axios from 'axios';
import logger from '../utils/logger.js';

/**
 * GET /api/rooms/:roomId/processing
 * Absolute source of truth for processing progress, failure breakdown, and system health
 */
export const getProcessingStatus = async (req, res, next) => {
  try {
    const roomId = req.room._id;

    const [total, uploaded, queued, processing, indexed, failed, permanentlyFailed] = await Promise.all([
      Photo.countDocuments({ roomId }),
      Photo.countDocuments({ roomId, 'processing.uploadStatus': 'UPLOADED' }),
      Photo.countDocuments({ roomId, 'processing.indexingStatus': 'QUEUED' }),
      Photo.countDocuments({ roomId, 'processing.indexingStatus': 'PROCESSING' }),
      Photo.countDocuments({ roomId, indexed: true }),
      Photo.countDocuments({ roomId, 'processing.indexingStatus': 'FAILED' }),
      Photo.countDocuments({ roomId, 'processing.indexingStatus': 'PERMANENTLY_FAILED' }),
    ]);

    // Aggregate failure reason categories
    const failureAggregate = await Photo.aggregate([
      {
        $match: {
          roomId,
          'processing.indexingStatus': { $in: ['FAILED', 'PERMANENTLY_FAILED'] },
        },
      },
      {
        $group: {
          _id: { $ifNull: ['$processing.failureCode', 'UNKNOWN'] },
          count: { $sum: 1 },
        },
      },
    ]);

    const failureBreakdown = {};
    failureAggregate.forEach((item) => {
      failureBreakdown[item._id] = item.count;
    });

    // Check system health components
    const isRedisHealthy = await checkRedisHealth();

    let isFaceServiceHealthy = false;
    try {
      const ping = await axios.get(`${env.FACE_SERVICE_URL}/health`, { timeout: 3000 });
      isFaceServiceHealthy = ping.status === 200;
    } catch (err) {
      isFaceServiceHealthy = false;
    }

    const isDriveConnected = !!req.user?.googleTokens?.isConnected;

    res.json({
      roomId: roomId.toString(),
      status: req.room.status,
      metrics: {
        total,
        uploaded,
        queued,
        processing,
        indexed,
        failed,
        permanentlyFailed,
      },
      failureBreakdown,
      systemHealth: {
        redis: isRedisHealthy,
        faceService: isFaceServiceHealthy,
        driveConnected: isDriveConnected,
        workers: isRedisHealthy && isFaceServiceHealthy ? 'Active' : 'Degraded',
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/rooms/:roomId/processing/retry
 * Re-enqueue failed jobs into BullMQ Redis Queue
 */
export const retryFailedJobs = async (req, res, next) => {
  try {
    if (!req.canUpload) {
      return res.status(403).json({ error: 'Only authorized members can retry indexing.' });
    }

    const { includePermanentlyFailed = false } = req.body;
    const targetStatuses = includePermanentlyFailed
      ? ['FAILED', 'PERMANENTLY_FAILED']
      : ['FAILED'];

    const failedPhotos = await Photo.find({
      roomId: req.room._id,
      'processing.indexingStatus': { $in: targetStatuses },
    });

    if (failedPhotos.length === 0) {
      return res.json({ message: 'No eligible failed photos found for retry.' });
    }

    // Reset status to QUEUED
    await Photo.updateMany(
      { _id: { $in: failedPhotos.map((p) => p._id) } },
      {
        'processing.indexingStatus': 'QUEUED',
        'processing.status': 'QUEUED',
        'processing.lastError': null,
        'processing.failureCode': null,
      }
    );

    // Enqueue into BullMQ via addBulk()
    await enqueuePhotoIndexingBatch(failedPhotos, req.room._id, req.user);

    res.json({
      message: `Re-queued ${failedPhotos.length} failed photo(s) for indexing retry.`,
      count: failedPhotos.length,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/rooms/:roomId/processing/pause
 * Pause waiting jobs in photo-indexing queue
 */
export const pauseProcessing = async (req, res, next) => {
  try {
    if (!req.canUpload) {
      return res.status(403).json({ error: 'Permission denied.' });
    }

    await pauseIndexingQueue();
    await Room.findByIdAndUpdate(req.room._id, { 'sync.status': 'paused' });

    res.json({ message: 'Indexing queue paused. Active jobs will finish; waiting jobs are held.' });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/rooms/:roomId/processing/resume
 * Resume waiting jobs in photo-indexing queue
 */
export const resumeProcessing = async (req, res, next) => {
  try {
    if (!req.canUpload) {
      return res.status(403).json({ error: 'Permission denied.' });
    }

    await resumeIndexingQueue();
    await Room.findByIdAndUpdate(req.room._id, { 'sync.status': 'syncing' });

    res.json({ message: 'Indexing queue resumed.' });
  } catch (error) {
    next(error);
  }
};
