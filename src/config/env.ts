import 'dotenv/config';
import { z } from 'zod';

class Environment {
  readonly values = z.object({
    PORT: z.coerce.number().int().min(1).max(65535).default(3000),
    MONGODB_URI: z.string().regex(/^mongodb(\+srv)?:\/\//),
    JWT_SECRET: z.string().min(32),
    AWS_REGION: z.string().min(1).optional(),
    S3_BUCKET: z.string().min(1).optional(),
  }).parse({ ...process.env, S3_BUCKET: process.env.S3_BUCKET || undefined });
}

export default new Environment();
