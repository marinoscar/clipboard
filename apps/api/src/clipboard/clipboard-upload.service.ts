import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { S3StorageProvider } from '../storage/s3-storage.provider';
import { EventsGateway } from '../gateway/events.gateway';
import { InitUploadDto } from './dto/multipart-upload.dto';

type ItemType = 'text' | 'image' | 'file' | 'media';

@Injectable()
export class ClipboardUploadService {
  private readonly logger = new Logger(ClipboardUploadService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly s3: S3StorageProvider,
    private readonly configService: ConfigService,
    private readonly events: EventsGateway,
  ) {}

  async initUpload(userId: string, dto: InitUploadDto) {
    const minPartSize = this.configService.get<number>('storage.partSize', 10 * 1024 * 1024);
    // Dynamically size parts: target ~100 parts max, minimum 10MB, maximum 100MB.
    // This keeps large uploads (5GB) to ~50-100 parts instead of 500+.
    const maxPartSize = 100 * 1024 * 1024; // 100 MB
    const targetParts = 100;
    const partSize = Math.min(
      maxPartSize,
      Math.max(minPartSize, Math.ceil(dto.fileSize / targetParts)),
    );
    const totalParts = Math.ceil(dto.fileSize / partSize);

    const itemId = randomUUID();
    const s3Key = `clipboard/${userId}/${itemId}/${dto.fileName}`;

    this.logger.debug(
      `Init multipart upload for user=${userId} file=${dto.fileName} size=${dto.fileSize} parts=${totalParts}`,
    );

    const uploadId = await this.s3.initMultipartUpload(s3Key, dto.mimeType);

    const type = this.detectType(dto.mimeType);

    const item = await this.prisma.clipboardItem.create({
      data: {
        id: itemId,
        userId,
        type,
        fileName: dto.fileName,
        fileSize: dto.fileSize,
        mimeType: dto.mimeType,
        storageKey: s3Key,
        s3UploadId: uploadId,
        uploadStatus: 'uploading',
        status: 'active',
      },
    });

    this.logger.log(`Multipart upload initialised: itemId=${itemId} uploadId=${uploadId}`);

    return {
      itemId: item.id,
      uploadId,
      totalParts,
      partSize,
    };
  }

  async getPartUrl(userId: string, itemId: string, partNumber: number) {
    const item = await this.resolveOwnedItem(userId, itemId);

    if (item.uploadStatus !== 'uploading') {
      throw new BadRequestException(
        `Upload is not in progress for item ${itemId} (status: ${item.uploadStatus})`,
      );
    }

    if (!item.s3UploadId || !item.storageKey) {
      throw new BadRequestException(`Item ${itemId} has no active multipart upload`);
    }

    const url = await this.s3.getSignedPartUrl(item.storageKey, item.s3UploadId, partNumber);

    this.logger.debug(`Generated presigned part URL: itemId=${itemId} partNumber=${partNumber}`);

    return { url, partNumber };
  }

  async completePart(
    userId: string,
    itemId: string,
    partNumber: number,
    eTag: string,
    size: number,
  ) {
    const item = await this.resolveOwnedItem(userId, itemId);

    if (item.uploadStatus !== 'uploading') {
      throw new BadRequestException(
        `Upload is not in progress for item ${itemId} (status: ${item.uploadStatus})`,
      );
    }

    // Upsert so that retried requests are idempotent
    const chunk = await this.prisma.uploadChunk.upsert({
      where: {
        itemId_partNumber: { itemId, partNumber },
      },
      create: {
        id: randomUUID(),
        itemId,
        partNumber,
        eTag,
        size,
      },
      update: { eTag, size },
    });

    this.logger.debug(`Part recorded: itemId=${itemId} partNumber=${partNumber} eTag=${eTag}`);

    return chunk;
  }

  async completeUpload(
    userId: string,
    itemId: string,
    parts: { partNumber: number; eTag: string }[],
  ) {
    const item = await this.resolveOwnedItem(userId, itemId);

    if (item.uploadStatus !== 'uploading') {
      throw new BadRequestException(
        `Upload is not in progress for item ${itemId} (status: ${item.uploadStatus})`,
      );
    }

    if (!item.s3UploadId || !item.storageKey) {
      throw new BadRequestException(`Item ${itemId} has no active multipart upload`);
    }

    this.logger.debug(
      `Completing multipart upload: itemId=${itemId} parts=${parts.length}`,
    );

    await this.s3.completeMultipartUpload(
      item.storageKey,
      item.s3UploadId,
      parts.map((p) => ({ PartNumber: p.partNumber, ETag: p.eTag })),
    );

    const updated = await this.prisma.clipboardItem.update({
      where: { id: itemId },
      data: { uploadStatus: 'complete', s3UploadId: null },
    });

    this.logger.log(`Multipart upload complete: itemId=${itemId}`);

    // Notify all connected sessions for this user
    this.events.emitToUser(userId, 'item:created', updated);

    return updated;
  }

  async abortUpload(userId: string, itemId: string) {
    const item = await this.resolveOwnedItem(userId, itemId);

    if (item.uploadStatus !== 'uploading') {
      throw new BadRequestException(
        `Upload is not in progress for item ${itemId} (status: ${item.uploadStatus})`,
      );
    }

    if (!item.s3UploadId || !item.storageKey) {
      throw new BadRequestException(`Item ${itemId} has no active multipart upload`);
    }

    this.logger.debug(`Aborting multipart upload: itemId=${itemId}`);

    await this.s3.abortMultipartUpload(item.storageKey, item.s3UploadId);

    await this.prisma.uploadChunk.deleteMany({ where: { itemId } });

    const updated = await this.prisma.clipboardItem.update({
      where: { id: itemId },
      data: { uploadStatus: 'failed', s3UploadId: null },
    });

    this.logger.log(`Multipart upload aborted: itemId=${itemId}`);

    return updated;
  }

  async getUploadStatus(userId: string, itemId: string) {
    const item = await this.resolveOwnedItem(userId, itemId);

    const chunks = await this.prisma.uploadChunk.findMany({
      where: { itemId },
      orderBy: { partNumber: 'asc' },
      select: { partNumber: true, eTag: true, size: true, uploadedAt: true },
    });

    return {
      itemId: item.id,
      uploadStatus: item.uploadStatus,
      fileName: item.fileName,
      fileSize: item.fileSize,
      uploadedParts: chunks,
    };
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────

  private async resolveOwnedItem(userId: string, itemId: string) {
    const item = await this.prisma.clipboardItem.findUnique({
      where: { id: itemId },
    });

    if (!item) {
      throw new NotFoundException(`Clipboard item ${itemId} not found`);
    }

    if (item.userId !== userId) {
      throw new ForbiddenException('You do not have access to this item');
    }

    return item;
  }

  private detectType(mimetype: string): ItemType {
    if (mimetype.startsWith('text/')) return 'text';
    if (mimetype.startsWith('image/')) return 'image';
    if (mimetype.startsWith('audio/') || mimetype.startsWith('video/')) return 'media';
    return 'file';
  }
}
