import { MessageSquare, Plus } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function ChatPage() {
  return (
    <div className="flex-1 flex flex-col">
      {/* Mobile header */}
      <div className="md:hidden border-b border-border p-4">
        <h1 className="text-lg font-semibold">ChitShare</h1>
      </div>

      {/* Welcome content */}
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="text-center text-muted-foreground max-w-sm">
          <MessageSquare className="w-16 h-16 mx-auto mb-4 opacity-30" />
          <h2 className="text-xl font-medium mb-2">Welcome to ChitShare</h2>
          <p className="text-sm mb-6">
            Select a conversation from the sidebar or start a new chat
          </p>

          {/* Mobile navigation buttons */}
          <div className="md:hidden space-y-3">
            <Button asChild className="w-full">
              <Link href="/chat/new">
                <Plus className="w-4 h-4 mr-2" />
                New Conversation
              </Link>
            </Button>
            <Button variant="outline" asChild className="w-full">
              <Link href="/chat/groups/new">Create Group</Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
