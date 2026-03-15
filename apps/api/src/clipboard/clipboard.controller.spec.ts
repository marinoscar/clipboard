import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { ClipboardController } from './clipboard.controller';
import { ClipboardService } from './clipboard.service';
import { ClipboardQueryDto } from './dto/clipboard-query.dto';
import { UpdateItemDto } from './dto/update-item.dto';

const mockRequestUser = {
  id: 'user-1',
  email: 'test@example.com',
  isAdmin: false,
};

const mockClipboardItem = {
  id: 'item-1',
  userId: 'user-1',
  type: 'text',
  content: 'Hello',
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
  fileSize: 2048,
  storageKey: 'clipboard/user-1/item-2/photo.png',
};

const mockPaginatedResult = {
  items: [mockClipboardItem],
  total: 1,
  page: 1,
  pageSize: 50,
  totalPages: 1,
};

describe('ClipboardController', () => {
  let controller: ClipboardController;
  let clipboardService: any;

  beforeEach(async () => {
    clipboardService = {
      createTextItem: jest.fn(),
      createFileItem: jest.fn(),
      listItems: jest.fn(),
      getItem: jest.fn(),
      updateItem: jest.fn(),
      deleteItem: jest.fn(),
      getDownloadUrl: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ClipboardController],
      providers: [
        { provide: ClipboardService, useValue: clipboardService },
      ],
    }).compile();

    controller = module.get<ClipboardController>(ClipboardController);
  });

  // ---------------------------------------------------------------------------
  // POST /clipboard
  // ---------------------------------------------------------------------------
  describe('createTextItem', () => {
    it('should call createTextItem with user.id and content', async () => {
      clipboardService.createTextItem.mockResolvedValue(mockClipboardItem);

      const dto = { type: 'text' as const, content: 'Hello' };
      const result = await controller.createTextItem(dto, mockRequestUser);

      expect(result).toEqual(mockClipboardItem);
      expect(clipboardService.createTextItem).toHaveBeenCalledWith('user-1', 'Hello');
    });
  });

  // ---------------------------------------------------------------------------
  // POST /clipboard/upload
  // ---------------------------------------------------------------------------
  describe('uploadFile', () => {
    it('should call createFileItem with correct args when file is present', async () => {
      clipboardService.createFileItem.mockResolvedValue(mockFileItem);

      const buffer = Buffer.from('fake-image-data');
      const mockFile = {
        filename: 'photo.png',
        mimetype: 'image/png',
        toBuffer: jest.fn().mockResolvedValue(buffer),
      };
      const mockReq = {
        file: jest.fn().mockResolvedValue(mockFile),
      } as any;

      const result = await controller.uploadFile(mockReq, mockRequestUser);

      expect(result).toEqual(mockFileItem);
      expect(mockReq.file).toHaveBeenCalledTimes(1);
      expect(clipboardService.createFileItem).toHaveBeenCalledWith('user-1', {
        buffer,
        filename: 'photo.png',
        mimetype: 'image/png',
      });
    });

    it('should throw BadRequestException when no file is provided', async () => {
      const mockReq = {
        file: jest.fn().mockResolvedValue(null),
      } as any;

      await expect(
        controller.uploadFile(mockReq, mockRequestUser),
      ).rejects.toThrow(BadRequestException);

      expect(clipboardService.createFileItem).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when file() returns undefined', async () => {
      const mockReq = {
        file: jest.fn().mockResolvedValue(undefined),
      } as any;

      await expect(
        controller.uploadFile(mockReq, mockRequestUser),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ---------------------------------------------------------------------------
  // GET /clipboard
  // ---------------------------------------------------------------------------
  describe('listItems', () => {
    it('should call listItems with user.id and query params', async () => {
      clipboardService.listItems.mockResolvedValue(mockPaginatedResult);

      const query: ClipboardQueryDto = {
        page: 1,
        pageSize: 50,
        status: 'active',
        sortBy: 'createdAt',
        sortOrder: 'desc',
      };

      const result = await controller.listItems(query, mockRequestUser);

      expect(result).toEqual(mockPaginatedResult);
      expect(clipboardService.listItems).toHaveBeenCalledWith('user-1', query);
    });

    it('should pass type filter through to service', async () => {
      clipboardService.listItems.mockResolvedValue({ ...mockPaginatedResult, items: [] });

      const query: ClipboardQueryDto = {
        page: 1,
        pageSize: 10,
        type: 'image',
        status: 'active',
        sortBy: 'createdAt',
        sortOrder: 'desc',
      };

      await controller.listItems(query, mockRequestUser);

      expect(clipboardService.listItems).toHaveBeenCalledWith('user-1', query);
    });

    it('should pass search filter through to service', async () => {
      clipboardService.listItems.mockResolvedValue(mockPaginatedResult);

      const query: ClipboardQueryDto = {
        page: 1,
        pageSize: 50,
        search: 'hello',
        status: 'active',
        sortBy: 'createdAt',
        sortOrder: 'desc',
      };

      await controller.listItems(query, mockRequestUser);

      expect(clipboardService.listItems).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({ search: 'hello' }),
      );
    });
  });

  // ---------------------------------------------------------------------------
  // GET /clipboard/:id
  // ---------------------------------------------------------------------------
  describe('getItem', () => {
    it('should call getItem with user.id and id', async () => {
      clipboardService.getItem.mockResolvedValue(mockClipboardItem);

      const result = await controller.getItem('item-1', mockRequestUser);

      expect(result).toEqual(mockClipboardItem);
      expect(clipboardService.getItem).toHaveBeenCalledWith('user-1', 'item-1');
    });
  });

  // ---------------------------------------------------------------------------
  // PATCH /clipboard/:id
  // ---------------------------------------------------------------------------
  describe('updateItem', () => {
    it('should call updateItem with user.id, id, and dto', async () => {
      const updated = { ...mockClipboardItem, content: 'Updated' };
      clipboardService.updateItem.mockResolvedValue(updated);

      const dto: UpdateItemDto = { content: 'Updated' };
      const result = await controller.updateItem('item-1', dto, mockRequestUser);

      expect(result).toEqual(updated);
      expect(clipboardService.updateItem).toHaveBeenCalledWith('user-1', 'item-1', dto);
    });

    it('should call updateItem when updating status', async () => {
      const updated = { ...mockClipboardItem, status: 'archived' };
      clipboardService.updateItem.mockResolvedValue(updated);

      const dto: UpdateItemDto = { status: 'archived' };
      const result = await controller.updateItem('item-1', dto, mockRequestUser);

      expect(result.status).toBe('archived');
      expect(clipboardService.updateItem).toHaveBeenCalledWith('user-1', 'item-1', dto);
    });
  });

  // ---------------------------------------------------------------------------
  // DELETE /clipboard/:id
  // ---------------------------------------------------------------------------
  describe('deleteItem', () => {
    it('should call deleteItem with user.id and id', async () => {
      const deleted = { ...mockClipboardItem, status: 'deleted' };
      clipboardService.deleteItem.mockResolvedValue(deleted);

      const result = await controller.deleteItem('item-1', mockRequestUser);

      expect(result).toEqual(deleted);
      expect(clipboardService.deleteItem).toHaveBeenCalledWith('user-1', 'item-1');
    });
  });

  // ---------------------------------------------------------------------------
  // GET /clipboard/:id/download
  // ---------------------------------------------------------------------------
  describe('getDownloadUrl', () => {
    it('should call getDownloadUrl with user.id and id', async () => {
      const signedUrlResult = { url: 'https://s3.example.com/signed' };
      clipboardService.getDownloadUrl.mockResolvedValue(signedUrlResult);

      const result = await controller.getDownloadUrl('item-2', mockRequestUser);

      expect(result).toEqual(signedUrlResult);
      expect(clipboardService.getDownloadUrl).toHaveBeenCalledWith('user-1', 'item-2');
    });
  });
});
