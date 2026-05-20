/**
 * Typed payloads for the live-event bus.
 *
 * Anything the server wants the dashboard to react to in real time
 * (without polling) goes through here. The matching invalidation map
 * lives in src/hooks/use-live-events.ts on the client.
 *
 * Adding a new event:
 *   1. Add a topic prefix below if the family is new.
 *   2. Add the payload shape in EventMap.
 *   3. Call emit(topic, payload) from the producer.
 *   4. Decide the TanStack Query keys it should invalidate and
 *      register them in the QUERY_KEYS map on the client hook.
 */

export type EventTopic =
  | "monitor.run.started"
  | "monitor.run.completed"
  | "attestation.run.started"
  | "attestation.run.completed"
  | "audit.append";

export interface EventMap {
  "monitor.run.started":      { monitorId: string; runId?: string };
  "monitor.run.completed":    { monitorId: string; runId: string; status: "succeeded" | "failed" };
  "attestation.run.started":  { scheduleId?: string; backend: string };
  "attestation.run.completed":{ scheduleId?: string; backend: string; attestationId?: string; status: "succeeded" | "failed" };
  "audit.append":             { hash: string; action: string; entity: string };
}

/** Wire envelope every connected SSE client receives.
 *
 * `orgId` is the tenant the event belongs to. Producers populate it
 * from the actor / entity context. The SSE route uses it to filter
 * what each connection receives:
 *
 *   envelope.orgId === null   ⇒ "global" / system event, everyone sees it
 *   envelope.orgId === "X"    ⇒ only members of org X (+ super-admin) see it
 *
 * Single-tenant deployments (OSS, today's Vercel + DO) emit with
 * orgId=null and behave exactly as before. The filter is additive. */
export interface EventEnvelope<T extends EventTopic = EventTopic> {
  topic: T;
  payload: EventMap[T];
  at: string;  // ISO timestamp
  orgId?: string | null;
}
