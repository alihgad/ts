import { RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import environment from '../../config/env';

import userService from '../../module/user/user.service'
import HttpError from '../utils/http-error';

class AuthMiddleware {
  authenticate: RequestHandler = async (req, res, next) => {
    const match = /^Bearer ([^\s]+)$/i.exec(req.get('authorization') ?? '');
    if (!match) {
      res.setHeader('WWW-Authenticate', 'Bearer');
      throw new HttpError(401, 'Bearer token is required');
    }

    let userId: string;
    try {
      const payload = jwt.verify(match[1], environment.values.JWT_SECRET, { algorithms: ['HS256'] });
      if (typeof payload === 'string' || typeof payload.sub !== 'string' ||
        !/^[a-f\d]{24}$/i.test(payload.sub) || typeof payload.exp !== 'number') {
        throw new Error('Invalid token claims');
      }
      userId = payload.sub;
    } catch {
      res.setHeader('WWW-Authenticate', 'Bearer error="invalid_token"');
      throw new HttpError(401, 'Invalid or expired token');
    }

    const user = await userService.findById(userId);
    if (!user) {
      res.setHeader('WWW-Authenticate', 'Bearer error="invalid_token"');
      throw new HttpError(401, 'Invalid or expired token');
    }
    req.user = user;
    next();
  };
}

export default new AuthMiddleware();
