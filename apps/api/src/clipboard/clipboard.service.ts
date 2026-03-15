import { Injectable, Logger, NotFoundException, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { S3StorageProvider } from '../storage/s3-storage.provider';
import { EventsGateway } from '../gateway/events.gateway';
import { ClipboardQueryDto } from './dto/clipboard-query.dto';
import { UpdateItemDto } from './dto/update-item.dto';
import { Prisma } from '@prisma/client';

type ItemType = 'text' | 'image' | 'file' | 'media';

interface FileInput {
  buffer: Buffer;
  filename: string;
  mimetype: string;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

@Injectable()
export class ClipboardService {
  private readonly logger = new Logger(ClipboardService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly s3: S3StorageProvider,
    private readonly configService: ConfigService,
    private readonly events: EventsGateway,
  ) {}

  async createTextItem(userId: string, content: string) {
    this.logger.debug(`Creating text item for user ${userId}`);

    const item = await this.prisma.clipboardItem.create({
      data: {
        id: randomUUID(),
        userId,
        type: 'text',
        content,
        mimeType: 'text/plain',
        status: 'active',
        uploadStatus: 'complete',
      },
    });

    this.logger.log(`Text item created: ${item.id}`);
    this.events.emitToUser(userId, 'item:created', item);
    return item;
  }

  async createFileItem(userId: string, file: FileInput) {
    const itemId = randomUUID();
    const type = this.detectType(file.mimetype);
    const s3Key = `clipboard/${userId}/${itemId}/${file.filename}`;

    this.logger.debug(
      `Creating file item for user ${userId}, type=${type}, key=${s3Key}`,
    );

    // Upload to S3 first — fail fast before writing to the DB
    await this.s3.upload(s3Key, file.buffer, file.mimetype);

    const item = await this.prisma.clipboardItem.create({
      data: {
        id: itemId,
        userId,
        type,
        fileName: file.filename,
        fileSize: file.buffer.length,
        mimeType: file.mimetype,
        storageKey: s3Key,
        status: 'active',
        uploadStatus: 'complete',
      },
    });

    this.logger.log(`File item created: ${item.id} (${type})`);
    this.events.emitToUser(userId, 'item:created', item);
    return item;
  }

  async listItems(
    userId: string,
    query: ClipboardQueryDto,
  ): Promise<PaginatedResult<any>> {
    const { page, pageSize, type, status, search, sortBy, sortOrder } = query;
    const skip = (page - 1) * pageSize;

    const where: Prisma.ClipboardItemWhereInput = {
      userId,
      status,
      ...(type ? { type } : {}),
      ...(search
        ? {
            OR: [
              { content: { contains: search } },
              { fileName: { contains: search } },
            ],
          }
        : {}),
    };

    // Map sortBy DTO field names to Prisma field names
    const orderByField: Record<string, string> = {
      createdAt: 'createdAt',
      updatedAt: 'updatedAt',
      fileName: 'fileName',
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.clipboardItem.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { [orderByField[sortBy]]: sortOrder },
      }),
      this.prisma.clipboardItem.count({ where }),
    ]);

    const totalPages = Math.ceil(total / pageSize);

    return {
      items,
      total,
      page,
      pageSize,
      totalPages,
    };
  }

  async getItem(userId: string, itemId: string) {
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

  async updateItem(userId: string, itemId: string, data: UpdateItemDto) {
    // Verify ownership
    await this.getItem(userId, itemId);

    const updated = await this.prisma.clipboardItem.update({
      where: { id: itemId },
      data: {
        ...(data.content !== undefined ? { content: data.content } : {}),
        ...(data.status !== undefined ? { status: data.status } : {}),
      },
    });

    this.logger.debug(`Item updated: ${itemId}`);
    this.events.emitToUser(userId, 'item:updated', updated);
    return updated;
  }

  async deleteItem(userId: string, itemId: string) {
    // Verify ownership
    await this.getItem(userId, itemId);

    const deleted = await this.prisma.clipboardItem.update({
      where: { id: itemId },
      data: { status: 'deleted' },
    });

    this.logger.debug(`Item soft-deleted: ${itemId}`);
    this.events.emitToUser(userId, 'item:deleted', { id: itemId });
    return deleted;
  }

  async getDownloadUrl(userId: string, itemId: string): Promise<{ url: string }> {
    const item = await this.getItem(userId, itemId);

    if (!item.storageKey) {
      throw new NotFoundException('This item has no associated file');
    }

    const url = await this.s3.getSignedDownloadUrl(item.storageKey);
    return { url };
  }

  private detectType(mimetype: string): ItemType {
    if (mimetype.startsWith('text/')) return 'text';
    if (mimetype.startsWith('image/')) return 'image';
    if (mimetype.startsWith('audio/') || mimetype.startsWith('video/')) return 'media';
    return 'file';
  }
}
