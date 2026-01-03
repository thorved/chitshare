// State management
import { getVsCodeApi } from './vscode-api.js';

const vscode = getVsCodeApi();

export const state = {
    currentView: 'loading', // 'loading' | 'settings' | 'login' | 'chat-list' | 'chat' | 'user-search'
    currentUser: null,
    conversations: [],
    groups: [],
    searchResults: [],
    currentChat: null,
    messages: [],
    // UI state
    codeBlockCounter: 0,
    hasMore: false,
    loadingMore: false
};

// Initialize state from VS Code storage
export function initState() {
    const savedState = vscode.getState();
    if (savedState) {
        state.currentView = savedState.currentView || 'loading';
        state.currentUser = savedState.currentUser;
        state.conversations = savedState.conversations || [];
        state.groups = savedState.groups || [];
        state.currentChat = savedState.currentChat;
        state.messages = savedState.messages || [];
        state.searchResults = savedState.searchResults || [];
    }
}

export function saveState() {
    vscode.setState({
        currentView: state.currentView,
        currentUser: state.currentUser,
        conversations: state.conversations,
        groups: state.groups,
        currentChat: state.currentChat,
        messages: state.messages,
        searchResults: state.searchResults,
    });
}

export function setState(newState) {
    Object.assign(state, newState);
    saveState();
}

export function updateMessage(messageId, updates) {
    const idx = state.messages.findIndex(m => m.id === messageId);
    if (idx !== -1) {
        state.messages[idx] = { ...state.messages[idx], ...updates };
        saveState();
        return true;
    }
    return false;
}
