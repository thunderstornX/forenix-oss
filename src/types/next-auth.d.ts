/**
 * Module augmentation — adds `id` + `role` to the session/user shape
 * so TypeScript knows our extra fields exist after our jwt/session
 * callbacks have set them.
 */
import "next-auth";

declare module "next-auth" {
  interface User {
    id?: string;
    role?: string;
  }
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      role: string;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: string;
  }
}
