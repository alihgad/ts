import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import userModel from '../../models/user.model';
import environment from '../../config/env';
import {HttpError} from '../../common';

class UserService {
  async findById(id: string) {
    const user = await userModel.model.findById(id).select('name email');
    return user ? { id: String(user._id), name: user.name, email: user.email } : null;
  }

  private response(user: { _id: unknown; name: string; email: string }) {
    const id = String(user._id);
    return {
      user: { id, name: user.name, email: user.email },
      token: jwt.sign({}, environment.values.JWT_SECRET, {
        subject: id, expiresIn: '1h', algorithm: 'HS256',
      }),
    };
  }

  async signup(input: { name: string; email: string; password: string }) {
    const passwordHash = await bcrypt.hash(input.password, 12);
    try {
      const user = await userModel.model.create({ name: input.name, email: input.email, passwordHash });
      return this.response(user);
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 11000) {
        throw new HttpError(409, 'Email is already registered');
      }
      throw error;
    }
  }

  async login(input: { email: string; password: string }) {
    const user = await userModel.model.findOne({ email: input.email }).select('+passwordHash');
    if (!user || !(await bcrypt.compare(input.password, user.passwordHash))) {
      throw new HttpError(401, 'Invalid email or password');
    }
    return this.response(user);
  }
}

export default new UserService();
