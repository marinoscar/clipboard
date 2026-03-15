import { useEffect } from 'react';
import { useSocketContext } from '../contexts/SocketContext';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function useSocket(event: string, handler: (data: any) => void) {
  const socket = useSocketContext();

  useEffect(() => {
    if (!socket) return;
    socket.on(event, handler);
    return () => {
      socket.off(event, handler);
    };
  }, [socket, event, handler]);
}
