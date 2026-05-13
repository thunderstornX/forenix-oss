import clsx, { type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Combined classnames helper — clsx for conditionals, tailwind-merge
 * to dedupe conflicting tailwind utilities.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/** Trim a hash for monospace display: first 8 + ellipsis + last 4. */
export function shortHash(h?: string | null): string {
  if (!h) return "—";
  if (h.length <= 14) return h;
  return `${h.slice(0, 8)}…${h.slice(-4)}`;
}

/** Format an ISO date string as relative time ("3 days ago"). */
export function relTime(date: Date | string | number): string {
  const ms = (Date.now() - new Date(date).getTime()) / 1000;
  if (ms < 60) return "just now";
  if (ms < 3_600) return `${Math.floor(ms / 60)}m ago`;
  if (ms < 86_400) return `${Math.floor(ms / 3_600)}h ago`;
  if (ms < 2_592_000) return `${Math.floor(ms / 86_400)}d ago`;
  return new Date(date).toLocaleDateString();
}

export function severityColor(severity: string): string {
  switch (severity) {
    case "critical":
      return "text-[color:var(--danger)]";
    case "high":
      return "text-[color:var(--warn)]";
    case "medium":
      return "text-[color:var(--accent)]";
    default:
      return "text-[color:var(--foreground-muted)]";
  }
}
