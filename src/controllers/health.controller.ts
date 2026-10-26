import { Request, Response } from 'express';
import database from '../config/database';

class HealthController {
  check = async (_req: Request, res: Response): Promise<void> => {
    const healthy = await database.isHealthy();
    res.setHeader('Cache-Control', 'no-store');
    res.status(healthy ? 200 : 503).json({
      status: healthy ? 'ok' : 'unavailable',
      database: healthy ? 'connected' : 'unavailable',
    });
  };
}

export default new HealthController();
