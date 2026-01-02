import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

// GET /api/users/online - Get online users
export async function GET(request: Request) {
  try {
    await requireAuth(request);

    const users = await prisma.user.findMany({
      where: { isOnline: true },
      select: {
        id: true,
        username: true,
        avatarUrl: true,
        lastSeen: true,
      },
      orderBy: { lastSeen: "desc" },
    });

    return NextResponse.json({ users });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Online users error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
