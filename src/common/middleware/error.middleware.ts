import { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import HttpError from '../utils/http-error';

class ErrorMiddleware {
  handle: ErrorRequestHandler = (error: unknown, _req, res, next) => {
    if (res.headersSent) return next(error);
    if (error instanceof ZodError) {
      res.status(400).json({ message: 'Invalid input', errors: error.issues.map(issue => ({
        field: issue.path.join('.'), message: issue.message,
      })) });
      return;
    }
    if (error instanceof HttpError) {
      res.status(error.status).json({ message: error.message });
      return;
    }
    if (error instanceof Error && 'status' in error &&
      (error.status === 400 || error.status === 413 || error.status === 415)) {
      res.status(error.status).json({ message: 'Invalid request body' });
      return;
    }
    console.error(error);
    res.status(500).json({ message: 'Internal server error' });
  };
}

export default new ErrorMiddleware();
