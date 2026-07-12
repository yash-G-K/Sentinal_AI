/**
 * hooks/useWebSocket.ts
 * Reconnecting WebSocket hook with exponential backoff and ping/heartbeat.
 * Connects DIRECTLY to the backend (ws://localhost:8000) in development,
 * bypassing the Vite proxy to avoid proxy-level ECONNREFUSED/ECONNABORTED noise.
 */
import { useEffect, useRef, useCallback, useState } from "react";

export type WSMessageType =
  | "kpi_update" | "threat" | "request"
  | "heartbeat" | "pong" | "connected" | "system";

export interface WSMessage {
  type: WSMessageType;
  data?: Record<string, unknown>;
  message?: string;
  level?: string;
  ts?: string;
}

export interface WSStatus {
  connected: boolean;
  reconnecting: boolean;
  lastPing?: string;
}

type MessageHandler = (msg: WSMessage) => void;

const RECONNECT_BASE_MS   = 2_000;
const RECONNECT_MAX_MS    = 60_000;
const PING_INTERVAL_MS    = 25_000;

/**
 * Resolve the WebSocket URL.
 * - In dev (Vite, port 5173): connect directly to ws://localhost:8000
 * - In prod: use same host/protocol as the page
 */
function resolveWsUrl(path: string): string {
  if (import.meta.env.DEV) {
    return `ws://localhost:8000${path}`;
  }
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${window.location.host}${path}`;
}

export function useWebSocket(path: string, onMessage: MessageHandler): WSStatus {
  const wsRef      = useRef<WebSocket | null>(null);
  const retryRef   = useRef(0);
  const pingRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const unmounting = useRef(false);

  const [status, setStatus] = useState<WSStatus>({ connected: false, reconnecting: false });

  const scheduleReconnect = useCallback((delayMs: number) => {
    if (unmounting.current) return;
    const jitter = Math.random() * 500;
    retryRef.current += 1;
    setTimeout(connect, Math.min(delayMs + jitter, RECONNECT_MAX_MS));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const connect = useCallback(() => {
    if (unmounting.current) return;

    const url = resolveWsUrl(path);

    let ws: WebSocket;
    try {
      ws = new WebSocket(url);
    } catch {
      scheduleReconnect(RECONNECT_BASE_MS * Math.pow(1.5, retryRef.current));
      return;
    }

    wsRef.current = ws;
    if (retryRef.current > 0) {
      setStatus(s => ({ ...s, reconnecting: true }));
    }

    ws.onopen = () => {
      retryRef.current = 0;
      setStatus({ connected: true, reconnecting: false });

      if (pingRef.current) clearInterval(pingRef.current);
      pingRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: "ping" }));
        }
      }, PING_INTERVAL_MS);
    };

    ws.onmessage = (ev) => {
      try {
        const msg: WSMessage = JSON.parse(ev.data);
        if (msg.type === "pong" || msg.type === "heartbeat") {
          setStatus(s => ({ ...s, lastPing: new Date().toLocaleTimeString() }));
          return;
        }
        onMessage(msg);
      } catch { /* ignore malformed */ }
    };

    ws.onclose = (evt) => {
      if (pingRef.current) clearInterval(pingRef.current);
      setStatus(s => ({ ...s, connected: false, reconnecting: !unmounting.current }));

      if (!unmounting.current) {
        // Longer back-off for abnormal closes (server rejected / unreachable)
        const base = evt.code === 1006
          ? RECONNECT_BASE_MS * Math.pow(1.5, retryRef.current)
          : RECONNECT_BASE_MS * Math.pow(2, retryRef.current);
        scheduleReconnect(base);
      }
    };

    ws.onerror = () => ws.close(); // onerror always precedes onclose
  }, [path, onMessage, scheduleReconnect]);

  useEffect(() => {
    unmounting.current = false;
    connect();
    return () => {
      unmounting.current = true;
      if (pingRef.current) clearInterval(pingRef.current);
      wsRef.current?.close();
    };
  }, [connect]);

  return status;
}
