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
// XHR mock — supports multiple concurrent instances
// ---------------------------------------------------------------------------
interface MockXHRInstance {
  open: ReturnType<typeof vi.fn>;
  send: ReturnType<typeof vi.fn>;
  setRequestHeader: ReturnType<typeof vi.fn>;
  upload: { onprogress: ((e: ProgressEvent) => void) | null };
  onload: (() => void) | null;
  onerror: (() => void) | null;
  onabort: (() => void) | null;
  status: number;
  getResponseHeader: ReturnType<typeof vi.fn>;
  abort: ReturnType<typeof vi.fn>;
}

let xhrInstances: MockXHRInstance[] = [];

function createMockXHR(): MockXHRInstance {
  const instance: MockXHRInstance = {
    open: vi.fn(),
    send: vi.fn(),
    setRequestHeader: vi.fn(),
    upload: { onprogress: null },
    onload: null,
    onerror: null,
    onabort: null,
    status: 200,
    getResponseHeader: vi.fn().mockReturnValue('"etag-value"'),
    abort: vi.fn(),
  };
  xhrInstances.push(instance);
  return instance;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
vi.stubGlobal('XMLHttpRequest', function MockXHR(this: any) {
  return createMockXHR();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const PART_SIZE = 10 * 1024 * 1024; // 10 MB

function makeFile(sizeBytes: number, name = 'test.bin'): File {
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

/** Resolve all pending XHR instances by triggering onload on each. */
async function resolveAllPendingXHRs() {
  // Allow microtasks to settle so XHR instances are created
  await new Promise((r) => setTimeout(r, 0));

  let safety = 0;
  while (safety++ < 20) {
    const pending = xhrInstances.filter((x) => x.onload !== null && x.send.mock.calls.length > 0);
    if (pending.length === 0) break;
    for (const xhr of pending) {
      act(() => { xhr.onload!(); });
    }
    // Allow the next round of async work
    await new Promise((r) => setTimeout(r, 0));
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('useMultipartUpload', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    xhrInstances = [];
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

      // Resolve all XHR part uploads (concurrent)
      await resolveAllPendingXHRs();

      const returnedItem = await uploadPromise!;

      expect(returnedItem).toEqual(item);
      expect(mockedInit).toHaveBeenCalledWith({
        fileName: 'large.bin',
        fileSize: file.size,
        mimeType: 'application/octet-stream',
      });
      expect(mockedGetUrl).toHaveBeenCalledTimes(2);
      expect(mockedRecord).toHaveBeenCalledTimes(2);
      // Parts should be sorted by partNumber in the completion call
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

      // Wait for XHR instances to be created
      await waitFor(() => expect(xhrInstances.length).toBeGreaterThan(0));

      // Trigger progress event on first XHR (50% of that part)
      const firstXHR = xhrInstances[0];
      await waitFor(() => expect(firstXHR.upload.onprogress).not.toBeNull());
      act(() => {
        firstXHR.upload.onprogress!({
          lengthComputable: true,
          loaded: PART_SIZE / 2,
          total: PART_SIZE,
        } as ProgressEvent);
      });

      // Progress should be ~25% (half of part 1 out of 2 total parts)
      expect(result.current.progress).toBe(25);

      // Complete all parts
      await resolveAllPendingXHRs();

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

      // Wait until at least one XHR is set up
      await waitFor(() => expect(xhrInstances.length).toBeGreaterThan(0));
      const firstXHR = xhrInstances[0];
      await waitFor(() => expect(firstXHR.onabort).not.toBeNull());

      // Abort while uploads are in flight
      act(() => {
        result.current.abort();
        // Simulate the browser calling the XHR onabort handler on all active XHRs
        for (const xhr of xhrInstances) {
          if (xhr.onabort) xhr.onabort();
        }
      });

      // Wait for the promise to reject and for React state to settle
      await expect(uploadPromise!).rejects.toThrow('Upload cancelled');

      await waitFor(() => {
        expect(result.current.isUploading).toBe(false);
      });

      expect(mockedAbort).toHaveBeenCalledWith('item-1');
      expect(result.current.error?.message).toBe('Upload cancelled');
      expect(result.current.currentFile).toBeNull();
    });
  });
});
