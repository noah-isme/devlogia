import type { NextAuthOptions, Session, User } from "next-auth";
import { getServerSession } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcrypt";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import type { Role } from "@/lib/rbac";
import { resolveHighestRole } from "@/lib/rbac";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

type AuthorizedUser = Pick<User, "id" | "email" | "name"> & {
  role: Role;
  isActive: boolean;
};

const roleNamesFromUser = (userRoles: Array<{ role: { name: string } }>) =>
  userRoles.map((entry) => entry.role.name.toLowerCase());

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/admin/login",
  },
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email", required: true },
        password: { label: "Password", type: "password", required: true },
      },
      async authorize(credentials) {
        const result = credentialsSchema.safeParse(credentials ?? {});
        if (!result.success) {
          return null;
        }

        const user = await prisma.user.findUnique({
          where: { email: result.data.email.toLowerCase() },
          include: { roles: { include: { role: true } } },
        });

        if (!user || !user.isActive) {
          return null;
        }

        const isValid = await bcrypt.compare(result.data.password, user.passwordHash);
        if (!isValid) {
          return null;
        }

        const authorizedUser: AuthorizedUser = {
          id: user.id,
          email: user.email,
          name: user.email,
          role: resolveHighestRole(roleNamesFromUser(user.roles)),
          isActive: user.isActive,
        };

        return authorizedUser;
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
        token.email = user.email;
        token.role = (user as AuthorizedUser).role;
        token.isActive = (user as AuthorizedUser).isActive;
      }

      if (token.sub) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.sub },
          include: { roles: { include: { role: true } } },
        });

        if (!dbUser) {
          token.isActive = false;
          token.role = "viewer";
        } else {
          token.isActive = dbUser.isActive;
          token.role = resolveHighestRole(roleNamesFromUser(dbUser.roles));
          token.email = dbUser.email;
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub as string;
        session.user.email = (token.email as string | undefined) ?? session.user.email ?? "";
        session.user.role = (token.role as Role) ?? "viewer";
        session.user.isActive = token.isActive !== false;
      }

      if (session.user && token.sub) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.sub as string },
          include: { roles: { include: { role: true } } },
        });

        if (!dbUser) {
          session.user.role = "viewer";
          session.user.isActive = false;
        } else {
          session.user.role = resolveHighestRole(roleNamesFromUser(dbUser.roles));
          session.user.isActive = dbUser.isActive;
          session.user.email = dbUser.email;
        }
      }

      return session;
    },
  },
};

export function auth() {
  return getServerSession(authOptions);
}

export type SessionWithUser = Session & {
  user: Session["user"] & {
    id: string;
    role: Role;
    isActive: boolean;
  };
};
