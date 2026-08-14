import Room from '../models/Room.js';

/**
 * Room access middleware.
 *
 * Attaches to req:
 *   req.room          - Room document
 *   req.isRoomOwner   - true if the user is the room owner
 *   req.memberRole    - 'OWNER' | 'PHOTOGRAPHER' | 'PARTICIPANT' | null
 *   req.canUpload     - true if the user can upload/index photos
 *   req.membership    - the user's membership subdocument (or null)
 */
const roomAccess = async (req, res, next) => {
  try {
    const { roomId } = req.params;

    const room = await Room.findById(roomId);
    if (!room) {
      return res.status(404).json({ error: 'Room not found.' });
    }

    const userId = req.userId.toString();
    const isOwner = room.ownerId.toString() === userId;

    // Find active membership entry
    const membership = room.members.find(
      (m) => m.userId.toString() === userId && m.status === 'ACTIVE'
    );

    if (!isOwner && !membership) {
      return res.status(403).json({ error: 'You do not have access to this room.' });
    }

    const memberRole = isOwner ? 'OWNER' : (membership?.role || null);

    // Upload permission logic:
    //   OWNER          → always allowed
    //   PHOTOGRAPHER   → only if uploadPermission === 'APPROVED'
    //   PARTICIPANT    → never allowed
    const canUpload = isOwner || (
      memberRole === 'PHOTOGRAPHER' && membership?.uploadPermission === 'APPROVED'
    );

    req.room = room;
    req.isRoomOwner = isOwner;
    req.memberRole = memberRole;
    req.canUpload = canUpload;
    req.membership = membership || null;
    next();
  } catch (error) {
    next(error);
  }
};

export default roomAccess;
