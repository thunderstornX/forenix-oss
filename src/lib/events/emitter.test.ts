/**
 * Tests for src/lib/events/emitter.ts.
 *
 * Validates the singleton-via-globalThis pattern, the typed payloads,
 * the topic vs. wildcard subscription paths, and the unsubscribe
 * teardown. These are the contracts the SSE endpoint relies on; if
 * any of them regress, /api/events stops working in subtle ways.
 */
import { describe, it, expect, beforeEach } from "bun:test";

import { emit, subscribe } from "./emitter";
import type { EventEnvelope } from "./types";

beforeEach(() => {
  // Reset the singleton between tests so leaked listeners from one
  // case don't bleed into the next. The emitter lives on globalThis;
  // this is the only way to truly isolate.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete (globalThis as any).__forenix_event_bus__;
});

describe("event emitter", () => {
  it("delivers an emitted event to a topic subscriber", () => {
    const received: EventEnvelope[] = [];
    subscribe(["audit.append"], (env) => received.push(env));

    emit("audit.append", { hash: "abc", action: "test_action", entity: "Test" });

    expect(received).toHaveLength(1);
    expect(received[0].topic).toBe("audit.append");
    expect(received[0].payload).toEqual({
      hash: "abc",
      action: "test_action",
      entity: "Test",
    });
    expect(typeof received[0].at).toBe("string");
  });

  it("delivers every event to a wildcard subscriber", () => {
    const received: EventEnvelope[] = [];
    subscribe(undefined, (env) => received.push(env));

    emit("monitor.run.started", { monitorId: "m1" });
    emit("attestation.run.completed", {
      backend: "local",
      attestationId: "a1",
      status: "succeeded",
    });

    expect(received).toHaveLength(2);
    expect(received.map((r) => r.topic)).toEqual([
      "monitor.run.started",
      "attestation.run.completed",
    ]);
  });

  it("does not deliver events outside the requested topic set", () => {
    const audit: EventEnvelope[] = [];
    const monitor: EventEnvelope[] = [];
    subscribe(["audit.append"], (env) => audit.push(env));
    subscribe(["monitor.run.completed"], (env) => monitor.push(env));

    emit("audit.append", { hash: "h", action: "a", entity: "e" });

    expect(audit).toHaveLength(1);
    expect(monitor).toHaveLength(0);
  });

  it("unsubscribe stops further delivery", () => {
    const received: EventEnvelope[] = [];
    const off = subscribe(["audit.append"], (env) => received.push(env));

    emit("audit.append", { hash: "h1", action: "a", entity: "e" });
    off();
    emit("audit.append", { hash: "h2", action: "a", entity: "e" });

    expect(received).toHaveLength(1);
    expect(received[0].payload).toEqual({ hash: "h1", action: "a", entity: "e" });
  });

  it("multiple subscribers on the same topic all receive the event", () => {
    let countA = 0;
    let countB = 0;
    subscribe(["audit.append"], () => { countA += 1; });
    subscribe(["audit.append"], () => { countB += 1; });

    emit("audit.append", { hash: "h", action: "a", entity: "e" });

    expect(countA).toBe(1);
    expect(countB).toBe(1);
  });
});
