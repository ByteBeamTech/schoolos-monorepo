"use client";
import { useEffect, useRef } from "react";
import { io, Socket } from "socket.io-client";

// Realtime WebSocket connection -- added when activating the previously-
// dormant backend/src/core/realtime/realtime.gateway.ts (see backend
// commit: it was fully built, JWT-verified after a security fix, but
// registered nowhere and called by nothing until now).
//
// One shared connection per browser tab -- components subscribe to
// specific event names via useSocketEvent() below rather than each
// opening their own socket. The connection is intentionally NOT a hard
// dependency for any page: every caller of useSocketEvent should still
// have its own poll (at a longer interval now that this exists) as a
// fallback, since a dropped/failed socket degrades silently here rather
// than throwing -- pages just fall back to their poll cadence.
//
// NOTE: derives the socket server's base URL by stripping the trailing
// /api/v1 off NEXT_PUBLIC_API_URL, since Socket.IO connects to the
// server's root, not through the REST API's path prefix. This assumes
// the deployed reverse proxy (nginx or similar) routes /socket.io/ to
// the same backend service as /api/v1 -- worth confirming against the
// actual production config the first time this is tested for real,
// since a misroute here fails silently (falls back to polling) rather
// than throwing an error anyone would notice.
const API_BASE = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1").replace(/\/api\/v1\/?$/, "");

let sharedSocket: Socket | null = null;

function getSocket(): Socket | null {
  if (typeof window === "undefined") return null;
  const token = localStorage.getItem("sa_token");
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
 * component. Safe to call even if the socket never connects (backend
 * down, misrouted proxy, etc.) -- the handler just never fires, and
 * whatever poll interval the page already has keeps working as before.
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
