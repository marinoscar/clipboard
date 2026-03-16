import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useSocket } from './useSocket';

// Mock socket instance — recreated per test via the factory below
const mockSocket = {
  on: vi.fn(),
  off: vi.fn(),
  connected: false,
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

    expect(mockSocket.on).toHaveBeenCalledTimes(1);
    expect(mockSocket.on).toHaveBeenCalledWith('clipboard:new', expect.any(Function));
  });

  it('should unsubscribe on unmount', () => {
    const handler = vi.fn();

    const { unmount } = renderHook(() => useSocket('clipboard:new', handler));

    // Capture the wrappedHandler that was registered
    const registeredHandler = mockSocket.on.mock.calls[0][1];

    unmount();

    expect(mockSocket.off).toHaveBeenCalledWith('clipboard:new', registeredHandler);
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

    expect(mockSocket.on).toHaveBeenCalledWith('clipboard:new', expect.any(Function));
    expect(mockSocket.on).toHaveBeenCalledTimes(1);

    // Capture the first wrappedHandler
    const firstHandler = mockSocket.on.mock.calls[0][1];

    rerender({ event: 'clipboard:delete' });

    // Old listener removed with the same wrapped handler, new one registered
    expect(mockSocket.off).toHaveBeenCalledWith('clipboard:new', firstHandler);
    expect(mockSocket.on).toHaveBeenCalledWith('clipboard:delete', expect.any(Function));
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

    expect(mockSocket.on).toHaveBeenCalledWith('clipboard:new', expect.any(Function));

    // Capture the first wrappedHandler
    const firstWrapped = mockSocket.on.mock.calls[0][1];

    rerender({ handler: handler2 });

    expect(mockSocket.off).toHaveBeenCalledWith('clipboard:new', firstWrapped);
    expect(mockSocket.on).toHaveBeenCalledWith('clipboard:new', expect.any(Function));
  });

  it('should forward received data to the original handler', () => {
    const handler = vi.fn();

    renderHook(() => useSocket('clipboard:new', handler));

    // Get the wrappedHandler and invoke it
    const wrappedHandler = mockSocket.on.mock.calls[0][1];
    const testData = { id: '123', content: 'test' };
    wrappedHandler(testData);

    expect(handler).toHaveBeenCalledWith(testData);
  });
});
