# API Reference — forenix-oss

All routes are JSON. Response shape is always `{ data: … }` or
`{ error: code, details?: msg }`. POST/PUT/PATCH bodies are
Zod-validated; an invalid body returns `400 invalid_body`.

Authentication is **not yet enforced** in 0.1 — every route is
open in the OSS build. SaaS adds session cookies + RBAC checks.

---

## Health + identity

### `GET /api/health`

```jsonc
{
  "status": "ok",
  "adapter": "mock",      // active adapter name
  "version": "0.1.0",
  "saasMode": false
}
```

---

## Investigations

### `GET /api/investigations`

Returns every investigation, newest first.

```jsonc
{
  "data": [
    {
      "id": "cmp…",
      "title": "INV-2025-019 — Northwind Holdings",
      "target": "northwind-holdings.io",
      "targetType": "domain",
      "status": "complete",
      "priority": "high",
      "createdAt": "2026-05-13T01:08:45.223Z",
      "updatedAt": "…",
      "caseId": "cmp…",
      "_count": { "findings": 3, "monitors": 1, "reports": 1 }
    }
  ]
}
```

### `POST /api/investigations`

Body (Zod):

```jsonc
{
  "title": "INV-2025-021 — example.com",
  "target": "example.com",
  "targetType": "domain",        // person | organization | domain | ip | username | phone | image | compound
  "objective": "1-line statement of intent",
  "priority": "medium"           // low | medium | high | critical
}
```

Response: `201` with the created row in `{ data: … }`. Writes one
audit row (`create_investigation`).

### `GET /api/investigations/:id`

Returns the full detail: findings (with optional evidence bridge),
monitors + recent runs, reports, entity relations, audit trail,
`_count` summary.

---

## Pipeline + bridge

### `POST /api/pipeline/run/:id`

Drives the AI adapter end-to-end.

Body (all fields optional):

```jsonc
{
  "agentGroups": ["identity", "infrastructure", "social"],
  "adapter": "nvidia"            // overrides AI_ADAPTER for this call
}
```

Response `201`:

```jsonc
{
  "data": {
    "investigationId": "…",
    "adapter": "nvidia",
    "agentGroups": ["identity","infrastructure","social"],
    "findings": 11,
    "entities": 5,
    "relations": 7,
    "report": { "id": "…", "title": "…" }
  }
}
```

Audit rows written: `pipeline_started`, one
`agent_<group>_completed` per group, `entities_extracted`,
`report_generated`, `pipeline_completed`.

### `POST /api/bridge/inv-to-case/:id`

Opens a Case from an Investigation and (optionally) promotes every
finding to Evidence.

Body:

```jsonc
{
  "caseTitle": "Custom title (optional)",
  "promoteFindings": true        // default true
}
```

Response `201`:

```jsonc
{
  "data": {
    "case": { "id": "…", "caseNumber": "CASE-2026-002", "title": "…", "status": "open" },
    "promoted": 13,
    "alreadyLinked": false
  }
}
```

If the investigation is already linked, returns `{ alreadyLinked:
true, case: <existing> }` with status `200`.

---

## Findings

### `POST /api/findings/:id/verify`

No body. Flips `verified=true` and upgrades confidence if
`unverified`. Writes `verify_finding`.

### `POST /api/findings/:id/promote`

No body. Mints an Evidence row on the linked case's `main` branch
and stamps `Finding.evidenceId`. Requires the parent Investigation
to already be bridged (`409 no_case_linked` otherwise).

---

## Cases

### `GET /api/cases`

List with `_count.{evidence, branches, investigations}`.

### `POST /api/cases`

Body:

```jsonc
{
  "title": "Operation …",
  "description": "…",
  "priority": "medium"
}
```

Auto-mints `caseNumber = CASE-YYYY-NNN`. Creates a `main` branch.

### `GET /api/cases/:id`

Full detail: evidence rows with inline commit chain, branches, MRs,
assignments, agents, linked investigations, reports, metrics, last
50 audit rows.

`Evidence.size` is BigInt — coerced to string on the wire.

---

## Evidence

### `GET /api/evidence?caseId=…`

Without `caseId`: every evidence row across every case. With
`caseId`: just that case's items. Each row carries
`_count.{commits, findings, comments}`.

### `POST /api/evidence/:id/seal`

No body. Flips `status="sealed"`, writes a `seal` commit on
`main`, and audits.

---

## Entities

### `GET /api/entities?investigationId=…`

Returns every entity + every relation. When `investigationId` is
omitted, returns the global graph (capped at 500 relations + 200
unattached entities).

```jsonc
{
  "data": {
    "entities": [{ "id": "…", "name": "…", "type": "person", "properties": {…} }],
    "relations": [
      { "id": "…", "from": "<entityId>", "to": "<entityId>",
        "relationType": "owns", "confidence": "confirmed",
        "investigationId": "…" }
    ]
  }
}
```

---

## Monitors / Verifications / Reports / Reviews / Agents

Plain list endpoints, no body, no mutation:

- `GET /api/monitors`
- `GET /api/verifications`
- `GET /api/reports`
- `GET /api/reports/:id`
- `GET /api/reviews`
- `GET /api/agents`

Reports detail merges Argus-style `sections` (JSON) and ForenX-style
`content` (markdown); the UI renders whichever is present.

---

## Audit + integrity

### `GET /api/audit?investigationId=…&caseId=…&limit=…`

Audit rows in `createdAt` ascending order. `limit` caps at 1000.

### `GET /api/audit/verify`

Replays the chain. Two shapes:

```jsonc
{ "data": { "ok": true, "entries": 19 } }
```

or, on failure:

```jsonc
{ "data": {
    "ok": false,
    "brokenAt": "<id of the bad row>",
    "expected": "<sha256>",
    "got": "<sha256>",
    "entries": 27
}}
```

---

## Network graph

### `GET /api/network`

Union of users, agents, investigations, cases, evidence, entities
with derived edges (case → evidence, inv → case bridge, finding →
evidence promotion, entity relations, case assignments, agent
assignments).

```jsonc
{
  "data": {
    "nodes": [{ "id": "user:abc", "kind": "user", "label": "…", "meta": {…} }],
    "edges": [{ "from": "user:abc", "to": "case:xyz", "type": "lead" }]
  }
}
```

---

## Error shape

```jsonc
{ "error": "invalid_body", "details": "expected string, received undefined" }
{ "error": "not_found" }
{ "error": "no_case_linked", "details": "Bridge the investigation to a case first." }
{ "error": "already_sealed" }
```

| HTTP | Meaning |
|---|---|
| `200` | OK |
| `201` | Created (POST that creates a resource) |
| `400` | Body validation failed |
| `404` | Not found |
| `409` | Conflict (e.g., already promoted, already sealed) |
| `500` | Unhandled server error — check the dev log |
