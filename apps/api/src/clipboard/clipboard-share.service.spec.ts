import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { ClipboardShareService } from './clipboard-share.service';
import { PrismaService } from '../prisma/prisma.service';
import { S3StorageProvider } from '../storage/s3-storage.provider';
import { EventsGateway } from '../gateway/events.gateway';

const BASE_ITEM = {
  id: 'item-1',
  userId: 'user-1',
  type: 'text',
  content: 'Hello!',
  fileName: null,
  fileSize: null,
  mimeType: 'text/plain',
  storageKey: null,
  thumbnailKey: null,
  status: 'active',
  isPublic: false,
  shareToken: null,
  uploadStatus: 'complete',
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

const FILE_ITEM = {
  ...BASE_ITEM,
  id: 'item-2',
  type: 'image',
  content: null,
  mimeType: 'image/png',
  fileName: 'photo.png',
  fileSize: 2048,
  storageKey: 'clipboard/user-1/item-2/photo.png',
};

describe('ClipboardShareService', () => {
  let service: ClipboardShareService;
  let prisma: any;
  let s3: any;
  let events: any;
  let configService: any;

  beforeEach(async () => {
    prisma = {
      clipboardItem: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
      },
    };

    s3 = {
      getSignedDownloadUrl: jest.fn().mockResolvedValue('https://s3.example.com/signed'),
    };

    events = {
      emitToUser: jest.fn(),
    };

    configService = {
      get: jest.fn().mockImplementation((key: string) => {
        if (key === 'appUrl') return 'https://app.example.com';
        return undefined;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClipboardShareService,
        { provide: PrismaService, useValue: prisma },
        { provide: S3StorageProvider, useValue: s3 },
        { provide: EventsGateway, useValue: events },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    service = module.get<ClipboardShareService>(ClipboardShareService);
  });

  // ---------------------------------------------------------------------------
  // enableSharing
  // ---------------------------------------------------------------------------
  describe('enableSharing', () => {
    it('should generate a share token and return shareToken + shareUrl', async () => {
      prisma.clipboardItem.findUnique.mockResolvedValue(BASE_ITEM);
      prisma.clipboardItem.update.mockResolvedValue({
        ...BASE_ITEM,
        isPublic: true,
        shareToken: 'abc123',
      });

      const result = await service.enableSharing('user-1', 'item-1');

      expect(result.shareToken).toBeDefined();
      expect(result.shareToken).toHaveLength(32); // 16 bytes → 32 hex chars
      expect(result.shareUrl).toMatch(/^https:\/\/app\.example\.com\/share\//);
    });

    it('should update item with isPublic=true and shareToken in db', async () => {
      prisma.clipboardItem.findUnique.mockResolvedValue(BASE_ITEM);
      prisma.clipboardItem.update.mockResolvedValue({
        ...BASE_ITEM,
        isPublic: true,
        shareToken: 'deadbeef',
      });

      await service.enableSharing('user-1', 'item-1');

      expect(prisma.clipboardItem.update).toHaveBeenCalledWith({
        where: { id: 'item-1' },
        data: expect.objectContaining({ isPublic: true, shareToken: expect.any(String) }),
      });
    });

    it('should emit item:updated via EventsGateway', async () => {
      prisma.clipboardItem.findUnique.mockResolvedValue(BASE_ITEM);
      prisma.clipboardItem.update.mockResolvedValue({
        ...BASE_ITEM,
        isPublic: true,
        shareToken: 'tok',
      });

      await service.enableSharing('user-1', 'item-1');

      expect(events.emitToUser).toHaveBeenCalledWith(
        'user-1',
        'item:updated',
        expect.any(Object),
      );
    });

    it('should throw NotFoundException when item does not exist', async () => {
      prisma.clipboardItem.findUnique.mockResolvedValue(null);

      await expect(service.enableSharing('user-1', 'missing-item')).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.clipboardItem.update).not.toHaveBeenCalled();
    });

    it('should throw ForbiddenException when user does not own the item', async () => {
      prisma.clipboardItem.findUnique.mockResolvedValue({
        ...BASE_ITEM,
        userId: 'other-user',
      });

      await expect(service.enableSharing('user-1', 'item-1')).rejects.toThrow(
        ForbiddenException,
      );
      expect(prisma.clipboardItem.update).not.toHaveBeenCalled();
    });

    it('should use fallback appUrl when ConfigService returns undefined', async () => {
      configService.get.mockReturnValue(undefined);

      prisma.clipboardItem.findUnique.mockResolvedValue(BASE_ITEM);
      prisma.clipboardItem.update.mockResolvedValue({
        ...BASE_ITEM,
        isPublic: true,
        shareToken: 'tok',
      });

      const result = await service.enableSharing('user-1', 'item-1');

      expect(result.shareUrl).toContain('localhost:8320');
    });
  });

  // ---------------------------------------------------------------------------
  // disableSharing
  // ---------------------------------------------------------------------------
  describe('disableSharing', () => {
    it('should set isPublic=false and shareToken=null', async () => {
      prisma.clipboardItem.findUnique.mockResolvedValue({
        ...BASE_ITEM,
        isPublic: true,
        shareToken: 'tok',
      });
      prisma.clipboardItem.update.mockResolvedValue({
        ...BASE_ITEM,
        isPublic: false,
        shareToken: null,
      });

      await service.disableSharing('user-1', 'item-1');

      expect(prisma.clipboardItem.update).toHaveBeenCalledWith({
        where: { id: 'item-1' },
        data: { isPublic: false, shareToken: null },
      });
    });

    it('should emit item:updated via EventsGateway', async () => {
      prisma.clipboardItem.findUnique.mockResolvedValue({
        ...BASE_ITEM,
        isPublic: true,
        shareToken: 'tok',
      });
      prisma.clipboardItem.update.mockResolvedValue({
        ...BASE_ITEM,
        isPublic: false,
        shareToken: null,
      });

      await service.disableSharing('user-1', 'item-1');

      expect(events.emitToUser).toHaveBeenCalledWith(
        'user-1',
        'item:updated',
        expect.any(Object),
      );
    });

    it('should throw NotFoundException when item does not exist', async () => {
      prisma.clipboardItem.findUnique.mockResolvedValue(null);

      await expect(service.disableSharing('user-1', 'missing')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException when user does not own the item', async () => {
      prisma.clipboardItem.findUnique.mockResolvedValue({
        ...BASE_ITEM,
        userId: 'other-user',
        isPublic: true,
        shareToken: 'tok',
      });

      await expect(service.disableSharing('user-1', 'item-1')).rejects.toThrow(
        ForbiddenException,
      );
      expect(prisma.clipboardItem.update).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // getPublicItem
  // ---------------------------------------------------------------------------
  describe('getPublicItem', () => {
    it('should return safe subset for a text item', async () => {
      prisma.clipboardItem.findFirst.mockResolvedValue({
        ...BASE_ITEM,
        isPublic: true,
        shareToken: 'tok',
      });

      const result = await service.getPublicItem('tok');

      expect(result).toMatchObject({
        id: 'item-1',
        type: 'text',
        content: 'Hello!',
        mimeType: 'text/plain',
      });
      // userId must not be exposed
      expect(result['userId']).toBeUndefined();
    });

    it('should include downloadUrl for image type items', async () => {
      prisma.clipboardItem.findFirst.mockResolvedValue({
        ...FILE_ITEM,
        isPublic: true,
        shareToken: 'tok',
      });

      const result = await service.getPublicItem('tok');

      expect(result['downloadUrl']).toBe('https://s3.example.com/signed');
      expect(s3.getSignedDownloadUrl).toHaveBeenCalledWith(FILE_ITEM.storageKey);
    });

    it('should include downloadUrl for file type items', async () => {
      prisma.clipboardItem.findFirst.mockResolvedValue({
        ...FILE_ITEM,
        type: 'file',
        isPublic: true,
        shareToken: 'tok',
      });

      const result = await service.getPublicItem('tok');

      expect(result['downloadUrl']).toBeDefined();
    });

    it('should include downloadUrl for media type items', async () => {
      prisma.clipboardItem.findFirst.mockResolvedValue({
        ...FILE_ITEM,
        type: 'media',
        mimeType: 'video/mp4',
        isPublic: true,
        shareToken: 'tok',
      });

      const result = await service.getPublicItem('tok');

      expect(result['downloadUrl']).toBeDefined();
    });

    it('should not include downloadUrl for text items without storageKey', async () => {
      prisma.clipboardItem.findFirst.mockResolvedValue({
        ...BASE_ITEM,
        isPublic: true,
        shareToken: 'tok',
      });

      const result = await service.getPublicItem('tok');

      expect(result['downloadUrl']).toBeUndefined();
      expect(s3.getSignedDownloadUrl).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when shareToken is invalid', async () => {
      prisma.clipboardItem.findFirst.mockResolvedValue(null);

      await expect(service.getPublicItem('invalid-token')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should query only isPublic=true and status=active items', async () => {
      prisma.clipboardItem.findFirst.mockResolvedValue(null);

      await expect(service.getPublicItem('tok')).rejects.toThrow(NotFoundException);

      expect(prisma.clipboardItem.findFirst).toHaveBeenCalledWith({
        where: { shareToken: 'tok', isPublic: true, status: 'active' },
      });
    });
  });

  // ---------------------------------------------------------------------------
  // getPublicDownloadUrl
  // ---------------------------------------------------------------------------
  describe('getPublicDownloadUrl', () => {
    it('should return a signed URL for a public file item', async () => {
      prisma.clipboardItem.findFirst.mockResolvedValue({
        ...FILE_ITEM,
        isPublic: true,
        shareToken: 'tok',
      });

      const result = await service.getPublicDownloadUrl('tok');

      expect(result).toEqual({ url: 'https://s3.example.com/signed' });
      expect(s3.getSignedDownloadUrl).toHaveBeenCalledWith(FILE_ITEM.storageKey);
    });

    it('should throw NotFoundException when share token is invalid', async () => {
      prisma.clipboardItem.findFirst.mockResolvedValue(null);

      await expect(service.getPublicDownloadUrl('bad-token')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException when item has no storageKey', async () => {
      prisma.clipboardItem.findFirst.mockResolvedValue({
        ...BASE_ITEM,
        isPublic: true,
        shareToken: 'tok',
        storageKey: null,
      });

      await expect(service.getPublicDownloadUrl('tok')).rejects.toThrow(
        NotFoundException,
      );
      expect(s3.getSignedDownloadUrl).not.toHaveBeenCalled();
    });
  });
});
