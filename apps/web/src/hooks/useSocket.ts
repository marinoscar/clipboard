import { useEffect } from 'react';
import { useSocketContext } from '../contexts/SocketContext';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function useSocket(event: string, handler: (data: any) => void) {
  const socket = useSocketContext();

  useEffect(() => {
    if (!socket) {
      console.log(`[useSocket] No socket available for event "${event}"`);
      return;
    }
    console.log(`[useSocket] Subscribing to "${event}", socket connected:`, socket.connected);
    const wrappedHandler = (data: unknown) => {
      console.log(`[useSocket] Received "${event}":`, data);
      handler(data as Parameters<typeof handler>[0]);
    };
    socket.on(event, wrappedHandler);
    return () => {
      console.log(`[useSocket] Unsubscribing from "${event}"`);
      socket.off(event, wrappedHandler);
    };
  }, [socket, event, handler]);
}
