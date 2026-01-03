"use client";

import { usePathname } from "next/navigation";
import ChatSidebar from "./chat-sidebar";
import MobileNav from "./mobile-nav";
import { User } from "@prisma/client";
import { UserProvider } from "../user-context";

interface ChatLayoutClientProps {
  children: React.ReactNode;
  user: Pick<User, "id" | "username" | "email" | "avatarUrl" | "isAdmin">;
}

export default function ChatLayoutClient({ children, user }: ChatLayoutClientProps) {
  const pathname = usePathname();

  // Check if we are in a specific chat (DM or Group)
  // We want to hide the bottom bar for:
  // - /chat/dm/[id]
  // - /chat/groups/[id] (but NOT /chat/groups/new)
  const isChatOpen = 
    pathname.includes("/dm/") || 
    (pathname.includes("/groups/") && !pathname.includes("/new"));

  return (
    <UserProvider user={user}>
      <div className="h-[100dvh] flex overflow-hidden">
        {/* Sidebar - hidden on mobile, shown on md+ */}
        <div className="hidden md:block">
          <ChatSidebar user={user} className="w-80" />
        </div>
        
        <main 
          className={`flex-1 min-h-0 flex flex-col overflow-hidden ${
            isChatOpen ? "pb-0" : "pb-14"
          } md:pb-0`}
        >
          {children}
        </main>
        
        {/* Mobile bottom nav - hidden when a chat is open */}
        {!isChatOpen && <MobileNav />}
      </div>
    </UserProvider>
  );
}
