import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import {
  ClipboardShareController,
  ShareController,
} from './clipboard-share.controller';
import { ClipboardShareService } from './clipboard-share.service';

const mockRequestUser = {
  id: 'user-1',
  email: 'test@example.com',
  isAdmin: false,
  isActive: true,
};

describe('ClipboardShareController', () => {
  let controller: ClipboardShareController;
  let shareService: any;

  beforeEach(async () => {
    shareService = {
      enableSharing: jest.fn(),
      disableSharing: jest.fn(),
      getPublicItem: jest.fn(),
      getPublicDownloadUrl: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ClipboardShareController],
      providers: [{ provide: ClipboardShareService, useValue: shareService }],
    }).compile();

    controller = module.get<ClipboardShareController>(ClipboardShareController);
  });

  describe('enableSharing', () => {
    it('should call shareService.enableSharing with user.id and item id', async () => {
      shareService.enableSharing.mockResolvedValue({
        shareToken: 'abc123',
        shareUrl: 'https://app.example.com/share/abc123',
      });

      const result = await controller.enableSharing('item-1', mockRequestUser);

      expect(result).toEqual({
        shareToken: 'abc123',
        shareUrl: 'https://app.example.com/share/abc123',
      });
      expect(shareService.enableSharing).toHaveBeenCalledWith('user-1', 'item-1');
    });

    it('should propagate NotFoundException from service', async () => {
      shareService.enableSharing.mockRejectedValue(new NotFoundException('Item not found'));

      await expect(
        controller.enableSharing('missing-item', mockRequestUser),
      ).rejects.toThrow(NotFoundException);
    });

    it('should propagate ForbiddenException from service', async () => {
      shareService.enableSharing.mockRejectedValue(
        new ForbiddenException('Not owner'),
      );

      await expect(
        controller.enableSharing('item-1', mockRequestUser),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('disableSharing', () => {
    it('should call shareService.disableSharing with user.id and item id', async () => {
      shareService.disableSharing.mockResolvedValue(undefined);

      await controller.disableSharing('item-1', mockRequestUser);

      expect(shareService.disableSharing).toHaveBeenCalledWith('user-1', 'item-1');
    });

    it('should propagate NotFoundException from service', async () => {
      shareService.disableSharing.mockRejectedValue(new NotFoundException('Not found'));

      await expect(
        controller.disableSharing('missing', mockRequestUser),
      ).rejects.toThrow(NotFoundException);
    });
  });
});

describe('ShareController', () => {
  let controller: ShareController;
  let shareService: any;

  beforeEach(async () => {
    shareService = {
      getPublicItem: jest.fn(),
      getPublicDownloadUrl: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ShareController],
      providers: [{ provide: ClipboardShareService, useValue: shareService }],
    }).compile();

    controller = module.get<ShareController>(ShareController);
  });

  describe('getPublicItem', () => {
    it('should call shareService.getPublicItem with the share token', async () => {
      const publicItem = {
        id: 'item-1',
        type: 'text',
        content: 'Hello',
        mimeType: 'text/plain',
        createdAt: new Date(),
      };
      shareService.getPublicItem.mockResolvedValue(publicItem);

      const result = await controller.getPublicItem('abc123');

      expect(result).toEqual(publicItem);
      expect(shareService.getPublicItem).toHaveBeenCalledWith('abc123');
    });

    it('should propagate NotFoundException for invalid tokens', async () => {
      shareService.getPublicItem.mockRejectedValue(new NotFoundException('Not found'));

      await expect(controller.getPublicItem('bad-token')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getPublicDownloadUrl', () => {
    it('should call shareService.getPublicDownloadUrl with the share token', async () => {
      shareService.getPublicDownloadUrl.mockResolvedValue({
        url: 'https://s3.example.com/signed',
      });

      const result = await controller.getPublicDownloadUrl('abc123');

      expect(result).toEqual({ url: 'https://s3.example.com/signed' });
      expect(shareService.getPublicDownloadUrl).toHaveBeenCalledWith('abc123');
    });

    it('should propagate NotFoundException when no file is attached', async () => {
      shareService.getPublicDownloadUrl.mockRejectedValue(
        new NotFoundException('No file'),
      );

      await expect(controller.getPublicDownloadUrl('tok')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
