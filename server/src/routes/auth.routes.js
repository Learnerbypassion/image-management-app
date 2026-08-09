import { Router } from 'express';
import { register, login, logout, getMe } from '../controllers/auth.controller.js';
import auth from '../middleware/auth.js';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.post('/logout', logout);
router.get('/me', auth, getMe);

export default router;
