import type { DefaultSession } from "next-auth";

type Role = "superadmin" | "admin" | "editor" | "writer";

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      id: string;
      role: Role;
      isActive: boolean;
    };
  }

  interface User {
    role: Role;
    isActive: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: Role;
    isActive?: boolean;
  }
}
