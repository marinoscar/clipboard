import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { S3StorageProvider } from '../storage/s3-storage.provider';

@Injectable()
export class RetentionService {
  private readonly logger = new Logger(RetentionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly settingsService: SettingsService,
    private readonly s3: S3StorageProvider,
  ) {}

  /**
   * Archive active items older than retention.archiveAfterDays.
   * Runs every hour. No-ops if archiveAfterDays is null.
   */
  @Cron(CronExpression.EVERY_HOUR)
  async archiveExpiredItems(): Promise<void> {
    const config = await this.settingsService.getRetentionConfig();

    if (config.archiveAfterDays === null) {
      this.logger.debug('Archive retention disabled — skipping');
      return;
    }

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - config.archiveAfterDays);

    const result = await this.prisma.clipboardItem.updateMany({
      where: {
        status: 'active',
        createdAt: { lt: cutoff },
      },
      data: { status: 'archived' },
    });

    if (result.count > 0) {
      this.logger.log(
        `Archived ${result.count} item(s) older than ${config.archiveAfterDays} day(s)`,
      );
    } else {
      this.logger.debug('No items to archive');
    }
  }

  /**
   * Permanently delete archived items whose updatedAt is older than
   * retention.deleteAfterArchiveDays. Deletes associated S3 objects first.
   * Runs every hour. No-ops if deleteAfterArchiveDays is null.
   */
  @Cron(CronExpression.EVERY_HOUR)
  async deleteArchivedItems(): Promise<void> {
    const config = await this.settingsService.getRetentionConfig();

    if (config.deleteAfterArchiveDays === null) {
      this.logger.debug('Delete-after-archive retention disabled — skipping');
      return;
    }

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - config.deleteAfterArchiveDays);

    const items = await this.prisma.clipboardItem.findMany({
      where: {
        status: 'archived',
        updatedAt: { lt: cutoff },
      },
      select: {
        id: true,
        storageKey: true,
        thumbnailKey: true,
      },
    });

    if (items.length === 0) {
      this.logger.debug('No archived items ready for deletion');
      return;
    }

    // Delete S3 objects for each item before removing DB rows
    for (const item of items) {
      if (item.storageKey) {
        try {
          await this.s3.delete(item.storageKey);
        } catch (err) {
          this.logger.warn(
            `Failed to delete S3 object ${item.storageKey} for item ${item.id}: ${String(err)}`,
          );
        }
      }

      if (item.thumbnailKey) {
        try {
          await this.s3.delete(item.thumbnailKey);
        } catch (err) {
          this.logger.warn(
            `Failed to delete S3 thumbnail ${item.thumbnailKey} for item ${item.id}: ${String(err)}`,
          );
        }
      }
    }

    const ids = items.map((i) => i.id);

    await this.prisma.clipboardItem.deleteMany({
      where: { id: { in: ids } },
    });

    this.logger.log(
      `Permanently deleted ${ids.length} archived item(s) older than ${config.deleteAfterArchiveDays} day(s)`,
    );
  }
}
