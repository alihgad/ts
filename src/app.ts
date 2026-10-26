import express from 'express';
import helmet from 'helmet';
import healthController from './controllers/health.controller';
import userRoutes from './module/user/user.routes';
import { errorMiddleware } from './common';

class Application {
  readonly app = express();

  constructor() {
    this.app.disable('x-powered-by');
    this.app.use(helmet());
    this.app.get('/health', healthController.check);
    this.app.use(express.json({ limit: '16kb' }));
    this.app.use('/api/users', userRoutes.router);
    this.app.use((_req, res) => { res.status(404).json({ message: 'Route not found' }); });
    this.app.use(errorMiddleware.handle);
  }
}

export default new Application();
