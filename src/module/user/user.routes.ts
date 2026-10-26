import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import userController from './user.controller';
import { authMiddleware } from '../../common';

class UserRoutes {
  readonly router = Router();

  constructor() {
    const authLimiter = rateLimit({
      windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: 'draft-8', legacyHeaders: false,
      message: { message: 'Too many attempts; try again later' },
    });
    this.router.post('/signup', authLimiter, userController.signup);
    this.router.post('/login', authLimiter, userController.login);
    this.router.get('/me', authMiddleware.authenticate, userController.me);
  }
}

export default new UserRoutes();
