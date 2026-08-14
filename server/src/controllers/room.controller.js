import Room from '../models/Room.js';
import { generateRoomCode } from '../utils/crypto.js';

// POST /api/rooms
export const createRoom = async (req, res, next) => {
  try {
    const { name, organization, description, storageProvider, driveFolderId, driveFolderName } = req.body;

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
      storageProvider: storageProvider || 'google-drive',
      driveFolderId: driveFolderId || null,
      driveFolderName: driveFolderName || null,
      ownerId: req.userId,
      members: [{
        userId: req.userId,
        role: 'OWNER',
        status: 'ACTIVE',
        uploadPermission: 'APPROVED',
      }],
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
        { 'members.userId': req.userId, 'members.status': 'ACTIVE' },
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

    const userId = req.userId.toString();

    // Check if already an active member
    const existing = room.members.find(
      (m) => m.userId.toString() === userId
    );

    if (existing) {
      if (existing.status === 'ACTIVE') {
        return res.json({ room, message: 'You are already a member of this room.' });
      }
      // Re-activate if previously REMOVED or LEFT
      existing.status = 'ACTIVE';
      existing.joinedAt = new Date();
    } else {
      room.members.push({
        userId: req.userId,
        role: 'PARTICIPANT',
        status: 'ACTIVE',
        uploadPermission: 'DENIED',
      });
    }

    await room.save();
    res.json({ room });
  } catch (error) {
    next(error);
  }
};

// GET /api/rooms/token/:publicToken — Resolve room by public token (for QR code & guest access)
export const getRoomByToken = async (req, res, next) => {
  try {
    const { publicToken } = req.params;
    let room = await Room.findOne({ publicToken });

    // Fallback: if existing room lacks publicToken, search by code or id
    if (!room && publicToken.length === 6) {
      room = await Room.findOne({ code: publicToken.toUpperCase() });
    }

    if (!room) {
      return res.status(404).json({ error: 'Event room not found.' });
    }

    // Return public-safe room details
    res.json({
      room: {
        _id: room._id,
        name: room.name,
        code: room.code,
        publicToken: room.publicToken,
        organization: room.organization,
        description: room.description,
        totalPhotos: room.totalPhotos,
        status: room.status,
      },
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/rooms/:roomId/members — List room members (owner only)
export const getRoomMembers = async (req, res, next) => {
  try {
    if (!req.isRoomOwner) {
      return res.status(403).json({ error: 'Only the room owner can view members.' });
    }

    const room = await Room.findById(req.room._id).populate('members.userId', 'name email profileImage');

    const members = room.members.map((m) => ({
      userId: m.userId._id || m.userId,
      name: m.userId.name || null,
      email: m.userId.email || null,
      profileImage: m.userId.profileImage || null,
      role: m.role,
      status: m.status,
      uploadPermission: m.uploadPermission,
      joinedAt: m.joinedAt,
    }));

    res.json({ members });
  } catch (error) {
    next(error);
  }
};

// PATCH /api/rooms/:roomId/members/:userId — Update member role/permissions (owner only)
export const updateMember = async (req, res, next) => {
  try {
    if (!req.isRoomOwner) {
      return res.status(403).json({ error: 'Only the room owner can manage members.' });
    }

    const { userId } = req.params;
    const { role, uploadPermission } = req.body;

    const room = req.room;
    const member = room.members.find(
      (m) => m.userId.toString() === userId && m.status === 'ACTIVE'
    );

    if (!member) {
      return res.status(404).json({ error: 'Active member not found.' });
    }

    // Cannot modify the owner's own membership
    if (member.role === 'OWNER') {
      return res.status(400).json({ error: 'Cannot modify the room owner\'s membership.' });
    }

    // Update role if provided
    if (role && ['PHOTOGRAPHER', 'PARTICIPANT'].includes(role)) {
      member.role = role;

      // When promoting to PHOTOGRAPHER, set uploadPermission to PENDING
      // until the owner explicitly approves. When demoting to PARTICIPANT,
      // revoke upload permission.
      if (role === 'PHOTOGRAPHER' && !uploadPermission) {
        member.uploadPermission = 'PENDING';
      } else if (role === 'PARTICIPANT') {
        member.uploadPermission = 'DENIED';
      }
    }

    // Update upload permission if provided (only meaningful for PHOTOGRAPHER)
    if (uploadPermission && ['APPROVED', 'PENDING', 'DENIED'].includes(uploadPermission)) {
      member.uploadPermission = uploadPermission;
    }

    await room.save();

    res.json({
      message: 'Member updated successfully.',
      member: {
        userId: member.userId,
        role: member.role,
        status: member.status,
        uploadPermission: member.uploadPermission,
      },
    });
  } catch (error) {
    next(error);
  }
};

// DELETE /api/rooms/:roomId/members/:userId — Remove member (owner only)
export const removeMember = async (req, res, next) => {
  try {
    if (!req.isRoomOwner) {
      return res.status(403).json({ error: 'Only the room owner can remove members.' });
    }

    const { userId } = req.params;
    const room = req.room;

    const member = room.members.find(
      (m) => m.userId.toString() === userId && m.status === 'ACTIVE'
    );

    if (!member) {
      return res.status(404).json({ error: 'Active member not found.' });
    }

    if (member.role === 'OWNER') {
      return res.status(400).json({ error: 'Cannot remove the room owner.' });
    }

    member.status = 'REMOVED';
    member.uploadPermission = 'DENIED';
    await room.save();

    res.json({ message: 'Member removed successfully.' });
  } catch (error) {
    next(error);
  }
};

// POST /api/rooms/:roomId/leave — Leave a room (self)
export const leaveRoom = async (req, res, next) => {
  try {
    const room = req.room;
    const userId = req.userId.toString();

    if (req.isRoomOwner) {
      return res.status(400).json({ error: 'Room owner cannot leave. Transfer ownership or delete the room instead.' });
    }

    const member = room.members.find(
      (m) => m.userId.toString() === userId && m.status === 'ACTIVE'
    );

    if (!member) {
      return res.status(404).json({ error: 'You are not an active member of this room.' });
    }

    member.status = 'LEFT';
    member.uploadPermission = 'DENIED';
    await room.save();

    res.json({ message: 'You have left the room.' });
  } catch (error) {
    next(error);
  }
};

// PATCH /api/rooms/:roomId/storage — Update room storage settings (owner only)
export const updateRoomStorage = async (req, res, next) => {
  try {
    if (!req.isRoomOwner) {
      return res.status(403).json({ error: 'Only room owner can update storage settings.' });
    }

    const { storageProvider, driveFolderId, driveFolderName } = req.body;
    const room = req.room;

    if (storageProvider) {
      room.storageProvider = storageProvider;
    }
    if (driveFolderId !== undefined) {
      room.driveFolderId = driveFolderId;
    }
    if (driveFolderName !== undefined) {
      room.driveFolderName = driveFolderName;
    }

    await room.save();
    res.json({ message: 'Storage settings updated successfully.', room });
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
