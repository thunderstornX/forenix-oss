/**
 * Module augmentation  -  adds `id` + `role` (+ Phase 9.5 `orgId`) to
 * the session/user shape so TypeScript knows our extra fields exist
 * after our jwt/session callbacks have set them.
 *
 * `orgId` is `null` in OSS single-tenant deployments and for users
 * who haven't been assigned to an organisation yet.
 */
import "next-auth";

declare module "next-auth" {
  interface User {
    id?: string;
    role?: string;
    orgId?: string | null;
  }
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      role: string;
      orgId?: string | null;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: string;
    orgId?: string | null;
  }
}
