import { Test, TestingModule } from '@nestjs/testing';
import { RetentionService } from './retention.service';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { S3StorageProvider } from '../storage/s3-storage.provider';

const NULL_CONFIG = { archiveAfterDays: null, deleteAfterArchiveDays: null };
const FULL_CONFIG = { archiveAfterDays: 30, deleteAfterArchiveDays: 7 };

describe('RetentionService', () => {
  let service: RetentionService;
  let prisma: any;
  let settingsService: any;
  let s3: any;

  beforeEach(async () => {
    prisma = {
      clipboardItem: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        findMany: jest.fn().mockResolvedValue([]),
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
    };

    settingsService = {
      getRetentionConfig: jest.fn().mockResolvedValue(NULL_CONFIG),
    };

    s3 = {
      delete: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RetentionService,
        { provide: PrismaService, useValue: prisma },
        { provide: SettingsService, useValue: settingsService },
        { provide: S3StorageProvider, useValue: s3 },
      ],
    }).compile();

    service = module.get<RetentionService>(RetentionService);
  });

  // ---------------------------------------------------------------------------
  // archiveExpiredItems
  // ---------------------------------------------------------------------------
  describe('archiveExpiredItems', () => {
    it('should no-op when archiveAfterDays is null', async () => {
      settingsService.getRetentionConfig.mockResolvedValue(NULL_CONFIG);

      await service.archiveExpiredItems();

      expect(prisma.clipboardItem.updateMany).not.toHaveBeenCalled();
    });

    it('should updateMany to "archived" when archiveAfterDays is set', async () => {
      settingsService.getRetentionConfig.mockResolvedValue(FULL_CONFIG);
      prisma.clipboardItem.updateMany.mockResolvedValue({ count: 5 });

      await service.archiveExpiredItems();

      expect(prisma.clipboardItem.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'active' }),
          data: { status: 'archived' },
        }),
      );
    });

    it('should calculate cutoff date based on archiveAfterDays', async () => {
      settingsService.getRetentionConfig.mockResolvedValue({ ...FULL_CONFIG, archiveAfterDays: 30 });
      prisma.clipboardItem.updateMany.mockResolvedValue({ count: 0 });

      const before = new Date();
      await service.archiveExpiredItems();
      const after = new Date();

      const call = prisma.clipboardItem.updateMany.mock.calls[0][0];
      const cutoff: Date = call.where.createdAt.lt;

      // cutoff should be approximately 30 days ago
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      // Allow a 1-second window for test execution
      expect(cutoff.getTime()).toBeGreaterThanOrEqual(thirtyDaysAgo.getTime() - 1000);
      expect(cutoff.getTime()).toBeLessThanOrEqual(after.getTime());
    });

    it('should only target active items in the updateMany call', async () => {
      settingsService.getRetentionConfig.mockResolvedValue(FULL_CONFIG);
      prisma.clipboardItem.updateMany.mockResolvedValue({ count: 1 });

      await service.archiveExpiredItems();

      expect(prisma.clipboardItem.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'active' }),
        }),
      );
    });
  });

  // ---------------------------------------------------------------------------
  // deleteArchivedItems
  // ---------------------------------------------------------------------------
  describe('deleteArchivedItems', () => {
    it('should no-op when deleteAfterArchiveDays is null', async () => {
      settingsService.getRetentionConfig.mockResolvedValue(NULL_CONFIG);

      await service.deleteArchivedItems();

      expect(prisma.clipboardItem.findMany).not.toHaveBeenCalled();
      expect(prisma.clipboardItem.deleteMany).not.toHaveBeenCalled();
    });

    it('should no-op when no archived items meet the cutoff', async () => {
      settingsService.getRetentionConfig.mockResolvedValue(FULL_CONFIG);
      prisma.clipboardItem.findMany.mockResolvedValue([]);

      await service.deleteArchivedItems();

      expect(prisma.clipboardItem.deleteMany).not.toHaveBeenCalled();
      expect(s3.delete).not.toHaveBeenCalled();
    });

    it('should delete S3 objects and then DB rows', async () => {
      settingsService.getRetentionConfig.mockResolvedValue(FULL_CONFIG);
      prisma.clipboardItem.findMany.mockResolvedValue([
        {
          id: 'item-1',
          storageKey: 'clipboard/user-1/item-1/photo.png',
          thumbnailKey: null,
        },
      ]);
      prisma.clipboardItem.deleteMany.mockResolvedValue({ count: 1 });

      await service.deleteArchivedItems();

      expect(s3.delete).toHaveBeenCalledWith('clipboard/user-1/item-1/photo.png');
      expect(prisma.clipboardItem.deleteMany).toHaveBeenCalledWith({
        where: { id: { in: ['item-1'] } },
      });
    });

    it('should delete both storageKey and thumbnailKey from S3', async () => {
      settingsService.getRetentionConfig.mockResolvedValue(FULL_CONFIG);
      prisma.clipboardItem.findMany.mockResolvedValue([
        {
          id: 'item-2',
          storageKey: 'clipboard/user-1/item-2/video.mp4',
          thumbnailKey: 'clipboard/user-1/item-2/thumb.jpg',
        },
      ]);
      prisma.clipboardItem.deleteMany.mockResolvedValue({ count: 1 });

      await service.deleteArchivedItems();

      expect(s3.delete).toHaveBeenCalledTimes(2);
      expect(s3.delete).toHaveBeenCalledWith('clipboard/user-1/item-2/video.mp4');
      expect(s3.delete).toHaveBeenCalledWith('clipboard/user-1/item-2/thumb.jpg');
    });

    it('should skip S3 deletion for items without storageKey', async () => {
      settingsService.getRetentionConfig.mockResolvedValue(FULL_CONFIG);
      prisma.clipboardItem.findMany.mockResolvedValue([
        { id: 'item-text', storageKey: null, thumbnailKey: null },
      ]);
      prisma.clipboardItem.deleteMany.mockResolvedValue({ count: 1 });

      await service.deleteArchivedItems();

      expect(s3.delete).not.toHaveBeenCalled();
      expect(prisma.clipboardItem.deleteMany).toHaveBeenCalledWith({
        where: { id: { in: ['item-text'] } },
      });
    });

    it('should continue deleting other items even if S3 deletion fails', async () => {
      settingsService.getRetentionConfig.mockResolvedValue(FULL_CONFIG);
      prisma.clipboardItem.findMany.mockResolvedValue([
        { id: 'item-1', storageKey: 'key-1', thumbnailKey: null },
        { id: 'item-2', storageKey: 'key-2', thumbnailKey: null },
      ]);
      prisma.clipboardItem.deleteMany.mockResolvedValue({ count: 2 });

      // First S3 delete fails
      s3.delete
        .mockRejectedValueOnce(new Error('S3 error'))
        .mockResolvedValueOnce(undefined);

      await service.deleteArchivedItems();

      // Both items should still be deleted from DB
      expect(prisma.clipboardItem.deleteMany).toHaveBeenCalledWith({
        where: { id: { in: ['item-1', 'item-2'] } },
      });
    });

    it('should query only archived items with updatedAt < cutoff', async () => {
      settingsService.getRetentionConfig.mockResolvedValue(FULL_CONFIG);
      prisma.clipboardItem.findMany.mockResolvedValue([]);

      await service.deleteArchivedItems();

      expect(prisma.clipboardItem.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'archived',
            updatedAt: expect.objectContaining({ lt: expect.any(Date) }),
          }),
        }),
      );
    });

    it('should delete multiple items in one deleteMany call', async () => {
      settingsService.getRetentionConfig.mockResolvedValue(FULL_CONFIG);
      prisma.clipboardItem.findMany.mockResolvedValue([
        { id: 'item-1', storageKey: null, thumbnailKey: null },
        { id: 'item-2', storageKey: null, thumbnailKey: null },
        { id: 'item-3', storageKey: null, thumbnailKey: null },
      ]);
      prisma.clipboardItem.deleteMany.mockResolvedValue({ count: 3 });

      await service.deleteArchivedItems();

      expect(prisma.clipboardItem.deleteMany).toHaveBeenCalledTimes(1);
      expect(prisma.clipboardItem.deleteMany).toHaveBeenCalledWith({
        where: { id: { in: ['item-1', 'item-2', 'item-3'] } },
      });
    });
  });
});
