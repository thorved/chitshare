import * as vscode from 'vscode';
import { ApiClient, User } from './ApiClient';
import { ChatManager, Message, ChatTarget, Conversation, Group } from './ChatManager';

// Cache keys for persistent storage
const CACHE_KEYS = {
    CONVERSATIONS: 'chitshare.cache.conversations',
    GROUPS: 'chitshare.cache.groups',
    MESSAGES_PREFIX: 'chitshare.cache.messages.',
    CURRENT_USER: 'chitshare.cache.currentUser',
};

interface CachedConversations {
    data: Conversation[];
    timestamp: number;
}

interface CachedGroups {
    data: Group[];
    timestamp: number;
}

interface CachedMessages {
    data: Message[];
    chat: ChatTarget;
    hasMore: boolean;
    timestamp: number;
}

export class SidebarProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'chitshare.chatView';
    public static readonly explorerViewType = 'chitshare.explorerChatView';

    private _view?: vscode.WebviewView;
    private _explorerView?: vscode.WebviewView;
    private apiClient: ApiClient;
    private chatManager: ChatManager;
    private currentUser: User | null = null;

    constructor(
        private readonly _extensionUri: vscode.Uri,
        private readonly _context: vscode.ExtensionContext
    ) {
        this.apiClient = new ApiClient(_context);
        this.chatManager = new ChatManager(this.apiClient);

        // Set up message polling callback (full load)
        this.chatManager.onMessagesUpdate((messages) => {
            this.postMessage({ type: 'messages', messages });
        });

        // Set up new messages callback (incremental, no flicker)
        this.chatManager.onNewMessages((messages) => {
            // Update cache with new messages
            const currentChat = this.chatManager.getCurrentChat();
            if (currentChat) {
                this._appendMessagesToCache(currentChat.type, currentChat.id, messages);
            }
            this.postMessage({ type: 'newMessages', messages });
        });

        // Set up notification callback
        this.chatManager.onNotification((message, _chatName) => {
            // Only show notification if chat is visible but not the current chat (or if VS Code is inactive)
            // But for now, we'll keep it simple
            const isVisible = this._view?.visible || this._explorerView?.visible;
            if (isVisible) {
               // return; // Don't show notification when chat is open // COMMENTED OUT for testing
            }

            // Show VS Code notification for new messages
            const preview = message.content.length > 50 
                ? message.content.substring(0, 47) + '...'
                : message.content;
            vscode.window.showInformationMessage(
                `💬 ${message.sender.username}: ${preview}`,
                'View'
            ).then((action) => {
                if (action === 'View') {
                    // Focus the sidebar
                    vscode.commands.executeCommand('chitshare.chatView.focus');
                }
            });
        });

        // Set up conversations polling callback - also update cache
        this.chatManager.onConversationsUpdate((conversations, groups) => {
            // Update cache when polling brings new data
            this._cacheConversations(conversations);
            this._cacheGroups(groups);
            this.postMessage({ type: 'conversations', conversations, groups });
        });
    }

    // ============ Cache Methods ============

    private _cacheConversations(conversations: Conversation[]): void {
        const cached: CachedConversations = {
            data: conversations,
            timestamp: Date.now(),
        };
        this._context.globalState.update(CACHE_KEYS.CONVERSATIONS, cached);
    }

    private _getCachedConversations(): CachedConversations | undefined {
        return this._context.globalState.get<CachedConversations>(CACHE_KEYS.CONVERSATIONS);
    }

    private _cacheGroups(groups: Group[]): void {
        const cached: CachedGroups = {
            data: groups,
            timestamp: Date.now(),
        };
        this._context.globalState.update(CACHE_KEYS.GROUPS, cached);
    }

    private _getCachedGroups(): CachedGroups | undefined {
        return this._context.globalState.get<CachedGroups>(CACHE_KEYS.GROUPS);
    }

    private _cacheMessages(chatType: 'dm' | 'group', chatId: string, messages: Message[], chat: ChatTarget, hasMore: boolean): void {
        const key = `${CACHE_KEYS.MESSAGES_PREFIX}${chatType}_${chatId}`;
        const cached: CachedMessages = {
            data: messages,
            chat,
            hasMore,
            timestamp: Date.now(),
        };
        this._context.globalState.update(key, cached);
    }

    private _getCachedMessages(chatType: 'dm' | 'group', chatId: string): CachedMessages | undefined {
        const key = `${CACHE_KEYS.MESSAGES_PREFIX}${chatType}_${chatId}`;
        return this._context.globalState.get<CachedMessages>(key);
    }

    private _appendMessagesToCache(chatType: 'dm' | 'group', chatId: string, newMessages: Message[]): void {
        const existing = this._getCachedMessages(chatType, chatId);
        if (existing) {
            // Append new messages, avoiding duplicates
            const existingIds = new Set(existing.data.map(m => m.id));
            const uniqueNewMessages = newMessages.filter(m => !existingIds.has(m.id));
            
            if (uniqueNewMessages.length > 0) {
                const updatedMessages = [...existing.data, ...uniqueNewMessages];
                this._cacheMessages(chatType, chatId, updatedMessages, existing.chat, existing.hasMore);
            }
        }
    }

    private _cacheCurrentUser(user: User): void {
        this._context.globalState.update(CACHE_KEYS.CURRENT_USER, user);
    }

    private _getCachedCurrentUser(): User | undefined {
        return this._context.globalState.get<User>(CACHE_KEYS.CURRENT_USER);
    }

    private _clearCache(): void {
        this._context.globalState.update(CACHE_KEYS.CONVERSATIONS, undefined);
        this._context.globalState.update(CACHE_KEYS.GROUPS, undefined);
        this._context.globalState.update(CACHE_KEYS.CURRENT_USER, undefined);
        // Note: Individual message caches are not cleared here - they will be stale but harmless
    }

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        _context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken
    ) {
        // Track which view this is
        if (webviewView.viewType === SidebarProvider.explorerViewType) {
            this._explorerView = webviewView;
        } else {
            this._view = webviewView;
        }

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [
                vscode.Uri.joinPath(this._extensionUri, 'media'),
            ],
        };

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

        // Handle messages from webview
        webviewView.webview.onDidReceiveMessage(async (message) => {
            await this._handleMessage(message);
        });

        // Clean up on dispose
        webviewView.onDidDispose(() => {
            if (webviewView.viewType === SidebarProvider.explorerViewType) {
                this._explorerView = undefined;
            } else {
                this._view = undefined;
            }
            // Only stop polling if both views are gone
            if (!this._view && !this._explorerView) {
                this.chatManager.stopPolling();
            }
        });
        
        // Start polling immediately if logged in
        if (this.currentUser) {
            this.chatManager.startPolling();
        }
    }

    private async _handleMessage(message: { type: string; [key: string]: unknown }) {
        switch (message.type) {
            case 'ready':
                await this._sendInitialState();
                break;

            case 'openSettings':
                vscode.commands.executeCommand('workbench.action.openSettings', 'chitshare.serverUrl');
                break;

            case 'login':
                await this._handleLogin(message.email as string, message.password as string);
                break;

            case 'logout':
                await this._handleLogout();
                break;

            case 'loadConversations':
                await this._loadConversations();
                break;

            case 'loadMessages':
                await this._loadMessages(
                    message.chatType as 'dm' | 'group',
                    message.chatId as string
                );
                break;

            case 'loadMoreMessages':
                await this._loadMoreMessages(
                    message.chatType as 'dm' | 'group',
                    message.chatId as string,
                    message.cursor as string
                );
                break;

            case 'sendMessage':
                await this._sendMessage(
                    message.content as string,
                    message.chatType as 'dm' | 'group',
                    message.chatId as string,
                    message.tempId as string
                );
                break;

            case 'closeChat':
                this.chatManager.setCurrentChat(null);
                // Ensure polling continues for list updates
                this.chatManager.startPolling();
                break;

            case 'searchUsers':
                await this._searchUsers(message.query as string);
                break;

            case 'highlightCode':
                await this._highlightCode(
                    message.id as string,
                    message.code as string,
                    message.language as string
                );
                break;

            case 'openInEditor':
                await this._openInEditor(
                    message.code as string,
                    message.language as string
                );
                break;
            
            case 'uploadFile':
                await this._uploadFile(
                    message.fileName as string,
                    message.mimeType as string,
                    message.size as number,
                    message.data as string,
                    message.chatType as 'dm' | 'group',
                    message.chatId as string,
                    message.tempId as string
                );
                break;
            
            case 'openFileInVscode':
                await this._openFileInVscode(
                    message.fileId as string,
                    message.filename as string
                );
                break;
            
            case 'downloadFile':
                await this._downloadFile(
                    message.fileId as string,
                    message.filename as string
                );
                break;

            case 'deleteConversation':
                await this._deleteConversation(message.userId as string);
                break;
        }
    }

    private async _sendInitialState() {
        const serverUrl = this.apiClient.getServerUrl();
        const isLoggedIn = await this.apiClient.isLoggedIn();

        if (!serverUrl) {
            this.postMessage({ type: 'init', serverConfigured: false, isLoggedIn: false });
            return;
        }

        if (isLoggedIn) {
            // Try to send cached user data immediately for instant UI
            const cachedUser = this._getCachedCurrentUser();
            if (cachedUser) {
                this.currentUser = cachedUser;
                this.postMessage({
                    type: 'init',
                    serverConfigured: true,
                    isLoggedIn: true,
                    user: cachedUser,
                    fromCache: true,
                });
                
                // Also send cached conversations immediately
                const cachedConvs = this._getCachedConversations();
                const cachedGroups = this._getCachedGroups();
                if (cachedConvs || cachedGroups) {
                    this.postMessage({
                        type: 'conversations',
                        conversations: cachedConvs?.data || [],
                        groups: cachedGroups?.data || [],
                        fromCache: true,
                    });
                }
            }

            // Fetch fresh data in background
            try {
                this.currentUser = await this.apiClient.getCurrentUser();
                this._cacheCurrentUser(this.currentUser);
                
                // Only send update if we didn't have cache (or user wants fresh)
                if (!cachedUser) {
                    this.postMessage({
                        type: 'init',
                        serverConfigured: true,
                        isLoggedIn: true,
                        user: this.currentUser,
                    });
                }
            } catch {
                // Token might be invalid
                await this.apiClient.clearToken();
                this._clearCache();
                this.postMessage({ type: 'init', serverConfigured: true, isLoggedIn: false });
            }
        } else {
            this.postMessage({ type: 'init', serverConfigured: true, isLoggedIn: false });
        }
    }

    private async _handleLogin(email: string, password: string) {
        try {
            const user = await this.apiClient.login(email, password);
            this.currentUser = user;
            this._cacheCurrentUser(user); // Cache user for instant load next time
            this.postMessage({ type: 'loginSuccess', user });
            vscode.window.showInformationMessage(`Welcome, ${user.username}!`);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Login failed';
            this.postMessage({ type: 'loginError', error: errorMessage });
        }
    }

    private async _handleLogout() {
        try {
            await this.apiClient.logout();
            this.currentUser = null;
            this.chatManager.setCurrentChat(null);
            this._clearCache(); // Clear all cached data on logout
            this.postMessage({ type: 'logout' });
            vscode.window.showInformationMessage('Logged out successfully');
        } catch (error) {
            console.error('Logout error:', error);
        } finally {
            this.chatManager.stopPolling();
        }
    }

    private async _loadConversations() {
        // Send cached data immediately for instant UI
        const cachedConvs = this._getCachedConversations();
        const cachedGroups = this._getCachedGroups();
        
        if (cachedConvs || cachedGroups) {
            this.postMessage({
                type: 'conversations',
                conversations: cachedConvs?.data || [],
                groups: cachedGroups?.data || [],
                fromCache: true,
            });
        }

        // Start polling immediately so updates come in real-time
        this.chatManager.startPolling();

        // Fetch fresh data in background
        try {
            const [conversations, groups] = await Promise.all([
                this.chatManager.getConversations(),
                this.chatManager.getGroups(),
            ]);
            
            // Update cache
            this._cacheConversations(conversations);
            this._cacheGroups(groups);
            
            this.postMessage({ type: 'conversations', conversations, groups });
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to load conversations';
            // Only show error if we didn't have cached data
            if (!cachedConvs && !cachedGroups) {
                this.postMessage({ type: 'error', error: errorMessage });
            }
        }
    }

    private async _loadMessages(chatType: 'dm' | 'group', chatId: string) {
        // Send cached messages immediately for instant UI
        const cachedMessages = this._getCachedMessages(chatType, chatId);
        let sentCached = false;
        
        if (cachedMessages) {
            // Initialize known messages from cache
            this.chatManager.initializeKnownMessages(cachedMessages.data);
            this.chatManager.setCurrentChat(cachedMessages.chat);
            this.postMessage({
                type: 'messages',
                messages: cachedMessages.data,
                chat: cachedMessages.chat,
                hasMore: cachedMessages.hasMore,
                fromCache: true,
            });
            sentCached = true;
        }

        // Fetch fresh data in background
        try {
            let messages: Message[];
            let chat: ChatTarget;
            let hasMore = false;

            if (chatType === 'dm') {
                const result = await this.chatManager.getDMMessages(chatId);
                messages = result.messages;
                hasMore = result.hasMore;
                chat = {
                    type: 'dm',
                    id: chatId,
                    name: result.user.username,
                    avatarUrl: result.user.avatarUrl,
                    isOnline: result.user.isOnline,
                };
            } else {
                const result = await this.chatManager.getGroupMessages(chatId);
                messages = result.messages;
                hasMore = result.hasMore;
                
                // Look up the actual group name from the groups list
                const groups = await this.chatManager.getGroups();
                const group = groups.find(g => g.id === chatId);
                
                chat = {
                    type: 'group',
                    id: chatId,
                    name: group?.name || 'Group',
                    avatarUrl: group?.avatarUrl,
                };
            }

            // Update cache
            this._cacheMessages(chatType, chatId, messages, chat, hasMore);

            // Initialize known messages for incremental updates
            this.chatManager.initializeKnownMessages(messages);
            this.chatManager.setCurrentChat(chat);
            this.postMessage({ type: 'messages', messages, chat, hasMore });
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to load messages';
            // Only show error if we didn't have cached data
            if (!sentCached) {
                this.postMessage({ type: 'error', error: errorMessage });
            }
        }
    }

    private async _loadMoreMessages(chatType: 'dm' | 'group', chatId: string, cursor: string) {
        try {
            let messages: Message[];
            let hasMore = false;

            if (chatType === 'dm') {
                const result = await this.chatManager.getDMMessages(chatId, cursor);
                messages = result.messages;
                hasMore = result.hasMore;
            } else {
                const result = await this.chatManager.getGroupMessages(chatId, cursor);
                messages = result.messages;
                hasMore = result.hasMore;
            }

            // Track these older messages
            for (const msg of messages) {
                this.chatManager.addKnownMessage(msg.id);
            }

            this.postMessage({ type: 'olderMessages', messages, hasMore });
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to load more messages';
            this.postMessage({ type: 'error', error: errorMessage });
        }
    }

    private async _sendMessage(content: string, chatType: 'dm' | 'group', chatId: string, tempId?: string) {
        try {
            let message: Message;

            if (chatType === 'dm') {
                message = await this.chatManager.sendDM(chatId, content);
            } else {
                message = await this.chatManager.sendGroupMessage(chatId, content);
            }

            // Update cache with sent message
            this._appendMessagesToCache(chatType, chatId, [message]);

            this.postMessage({ type: 'messageSent', message, tempId });
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to send message';
            this.postMessage({ type: 'error', error: errorMessage, tempId });
            vscode.window.showErrorMessage(errorMessage);
        }
    }

    private async _searchUsers(query: string) {
        try {
            const users = await this.chatManager.getUsers(query);
            this.postMessage({ type: 'searchResults', users });
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to search users';
            this.postMessage({ type: 'error', error: errorMessage });
        }
    }

    private async _highlightCode(id: string, code: string, language: string) {
        try {
            // Dynamic import for ESM module
            const { codeToHtml } = await import('shiki');
            const html = await codeToHtml(code, {
                lang: language || 'text',
                theme: 'github-dark',
            });
            this.postMessage({ type: 'highlightedCode', id, html });
        } catch {
            // Try with text fallback
            try {
                const { codeToHtml } = await import('shiki');
                const html = await codeToHtml(code, {
                    lang: 'text',
                    theme: 'github-dark',
                });
                this.postMessage({ type: 'highlightedCode', id, html });
            } catch {
                // Just keep the plain text
                console.error('Failed to highlight code');
            }
        }
    }

    private async _openInEditor(code: string, language: string) {
        try {
            // Map common language names to VS Code language identifiers
            const langMap: Record<string, string> = {
                'js': 'javascript',
                'javascript': 'javascript',
                'ts': 'typescript',
                'typescript': 'typescript',
                'tsx': 'typescriptreact',
                'jsx': 'javascriptreact',
                'py': 'python',
                'python': 'python',
                'rb': 'ruby',
                'ruby': 'ruby',
                'sh': 'shellscript',
                'bash': 'shellscript',
                'zsh': 'shellscript',
                'shell': 'shellscript',
                'yml': 'yaml',
                'yaml': 'yaml',
                'md': 'markdown',
                'markdown': 'markdown',
                'json': 'json',
                'html': 'html',
                'css': 'css',
                'scss': 'scss',
                'less': 'less',
                'sql': 'sql',
                'go': 'go',
                'rust': 'rust',
                'rs': 'rust',
                'java': 'java',
                'kotlin': 'kotlin',
                'kt': 'kotlin',
                'c': 'c',
                'cpp': 'cpp',
                'c++': 'cpp',
                'csharp': 'csharp',
                'cs': 'csharp',
                'swift': 'swift',
                'php': 'php',
                'xml': 'xml',
                'graphql': 'graphql',
                'dockerfile': 'dockerfile',
                'docker': 'dockerfile',
            };

            const vscodeLang = langMap[language.toLowerCase()] || language || 'plaintext';

            // Create a new untitled document with the code
            const doc = await vscode.workspace.openTextDocument({
                content: code,
                language: vscodeLang,
            });

            // Show the document in the editor
            const editor = await vscode.window.showTextDocument(doc, {
                preview: true,
                viewColumn: vscode.ViewColumn.Active,
            });

            // Explicitly set the language mode (sometimes needed for proper highlighting)
            await vscode.languages.setTextDocumentLanguage(editor.document, vscodeLang);

        } catch (error) {
            console.error('Failed to open in editor:', error);
            vscode.window.showErrorMessage('Failed to open code in editor');
        }
    }

    private async _uploadFile(
        fileName: string, 
        mimeType: string, 
        size: number, 
        base64Data: string, 
        chatType: 'dm' | 'group', 
        chatId: string, 
        tempId: string
    ) {
        try {
            const serverUrl = this.apiClient.getServerUrl();
            const token = await this.apiClient.getToken();
            
            // Convert base64 to buffer
            const buffer = Buffer.from(base64Data, 'base64');
            
            // Create form data - use File API for Node.js 18+ compatibility
            const formData = new FormData();
            const blob = new Blob([buffer], { type: mimeType });
            formData.append('file', blob, fileName);
            formData.append('fileName', fileName); // Add explicit fileName field for server
            
            if (chatType === 'dm') {
                formData.append('recipientId', chatId);
            } else {
                formData.append('groupId', chatId);
            }
            
            const response = await fetch(`${serverUrl}/api/files/upload`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
                body: formData,
            });
            
            if (!response.ok) {
                const data = await response.json() as { error?: string };
                throw new Error(data.error || 'Upload failed');
            }
            
            const data = await response.json() as any;
            
            if (data.message) {
                this.postMessage({ type: 'messageSent', message: data.message, tempId });
            } else {
                // Fallback or error logging if needed
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to upload file';
            this.postMessage({ type: 'error', error: errorMessage, tempId });
            vscode.window.showErrorMessage(errorMessage);
        }
    }

    private async _openFileInVscode(fileId: string, filename: string) {
        try {
            const serverUrl = this.apiClient.getServerUrl();
            const token = await this.apiClient.getToken();
            
            const response = await fetch(`${serverUrl}/api/files/${fileId}`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
            });
            
            if (!response.ok) {
                throw new Error('Failed to download file');
            }
            
            const arrayBuffer = await response.arrayBuffer();
            const content = Buffer.from(arrayBuffer).toString('utf-8');
            
            // Get extension for language detection
            const ext = filename.split('.').pop()?.toLowerCase() || '';
            const langMap: Record<string, string> = {
                'js': 'javascript', 'ts': 'typescript', 'tsx': 'typescriptreact', 'jsx': 'javascriptreact',
                'py': 'python', 'rb': 'ruby', 'java': 'java', 'c': 'c', 'cpp': 'cpp', 'h': 'c',
                'cs': 'csharp', 'go': 'go', 'rs': 'rust', 'php': 'php', 'html': 'html', 'css': 'css',
                'scss': 'scss', 'json': 'json', 'xml': 'xml', 'yaml': 'yaml', 'yml': 'yaml',
                'md': 'markdown', 'txt': 'plaintext', 'sql': 'sql', 'sh': 'shellscript', 'bash': 'shellscript',
                'env': 'properties', 'gitignore': 'ignore', 'ps1': 'powershell', 'bat': 'bat', 'cmd': 'bat'
            };
            const language = langMap[ext] || 'plaintext';
            
            const doc = await vscode.workspace.openTextDocument({
                content,
                language,
            });
            
            await vscode.window.showTextDocument(doc, {
                preview: true,
                viewColumn: vscode.ViewColumn.Active,
            });
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to open file';
            vscode.window.showErrorMessage(errorMessage);
        }
    }

    private async _downloadFile(fileId: string, filename: string) {
        try {
            const serverUrl = this.apiClient.getServerUrl();
            const token = await this.apiClient.getToken();
            
            const response = await fetch(`${serverUrl}/api/files/${fileId}`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
            });
            
            if (!response.ok) {
                throw new Error('Failed to download file');
            }
            
            const arrayBuffer = await response.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            
            // Ask user where to save
            const saveUri = await vscode.window.showSaveDialog({
                defaultUri: vscode.Uri.file(filename),
                saveLabel: 'Save File',
            });
            
            if (saveUri) {
                await vscode.workspace.fs.writeFile(saveUri, buffer);
                vscode.window.showInformationMessage(`File saved to ${saveUri.fsPath}`);
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to download file';
            vscode.window.showErrorMessage(errorMessage);
        }
    }

    private async _deleteConversation(userId: string) {
        const selection = await vscode.window.showWarningMessage(
            "Are you sure you want to delete this conversation? This will delete all messages permanently.",
            { modal: true },
            "Delete"
        );

        if (selection !== 'Delete') {
            return;
        }

        try {
            await this.chatManager.deleteConversation(userId);
            // Refresh conversations list
            await this._loadConversations();
            vscode.window.showInformationMessage('Conversation deleted');
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to delete conversation';
            vscode.window.showErrorMessage(errorMessage);
        }
    }

    private postMessage(message: unknown) {
        // Send to both views to keep them in sync
        this._view?.webview.postMessage(message);
        this._explorerView?.webview.postMessage(message);
    }

    private _getHtmlForWebview(webview: vscode.Webview): string {
        const styleUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this._extensionUri, 'media', 'main.css')
        );
        const scriptUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this._extensionUri, 'media', 'main.js')
        );

        const nonce = getNonce();

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}'; img-src ${webview.cspSource} https:;">
    <link href="${styleUri}" rel="stylesheet">
    <title>Chitshare</title>
</head>
<body>
    <div id="app">
        <div class="app-container">
            <div class="loading">
                <div class="spinner"></div>
            </div>
        </div>
    </div>
    <script type="module" nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
    }

    /**
     * Refresh state and conversations list
     */
    public async refresh() {
        
        // If logged in, reload conversations
        if (this.currentUser) {
            await this._loadConversations();
        }
    }

    /**
     * Trigger login command
     */
    public async login() {
        const serverUrl = this.apiClient.getServerUrl();
        
        if (!serverUrl) {
            const action = await vscode.window.showWarningMessage(
                'Please configure the server URL first',
                'Open Settings'
            );
            if (action === 'Open Settings') {
                vscode.commands.executeCommand('workbench.action.openSettings', 'chitshare.serverUrl');
            }
            return;
        }

        const email = await vscode.window.showInputBox({
            prompt: 'Enter your email',
            placeHolder: 'your@email.com',
        });

        if (!email) {
            return;
        }

        const password = await vscode.window.showInputBox({
            prompt: 'Enter your password',
            password: true,
        });

        if (!password) {
            return;
        }

        try {
            const user = await this.apiClient.login(email, password);
            this.currentUser = user;
            this.postMessage({ type: 'loginSuccess', user });
            vscode.window.showInformationMessage(`Welcome, ${user.username}!`);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Login failed';
            vscode.window.showErrorMessage(errorMessage);
        }
    }

    /**
     * Trigger logout command
     */
    public async logout() {
        await this._handleLogout();
    }

    /**
     * Dispose resources
     */
    public dispose() {
        this.chatManager.dispose();
    }
}

function getNonce(): string {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}
