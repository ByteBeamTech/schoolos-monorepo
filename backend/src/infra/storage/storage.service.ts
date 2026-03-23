import { Injectable, Logger } from '@nestjs/common';
import { ConfigService }      from '@nestjs/config';
import * as fs                from 'fs';
import * as path              from 'path';

export interface UploadOptions {
  tenantId:    string;
  year:        number;
  category:    'receipts' | 'invoices' | 'documents' | 'exports' | 'id-cards' | 'certificates';
  filename:    string;
  body:        Buffer | Uint8Array;
  contentType: string;
}

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly bucket: string;
  private readonly region: string;
  private readonly devMode: boolean;
  private readonly localDir: string;

  constructor(config: ConfigService) {
    this.bucket   = config.get<string>('AWS_S3_BUCKET_PROD', 'schoolos-prod');
    this.region   = config.get<string>('AWS_REGION', 'ap-south-1');
    const keyId   = config.get<string>('AWS_ACCESS_KEY_ID', '');
    this.devMode  = !keyId || keyId === 'your_key_here';
    this.localDir = path.join(process.cwd(), '.local-storage');
    if (this.devMode) {
      fs.mkdirSync(this.localDir, { recursive: true });
      this.logger.warn('StorageService running in LOCAL mode — files saved to .local-storage/');
    }
  }

  buildKey(opts: Pick<UploadOptions, 'tenantId' | 'year' | 'category' | 'filename'>): string {
    return `${opts.tenantId}/${opts.year}/${opts.category}/${opts.filename}`;
  }

  async upload(opts: UploadOptions): Promise<string> {
    const key = this.buildKey(opts);

    if (this.devMode) {
      // Save to local filesystem in dev
      const localPath = path.join(this.localDir, key.replaceAll('/', path.sep));
      fs.mkdirSync(path.dirname(localPath), { recursive: true });
      fs.writeFileSync(localPath, opts.body);
      this.logger.log(`[LOCAL] Saved: ${localPath}`);
      return key;
    }

    // Production: use AWS S3
    try {
      const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3');
      const client = new S3Client({ region: this.region });
      await client.send(new PutObjectCommand({
        Bucket:      this.bucket,
        Key:         key,
        Body:        opts.body,
        ContentType: opts.contentType,
        Metadata:    { tenantId: opts.tenantId, category: opts.category },
      }));
      this.logger.log(`[S3] Uploaded: s3://${this.bucket}/${key}`);
    } catch (err: any) {
      this.logger.error(`[S3] Upload failed: ${err.message}`);
      throw err;
    }

    return key;
  }

  async getSignedDownloadUrl(key: string, expiresIn = 3600): Promise<string> {
    if (this.devMode) {
      return `http://localhost:3000/api/v1/storage/download?key=${encodeURIComponent(key)}`;
    }

    try {
      const { S3Client, GetObjectCommand } = await import('@aws-sdk/client-s3');
      const { getSignedUrl }               = await import('@aws-sdk/s3-request-presigner');
      const client  = new S3Client({ region: this.region });
      const command = new GetObjectCommand({ Bucket: this.bucket, Key: key });
      return getSignedUrl(client, command, { expiresIn });
    } catch (err: any) {
      this.logger.error(`[S3] Signed URL failed: ${err.message}`);
      return `https://${this.bucket}.s3.${this.region}.amazonaws.com/${key}`;
    }
  }

  async delete(key: string): Promise<void> {
    if (this.devMode) {
      const localPath = path.join(this.localDir, key.replaceAll('/', path.sep));
      try { fs.unlinkSync(localPath); } catch { /* ignore */ }
      return;
    }
    try {
      const { S3Client, DeleteObjectCommand } = await import('@aws-sdk/client-s3');
      const client = new S3Client({ region: this.region });
      await client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
    } catch (err: any) {
      this.logger.error(`[S3] Delete failed: ${err.message}`);
    }
  }

  async isHealthy(): Promise<boolean> {
    if (this.devMode) return true;
    try {
      const { S3Client, HeadBucketCommand } = await import('@aws-sdk/client-s3');
      const client = new S3Client({ region: this.region });
      await client.send(new HeadBucketCommand({ Bucket: this.bucket }));
      return true;
    } catch {
      return false;
    }
  }

  getMode(): 'local' | 's3' { return this.devMode ? 'local' : 's3'; }
}
