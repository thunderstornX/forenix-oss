"use client";

import { Search } from "lucide-react";

interface Props {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}

export function FilterInput({ value, onChange, placeholder }: Props) {
  return (
    <label className="flex items-center gap-2 rounded-md border border-[var(--border)] bg-[var(--background-elev)] px-2.5 py-1.5 text-[12px]">
      <Search className="h-3.5 w-3.5 text-[var(--foreground-muted)]" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? "Filter…"}
        className="w-44 bg-transparent text-[var(--foreground)] outline-none placeholder:text-[var(--foreground-muted)]"
      />
    </label>
  );
}

export function matchesQuery(q: string, ...fields: (string | null | undefined)[]): boolean {
  if (!q) return true;
  const needle = q.toLowerCase();
  return fields.some((f) => (f ?? "").toLowerCase().includes(needle));
}
