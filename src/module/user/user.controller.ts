import { Request, Response } from 'express';
import { z } from 'zod';
import userService from './user.service';
import { HttpError } from '../../common';

class UserController {
  me = (req: Request, res: Response): void => {
    if (!req.user) throw new HttpError(401, 'Authentication required');
    res.json({ user: req.user });
  };

  private readonly credentials = z.object({
    email: z.string().trim().email().max(254).toLowerCase(),
    password: z.string().min(1).refine(value => Buffer.byteLength(value, 'utf8') <= 72,
      'Password must be at most 72 UTF-8 bytes'),
  });

  signup = async (req: Request, res: Response): Promise<void> => {
    const input = this.credentials.extend({
      name: z.string().trim().min(1).max(100),
      password: this.credentials.shape.password.refine(value => value.length >= 8,
        'Password must contain at least 8 characters'),
    }).parse(req.body);
    res.status(201).json(await userService.signup(input));
  };

  login = async (req: Request, res: Response): Promise<void> => {
    res.json(await userService.login(this.credentials.parse(req.body)));
  };
}

export default new UserController();
