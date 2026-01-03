import { jwtVerify } from "jose";

export const JWT_SECRET =
  process.env.JWT_SECRET || "chitshare-secret-change-in-production";

export interface SessionPayload {
  userId: string;
  email: string;
  isAdmin: boolean;
  exp?: number;
  iat?: number;
}

const key = new TextEncoder().encode(JWT_SECRET);

/**
 * Verify a JWT token using jose (Edge compatible)
 */
export async function verifySession(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, key, {
      algorithms: ["HS256"],
    });
    return payload as unknown as SessionPayload;
  } catch (error) {
    return null;
  }
}
