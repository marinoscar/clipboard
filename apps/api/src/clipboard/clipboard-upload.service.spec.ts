import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import {
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { ClipboardUploadService } from './clipboard-upload.service';
import { PrismaService } from '../prisma/prisma.service';
import { S3StorageProvider } from '../storage/s3-storage.provider';
import { EventsGateway } from '../gateway/events.gateway';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const USER_ID = 'user-1';
const ITEM_ID = 'item-uuid-1';
const UPLOAD_ID = 's3-upload-id-abc';
const STORAGE_KEY = `clipboard/${USER_ID}/${ITEM_ID}/test-file.bin`;

const mockUploadingItem: any = {
  id: ITEM_ID,
  userId: USER_ID,
  type: 'file',
  fileName: 'test-file.bin',
  fileSize: 25 * 1024 * 1024,
  mimeType: 'application/octet-stream',
  storageKey: STORAGE_KEY,
  s3UploadId: UPLOAD_ID,
  uploadStatus: 'uploading',
  status: 'active',
  content: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockInitUploadDto = {
  fileName: 'test-file.bin',
  fileSize: 25 * 1024 * 1024, // 25 MB
  mimeType: 'application/octet-stream',
};

// ── Suite ─────────────────────────────────────────────────────────────────────

describe('ClipboardUploadService', () => {
  let service: ClipboardUploadService;
  let prisma: any;
  let s3: any;
  let configService: any;
  let eventsGateway: any;

  beforeEach(async () => {
    prisma = {
      clipboardItem: {
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      uploadChunk: {
        upsert: jest.fn(),
        findMany: jest.fn(),
        deleteMany: jest.fn(),
      },
    };

    s3 = {
      initMultipartUpload: jest.fn(),
      getSignedPartUrl: jest.fn(),
      completeMultipartUpload: jest.fn(),
      abortMultipartUpload: jest.fn(),
    };

    configService = {
      get: jest.fn().mockReturnValue(undefined),
    };

    eventsGateway = {
      emitToUser: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClipboardUploadService,
        { provide: PrismaService, useValue: prisma },
        { provide: S3StorageProvider, useValue: s3 },
        { provide: ConfigService, useValue: configService },
        { provide: EventsGateway, useValue: eventsGateway },
      ],
    }).compile();

    service = module.get<ClipboardUploadService>(ClipboardUploadService);
  });

  // ── initUpload ─────────────────────────────────────────────────────────────

  describe('initUpload', () => {
    it('should create clipboard item and start S3 multipart upload', async () => {
      s3.initMultipartUpload.mockResolvedValue(UPLOAD_ID);
      prisma.clipboardItem.create.mockResolvedValue(mockUploadingItem);

      const result = await service.initUpload(USER_ID, mockInitUploadDto);

      expect(s3.initMultipartUpload).toHaveBeenCalledWith(
        expect.stringContaining(mockInitUploadDto.fileName),
        mockInitUploadDto.mimeType,
      );
      expect(prisma.clipboardItem.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: USER_ID,
            uploadStatus: 'uploading',
            status: 'active',
            s3UploadId: UPLOAD_ID,
            fileName: mockInitUploadDto.fileName,
            fileSize: mockInitUploadDto.fileSize,
            mimeType: mockInitUploadDto.mimeType,
          }),
        }),
      );
      expect(result).toHaveProperty('itemId');
      expect(result).toHaveProperty('uploadId', UPLOAD_ID);
      expect(result).toHaveProperty('totalParts');
      expect(result).toHaveProperty('partSize');
    });

    it('should calculate correct totalParts for 25MB file with default 10MB part size', async () => {
      // Default partSize is 10MB, so 25MB / 10MB = 2.5 → ceil → 3 parts
      configService.get.mockReturnValue(10 * 1024 * 1024);
      s3.initMultipartUpload.mockResolvedValue(UPLOAD_ID);
      prisma.clipboardItem.create.mockResolvedValue(mockUploadingItem);

      const result = await service.initUpload(USER_ID, {
        fileName: 'big-file.bin',
        fileSize: 25 * 1024 * 1024,
        mimeType: 'application/octet-stream',
      });

      expect(result.totalParts).toBe(3);
    });

    it('should calculate totalParts = 1 for a file smaller than partSize', async () => {
      configService.get.mockReturnValue(10 * 1024 * 1024);
      s3.initMultipartUpload.mockResolvedValue(UPLOAD_ID);
      prisma.clipboardItem.create.mockResolvedValue(mockUploadingItem);

      const result = await service.initUpload(USER_ID, {
        fileName: 'small.bin',
        fileSize: 5 * 1024 * 1024,
        mimeType: 'application/octet-stream',
      });

      expect(result.totalParts).toBe(1);
    });

    it('should calculate totalParts = 10 for exactly 100MB file with 10MB parts', async () => {
      configService.get.mockReturnValue(10 * 1024 * 1024);
      s3.initMultipartUpload.mockResolvedValue(UPLOAD_ID);
      prisma.clipboardItem.create.mockResolvedValue(mockUploadingItem);

      const result = await service.initUpload(USER_ID, {
        fileName: 'exact.bin',
        fileSize: 100 * 1024 * 1024,
        mimeType: 'application/octet-stream',
      });

      expect(result.totalParts).toBe(10);
    });

    it('should build the S3 storage key using userId and fileName', async () => {
      s3.initMultipartUpload.mockResolvedValue(UPLOAD_ID);
      prisma.clipboardItem.create.mockResolvedValue(mockUploadingItem);

      await service.initUpload(USER_ID, mockInitUploadDto);

      const [s3Key] = s3.initMultipartUpload.mock.calls[0];
      expect(s3Key).toMatch(new RegExp(`^clipboard/${USER_ID}/[^/]+/${mockInitUploadDto.fileName}$`));
    });
  });

  // ── getPartUrl ─────────────────────────────────────────────────────────────

  describe('getPartUrl', () => {
    it('should return presigned URL for a valid part request', async () => {
      const presignedUrl = 'https://s3.example.com/presigned-part-1';
      prisma.clipboardItem.findUnique.mockResolvedValue(mockUploadingItem);
      s3.getSignedPartUrl.mockResolvedValue(presignedUrl);

      const result = await service.getPartUrl(USER_ID, ITEM_ID, 1);

      expect(s3.getSignedPartUrl).toHaveBeenCalledWith(
        mockUploadingItem.storageKey,
        mockUploadingItem.s3UploadId,
        1,
      );
      expect(result).toEqual({ url: presignedUrl, partNumber: 1 });
    });

    it('should throw ForbiddenException when item belongs to a different user', async () => {
      prisma.clipboardItem.findUnique.mockResolvedValue({
        ...mockUploadingItem,
        userId: 'other-user',
      });

      await expect(service.getPartUrl(USER_ID, ITEM_ID, 1)).rejects.toThrow(
        ForbiddenException,
      );

      expect(s3.getSignedPartUrl).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when item does not exist', async () => {
      prisma.clipboardItem.findUnique.mockResolvedValue(null);

      await expect(service.getPartUrl(USER_ID, ITEM_ID, 1)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException when upload is not in progress', async () => {
      prisma.clipboardItem.findUnique.mockResolvedValue({
        ...mockUploadingItem,
        uploadStatus: 'complete',
      });

      await expect(service.getPartUrl(USER_ID, ITEM_ID, 1)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // ── completePart ───────────────────────────────────────────────────────────

  describe('completePart', () => {
    it('should upsert an upload chunk record', async () => {
      const mockChunk = {
        id: 'chunk-1',
        itemId: ITEM_ID,
        partNumber: 1,
        eTag: '"etag-abc"',
        size: 10 * 1024 * 1024,
        uploadedAt: new Date(),
      };
      prisma.clipboardItem.findUnique.mockResolvedValue(mockUploadingItem);
      prisma.uploadChunk.upsert.mockResolvedValue(mockChunk);

      const result = await service.completePart(USER_ID, ITEM_ID, 1, '"etag-abc"', 10 * 1024 * 1024);

      expect(prisma.uploadChunk.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { itemId_partNumber: { itemId: ITEM_ID, partNumber: 1 } },
          create: expect.objectContaining({
            itemId: ITEM_ID,
            partNumber: 1,
            eTag: '"etag-abc"',
            size: 10 * 1024 * 1024,
          }),
          update: { eTag: '"etag-abc"', size: 10 * 1024 * 1024 },
        }),
      );
      expect(result).toEqual(mockChunk);
    });

    it('should throw ForbiddenException when item is not owned by user', async () => {
      prisma.clipboardItem.findUnique.mockResolvedValue({
        ...mockUploadingItem,
        userId: 'other-user',
      });

      await expect(
        service.completePart(USER_ID, ITEM_ID, 1, '"etag-abc"', 1024),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw BadRequestException when upload is already complete', async () => {
      prisma.clipboardItem.findUnique.mockResolvedValue({
        ...mockUploadingItem,
        uploadStatus: 'complete',
      });

      await expect(
        service.completePart(USER_ID, ITEM_ID, 1, '"etag-abc"', 1024),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ── completeUpload ─────────────────────────────────────────────────────────

  describe('completeUpload', () => {
    const parts = [
      { partNumber: 1, eTag: '"etag-1"' },
      { partNumber: 2, eTag: '"etag-2"' },
    ];

    it('should complete S3 multipart upload and update item status', async () => {
      const completedItem = { ...mockUploadingItem, uploadStatus: 'complete', s3UploadId: null };
      prisma.clipboardItem.findUnique.mockResolvedValue(mockUploadingItem);
      s3.completeMultipartUpload.mockResolvedValue(undefined);
      prisma.clipboardItem.update.mockResolvedValue(completedItem);

      const result = await service.completeUpload(USER_ID, ITEM_ID, parts);

      expect(s3.completeMultipartUpload).toHaveBeenCalledWith(
        mockUploadingItem.storageKey,
        mockUploadingItem.s3UploadId,
        [
          { PartNumber: 1, ETag: '"etag-1"' },
          { PartNumber: 2, ETag: '"etag-2"' },
        ],
      );
      expect(prisma.clipboardItem.update).toHaveBeenCalledWith({
        where: { id: ITEM_ID },
        data: { uploadStatus: 'complete', s3UploadId: null },
      });
      expect(result).toEqual(completedItem);
    });

    it('should throw NotFoundException when item does not exist', async () => {
      prisma.clipboardItem.findUnique.mockResolvedValue(null);

      await expect(service.completeUpload(USER_ID, ITEM_ID, parts)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException when item belongs to a different user', async () => {
      prisma.clipboardItem.findUnique.mockResolvedValue({
        ...mockUploadingItem,
        userId: 'other-user',
      });

      await expect(service.completeUpload(USER_ID, ITEM_ID, parts)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should emit item:created event via EventsGateway after completion', async () => {
      const completedItem = { ...mockUploadingItem, uploadStatus: 'complete', s3UploadId: null };
      prisma.clipboardItem.findUnique.mockResolvedValue(mockUploadingItem);
      s3.completeMultipartUpload.mockResolvedValue(undefined);
      prisma.clipboardItem.update.mockResolvedValue(completedItem);

      await service.completeUpload(USER_ID, ITEM_ID, parts);

      expect(eventsGateway.emitToUser).toHaveBeenCalledWith(
        USER_ID,
        'item:created',
        completedItem,
      );
    });

    it('should throw BadRequestException when upload is not in progress', async () => {
      prisma.clipboardItem.findUnique.mockResolvedValue({
        ...mockUploadingItem,
        uploadStatus: 'complete',
      });

      await expect(service.completeUpload(USER_ID, ITEM_ID, parts)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // ── abortUpload ────────────────────────────────────────────────────────────

  describe('abortUpload', () => {
    it('should abort S3 multipart, delete chunks, and set status to failed', async () => {
      const failedItem = { ...mockUploadingItem, uploadStatus: 'failed', s3UploadId: null };
      prisma.clipboardItem.findUnique.mockResolvedValue(mockUploadingItem);
      s3.abortMultipartUpload.mockResolvedValue(undefined);
      prisma.uploadChunk.deleteMany.mockResolvedValue({ count: 2 });
      prisma.clipboardItem.update.mockResolvedValue(failedItem);

      const result = await service.abortUpload(USER_ID, ITEM_ID);

      expect(s3.abortMultipartUpload).toHaveBeenCalledWith(
        mockUploadingItem.storageKey,
        mockUploadingItem.s3UploadId,
      );
      expect(prisma.uploadChunk.deleteMany).toHaveBeenCalledWith({
        where: { itemId: ITEM_ID },
      });
      expect(prisma.clipboardItem.update).toHaveBeenCalledWith({
        where: { id: ITEM_ID },
        data: { uploadStatus: 'failed', s3UploadId: null },
      });
      expect(result).toEqual(failedItem);
    });

    it('should throw ForbiddenException when item belongs to a different user', async () => {
      prisma.clipboardItem.findUnique.mockResolvedValue({
        ...mockUploadingItem,
        userId: 'other-user',
      });

      await expect(service.abortUpload(USER_ID, ITEM_ID)).rejects.toThrow(
        ForbiddenException,
      );

      expect(s3.abortMultipartUpload).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when item does not exist', async () => {
      prisma.clipboardItem.findUnique.mockResolvedValue(null);

      await expect(service.abortUpload(USER_ID, ITEM_ID)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException when upload is not in progress', async () => {
      prisma.clipboardItem.findUnique.mockResolvedValue({
        ...mockUploadingItem,
        uploadStatus: 'failed',
      });

      await expect(service.abortUpload(USER_ID, ITEM_ID)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // ── getUploadStatus ────────────────────────────────────────────────────────

  describe('getUploadStatus', () => {
    it('should return item info and list of uploaded parts', async () => {
      const mockChunks = [
        { partNumber: 1, eTag: '"etag-1"', size: 10 * 1024 * 1024, uploadedAt: new Date() },
        { partNumber: 2, eTag: '"etag-2"', size: 5 * 1024 * 1024, uploadedAt: new Date() },
      ];
      prisma.clipboardItem.findUnique.mockResolvedValue(mockUploadingItem);
      prisma.uploadChunk.findMany.mockResolvedValue(mockChunks);

      const result = await service.getUploadStatus(USER_ID, ITEM_ID);

      expect(result).toEqual({
        itemId: ITEM_ID,
        uploadStatus: 'uploading',
        fileName: mockUploadingItem.fileName,
        fileSize: mockUploadingItem.fileSize,
        uploadedParts: mockChunks,
      });
      expect(prisma.uploadChunk.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { itemId: ITEM_ID },
          orderBy: { partNumber: 'asc' },
        }),
      );
    });

    it('should return empty uploadedParts when no chunks exist yet', async () => {
      prisma.clipboardItem.findUnique.mockResolvedValue(mockUploadingItem);
      prisma.uploadChunk.findMany.mockResolvedValue([]);

      const result = await service.getUploadStatus(USER_ID, ITEM_ID);

      expect(result.uploadedParts).toEqual([]);
    });

    it('should throw NotFoundException when item does not exist', async () => {
      prisma.clipboardItem.findUnique.mockResolvedValue(null);

      await expect(service.getUploadStatus(USER_ID, ITEM_ID)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException when item belongs to a different user', async () => {
      prisma.clipboardItem.findUnique.mockResolvedValue({
        ...mockUploadingItem,
        userId: 'other-user',
      });

      await expect(service.getUploadStatus(USER_ID, ITEM_ID)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });
});
