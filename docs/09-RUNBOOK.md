# Operational Runbook — forenix-oss

The day-2 ops book. What to do when something breaks, and what to
check on a routine cadence.

## 1. Daily checks (5 min)

```bash
curl -s $BASE/api/health
curl -s $BASE/api/audit/verify | jq '.data'
```

Both should return immediately with `ok:true`. If verify is
`ok:false`, jump to §3.

## 2. Weekly checks (15 min)

- Snapshot the database (Postgres: `pg_dump --format=c`; SQLite:
  the `.backup` SQL command).
- Tail the dev log for `unhandledRejection` / `5xx` patterns.
- Confirm the active `AI_ADAPTER` is what you expect.
- Confirm sealed evidence count has not decreased: a decrease
  means someone unsealed (which the API forbids) or a manual
  database edit happened — both demand investigation.

## 3. Incident: audit chain broken

**Symptom:** `GET /api/audit/verify` returns `ok:false`.

**Triage.**

1. Note the `brokenAt` id and timestamp.
2. Pull the row before + the row at `brokenAt`:
   ```sql
   SELECT id, action, entity, "entityId", hash, "prevHash", "createdAt"
   FROM "AuditLog"
   WHERE "createdAt" <= (SELECT "createdAt" FROM "AuditLog" WHERE id = '<brokenAt>')
   ORDER BY "createdAt" DESC
   LIMIT 5;
   ```
3. Is the `brokenAt` row's `prevHash` equal to the previous row's
   `hash`?
   - If **no** → a row was inserted/edited/deleted out of band.
   - If **yes** → the row's own `hash` was corrupted.
4. **Do not** try to "fix" the chain by recomputing. The integrity
   guarantee is exactly that this is impossible to fix invisibly.
5. Escalate per your incident-response policy. The chain remains
   broken until the next legitimate write — at that point, the
   `brokenAt` row's prevHash is no longer the "tip" of the chain,
   but it remains visible to all future verifies.

## 4. Incident: pipeline run hangs / times out

**Symptom:** `POST /api/pipeline/run/:id` returns a 500 after 90 s.

**Triage.**

1. Check the dev log for the actual exception (it's usually the
   AbortController firing on a slow LLM).
2. Confirm the active adapter is reachable:
   ```bash
   # NVIDIA
   curl -s -X POST https://integrate.api.nvidia.com/v1/chat/completions \
     -H "authorization: Bearer $NVIDIA_API_KEY" \
     -H "content-type: application/json" \
     -d '{"model":"meta/llama-3.1-70b-instruct","messages":[{"role":"user","content":"ping"}],"max_tokens":4}'
   ```
3. If the provider is healthy but slow, drop the agent-group count
   for the run, or switch model:
   ```bash
   AI_ADAPTER=openrouter OPENROUTER_MODEL=openai/gpt-oss-120b:free bun run dev
   ```
4. The Investigation will be stuck in `running` — set it back to
   `draft` with a one-off Prisma update if necessary. Note that
   this write *also* gets audited.

## 5. Incident: adapter returns invalid JSON

**Symptom:** `extractJson` throws during a pipeline run.

**Triage.**

1. The dev log contains the raw model response — copy it.
2. Re-test the model directly (curl above) to confirm it routinely
   returns non-JSON when asked for JSON.
3. Either:
   - Switch model (`OPENROUTER_MODEL=…`).
   - Tighten the prompt in `src/lib/ai/chat-completions.ts`
     (`SYSTEM_PIPELINE`, `SYSTEM_ENTITIES`).
4. The current `extractJson` already handles ```json fences and
   prose preambles; failures usually mean the model is genuinely
   off-spec.

## 6. Routine — re-seed the demo

```bash
bun run db:seed
```

This wipes every row using Prisma `deleteMany` (no `--force-reset`
so it bypasses the Prisma agent guard) and re-seeds to a clean
baseline with 9 audit rows.

## 7. Routine — capture fresh screenshots

```bash
bun run dev                  # in one terminal
bun run db:seed              # in another
bun run scripts/screenshots.mjs
```

Output lands in `docs/screenshots/` (~5 MB total).

## 8. Routine — rotate an LLM key

1. Generate a new key in the provider's console.
2. Edit `.env` (do **not** commit).
3. Restart dev (`Ctrl+C` then `bun run dev`).
4. `GET /api/health` should still report the same adapter name.
5. `POST /api/pipeline/run/:id` with a 1-finding agent-group set
   to confirm the new key works.

## 9. Routine — upgrade Node / Bun / Prisma

```bash
bun upgrade                  # bun runtime
bun update                   # project deps
bunx prisma generate         # regenerate the client
bun run typecheck            # confirm
bun run lint                 # confirm
bun run db:seed              # confirm
```

If anything fails, the upgrade is the suspect — pin back and file
an issue.

## 10. Emergency stop

```bash
pkill -9 -f 'next dev|next-server'
```

Wait 2 s, confirm with `pgrep -f next` (no output = clean stop).
The database is unaffected; restarting `bun run dev` resumes.
