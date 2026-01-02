"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MessageSquare, Users, Plus, User } from "lucide-react";

export default function MobileNav() {
  const pathname = usePathname();

  const isActive = (path: string) => pathname.startsWith(path);

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-card border-t border-border z-50">
      <div className="flex items-center justify-around h-14">
        <Link
          href="/chat"
          className={`flex flex-col items-center justify-center py-2 px-4 ${
            pathname === "/chat" ? "text-primary" : "text-muted-foreground"
          }`}
        >
          <MessageSquare className="w-5 h-5" />
          <span className="text-[10px] mt-0.5">Chats</span>
        </Link>

        <Link
          href="/chat/groups/new"
          className={`flex flex-col items-center justify-center py-2 px-4 ${
            isActive("/chat/groups") ? "text-primary" : "text-muted-foreground"
          }`}
        >
          <Users className="w-5 h-5" />
          <span className="text-[10px] mt-0.5">Groups</span>
        </Link>

        <Link
          href="/chat/new"
          className="flex items-center justify-center w-12 h-12 -mt-4 rounded-full bg-primary text-primary-foreground shadow-lg"
        >
          <Plus className="w-6 h-6" />
        </Link>

        <Link
          href="/chat/new"
          className={`flex flex-col items-center justify-center py-2 px-4 ${
            pathname === "/chat/new" ? "text-primary" : "text-muted-foreground"
          }`}
        >
          <User className="w-5 h-5" />
          <span className="text-[10px] mt-0.5">Users</span>
        </Link>

        <Link
          href="/admin"
          className="flex flex-col items-center justify-center py-2 px-4 text-muted-foreground"
        >
          <User className="w-5 h-5" />
          <span className="text-[10px] mt-0.5">Profile</span>
        </Link>
      </div>
    </nav>
  );
}
