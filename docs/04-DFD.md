# Data Flow Diagrams  -  forenix-oss

All diagrams use Mermaid so they render directly on GitHub and in
any markdown viewer.

## Level 0  -  Context diagram

```mermaid
flowchart TB
  Analyst[(Analyst / Investigator)] --> App((forenix-oss))
  Examiner[(Forensic Examiner)] --> App
  Counsel[(Counsel)] --> App
  Compliance[(Compliance / Audit)] --> App

  App --> LLM["External LLM provider<br/>(NVIDIA / OpenRouter / Ollama / ...)"]
  App --> Storage[(Database)]
  App --> SearchAPIs["Search / OSINT sources<br/>(optional, via adapter)"]
  App -. exports .-> ReportFile["PDF / markdown report file"]
  App -. attests .-> ChainProof["Hash-chain attestation"]
```

## Level 1  -  Major processes

```mermaid
flowchart LR
  subgraph Inputs
    A[Analyst]
    SR["Search results<br/>(synthetic for now)"]
  end

  A -->|create| P1["P1: Investigation management"]
  P1 --> DBI[("Investigation table")]

  A -->|run pipeline| P2["P2: Pipeline runner"]
  P2 -->|target + group| LLM[(LLM provider)]
  SR -->|sources| P2
  LLM -->|findings| P2
  P2 --> DBF[("Finding table")]
  P2 --> DBE[("Entity + EntityRelation tables")]
  P2 --> DBR[("Report table")]

  A -->|verify| P3["P3: Finding verification"]
  P3 --> DBF

  A -->|promote| P4["P4: Bridge to case"]
  P4 --> DBC[("Case table")]
  P4 --> DBEv[("Evidence table")]
  P4 --> DBComm[("EvidenceCommit table")]
  P4 --> DBB[("Branch table")]

  A -->|seal| P5["P5: Evidence sealing"]
  P5 --> DBEv
  P5 --> DBComm

  P1 --> P6["P6: Audit logger"]
  P2 --> P6
  P3 --> P6
  P4 --> P6
  P5 --> P6
  P6 --> DBA[("AuditLog<br/>(hash-chained)")]

  Counsel[(Counsel)] -->|verify chain| P7["P7: Integrity verifier"]
  P7 --> DBA
  P7 -->|verdict| Counsel
```

## Level 2  -  Pipeline runner detail

```mermaid
flowchart TB
  Start([POST /api/pipeline/run/:id])
  Start --> S1{"Investigation exists?"}
  S1 -- no --> R404[404 not_found]
  S1 -- yes --> S2["appendAudit(pipeline_started)"]
  S2 --> S3["Investigation.status = running"]

  S3 --> Fan{"fan out groups<br/>(Promise.all)"}
  Fan --> A1["analyze identity"]
  Fan --> A2["analyze infrastructure"]
  Fan --> A3["analyze social"]
  Fan --> An["... (configurable)"]

  A1 --> J["join -> all findings"]
  A2 --> J
  A3 --> J
  An --> J

  J --> S4["insert Finding rows"]
  S4 --> S5["appendAudit(agent_*_completed)"]

  S5 --> E1["extractEntities(findings)"]
  E1 --> E2["upsert Entity + EntityRelation"]
  E2 --> S6["appendAudit(entities_extracted)"]

  S6 --> R1["generateReport()"]
  R1 --> R2["insert Report row"]
  R2 --> S7["appendAudit(report_generated)"]

  S7 --> End["Investigation.status = complete"]
  End --> S8["appendAudit(pipeline_completed)"]
  S8 --> Out([201 + summary JSON])
```

## Level 2  -  Investigation -> Case bridge

```mermaid
flowchart TB
  Start([POST /api/bridge/inv-to-case/:id])
  Start --> P1{"investigation found?"}
  P1 -- no --> R1[404]
  P1 -- yes --> P2{"already linked?"}
  P2 -- yes --> RA["return existing case"]
  P2 -- no --> P3["mint CASE-YYYY-NNN"]
  P3 --> P4["create Case (status: open)"]
  P4 --> P5["create 'main' Branch"]
  P5 --> P6["Investigation.caseId = case.id"]
  P6 --> P7["appendAudit(bridge_investigation_to_case)"]

  P7 --> P8{"promoteFindings?"}
  P8 -- no --> Done
  P8 -- yes --> Loop{"for each finding"}
  Loop --> P9["create Evidence (hash)"]
  P9 --> P10["create EvidenceCommit on main"]
  P10 --> P11["Finding.evidenceId = evidence.id"]
  P11 --> Loop
  Loop -- done --> P12["appendAudit(findings_promoted_to_evidence)"]
  P12 --> Done([201 + payload])
```

## Level 2  -  Audit chain verification

```mermaid
flowchart TB
  Start([GET /api/audit/verify])
  Start --> L["load all AuditLog rows<br/>order by createdAt asc"]
  L --> Init["prevHash := GENESIS"]
  Init --> ForLoop{"for each row"}

  ForLoop -- next --> E["expected = computeAuditHash(<br/>prevHash, action, entity, entityId, createdAt)"]
  E --> C{"row.prevHash == prevHash<br/>AND row.hash == expected ?"}
  C -- no --> Bad(["return ok:false<br/>brokenAt, expected, got"])
  C -- yes --> N["prevHash := row.hash"]
  N --> ForLoop

  ForLoop -- exhausted --> OK(["return ok:true<br/>entries:N"])
```

## State diagram  -  Investigation

```mermaid
stateDiagram-v2
  [*] --> draft
  draft --> running : POST /api/pipeline/run
  running --> complete : pipeline finished
  running --> failed : adapter error
  complete --> bridged : POST /api/bridge/inv-to-case
  bridged --> [*]
  failed --> running : retry
  draft --> archived : manual
  complete --> archived : manual
```

## State diagram  -  Evidence

```mermaid
stateDiagram-v2
  [*] --> collected : created
  collected --> verified : analyst review
  verified --> sealed : POST /api/evidence/:id/seal
  sealed --> [*] : (immutable)
  collected --> sealed : direct seal
```

## State diagram  -  Case

```mermaid
stateDiagram-v2
  [*] --> open : POST /api/cases  or  bridge from investigation
  open --> investigating : work in progress
  investigating --> closed : verdict reached
  closed --> archived : retention period elapsed
  archived --> [*]
```

## Trust boundary

```mermaid
flowchart LR
  subgraph trusted["Trusted (server)"]
    DB[(Database)]
    Routes[Route handlers]
    Audit["audit hash chain"]
    Adapter["AI adapter factory"]
  end

  subgraph untrusted["Untrusted (anything else)"]
    Browser["Client browser"]
    LLM["LLM provider"]
    Search["Search APIs"]
  end

  Browser -->|HTTPS<br/>(zod-validated)| Routes
  Routes -->|HTTPS| LLM
  Routes -->|HTTPS| Search
  Routes --> Audit
  Audit --> DB
  Routes --> DB
```

Every cross-boundary edge is validated: incoming requests through
Zod, outbound model responses through the parsers in
`chat-completions.ts` (length caps, enum clamps, JSON-fence
extraction).
