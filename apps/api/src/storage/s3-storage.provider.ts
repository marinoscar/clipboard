import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

@Injectable()
export class S3StorageProvider {
  private readonly logger = new Logger(S3StorageProvider.name);
  private readonly s3Client: S3Client;
  private readonly bucket: string;
  private readonly defaultExpirySeconds: number;

  constructor(private readonly configService: ConfigService) {
    const region = this.configService.get<string>('storage.s3.region', 'us-east-1');
    const accessKeyId = this.configService.get<string>('storage.s3.accessKeyId', '');
    const secretAccessKey = this.configService.get<string>('storage.s3.secretAccessKey', '');

    this.bucket = this.configService.get<string>('storage.s3.bucket', '');
    this.defaultExpirySeconds = this.configService.get<number>('storage.signedUrlExpiry', 3600);

    this.s3Client = new S3Client({
      region,
      credentials:
        accessKeyId && secretAccessKey
          ? { accessKeyId, secretAccessKey }
          : undefined,
    });
  }

  async upload(key: string, body: Buffer, contentType: string): Promise<void> {
    this.logger.debug(`Uploading to S3: ${key}`);

    await this.s3Client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );

    this.logger.debug(`Upload complete: ${key}`);
  }

  async getSignedDownloadUrl(key: string, expirySeconds?: number): Promise<string> {
    const expiry = expirySeconds ?? this.defaultExpirySeconds;

    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    const url = await getSignedUrl(this.s3Client, command, { expiresIn: expiry });

    this.logger.debug(`Generated signed URL for: ${key} (expires in ${expiry}s)`);
    return url;
  }

  async delete(key: string): Promise<void> {
    this.logger.debug(`Deleting from S3: ${key}`);

    await this.s3Client.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
      }),
    );

    this.logger.debug(`Delete complete: ${key}`);
  }

  async initMultipartUpload(key: string, contentType: string): Promise<string> {
    this.logger.debug(`Initiating multipart upload: ${key}`);

    const response = await this.s3Client.send(
      new CreateMultipartUploadCommand({
        Bucket: this.bucket,
        Key: key,
        ContentType: contentType,
      }),
    );

    if (!response.UploadId) {
      throw new Error(`S3 did not return an UploadId for key: ${key}`);
    }

    this.logger.debug(`Multipart upload initiated: ${key} uploadId=${response.UploadId}`);
    return response.UploadId;
  }

  async getSignedPartUrl(key: string, uploadId: string, partNumber: number): Promise<string> {
    const expiry = this.configService.get<number>('storage.signedUrlExpiry', 3600);

    const command = new UploadPartCommand({
      Bucket: this.bucket,
      Key: key,
      UploadId: uploadId,
      PartNumber: partNumber,
    });

    const url = await getSignedUrl(this.s3Client, command, { expiresIn: expiry });

    this.logger.debug(`Generated presigned part URL: ${key} part=${partNumber}`);
    return url;
  }

  async completeMultipartUpload(
    key: string,
    uploadId: string,
    parts: { PartNumber: number; ETag: string }[],
  ): Promise<void> {
    this.logger.debug(`Completing multipart upload: ${key} parts=${parts.length}`);

    await this.s3Client.send(
      new CompleteMultipartUploadCommand({
        Bucket: this.bucket,
        Key: key,
        UploadId: uploadId,
        MultipartUpload: { Parts: parts },
      }),
    );

    this.logger.debug(`Multipart upload complete: ${key}`);
  }

  async abortMultipartUpload(key: string, uploadId: string): Promise<void> {
    this.logger.debug(`Aborting multipart upload: ${key} uploadId=${uploadId}`);

    await this.s3Client.send(
      new AbortMultipartUploadCommand({
        Bucket: this.bucket,
        Key: key,
        UploadId: uploadId,
      }),
    );

    this.logger.debug(`Multipart upload aborted: ${key}`);
  }

  async exists(key: string): Promise<boolean> {
    try {
      await this.s3Client.send(
        new HeadObjectCommand({
          Bucket: this.bucket,
          Key: key,
        }),
      );
      return true;
    } catch (error: any) {
      if (
        error?.name === 'NotFound' ||
        error?.name === 'NoSuchKey' ||
        error?.$metadata?.httpStatusCode === 404
      ) {
        return false;
      }
      throw error;
    }
  }
}
