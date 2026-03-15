import { useEffect, useCallback } from 'react';
import { createTextItem, uploadFile } from '../services/api';
import { ClipboardItem } from '../types';

export function useClipboardPaste(onItemCreated: (item: ClipboardItem) => void) {
  const handlePaste = useCallback(
    async (e: ClipboardEvent) => {
      // Don't intercept paste in input/textarea elements
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }

      const items = e.clipboardData?.items;
      if (!items) return;

      // Check for files/images first
      for (const item of Array.from(items)) {
        if (item.kind === 'file') {
          e.preventDefault();
          const file = item.getAsFile();
          if (file) {
            const result = await uploadFile(file);
            onItemCreated(result);
          }
          return;
        }
      }

      // Then check for text
      const text = e.clipboardData?.getData('text/plain');
      if (text) {
        e.preventDefault();
        const result = await createTextItem(text);
        onItemCreated(result);
      }
    },
    [onItemCreated],
  );

  useEffect(() => {
    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [handlePaste]);
}
