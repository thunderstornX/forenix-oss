"use client";

/**
 * useLiveEvents — React hook for the SSE bus at /api/events.
 *
 *   useLiveEvents(["monitor.run.completed", "audit.append"], (envelope) => {
 *     qc.invalidateQueries({ queryKey: ["monitors"] });
 *   });
 *
 * Behaviour:
 *   - Opens an EventSource on mount, closes on unmount.
 *   - Reconnects on error with exponential backoff (capped at 30s).
 *   - Filters server-side by topic — the URL carries ?topics=...
 *   - Exposes `connected` so views can render a "● LIVE" pulse.
 *
 * The hook intentionally does not touch TanStack Query directly —
 * callers decide what to invalidate. That keeps the wiring explicit
 * per view and avoids a god-object query map.
 */

import { useEffect, useRef, useState } from "react";

import type { EventEnvelope, EventTopic } from "@/lib/events/types";

interface UseLiveEventsResult {
  /** True when the EventSource has confirmed the initial "hello". */
  connected: boolean;
}

export function useLiveEvents(
  topics: EventTopic[] | undefined,
  onEvent: (envelope: EventEnvelope) => void,
): UseLiveEventsResult {
  const [connected, setConnected] = useState(false);

  // Keep the latest callback in a ref so reconnects don't have to
  // tear down the EventSource just because the parent re-rendered.
  const handlerRef = useRef(onEvent);
  useEffect(() => { handlerRef.current = onEvent; }, [onEvent]);

  // Stable key for the topic set so the effect only re-runs on a
  // real change, not on every parent render.
  const topicKey = topics ? [...topics].sort().join(",") : "*";

  useEffect(() => {
    let es: EventSource | null = null;
    let retryMs = 1_000;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;

    const url = topicKey === "*" ? "/api/events" : `/api/events?topics=${encodeURIComponent(topicKey)}`;

    function open() {
      if (cancelled) return;
      es = new EventSource(url, { withCredentials: true });

      es.addEventListener("hello", () => {
        setConnected(true);
        retryMs = 1_000;  // reset backoff once the stream is healthy
      });

      es.onerror = () => {
        setConnected(false);
        try { es?.close(); } catch { /* noop */ }
        es = null;
        if (!cancelled) {
          retryTimer = setTimeout(open, retryMs);
          retryMs = Math.min(retryMs * 2, 30_000);
        }
      };

      // Wire every known topic. EventSource dispatches by event name.
      const wire = (t: string) => {
        es?.addEventListener(t, (e) => {
          try {
            const data = (e as unknown as { data: string }).data;
            const env = JSON.parse(data) as EventEnvelope;
            handlerRef.current(env);
          } catch {
            // Malformed payload — ignore, don't crash the stream.
          }
        });
      };
      const all: EventTopic[] = [
        "monitor.run.started",
        "monitor.run.completed",
        "attestation.run.started",
        "attestation.run.completed",
        "audit.append",
      ];
      for (const t of all) wire(t);
    }

    open();

    return () => {
      cancelled = true;
      setConnected(false);
      if (retryTimer) clearTimeout(retryTimer);
      try { es?.close(); } catch { /* noop */ }
    };
  }, [topicKey]);

  return { connected };
}
