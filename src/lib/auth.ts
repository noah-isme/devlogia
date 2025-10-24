import type { NextAuthOptions, Session, User } from "next-auth";
import { getServerSession } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcrypt";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import type { Role } from "@/lib/rbac";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

type AuthorizedUser = Pick<User, "id" | "email" | "name"> & {
  role: Role;
};

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
        });

        if (!user) {
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
          role: (user.role as Role) ?? "writer",
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
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token) {
        session.user.id = token.sub as string;
        session.user.email = token.email;
        session.user.role = (token.role as Role) ?? "writer";
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
  };
};
