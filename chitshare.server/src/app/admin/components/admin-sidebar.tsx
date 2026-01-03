"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Users,
  MessageSquare,
  LogOut,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const sidebarLinks = [
  {
    title: "Dashboard",
    href: "/admin",
    icon: LayoutDashboard,
  },
  {
    title: "Users",
    href: "/admin/users",
    icon: Users,
  },
  {
    title: "Groups",
    href: "/admin/groups",
    icon: MessageSquare,
  },
];

interface AdminSidebarProps {
  user: {
    username: string;
    email: string;
  };
}

export function AdminSidebar({ user }: AdminSidebarProps) {
  const pathname = usePathname();

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      <div className="p-6 border-b border-sidebar-border">
        <h1 className="text-xl font-bold">ChitShare Admin</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Welcome, {user.username}
        </p>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {sidebarLinks.map((link) => {
          const isActive = pathname === link.href;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-md transition-colors",
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
              )}
            >
              <link.icon className="w-5 h-5" />
              {link.title}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-sidebar-border">
        <form action="/api/admin/logout" method="POST">
          <Button
            variant="ghost"
            className="w-full justify-start gap-3 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            type="submit"
          >
            <LogOut className="w-5 h-5" />
            Logout
          </Button>
        </form>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 flex-col border-r border-sidebar-border bg-sidebar fixed inset-y-0 left-0 z-30">
        <SidebarContent />
      </aside>

      {/* Mobile Bottom Navigation */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-background border-t border-border z-50 flex justify-around items-center p-2 pb-safe">
        {sidebarLinks.map((link) => {
          const isActive = pathname === link.href;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "flex flex-col items-center justify-center p-2 rounded-lg transition-colors min-w-[64px]",
                isActive
                  ? "text-primary"
                  : "text-muted-foreground hover:text-primary"
              )}
            >
              <link.icon className="w-6 h-6 mb-1" />
              <span className="text-xs font-medium">{link.title}</span>
            </Link>
          );
        })}
         <Link
            href="/api/admin/logout" // This might need to be a form submission or handle differently, but for navigating to a logout handler or profile:
            // For now, let's just make it a profile/logout button that submits the form if we want, or opens a menu.
            // Simpler mobile logout: A profile icon that could link to a profile or logout.
            // Let's keep it simple and just add a logout button that looks like a nav item for now, or maybe a dedicated profile tab.
            // Given the constraints, let's submit the logout form via a button that looks like a link.
             className="flex flex-col items-center justify-center p-2 rounded-lg text-muted-foreground hover:text-destructive min-w-[64px]"
             onClick={(e) => {
               e.preventDefault();
               const form = document.createElement('form');
               form.method = 'POST';
               form.action = '/api/admin/logout';
               document.body.appendChild(form);
               form.submit();
             }}
          >
            <LogOut className="w-6 h-6 mb-1" />
             <span className="text-xs font-medium">Logout</span>
          </Link>
      </div>
    </>
  );
}
