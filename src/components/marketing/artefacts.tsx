"use client";

import { motion } from "framer-motion";

/**
 * Small in-line product artefacts used in the marketing shelves.
 * Each is a real screen we ship somewhere in the product, lightly
 * abbreviated. The premise: the artefacts ARE the marketing — we
 * don't need stock illustrations.
 */

export function RekorArtefact() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.4 }}
      transition={{ duration: 0.4 }}
      className="relative overflow-hidden rounded-md border border-[var(--border)] bg-[#0b0d10] text-[12px] shadow-[0_30px_80px_-30px_rgba(0,0,0,0.65)]"
    >
      <div className="flex items-center justify-between border-b border-white/[0.05] px-3 py-2 font-mono text-[10px]">
        <span className="flex items-center gap-1.5 text-white/55">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          rekor.sigstore.dev / api / v1 / log / entries / 24296fb…
        </span>
        <span className="text-white/30">200 OK</span>
      </div>
      <pre className="overflow-x-auto px-3 py-3 sm:px-4 font-mono leading-[1.6] text-white/85">
{`{
  "uuid":             "24296fb…b9c1",
  "logIndex":         163847219,
  "integratedTime":   1747504801,
  "kind":             "hashedrekord",
  "spec": {
    "data": { "hash": {
      "algorithm": "sha256",
      "value":     "d508a9c87b093c19ef007f4…"
    }},
    "signature": {
      "content":   "MEQCIAd4F…", `}<span className="text-white/40">{`// ed25519`}</span>{`
      "publicKey": { "content": "LS0tLS1CRUdJ…" }
    }
  }
}`}
      </pre>
      <div className="border-t border-white/[0.05] bg-white/[0.02] px-4 py-2 font-mono text-[11px]">
        <span className="text-emerald-300">verify ok</span>
        <span className="text-white/40"> — entry still pins this head, signature valid.</span>
      </div>
    </motion.div>
  );
}

export function ToolLoopArtefact() {
  const tools = [
    { name: "subfinder",     d: "github.com → 1,247 subdomains" },
    { name: "httpx",         d: "→ 419 live · 89 panels · 14 with TLS issues" },
    { name: "sherlock",      d: "username 'thunderstornX' → 23 sites" },
    { name: "crtsh",         d: "→ 87 historical certs, 4 wildcards" },
    { name: "exiftool",      d: "evidence/img-014.jpg → GPS + camera serial" },
  ];
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.4 }}
      transition={{ duration: 0.4 }}
      className="relative overflow-hidden rounded-md border border-[var(--border)] bg-[#0b0d10] shadow-[0_30px_80px_-30px_rgba(0,0,0,0.65)]"
    >
      <div className="flex items-center justify-between border-b border-white/[0.05] px-3 py-2 font-mono text-[10px]">
        <span className="text-white/55">tool-loop · run-2487 · openrouter / openai-gpt-oss-120b</span>
        <span className="rounded-sm bg-[var(--accent-soft)] px-1.5 py-0.5 text-[9px] uppercase tracking-[0.14em] text-[var(--accent-strong)]">
          live
        </span>
      </div>
      <ul className="divide-y divide-white/[0.04] font-mono text-[12px]">
        {tools.map((t, i) => (
          <motion.li
            key={t.name}
            initial={{ opacity: 0, x: -4 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.08 * i, duration: 0.3 }}
            className="flex items-baseline gap-3 px-4 py-2"
          >
            <span className="w-5 shrink-0 text-right text-white/30">
              {String(i + 1).padStart(2, "0")}
            </span>
            <span className="text-[var(--accent-strong)]">{t.name}</span>
            <span className="text-white/55">{t.d}</span>
          </motion.li>
        ))}
      </ul>
      <div className="border-t border-white/[0.05] bg-white/[0.02] px-4 py-2 font-mono text-[11px] text-white/55">
        <span className="text-emerald-300">→ 38 findings</span>
        <span> · </span>
        <span className="text-white/40">SAT trace attached · 4 promoted to evidence</span>
      </div>
    </motion.div>
  );
}

export function VerifierArtefact() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.4 }}
      transition={{ duration: 0.4 }}
      className="relative overflow-hidden rounded-md border border-[var(--border)] bg-[#0b0d10] shadow-[0_30px_80px_-30px_rgba(0,0,0,0.65)]"
    >
      <div className="flex items-center justify-between border-b border-white/[0.05] px-3 py-2 font-mono text-[10px]">
        <span className="text-white/55">verify-chain.py</span>
        <span className="text-white/30">offline · no SDK</span>
      </div>
      <pre className="overflow-x-auto px-3 py-3 sm:px-4 font-mono text-[12px] leading-[1.65] text-white/85">
{`import csv, hashlib

prev = "0" * 64
for r in csv.DictReader(open("audit.csv")):
    payload = "|".join([prev, r["action"], r["entity"],
                        r["entityId"], r["createdAt"]])
    h = hashlib.sha256(payload.encode()).hexdigest()
    assert r["prevHash"] == prev and r["hash"] == h, r["id"]
    prev = r["hash"]

print("chain OK")`}
      </pre>
    </motion.div>
  );
}
