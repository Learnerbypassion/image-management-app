import { Router } from 'express';
import {
  createRoom,
  getMyRooms,
  getRoom,
  joinRoom,
  deleteRoom,
} from '../controllers/room.controller.js';
import auth from '../middleware/auth.js';
import roomAccess from '../middleware/roomAccess.js';

const router = Router();

// All room routes require authentication
router.use(auth);

router.post('/', createRoom);
router.get('/', getMyRooms);
router.post('/join', joinRoom);
router.get('/:roomId', roomAccess, getRoom);
router.delete('/:roomId', roomAccess, deleteRoom);

export default router;
