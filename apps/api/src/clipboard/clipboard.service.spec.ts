import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { ClipboardService } from './clipboard.service';
import { PrismaService } from '../prisma/prisma.service';
import { S3StorageProvider } from '../storage/s3-storage.provider';

const mockUser = {
  id: 'user-1',
  email: 'test@example.com',
};

const mockClipboardItem = {
  id: 'item-1',
  userId: 'user-1',
  type: 'text',
  content: 'Hello, clipboard!',
  mimeType: 'text/plain',
  fileName: null,
  fileSize: null,
  storageKey: null,
  status: 'active',
  uploadStatus: 'complete',
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockFileItem = {
  ...mockClipboardItem,
  id: 'item-2',
  type: 'image',
  content: null,
  mimeType: 'image/png',
  fileName: 'photo.png',
  fileSize: 1024,
  storageKey: 'clipboard/user-1/item-2/photo.png',
};

describe('ClipboardService', () => {
  let service: ClipboardService;
  let prisma: any;
  let s3: any;

  beforeEach(async () => {
    prisma = {
      clipboardItem: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        count: jest.fn(),
        update: jest.fn(),
      },
      $transaction: jest.fn(),
    };

    s3 = {
      upload: jest.fn(),
      getSignedDownloadUrl: jest.fn(),
      delete: jest.fn(),
      exists: jest.fn(),
    };

    const configService = {
      get: jest.fn().mockReturnValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClipboardService,
        { provide: PrismaService, useValue: prisma },
        { provide: S3StorageProvider, useValue: s3 },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    service = module.get<ClipboardService>(ClipboardService);
  });

  // ---------------------------------------------------------------------------
  // createTextItem
  // ---------------------------------------------------------------------------
  describe('createTextItem', () => {
    it('should create item with type=text and return it', async () => {
      prisma.clipboardItem.create.mockResolvedValue(mockClipboardItem);

      const result = await service.createTextItem('user-1', 'Hello, clipboard!');

      expect(result).toEqual(mockClipboardItem);
      expect(prisma.clipboardItem.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'user-1',
            type: 'text',
            content: 'Hello, clipboard!',
            mimeType: 'text/plain',
            status: 'active',
            uploadStatus: 'complete',
          }),
        }),
      );
    });
  });

  // ---------------------------------------------------------------------------
  // createFileItem
  // ---------------------------------------------------------------------------
  describe('createFileItem', () => {
    it('should upload to S3 then create DB record', async () => {
      const fileInput = {
        buffer: Buffer.alloc(1024),
        filename: 'photo.png',
        mimetype: 'image/png',
      };

      s3.upload.mockResolvedValue(undefined);
      prisma.clipboardItem.create.mockResolvedValue(mockFileItem);

      const result = await service.createFileItem('user-1', fileInput);

      expect(s3.upload).toHaveBeenCalledBefore !== undefined; // upload called first
      expect(s3.upload).toHaveBeenCalledTimes(1);
      expect(prisma.clipboardItem.create).toHaveBeenCalledTimes(1);
      expect(result).toEqual(mockFileItem);

      // Verify S3 key structure
      const [s3Key, body, contentType] = s3.upload.mock.calls[0];
      expect(s3Key).toMatch(/^clipboard\/user-1\/.+\/photo\.png$/);
      expect(body).toBe(fileInput.buffer);
      expect(contentType).toBe('image/png');
    });

    it('should fail fast without writing to DB if S3 upload fails', async () => {
      s3.upload.mockRejectedValue(new Error('S3 error'));

      await expect(
        service.createFileItem('user-1', {
          buffer: Buffer.alloc(512),
          filename: 'file.txt',
          mimetype: 'text/plain',
        }),
      ).rejects.toThrow('S3 error');

      expect(prisma.clipboardItem.create).not.toHaveBeenCalled();
    });

    it('should detect type=image for image/png', async () => {
      s3.upload.mockResolvedValue(undefined);
      prisma.clipboardItem.create.mockResolvedValue({ ...mockFileItem, type: 'image' });

      await service.createFileItem('user-1', {
        buffer: Buffer.alloc(10),
        filename: 'img.png',
        mimetype: 'image/png',
      });

      expect(prisma.clipboardItem.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ type: 'image' }),
        }),
      );
    });

    it('should detect type=media for video/mp4', async () => {
      s3.upload.mockResolvedValue(undefined);
      prisma.clipboardItem.create.mockResolvedValue({ ...mockFileItem, type: 'media', mimeType: 'video/mp4' });

      await service.createFileItem('user-1', {
        buffer: Buffer.alloc(10),
        filename: 'video.mp4',
        mimetype: 'video/mp4',
      });

      expect(prisma.clipboardItem.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ type: 'media' }),
        }),
      );
    });

    it('should detect type=media for audio/mpeg', async () => {
      s3.upload.mockResolvedValue(undefined);
      prisma.clipboardItem.create.mockResolvedValue({ ...mockFileItem, type: 'media', mimeType: 'audio/mpeg' });

      await service.createFileItem('user-1', {
        buffer: Buffer.alloc(10),
        filename: 'audio.mp3',
        mimetype: 'audio/mpeg',
      });

      expect(prisma.clipboardItem.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ type: 'media' }),
        }),
      );
    });

    it('should detect type=file for application/pdf', async () => {
      s3.upload.mockResolvedValue(undefined);
      prisma.clipboardItem.create.mockResolvedValue({ ...mockFileItem, type: 'file', mimeType: 'application/pdf' });

      await service.createFileItem('user-1', {
        buffer: Buffer.alloc(10),
        filename: 'doc.pdf',
        mimetype: 'application/pdf',
      });

      expect(prisma.clipboardItem.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ type: 'file' }),
        }),
      );
    });

    it('should detect type=text for text/csv', async () => {
      s3.upload.mockResolvedValue(undefined);
      prisma.clipboardItem.create.mockResolvedValue({ ...mockFileItem, type: 'text', mimeType: 'text/csv' });

      await service.createFileItem('user-1', {
        buffer: Buffer.alloc(10),
        filename: 'data.csv',
        mimetype: 'text/csv',
      });

      expect(prisma.clipboardItem.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ type: 'text' }),
        }),
      );
    });

    it('should store fileSize as buffer.length in the DB record', async () => {
      const buffer = Buffer.alloc(4096);
      s3.upload.mockResolvedValue(undefined);
      prisma.clipboardItem.create.mockResolvedValue({ ...mockFileItem, fileSize: 4096 });

      await service.createFileItem('user-1', {
        buffer,
        filename: 'file.bin',
        mimetype: 'application/octet-stream',
      });

      expect(prisma.clipboardItem.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ fileSize: 4096 }),
        }),
      );
    });
  });

  // ---------------------------------------------------------------------------
  // listItems
  // ---------------------------------------------------------------------------
  describe('listItems', () => {
    const defaultQuery = {
      page: 1,
      pageSize: 10,
      status: 'active' as const,
      sortBy: 'createdAt' as const,
      sortOrder: 'desc' as const,
    };

    it('should return paginated results with correct shape', async () => {
      prisma.$transaction.mockResolvedValue([[mockClipboardItem], 1]);

      const result = await service.listItems('user-1', defaultQuery);

      expect(result).toEqual({
        items: [mockClipboardItem],
        total: 1,
        page: 1,
        pageSize: 10,
        totalPages: 1,
      });
    });

    it('should calculate totalPages correctly for multiple pages', async () => {
      prisma.$transaction.mockResolvedValue([[], 25]);

      const result = await service.listItems('user-1', { ...defaultQuery, pageSize: 10 });

      expect(result.totalPages).toBe(3);
      expect(result.total).toBe(25);
    });

    it('should apply type filter when provided', async () => {
      // findMany and count are called inside the array passed to $transaction.
      // Capture the where clause by tracking findMany call args before $transaction resolves.
      prisma.clipboardItem.findMany.mockResolvedValue([]);
      prisma.clipboardItem.count.mockResolvedValue(0);
      prisma.$transaction.mockImplementation((calls: Promise<any>[]) => Promise.all(calls));

      await service.listItems('user-1', { ...defaultQuery, type: 'image' as const });

      expect(prisma.clipboardItem.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ type: 'image' }),
        }),
      );
      expect(prisma.clipboardItem.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ type: 'image' }),
        }),
      );
    });

    it('should pass search filter when provided', async () => {
      prisma.$transaction.mockResolvedValue([[], 0]);

      await service.listItems('user-1', { ...defaultQuery, search: 'hello' });

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    });

    it('should use correct skip value based on page and pageSize', async () => {
      prisma.$transaction.mockResolvedValue([[mockClipboardItem], 11]);

      const result = await service.listItems('user-1', {
        ...defaultQuery,
        page: 2,
        pageSize: 5,
      });

      // page=2, pageSize=5 -> skip=5
      expect(result.page).toBe(2);
      expect(result.pageSize).toBe(5);
    });
  });

  // ---------------------------------------------------------------------------
  // getItem
  // ---------------------------------------------------------------------------
  describe('getItem', () => {
    it('should return item when owned by user', async () => {
      prisma.clipboardItem.findUnique.mockResolvedValue(mockClipboardItem);

      const result = await service.getItem('user-1', 'item-1');

      expect(result).toEqual(mockClipboardItem);
      expect(prisma.clipboardItem.findUnique).toHaveBeenCalledWith({
        where: { id: 'item-1' },
      });
    });

    it('should throw NotFoundException when item does not exist', async () => {
      prisma.clipboardItem.findUnique.mockResolvedValue(null);

      await expect(service.getItem('user-1', 'nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException when item owned by different user', async () => {
      prisma.clipboardItem.findUnique.mockResolvedValue({
        ...mockClipboardItem,
        userId: 'other-user',
      });

      await expect(service.getItem('user-1', 'item-1')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  // ---------------------------------------------------------------------------
  // updateItem
  // ---------------------------------------------------------------------------
  describe('updateItem', () => {
    it('should verify ownership then update content', async () => {
      const updated = { ...mockClipboardItem, content: 'Updated content' };
      prisma.clipboardItem.findUnique.mockResolvedValue(mockClipboardItem);
      prisma.clipboardItem.update.mockResolvedValue(updated);

      const result = await service.updateItem('user-1', 'item-1', {
        content: 'Updated content',
      });

      expect(result).toEqual(updated);
      expect(prisma.clipboardItem.update).toHaveBeenCalledWith({
        where: { id: 'item-1' },
        data: { content: 'Updated content' },
      });
    });

    it('should update status', async () => {
      const updated = { ...mockClipboardItem, status: 'archived' };
      prisma.clipboardItem.findUnique.mockResolvedValue(mockClipboardItem);
      prisma.clipboardItem.update.mockResolvedValue(updated);

      const result = await service.updateItem('user-1', 'item-1', {
        status: 'archived',
      });

      expect(result.status).toBe('archived');
      expect(prisma.clipboardItem.update).toHaveBeenCalledWith({
        where: { id: 'item-1' },
        data: { status: 'archived' },
      });
    });

    it('should not include undefined fields in update data', async () => {
      prisma.clipboardItem.findUnique.mockResolvedValue(mockClipboardItem);
      prisma.clipboardItem.update.mockResolvedValue(mockClipboardItem);

      await service.updateItem('user-1', 'item-1', {});

      expect(prisma.clipboardItem.update).toHaveBeenCalledWith({
        where: { id: 'item-1' },
        data: {},
      });
    });

    it('should throw ForbiddenException when user does not own item', async () => {
      prisma.clipboardItem.findUnique.mockResolvedValue({
        ...mockClipboardItem,
        userId: 'other-user',
      });

      await expect(
        service.updateItem('user-1', 'item-1', { content: 'new' }),
      ).rejects.toThrow(ForbiddenException);

      expect(prisma.clipboardItem.update).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // deleteItem
  // ---------------------------------------------------------------------------
  describe('deleteItem', () => {
    it('should set status to deleted', async () => {
      const deleted = { ...mockClipboardItem, status: 'deleted' };
      prisma.clipboardItem.findUnique.mockResolvedValue(mockClipboardItem);
      prisma.clipboardItem.update.mockResolvedValue(deleted);

      const result = await service.deleteItem('user-1', 'item-1');

      expect(result.status).toBe('deleted');
      expect(prisma.clipboardItem.update).toHaveBeenCalledWith({
        where: { id: 'item-1' },
        data: { status: 'deleted' },
      });
    });

    it('should throw ForbiddenException when user does not own item', async () => {
      prisma.clipboardItem.findUnique.mockResolvedValue({
        ...mockClipboardItem,
        userId: 'other-user',
      });

      await expect(service.deleteItem('user-1', 'item-1')).rejects.toThrow(
        ForbiddenException,
      );

      expect(prisma.clipboardItem.update).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when item does not exist', async () => {
      prisma.clipboardItem.findUnique.mockResolvedValue(null);

      await expect(service.deleteItem('user-1', 'nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ---------------------------------------------------------------------------
  // getDownloadUrl
  // ---------------------------------------------------------------------------
  describe('getDownloadUrl', () => {
    it('should return signed URL for file items with a storageKey', async () => {
      prisma.clipboardItem.findUnique.mockResolvedValue(mockFileItem);
      s3.getSignedDownloadUrl.mockResolvedValue('https://s3.example.com/signed');

      const result = await service.getDownloadUrl('user-1', 'item-2');

      expect(result).toEqual({ url: 'https://s3.example.com/signed' });
      expect(s3.getSignedDownloadUrl).toHaveBeenCalledWith(mockFileItem.storageKey);
    });

    it('should throw NotFoundException for items without storageKey', async () => {
      prisma.clipboardItem.findUnique.mockResolvedValue(mockClipboardItem); // no storageKey

      await expect(service.getDownloadUrl('user-1', 'item-1')).rejects.toThrow(
        NotFoundException,
      );

      expect(s3.getSignedDownloadUrl).not.toHaveBeenCalled();
    });

    it('should throw ForbiddenException when user does not own item', async () => {
      prisma.clipboardItem.findUnique.mockResolvedValue({
        ...mockFileItem,
        userId: 'other-user',
      });

      await expect(service.getDownloadUrl('user-1', 'item-2')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw NotFoundException when item does not exist', async () => {
      prisma.clipboardItem.findUnique.mockResolvedValue(null);

      await expect(service.getDownloadUrl('user-1', 'nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
