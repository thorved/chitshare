import * as vscode from 'vscode';
import { ApiClient, User } from './ApiClient';

export interface Conversation {
    user: {
        id: string;
        username: string;
        avatarUrl: string | null;
        isOnline: boolean;
    };
    lastMessage: {
        id: string;
        content: string;
        createdAt: string;
        senderId: string;
    };
    unreadCount: number;
}

export interface Group {
    id: string;
    name: string;
    description: string | null;
    avatarUrl: string | null;
    myRole: string;
    memberCount: number;
    updatedAt: string;
}

export interface Message {
    id: string;
    content: string;
    type: string;
    createdAt: string;
    sender: {
        id: string;
        username: string;
        avatarUrl: string | null;
    };
    file?: {
        id: string;
        originalName: string;
        mimeType: string;
        size: number;
    };
}

export interface ChatTarget {
    type: 'dm' | 'group';
    id: string;
    name: string;
    avatarUrl?: string | null;
    isOnline?: boolean;
}

export class ChatManager {
    private apiClient: ApiClient;
    private pollTimer: NodeJS.Timeout | null = null;
    private currentChat: ChatTarget | null = null;
    private knownMessageIds: Set<string> = new Set();
    private onMessagesUpdateCallback: ((messages: Message[]) => void) | null = null;
    private onNewMessagesCallback: ((messages: Message[]) => void) | null = null;
    private onNotificationCallback: ((message: Message, chatName: string) => void) | null = null;
    private onConversationsUpdateCallback: ((conversations: Conversation[], groups: Group[]) => void) | null = null;

    constructor(apiClient: ApiClient) {
        this.apiClient = apiClient;
    }

    /**
     * Get all DM conversations
     */
    async getConversations(): Promise<Conversation[]> {
        const response = await this.apiClient.request<{ conversations: Conversation[] }>(
            '/api/messages/conversations'
        );
        return response.conversations;
    }

    /**
     * Get all groups the user is a member of
     */
    async getGroups(): Promise<Group[]> {
        const response = await this.apiClient.request<{ groups: Group[] }>('/api/groups');
        return response.groups;
    }

    /**
     * Get users list for starting new conversations
     */
    async getUsers(search?: string): Promise<User[]> {
        const query = search ? `?search=${encodeURIComponent(search)}` : '';
        const response = await this.apiClient.request<{ users: User[] }>(`/api/users${query}`);
        return response.users;
    }

    /**
     * Get messages for a DM conversation
     */
    async getDMMessages(userId: string, cursor?: string): Promise<{ user: User; messages: Message[]; hasMore: boolean }> {
        const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : '';
        const response = await this.apiClient.request<{
            user: User;
            messages: Message[];
            hasMore: boolean;
        }>(`/api/messages/dm/${userId}${query}`);
        return response;
    }

    /**
     * Get messages for a group
     */
    async getGroupMessages(groupId: string, cursor?: string): Promise<{ messages: Message[]; hasMore: boolean }> {
        const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : '';
        const response = await this.apiClient.request<{
            messages: Message[];
            hasMore: boolean;
        }>(`/api/groups/${groupId}/messages${query}`);
        return response;
    }

    /**
     * Send a DM message
     */
    async sendDM(userId: string, content: string): Promise<Message> {
        const response = await this.apiClient.request<{ message: Message }>(
            `/api/messages/dm/${userId}`,
            {
                method: 'POST',
                body: { content, type: 'text' },
            }
        );
        // Track this message immediately to avoid duplicate
        this.knownMessageIds.add(response.message.id);
        return response.message;
    }

    /**
     * Send a group message
     */
    async sendGroupMessage(groupId: string, content: string): Promise<Message> {
        const response = await this.apiClient.request<{ message: Message }>(
            `/api/groups/${groupId}/messages`,
            {
                method: 'POST',
                body: { content, type: 'text' },
            }
        );
        // Track this message immediately to avoid duplicate
        this.knownMessageIds.add(response.message.id);
        return response.message;
    }

    /**
     * Send message to current chat
     */
    async sendMessage(content: string): Promise<Message | null> {
        if (!this.currentChat) {
            return null;
        }

        if (this.currentChat.type === 'dm') {
            return this.sendDM(this.currentChat.id, content);
        } else {
            return this.sendGroupMessage(this.currentChat.id, content);
        }
    }

    /**
     * Delete a conversation
     */
    async deleteConversation(userId: string): Promise<void> {
        await this.apiClient.request(
            `/api/messages/conversations?targetUserId=${userId}`,
            {
                method: 'DELETE',
            }
        );
        
        // Clear local state if necessary, but polling will likely handle it.
        // However, if we are currently in that chat, we should probably clear it.
        if (this.currentChat && this.currentChat.type === 'dm' && this.currentChat.id === userId) {
            this.setCurrentChat(null);
        }
    }

    /**
     * Set current chat and start polling
     */
    setCurrentChat(chat: ChatTarget | null): void {
        this.currentChat = chat;
        // Keep polling even if left chat, but just for conversations list
        // However, we want to clear known messages if we switch chats
        if (chat) {
            this.knownMessageIds.clear();
        }
    }

    /**
     * Get current chat
     */
    getCurrentChat(): ChatTarget | null {
        return this.currentChat;
    }

    /**
     * Set callback for initial messages load (full render)
     */
    onMessagesUpdate(callback: (messages: Message[]) => void): void {
        this.onMessagesUpdateCallback = callback;
    }

    /**
     * Set callback for new messages (incremental update)
     */
    onNewMessages(callback: (messages: Message[]) => void): void {
        this.onNewMessagesCallback = callback;
    }

    /**
     * Set callback for notifications
     */
    onNotification(callback: (message: Message, chatName: string) => void): void {
        this.onNotificationCallback = callback;
    }

    /**
     * Set callback for conversations list update
     */
    onConversationsUpdate(callback: (conversations: Conversation[], groups: Group[]) => void): void {
        this.onConversationsUpdateCallback = callback;
    }

    /**
     * Initialize known messages (call after initial load)
     */
    initializeKnownMessages(messages: Message[]): void {
        this.knownMessageIds.clear();
        for (const msg of messages) {
            this.knownMessageIds.add(msg.id);
        }
    }

    /**
     * Add a single message to known messages
     */
    addKnownMessage(messageId: string): void {
        this.knownMessageIds.add(messageId);
    }

    /**
     * Start polling for new messages and conversations
     */
    startPolling(): void {
        // Prevent multiple intervals
        if (this.pollTimer) {
            return;
        }

        const config = vscode.workspace.getConfiguration('chitshare');
        const interval = config.get<number>('pollInterval', 5000);

        this.pollTimer = setInterval(async () => {
            try {
                // 1. Poll Conversations List (Status updates, unread counts)
                if (this.onConversationsUpdateCallback) {
                    const [conversations, groups] = await Promise.all([
                        this.getConversations(),
                        this.getGroups(),
                    ]);
                    this.onConversationsUpdateCallback(conversations, groups);
                }

                // 2. Poll Active Chat (New messages)
                if (this.currentChat) {
                    let messages: Message[];
                    if (this.currentChat.type === 'dm') {
                        const result = await this.getDMMessages(this.currentChat.id);
                        messages = result.messages;
                    } else {
                        const result = await this.getGroupMessages(this.currentChat.id);
                        messages = result.messages;
                    }

                    // Find new messages
                    const newMessages = messages.filter(m => !this.knownMessageIds.has(m.id));

                    if (newMessages.length > 0) {
                        // Track new messages
                        for (const msg of newMessages) {
                            this.knownMessageIds.add(msg.id);
                        }

                        // Send incremental update (no flicker)
                        if (this.onNewMessagesCallback) {
                            this.onNewMessagesCallback(newMessages);
                        }

                        // Send notification for messages from others
                        if (this.onNotificationCallback && this.currentChat) {
                            for (const msg of newMessages) {
                                // Don't notify for own messages
                                const currentUser = await this.apiClient.getCurrentUser();
                                if (currentUser && msg.sender.id !== currentUser.id) {
                                    this.onNotificationCallback(msg, this.currentChat.name);
                                }
                            }
                        }
                    }
                }
            } catch (error) {
                console.error('Polling error:', error);
            }
        }, interval);
    }

    /**
     * Stop polling
     */
    stopPolling(): void {
        if (this.pollTimer) {
            clearInterval(this.pollTimer);
            this.pollTimer = null;
        }
    }

    /**
     * Dispose resources
     */
    dispose(): void {
        this.stopPolling();
    }
}
