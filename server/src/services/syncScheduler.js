import Room from '../models/Room.js';
import User from '../models/User.js';
import { syncRoom, getNextSyncAt } from './driveSync.service.js';
import logger from '../utils/logger.js';

const POLL_INTERVAL_MS = 60 * 1000; // Check every 60 seconds for due rooms
let schedulerInterval = null;

/**
 * Process one sync tick: find all rooms whose sync is due and run syncRoom.
 */
const processSyncTick = async () => {
  try {
    const now = new Date();

    // Find rooms where:
    // 1. sync is enabled
    // 2. interval is not 'manual'
    // 3. Drive folder is linked
    // 4. nextSyncAt <= now (or nextSyncAt is null — first sync)
    // 5. sync is not currently running
    const dueRooms = await Room.find({
      'sync.enabled': true,
      'sync.interval': { $ne: 'manual' },
      'sync.status': { $ne: 'syncing' },
      driveFolderId: { $ne: null },
      $or: [
        { 'sync.nextSyncAt': { $lte: now } },
        { 'sync.nextSyncAt': null },
      ],
    }).lean();

    if (dueRooms.length === 0) return;

    logger.info(`[SyncScheduler] ${dueRooms.length} room(s) due for Drive sync.`);

    for (const room of dueRooms) {
      try {
        // Load the room owner (needs Drive credentials)
        const owner = await User.findById(room.ownerId);
        if (!owner || !owner.googleTokens?.isConnected) {
          // Owner has no Drive connected — skip and set next sync
          await Room.findByIdAndUpdate(room._id, {
            'sync.nextSyncAt': getNextSyncAt(room.sync?.interval || '5m'),
          });
          continue;
        }

        // Load the full Room document (not lean) for syncRoom
        const fullRoom = await Room.findById(room._id);
        if (!fullRoom) continue;

        await syncRoom(fullRoom, owner);
      } catch (roomErr) {
        logger.error(`[SyncScheduler] Sync failed for room ${room._id}: ${roomErr.message}`);
        // Set next sync time even on failure so it retries
        await Room.findByIdAndUpdate(room._id, {
          'sync.nextSyncAt': getNextSyncAt(room.sync?.interval || '5m'),
        });
      }
    }
  } catch (err) {
    logger.error(`[SyncScheduler] Tick error: ${err.message}`);
  }
};

/**
 * Start the sync scheduler. Call once from app.js after DB connection.
 */
export const startSyncScheduler = async () => {
  if (schedulerInterval) {
    logger.warn('[SyncScheduler] Already running.');
    return;
  }

  logger.info(`[SyncScheduler] Starting Drive sync scheduler (polling every ${POLL_INTERVAL_MS / 1000}s)...`);

  // Initialize nextSyncAt for rooms that don't have it set yet
  const roomsWithoutNextSync = await Room.find({
    'sync.enabled': true,
    'sync.interval': { $ne: 'manual' },
    driveFolderId: { $ne: null },
    'sync.nextSyncAt': null,
  });

  for (const room of roomsWithoutNextSync) {
    room.sync.nextSyncAt = getNextSyncAt(room.sync?.interval || '5m');
    await room.save();
  }

  if (roomsWithoutNextSync.length > 0) {
    logger.info(`[SyncScheduler] Initialized nextSyncAt for ${roomsWithoutNextSync.length} room(s).`);
  }

  // Start the polling loop
  schedulerInterval = setInterval(processSyncTick, POLL_INTERVAL_MS);

  // Run one tick immediately
  processSyncTick();
};

/**
 * Stop the sync scheduler gracefully.
 */
export const stopSyncScheduler = () => {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    logger.info('[SyncScheduler] Stopped.');
  }
};

/**
 * Force-register a room for sync (e.g. after linking a Drive folder).
 */
export const registerRoomForSync = async (roomId, interval = '5m') => {
  await Room.findByIdAndUpdate(roomId, {
    'sync.enabled': true,
    'sync.interval': interval,
    'sync.nextSyncAt': getNextSyncAt(interval),
  });
  logger.info(`[SyncScheduler] Room ${roomId} registered for ${interval} sync.`);
};

/**
 * Unregister a room from sync (e.g. after unlinking Drive folder or switching to manual).
 */
export const unregisterRoomFromSync = async (roomId) => {
  await Room.findByIdAndUpdate(roomId, {
    'sync.enabled': false,
    'sync.nextSyncAt': null,
  });
  logger.info(`[SyncScheduler] Room ${roomId} unregistered from scheduled sync.`);
};

export default {
  startSyncScheduler,
  stopSyncScheduler,
  registerRoomForSync,
  unregisterRoomFromSync,
};
