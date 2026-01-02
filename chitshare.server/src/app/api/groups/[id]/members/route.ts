import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// Helper: Check membership with role
async function getMembership(userId: string, groupId: string) {
  return prisma.groupMember.findUnique({
    where: { userId_groupId: { userId, groupId } },
  });
}

// GET /api/groups/[id]/members - List group members
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const user = await requireAuth(request);
    const { id } = await params;

    const membership = await getMembership(user.id, id);
    if (!membership) {
      return NextResponse.json({ error: "Not a member" }, { status: 403 });
    }

    const members = await prisma.groupMember.findMany({
      where: { groupId: id },
      include: {
        user: {
          select: { id: true, username: true, avatarUrl: true, isOnline: true },
        },
      },
      orderBy: [{ role: "asc" }, { joinedAt: "asc" }],
    });

    return NextResponse.json({ members });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("List members error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

// POST /api/groups/[id]/members - Add member (admin/owner)
export async function POST(request: Request, { params }: RouteParams) {
  try {
    const user = await requireAuth(request);
    const { id } = await params;

    const membership = await getMembership(user.id, id);
    if (!membership || !["owner", "admin"].includes(membership.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { userId, role = "member" } = body;

    if (!userId) {
      return NextResponse.json(
        { error: "userId is required" },
        { status: 400 },
      );
    }

    // Check if user exists
    const targetUser = await prisma.user.findUnique({ where: { id: userId } });
    if (!targetUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Check if already a member
    const existing = await getMembership(userId, id);
    if (existing) {
      return NextResponse.json({ error: "Already a member" }, { status: 409 });
    }

    const member = await prisma.groupMember.create({
      data: {
        userId,
        groupId: id,
        role: ["member", "admin"].includes(role) ? role : "member",
      },
      include: {
        user: {
          select: { id: true, username: true, avatarUrl: true },
        },
      },
    });

    return NextResponse.json({ member }, { status: 201 });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Add member error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

// DELETE /api/groups/[id]/members - Leave group (self) with userId in body
export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const user = await requireAuth(request);
    const { id } = await params;

    const membership = await getMembership(user.id, id);
    if (!membership) {
      return NextResponse.json({ error: "Not a member" }, { status: 403 });
    }

    // Owners cannot leave (must delete or transfer ownership)
    if (membership.role === "owner") {
      return NextResponse.json(
        {
          error: "Owner cannot leave. Transfer ownership or delete the group.",
        },
        { status: 400 },
      );
    }

    await prisma.groupMember.delete({
      where: { userId_groupId: { userId: user.id, groupId: id } },
    });

    return NextResponse.json({ message: "Left group" });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Leave group error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
