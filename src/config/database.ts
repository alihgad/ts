import mongoose from 'mongoose';
import environment from './env';
import userModel from '../models/user.model';

class Database {
  async isHealthy(): Promise<boolean> {
    const connection = mongoose.connection;
    if (connection.readyState !== 1 || !connection.db) return false;
    try {
      await connection.db.admin().ping({ timeoutMS: 2000 });
      return true;
    } catch {
      return false;
    }
  }

  async connect(): Promise<void> {
    await mongoose.connect(environment.values.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
    await userModel.model.init();
  }

  async disconnect(): Promise<void> {
    await mongoose.disconnect();
  }
}

export default new Database();
