/**
 * Single-process event bus for live dashboard updates.
 *
 * Scope: this is a Node EventEmitter living on globalThis so HMR
 * reloads don't fragment subscribers in dev. It only works within
 * a single Node process — multi-worker / multi-instance deployments
 * will need a Postgres LISTEN/NOTIFY or Redis pubsub adapter later
 * (the public surface — emit() / subscribe() — won't change).
 *
 * On Vercel (serverless), each Function instance has its own bus.
 * SSE on Vercel holds the connecting Function open for the duration
 * of the stream; events emitted in that same Function instance will
 * reach the connected client. Events emitted in a different
 * Function instance won't reach this SSE connection. For the
 * dashboard use case (the user is also the one triggering most
 * actions) this is acceptable; the SaaS lane will need pubsub.
 *
 * NOTE: deliberately no `import "server-only"` so bun:test can load
 * the file. Every importer in production code (audit, schedulers, the
 * /api/events route) is already server-only on its own. The React
 * hook touches only ./types, never this file. The `node:events`
 * dependency below would crash a client bundle anyway if something
 * slipped past review.
 */

import { EventEmitter } from "node:events";

import type { EventEnvelope, EventMap, EventTopic } from "./types";

const GLOBAL_KEY = "__forenix_event_bus__" as const;

type GlobalWithBus = typeof globalThis & {
  [GLOBAL_KEY]?: EventEmitter;
};

function getBus(): EventEmitter {
  const g = globalThis as GlobalWithBus;
  if (!g[GLOBAL_KEY]) {
    const bus = new EventEmitter();
    // Many concurrent SSE connections share the same bus.
    bus.setMaxListeners(1024);
    g[GLOBAL_KEY] = bus;
  }
  return g[GLOBAL_KEY]!;
}

/** Emit a typed event. Producers call this; consumers never do. */
export function emit<T extends EventTopic>(topic: T, payload: EventMap[T]): void {
  const envelope: EventEnvelope<T> = {
    topic,
    payload,
    at: new Date().toISOString(),
  };
  // Same payload published on the topic AND on a wildcard channel so
  // an SSE connection with a topic-filter can listen on just "*".
  getBus().emit(topic, envelope);
  getBus().emit("*", envelope);
}

/**
 * Subscribe to events. Returns an unsubscribe function.
 *
 * If `topics` is empty or omitted, subscribes to all events via the
 * "*" wildcard channel.
 */
export function subscribe(
  topics: EventTopic[] | undefined,
  handler: (envelope: EventEnvelope) => void,
): () => void {
  const bus = getBus();
  if (!topics || topics.length === 0) {
    bus.on("*", handler);
    return () => bus.off("*", handler);
  }
  for (const t of topics) bus.on(t, handler);
  return () => {
    for (const t of topics) bus.off(t, handler);
  };
}
