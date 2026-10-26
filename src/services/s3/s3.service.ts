import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import environment from '../../config/env';

class S3Service {
  private client?: S3Client;

  private get configuration() {
    const { AWS_REGION, S3_BUCKET } = environment.values;
    if (!AWS_REGION || !S3_BUCKET) throw new Error('AWS_REGION and S3_BUCKET are required for S3');
    this.client ??= new S3Client({ region: AWS_REGION });
    return { client: this.client, bucket: S3_BUCKET };
  }

  async upload(key: string, body: Buffer, contentType = 'application/octet-stream'): Promise<void> {
    const { client, bucket } = this.configuration;
    await client.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: contentType }));
  }

  async get(key: string) {
    const { client, bucket } = this.configuration;
    return client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  }

  async delete(key: string): Promise<void> {
    const { client, bucket } = this.configuration;
    await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
  }
}

export default new S3Service();
