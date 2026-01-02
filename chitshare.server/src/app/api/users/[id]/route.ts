import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth, requireAdmin } from "@/lib/auth";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/users/[id] - Get user profile
export async function GET(request: Request, { params }: RouteParams) {
  try {
    await requireAuth(request);
    const { id } = await params;

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        username: true,
        email: true,
        avatarUrl: true,
        isOnline: true,
        lastSeen: true,
        isAdmin: true,
        createdAt: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({ user });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Get user error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

// PATCH /api/users/[id] - Update user profile
export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const currentUser = await requireAuth(request);
    const { id } = await params;

    // Only admin or self can update
    if (currentUser.id !== id && !currentUser.isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { username, avatarUrl, isAdmin } = body;

    const updateData: Record<string, unknown> = {};
    if (username) updateData.username = username;
    if (avatarUrl !== undefined) updateData.avatarUrl = avatarUrl;

    // Only admin can change admin status
    if (isAdmin !== undefined && currentUser.isAdmin) {
      updateData.isAdmin = isAdmin;
    }

    const user = await prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        username: true,
        email: true,
        avatarUrl: true,
        isAdmin: true,
      },
    });

    return NextResponse.json({ user });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Update user error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

// DELETE /api/users/[id] - Admin deletes user
export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    await requireAdmin(request);
    const { id } = await params;

    await prisma.user.delete({ where: { id } });

    return NextResponse.json({ message: "User deleted" });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Delete user error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
