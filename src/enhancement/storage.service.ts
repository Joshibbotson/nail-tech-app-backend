import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';

@Injectable()
export class StorageService {
  private readonly s3: S3Client;
  private readonly bucket: string;
  private readonly region: string;

  constructor(private readonly config: ConfigService) {
    this.region = this.config.get<string>('s3.region', 'eu-west-2');
    this.bucket = this.config.get<string>('s3.bucket', 'nailtech-images');

    this.s3 = new S3Client({
      region: this.region,
      credentials: {
        accessKeyId: this.config.get<string>('s3.accessKeyId', ''),
        secretAccessKey: this.config.get<string>('s3.secretAccessKey', ''),
      },
    });
  }

  /**
   * Generate a presigned URL for the client to upload an image directly to S3.
   */
  async generateUploadUrl(
    deviceUUID: string,
  ): Promise<{ uploadUrl: string; imageKey: string }> {
    const imageKey = `originals/${deviceUUID}/${randomUUID()}.jpg`;

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: imageKey,
      ContentType: 'image/jpeg',
    });

    const uploadUrl = await getSignedUrl(this.s3, command, { expiresIn: 300 });

    return { uploadUrl, imageKey };
  }

  /**
   * Generate a presigned GET URL for reading a private image.
   */
  async getSignedReadUrl(imageKey: string): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: imageKey,
    });

    return getSignedUrl(this.s3, command, { expiresIn: 3600 }); // 1 hour
  }

  /**
   * Get the public URL for an image (only works if bucket/object is public).
   * For private buckets, use getSignedReadUrl instead.
   */
  getPublicUrl(imageKey: string): string {
    return `https://${this.bucket}.s3.${this.region}.amazonaws.com/${imageKey}`;
  }

  /**
   * Upload a buffer directly to S3 (used by the processor to persist fal.ai results).
   */
  async uploadBuffer(
    imageKey: string,
    data: Buffer,
    contentType = 'image/png',
  ): Promise<void> {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: imageKey,
      Body: data,
      ContentType: contentType,
    });

    await this.s3.send(command);
  }

  /**
   * Delete an image from S3.
   */
  async deleteImage(imageKey: string): Promise<void> {
    const command = new DeleteObjectCommand({
      Bucket: this.bucket,
      Key: imageKey,
    });

    await this.s3.send(command);
  }
}
