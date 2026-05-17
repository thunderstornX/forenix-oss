"use client";

import { Sparkles } from "lucide-react";

import { cn } from "@/lib/utils";

interface Props {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}

/**
 * Common scaffolding for every view  -  title row + optional actions
 * + body. Keeps the views visually consistent without each one
 * re-implementing the layout.
 */
export function ViewShell({ title, subtitle, actions, children, className }: Props) {
  return (
    <section className={cn("flex flex-col gap-4 p-6", className)}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-[var(--foreground)]">{title}</h2>
          {subtitle && (
            <p className="text-[12px] text-[var(--foreground-muted)]">{subtitle}</p>
          )}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
      {children}
    </section>
  );
}

interface PlaceholderProps {
  title: string;
  description: string;
  phase: string;
}

export function PlaceholderView({ title, description, phase }: PlaceholderProps) {
  return (
    <ViewShell title={title} subtitle={description}>
      <div className="glass mt-2 grid place-items-center rounded-xl px-10 py-16 text-center">
        <Sparkles className="mb-3 h-6 w-6 text-[var(--accent)]" />
        <h3 className="text-sm font-medium text-[var(--foreground)]">Coming in {phase}</h3>
        <p className="mt-1 max-w-md text-[12px] text-[var(--foreground-muted)]">
          The data layer for this view is already shaped in the unified Prisma schema; the
          UI is the next milestone on the roadmap.
        </p>
      </div>
    </ViewShell>
  );
}
