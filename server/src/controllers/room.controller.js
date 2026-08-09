import Room from '../models/Room.js';
import { generateRoomCode } from '../utils/crypto.js';

// POST /api/rooms
export const createRoom = async (req, res, next) => {
  try {
    const { name, organization, description } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Room name is required.' });
    }

    // Generate unique room code
    let code;
    let attempts = 0;
    do {
      code = generateRoomCode();
      const existing = await Room.findOne({ code });
      if (!existing) break;
      attempts++;
    } while (attempts < 10);

    if (attempts >= 10) {
      return res.status(500).json({ error: 'Failed to generate unique room code.' });
    }

    const room = await Room.create({
      name,
      code,
      organization: organization || '',
      description: description || '',
      ownerId: req.userId,
      members: [req.userId],
    });

    res.status(201).json({ room });
  } catch (error) {
    next(error);
  }
};

// GET /api/rooms
export const getMyRooms = async (req, res, next) => {
  try {
    const rooms = await Room.find({
      $or: [
        { ownerId: req.userId },
        { members: req.userId },
      ],
    }).sort({ createdAt: -1 });

    res.json({ rooms });
  } catch (error) {
    next(error);
  }
};

// GET /api/rooms/:roomId
export const getRoom = async (req, res) => {
  // Room already attached by roomAccess middleware
  res.json({ room: req.room });
};

// POST /api/rooms/join
export const joinRoom = async (req, res, next) => {
  try {
    const { code } = req.body;

    if (!code) {
      return res.status(400).json({ error: 'Room code is required.' });
    }

    const room = await Room.findOne({ code: code.toUpperCase() });
    if (!room) {
      return res.status(404).json({ error: 'No room found with that code.' });
    }

    // Check if already a member
    const isMember = room.members.some(
      (memberId) => memberId.toString() === req.userId.toString()
    );

    if (!isMember) {
      room.members.push(req.userId);
      await room.save();
    }

    res.json({ room });
  } catch (error) {
    next(error);
  }
};

// DELETE /api/rooms/:roomId
export const deleteRoom = async (req, res, next) => {
  try {
    if (!req.isRoomOwner) {
      return res.status(403).json({ error: 'Only the room owner can delete this room.' });
    }

    await Room.findByIdAndDelete(req.params.roomId);

    res.json({ message: 'Room deleted successfully.' });
  } catch (error) {
    next(error);
  }
};
