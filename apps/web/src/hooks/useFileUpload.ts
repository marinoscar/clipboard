import { useState, useCallback } from 'react';
import { uploadFile } from '../services/api';
import { ClipboardItem } from '../types';

export function useFileUpload() {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const upload = useCallback(async (file: File): Promise<ClipboardItem | null> => {
    setIsUploading(true);
    setError(null);
    try {
      const result = await uploadFile(file);
      return result;
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Upload failed'));
      return null;
    } finally {
      setIsUploading(false);
    }
  }, []);

  return { upload, isUploading, error };
}
