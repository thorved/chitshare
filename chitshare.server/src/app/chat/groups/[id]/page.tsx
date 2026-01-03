"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams } from "next/navigation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MessageContent, isCodeMessage } from "@/components/MessageContent";
import {
  Send,
  ArrowLeft,
  Users,
  MoreVertical,
  ChevronDown,
  Loader2,
} from "lucide-react";
import Link from "next/link";
import { useNotificationPolling } from "@/hooks/use-polling";

interface Message {
  id: string;
  content: string;
  type: string;
  senderId: string;
  sender: {
    id: string;
    username: string;
    avatarUrl: string | null;
  };
  createdAt: string;
  status?: "sending" | "sent" | "error";
}

interface GroupInfo {
  id: string;
  name: string;
  description: string | null;
  avatarUrl: string | null;
  members: Array<{
    user: {
      id: string;
      username: string;
      avatarUrl: string | null;
      isOnline: boolean;
    };
    role: string;
  }>;
}

export default function GroupChatPage() {
  const params = useParams();
  const groupId = params.id as string;

  const [messages, setMessages] = useState<Message[]>([]);
  const [groupInfo, setGroupInfo] = useState<GroupInfo | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [hasNewMessages, setHasNewMessages] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const isInitialLoad = useRef(true);
  const prevMessageCount = useRef(0);

  const getToken = useCallback(() => {
    return document.cookie
      .split("; ")
      .find((row) => row.startsWith("auth_token="))
      ?.split("=")[1];
  }, []);

  // Fetch current user FIRST
  useEffect(() => {
    async function init() {
      try {
        const res = await fetch("/api/auth/me", {
          headers: { Authorization: `Bearer ${getToken()}` },
        });
        if (res.ok) {
          const data = await res.json();
          setCurrentUserId(data.user.id);
        }
      } catch (error) {
        console.error("Failed to fetch current user:", error);
      }
    }
    init();
  }, [getToken]);

  const fetchGroup = useCallback(async () => {
    try {
      const res = await fetch(`/api/groups/${groupId}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (res.ok) {
        const data = await res.json();
        setGroupInfo(data.group);
      }
    } catch (error) {
      console.error("Failed to fetch group:", error);
    }
  }, [groupId, getToken]);

  // Check if user is scrolled to bottom
  function isAtBottom() {
    if (!messagesContainerRef.current) return true;
    const { scrollTop, scrollHeight, clientHeight } =
      messagesContainerRef.current;
    return scrollHeight - scrollTop - clientHeight < 100;
  }

  // Check if user is scrolled to top
  function isAtTop() {
    if (!messagesContainerRef.current) return false;
    return messagesContainerRef.current.scrollTop < 50;
  }

  const fetchMessages = useCallback(
    async (cursor?: string) => {
      if (!currentUserId) return;

      try {
        const url = new URL(
          `/api/groups/${groupId}/messages`,
          window.location.origin,
        );
        url.searchParams.set("limit", "30");
        if (cursor) {
          url.searchParams.set("cursor", cursor);
        }

        const res = await fetch(url.toString(), {
          headers: { Authorization: `Bearer ${getToken()}` },
        });

        if (res.ok) {
          const data = await res.json();
          const newMsgs = data.messages || [];

          if (cursor) {
            // Loading older messages - prepend them
            setMessages((prev) => [...newMsgs, ...prev]);
          } else {
            // Initial load or refresh
            if (
              newMsgs.length > prevMessageCount.current &&
              !isInitialLoad.current
            ) {
              if (!isAtBottom()) {
                setHasNewMessages(true);
              } else {
                setTimeout(scrollToBottom, 100);
              }
            }

            prevMessageCount.current = newMsgs.length;
            
            // Preserve local optimistic messages
            setMessages(prev => {
              const pendingMessages = prev.filter(m => m.status === 'sending' || m.status === 'error');
              const newMsgIds = new Set(newMsgs.map((m: Message) => m.id));
              const uniquePending = pendingMessages.filter(m => !newMsgIds.has(m.id));
              return [...newMsgs, ...uniquePending];
            });

            if (isInitialLoad.current) {
              isInitialLoad.current = false;
              setTimeout(scrollToBottom, 100);
            }
          }

          setHasMore(data.hasMore);
        }
      } catch (error) {
        console.error("Failed to fetch messages:", error);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [groupId, currentUserId, getToken],
  );

  // Load older messages when scrolling to top
  const loadOlderMessages = useCallback(async () => {
    if (!hasMore || loadingMore || messages.length === 0) return;

    setLoadingMore(true);
    const oldestMessage = messages[0];
    const scrollContainer = messagesContainerRef.current;
    const oldScrollHeight = scrollContainer?.scrollHeight || 0;

    await fetchMessages(oldestMessage.createdAt);

    // Maintain scroll position after loading older messages
    if (scrollContainer) {
      requestAnimationFrame(() => {
        const newScrollHeight = scrollContainer.scrollHeight;
        scrollContainer.scrollTop = newScrollHeight - oldScrollHeight;
      });
    }
  }, [hasMore, loadingMore, messages, fetchMessages]);

  useEffect(() => {
    if (currentUserId) {
      fetchGroup();
      fetchMessages();
    }
  }, [currentUserId, fetchGroup, fetchMessages]);

  // Poll for new messages efficiently
  useNotificationPolling({
    onUpdates: () => fetchMessages(),
    enabled: !!currentUserId,
    interval: 3000
  });

  // Handle scroll
  function handleScroll() {
    if (isAtBottom()) {
      setHasNewMessages(false);
    }

    // Load more when scrolled to top
    if (isAtTop() && hasMore && !loadingMore) {
      loadOlderMessages();
    }
  }

  function scrollToBottom() {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop =
        messagesContainerRef.current.scrollHeight;
    }
    setHasNewMessages(false);
  }

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!newMessage.trim()) return;

    const tempId = Date.now().toString();
    const messageContent = newMessage;

    // Create optimistic message
    const optimisticMessage: Message = {
      id: tempId,
      content: messageContent,
      type: "text",
      senderId: currentUserId!,
      sender: {
        id: currentUserId!,
        username: "", // Placeholder
        avatarUrl: null
      },
      createdAt: new Date().toISOString(),
      status: "sending"
    };

    setMessages((prev) => [...prev, optimisticMessage]);
    setNewMessage("");
    setTimeout(scrollToBottom, 50);

    try {
      const res = await fetch(`/api/groups/${groupId}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ content: messageContent }),
      });

      if (res.ok) {
        const data = await res.json();
        // Replace optimistic message
        setMessages((prev) => {
           const exists = prev.some(msg => msg.id === data.message.id);
           if (exists) {
             return prev.filter(msg => msg.id !== tempId);
           }
           return prev.map((msg) => msg.id === tempId ? { ...data.message, status: 'sent' } : msg);
        });
        prevMessageCount.current += 1;
      } else {
         // Mark as error
        setMessages((prev) => 
          prev.map((msg) => msg.id === tempId ? { ...msg, status: 'error' } : msg)
        );
      }
    } catch (error) {
      console.error("Failed to send message:", error);
      // Mark as error
      setMessages((prev) => 
        prev.map((msg) => msg.id === tempId ? { ...msg, status: 'error' } : msg)
      );
    } 
  }

  function formatTime(dateStr: string) {
    const date = new Date(dateStr);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  const onlineMembers =
    groupInfo?.members?.filter((m) => m.user.isOnline) || [];

  if (loading || !currentUserId) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-muted-foreground">Loading group...</p>
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col h-full">
      {/* Header */}
      <div className="border-b border-border p-3 md:p-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2 md:gap-3">
          <Button variant="ghost" size="icon" asChild className="md:hidden">
            <Link href="/chat">
              <ArrowLeft className="w-5 h-5" />
            </Link>
          </Button>
          <Avatar className="w-8 h-8 md:w-10 md:h-10">
            <AvatarImage src={groupInfo?.avatarUrl || undefined} />
            <AvatarFallback>
              {groupInfo?.name?.[0]?.toUpperCase() || "G"}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="font-semibold text-sm md:text-base">
              {groupInfo?.name}
            </p>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Users className="w-3 h-3" />
              {groupInfo?.members?.length || 0} members
              {onlineMembers.length > 0 && (
                <span className="text-green-500">
                  • {onlineMembers.length} online
                </span>
              )}
            </p>
          </div>
        </div>
        <Button variant="ghost" size="icon">
          <MoreVertical className="w-5 h-5" />
        </Button>
      </div>

      {/* Messages */}
      <div className="relative flex-1 min-h-0">
        <div
          ref={messagesContainerRef}
          onScroll={handleScroll}
          className="absolute inset-0 overflow-y-auto p-3 md:p-4"
        >
          {/* Loading older messages indicator */}
          {loadingMore && (
            <div className="flex justify-center py-2 mb-2">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          )}

          {/* Load more trigger */}
          {hasMore && !loadingMore && (
            <div className="flex justify-center py-2 mb-2">
              <button
                onClick={loadOlderMessages}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Load older messages
              </button>
            </div>
          )}

          <div className="space-y-3 md:space-y-4">
            {messages.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>No messages yet</p>
                <p className="text-sm">Be the first to send a message!</p>
              </div>
            ) : (
              messages.map((msg) => {
                const isOwn =
                  msg.sender?.id === currentUserId ||
                  msg.senderId === currentUserId;
                const isCode = isCodeMessage(msg.content);
                return (
                  <div
                    key={msg.id}
                    className={`flex gap-2 md:gap-3 ${isOwn ? "flex-row-reverse" : "flex-row"}`}
                  >
                    {!isOwn && (
                      <Avatar className="w-7 h-7 md:w-8 md:h-8 shrink-0">
                        <AvatarImage src={msg.sender?.avatarUrl || undefined} />
                        <AvatarFallback>
                          {msg.sender?.username?.[0]?.toUpperCase() || "?"}
                        </AvatarFallback>
                      </Avatar>
                    )}
                      <div
                        className={`max-w-[85%] md:max-w-[80%] ${
                          isCode
                            ? ""
                            : `rounded-2xl px-3 py-2 md:px-4 md:py-2 ${
                                isOwn
                                  ? "bg-primary text-primary-foreground rounded-br-md"
                                  : "bg-muted rounded-bl-md"
                              }`
                        } ${msg.status === "sending" ? "opacity-70" : ""} ${msg.status === "error" ? "border border-destructive bg-destructive/10 text-destructive" : ""}`}
                      >
                      {!isOwn && !isCode && (
                        <p className="text-xs font-medium text-primary mb-1">
                          {msg.sender?.username}
                        </p>
                      )}
                      <MessageContent content={msg.content} isOwn={isOwn} />
                      <p
                        className={`text-[10px] md:text-xs mt-1 ${
                          isOwn
                            ? isCode ? "text-muted-foreground text-right" : "text-primary-foreground/70 text-right"
                            : "text-muted-foreground"
                        }`}
                      >
                        {formatTime(msg.createdAt)}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* New messages indicator */}
        {hasNewMessages && (
          <button
            onClick={scrollToBottom}
            className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground px-4 py-2 rounded-full shadow-lg flex items-center gap-2 text-sm font-medium animate-bounce hover:bg-primary/90 transition-colors"
          >
            <ChevronDown className="w-4 h-4" />
            New messages
          </button>
        )}
      </div>

      {/* Message Input */}
      <div className="border-t border-border p-3 md:p-4 shrink-0">
        <form onSubmit={sendMessage} className="flex gap-2 items-end">
          <textarea
            placeholder="Type a message... (Shift+Enter for new line)"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendMessage(e);
              }
            }}
            rows={1}
            className="flex-1 text-sm md:text-base resize-none min-h-[40px] max-h-[200px] overflow-y-auto rounded-md border border-input bg-background px-3 py-2 ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            style={{
              height: "auto",
              minHeight: "40px",
            }}
            onInput={(e) => {
              const target = e.target as HTMLTextAreaElement;
              target.style.height = "auto";
              target.style.height = Math.min(target.scrollHeight, 200) + "px";
            }}
          />
          <Button
            type="submit"
            size="icon"
            disabled={sending || !newMessage.trim()}
            className="shrink-0"
          >
            <Send className="w-4 h-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}
