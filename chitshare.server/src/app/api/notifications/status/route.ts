import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

// GET /api/notifications/status - Check for new messages since a timestamp
export async function GET(request: Request) {
  try {
    const currentUser = await requireAuth(request);
    
    const { searchParams } = new URL(request.url);
    const since = searchParams.get("since");

    if (!since) {
      // If no timestamp provided, just return false but give the current timestamp for sync
      return NextResponse.json({ 
        hasUpdates: false,
        timestamp: new Date().toISOString()
      });
    }

    const sinceDate = new Date(since);
    
    // Check for any messages where:
    // 1. Created after 'since'
    // 2. User is the receiver (DM) OR User is in the group (Group msg)
    // 3. OPTIONAL: User is sender (to see own messages from other sessions)
    
    // We can do this efficiently with a count
    const newMessageCount = await prisma.message.count({
      where: {
        createdAt: { gt: sinceDate },
        OR: [
          // DM received
          { receiverId: currentUser.id },
          // Group message (where user is a member)
          {
            group: {
              members: {
                some: {
                  userId: currentUser.id
                }
              }
            }
          },
          // Sent by me (for multi-session sync)
          { senderId: currentUser.id }
        ]
      }
    });

    const hasUpdates = newMessageCount > 0;
    
    return NextResponse.json({ 
      hasUpdates,
      timestamp: new Date().toISOString() 
    });

  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Notification status error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
