import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useMultipartUpload } from './useMultipartUpload';
import type { ClipboardItem } from '../types/index';

// ---------------------------------------------------------------------------
// Mock API module
// ---------------------------------------------------------------------------
vi.mock('../services/api', () => ({
  initMultipartUpload: vi.fn(),
  getPartUploadUrl: vi.fn(),
  recordUploadPart: vi.fn(),
  completeMultipartUpload: vi.fn(),
  abortMultipartUpload: vi.fn(),
}));

import {
  initMultipartUpload,
  getPartUploadUrl,
  recordUploadPart,
  completeMultipartUpload,
  abortMultipartUpload,
} from '../services/api';

const mockedInit = vi.mocked(initMultipartUpload);
const mockedGetUrl = vi.mocked(getPartUploadUrl);
const mockedRecord = vi.mocked(recordUploadPart);
const mockedComplete = vi.mocked(completeMultipartUpload);
const mockedAbort = vi.mocked(abortMultipartUpload);

// ---------------------------------------------------------------------------
// XHR mock
// ---------------------------------------------------------------------------
const mockXHR = {
  open: vi.fn(),
  send: vi.fn(),
  setRequestHeader: vi.fn(),
  upload: { onprogress: null as ((e: ProgressEvent) => void) | null },
  onload: null as (() => void) | null,
  onerror: null as (() => void) | null,
  onabort: null as (() => void) | null,
  status: 200,
  getResponseHeader: vi.fn().mockReturnValue('"etag-value"'),
  abort: vi.fn(),
};

// Must be a real constructor function (not an arrow function) so that
// `new XMLHttpRequest()` works. Returning mockXHR from the constructor causes
// JS to use that object as the result of `new`, so all property assignments
// (xhr.onload = ..., xhr.upload.onprogress = ...) land on mockXHR directly.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
vi.stubGlobal('XMLHttpRequest', function MockXHR(this: any) {
  return mockXHR;
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const PART_SIZE = 10 * 1024 * 1024; // 10 MB

function makeFile(sizeBytes: number, name = 'test.bin'): File {
  // Create a Blob of the exact size, then cast to File
  const content = new Uint8Array(sizeBytes);
  return new File([content], name, { type: 'application/octet-stream' });
}

function makeClipboardItem(overrides: Partial<ClipboardItem> = {}): ClipboardItem {
  return {
    id: 'item-1',
    userId: 'user-1',
    type: 'file',
    content: null,
    fileName: 'large.bin',
    fileSize: PART_SIZE * 2,
    mimeType: 'application/octet-stream',
    storageKey: 'some/key',
    uploadStatus: 'complete',
    s3UploadId: null,
    status: 'active',
    isPublic: false,
    isFavorite: false,
    shareToken: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('useMultipartUpload', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset XHR event handlers between tests
    mockXHR.onload = null;
    mockXHR.onerror = null;
    mockXHR.onabort = null;
    mockXHR.upload.onprogress = null;
    mockXHR.status = 200;
    mockXHR.getResponseHeader.mockReturnValue('"etag-value"');
    // abortMultipartUpload is called in the catch path of startUpload;
    // ensure it always returns a Promise so .catch() does not throw.
    mockedAbort.mockResolvedValue(undefined);
  });

  // -------------------------------------------------------------------------
  // isLargeFile
  // -------------------------------------------------------------------------
  describe('isLargeFile', () => {
    it('should return true for files > 10 MB', () => {
      const { result } = renderHook(() => useMultipartUpload());
      const bigFile = makeFile(PART_SIZE + 1);
      expect(result.current.isLargeFile(bigFile)).toBe(true);
    });

    it('should return false for files <= 10 MB', () => {
      const { result } = renderHook(() => useMultipartUpload());
      const smallFile = makeFile(PART_SIZE);
      expect(result.current.isLargeFile(smallFile)).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // startUpload — happy path
  // -------------------------------------------------------------------------
  describe('startUpload', () => {
    it('should upload file in parts and return the clipboard item', async () => {
      const item = makeClipboardItem();

      mockedInit.mockResolvedValue({
        itemId: 'item-1',
        uploadId: 'upload-1',
        partSize: PART_SIZE,
        totalParts: 2,
        storageKey: 'some/key',
      });
      mockedGetUrl.mockImplementation(async (_itemId, partNumber) => ({
        url: `https://s3.example.com/presigned?part=${partNumber}`,
        partNumber,
      }));
      mockedRecord.mockResolvedValue(undefined);
      mockedComplete.mockResolvedValue(item);

      const file = makeFile(PART_SIZE * 2, 'large.bin');
      const { result } = renderHook(() => useMultipartUpload());

      let uploadPromise: Promise<ClipboardItem>;

      act(() => {
        uploadPromise = result.current.startUpload(file);
      });

      // Allow the init call to settle, then trigger the first XHR load
      await waitFor(() => expect(mockXHR.onload).not.toBeNull());
      act(() => { mockXHR.onload!(); });

      // After part 1 is done, part 2's XHR is set up — trigger it
      await waitFor(() => expect(mockedRecord).toHaveBeenCalledTimes(1));
      act(() => { mockXHR.onload!(); });

      const returnedItem = await uploadPromise!;

      expect(returnedItem).toEqual(item);
      expect(mockedInit).toHaveBeenCalledWith({
        fileName: 'large.bin',
        fileSize: file.size,
        mimeType: 'application/octet-stream',
      });
      expect(mockedGetUrl).toHaveBeenCalledTimes(2);
      expect(mockedRecord).toHaveBeenCalledTimes(2);
      expect(mockedComplete).toHaveBeenCalledWith('item-1', [
        { partNumber: 1, eTag: 'etag-value' },
        { partNumber: 2, eTag: 'etag-value' },
      ]);
    });

    it('should track progress during upload', async () => {
      const item = makeClipboardItem();

      mockedInit.mockResolvedValue({
        itemId: 'item-1',
        uploadId: 'upload-1',
        partSize: PART_SIZE,
        totalParts: 2,
        storageKey: 'some/key',
      });
      mockedGetUrl.mockImplementation(async (_itemId, partNumber) => ({
        url: `https://s3.example.com/presigned?part=${partNumber}`,
        partNumber,
      }));
      mockedRecord.mockResolvedValue(undefined);
      mockedComplete.mockResolvedValue(item);

      const file = makeFile(PART_SIZE * 2, 'large.bin');
      const { result } = renderHook(() => useMultipartUpload());

      act(() => {
        result.current.startUpload(file);
      });

      // isUploading should be true immediately after start
      expect(result.current.isUploading).toBe(true);

      // Trigger XHR progress event for part 1 (50% of that part)
      await waitFor(() => expect(mockXHR.upload.onprogress).not.toBeNull());
      act(() => {
        mockXHR.upload.onprogress!({
          lengthComputable: true,
          loaded: PART_SIZE / 2,
          total: PART_SIZE,
        } as ProgressEvent);
      });

      // Progress should be 25% (half of part 1 out of 2 total parts)
      expect(result.current.progress).toBe(25);

      // Complete part 1
      act(() => { mockXHR.onload!(); });

      await waitFor(() => expect(mockedRecord).toHaveBeenCalledTimes(1));

      // Progress after part 1 completes = 50%
      expect(result.current.progress).toBe(50);

      // Complete part 2
      act(() => { mockXHR.onload!(); });

      await waitFor(() => expect(result.current.isUploading).toBe(false));
      expect(result.current.progress).toBe(100);
    });

    it('should set error on API failure', async () => {
      mockedInit.mockRejectedValue(new Error('Init failed'));

      const file = makeFile(PART_SIZE * 2, 'large.bin');
      const { result } = renderHook(() => useMultipartUpload());

      await act(async () => {
        await expect(result.current.startUpload(file)).rejects.toThrow('Init failed');
      });

      expect(result.current.isUploading).toBe(false);
      expect(result.current.error).toBeInstanceOf(Error);
      expect(result.current.error?.message).toBe('Init failed');
    });
  });

  // -------------------------------------------------------------------------
  // abort
  // -------------------------------------------------------------------------
  describe('abort', () => {
    it('should call abortMultipartUpload API and reset state', async () => {
      mockedInit.mockResolvedValue({
        itemId: 'item-1',
        uploadId: 'upload-1',
        partSize: PART_SIZE,
        totalParts: 2,
        storageKey: 'some/key',
      });
      mockedGetUrl.mockImplementation(async (_itemId, partNumber) => ({
        url: `https://s3.example.com/presigned?part=${partNumber}`,
        partNumber,
      }));
      mockedRecord.mockResolvedValue(undefined);
      mockedAbort.mockResolvedValue(undefined);

      const file = makeFile(PART_SIZE * 2, 'large.bin');
      const { result } = renderHook(() => useMultipartUpload());

      let uploadPromise: Promise<ClipboardItem>;

      act(() => {
        uploadPromise = result.current.startUpload(file);
      });

      // Wait until the first XHR is set up (init has resolved, presigned URL fetched)
      await waitFor(() => expect(mockXHR.onload).not.toBeNull());

      // Abort while part 1 upload is in flight
      act(() => {
        result.current.abort();
        // Simulate the browser calling the XHR onabort handler
        mockXHR.onabort!();
      });

      // Wait for the promise to reject and for React state to settle
      await expect(uploadPromise!).rejects.toThrow('Upload cancelled');

      // State updates are async — wait for them to apply
      await waitFor(() => {
        expect(result.current.isUploading).toBe(false);
      });

      expect(mockedAbort).toHaveBeenCalledWith('item-1');
      expect(result.current.error?.message).toBe('Upload cancelled');
      expect(result.current.currentFile).toBeNull();
    });
  });
});
