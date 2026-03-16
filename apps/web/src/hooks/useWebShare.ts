import { useCallback } from 'react';

interface ShareData {
  title?: string;
  text?: string;
  url?: string;
  files?: File[];
}

export function useWebShare() {
  const isSupported = typeof navigator !== 'undefined' && !!navigator.share;

  const share = useCallback(async (data: ShareData) => {
    if (!navigator.share) {
      throw new Error('Web Share API not supported');
    }
    await navigator.share(data);
  }, []);

  return { isSupported, share };
}
