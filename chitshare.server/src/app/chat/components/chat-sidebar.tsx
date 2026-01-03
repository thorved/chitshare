"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  MessageSquare,
  Users,
  Plus,
  LogOut,
  Settings,
  Search,
} from "lucide-react";
import { toast } from "sonner";

interface User {
  id: string;
  username: string;
  email: string;
  avatarUrl: string | null;
  isAdmin: boolean;
}

interface Conversation {
  user: {
    id: string;
    username: string;
    avatarUrl: string | null;
    isOnline: boolean;
  };
  lastMessage: {
    content: string;
    createdAt: string;
  };
  unreadCount: number;
}

interface Group {
  id: string;
  name: string;
  avatarUrl: string | null;
  myRole: string;
  memberCount: number;
}

export default function ChatSidebar({ user }: { user: User }) {
  const pathname = usePathname();
  const router = useRouter();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [activeTab, setActiveTab] = useState<"dms" | "groups">("dms");
  const [search, setSearch] = useState("");
  
  // Track previous conversations to detect new messages
  const prevConversationsRef = useRef<Map<string, string>>(new Map());
  const isInitialLoad = useRef(true);

  const getToken = useCallback(() => {
    return document.cookie
      .split("; ")
      .find((row) => row.startsWith("auth_token="))
      ?.split("=")[1];
  }, []);

  const fetchConversations = useCallback(async () => {
    try {
      const res = await fetch("/api/messages/conversations", {
        headers: { Authorization: `Bearer ${getToken()}` },
      });

      if (res.ok) {
        const data = await res.json();
        const newConversations: Conversation[] = data.conversations || [];
        
        // Check for new messages in non-active chats
        if (!isInitialLoad.current) {
          newConversations.forEach((conv) => {
            const prevTimestamp = prevConversationsRef.current.get(conv.user.id);
            const currentTimestamp = conv.lastMessage?.createdAt;
            const isActiveChat = pathname === `/chat/dm/${conv.user.id}`;
            
            // If there's a new message and we're not in that chat
            if (currentTimestamp && prevTimestamp && currentTimestamp !== prevTimestamp && !isActiveChat) {
              const messagePreview = conv.lastMessage.content.length > 50 
                ? conv.lastMessage.content.substring(0, 50) + "..." 
                : conv.lastMessage.content;
              
              toast(`New message from ${conv.user.username}`, {
                description: messagePreview,
                action: {
                  label: "View",
                  onClick: () => router.push(`/chat/dm/${conv.user.id}`),
                },
                duration: 5000,
              });
            }
          });
        }
        
        // Update the ref with current timestamps
        const newMap = new Map<string, string>();
        newConversations.forEach((conv) => {
          if (conv.lastMessage?.createdAt) {
            newMap.set(conv.user.id, conv.lastMessage.createdAt);
          }
        });
        prevConversationsRef.current = newMap;
        isInitialLoad.current = false;
        
        setConversations(newConversations);
      }
    } catch (error) {
      console.error("Failed to fetch conversations:", error);
    }
  }, [getToken, pathname, router]);

  useEffect(() => {
    fetchConversations();
    fetchGroups();
  }, [fetchConversations]);

  // Poll for new messages every 3 seconds
  useEffect(() => {
    const interval = setInterval(fetchConversations, 3000);
    return () => clearInterval(interval);
  }, [fetchConversations]);


  async function fetchGroups() {
    try {
      const token = document.cookie
        .split("; ")
        .find((row) => row.startsWith("auth_token="))
        ?.split("=")[1];

      const res = await fetch("/api/groups", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        setGroups(data.groups || []);
      }
    } catch (error) {
      console.error("Failed to fetch groups:", error);
    }
  }

  async function handleLogout() {
    document.cookie = "auth_token=; path=/; max-age=0";
    window.location.href = "/login";
  }

  const filteredConversations = conversations.filter((c) =>
    c.user.username.toLowerCase().includes(search.toLowerCase()),
  );

  const filteredGroups = groups.filter((g) =>
    g.name.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <aside className="w-80 border-r border-border flex flex-col bg-card h-full" suppressHydrationWarning>
      {/* Header with user info and actions */}
      <div className="p-3 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Avatar className="w-9 h-9">
            <AvatarImage src={user.avatarUrl || undefined} />
            <AvatarFallback className="text-sm">
              {user.username[0].toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="font-medium text-sm truncate">{user.username}</p>
            <p className="text-xs text-muted-foreground truncate">
              {user.email}
            </p>
          </div>
        </div>
        <div className="flex gap-0.5">
          {user.isAdmin && (
            <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
              <Link href="/admin">
                <Settings className="w-4 h-4" />
              </Link>
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={handleLogout}
          >
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* New Conversation Button - AT TOP */}
      <div className="p-3 border-b border-border">
        <Button asChild className="w-full" size="sm">
          <Link href="/chat/new">
            <Plus className="w-4 h-4 mr-2" />
            New Conversation
          </Link>
        </Button>
      </div>

      {/* Search */}
      <div className="p-3 border-b border-border">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-9"
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border">
        <button
          onClick={() => setActiveTab("dms")}
          className={`flex-1 py-2.5 text-sm font-medium flex items-center justify-center gap-1.5 transition-colors ${
            activeTab === "dms"
              ? "text-foreground border-b-2 border-primary bg-muted/30"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/20"
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          Messages
        </button>
        <button
          onClick={() => setActiveTab("groups")}
          className={`flex-1 py-2.5 text-sm font-medium flex items-center justify-center gap-1.5 transition-colors ${
            activeTab === "groups"
              ? "text-foreground border-b-2 border-primary bg-muted/30"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/20"
          }`}
        >
          <Users className="w-4 h-4" />
          Groups
        </button>
      </div>

      {/* Conversations/Groups List */}
      <ScrollArea className="flex-1">
        {activeTab === "dms" ? (
          <div className="p-2">
            {filteredConversations.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p className="font-medium">No conversations</p>
                <p className="text-xs mt-1">Start chatting with someone!</p>
              </div>
            ) : (
              filteredConversations.map((conv) => (
                <Link
                  key={conv.user.id}
                  href={`/chat/dm/${conv.user.id}`}
                  className={`flex items-center gap-2.5 p-2.5 rounded-lg transition-colors mb-1 ${
                    pathname === `/chat/dm/${conv.user.id}`
                      ? "bg-accent"
                      : "hover:bg-accent/50"
                  }`}
                >
                  <div className="relative shrink-0">
                    <Avatar className="w-9 h-9">
                      <AvatarImage src={conv.user.avatarUrl || undefined} />
                      <AvatarFallback className="text-sm">
                        {conv.user.username[0].toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    {conv.user.isOnline && (
                      <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-card" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium text-sm truncate">
                        {conv.user.username}
                      </p>
                      {conv.unreadCount > 0 && (
                        <Badge
                          variant="default"
                          className="text-[10px] h-5 px-1.5"
                        >
                          {conv.unreadCount}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {conv.lastMessage.content}
                    </p>
                  </div>
                </Link>
              ))
            )}
          </div>
        ) : (
          <div className="p-2">
            {/* Create Group - also at top of groups */}
            <Link
              href="/chat/groups/new"
              className="flex items-center gap-2.5 p-2.5 rounded-lg hover:bg-accent/50 transition-colors mb-2 border border-dashed border-border"
            >
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Plus className="w-4 h-4 text-primary" />
              </div>
              <span className="text-sm font-medium">Create Group</span>
            </Link>

            {filteredGroups.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground text-sm">
                <Users className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p className="font-medium">No groups yet</p>
              </div>
            ) : (
              filteredGroups.map((group) => (
                <Link
                  key={group.id}
                  href={`/chat/groups/${group.id}`}
                  className={`flex items-center gap-2.5 p-2.5 rounded-lg transition-colors mb-1 ${
                    pathname === `/chat/groups/${group.id}`
                      ? "bg-accent"
                      : "hover:bg-accent/50"
                  }`}
                >
                  <Avatar className="w-9 h-9 shrink-0">
                    <AvatarImage src={group.avatarUrl || undefined} />
                    <AvatarFallback className="text-sm">
                      {group.name[0].toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{group.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {group.memberCount} members
                    </p>
                  </div>
                </Link>
              ))
            )}
          </div>
        )}
      </ScrollArea>
    </aside>
  );
}
