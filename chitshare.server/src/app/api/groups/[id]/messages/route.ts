import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/groups/[id]/messages - Get group messages
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const user = await requireAuth(request);
    const { id } = await params;

    // Check membership
    const membership = await prisma.groupMember.findUnique({
      where: { userId_groupId: { userId: user.id, groupId: id } },
    });

    if (!membership) {
      return NextResponse.json({ error: "Not a member" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);
    const cursor = searchParams.get("cursor"); // ISO date string for pagination

    const messages = await prisma.message.findMany({
      where: {
        groupId: id,
        ...(cursor && { createdAt: { lt: new Date(cursor) } }),
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      include: {
        sender: {
          select: { id: true, username: true, avatarUrl: true },
        },
      },
    });

    return NextResponse.json({
      messages: messages.reverse(), // Return chronological order
      hasMore: messages.length === limit,
    });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Get group messages error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

// POST /api/groups/[id]/messages - Send group message
export async function POST(request: Request, { params }: RouteParams) {
  try {
    const user = await requireAuth(request);
    const { id } = await params;

    // Check membership
    const membership = await prisma.groupMember.findUnique({
      where: { userId_groupId: { userId: user.id, groupId: id } },
    });

    if (!membership) {
      return NextResponse.json({ error: "Not a member" }, { status: 403 });
    }

    const body = await request.json();
    const { content, type = "text" } = body;

    if (!content) {
      return NextResponse.json(
        { error: "Content is required" },
        { status: 400 },
      );
    }

    const message = await prisma.message.create({
      data: {
        content,
        type,
        senderId: user.id,
        groupId: id,
      },
      include: {
        sender: {
          select: { id: true, username: true, avatarUrl: true },
        },
      },
    });

    // Update group timestamp
    await prisma.group.update({
      where: { id },
      data: { updatedAt: new Date() },
    });

    return NextResponse.json({ message }, { status: 201 });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Send group message error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
