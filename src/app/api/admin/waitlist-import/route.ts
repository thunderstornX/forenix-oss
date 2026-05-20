/**
 * POST /api/admin/waitlist-import
 *
 * Token-gated receiver for waitlist signups arriving from another
 * deployment. The intended caller is the Vercel concept surface at
 * forenix.tech, which fires this after its own local upsert so the
 * paid SaaS at demo.forenix.tech has one canonical waitlist view.
 *
 * Auth: shared secret in Authorization: Bearer <WAITLIST_SYNC_TOKEN>.
 * Idempotent on email (upsert). Honours the original createdAt so
 * the queue position the user saw on the source deployment stays
 * meaningful in chronological terms.
 *
 * Public path: this route bypasses session auth (handled by
 * middleware allowlist) but ONLY responds 200 with the right bearer.
 */
import { z } from "zod";

import { appendAudit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { httpErrorResponse } from "@/lib/rbac";
import { bearerFromHeader, timingSafeStringEqual } from "@/lib/security";

const Body = z.object({
  email: z.string().email().max(254),
  role: z.enum(["analyst", "investigator", "ciso", "researcher", "other"]).optional(),
  useCase: z.string().trim().max(500).optional(),
  source: z.string().trim().max(120).optional(),
  /** ISO timestamp from the source row. Lets us preserve queue order. */
  originalCreatedAt: z.string().datetime().optional(),
  /** Where the row came from (e.g. "vercel-forenix-tech"). */
  origin: z.string().trim().max(80).optional(),
});

function authorised(req: Request): boolean {
  const token = process.env.WAITLIST_SYNC_TOKEN;
  if (!token) return false; // never accept if no secret is configured
  return timingSafeStringEqual(bearerFromHeader(req), token);
}

export async function POST(request: Request) {
  try {
    if (!authorised(request)) {
      return Response.json({ error: "unauthorized" }, { status: 401 });
    }

    const body = Body.parse(await request.json());
    const email = body.email.toLowerCase();
    const origin = body.origin ?? "sync";
    const tag = body.source ? `${body.source}+${origin}` : origin;
    const originalCreatedAt = body.originalCreatedAt
      ? new Date(body.originalCreatedAt)
      : undefined;

    const existing = await prisma.waitlistSignup.findUnique({
      where: { email },
      select: { id: true, createdAt: true },
    });

    if (existing) {
      // Idempotent path: don't bump createdAt; refresh role/useCase
      // if the source has fresher values.
      await prisma.waitlistSignup.update({
        where: { id: existing.id },
        data: {
          role: body.role ?? undefined,
          useCase: body.useCase ?? undefined,
          source: tag,
        },
      });
      return Response.json({
        data: { ok: true, status: "exists", position: await positionOf(existing.id) },
      });
    }

    const row = await prisma.waitlistSignup.create({
      data: {
        email,
        role: body.role ?? null,
        useCase: body.useCase ?? null,
        source: tag,
        ipHash: null, // no IP from the upstream caller
        createdAt: originalCreatedAt ?? new Date(),
      },
    });

    await appendAudit({
      action: "waitlist_signup",
      entity: "WaitlistSignup",
      entityId: row.id,
      details: {
        role: row.role ?? null,
        source: row.source ?? null,
        sync: true,
        origin,
      },
    });

    return Response.json({
      data: { ok: true, status: "imported", position: await positionOf(row.id) },
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return Response.json(
        { error: "invalid_body", details: err.issues },
        { status: 400 },
      );
    }
    return httpErrorResponse(err);
  }
}

async function positionOf(id: string): Promise<number> {
  const row = await prisma.waitlistSignup.findUnique({
    where: { id },
    select: { createdAt: true },
  });
  if (!row) return 0;
  return prisma.waitlistSignup.count({
    where: { createdAt: { lte: row.createdAt } },
  });
}
