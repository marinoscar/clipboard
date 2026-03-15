import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useSocket } from './useSocket';

// Mock socket instance — recreated per test via the factory below
const mockSocket = {
  on: vi.fn(),
  off: vi.fn(),
};

vi.mock('../contexts/SocketContext', () => ({
  useSocketContext: vi.fn(() => mockSocket),
}));

import { useSocketContext } from '../contexts/SocketContext';

const mockedUseSocketContext = vi.mocked(useSocketContext);

describe('useSocket', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: return a live mock socket
    mockedUseSocketContext.mockReturnValue(mockSocket as any);
  });

  it('should subscribe to event when socket is available', () => {
    const handler = vi.fn();

    renderHook(() => useSocket('clipboard:new', handler));

    expect(mockSocket.on).toHaveBeenCalledWith('clipboard:new', handler);
  });

  it('should unsubscribe on unmount', () => {
    const handler = vi.fn();

    const { unmount } = renderHook(() => useSocket('clipboard:new', handler));

    unmount();

    expect(mockSocket.off).toHaveBeenCalledWith('clipboard:new', handler);
  });

  it('should not subscribe when socket is null', () => {
    mockedUseSocketContext.mockReturnValue(null);

    const handler = vi.fn();

    renderHook(() => useSocket('clipboard:new', handler));

    expect(mockSocket.on).not.toHaveBeenCalled();
  });

  it('should re-subscribe when event changes', () => {
    const handler = vi.fn();

    const { rerender } = renderHook(
      ({ event }: { event: string }) => useSocket(event, handler),
      { initialProps: { event: 'clipboard:new' } },
    );

    expect(mockSocket.on).toHaveBeenCalledWith('clipboard:new', handler);
    expect(mockSocket.on).toHaveBeenCalledTimes(1);

    rerender({ event: 'clipboard:delete' });

    // Old listener removed, new one registered
    expect(mockSocket.off).toHaveBeenCalledWith('clipboard:new', handler);
    expect(mockSocket.on).toHaveBeenCalledWith('clipboard:delete', handler);
    expect(mockSocket.on).toHaveBeenCalledTimes(2);
  });

  it('should re-subscribe when handler changes', () => {
    const handler1 = vi.fn();
    const handler2 = vi.fn();

    const { rerender } = renderHook(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ({ handler }: { handler: (data: any) => void }) => useSocket('clipboard:new', handler),
      { initialProps: { handler: handler1 } },
    );

    expect(mockSocket.on).toHaveBeenCalledWith('clipboard:new', handler1);

    rerender({ handler: handler2 });

    expect(mockSocket.off).toHaveBeenCalledWith('clipboard:new', handler1);
    expect(mockSocket.on).toHaveBeenCalledWith('clipboard:new', handler2);
  });
});
