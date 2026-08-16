import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import Photo from '../models/Photo.js';
import Room from '../models/Room.js';
import { getStorageProvider } from '../services/storage.service.js';
import { enqueuePhotoIndexingBatch } from '../queues/indexing.queue.js';
import logger from '../utils/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CHUNKS_DIR = path.join(__dirname, '../../uploads/chunks');

// Ensure chunks directory exists
if (!fs.existsSync(CHUNKS_DIR)) {
  fs.mkdirSync(CHUNKS_DIR, { recursive: true });
}

// In-memory session store (could be Redis in production)
const uploadSessions = new Map();

// Session cleanup interval (10 minutes)
setInterval(() => {
  const now = Date.now();
  for (const [sessionId, session] of uploadSessions) {
    if (now - session.createdAt > 30 * 60 * 1000) { // 30 min expiry
      // Clean up chunk files
      const sessionDir = path.join(CHUNKS_DIR, sessionId);
      if (fs.existsSync(sessionDir)) {
        fs.rmSync(sessionDir, { recursive: true, force: true });
      }
      uploadSessions.delete(sessionId);
      logger.info(`[ChunkedUpload] Expired session ${sessionId}`);
    }
  }
}, 10 * 60 * 1000);

/**
 * POST /api/rooms/:roomId/upload/init
 * Initialize a chunked upload session for a single file.
 */
export const initUpload = async (req, res, next) => {
  try {
    if (!req.canUpload) {
      return res.status(403).json({ error: 'You do not have upload permission.' });
    }

    const { fileName, fileSize, mimeType, totalChunks } = req.body;

    if (!fileName || !totalChunks) {
      return res.status(400).json({ error: 'fileName and totalChunks are required.' });
    }

    const sessionId = crypto.randomUUID();
    const sessionDir = path.join(CHUNKS_DIR, sessionId);
    fs.mkdirSync(sessionDir, { recursive: true });

    const session = {
      sessionId,
      roomId: req.room._id.toString(),
      userId: req.userId.toString(),
      fileName,
      fileSize: fileSize || 0,
      mimeType: mimeType || 'image/jpeg',
      totalChunks: parseInt(totalChunks),
      receivedChunks: new Set(),
      createdAt: Date.now(),
      sessionDir,
    };

    uploadSessions.set(sessionId, session);

    logger.info(`[ChunkedUpload] Session ${sessionId} initialized: "${fileName}" (${totalChunks} chunks)`);

    res.json({
      sessionId,
      message: 'Upload session initialized.',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/rooms/:roomId/upload/chunk
 * Receive a single chunk.
 * Body: multipart form with `chunk` file, `sessionId`, `chunkIndex`
 */
export const uploadChunk = async (req, res, next) => {
  try {
    const { sessionId, chunkIndex } = req.body;

    if (!sessionId || chunkIndex === undefined) {
      return res.status(400).json({ error: 'sessionId and chunkIndex are required.' });
    }

    const session = uploadSessions.get(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Upload session not found or expired.' });
    }

    if (session.userId !== req.userId.toString()) {
      return res.status(403).json({ error: 'Session does not belong to this user.' });
    }

    const chunkIdx = parseInt(chunkIndex);
    if (chunkIdx < 0 || chunkIdx >= session.totalChunks) {
      return res.status(400).json({ error: `Invalid chunkIndex. Must be 0-${session.totalChunks - 1}.` });
    }

    // Save chunk file
    if (!req.file) {
      return res.status(400).json({ error: 'No chunk data received.' });
    }

    const chunkPath = path.join(session.sessionDir, `chunk_${chunkIdx}`);
    fs.writeFileSync(chunkPath, req.file.buffer);
    session.receivedChunks.add(chunkIdx);

    const progress = Math.round((session.receivedChunks.size / session.totalChunks) * 100);

    res.json({
      message: `Chunk ${chunkIdx + 1}/${session.totalChunks} received.`,
      receivedChunks: session.receivedChunks.size,
      totalChunks: session.totalChunks,
      progress,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/rooms/:roomId/upload/complete
 * Finalize the upload: reassemble chunks, upload to Drive, create Photo record, enqueue indexing.
 */
export const completeUpload = async (req, res, next) => {
  try {
    const { sessionId } = req.body;

    if (!sessionId) {
      return res.status(400).json({ error: 'sessionId is required.' });
    }

    const session = uploadSessions.get(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Upload session not found or expired.' });
    }

    if (session.userId !== req.userId.toString()) {
      return res.status(403).json({ error: 'Session does not belong to this user.' });
    }

    // Check all chunks received
    if (session.receivedChunks.size < session.totalChunks) {
      const missing = [];
      for (let i = 0; i < session.totalChunks; i++) {
        if (!session.receivedChunks.has(i)) missing.push(i);
      }
      return res.status(400).json({
        error: `Missing ${missing.length} chunk(s).`,
        missingChunks: missing,
      });
    }

    // Reassemble file from chunks
    const buffers = [];
    for (let i = 0; i < session.totalChunks; i++) {
      const chunkPath = path.join(session.sessionDir, `chunk_${i}`);
      buffers.push(fs.readFileSync(chunkPath));
    }
    const fileBuffer = Buffer.concat(buffers);

    const room = await Room.findById(session.roomId);
    if (!room) {
      return res.status(404).json({ error: 'Room not found.' });
    }

    // Check if room has Google Drive linked
    const hasDrive = (room.storageProvider === 'google-drive' || !room.storageProvider) &&
                     room.driveFolderId &&
                     req.user?.googleTokens?.isConnected;

    let photo;

    if (hasDrive) {
      // Upload to Drive
      const driveProvider = getStorageProvider('google-drive');
      const driveFile = await driveProvider.uploadFile(
        req.user,
        {
          buffer: fileBuffer,
          originalname: session.fileName,
          mimetype: session.mimeType,
        },
        room.driveFolderId
      );

      // Get metadata for modifiedTime/md5
      let driveMetadata = {};
      try {
        driveMetadata = await driveProvider.getMetadata(req.user, driveFile.id);
      } catch (e) {
        // Non-critical
      }

      photo = await Photo.create({
        roomId: room._id,
        storageProvider: 'google-drive',
        storage: {
          fileId: driveFile.id,
          folderId: room.driveFolderId,
          fileName: driveFile.name || session.fileName,
          mimeType: session.mimeType,
          size: fileBuffer.length,
          driveModifiedTime: driveMetadata.modifiedTime || null,
          md5Checksum: driveMetadata.md5Checksum || null,
        },
        syncAction: 'NEW',
        processing: {
          uploadStatus: 'UPLOADED',
          indexingStatus: 'QUEUED',
          status: 'QUEUED',
        },
        indexed: false,
      });
    } else {
      // Local storage fallback
      const uploadsDir = path.join(__dirname, '../../uploads');
      const localFileName = `${Date.now()}_${session.fileName}`;
      const localPath = path.join(uploadsDir, localFileName);
      fs.writeFileSync(localPath, fileBuffer);

      photo = await Photo.create({
        roomId: room._id,
        storageProvider: 'local',
        storage: {
          fileName: session.fileName,
          mimeType: session.mimeType,
          size: fileBuffer.length,
          localPath: localPath,
        },
        syncAction: 'NEW',
        processing: {
          uploadStatus: 'UPLOADED',
          indexingStatus: 'QUEUED',
          status: 'QUEUED',
        },
        indexed: false,
      });
    }

    // Enqueue for face indexing
    await enqueuePhotoIndexingBatch([photo], room._id, req.user);

    // Clean up chunks
    if (fs.existsSync(session.sessionDir)) {
      fs.rmSync(session.sessionDir, { recursive: true, force: true });
    }
    uploadSessions.delete(sessionId);

    logger.info(`[ChunkedUpload] Session ${sessionId} completed: "${session.fileName}" → Photo ${photo._id}`);

    res.json({
      message: `File "${session.fileName}" uploaded and queued for indexing.`,
      photoId: photo._id,
    });
  } catch (error) {
    next(error);
  }
};
