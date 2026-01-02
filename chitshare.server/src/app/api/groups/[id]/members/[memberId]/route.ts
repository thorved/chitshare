import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

interface RouteParams {
  params: Promise<{ id: string; memberId: string }>;
}

// DELETE /api/groups/[id]/members/[memberId] - Remove member (admin/owner)
export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const user = await requireAuth(request);
    const { id, memberId } = await params;

    const myMembership = await prisma.groupMember.findUnique({
      where: { userId_groupId: { userId: user.id, groupId: id } },
    });

    if (!myMembership || !["owner", "admin"].includes(myMembership.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const targetMembership = await prisma.groupMember.findUnique({
      where: { userId_groupId: { userId: memberId, groupId: id } },
    });

    if (!targetMembership) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    // Can't remove owner
    if (targetMembership.role === "owner") {
      return NextResponse.json(
        { error: "Cannot remove owner" },
        { status: 400 },
      );
    }

    // Admin can't remove other admins (only owner can)
    if (myMembership.role === "admin" && targetMembership.role === "admin") {
      return NextResponse.json(
        { error: "Admins cannot remove other admins" },
        { status: 403 },
      );
    }

    await prisma.groupMember.delete({
      where: { userId_groupId: { userId: memberId, groupId: id } },
    });

    return NextResponse.json({ message: "Member removed" });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Remove member error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

// PATCH /api/groups/[id]/members/[memberId] - Update member role (owner only)
export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const user = await requireAuth(request);
    const { id, memberId } = await params;

    const myMembership = await prisma.groupMember.findUnique({
      where: { userId_groupId: { userId: user.id, groupId: id } },
    });

    if (!myMembership || myMembership.role !== "owner") {
      return NextResponse.json(
        { error: "Only owner can change roles" },
        { status: 403 },
      );
    }

    const body = await request.json();
    const { role } = body;

    if (!["member", "admin"].includes(role)) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    }

    const member = await prisma.groupMember.update({
      where: { userId_groupId: { userId: memberId, groupId: id } },
      data: { role },
      include: {
        user: {
          select: { id: true, username: true, avatarUrl: true },
        },
      },
    });

    return NextResponse.json({ member });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Update role error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
