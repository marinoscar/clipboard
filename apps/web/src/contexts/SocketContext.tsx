import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './AuthContext';
import { api } from '../services/api';

const SocketContext = createContext<Socket | null>(null);

interface SocketProviderProps {
  children: ReactNode;
}

export function SocketProvider({ children }: SocketProviderProps) {
  const { user } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    if (!user) {
      // Clean up when user logs out
      setSocket((prev) => {
        if (prev) {
          prev.disconnect();
        }
        return null;
      });
      return;
    }

    const token = api.getAccessToken();
    if (!token) return;

    console.log('[Socket] Connecting to /clipboard namespace...');
    const s = io('/clipboard', {
      auth: { token },
      transports: ['websocket'],
    });

    s.on('connect', () => {
      console.log('[Socket] Connected, id:', s.id);
    });

    s.on('disconnect', (reason) => {
      console.log('[Socket] Disconnected, reason:', reason);
    });

    s.on('connect_error', (err) => {
      console.error('[Socket] Connection error:', err.message);
    });

    setSocket(s);

    return () => {
      console.log('[Socket] Cleaning up connection');
      s.disconnect();
    };
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <SocketContext.Provider value={socket}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocketContext(): Socket | null {
  return useContext(SocketContext);
}
