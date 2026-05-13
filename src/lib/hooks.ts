"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import type { AdapterName } from "./ai/types";

interface HealthPayload {
  status: "ok";
  adapter: AdapterName;
  version: string;
}

export interface InvestigationListItem {
  id: string;
  title: string;
  target: string;
  targetType: string;
  status: string;
  priority: string;
  createdAt: string;
  updatedAt: string;
  caseId: string | null;
  _count: { findings: number; monitors: number; reports: number };
}

export interface CaseListItem {
  id: string;
  title: string;
  caseNumber: string;
  status: string;
  priority: string;
  progress: number;
  createdAt: string;
  updatedAt: string;
  _count: { evidence: number; branches: number; investigations: number };
}

async function http<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`${res.status} ${res.statusText}${body ? ": " + body : ""}`);
  }
  return res.json() as Promise<T>;
}

export function useHealth() {
  return useQuery({
    queryKey: ["health"],
    queryFn: () => http<HealthPayload>("/api/health"),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
}

export function useInvestigations() {
  return useQuery({
    queryKey: ["investigations"],
    queryFn: () => http<{ data: InvestigationListItem[] }>("/api/investigations"),
  });
}

export function useCreateInvestigation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      title: string;
      target: string;
      targetType: string;
      objective: string;
      priority?: string;
    }) =>
      http<{ data: InvestigationListItem }>("/api/investigations", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["investigations"] }),
  });
}

export function useCases() {
  return useQuery({
    queryKey: ["cases"],
    queryFn: () => http<{ data: CaseListItem[] }>("/api/cases"),
  });
}

export function useCreateCase() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      title: string;
      description: string;
      priority?: string;
    }) =>
      http<{ data: CaseListItem }>("/api/cases", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cases"] }),
  });
}
