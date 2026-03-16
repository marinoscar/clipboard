import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePageDrop } from './usePageDrop';

// Helper: build a DragEvent-like CustomEvent with an optional dataTransfer payload.
function makeDragEvent(type: string, files: File[] = []): Event {
  const event = new Event(type, { bubbles: true, cancelable: true });
  // Attach a minimal dataTransfer so the hook can read `.files`.
  Object.defineProperty(event, 'dataTransfer', {
    value: { files },
    writable: false,
  });
  // Stub preventDefault so it does not throw in jsdom.
  event.preventDefault = vi.fn();
  return event;
}

describe('usePageDrop', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('isDragOver starts as false', () => {
    const { result } = renderHook(() =>
      usePageDrop({ onFilesDropped: vi.fn() }),
    );

    expect(result.current.isDragOver).toBe(false);
  });

  it('isDragOver becomes true on dragenter event', () => {
    const { result } = renderHook(() =>
      usePageDrop({ onFilesDropped: vi.fn() }),
    );

    act(() => {
      document.dispatchEvent(makeDragEvent('dragenter'));
    });

    expect(result.current.isDragOver).toBe(true);
  });

  it('isDragOver becomes false on dragleave when counter reaches zero', () => {
    const { result } = renderHook(() =>
      usePageDrop({ onFilesDropped: vi.fn() }),
    );

    // Enter then leave once — counter goes 1 → 0.
    act(() => {
      document.dispatchEvent(makeDragEvent('dragenter'));
    });

    expect(result.current.isDragOver).toBe(true);

    act(() => {
      document.dispatchEvent(makeDragEvent('dragleave'));
    });

    expect(result.current.isDragOver).toBe(false);
  });

  it('isDragOver stays true while nested dragenter/dragleave pairs are outstanding', () => {
    const { result } = renderHook(() =>
      usePageDrop({ onFilesDropped: vi.fn() }),
    );

    // Simulate entering two nested elements (counter = 2) then leaving one (counter = 1).
    act(() => {
      document.dispatchEvent(makeDragEvent('dragenter'));
      document.dispatchEvent(makeDragEvent('dragenter'));
    });

    act(() => {
      document.dispatchEvent(makeDragEvent('dragleave'));
    });

    // Counter is still 1, so isDragOver must remain true.
    expect(result.current.isDragOver).toBe(true);
  });

  it('onFilesDropped is called with the dropped files on a drop event', () => {
    const onFilesDropped = vi.fn();
    renderHook(() => usePageDrop({ onFilesDropped }));

    const file1 = new File(['a'], 'a.txt', { type: 'text/plain' });
    const file2 = new File(['b'], 'b.png', { type: 'image/png' });

    act(() => {
      document.dispatchEvent(makeDragEvent('drop', [file1, file2]));
    });

    expect(onFilesDropped).toHaveBeenCalledOnce();
    expect(onFilesDropped).toHaveBeenCalledWith([file1, file2]);
  });

  it('isDragOver resets to false on drop', () => {
    const { result } = renderHook(() =>
      usePageDrop({ onFilesDropped: vi.fn() }),
    );

    act(() => {
      document.dispatchEvent(makeDragEvent('dragenter'));
    });

    expect(result.current.isDragOver).toBe(true);

    act(() => {
      document.dispatchEvent(makeDragEvent('drop'));
    });

    expect(result.current.isDragOver).toBe(false);
  });

  it('does not call onFilesDropped when the drop carries no files', () => {
    const onFilesDropped = vi.fn();
    renderHook(() => usePageDrop({ onFilesDropped }));

    act(() => {
      document.dispatchEvent(makeDragEvent('drop', []));
    });

    expect(onFilesDropped).not.toHaveBeenCalled();
  });

  it('does not react to drag events when enabled is false', () => {
    const onFilesDropped = vi.fn();
    const { result } = renderHook(() =>
      usePageDrop({ onFilesDropped, enabled: false }),
    );

    act(() => {
      document.dispatchEvent(makeDragEvent('dragenter'));
      document.dispatchEvent(makeDragEvent('drop', [new File(['x'], 'x.txt')]));
    });

    expect(result.current.isDragOver).toBe(false);
    expect(onFilesDropped).not.toHaveBeenCalled();
  });

  it('cleans up document listeners on unmount', () => {
    const removeEventListenerSpy = vi.spyOn(document, 'removeEventListener');

    const { unmount } = renderHook(() =>
      usePageDrop({ onFilesDropped: vi.fn() }),
    );

    unmount();

    const removedEventTypes = removeEventListenerSpy.mock.calls.map(
      ([type]) => type,
    );
    expect(removedEventTypes).toContain('dragenter');
    expect(removedEventTypes).toContain('dragover');
    expect(removedEventTypes).toContain('dragleave');
    expect(removedEventTypes).toContain('drop');

    removeEventListenerSpy.mockRestore();
  });

  it('does not change isDragOver after unmount when a drag event fires', () => {
    const { result, unmount } = renderHook(() =>
      usePageDrop({ onFilesDropped: vi.fn() }),
    );

    unmount();

    // After unmount the listener is removed; firing dragenter must not update state.
    act(() => {
      document.dispatchEvent(makeDragEvent('dragenter'));
    });

    // State was never updated because the listener was cleaned up.
    expect(result.current.isDragOver).toBe(false);
  });
});
