"use client";
import { useEffect, useRef } from "react";
import { io, Socket } from "socket.io-client";

// Realtime WebSocket connection for the school-facing app -- completes
// the school-side half of the realtime activation started on the
// superadmin app (see backend core/realtime/realtime.gateway.ts and its
// activation commit). Same pattern as superadmin/src/lib/use-socket.ts,
// deliberately kept as a separate copy rather than a shared package: the
// two apps use different token storage keys (this app: 'accessToken',
// superadmin: 'sa_token') and are otherwise independent Next.js apps in
// this monorepo, consistent with how lib/api.ts and lib/hooks.ts are
// already separately maintained per app rather than shared.
//
// One shared connection per browser tab. Not a hard dependency for any
// page -- every caller should still keep its own poll as a fallback,
// since a dropped/failed socket degrades silently here (pages just fall
// back to their existing poll cadence) rather than throwing.
const API_BASE = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1").replace(/\/api\/v1\/?$/, "");

let sharedSocket: Socket | null = null;

function getSocket(): Socket | null {
  if (typeof window === "undefined") return null;
  const token = localStorage.getItem("accessToken");
  if (!token) return null;

  if (!sharedSocket || sharedSocket.disconnected) {
    sharedSocket = io(`${API_BASE}/realtime`, {
      auth: { token },
      reconnection: true,
      reconnectionDelay: 2000,
    });
  }
  return sharedSocket;
}

/**
 * Subscribe to a realtime event for the lifetime of the calling
 * component. Safe to call even if the socket never connects.
 */
export function useSocketEvent<T = any>(event: string, handler: (payload: T) => void) {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const wrapped = (payload: T) => handlerRef.current(payload);
    socket.on(event, wrapped);
    return () => { socket.off(event, wrapped); };
  }, [event]);
}
