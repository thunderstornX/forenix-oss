/**
 * next-auth v5 setup  -  credentials provider + JWT sessions.
 *
 * We deliberately go JWT (not database sessions) so the dev DB
 * stays Prisma-only and the Vercel / serverless deployment doesn't
 * need to write a Session row on every request.
 *
 * The credentials provider validates email + bcrypt(password) and
 * augments the token with the user's role.
 *
 * NOTE: this module is server-only because it imports the prisma
 * client + bcryptjs.  Do not import it from any "use client" file.
 */
import "server-only";

import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { z } from "zod";

import { prisma } from "@/lib/db";

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1).max(200),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  trustHost: true,
  secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
  pages: {
    signIn: "/sign-in",
  },
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        email:    { label: "Email",    type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(creds) {
        const parsed = LoginSchema.safeParse(creds);
        if (!parsed.success) return null;
        const { email, password } = parsed.data;

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user || user.disabled || !user.passwordHash) return null;

        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) return null;

        // The shape we return becomes the `user` object in callbacks.
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          orgId: user.orgId,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger }) {
      if (user) {
        token.id = user.id as string;
        token.role = (user as { role?: string }).role ?? "investigator";
        token.orgId = (user as { orgId?: string | null }).orgId ?? null;
      }
      // Phase 9.5: if a user's primary org changes mid-session (admin
      // moves them, first-time onboarding), refresh from the DB on
      // next-auth's `update` trigger so the JWT doesn't go stale.
      if (trigger === "update" && token.id) {
        const fresh = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: { orgId: true, role: true },
        });
        if (fresh) {
          token.orgId = fresh.orgId;
          token.role = fresh.role;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        session.user.role = (token.role as string) ?? "investigator";
        session.user.orgId = (token.orgId as string | null | undefined) ?? null;
      }
      return session;
    },
  },
});
