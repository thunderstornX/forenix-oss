"use client";

import { Archive, Folders, Lock, Upload, X, Loader2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { useRef, useState } from "react";

import { FilterInput, matchesQuery } from "@/components/filter-input";
import { useCases, useEvidence } from "@/lib/hooks";
import { useUI } from "@/lib/store";
import { cn, relTime, shortHash } from "@/lib/utils";

import { ViewShell } from "./view-shell";

const KB = 1024, MB = KB * 1024, GB = MB * 1024;

function formatSize(s: string): string {
  const n = Number(s);
  if (!Number.isFinite(n) || n === 0) return " - ";
  if (n < KB) return `${n} B`;
  if (n < MB) return `${(n / KB).toFixed(1)} KB`;
  if (n < GB) return `${(n / MB).toFixed(1)} MB`;
  return `${(n / GB).toFixed(1)} GB`;
}

export function EvidenceView() {
  const list = useEvidence();
  const setActiveCase = useUI((s) => s.setActiveCase);
  const setView = useUI((s) => s.setView);
  const [filter, setFilter] = useState("");
  const [uploadOpen, setUploadOpen] = useState(false);

  const rows = (list.data?.data ?? []).filter((e) =>
    matchesQuery(filter, e.name, e.type, e.mimeType ?? "", e.status, e.tags, e.case.caseNumber),
  );

  return (
    <ViewShell
      title="Evidence"
      subtitle="Every piece of evidence across every open case. Each row links back to its parent case and its hash-chained commits."
      actions={
        <>
          <FilterInput value={filter} onChange={setFilter} placeholder="Filter..." />
          <button
            type="button"
            onClick={() => setUploadOpen(true)}
            className="fx-btn fx-btn--primary fx-btn--sm"
          >
            <Upload size={13} />
            Upload file
          </button>
          <span className="text-[11px] text-[var(--foreground-muted)]">{rows.length} items</span>
        </>
      }
    >
      {uploadOpen && <UploadDialog onClose={() => setUploadOpen(false)} />}
      <div className="glass overflow-hidden rounded-lg">
        <table className="w-full">
          <thead className="border-b border-[var(--border)] bg-[var(--background-elev)] text-left text-[10px] uppercase tracking-[0.18em] text-[var(--foreground-muted)]">
            <tr>
              <th className="px-3 py-2 font-medium">Name</th>
              <th className="px-3 py-2 font-medium">Type</th>
              <th className="px-3 py-2 font-medium">Size</th>
              <th className="px-3 py-2 font-medium">Hash</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Case</th>
              <th className="px-3 py-2 font-medium">Commits</th>
              <th className="px-3 py-2 font-medium">Added</th>
            </tr>
          </thead>
          <tbody className="text-[12px]">
            {rows.map((e) => (
              <tr key={e.id} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--background-elev)]">
                <td className="px-3 py-2 align-top">
                  <div className="flex items-center gap-2">
                    <Archive className="h-3.5 w-3.5 shrink-0 text-[var(--forensic)]" />
                    <div className="min-w-0">
                      <div className="truncate text-[var(--foreground)]">{e.name}</div>
                      {e.description && (
                        <div className="truncate text-[10px] text-[var(--foreground-muted)]">{e.description}</div>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-3 py-2 align-top text-[var(--foreground-muted)]">
                  {e.type}
                  {e.mimeType && (
                    <div className="text-[10px]">{e.mimeType}</div>
                  )}
                </td>
                <td className="px-3 py-2 align-top text-[var(--foreground)]">{formatSize(e.size)}</td>
                <td className="px-3 py-2 align-top">
                  <span className="flex items-center gap-1">
                    <Lock className="h-3 w-3 text-[var(--foreground-muted)]" />
                    <span className="font-mono text-[11px]">{shortHash(e.hash)}</span>
                  </span>
                  <div className="text-[10px] text-[var(--foreground-muted)]">{e.hashAlgo}</div>
                </td>
                <td className="px-3 py-2 align-top">
                  <span
                    className={cn(
                      "rounded px-1.5 py-0.5 text-[10px] font-medium capitalize",
                      e.status === "verified"
                        ? "bg-[var(--accent-soft)] text-[var(--accent-strong)]"
                        : e.status === "sealed"
                        ? "bg-[var(--background-elev-2)] text-[var(--forensic)]"
                        : "bg-[var(--background-elev-2)] text-[var(--foreground-muted)]",
                    )}
                  >
                    {e.status}
                  </span>
                </td>
                <td className="px-3 py-2 align-top">
                  <button
                    type="button"
                    onClick={() => { setActiveCase(e.case.id); setView("cases"); }}
                    className="flex items-center gap-1 text-[var(--forensic)] hover:underline"
                  >
                    <Folders className="h-3 w-3" />
                    <span className="font-mono text-[11px]">{e.case.caseNumber}</span>
                  </button>
                </td>
                <td className="px-3 py-2 align-top text-[var(--foreground)]">{e._count.commits}</td>
                <td className="px-3 py-2 align-top text-[11px] text-[var(--foreground-muted)]">{relTime(e.createdAt)}</td>
              </tr>
            ))}
            {rows.length === 0 && !list.isLoading && (
              <tr>
                <td colSpan={8} className="p-6 text-center text-[12px] text-[var(--foreground-muted)]">
                  No evidence yet. Open a case, or promote findings from an investigation.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </ViewShell>
  );
}

function UploadDialog({ onClose }: { onClose: () => void }) {
  const cases = useCases();
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [caseId, setCaseId] = useState<string>("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);

  const availableCases = cases.data?.data ?? [];

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!caseId || !file) {
      toast.error("Pick a case and a file");
      return;
    }
    setBusy(true);
    setProgress(`Uploading ${file.name}...`);
    try {
      const form = new FormData();
      form.append("caseId", caseId);
      form.append("file", file);
      const res = await fetch("/api/evidence/upload", {
        method: "POST",
        body: form,
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 503) {
          toast.error("Storage unavailable on this host. See docs/SELF_HOST.md.");
        } else {
          toast.error(data?.error ?? `Upload failed (${res.status})`);
        }
        setBusy(false);
        setProgress(null);
        return;
      }
      toast.success(`Stored: ${data.data?.name} (${shortHash(data.data?.hash)})`);
      await qc.invalidateQueries({ queryKey: ["evidence"] });
      onClose();
    } catch (err) {
      toast.error((err as Error).message ?? "Upload failed");
      setBusy(false);
      setProgress(null);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "var(--scrim)",
        display: "grid",
        placeItems: "center",
        zIndex: 60,
      }}
    >
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="fx-card"
        style={{ width: "min(560px, 92vw)", padding: 0 }}
      >
        <div className="fx-card__head">
          <div className="fx-card__title">Upload evidence file</div>
          <button
            type="button"
            className="fx-btn fx-btn--ghost fx-btn--icon fx-btn--sm"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={14} />
          </button>
        </div>
        <div className="fx-card__body fx-stack" style={{ gap: 14 }}>
          <label className="fx-stack" style={{ gap: 6 }}>
            <span className="fx-eyebrow">Case</span>
            <select
              required
              value={caseId}
              onChange={(e) => setCaseId(e.target.value)}
              className="fx-input"
            >
              <option value="">Select a case...</option>
              {availableCases.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.caseNumber} - {c.title}
                </option>
              ))}
            </select>
          </label>

          <label className="fx-stack" style={{ gap: 6 }}>
            <span className="fx-eyebrow">File</span>
            <input
              ref={inputRef}
              required
              type="file"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="fx-input"
              style={{ paddingTop: 4 }}
            />
            {file && (
              <div
                style={{
                  fontSize: "var(--fs-xs)",
                  color: "var(--fg-muted)",
                  fontFamily: "var(--font-mono)",
                }}
              >
                {file.name} - {(file.size / 1024).toFixed(1)} KB - {file.type || "unknown/binary"}
              </div>
            )}
          </label>

          <div
            style={{
              fontSize: "var(--fs-xs)",
              color: "var(--fg-muted)",
              padding: "var(--s-3)",
              background: "var(--bg-sunken)",
              borderRadius: "var(--r-sm)",
              border: "1px solid var(--border)",
            }}
          >
            The file streams through a SHA-256 hash on the server. The
            resulting hex becomes both the cryptographic identity AND
            the on-disk content-addressed path. Re-hashing later confirms
            no bytes have changed. Self-host only - Vercel returns 503.
          </div>

          <div className="fx-row" style={{ justifyContent: "flex-end", gap: 8 }}>
            <button
              type="button"
              onClick={onClose}
              className="fx-btn"
              disabled={busy}
            >
              Cancel
            </button>
            <button type="submit" className="fx-btn fx-btn--primary" disabled={busy}>
              {busy && <Loader2 size={13} className="animate-spin" />}
              {busy ? progress ?? "Uploading..." : "Hash + store"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
