import NextAuth from "next-auth";

// Estendendo os tipos do NextAuth
declare module "next-auth" {
  interface User {
    id: string;
    name?: string | null;
    email?: string | null;
    image?: string | null;
    role?: string;
    phone?: string | null;
    address?: string | null;
  }

  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      role: string;
      phone?: string | null;
      address?: string | null;
    }
  }
}

// Estendendo tipos do JWT
declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role?: string;
    phone?: string | null;
    address?: string | null;
  }
} 