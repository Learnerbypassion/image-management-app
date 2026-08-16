import Photo from '../models/Photo.js';
import FaceEmbedding from '../models/FaceEmbedding.js';
import Room from '../models/Room.js';
import User from '../models/User.js';
import { getStorageProvider } from './storage.service.js';
import { enqueuePhotoIndexingBatch } from '../queues/indexing.queue.js';
import { classifyDriveError, handleDriveAuthError } from '../utils/driveErrors.js';
import { emitToRoom } from '../config/socket.js';
import logger from '../utils/logger.js';

/**
 * Sync interval → milliseconds mapping
 */
export const INTERVAL_MS = {
  '5m': 5 * 60 * 1000,
  '15m': 15 * 60 * 1000,
  '30m': 30 * 60 * 1000,
  '1h': 60 * 60 * 1000,
  'manual': null,
};

/**
 * Calculate next sync timestamp from now based on interval string.
 */
export const getNextSyncAt = (interval) => {
  const ms = INTERVAL_MS[interval];
  if (!ms) return null;
  return new Date(Date.now() + ms);
};

/**
 * Core Drive Sync Engine
 *
 * Compares the current state of a Google Drive folder against the MongoDB Photo
 * records for a room. Classifies each file as NEW, MODIFIED, DELETED, or UNCHANGED.
 *
 * @param {Object} room - Room Mongoose document
 * @param {Object} user - User Mongoose document (room owner with Drive credentials)
 * @returns {{ newCount: number, modifiedCount: number, deletedCount: number, unchangedCount: number }}
 */
export const syncRoom = async (room, user) => {
  if (!room.driveFolderId) {
    throw new Error('No Drive folder linked to this room.');
  }
  if (!user?.googleTokens?.isConnected) {
    throw new Error('Google Drive is not connected for the room owner.');
  }

  const roomId = room._id;

  // Mark sync as in-progress
  await Room.findByIdAndUpdate(roomId, {
    'sync.status': 'syncing',
    'sync.lastSyncStartedAt': new Date(),
    'sync.error': null,
  });

  emitToRoom(roomId, 'sync:started', {
    roomId: roomId.toString(),
    timestamp: new Date().toISOString(),
  });

  let driveFiles;
  try {
    const driveProvider = getStorageProvider('google-drive');
    driveFiles = await driveProvider.listFiles(user, room.driveFolderId);
  } catch (err) {
    const classified = classifyDriveError(err);
    logger.error(`[Sync] Drive API error for room ${roomId}: ${classified.code} — ${classified.message}`);

    if (classified.requiresReconnect) {
      await handleDriveAuthError(user, room, classified.code);
    } else {
      await Room.findByIdAndUpdate(roomId, {
        'sync.status': 'error',
        'sync.error': classified.code,
      });
    }
    throw err;
  }

  // Build a map of Drive files: { driveFileId → driveFile }
  const driveFileMap = new Map();
  for (const df of driveFiles) {
    driveFileMap.set(df.id, df);
  }

  // Fetch all existing Photo records for this room with Drive file IDs
  const existingPhotos = await Photo.find({
    roomId,
    storageProvider: 'google-drive',
  }).lean();

  // Build a map of existing DB photos: { driveFileId → photoDoc }
  const dbPhotoMap = new Map();
  for (const photo of existingPhotos) {
    const fileId = photo.storage?.fileId;
    if (fileId) {
      dbPhotoMap.set(fileId, photo);
    }
  }

  let newCount = 0;
  let modifiedCount = 0;
  let deletedCount = 0;
  let unchangedCount = 0;
  const photosToEnqueue = [];

  // --- Detect NEW and MODIFIED files ---
  for (const [driveFileId, driveFile] of driveFileMap) {
    const existingPhoto = dbPhotoMap.get(driveFileId);

    if (!existingPhoto) {
      // NEW file — not in DB yet
      const photo = await Photo.create({
        roomId,
        storageProvider: 'google-drive',
        storage: {
          fileId: driveFile.id,
          folderId: room.driveFolderId,
          fileName: driveFile.name,
          mimeType: driveFile.mimeType || 'image/jpeg',
          size: driveFile.size ? parseInt(driveFile.size) : 0,
          width: driveFile.imageMediaMetadata?.width || null,
          height: driveFile.imageMediaMetadata?.height || null,
          driveModifiedTime: driveFile.modifiedTime || null,
          md5Checksum: driveFile.md5Checksum || null,
        },
        syncAction: 'NEW',
        processing: {
          uploadStatus: 'UPLOADED',
          indexingStatus: 'QUEUED',
          status: 'QUEUED',
        },
        indexed: false,
      });
      photosToEnqueue.push(photo);
      newCount++;
    } else {
      // File exists in DB — check if MODIFIED
      const dbModifiedTime = existingPhoto.storage?.driveModifiedTime;
      const dbMd5 = existingPhoto.storage?.md5Checksum;
      const driveModifiedTime = driveFile.modifiedTime;
      const driveMd5 = driveFile.md5Checksum;

      const isModified =
        (driveModifiedTime && dbModifiedTime && driveModifiedTime !== dbModifiedTime) ||
        (driveMd5 && dbMd5 && driveMd5 !== dbMd5);

      if (isModified) {
        // MODIFIED — update metadata and re-enqueue for indexing
        await Photo.findByIdAndUpdate(existingPhoto._id, {
          'storage.driveModifiedTime': driveModifiedTime,
          'storage.md5Checksum': driveMd5,
          'storage.fileName': driveFile.name,
          'storage.size': driveFile.size ? parseInt(driveFile.size) : existingPhoto.storage?.size,
          syncAction: 'MODIFIED',
          indexed: false,
          facesFound: 0,
          'processing.indexingStatus': 'QUEUED',
          'processing.status': 'QUEUED',
          'processing.lastError': null,
          'processing.failureCode': null,
        });

        // Delete old face embeddings for this photo (will be regenerated)
        await FaceEmbedding.deleteMany({ photoId: existingPhoto._id });

        photosToEnqueue.push({ _id: existingPhoto._id });
        modifiedCount++;
      } else {
        // UNCHANGED — skip
        unchangedCount++;
      }
    }
  }

  // --- Detect DELETED files (in DB but not in Drive) ---
  for (const [dbFileId, dbPhoto] of dbPhotoMap) {
    if (!driveFileMap.has(dbFileId)) {
      // File no longer in Drive — mark as deleted
      await Photo.findByIdAndUpdate(dbPhoto._id, {
        syncAction: 'DELETED',
        indexed: false,
        'processing.indexingStatus': 'PERMANENTLY_FAILED',
        'processing.status': 'PERMANENTLY_FAILED',
        'processing.lastError': 'File deleted from Google Drive.',
        'processing.failureCode': 'DRIVE_DOWNLOAD_FAILED',
      });

      // Remove face embeddings for deleted photo
      await FaceEmbedding.deleteMany({ photoId: dbPhoto._id });

      deletedCount++;
    }
  }

  // --- Enqueue new/modified photos for face indexing ---
  if (photosToEnqueue.length > 0) {
    await enqueuePhotoIndexingBatch(photosToEnqueue, roomId, user);
  }

  // --- Update room sync state ---
  const now = new Date();
  const totalPhotos = await Photo.countDocuments({ roomId, syncAction: { $ne: 'DELETED' } });
  const indexedPhotos = await Photo.countDocuments({ roomId, indexed: true, syncAction: { $ne: 'DELETED' } });
  const totalFaces = await FaceEmbedding.countDocuments({ roomId });

  const isReady = photosToEnqueue.length === 0 && totalPhotos > 0;

  await Room.findByIdAndUpdate(roomId, {
    'sync.status': 'idle',
    'sync.lastSyncedAt': now,
    'sync.lastSyncCompletedAt': now,
    'sync.nextSyncAt': getNextSyncAt(room.sync?.interval || '5m'),
    'sync.error': null,
    totalPhotos,
    processedPhotos: indexedPhotos,
    facesDetected: totalFaces,
    status: isReady ? 'ready' : (photosToEnqueue.length > 0 ? 'indexing' : 'created'),
  });

  // Emit sync completion to connected clients
  emitToRoom(roomId, 'sync:complete', {
    roomId: roomId.toString(),
    newCount,
    modifiedCount,
    deletedCount,
    unchangedCount,
    totalPhotos,
    timestamp: now.toISOString(),
  });

  logger.info(
    `[Sync] Room ${roomId} sync complete: ` +
    `${newCount} new, ${modifiedCount} modified, ${deletedCount} deleted, ${unchangedCount} unchanged`
  );

  return { newCount, modifiedCount, deletedCount, unchangedCount };
};

export default { syncRoom, getNextSyncAt, INTERVAL_MS };
