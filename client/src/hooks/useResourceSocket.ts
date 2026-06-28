import { useEffect, useRef } from 'react';

import { getToken } from '../api/client';
import type { Resource } from '../types';

export type ResourceChange =
  | { type: 'resource.updated'; resource: Resource }
  | { type: 'resource.removed'; resourceId: string };

/**
 * Subscribes to the resource WebSocket and invokes `onChange` for each pushed
 * change. Reconnects automatically after a drop. The server authenticates the
 * token and filters updates per membership tier (crew see all; passengers only
 * receive resources their tier can access).
 */
export function useResourceSocket(onChange: (change: ResourceChange) => void) {
  // Keep the latest handler without re-opening the socket on every render.
  const handler = useRef(onChange);
  handler.current = onChange;

  useEffect(() => {
    let socket: WebSocket | null = null;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let disposed = false;

    const connect = () => {
      const token = getToken();
      if (!token) return;
      const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
      socket = new WebSocket(
        `${proto}://${window.location.host}/ws/resources?token=${encodeURIComponent(token)}`,
      );

      socket.onopen = () => {
        // If we were torn down mid-handshake, it's now safe to close.
        if (disposed) socket?.close();
      };
      socket.onmessage = (event) => {
        try {
          handler.current(JSON.parse(event.data) as ResourceChange);
        } catch {
          /* ignore malformed frames */
        }
      };
      socket.onclose = () => {
        if (!disposed) retry = setTimeout(connect, 3000); // backoff + reconnect
      };
    };

    connect();
    return () => {
      disposed = true;
      if (retry) clearTimeout(retry);
      // Closing a socket that is still CONNECTING aborts the handshake and logs
      // "WebSocket is closed before the connection is established." Only close an
      // open socket here; the onopen handler closes one that's still connecting.
      if (socket && socket.readyState === WebSocket.OPEN) socket.close();
    };
  }, []);
}
