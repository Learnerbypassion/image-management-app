import Room from '../models/Room.js';

const roomAccess = async (req, res, next) => {
  try {
    const { roomId } = req.params;

    const room = await Room.findById(roomId);
    if (!room) {
      return res.status(404).json({ error: 'Room not found.' });
    }

    // Check if user is owner or member
    const isOwner = room.ownerId.toString() === req.userId.toString();
    const isMember = room.members.some(
      (memberId) => memberId.toString() === req.userId.toString()
    );

    if (!isOwner && !isMember) {
      return res.status(403).json({ error: 'You do not have access to this room.' });
    }

    req.room = room;
    req.isRoomOwner = isOwner;
    next();
  } catch (error) {
    next(error);
  }
};

export default roomAccess;
