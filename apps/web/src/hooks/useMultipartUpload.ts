import { useState, useCallback, useRef } from 'react';
import {
  initMultipartUpload,
  getPartUploadUrl,
  recordUploadPart,
  completeMultipartUpload,
  abortMultipartUpload,
} from '../services/api';
import { ClipboardItem } from '../types';

const MULTIPART_THRESHOLD = 10 * 1024 * 1024; // 10 MB
const MAX_RETRIES = 3;
const CONCURRENCY = 3;

interface MultipartUploadState {
  isUploading: boolean;
  progress: number;
  error: Error | null;
  currentFile: File | null;
}

interface UseMultipartUploadReturn extends MultipartUploadState {
  startUpload: (file: File) => Promise<ClipboardItem>;
  abort: () => void;
  isLargeFile: (file: File) => boolean;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function uploadPartToS3WithRetry(
  url: string,
  data: Blob,
  signal: AbortSignal,
  onProgress: (loaded: number, total: number) => void,
): Promise<string> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    if (signal.aborted) {
      throw new DOMException('Upload aborted', 'AbortError');
    }

    try {
      const eTag = await uploadPartToS3(url, data, signal, onProgress);

      if (!eTag) {
        throw new Error(
          'S3 did not return an ETag header. Check S3 CORS config: ExposeHeaders must include "ETag".',
        );
      }

      return eTag;
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        throw err;
      }
      lastError = err instanceof Error ? err : new Error('Upload failed');

      // Don't retry if it's an ETag/CORS issue — it won't help
      if (lastError.message.includes('ETag')) {
        throw lastError;
      }

      if (attempt < MAX_RETRIES - 1) {
        // Exponential backoff: 1s, 2s, 4s
        await sleep(1000 * Math.pow(2, attempt));
      }
    }
  }

  throw lastError ?? new Error('Upload failed after retries');
}

function uploadPartToS3(
  url: string,
  data: Blob,
  signal: AbortSignal,
  onProgress: (loaded: number, total: number) => void,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress(event.loaded, event.total);
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        // ETag may be quoted, strip surrounding quotes
        const rawETag = xhr.getResponseHeader('ETag') || '';
        const eTag = rawETag.replace(/^"|"$/g, '');
        resolve(eTag);
      } else {
        reject(new Error(`S3 upload failed with status ${xhr.status}`));
      }
    };

    xhr.onerror = () => reject(new Error('S3 upload network error'));
    xhr.onabort = () => reject(new DOMException('Upload aborted', 'AbortError'));

    signal.addEventListener('abort', () => xhr.abort());

    xhr.open('PUT', url);
    xhr.send(data);
  });
}

export function useMultipartUpload(): UseMultipartUploadReturn {
  const [state, setState] = useState<MultipartUploadState>({
    isUploading: false,
    progress: 0,
    error: null,
    currentFile: null,
  });

  const abortControllerRef = useRef<AbortController | null>(null);
  // Track in-progress itemId so abort can call the API endpoint
  const activeItemIdRef = useRef<string | null>(null);

  const isLargeFile = useCallback((file: File) => file.size > MULTIPART_THRESHOLD, []);

  const abort = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  }, []);

  const startUpload = useCallback(async (file: File): Promise<ClipboardItem> => {
    const controller = new AbortController();
    abortControllerRef.current = controller;
    activeItemIdRef.current = null;

    setState({
      isUploading: true,
      progress: 0,
      error: null,
      currentFile: file,
    });

    try {
      // Step 1: Initialize the multipart upload
      const initResponse = await initMultipartUpload({
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type || 'application/octet-stream',
      });

      const { itemId, partSize, totalParts } = initResponse;
      activeItemIdRef.current = itemId;

      if (controller.signal.aborted) {
        throw new DOMException('Upload aborted', 'AbortError');
      }

      // Track per-part progress for accurate overall progress
      const partProgress = new Float64Array(totalParts); // 0.0 – 1.0 per part
      const completedParts: { partNumber: number; eTag: string }[] = [];

      const updateOverallProgress = () => {
        let total = 0;
        for (let i = 0; i < totalParts; i++) {
          total += partProgress[i];
        }
        const pct = Math.round((total / totalParts) * 100);
        setState((prev) => ({ ...prev, progress: pct }));
      };

      // Step 2: Upload parts concurrently (CONCURRENCY at a time)
      const partNumbers = Array.from({ length: totalParts }, (_, i) => i + 1);
      let cursor = 0;

      const uploadNextPart = async (): Promise<void> => {
        while (cursor < partNumbers.length) {
          if (controller.signal.aborted) {
            throw new DOMException('Upload aborted', 'AbortError');
          }

          const partNumber = partNumbers[cursor++];
          const start = (partNumber - 1) * partSize;
          const end = Math.min(start + partSize, file.size);
          const chunk = file.slice(start, end);

          // Get presigned URL for this part
          const { url } = await getPartUploadUrl(itemId, partNumber);

          if (controller.signal.aborted) {
            throw new DOMException('Upload aborted', 'AbortError');
          }

          // Upload chunk to S3 with retry
          const eTag = await uploadPartToS3WithRetry(
            url,
            chunk,
            controller.signal,
            (loaded, total) => {
              partProgress[partNumber - 1] = loaded / total;
              updateOverallProgress();
            },
          );

          // Record part completion with the API
          await recordUploadPart(itemId, {
            partNumber,
            eTag,
            size: chunk.size,
          });

          completedParts.push({ partNumber, eTag });

          // Mark this part as fully complete
          partProgress[partNumber - 1] = 1;
          updateOverallProgress();
        }
      };

      // Launch CONCURRENCY workers
      const workers = Array.from(
        { length: Math.min(CONCURRENCY, totalParts) },
        () => uploadNextPart(),
      );
      await Promise.all(workers);

      // Sort parts by partNumber (S3 requires ordered parts list)
      completedParts.sort((a, b) => a.partNumber - b.partNumber);

      // Step 3: Complete the upload
      const item = await completeMultipartUpload(itemId, completedParts);

      setState({
        isUploading: false,
        progress: 100,
        error: null,
        currentFile: null,
      });

      activeItemIdRef.current = null;
      return item;
    } catch (err) {
      const isAbort =
        err instanceof DOMException && err.name === 'AbortError';

      // Notify API to abort the multipart upload if we have an itemId
      if (activeItemIdRef.current) {
        abortMultipartUpload(activeItemIdRef.current).catch(() => {
          // Best-effort: ignore errors on abort cleanup
        });
        activeItemIdRef.current = null;
      }

      const error = isAbort
        ? new Error('Upload cancelled')
        : err instanceof Error
          ? err
          : new Error('Upload failed');

      setState({
        isUploading: false,
        progress: 0,
        error,
        currentFile: null,
      });

      throw error;
    }
  }, []);

  return {
    ...state,
    startUpload,
    abort,
    isLargeFile,
  };
}
