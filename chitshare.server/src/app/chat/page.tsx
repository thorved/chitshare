import { MessageSquare, Plus } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/db";
import ChatSidebar from "./components/chat-sidebar";

export default async function ChatPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;

  if (!token) {
    redirect("/login");
  }

  const payload = verifyToken(token);
  if (!payload) {
    redirect("/login");
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: {
      id: true,
      username: true,
      email: true,
      avatarUrl: true,
      isAdmin: true,
    },
  });

  if (!user) {
    redirect("/login");
  }

  return (
    <>
      {/* Mobile: Show Chat List */}
      <div className="md:hidden flex-1 flex flex-col h-full">
        <ChatSidebar user={user} className="w-full border-none flex-1" />
      </div>

      {/* Desktop: Show Welcome Screen */}
      <div className="hidden md:flex flex-1 flex-col h-full">
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="text-center text-muted-foreground max-w-sm">
            <MessageSquare className="w-16 h-16 mx-auto mb-4 opacity-30" />
            <h2 className="text-xl font-medium mb-2">Welcome to ChitShare</h2>
            <p className="text-sm mb-6">
              Select a conversation from the sidebar or start a new chat
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
