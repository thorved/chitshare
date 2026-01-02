import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

// GET /api/groups - List user's groups
export async function GET(request: Request) {
  try {
    const user = await requireAuth(request);

    const memberships = await prisma.groupMember.findMany({
      where: { userId: user.id },
      include: {
        group: {
          include: {
            members: {
              select: { userId: true, role: true },
            },
            _count: {
              select: { messages: true },
            },
          },
        },
      },
      orderBy: { group: { updatedAt: "desc" } },
    });

    const groups = memberships.map((m) => ({
      ...m.group,
      myRole: m.role,
      memberCount: m.group.members.length,
    }));

    return NextResponse.json({ groups });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("List groups error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

// POST /api/groups - Create new group
export async function POST(request: Request) {
  try {
    const user = await requireAuth(request);

    const body = await request.json();
    const { name, description, memberIds = [] } = body;

    if (!name) {
      return NextResponse.json(
        { error: "Group name is required" },
        { status: 400 },
      );
    }

    // Create group with creator as owner
    const group = await prisma.group.create({
      data: {
        name,
        description,
        members: {
          create: [
            { userId: user.id, role: "owner" },
            ...memberIds.map((id: string) => ({ userId: id, role: "member" })),
          ],
        },
      },
      include: {
        members: {
          include: {
            user: {
              select: { id: true, username: true, avatarUrl: true },
            },
          },
        },
      },
    });

    return NextResponse.json({ group }, { status: 201 });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Create group error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
