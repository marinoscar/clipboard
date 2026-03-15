import { Test, TestingModule } from '@nestjs/testing';
import { ClipboardUploadController } from './clipboard-upload.controller';
import { ClipboardUploadService } from './clipboard-upload.service';
import { RequestUser } from '../auth/interfaces/authenticated-user.interface';
import {
  InitUploadDto,
  CompleteUploadDto,
  RecordPartDto,
  PartUrlQueryDto,
} from './dto/multipart-upload.dto';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const mockRequestUser: RequestUser = {
  id: 'user-1',
  email: 'test@example.com',
  isAdmin: false,
  isActive: true,
};

const ITEM_ID = 'item-uuid-1';

// ── Suite ─────────────────────────────────────────────────────────────────────

describe('ClipboardUploadController', () => {
  let controller: ClipboardUploadController;
  let uploadService: jest.Mocked<ClipboardUploadService>;

  beforeEach(async () => {
    const mockUploadService = {
      initUpload: jest.fn(),
      getPartUrl: jest.fn(),
      completePart: jest.fn(),
      completeUpload: jest.fn(),
      abortUpload: jest.fn(),
      getUploadStatus: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ClipboardUploadController],
      providers: [
        { provide: ClipboardUploadService, useValue: mockUploadService },
      ],
    }).compile();

    controller = module.get<ClipboardUploadController>(ClipboardUploadController);
    uploadService = module.get(ClipboardUploadService);
  });

  // ── initUpload ─────────────────────────────────────────────────────────────

  describe('initUpload', () => {
    it('should call service.initUpload with user.id and the dto', async () => {
      const dto: InitUploadDto = {
        fileName: 'video.mp4',
        fileSize: 50 * 1024 * 1024,
        mimeType: 'video/mp4',
      };
      const serviceResult = {
        itemId: ITEM_ID,
        uploadId: 's3-upload-1',
        totalParts: 5,
        partSize: 10 * 1024 * 1024,
      };
      uploadService.initUpload.mockResolvedValue(serviceResult);

      const result = await controller.initUpload(dto, mockRequestUser);

      expect(uploadService.initUpload).toHaveBeenCalledWith(mockRequestUser.id, dto);
      expect(result).toEqual(serviceResult);
    });
  });

  // ── getPartUrl ─────────────────────────────────────────────────────────────

  describe('getPartUrl', () => {
    it('should call service.getPartUrl with user.id, item id, and part number', async () => {
      const query: PartUrlQueryDto = { partNumber: 3 };
      const serviceResult = { url: 'https://s3.example.com/presigned', partNumber: 3 };
      uploadService.getPartUrl.mockResolvedValue(serviceResult);

      const result = await controller.getPartUrl(ITEM_ID, query, mockRequestUser);

      expect(uploadService.getPartUrl).toHaveBeenCalledWith(
        mockRequestUser.id,
        ITEM_ID,
        query.partNumber,
      );
      expect(result).toEqual(serviceResult);
    });
  });

  // ── recordPart ─────────────────────────────────────────────────────────────

  describe('recordPart', () => {
    it('should call service.completePart with all required arguments', async () => {
      const dto: RecordPartDto = {
        partNumber: 2,
        eTag: '"etag-part-2"',
        size: 10 * 1024 * 1024,
      };
      const mockChunk = {
        id: 'chunk-id',
        itemId: ITEM_ID,
        partNumber: 2,
        eTag: '"etag-part-2"',
        size: 10 * 1024 * 1024,
        uploadedAt: new Date(),
      };
      uploadService.completePart.mockResolvedValue(mockChunk);

      const result = await controller.recordPart(ITEM_ID, dto, mockRequestUser);

      expect(uploadService.completePart).toHaveBeenCalledWith(
        mockRequestUser.id,
        ITEM_ID,
        dto.partNumber,
        dto.eTag,
        dto.size,
      );
      expect(result).toEqual(mockChunk);
    });
  });

  // ── completeUpload ─────────────────────────────────────────────────────────

  describe('completeUpload', () => {
    it('should call service.completeUpload with user.id, item id, and parts array', async () => {
      const dto: CompleteUploadDto = {
        parts: [
          { partNumber: 1, eTag: '"etag-1"' },
          { partNumber: 2, eTag: '"etag-2"' },
        ],
      };
      const completedItem = {
        id: ITEM_ID,
        uploadStatus: 'complete',
        status: 'active',
      };
      uploadService.completeUpload.mockResolvedValue(completedItem);

      const result = await controller.completeUpload(ITEM_ID, dto, mockRequestUser);

      expect(uploadService.completeUpload).toHaveBeenCalledWith(
        mockRequestUser.id,
        ITEM_ID,
        dto.parts,
      );
      expect(result).toEqual(completedItem);
    });
  });

  // ── abortUpload ────────────────────────────────────────────────────────────

  describe('abortUpload', () => {
    it('should call service.abortUpload with user.id and item id', async () => {
      const abortedItem = {
        id: ITEM_ID,
        uploadStatus: 'failed',
        status: 'active',
      };
      uploadService.abortUpload.mockResolvedValue(abortedItem);

      const result = await controller.abortUpload(ITEM_ID, mockRequestUser);

      expect(uploadService.abortUpload).toHaveBeenCalledWith(
        mockRequestUser.id,
        ITEM_ID,
      );
      expect(result).toEqual(abortedItem);
    });
  });

  // ── getStatus ──────────────────────────────────────────────────────────────

  describe('getStatus', () => {
    it('should call service.getUploadStatus with user.id and item id', async () => {
      const statusResult = {
        itemId: ITEM_ID,
        uploadStatus: 'uploading',
        fileName: 'video.mp4',
        fileSize: 50 * 1024 * 1024,
        uploadedParts: [
          { partNumber: 1, eTag: '"etag-1"', size: 10 * 1024 * 1024, uploadedAt: new Date() },
        ],
      };
      uploadService.getUploadStatus.mockResolvedValue(statusResult);

      const result = await controller.getStatus(ITEM_ID, mockRequestUser);

      expect(uploadService.getUploadStatus).toHaveBeenCalledWith(
        mockRequestUser.id,
        ITEM_ID,
      );
      expect(result).toEqual(statusResult);
    });
  });
});
