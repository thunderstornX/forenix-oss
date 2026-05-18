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

export interface AuditRow {
  id: string;
  action: string;
  entity: string;
  entityId: string | null;
  userId: string | null;
  caseId: string | null;
  investigationId: string | null;
  hash: string | null;
  prevHash: string | null;
  details: string;
  createdAt: string;
}

export interface EvidenceListItem {
  id: string;
  caseId: string;
  name: string;
  type: string;
  mimeType: string | null;
  size: string;
  hash: string;
  hashAlgo: string;
  status: string;
  tags: string;
  description: string | null;
  createdAt: string;
  case: { id: string; title: string; caseNumber: string };
  _count: { commits: number; findings: number; comments: number };
}

export interface NetworkNode {
  id: string;
  kind: "user" | "agent" | "investigation" | "case" | "evidence" | "entity";
  label: string;
  meta?: Record<string, string | number | boolean | null>;
}
export interface NetworkEdge {
  from: string;
  to: string;
  type: string;
}
export function useNetwork() {
  return useQuery({
    queryKey: ["network"],
    queryFn: () => http<{ data: { nodes: NetworkNode[]; edges: NetworkEdge[] } }>("/api/network"),
  });
}

export interface ReviewRow {
  id: string;
  title: string;
  description: string | null;
  status: string;
  authorId: string;
  reviewerId: string | null;
  createdAt: string;
  mergedAt: string | null;
  case: { id: string; title: string; caseNumber: string };
  branch: { name: string; color: string };
  reviewer: { id: string; name: string } | null;
  _count: { comments: number };
}
export function useReviews() {
  return useQuery({
    queryKey: ["reviews"],
    queryFn: () => http<{ data: ReviewRow[] }>("/api/reviews"),
  });
}

export interface AgentTaskRow {
  id: string;
  type: string;
  status: string;
  input: string;
  output: string | null;
  confidence: number;
  error: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}
export interface AgentRow {
  id: string;
  name: string;
  type: string;
  model: string;
  status: string;
  description: string | null;
  config: string;
  lastActive: string | null;
  createdAt: string;
  updatedAt: string;
  tasks: AgentTaskRow[];
  _count: { tasks: number; assignments: number };
}
export function useAgents() {
  return useQuery({
    queryKey: ["agents"],
    queryFn: () => http<{ data: AgentRow[] }>("/api/agents"),
  });
}

export interface ReportListItem {
  id: string;
  title: string;
  source: "investigation" | "case";
  type: string;
  status: string;
  findingCount: number;
  generatedBy: string | null;
  createdAt: string;
  updatedAt: string;
  investigation: { id: string; title: string; target: string } | null;
  case: { id: string; title: string; caseNumber: string } | null;
}
export function useReports() {
  return useQuery({
    queryKey: ["reports"],
    queryFn: () => http<{ data: ReportListItem[] }>("/api/reports"),
  });
}
export interface ReportDetail extends ReportListItem {
  sections: string;
  content: string;
  generator: { id: string; name: string } | null;
  investigation: (ReportListItem["investigation"] & { targetType?: string; objective?: string }) | null;
}
export function useReport(id: string | null) {
  return useQuery({
    queryKey: ["report", id],
    queryFn: () => http<{ data: ReportDetail }>(`/api/reports/${id}`),
    enabled: id !== null,
  });
}

export interface EntityRow {
  id: string;
  name: string;
  type: string;
  properties: string;
  source: string;
  verified: boolean;
  createdAt: string;
}
export interface RelationRow {
  id: string;
  from: string;
  to: string;
  relationType: string;
  confidence: string;
  investigationId: string | null;
}
export function useEntities(investigationId?: string | null) {
  const url = investigationId
    ? `/api/entities?investigationId=${investigationId}`
    : "/api/entities";
  return useQuery({
    queryKey: ["entities", investigationId ?? "all"],
    queryFn: () => http<{ data: { entities: EntityRow[]; relations: RelationRow[] } }>(url),
  });
}

export interface MonitorRow {
  id: string;
  investigationId: string | null;
  target: string;
  targetType: string;
  cadence: string;
  status: string;
  lastRunAt: string | null;
  nextRunAt: string | null;
  createdAt: string;
  investigation: { id: string; title: string; target: string } | null;
  runs: Array<{ id: string; status: string; findingsCount: number; startedAt: string; completedAt: string | null }>;
  _count: { runs: number };
}
export function useMonitors() {
  return useQuery({
    queryKey: ["monitors"],
    queryFn: () => http<{ data: MonitorRow[] }>("/api/monitors"),
  });
}

export function useCreateMonitor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      investigationId?: string;
      target: string;
      targetType: string;
      cadence?: string;
      status?: "active" | "paused";
    }) =>
      http<{ data: MonitorRow }>("/api/monitors", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["monitors"] });
      qc.invalidateQueries({ queryKey: ["audit"] });
    },
  });
}

export function usePatchMonitor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...body
    }: {
      id: string;
      status?: "active" | "paused";
      cadence?: string;
      target?: string;
      targetType?: string;
    }) =>
      http<{ data: MonitorRow }>(`/api/monitors/${id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["monitors"] });
      qc.invalidateQueries({ queryKey: ["audit"] });
    },
  });
}

export function useDeleteMonitor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      http<{ data: { ok: true } }>(`/api/monitors/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["monitors"] });
      qc.invalidateQueries({ queryKey: ["audit"] });
    },
  });
}

export function useRunMonitorNow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      http<{ data: unknown }>(`/api/monitors/${id}/run`, { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["monitors"] });
      qc.invalidateQueries({ queryKey: ["audit"] });
    },
  });
}

export interface VerificationRow {
  id: string;
  investigationId: string | null;
  claim: string;
  claimType: string;
  verdict: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}
export function useVerifications() {
  return useQuery({
    queryKey: ["verifications"],
    queryFn: () => http<{ data: VerificationRow[] }>("/api/verifications"),
  });
}

export function useSetVerdict() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, verdict }: { id: string; verdict: string }) =>
      http(`/api/verifications/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ verdict }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["verifications"] });
      qc.invalidateQueries({ queryKey: ["audit"] });
    },
  });
}

export function useMergeReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      http(`/api/reviews/${id}/merge`, { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reviews"] });
      qc.invalidateQueries({ queryKey: ["audit"] });
      qc.invalidateQueries({ queryKey: ["case"] });
    },
  });
}

export function useAgentTaskAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, action }: { id: string; action: "cancel" | "rerun" }) =>
      http(`/api/agent-tasks/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ action }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["agents"] });
      qc.invalidateQueries({ queryKey: ["audit"] });
    },
  });
}

export function useEvidence(caseId?: string | null) {
  const url = caseId ? `/api/evidence?caseId=${caseId}` : "/api/evidence";
  return useQuery({
    queryKey: ["evidence", caseId ?? "all"],
    queryFn: () => http<{ data: EvidenceListItem[] }>(url),
  });
}

export function useAudit(opts?: { investigationId?: string; caseId?: string }) {
  const qs = new URLSearchParams();
  if (opts?.investigationId) qs.set("investigationId", opts.investigationId);
  if (opts?.caseId)          qs.set("caseId", opts.caseId);
  const url = `/api/audit${qs.toString() ? "?" + qs.toString() : ""}`;
  return useQuery({
    queryKey: ["audit", opts ?? {}],
    queryFn: () => http<{ data: AuditRow[]; total: number }>(url),
  });
}

export type IntegrityResult =
  | { ok: true; entries: number }
  | { ok: false; brokenAt: string; expected: string; got: string; entries: number };

export function useIntegrity() {
  return useQuery({
    queryKey: ["integrity"],
    queryFn: () => http<{ data: IntegrityResult }>("/api/audit/verify"),
    refetchOnMount: true,
  });
}

export interface AttestationRow {
  id: string;
  entries: number;
  headId: string;
  headHash: string;
  backend: string;
  status: "submitted" | "confirmed" | "failed";
  proof: string;
  externalRef: string | null;
  externalUrl: string | null;
  error: string | null;
  createdAt: string;
  confirmedAt: string | null;
}
export interface AttestationBackendInfo {
  name: string;
  description: string;
}
export function useAttestations() {
  return useQuery({
    queryKey: ["attestations"],
    queryFn: () =>
      http<{ data: AttestationRow[]; backends: AttestationBackendInfo[] }>(
        "/api/attestation",
      ),
  });
}
export function useCreateAttestation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { backend?: string } = {}) =>
      http<{ data: AttestationRow }>("/api/attestation", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["attestations"] });
      qc.invalidateQueries({ queryKey: ["audit"] });
      qc.invalidateQueries({ queryKey: ["integrity"] });
    },
  });
}
export interface AttestationVerifyResult {
  row: AttestationRow;
  verdict: { ok: boolean; details?: string };
}
export function useVerifyAttestation() {
  return useMutation({
    mutationFn: (id: string) =>
      http<{ data: AttestationVerifyResult }>(`/api/attestation/${id}/verify`),
  });
}

export interface AttestationScheduleRow {
  id: string;
  backend: string;
  cadence: string;
  enabled: boolean;
  lastRunAt: string | null;
  nextRunAt: string | null;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: string | null;
}
export function useAttestationSchedules() {
  return useQuery({
    queryKey: ["attestation-schedules"],
    queryFn: () =>
      http<{ data: AttestationScheduleRow[]; backends: AttestationBackendInfo[] }>(
        "/api/admin/attestation-schedule",
      ),
  });
}
export function useCreateAttestationSchedule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { backend: string; cadence?: string; enabled?: boolean }) =>
      http<{ data: AttestationScheduleRow }>("/api/admin/attestation-schedule", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["attestation-schedules"] });
      qc.invalidateQueries({ queryKey: ["audit"] });
    },
  });
}
export function usePatchAttestationSchedule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...body
    }: {
      id: string;
      enabled?: boolean;
      cadence?: string;
      backend?: string;
    }) =>
      http<{ data: AttestationScheduleRow }>(`/api/admin/attestation-schedule/${id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["attestation-schedules"] });
      qc.invalidateQueries({ queryKey: ["audit"] });
    },
  });
}
export function useDeleteAttestationSchedule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      http<{ data: { ok: true } }>(`/api/admin/attestation-schedule/${id}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["attestation-schedules"] });
      qc.invalidateQueries({ queryKey: ["audit"] });
    },
  });
}

export interface MeResponse {
  id: string;
  email: string | null;
  name: string | null;
  role: "admin" | "investigator" | "analyst" | "viewer";
  teams: Array<{ id: string; name: string; slug: string; role: string }>;
}
export function useMe() {
  return useQuery({
    queryKey: ["me"],
    queryFn: () => http<{ data: MeResponse }>("/api/me"),
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });
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

export interface InvestigationDetail {
  id: string;
  title: string;
  target: string;
  targetType: string;
  objective: string;
  status: string;
  priority: string;
  tags: string;
  createdAt: string;
  updatedAt: string;
  caseId: string | null;
  case: { id: string; title: string; caseNumber: string; status: string } | null;
  findings: Array<{
    id: string;
    category: string;
    title: string;
    description: string;
    confidence: string;
    priority: string;
    sourceName: string;
    agentGroup: string;
    verified: boolean;
    evidence: { id: string; name: string; hash: string } | null;
    reasoningTrace: string;
    createdAt: string;
  }>;
  monitors: Array<{
    id: string;
    target: string;
    cadence: string;
    status: string;
    lastRunAt: string | null;
    nextRunAt: string | null;
    runs: Array<{ id: string; status: string; findingsCount: number; startedAt: string; completedAt: string | null }>;
  }>;
  reports: Array<{
    id: string;
    title: string;
    status: string;
    type: string;
    source: string;
    findingCount: number;
    updatedAt: string;
  }>;
  entities: Array<{
    id: string;
    relationType: string;
    confidence: string;
    fromEntity: { id: string; name: string; type: string };
    toEntity: { id: string; name: string; type: string };
  }>;
  auditLogs: Array<{
    id: string;
    action: string;
    entity: string;
    entityId: string | null;
    hash: string | null;
    prevHash: string | null;
    createdAt: string;
  }>;
  _count: { findings: number; monitors: number; reports: number; entities: number; auditLogs: number; schedules: number };
}

export interface CaseDetail {
  id: string;
  title: string;
  description: string;
  caseNumber: string;
  status: string;
  priority: string;
  progress: number;
  repository: string;
  createdAt: string;
  updatedAt: string;
  evidence: Array<{
    id: string;
    name: string;
    type: string;
    mimeType: string | null;
    size: string;
    hash: string;
    hashAlgo: string;
    status: string;
    tags: string;
    description: string | null;
    createdAt: string;
    commits: Array<{
      id: string;
      commitHash: string;
      parentHash: string | null;
      message: string;
      changeType: string;
      verified: boolean;
      createdAt: string;
      branch: { name: string; color: string };
    }>;
    _count: { commits: number; findings: number; comments: number };
  }>;
  branches: Array<{
    id: string;
    name: string;
    isMain: boolean;
    status: string;
    color: string;
    parentBranch: string | null;
    parentHash: string | null;
    headHash: string | null;
    createdAt: string;
    _count: { commits: number; merges: number };
  }>;
  mergeRequests: Array<{
    id: string;
    title: string;
    status: string;
    createdAt: string;
    mergedAt: string | null;
    branch: { name: string; color: string };
    reviewer: { id: string; name: string } | null;
  }>;
  assignments: Array<{
    id: string;
    role: string;
    user: { id: string; name: string; email: string; role: string };
  }>;
  agents: Array<{
    id: string;
    role: string;
    agent: { id: string; name: string; type: string; status: string };
  }>;
  investigations: Array<{
    id: string;
    title: string;
    target: string;
    targetType: string;
    status: string;
    priority: string;
  }>;
  reports: Array<{ id: string; title: string; status: string; type: string; source: string; updatedAt: string }>;
  metrics: Array<{ id: string; metric: string; value: number; unit: string; recordedAt: string }>;
  auditLogs: Array<{ id: string; action: string; entity: string; hash: string | null; createdAt: string }>;
  _count: Record<string, number>;
}

export function useInvestigation(id: string | null) {
  return useQuery({
    queryKey: ["investigation", id],
    queryFn: () => http<{ data: InvestigationDetail }>(`/api/investigations/${id}`),
    enabled: id !== null,
  });
}

export function useCase(id: string | null) {
  return useQuery({
    queryKey: ["case", id],
    queryFn: () => http<{ data: CaseDetail }>(`/api/cases/${id}`),
    enabled: id !== null,
  });
}

export function useCases() {
  return useQuery({
    queryKey: ["cases"],
    queryFn: () => http<{ data: CaseListItem[] }>("/api/cases"),
  });
}

export function useVerifyFinding() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: string; investigationId: string }) =>
      http(`/api/findings/${id}/verify`, { method: "POST" }),
    onSuccess: (_d, { investigationId }) => {
      qc.invalidateQueries({ queryKey: ["investigation", investigationId] });
      qc.invalidateQueries({ queryKey: ["audit"] });
    },
  });
}

export function usePromoteFinding() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: string; investigationId: string }) =>
      http(`/api/findings/${id}/promote`, { method: "POST" }),
    onSuccess: (_d, { investigationId }) => {
      qc.invalidateQueries({ queryKey: ["investigation", investigationId] });
      qc.invalidateQueries({ queryKey: ["evidence"] });
      qc.invalidateQueries({ queryKey: ["audit"] });
    },
  });
}

export function useSealEvidence() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: string; caseId: string }) =>
      http(`/api/evidence/${id}/seal`, { method: "POST" }),
    onSuccess: (_d, { caseId }) => {
      qc.invalidateQueries({ queryKey: ["case", caseId] });
      qc.invalidateQueries({ queryKey: ["evidence"] });
      qc.invalidateQueries({ queryKey: ["audit"] });
    },
  });
}

export interface PipelineRunResult {
  investigationId: string;
  adapter: AdapterName;
  agentGroups: string[];
  findings: number;
  entities: number;
  relations: number;
  report: { id: string; title: string };
}

export function useRunPipeline() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, agentGroups }: { id: string; agentGroups?: string[] }) =>
      http<{ data: PipelineRunResult }>(`/api/pipeline/run/${id}`, {
        method: "POST",
        body: JSON.stringify({ agentGroups }),
      }),
    onSuccess: (_d, { id }) => {
      qc.invalidateQueries({ queryKey: ["investigations"] });
      qc.invalidateQueries({ queryKey: ["investigation", id] });
    },
  });
}

export interface BridgeResult {
  case: { id: string; title: string; caseNumber: string };
  promoted: number;
  alreadyLinked: boolean;
}

export function useBridgeToCase() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, caseTitle, promoteFindings }: { id: string; caseTitle?: string; promoteFindings?: boolean }) =>
      http<{ data: BridgeResult }>(`/api/bridge/inv-to-case/${id}`, {
        method: "POST",
        body: JSON.stringify({ caseTitle, promoteFindings }),
      }),
    onSuccess: (_d, { id }) => {
      qc.invalidateQueries({ queryKey: ["investigations"] });
      qc.invalidateQueries({ queryKey: ["investigation", id] });
      qc.invalidateQueries({ queryKey: ["cases"] });
    },
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
