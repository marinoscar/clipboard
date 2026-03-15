import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { S3StorageProvider } from './s3-storage.provider';

// --- Module-level mocks ---

const mockSend = jest.fn();

jest.mock('@aws-sdk/client-s3', () => {
  return {
    S3Client: jest.fn().mockImplementation(() => ({ send: mockSend })),
    PutObjectCommand: jest.fn().mockImplementation((params) => ({ ...params, _type: 'PutObjectCommand' })),
    GetObjectCommand: jest.fn().mockImplementation((params) => ({ ...params, _type: 'GetObjectCommand' })),
    DeleteObjectCommand: jest.fn().mockImplementation((params) => ({ ...params, _type: 'DeleteObjectCommand' })),
    HeadObjectCommand: jest.fn().mockImplementation((params) => ({ ...params, _type: 'HeadObjectCommand' })),
  };
});

const mockGetSignedUrl = jest.fn();

jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: (...args: any[]) => mockGetSignedUrl(...args),
}));

// Re-import after mocking
import {
  PutObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';

describe('S3StorageProvider', () => {
  let provider: S3StorageProvider;

  const configValues: Record<string, any> = {
    'storage.s3.region': 'us-east-1',
    'storage.s3.accessKeyId': 'test-key-id',
    'storage.s3.secretAccessKey': 'test-secret',
    'storage.s3.bucket': 'test-bucket',
    'storage.signedUrlExpiry': 3600,
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const configService = {
      get: jest.fn((key: string, defaultValue?: any) => {
        return key in configValues ? configValues[key] : defaultValue;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        S3StorageProvider,
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    provider = module.get<S3StorageProvider>(S3StorageProvider);
  });

  describe('upload', () => {
    it('should call S3Client.send with PutObjectCommand and correct params', async () => {
      mockSend.mockResolvedValue({});

      const key = 'clipboard/user-1/item-1/file.txt';
      const body = Buffer.from('hello world');
      const contentType = 'text/plain';

      await provider.upload(key, body, contentType);

      expect(mockSend).toHaveBeenCalledTimes(1);
      expect(PutObjectCommand).toHaveBeenCalledWith({
        Bucket: 'test-bucket',
        Key: key,
        Body: body,
        ContentType: contentType,
      });
    });

    it('should propagate errors from S3Client.send', async () => {
      mockSend.mockRejectedValue(new Error('S3 upload failed'));

      await expect(
        provider.upload('key', Buffer.from('data'), 'text/plain'),
      ).rejects.toThrow('S3 upload failed');
    });
  });

  describe('getSignedDownloadUrl', () => {
    it('should return the signed URL string from getSignedUrl', async () => {
      const expectedUrl = 'https://s3.amazonaws.com/test-bucket/key?signature=abc';
      mockGetSignedUrl.mockResolvedValue(expectedUrl);

      const url = await provider.getSignedDownloadUrl('clipboard/user-1/item-1/file.txt');

      expect(url).toBe(expectedUrl);
      expect(mockGetSignedUrl).toHaveBeenCalledTimes(1);
    });

    it('should use custom expiry seconds when provided', async () => {
      mockGetSignedUrl.mockResolvedValue('https://example.com/signed');

      await provider.getSignedDownloadUrl('some-key', 7200);

      const [, , options] = mockGetSignedUrl.mock.calls[0];
      expect(options).toEqual({ expiresIn: 7200 });
    });

    it('should use default expiry seconds from config when not provided', async () => {
      mockGetSignedUrl.mockResolvedValue('https://example.com/signed');

      await provider.getSignedDownloadUrl('some-key');

      const [, , options] = mockGetSignedUrl.mock.calls[0];
      expect(options).toEqual({ expiresIn: 3600 });
    });
  });

  describe('delete', () => {
    it('should call S3Client.send with DeleteObjectCommand', async () => {
      mockSend.mockResolvedValue({});

      const key = 'clipboard/user-1/item-1/file.txt';
      await provider.delete(key);

      expect(mockSend).toHaveBeenCalledTimes(1);
      expect(DeleteObjectCommand).toHaveBeenCalledWith({
        Bucket: 'test-bucket',
        Key: key,
      });
    });

    it('should propagate errors from S3Client.send', async () => {
      mockSend.mockRejectedValue(new Error('S3 delete failed'));

      await expect(provider.delete('key')).rejects.toThrow('S3 delete failed');
    });
  });

  describe('exists', () => {
    it('should return true when HeadObjectCommand succeeds', async () => {
      mockSend.mockResolvedValue({});

      const result = await provider.exists('existing-key');

      expect(result).toBe(true);
      expect(HeadObjectCommand).toHaveBeenCalledWith({
        Bucket: 'test-bucket',
        Key: 'existing-key',
      });
    });

    it('should return false when HeadObjectCommand throws NotFound by name', async () => {
      const error = Object.assign(new Error('Not Found'), { name: 'NotFound' });
      mockSend.mockRejectedValue(error);

      const result = await provider.exists('missing-key');

      expect(result).toBe(false);
    });

    it('should return false when HeadObjectCommand throws NoSuchKey by name', async () => {
      const error = Object.assign(new Error('No Such Key'), { name: 'NoSuchKey' });
      mockSend.mockRejectedValue(error);

      const result = await provider.exists('missing-key');

      expect(result).toBe(false);
    });

    it('should return false when HeadObjectCommand throws 404 via $metadata', async () => {
      const error = Object.assign(new Error('HTTP 404'), {
        name: 'UnknownError',
        $metadata: { httpStatusCode: 404 },
      });
      mockSend.mockRejectedValue(error);

      const result = await provider.exists('missing-key');

      expect(result).toBe(false);
    });

    it('should rethrow unexpected errors', async () => {
      const error = Object.assign(new Error('Access Denied'), {
        name: 'AccessDenied',
      });
      mockSend.mockRejectedValue(error);

      await expect(provider.exists('some-key')).rejects.toThrow('Access Denied');
    });
  });
});
