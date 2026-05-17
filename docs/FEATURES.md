# forenix-oss — Feature Catalogue

A guided tour of every view in the platform, what problem each one
solves, and exactly what is (and isn't) included today.

All screenshots are real renders against the seeded demo dataset.
Re-generate them at any time with:

```bash
bun run dev          # in one terminal
bun run db:seed      # in another
bun run scripts/screenshots.mjs
```

---

## 1. Dashboard

![Dashboard](./manual_screenshots/00-landing-dashboard.png)

**Problem.** Analysts juggle two tools — an OSINT engine and a case
manager — and never see them on one pane. Switching back and forth
is where context gets dropped.

**What it does.** Pulls live counts straight from the database:
how many investigations are running, how many are linked to a case,
how many evidence items exist across all cases, how many monitors
are armed, and which adapter is currently active. Click any row in
the *Recent investigations* / *Open cases* lists to drill into
detail. Updates on every focus change.

**What it does not.** No charts/trendlines yet (Phase 2 stretch). No
per-user scoping — the dashboard shows everything visible to the
current session.

---

## 2. Investigations

![Investigations](./manual_screenshots/10-investigations-list.png)
![Investigation detail](./manual_screenshots/20-investigation-detail.png)

**Problem.** OSINT collection is iterative: targets multiply, agent
groups produce overlapping findings, and you need a workspace that
holds the chain of reasoning.

**What it does.**
- Top-level table of every investigation with status, finding count,
  bridge-to-case chip, and an inline filter.
- Detail panel shows every finding the agents produced, grouped by
  agent group, with their confidence + priority + source.
- **Action buttons on each finding:** `verify` flips confidence to
  *confirmed*; `promote → evidence` mints a forensic Evidence row
  on the linked case (only available once the investigation has
  been bridged). Each action writes an audit-log row.
- *Audit trail* section shows every state change for this
  investigation, in chain order.
- Bridge chip jumps directly to the linked forensic case in one
  click.

**What it does not.** No bulk-edit on findings yet. No re-running of
a single agent group (you can re-run the whole pipeline; per-group
re-runs come next).

---

## 3. Pipeline runner

![Pipeline](./manual_screenshots/31-pipeline-configured.png)

**Problem.** Triggering an OSINT pipeline against the right target
with the right agent groups is a setup ritual every time. Bridging
the result into a forensic case is the second ritual.

**What it does.**
- Pick an investigation, toggle agent groups, hit **Run pipeline**.
  Stage progress animates per agent group → entity extraction →
  report generation.
- When the run completes, a *Pipeline complete* card surfaces the
  counts (findings / entities / relations) and the
  **Open forensic case →** button.
- That single button opens a Case, links it via `Investigation.caseId`,
  promotes every finding to Evidence with its own initial commit on
  the case's `main` branch, and audit-logs every step.
- The pipeline runs through whichever AI adapter is active:
  `mock`, `ollama`, `glm`, `claude`, `openrouter`, or `nvidia`. The
  request body can override the adapter per call (handy when you
  want to A/B two models side-by-side).

**What it does not.** No streaming progress yet — stages are
sequential per-group on the server, the UI tracks them
deterministically. No retry-on-failure (the whole run aborts on a
single error). No per-finding diffing across runs.

---

## 4. Cases

![Cases](./manual_screenshots/40-cases-list.png)
![Case detail](./manual_screenshots/41-case-detail.png)

**Problem.** Forensic cases require structure: who's assigned, what
evidence lives on which branch, who reviewed what, when.

**What it does.**
- Card grid of all open cases with a real progress bar, evidence
  count, branch count, and an inline filter on `caseNumber` +
  `title` + `status`.
- Detail panel shows the full state of one case: number, status,
  priority, progress; linked investigations with one-click jump
  back; an evidence list with the **full commit chain** inline
  per item (every commit shows its hash, branch, change type,
  verified state); branches sidebar; assignees + agent
  assignments; recent audit entries.
- **Per-evidence Seal button.** Sealing flips the status to
  `sealed`, writes a `seal` commit on `main`, and adds an audit
  row. Sealed evidence cannot be mutated further.

**What it does not.** No file upload (this build treats Evidence as
metadata + commit history; the bytes live elsewhere). Cherry-pick
between branches is not yet implemented.

---

## 5. Evidence (cross-case)

![Evidence](./manual_screenshots/50-evidence-list.png)

**Problem.** Sometimes you need the inventory of *every* piece of
evidence across every case at once — for chain-of-custody review,
for case-merge proposals, or just to find that one log file by
hash.

**What it does.** One table, every Evidence row, every case. Type,
MIME, size, **truncated SHA-256 hash**, status pill, commit count,
back-link to the parent case, and an inline filter that spans
name + type + hash + tags + status.

**What it does not.** No grouping / pivot yet — it's a flat table.
Bulk re-tag and bulk seal will land alongside the file-bytes feature.

---

## 6. Branch graph

![Branch graph](./manual_screenshots/60-branch-graph.png)

**Problem.** Cases evolve. Evidence gets re-verified, merged,
re-collected. Reading that as a flat list loses the structure.

**What it does.** A real SVG git-style commit graph for the active
case: one swimlane per branch, branch-coloured dots per commit, a
verified-ring around verified commits, and a row per commit on the
right with hash + change-type + message + evidence name + verified
state + relative time. Pick a different case from the top-level
list to re-render.

**What it does not.** No interactive collapse of inactive branches
yet, no commit-diff view (commits carry a `diffSummary` field but
we don't render it side-by-side).

---

## 7. Entity graph

![Entity graph](./manual_screenshots/70-entity-graph.png)

**Problem.** OSINT findings are noisy — you need to see the
entities (people, orgs, domains, IPs) and how they relate, fast.

**What it does.** A deterministic radial layout grouped by entity
type. Relation lines are weighted by confidence
(`confirmed` brightest, `unverified` dimmest), labelled with the
relation type. Pure SVG, zero physics, zero extra deps. Renders
hundreds of entities cleanly.

**What it does not.** No drag-to-reposition, no force simulation —
this is a *map*, not an editor. The Network Graph (next view)
handles the broader connection graph.

---

## 8. Network graph (cross-case)

![Network graph](./manual_screenshots/80-network-graph.png)

**Problem.** Once you have multiple cases and investigations going,
the most interesting signal is across them — the same analyst
working two cases, an agent feeding evidence into a separate
investigation, an entity appearing in two findings.

**What it does.** A six-lane SVG showing every user, agent,
investigation, case, evidence item, and entity in one canvas.
Arrows show: `case → evidence`, `investigation → case` (the
bridge), `user/agent → case` assignments, `entity ↔ entity`
relations. Lane colours match the legend; node tooltips reveal the
full label.

**What it does not.** Not interactive yet (no zoom/pan). For
graphs above ~250 nodes the labels overlap — that's the next
iteration's polish.

---

## 9. Monitors

![Monitors](./manual_screenshots/90-monitors.png)

**Problem.** Investigations don't end when the report ships.
Targets change. Domains move. New posts appear. Manual re-runs are
where coverage drifts.

**What it does.** Card-per-monitor with cadence (daily / weekly /
monthly), last + next run timestamps, the three most recent run
results (status + findings count). Each monitor links back to its
parent investigation.

**What it does not.** No scheduler running in the background of
this build — cadence is metadata; an external cron or `setInterval`
job would actually wake the monitor. (Plumbing for that is on the
roadmap as Phase 7's "Pipeline Schedules".)

---

## 10. Verification

![Verification](./manual_screenshots/100-verification.png)

**Problem.** OSINT findings carry a confidence label but the human
analyst needs to ratify or contest specific *claims* — and that
verdict needs to be visible, attributable, and auditable.

**What it does.** Claim-level table: each row is a claim with its
type (text / image / document / identity), the current verdict
(`pending` / `probable` / `confirmed` / `disputed` / `false` /
`unverified`), and who created it. Sub-claim breakdown and
reasoning trace are stored in the underlying record.

**What it does not.** No inline verdict-toggle in this build —
verdicts come from the API; UI mutations are the next iteration.

---

## 11. AI Lab

![AI Lab](./manual_screenshots/110-ai-lab.png)

**Problem.** When agents are doing real work you need to inspect
*exactly* what each one was asked, what it returned, and how
confident it was.

**What it does.** Card-per-agent showing type, model, status,
description, total task count, case assignments. Each card lists
the most recent five tasks with status icon, type, confidence
percentage, relative time, and the **raw output preview** in a
monospace block. Lets you spot a misbehaving agent before its
findings poison a case.

**What it does not.** No re-run / cancel buttons on tasks (they're
recorded, not interactively driven from here). That's a Phase 7
add.

---

## 12. Reports

![Reports](./manual_screenshots/120-reports-list.png)

**Problem.** Two reporting traditions: Argus produces sectioned
JSON for parameterised dashboards; ForenX produces markdown for
courts. Both need a home.

**What it does.** List view with status / type / source
discriminator, finding count, generator name, link to the parent
investigation or case. The detail view handles **both** shapes:
if `sections` is a JSON array it renders each section as a
heading + body; if `content` is markdown it renders it directly.

**What it does not.** No PDF export in this build (PDF is a
SaaS-premium feature; `SAAS_MODE=true` gates it). No collaborative
editing — reports here are read-only.

---

## 13. Audit log

![Audit](./manual_screenshots/140-audit-log.png)

**Problem.** Forensics lives or dies on the chain of custody. If
*anyone* can't answer "who changed what, when, in what order?",
the case is contaminated.

**What it does.** Append-only table of every write. Each row shows
the SHA-256 hash, the action, the entity it acted on, the
investigation/case scope (with jump links), the relative time, and
**the previous row's hash inline**. Any row whose `prevHash`
doesn't match the previous row's `hash` is highlighted red — the
table itself surfaces a broken chain at a glance.

**What it does not.** No write actions land here directly — the
log is computed by the system. Filter is plain-text (no
regex/date-range yet).

---

## 14. Integrity dashboard

![Integrity](./manual_screenshots/141-integrity-dashboard.png)

**Problem.** "Tamper-evident" is easy to claim and hard to verify.
You want a single button that replays the entire chain and tells
you the truth.

**What it does.** The **Verify chain** button calls
`verifyAuditChain()` which replays the entire `AuditLog` in
insertion order. For each row it recomputes
`sha256(prevHash | action | entity | entityId | iso(createdAt))`
and compares against the stored hash. Result: a giant green
"chain verified, N entries" or a red "broken at row X" with the
expected and stored hashes side-by-side for forensic inspection.
The cryptographic method itself is shown on-screen.

**What it does not.** This is a single-pass replay; no Merkle
batching for very large logs yet (the linear pass is more than
fast enough for a single deployment's lifetime, but tens-of-
millions of rows would deserve batched verification + caching).

---

## 15. Reviews (merge requests)

![Reviews](./manual_screenshots/150-reviews.png)

**Problem.** A second pair of eyes on every evidence-modifying
branch is the difference between "internal review" and "court-
admissible."

**What it does.** List of every open / merged / closed merge
request across all cases. Shows branch (colour-coded), parent case
chip, reviewer, comment count, relative time.

**What it does not.** No inline merge UI yet (the data layer is
ready; the *Approve & merge* button is the next polish pass).

---

## 16. Command palette ⌘K

![Command palette](./manual_screenshots/160-command-palette.png)

**Problem.** Even with ⌘1–⌘9 nav shortcuts, the analyst still
needs a way to jump straight to a specific case / investigation /
report without clicking through three lists.

**What it does.** Press ⌘K anywhere. Type to filter across all
nav targets + every investigation + every case + every report.
Arrow keys to navigate, Enter to open. Activating a case or
investigation row sets the active id *and* switches view, so
detail panels open instantly.

**What it does not.** No fuzzy-match scoring (substring only) and
no recent-history pinning yet.

---

## 17. Adapter switch (live LLMs)

The platform supports six AI adapters out of the box:

| Adapter | Where it runs | Tested live |
|---|---|---|
| `mock` | in-process, deterministic | ✅ 22 tests + every screenshot |
| `ollama` | local Ollama HTTP | stub (drop-in, untested live) |
| `glm` | Zhipu AI hosted | stub (drop-in) |
| `claude` | Anthropic API (SaaS-gated) | stub (drop-in) |
| `openrouter` | OpenRouter proxy → many models | ✅ live demo |
| `nvidia` | NVIDIA NIM hosted | ✅ live demo |

Switch with `AI_ADAPTER=…` in `.env`, **or** pass `adapter: "nvidia"`
in a `POST /api/pipeline/run/:id` request body to swap per-call.
Two live runs against the seeded `INV-2025-020` produced:

- **NVIDIA `meta/llama-3.3-70b-instruct`** — 47s, 11 findings, 5
  entities, 7 relations. Audit chain stayed green.
- **OpenRouter `openai/gpt-oss-120b:free`** — 82s, 10 findings, 9
  entities, 8 relations, then bridged to a Case which promoted 13
  rows to Evidence. Audit chain verified at 19 entries.

---

## What's intentionally not shipped yet

- **Real file-byte storage for Evidence.** Today every Evidence row
  carries metadata + a content hash; the bytes themselves are not
  stored in the database. This is the right shape for an MVP and
  forces the chain-of-custody discussion before the storage one.
- **Multi-tenant organisation isolation.** Schema is single-tenant
  for now; the `SAAS_MODE` flag will gate org-scoped queries when
  premium ships.
- **Background scheduler.** Monitors carry cadence + next-run
  timestamps but nothing wakes them. A cron / Temporal worker is a
  bolt-on, not a rewrite.
- **PDF export of reports.** Markdown renders today; PDF is a
  premium-tier feature behind `SAAS_MODE=true`.
- **Real-time UI updates.** TanStack Query refetches on focus; no
  websocket push yet. Sufficient for an analyst workflow at the
  current scale.
