/**
 * GET /api/events?topics=monitor.run.completed,audit.append
 *
 * Server-Sent Events stream for live dashboard updates. The client
 * opens an EventSource against this endpoint and receives JSON
 * envelopes as they're emitted on the in-process bus.
 *
 * Auth: standard session-gated route (middleware enforces this for
 * everything under /api/* that isn't on the public list).
 *
 * Topics: comma-separated list. Omit ?topics= for "all events".
 *
 * Wire format (SSE spec):
 *   event: monitor.run.completed
 *   data:  {"topic":"monitor.run.completed","payload":{...},"at":"2026-..."}
 *
 * Keep-alive: a comment line every 25s prevents proxies / load
 * balancers from killing an idle connection. Browsers ignore
 * comments.
 *
 * Cleanup: the AbortSignal from the request fires when the client
 * navigates away, closes the tab, or its EventSource reconnects. We
 * unsubscribe from the bus + close the stream in response.
 */
import "server-only";

import { subscribe } from "@/lib/events/emitter";
import type { EventTopic } from "@/lib/events/types";
import { requireSession } from "@/lib/rbac";

export const dynamic = "force-dynamic";  // never cache an open stream
export const runtime = "nodejs";          // EventEmitter needs Node, not Edge

const KEEPALIVE_MS = 25_000;

const VALID_TOPICS: ReadonlySet<EventTopic> = new Set<EventTopic>([
  "monitor.run.started",
  "monitor.run.completed",
  "attestation.run.started",
  "attestation.run.completed",
  "audit.append",
]);

function parseTopics(raw: string | null): EventTopic[] | undefined {
  if (!raw) return undefined;
  const out: EventTopic[] = [];
  for (const t of raw.split(",").map((s) => s.trim()).filter(Boolean)) {
    if (VALID_TOPICS.has(t as EventTopic)) out.push(t as EventTopic);
  }
  return out.length > 0 ? out : undefined;
}

export async function GET(req: Request) {
  try {
    await requireSession();
  } catch {
    return new Response("Unauthorized", { status: 401 });
  }

  const url = new URL(req.url);
  const topics = parseTopics(url.searchParams.get("topics"));

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();

      const send = (chunk: string) => {
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          // Stream already closed (client disconnected). Swallow.
        }
      };

      // Initial hello — client uses this to confirm the stream opened.
      send(`event: hello\ndata: {"ok":true}\n\n`);

      const unsubscribe = subscribe(topics, (envelope) => {
        send(`event: ${envelope.topic}\ndata: ${JSON.stringify(envelope)}\n\n`);
      });

      const keepalive = setInterval(() => {
        send(`:keepalive ${Date.now()}\n\n`);
      }, KEEPALIVE_MS);

      // Cleanup when the client disconnects.
      req.signal.addEventListener("abort", () => {
        clearInterval(keepalive);
        unsubscribe();
        try {
          controller.close();
        } catch {
          // already closed
        }
      });
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",  // disable nginx buffering
    },
  });
}
