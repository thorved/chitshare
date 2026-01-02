import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/db";
import ChatSidebar from "./components/chat-sidebar";
import MobileNav from "./components/mobile-nav";

export default async function ChatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Check authentication
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

  // Update online status
  await prisma.user.update({
    where: { id: user.id },
    data: { isOnline: true, lastSeen: new Date() },
  });

  return (
    <div className="h-screen flex overflow-hidden">
      {/* Sidebar - hidden on mobile, shown on md+ */}
      <div className="hidden md:block">
        <ChatSidebar user={user} />
      </div>
      <main className="flex-1 min-h-0 flex flex-col overflow-hidden pb-14 md:pb-0">
        {children}
      </main>
      {/* Mobile bottom nav */}
      <MobileNav />
    </div>
  );
}
