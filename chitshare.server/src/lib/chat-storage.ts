export interface Message {
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

const STORAGE_PREFIX = "chitshare_chat_";

function getStorageKey(userId: string, peerId: string) {
  return `${STORAGE_PREFIX}${userId}_${peerId}`;
}

export function saveMessages(userId: string, peerId: string, messages: Message[]) {
  try {
    const key = getStorageKey(userId, peerId);
    // Limit to latest 50 messages to save space
    const messagesToSave = messages.slice(-50);
    localStorage.setItem(key, JSON.stringify(messagesToSave));
  } catch (error) {
    console.warn("Failed to save messages to localStorage:", error);
  }
}

export function getCachedMessages(userId: string, peerId: string): Message[] {
  try {
    const key = getStorageKey(userId, peerId);
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.warn("Failed to load messages from localStorage:", error);
    return [];
  }
}

export function clearCachedMessages(userId: string, peerId: string) {
  try {
    const key = getStorageKey(userId, peerId);
    localStorage.removeItem(key);
  } catch (error) {
    console.warn("Failed to clear messages from localStorage:", error);
  }
}
