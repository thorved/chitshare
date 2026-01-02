import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

// GET /api/messages/conversations - List all DM conversations
export async function GET(request: Request) {
  try {
    const user = await requireAuth(request);

    // Get distinct conversations (users that have DM'd with current user)
    const messages = await prisma.message.findMany({
      where: {
        groupId: null, // Only DMs
        OR: [{ senderId: user.id }, { receiverId: user.id }],
      },
      orderBy: { createdAt: "desc" },
      include: {
        sender: {
          select: { id: true, username: true, avatarUrl: true, isOnline: true },
        },
        receiver: {
          select: { id: true, username: true, avatarUrl: true, isOnline: true },
        },
      },
    });

    // Build unique conversations with last message
    const conversationsMap = new Map<
      string,
      {
        user: {
          id: string;
          username: string;
          avatarUrl: string | null;
          isOnline: boolean;
        };
        lastMessage: (typeof messages)[0];
        unreadCount: number;
      }
    >();

    for (const msg of messages) {
      const otherUser = msg.senderId === user.id ? msg.receiver : msg.sender;
      if (!otherUser) continue;

      if (!conversationsMap.has(otherUser.id)) {
        // Count unread messages from this user
        const unreadCount = await prisma.message.count({
          where: {
            senderId: otherUser.id,
            receiverId: user.id,
            isRead: false,
          },
        });

        conversationsMap.set(otherUser.id, {
          user: otherUser,
          lastMessage: msg,
          unreadCount,
        });
      }
    }

    const conversations = Array.from(conversationsMap.values());

    return NextResponse.json({ conversations });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Conversations error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
