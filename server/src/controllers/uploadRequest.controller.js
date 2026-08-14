import UploadRequest from '../models/UploadRequest.js';
import Room from '../models/Room.js';
import logger from '../utils/logger.js';

// POST /api/rooms/:roomId/upload-requests — Submit a request for upload access
export const createUploadRequest = async (req, res, next) => {
  try {
    const { roomId } = req.params;
    const { message } = req.body;
    const userId = req.userId;

    const room = await Room.findById(roomId);
    if (!room) {
      return res.status(404).json({ error: 'Room not found.' });
    }

    // Must be an active member
    const membership = room.members.find(
      (m) => m.userId.toString() === userId.toString() && m.status === 'ACTIVE'
    );
    if (!membership) {
      return res.status(403).json({ error: 'You must be a member of this room.' });
    }

    // Owner doesn't need to request
    if (room.ownerId.toString() === userId.toString()) {
      return res.status(400).json({ error: 'Room owner already has upload permission.' });
    }

    // Already an approved photographer
    if (membership.role === 'PHOTOGRAPHER' && membership.uploadPermission === 'APPROVED') {
      return res.status(400).json({ error: 'You already have upload permission.' });
    }

    // Check for existing pending request
    const existingPending = await UploadRequest.findOne({
      roomId,
      requesterId: userId,
      status: 'PENDING',
    });

    if (existingPending) {
      return res.status(409).json({ error: 'You already have a pending request.' });
    }

    const request = await UploadRequest.create({
      roomId,
      requesterId: userId,
      message: message || '',
    });

    logger.info(`Upload request created: user ${userId} → room ${roomId}`);
    res.status(201).json({ request });
  } catch (error) {
    next(error);
  }
};

// GET /api/rooms/:roomId/upload-requests — List requests (owner sees all, member sees own)
export const getUploadRequests = async (req, res, next) => {
  try {
    const { roomId } = req.params;
    const room = req.room;

    let filter = { roomId };

    // Only owner sees all requests; regular members see only their own
    if (!req.isRoomOwner) {
      filter.requesterId = req.userId;
    }

    // Optional status filter
    if (req.query.status) {
      filter.status = req.query.status.toUpperCase();
    }

    const requests = await UploadRequest.find(filter)
      .populate('requesterId', 'name email profileImage')
      .populate('reviewedBy', 'name email')
      .sort({ createdAt: -1 });

    res.json({ requests });
  } catch (error) {
    next(error);
  }
};

// GET /api/rooms/:roomId/upload-requests/my-status — Get current user's request status
export const getMyRequestStatus = async (req, res, next) => {
  try {
    const { roomId } = req.params;
    const userId = req.userId;

    // Get latest request
    const request = await UploadRequest.findOne({
      roomId,
      requesterId: userId,
    }).sort({ createdAt: -1 });

    const room = req.room;
    const membership = room.members.find(
      (m) => m.userId.toString() === userId.toString() && m.status === 'ACTIVE'
    );

    res.json({
      request: request || null,
      canUpload: req.canUpload,
      role: req.memberRole,
      uploadPermission: membership?.uploadPermission || 'DENIED',
    });
  } catch (error) {
    next(error);
  }
};

// PATCH /api/upload-requests/:id/approve — Approve request (owner only)
export const approveUploadRequest = async (req, res, next) => {
  try {
    const request = await UploadRequest.findById(req.params.id);
    if (!request) {
      return res.status(404).json({ error: 'Request not found.' });
    }

    // Verify the caller owns the room
    const room = await Room.findById(request.roomId);
    if (!room || room.ownerId.toString() !== req.userId.toString()) {
      return res.status(403).json({ error: 'Only the room owner can approve requests.' });
    }

    if (request.status !== 'PENDING') {
      return res.status(400).json({ error: `Request is already ${request.status.toLowerCase()}.` });
    }

    // Update request
    request.status = 'APPROVED';
    request.reviewedAt = new Date();
    request.reviewedBy = req.userId;
    await request.save();

    // Update membership → promote to PHOTOGRAPHER with APPROVED upload
    const member = room.members.find(
      (m) => m.userId.toString() === request.requesterId.toString() && m.status === 'ACTIVE'
    );
    if (member) {
      member.role = 'PHOTOGRAPHER';
      member.uploadPermission = 'APPROVED';
      await room.save();
    }

    logger.success(`Upload request approved: user ${request.requesterId} → room ${request.roomId}`);
    res.json({ message: 'Request approved. User is now a photographer.', request });
  } catch (error) {
    next(error);
  }
};

// PATCH /api/upload-requests/:id/reject — Reject request (owner only)
export const rejectUploadRequest = async (req, res, next) => {
  try {
    const request = await UploadRequest.findById(req.params.id);
    if (!request) {
      return res.status(404).json({ error: 'Request not found.' });
    }

    const room = await Room.findById(request.roomId);
    if (!room || room.ownerId.toString() !== req.userId.toString()) {
      return res.status(403).json({ error: 'Only the room owner can reject requests.' });
    }

    if (request.status !== 'PENDING') {
      return res.status(400).json({ error: `Request is already ${request.status.toLowerCase()}.` });
    }

    request.status = 'REJECTED';
    request.reviewedAt = new Date();
    request.reviewedBy = req.userId;
    await request.save();

    logger.info(`Upload request rejected: user ${request.requesterId} → room ${request.roomId}`);
    res.json({ message: 'Request rejected.', request });
  } catch (error) {
    next(error);
  }
};

// PATCH /api/upload-requests/:id/revoke — Revoke previously approved access (owner only)
export const revokeUploadRequest = async (req, res, next) => {
  try {
    const request = await UploadRequest.findById(req.params.id);
    if (!request) {
      return res.status(404).json({ error: 'Request not found.' });
    }

    const room = await Room.findById(request.roomId);
    if (!room || room.ownerId.toString() !== req.userId.toString()) {
      return res.status(403).json({ error: 'Only the room owner can revoke access.' });
    }

    if (request.status !== 'APPROVED') {
      return res.status(400).json({ error: 'Can only revoke approved requests.' });
    }

    request.status = 'REVOKED';
    request.reviewedAt = new Date();
    request.reviewedBy = req.userId;
    await request.save();

    // Demote membership back to PARTICIPANT
    const member = room.members.find(
      (m) => m.userId.toString() === request.requesterId.toString() && m.status === 'ACTIVE'
    );
    if (member) {
      member.role = 'PARTICIPANT';
      member.uploadPermission = 'DENIED';
      await room.save();
    }

    logger.info(`Upload access revoked: user ${request.requesterId} → room ${request.roomId}`);
    res.json({ message: 'Upload access revoked.', request });
  } catch (error) {
    next(error);
  }
};
