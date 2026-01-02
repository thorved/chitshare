import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

interface RouteParams {
  params: Promise<{ userId: string }>;
}

// GET /api/messages/dm/[userId] - Get DM conversation with user
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const currentUser = await requireAuth(request);
    const { userId } = await params;

    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);
    const cursor = searchParams.get("cursor"); // Message ID for pagination

    // Check if target user exists
    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, username: true, avatarUrl: true, isOnline: true },
    });

    if (!targetUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Get messages between users
    const messages = await prisma.message.findMany({
      where: {
        groupId: null,
        OR: [
          { senderId: currentUser.id, receiverId: userId },
          { senderId: userId, receiverId: currentUser.id },
        ],
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

    // Mark received messages as read
    await prisma.message.updateMany({
      where: {
        senderId: userId,
        receiverId: currentUser.id,
        isRead: false,
      },
      data: { isRead: true },
    });

    return NextResponse.json({
      user: targetUser,
      messages: messages.reverse(), // Return in chronological order
      hasMore: messages.length === limit,
    });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Get DM error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

// POST /api/messages/dm/[userId] - Send DM to user
export async function POST(request: Request, { params }: RouteParams) {
  try {
    const currentUser = await requireAuth(request);
    const { userId } = await params;

    const body = await request.json();
    const { content, type = "text" } = body;

    if (!content) {
      return NextResponse.json(
        { error: "Content is required" },
        { status: 400 },
      );
    }

    // Check if target user exists
    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!targetUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Create message
    const message = await prisma.message.create({
      data: {
        content,
        type,
        senderId: currentUser.id,
        receiverId: userId,
      },
      include: {
        sender: {
          select: { id: true, username: true, avatarUrl: true },
        },
      },
    });

    return NextResponse.json({ message }, { status: 201 });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Send DM error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
