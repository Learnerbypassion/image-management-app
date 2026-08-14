import { Router } from 'express';
import {
  createRoom,
  getMyRooms,
  getRoom,
  getRoomByToken,
  joinRoom,
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
router.get('/:roomId', roomAccess, getRoom);
router.delete('/:roomId', roomAccess, deleteRoom);

export default router;
