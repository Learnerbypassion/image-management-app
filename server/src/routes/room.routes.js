import { Router } from 'express';
import {
  createRoom,
  getMyRooms,
  getRoom,
  getRoomByToken,
  joinRoom,
  getRoomMembers,
  updateMember,
  removeMember,
  leaveRoom,
  updateRoomStorage,
  deleteRoom,
} from '../controllers/room.controller.js';
import auth from '../middleware/auth.js';
import roomAccess from '../middleware/roomAccess.js';

const router = Router();

// Public room lookup via QR / public token
router.get('/token/:publicToken', getRoomByToken);

// Authenticated room management routes
router.use(auth);

router.post('/', createRoom);
router.get('/', getMyRooms);
router.post('/join', joinRoom);

// Room-scoped routes (require room membership)
router.get('/:roomId', roomAccess, getRoom);
router.patch('/:roomId/storage', roomAccess, updateRoomStorage);
router.delete('/:roomId', roomAccess, deleteRoom);

// Membership management (owner only for GET/PATCH/DELETE members)
router.get('/:roomId/members', roomAccess, getRoomMembers);
router.patch('/:roomId/members/:userId', roomAccess, updateMember);
router.delete('/:roomId/members/:userId', roomAccess, removeMember);
router.post('/:roomId/leave', roomAccess, leaveRoom);

export default router;
