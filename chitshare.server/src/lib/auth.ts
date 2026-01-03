import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "./db";

import { JWT_SECRET } from "@/lib/session";
const TOKEN_EXPIRY = "7d";

export interface TokenPayload {
  userId: string;
  email: string;
  isAdmin: boolean;
}

/**
 * Hash a password using bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

/**
 * Compare a password with a hash
 */
export async function verifyPassword(
  password: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Generate a JWT token for a user
 */
export function generateToken(payload: TokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });
}

/**
 * Verify and decode a JWT token
 */
export function verifyToken(token: string): TokenPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as TokenPayload;
  } catch {
    return null;
  }
}

/**
 * Extract token from Authorization header
 */
export function extractToken(authHeader: string | null): string | null {
  if (!authHeader?.startsWith("Bearer ")) {
    return null;
  }
  return authHeader.slice(7);
}

/**
 * Get user from request headers
 */
export async function getUserFromRequest(request: Request) {
  const authHeader = request.headers.get("Authorization");
  const token = extractToken(authHeader);

  if (!token) {
    return null;
  }

  const payload = verifyToken(token);
  if (!payload) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: {
      id: true,
      email: true,
      username: true,
      avatarUrl: true,
      isAdmin: true,
      isOnline: true,
      lastSeen: true,
      createdAt: true,
    },
  });

  return user;
}

/**
 * Require authentication - returns user or throws response
 */
export async function requireAuth(request: Request) {
  const user = await getUserFromRequest(request);

  if (!user) {
    throw new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  return user;
}

/**
 * Require admin authentication
 */
export async function requireAdmin(request: Request) {
  const user = await requireAuth(request);

  if (!user.isAdmin) {
    throw new Response(
      JSON.stringify({ error: "Forbidden - Admin access required" }),
      {
        status: 403,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  return user;
}

/**
 * Check if this is the first user (will be made admin)
 */
export async function isFirstUser(): Promise<boolean> {
  const count = await prisma.user.count();
  return count === 0;
}
