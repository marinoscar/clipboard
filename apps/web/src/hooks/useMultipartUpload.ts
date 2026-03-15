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

      // Check for abort between init and part uploads
      if (controller.signal.aborted) {
        throw new DOMException('Upload aborted', 'AbortError');
      }

      const completedParts: { partNumber: number; eTag: string }[] = [];

      // Step 2: Upload each part sequentially
      for (let partNumber = 1; partNumber <= totalParts; partNumber++) {
        if (controller.signal.aborted) {
          throw new DOMException('Upload aborted', 'AbortError');
        }

        const start = (partNumber - 1) * partSize;
        const end = Math.min(start + partSize, file.size);
        const chunk = file.slice(start, end);

        // Get presigned URL for this part
        const { url } = await getPartUploadUrl(itemId, partNumber);

        if (controller.signal.aborted) {
          throw new DOMException('Upload aborted', 'AbortError');
        }

        // Upload chunk to S3 via XHR (supports upload progress)
        const eTag = await uploadPartToS3(
          url,
          chunk,
          controller.signal,
          (loaded, total) => {
            const partProgress = loaded / total;
            const overallProgress =
              ((partNumber - 1 + partProgress) / totalParts) * 100;
            setState((prev) => ({ ...prev, progress: Math.round(overallProgress) }));
          },
        );

        // Record part completion with the API
        await recordUploadPart(itemId, {
          partNumber,
          eTag,
          size: chunk.size,
        });

        completedParts.push({ partNumber, eTag });

        // Update progress to exact part boundary
        setState((prev) => ({
          ...prev,
          progress: Math.round((partNumber / totalParts) * 100),
        }));
      }

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
