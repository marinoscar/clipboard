import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useWebShare } from './useWebShare';

describe('useWebShare', () => {
  // Capture the original descriptor so we can restore it after each test.
  const originalDescriptor = Object.getOwnPropertyDescriptor(navigator, 'share');

  afterEach(() => {
    if (originalDescriptor) {
      Object.defineProperty(navigator, 'share', originalDescriptor);
    } else {
      // If share was not on navigator originally, delete the property.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (navigator as any).share;
    }
  });

  describe('isSupported', () => {
    it('returns true when navigator.share exists', () => {
      Object.defineProperty(navigator, 'share', {
        configurable: true,
        writable: true,
        value: vi.fn(),
      });

      const { result } = renderHook(() => useWebShare());

      expect(result.current.isSupported).toBe(true);
    });

    it('returns false when navigator.share is undefined', () => {
      Object.defineProperty(navigator, 'share', {
        configurable: true,
        writable: true,
        value: undefined,
      });

      const { result } = renderHook(() => useWebShare());

      expect(result.current.isSupported).toBe(false);
    });
  });

  describe('share()', () => {
    it('calls navigator.share with the provided data', async () => {
      const mockShare = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, 'share', {
        configurable: true,
        writable: true,
        value: mockShare,
      });

      const { result } = renderHook(() => useWebShare());

      const shareData = { title: 'Test', text: 'Hello', url: 'https://example.com' };

      await act(async () => {
        await result.current.share(shareData);
      });

      expect(mockShare).toHaveBeenCalledOnce();
      expect(mockShare).toHaveBeenCalledWith(shareData);
    });

    it('passes file data to navigator.share', async () => {
      const mockShare = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, 'share', {
        configurable: true,
        writable: true,
        value: mockShare,
      });

      const { result } = renderHook(() => useWebShare());

      const file = new File(['content'], 'test.txt', { type: 'text/plain' });
      const shareData = { title: 'File', files: [file] };

      await act(async () => {
        await result.current.share(shareData);
      });

      expect(mockShare).toHaveBeenCalledWith(shareData);
    });

    it('throws when Web Share API is not supported', async () => {
      Object.defineProperty(navigator, 'share', {
        configurable: true,
        writable: true,
        value: undefined,
      });

      const { result } = renderHook(() => useWebShare());

      await expect(
        act(async () => {
          await result.current.share({ title: 'Test', url: 'https://example.com' });
        }),
      ).rejects.toThrow('Web Share API not supported');
    });

    it('propagates errors thrown by navigator.share', async () => {
      const mockShare = vi.fn().mockRejectedValue(new Error('User cancelled'));
      Object.defineProperty(navigator, 'share', {
        configurable: true,
        writable: true,
        value: mockShare,
      });

      const { result } = renderHook(() => useWebShare());

      await expect(
        act(async () => {
          await result.current.share({ url: 'https://example.com' });
        }),
      ).rejects.toThrow('User cancelled');
    });
  });
});
