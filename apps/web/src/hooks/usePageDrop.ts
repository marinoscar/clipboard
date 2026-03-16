import { useState, useEffect, useRef } from 'react';

interface UsePageDropOptions {
  onFilesDropped: (files: File[]) => void;
  enabled?: boolean;
}

export function usePageDrop({ onFilesDropped, enabled = true }: UsePageDropOptions) {
  const [isDragOver, setIsDragOver] = useState(false);
  const counterRef = useRef(0);
  const callbackRef = useRef(onFilesDropped);
  callbackRef.current = onFilesDropped;

  useEffect(() => {
    if (!enabled) return;

    const handleDragEnter = (e: DragEvent) => {
      e.preventDefault();
      counterRef.current++;
      if (counterRef.current === 1) {
        setIsDragOver(true);
      }
    };

    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
    };

    const handleDragLeave = (e: DragEvent) => {
      e.preventDefault();
      counterRef.current--;
      if (counterRef.current === 0) {
        setIsDragOver(false);
      }
    };

    const handleDrop = (e: DragEvent) => {
      e.preventDefault();
      counterRef.current = 0;
      setIsDragOver(false);
      const files = Array.from(e.dataTransfer?.files || []);
      if (files.length > 0) {
        callbackRef.current(files);
      }
    };

    document.addEventListener('dragenter', handleDragEnter);
    document.addEventListener('dragover', handleDragOver);
    document.addEventListener('dragleave', handleDragLeave);
    document.addEventListener('drop', handleDrop);

    return () => {
      document.removeEventListener('dragenter', handleDragEnter);
      document.removeEventListener('dragover', handleDragOver);
      document.removeEventListener('dragleave', handleDragLeave);
      document.removeEventListener('drop', handleDrop);
      counterRef.current = 0;
    };
  }, [enabled]);

  return { isDragOver };
}
