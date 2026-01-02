import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// Helper: Check if user is group member
async function getGroupMembership(userId: string, groupId: string) {
  return prisma.groupMember.findUnique({
    where: { userId_groupId: { userId, groupId } },
  });
}

// GET /api/groups/[id] - Get group details
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const user = await requireAuth(request);
    const { id } = await params;

    const membership = await getGroupMembership(user.id, id);
    if (!membership) {
      return NextResponse.json(
        { error: "Group not found or not a member" },
        { status: 404 },
      );
    }

    const group = await prisma.group.findUnique({
      where: { id },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                avatarUrl: true,
                isOnline: true,
              },
            },
          },
        },
      },
    });

    return NextResponse.json({ group, myRole: membership.role });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Get group error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

// PATCH /api/groups/[id] - Update group (admin/owner only)
export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const user = await requireAuth(request);
    const { id } = await params;

    const membership = await getGroupMembership(user.id, id);
    if (!membership || !["owner", "admin"].includes(membership.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { name, description, avatarUrl } = body;

    const group = await prisma.group.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(description !== undefined && { description }),
        ...(avatarUrl !== undefined && { avatarUrl }),
      },
    });

    return NextResponse.json({ group });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Update group error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

// DELETE /api/groups/[id] - Delete group (owner only)
export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const user = await requireAuth(request);
    const { id } = await params;

    const membership = await getGroupMembership(user.id, id);
    if (!membership || membership.role !== "owner") {
      return NextResponse.json(
        { error: "Only owner can delete group" },
        { status: 403 },
      );
    }

    await prisma.group.delete({ where: { id } });

    return NextResponse.json({ message: "Group deleted" });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Delete group error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
