/**
 * POST /api/admin/waitlist/[id]/approve
 *
 * Admin-only. Converts a pending waitlist row into a real User
 * account with the lowest-rank operator role (investigator) and
 * marks the waitlist row as invited.
 *
 * The endpoint returns the generated temporary password so the
 * admin can copy it into whatever channel they use to email the
 * new user (no automated mail yet). The password is NEVER stored
 * in plaintext anywhere — only the bcrypt hash lands on the user
 * row.
 *
 * Re-running on an already-invited row returns 409.
 */
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { z } from "zod";

import { appendAudit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { httpErrorResponse, requireRole, requireSession } from "@/lib/rbac";

const Body = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  role: z.enum(["admin", "investigator", "analyst", "viewer"]).default("investigator"),
});

function generatePassword(): string {
  // 18 chars from base64url ~= 108 bits of entropy. Easy to copy.
  return randomBytes(13).toString("base64url");
}

export async function POST(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await requireSession();
    requireRole(actor, "admin");
    const { id } = await ctx.params;
    const body = Body.parse(await request.json().catch(() => ({})));

    const row = await prisma.waitlistSignup.findUnique({ where: { id } });
    if (!row) {
      return Response.json({ error: "waitlist_row_not_found" }, { status: 404 });
    }
    if (row.status === "invited") {
      return Response.json(
        { error: "already_invited", invitedAt: row.invitedAt },
        { status: 409 },
      );
    }

    // Don't silently collide with an existing user — return 409 so
    // the admin handles it (probably mark waitlist row as duplicate).
    const existing = await prisma.user.findUnique({ where: { email: row.email } });
    if (existing) {
      return Response.json(
        { error: "user_already_exists", userId: existing.id },
        { status: 409 },
      );
    }

    const password = generatePassword();
    const passwordHash = await bcrypt.hash(password, 10);
    // Derive a sensible name from the email local-part if the admin
    // didn't supply one and the waitlist row doesn't carry it.
    const name =
      body.name ??
      row.email.split("@")[0].replace(/[._-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

    const user = await prisma.user.create({
      data: {
        email: row.email,
        name,
        role: body.role,
        passwordHash,
      },
      select: { id: true, email: true, name: true, role: true },
    });

    await prisma.waitlistSignup.update({
      where: { id },
      data: { status: "invited", invitedAt: new Date() },
    });

    await appendAudit({
      action: "waitlist_approve",
      entity: "WaitlistSignup",
      entityId: row.id,
      userId: actor.userId,
      details: { email: row.email, newUserId: user.id, role: user.role },
    });

    return Response.json({
      data: {
        user,
        credentials: {
          email: user.email,
          password,  // shown once; admin emails the user out-of-band
        },
        note: "Copy these credentials into your invite email. They are NOT stored in plaintext server-side.",
      },
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
