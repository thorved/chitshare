"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams } from "next/navigation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MessageContent, isCodeMessage } from "@/components/MessageContent";
import { FileMessage } from "@/components/FileMessage";
import {
  Send,
  ArrowLeft,
  MoreVertical,
  ChevronDown,
  Loader2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { useUser } from "../../user-context";
import { saveMessages, getCachedMessages, Message as StorageMessage } from "@/lib/chat-storage";

interface Message extends StorageMessage {}

interface UserInfo {
  id: string;
  username: string;
  avatarUrl: string | null;
  isOnline: boolean;
}

export default function DirectMessagePage() {
  const params = useParams();
  const userId = params.userId as string;
  const user = useUser();
  const currentUserId = user.id;

  const [messages, setMessages] = useState<Message[]>([]);
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [hasNewMessages, setHasNewMessages] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const isInitialLoad = useRef(true);
  const prevMessageCount = useRef(0);

  // Get auth token
  const getToken = useCallback(() => {
    return document.cookie
      .split("; ")
      .find((row) => row.startsWith("auth_token="))
      ?.split("=")[1];
  }, []);

  // Load cached messages first
  useEffect(() => {
    const cached = getCachedMessages(currentUserId, userId);
    if (cached.length > 0) {
      setMessages(cached);
      setLoading(false);
      // Wait for render then scroll
      setTimeout(scrollToBottom, 50);
    }
  }, [currentUserId, userId]);

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

  // Fetch messages
  const fetchMessages = useCallback(
    async (cursor?: string) => {
      if (!currentUserId) return;

      try {
        const url = new URL(
          `/api/messages/dm/${userId}`,
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
            // Initial load or refresh - check for new messages
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
              // Create a map of existing IDs to avoid duplicates if server caught up
              const newMsgIds = new Set(newMsgs.map((m: Message) => m.id));
              const uniquePending = pendingMessages.filter(m => !newMsgIds.has(m.id));
              
              const combined = [...newMsgs, ...uniquePending];
              // Save to local storage (only successful ones essentially, but let's save what we have)
              saveMessages(currentUserId, userId, combined.filter((m: Message) => m.status !== 'error'));
              return combined;
            });
            
            setUserInfo(data.user);

            // Scroll to bottom on initial load
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
    [userId, currentUserId, getToken],
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

  // Fetch messages when currentUserId is ready
  useEffect(() => {
    if (currentUserId) {
      fetchMessages();
    }
  }, [currentUserId, fetchMessages]);

  // Poll for new messages every 3 seconds
  useEffect(() => {
    if (!currentUserId) return;

    const interval = setInterval(() => fetchMessages(), 3000);
    return () => clearInterval(interval);
  }, [currentUserId, fetchMessages]);

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

  // Scroll to bottom
  function scrollToBottom() {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop =
        messagesContainerRef.current.scrollHeight;
    }
    setHasNewMessages(false);
  }

  // Send message
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
        username: "", // Optimistic placeholder
        avatarUrl: null 
      },
      createdAt: new Date().toISOString(),
      status: "sending"
    };

    setMessages((prev) => {
      const updated = [...prev, optimisticMessage];
      saveMessages(currentUserId!, userId, updated);
      return updated;
    });
    setNewMessage("");
    setTimeout(scrollToBottom, 50);

    try {
      const res = await fetch(`/api/messages/dm/${userId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ content: messageContent }),
      });

      if (res.ok) {
        const data = await res.json();
        // Replace optimistic message with real one
        setMessages((prev) => {
           // Check if this message already exists (e.g. from a poll)
           const exists = prev.some(msg => msg.id === data.message.id);
           let updated;
           if (exists) {
             // If it exists, remove the optimistic one
             updated = prev.filter(msg => msg.id !== tempId);
           } else {
             // Otherwise replace it
             updated = prev.map((msg) => msg.id === tempId ? { ...data.message, status: 'sent' } : msg);
           }
           saveMessages(currentUserId!, userId, updated);
           return updated;
        });
        prevMessageCount.current += 1;
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to send message");
        // Mark as error
        setMessages((prev) => 
          prev.map((msg) => msg.id === tempId ? { ...msg, status: 'error' } : msg)
        );
      }
    } catch (error) {
      console.error("Failed to send message:", error);
      toast.error("Failed to send message");
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

  // Drag and drop handlers
  function handleDragEnter(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.types.includes("Files")) {
      setIsDragOver(true);
    }
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    // Only set false if leaving the main container
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    if (
      e.clientX <= rect.left ||
      e.clientX >= rect.right ||
      e.clientY <= rect.top ||
      e.clientY >= rect.bottom
    ) {
      setIsDragOver(false);
    }
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
  }

  async function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const files = e.dataTransfer.files;
    if (files.length === 0) return;

    // Upload first file (could extend to multiple)
    await uploadFile(files[0]);
  }

  async function uploadFile(file: File) {
    if (uploading) return;

    const tempId = `file-${Date.now()}`;

    // Create optimistic message
    const optimisticMessage: Message = {
      id: tempId,
      content: file.name,
      type: "file",
      senderId: currentUserId!,
      sender: {
        id: currentUserId!,
        username: "",
        avatarUrl: null,
      },
      createdAt: new Date().toISOString(),
      status: "sending",
    };

    setMessages((prev) => [...prev, optimisticMessage]);
    setTimeout(scrollToBottom, 50);
    setUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("recipientId", userId);

      const res = await fetch("/api/files/upload", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${getToken()}`,
        },
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        // Replace optimistic message with real one
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === tempId ? { ...data.message, status: "sent" } : msg
          )
        );
        prevMessageCount.current += 1;
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to upload file");
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === tempId ? { ...msg, status: "error" } : msg
          )
        );
      }
    } catch (error) {
      console.error("Upload error:", error);
      toast.error("Failed to upload file");
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === tempId ? { ...msg, status: "error" } : msg
        )
      );
    } finally {
      setUploading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-muted-foreground">Loading conversation...</p>
      </div>
    );
  }

  return (
    <div 
      className="flex-1 min-h-0 flex flex-col h-full relative"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Drop zone overlay */}
      {isDragOver && (
        <div className="absolute inset-0 bg-primary/10 border-2 border-dashed border-primary rounded-lg z-50 flex items-center justify-center pointer-events-none">
          <div className="flex flex-col items-center gap-2 text-primary">
            <Upload className="w-12 h-12" />
            <p className="text-lg font-medium">Drop file to send</p>
          </div>
        </div>
      )}
      {/* Header */}
      <div className="border-b border-border p-3 md:p-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2 md:gap-3">
          <Button variant="ghost" size="icon" asChild className="md:hidden">
            <Link href="/chat">
              <ArrowLeft className="w-5 h-5" />
            </Link>
          </Button>
          <div className="relative">
            <Avatar className="w-8 h-8 md:w-10 md:h-10">
              <AvatarImage src={userInfo?.avatarUrl || undefined} />
              <AvatarFallback>
                {userInfo?.username?.[0]?.toUpperCase() || "?"}
              </AvatarFallback>
            </Avatar>
            {userInfo?.isOnline && (
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 md:w-3 md:h-3 bg-green-500 rounded-full border-2 border-background" />
            )}
          </div>
          <div>
            <p className="font-semibold text-sm md:text-base">
              {userInfo?.username}
            </p>
            <p className="text-xs text-muted-foreground">
              {userInfo?.isOnline ? "Online" : "Offline"}
            </p>
          </div>
        </div>
        <Button variant="ghost" size="icon">
          <MoreVertical className="w-5 h-5" />
        </Button>
      </div>

      {/* Messages - with proper height constraint for scrolling */}
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
                <p className="text-sm">
                  Send a message to start the conversation
                </p>
              </div>
            ) : (
              messages.map((msg) => {
                const isOwn =
                  msg.sender?.id === currentUserId ||
                  msg.senderId === currentUserId;
                const isCode = msg.type !== "file" && isCodeMessage(msg.content);
                const isFile = msg.type === "file";
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
                        isCode || isFile
                          ? ""
                          : `rounded-2xl px-3 py-2 md:px-4 md:py-2 ${
                              isOwn
                                ? "bg-primary text-primary-foreground rounded-br-md"
                                : "bg-muted rounded-bl-md"
                            }`
                      } ${msg.status === "sending" ? "opacity-70" : ""} ${msg.status === "error" ? "border border-destructive bg-destructive/10 text-destructive" : ""}`}
                    >
                      {isFile && (msg as any).file ? (
                        <FileMessage file={(msg as any).file} isOwn={isOwn} />
                      ) : (
                        <MessageContent content={msg.content} isOwn={isOwn} />
                      )}
                      <p
                        className={`text-[10px] md:text-xs mt-1 ${
                          isOwn
                            ? isCode || isFile ? "text-muted-foreground text-right" : "text-primary-foreground/70 text-right"
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
