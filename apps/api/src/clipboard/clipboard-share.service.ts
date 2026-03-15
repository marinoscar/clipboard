import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { S3StorageProvider } from '../storage/s3-storage.provider';
import { EventsGateway } from '../gateway/events.gateway';

const FILE_TYPES = new Set(['image', 'file', 'media']);

@Injectable()
export class ClipboardShareService {
  private readonly logger = new Logger(ClipboardShareService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly s3: S3StorageProvider,
    private readonly events: EventsGateway,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Enable public sharing for a clipboard item.
   * Returns the generated shareToken and the full share URL.
   */
  async enableSharing(
    userId: string,
    itemId: string,
  ): Promise<{ shareToken: string; shareUrl: string }> {
    const item = await this.prisma.clipboardItem.findUnique({
      where: { id: itemId },
    });

    if (!item) {
      throw new NotFoundException(`Clipboard item ${itemId} not found`);
    }

    if (item.userId !== userId) {
      throw new ForbiddenException('You do not own this item');
    }

    const shareToken = randomBytes(16).toString('hex');

    const updated = await this.prisma.clipboardItem.update({
      where: { id: itemId },
      data: { isPublic: true, shareToken },
    });

    this.events.emitToUser(userId, 'item:updated', updated);
    this.logger.debug(`Sharing enabled for item ${itemId} with token ${shareToken}`);

    const shareUrl = this.buildShareUrl(shareToken);
    return { shareToken, shareUrl };
  }

  /**
   * Disable public sharing for a clipboard item.
   */
  async disableSharing(userId: string, itemId: string): Promise<void> {
    const item = await this.prisma.clipboardItem.findUnique({
      where: { id: itemId },
    });

    if (!item) {
      throw new NotFoundException(`Clipboard item ${itemId} not found`);
    }

    if (item.userId !== userId) {
      throw new ForbiddenException('You do not own this item');
    }

    const updated = await this.prisma.clipboardItem.update({
      where: { id: itemId },
      data: { isPublic: false, shareToken: null },
    });

    this.events.emitToUser(userId, 'item:updated', updated);
    this.logger.debug(`Sharing disabled for item ${itemId}`);
  }

  /**
   * Retrieve a publicly shared item by share token.
   * Returns a safe subset of the item. File-type items include a signed download URL.
   */
  async getPublicItem(shareToken: string): Promise<Record<string, unknown>> {
    const item = await this.prisma.clipboardItem.findFirst({
      where: { shareToken, isPublic: true, status: 'active' },
    });

    if (!item) {
      throw new NotFoundException('Shared item not found or is no longer public');
    }

    const safeItem: Record<string, unknown> = {
      id: item.id,
      type: item.type,
      content: item.content,
      fileName: item.fileName,
      fileSize: item.fileSize,
      mimeType: item.mimeType,
      createdAt: item.createdAt,
    };

    if (FILE_TYPES.has(item.type) && item.storageKey) {
      safeItem.downloadUrl = await this.s3.getSignedDownloadUrl(item.storageKey);
    }

    return safeItem;
  }

  /**
   * Return a signed S3 download URL for a file item accessed via share token.
   */
  async getPublicDownloadUrl(shareToken: string): Promise<{ url: string }> {
    const item = await this.prisma.clipboardItem.findFirst({
      where: { shareToken, isPublic: true, status: 'active' },
    });

    if (!item) {
      throw new NotFoundException('Shared item not found or is no longer public');
    }

    if (!item.storageKey) {
      throw new NotFoundException('This item has no associated file');
    }

    const url = await this.s3.getSignedDownloadUrl(item.storageKey);
    return { url };
  }

  private buildShareUrl(shareToken: string): string {
    const appUrl =
      this.configService.get<string>('appUrl') || 'http://localhost:8320';
    return `${appUrl}/share/${shareToken}`;
  }
}
