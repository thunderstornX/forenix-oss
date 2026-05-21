# Ethics statement

forenix-oss is an open-source platform for OSINT collection and
forensic case management. It can be used to investigate
infrastructure, organisations, and individuals using
publicly-available data. That capability creates real
obligations.

This statement makes the obligations explicit and describes the
rights-protective design choices the platform encodes by default.
It is not a substitute for legal advice in any jurisdiction and
does not exempt the operator from anything.

---

## 1. Intended use

forenix-oss is intended for use by:

- Investigators with lawful authorisation in their jurisdiction
  to collect open-source intelligence on the targets they
  investigate (law-enforcement, regulators, internal
  investigators, journalists working within applicable press
  freedoms, accredited human-rights researchers operating under
  recognised investigative-procedure frameworks such as the
  Berkeley Protocol).

- Researchers studying the OSINT pipeline as an object of
  study (the use case this repository is primarily developed
  for).

- Defenders running OSINT against their own infrastructure,
  brand, or personnel as part of a sanctioned exposure-mapping
  or threat-intelligence programme.

It is not intended for, and the operator is asked not to use it
for, unauthorised surveillance of individuals, harassment,
stalking, retaliatory exposure, or the construction of identity
correlations across platforms in violation of the platforms'
terms of service or of applicable data-protection law.

---

## 2. Operator responsibility

The operator is the responsible party. The platform does not
verify, and cannot verify, the operator's legal authorisation to
target any particular subject. Specifically:

- Under PIPEDA (Canada), the operator is responsible for
  identifying a lawful purpose, limiting collection to what is
  reasonably necessary for that purpose, and complying with the
  applicable retention and disposal obligations.

- Under GDPR (EU), the operator is the data controller for any
  collection that processes personal data. The operator must
  identify a lawful basis (Article 6), respect the data subject's
  rights (Articles 13-22), and observe the data-protection-by-
  design and by-default obligations (Article 25). The platform's
  built-in constraints do not satisfy those obligations on the
  operator's behalf.

- Under US doctrine after *Carpenter v. United States* (2018) and
  the developing doctrinal line, the operator should not assume
  that commercial availability of data dissolves Fourth Amendment
  concerns. The platform allows but does not require
  Carpenter-style treatment of commercially-available location
  and telemetry data; the operator decides.

- Under cross-jurisdictional collection (where the operator and
  the data subject are in different legal regimes), the operator
  is responsible for identifying which regime's obligations
  apply and meeting them.

---

## 3. Rights-protective design choices

The platform encodes the following rights-protective defaults.
They are necessary, not sufficient.

- **Authorisation logging.** Every collection action is recorded
  in the SHA-256 forward-chained audit log with operator
  identity, target, tool invoked, and timestamp. The operator
  cannot collect without leaving a trace; the trace is
  cryptographically tamper-evident.

- **Tool gating.** Tools that require external API keys
  (Shodan, Hunter, Have I Been Pwned, Censys) refuse to run
  without their keys present. Tools requiring local subprocess
  binaries (Maigret, Sherlock, subfinder, theHarvester, the deep
  toolchain) refuse to run on serverless deployments and gate
  on local binary availability. The operator must take an
  affirmative step to enable each capability.

- **Structured analytic discipline.** LLM-produced findings must
  carry a structured-analytic-technique trace (Heuer 1999;
  Heuer and Pherson 2010+; Coulthart 2017). Conclusions that
  arrive without a SAT trace are persisted with confidence
  downgraded to `unverified` and surfaced to the operator as
  such; the epistemic weakness is recorded in the evidence chain
  rather than silently smoothed away. This is an epistemic
  constraint, not a legal one, but it makes unsupported
  inferences harder to introduce and easier to identify.

- **Per-case isolation.** Every forensic case lives in its own
  Git repository with its own evidence directory. The platform
  does not aggregate evidence across cases or operators by
  default. Cross-case correlation requires an explicit operator
  action that is itself logged.

- **External attestation.** The audit chain root can be
  published to independent transparency backends (Sigstore Rekor,
  GitHub-issue witness, local HMAC). External parties can verify
  the chain has not been silently rewritten. The operator does
  not have unilateral control over the historical record.

- **Right to be forgotten support.** Evidence and case data
  carry deletion endpoints; the audit log records the deletion
  rather than removing the original evidence's hash from the
  chain. This is the GDPR-compatible posture: the trace persists
  for accountability, the content does not persist beyond its
  authorised retention.

---

## 4. What the platform does not exempt the operator from

The presence of the audit log does not authorise collection
that would otherwise be unauthorised. The presence of an
attestation backend does not satisfy disclosure obligations to
data subjects. The presence of a SAT scaffold does not satisfy
substantive evidentiary standards in any court.

The platform reduces the friction of doing the right things; it
does not perform them on the operator's behalf.

---

## 5. Reporting concerns

If you become aware of forenix-oss being used in violation of
the spirit of this statement, the repository's security policy
([`SECURITY.md`](../../SECURITY.md)) describes how to report it.
We treat misuse reports seriously and will work in good faith
with affected parties, hosting providers, and applicable
authorities.

---

## 6. This statement is a living document

This statement reflects the project's posture as of v0.5.1. It
will be revised as the legal and ethical landscape around OSINT
evolves, as the platform's design changes, and in response to
substantive feedback. Suggestions for refinement are welcome via
repository issue.
