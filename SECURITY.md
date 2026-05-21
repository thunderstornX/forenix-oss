# Security Policy

## Supported versions

Security fixes are issued on the latest minor line. Older minor
lines are not back-ported unless the issue is critical and the
upgrade path is non-trivial.

| Version | Supported |
|---|---|
| `0.5.x` (current) | [x] |
| `0.4.x`           | best-effort, upgrade recommended |
| `< 0.4`           | unsupported, do not run in production |

## Reporting a vulnerability

**Please do not file a public GitHub issue for security
problems.** Use one of the private channels below.

- **GitHub Security Advisories**  -  preferred. Open a draft
  advisory at
  <https://github.com/thunderstornX/forenix-oss/security/advisories/new>.
  Only the maintainers see it until we publish.
- **Email**  -  `alibhutto101112@gmail.com`. Subject line should
  include `[forenix-oss security]`. PGP key is on request.

We aim to acknowledge within **72 hours** and to ship a fix or a
mitigation within **14 days** for high-severity reports.

### What to include

- A short description of the issue.
- Steps to reproduce, including the exact API call / UI path.
- The expected vs actual behaviour.
- An impact assessment (data exposure / privilege escalation /
  audit-chain tampering / etc.).
- Optionally, a suggested fix.

### Scope

In-scope:

- The audit-chain hash algorithm and any code path that writes
  to `AuditLog`.
- Authentication (next-auth credentials provider, session JWT,
  RBAC enforcement in API routes).
- Team isolation  -  any cross-team data leak is a security bug.
- API-route input validation (Zod boundaries).
- The adapter pattern  -  no adapter should ever leak a secret
  back into a response.
- Container image (Dockerfile)  -  known-CVE base images are a
  valid report.

Out of scope:

- Issues in upstream LLM providers (OpenAI / Anthropic / Groq /
  NVIDIA / OpenRouter). Report those directly to them.
- Issues in dependencies that are already public CVEs and have
  upstream patches you can rebase on  -  open a regular PR.
- Findings that require local OS access to the host running
  forenix-oss (we trust that boundary).

## Coordinated disclosure

We follow a 90-day coordinated-disclosure window by default.
We're happy to extend it if a fix is genuinely in flight, or
shorten it if the issue is actively being exploited.

## Trust anchor  -  the audit chain

The platform's whole forensic claim rests on the SHA-256 forward
chain over `AuditLog`. The algorithm is documented in
`docs/07-SECURITY.md` and verifiable offline in ~12 lines of
Python. If you find a way to mutate the chain undetected, that's
the highest-severity report we accept.
