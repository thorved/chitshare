// UI Components
import { escapeHtml, getInitials, getPreview, formatTime, escapeAttr, encodeCode } from './utils.js';
import { parseMessage } from './code-detection.js';

export function LoadingComponent() {
    return `
        <div class="app-container">
            <div class="loading">
                <div class="spinner"></div>
            </div>
        </div>
    `;
}

export function SettingsComponent() {
    return `
        <div class="app-container">
            <div class="settings-prompt">
                <div class="settings-prompt-icon">⚙️</div>
                <div class="settings-prompt-title">Configure Server</div>
                <div class="settings-prompt-text">
                    Please set the Chitshare server URL in settings to get started.
                </div>
                <button class="btn btn-primary" id="openSettings">
                    Open Settings
                </button>
            </div>
        </div>
    `;
}

export function LoginComponent(error = null) {
    return `
        <div class="app-container">
            <div class="login-view">
                <div class="login-header">
                    <div class="login-title">Chitshare</div>
                    <div class="login-subtitle">Sign in to start chatting</div>
                </div>
                <form class="login-form" id="loginForm">
                    <div id="loginError">${error ? `<div class="login-error">${escapeHtml(error)}</div>` : ''}</div>
                    <div class="form-group">
                        <label class="form-label" for="email">Email</label>
                        <input type="email" class="form-input" id="email" placeholder="your@email.com" required>
                    </div>
                    <div class="form-group">
                        <label class="form-label" for="password">Password</label>
                        <input type="password" class="form-input" id="password" placeholder="••••••••" required>
                    </div>
                    <button type="submit" class="btn btn-primary" id="loginBtn" style="width: 100%;">
                        Sign In
                    </button>
                </form>
            </div>
        </div>
    `;
}

export function ChatListComponent(currentUser, conversations, groups) {
    const userHtml = currentUser ? `
        <div class="user-info">
            <div class="avatar">${getInitials(currentUser.username)}</div>
            <div class="user-info-name">${escapeHtml(currentUser.username)}</div>
            <button class="btn btn-icon" id="logoutBtn" title="Logout">
                ⏻
            </button>
        </div>
    ` : '';

    const conversationsHtml = conversations.length > 0 ? `
        <div class="section-header">Direct Messages</div>
        <div class="conversation-list">
            ${conversations.map(conv => `
                <div class="conversation-item" data-type="dm" data-id="${conv.user.id}">
                    <div class="avatar ${conv.user.isOnline ? 'online' : ''}">
                        ${conv.user.avatarUrl 
                            ? `<img src="${conv.user.avatarUrl}" alt="">` 
                            : getInitials(conv.user.username)}
                    </div>
                    <div class="conversation-info">
                        <div class="conversation-name">${escapeHtml(conv.user.username)}</div>
                        <div class="conversation-preview">${escapeHtml(getPreview(conv.lastMessage.content))}</div>
                    </div>
                    <div class="conversation-meta">
                        <div class="conversation-time">${formatTime(conv.lastMessage.createdAt)}</div>
                        ${conv.unreadCount > 0 ? `<div class="unread-badge">${conv.unreadCount}</div>` : ''}
                    </div>
                    <div class="conversation-actions">
                        <button class="delete-conversation-btn" data-id="${conv.user.id}" title="Delete conversation">
                            🗑️
                        </button>
                    </div>
                </div>
            `).join('')}
        </div>
    ` : '';

    const groupsHtml = groups.length > 0 ? `
        <div class="section-header">Groups</div>
        <div class="conversation-list">
            ${groups.map(group => `
                <div class="conversation-item" data-type="group" data-id="${group.id}">
                    <div class="avatar">
                        ${group.avatarUrl 
                            ? `<img src="${group.avatarUrl}" alt="">` 
                            : getInitials(group.name)}
                    </div>
                    <div class="conversation-info">
                        <div class="conversation-name">${escapeHtml(group.name)}</div>
                        <div class="conversation-preview">${group.memberCount} members</div>
                    </div>
                    <div class="conversation-meta">
                        <div class="conversation-time">${formatTime(group.updatedAt)}</div>
                    </div>
                </div>
            `).join('')}
        </div>
    ` : '';

    const emptyHtml = conversations.length === 0 && groups.length === 0 ? `
        <div class="empty-state">
            <div class="empty-state-icon">💬</div>
            <div class="empty-state-title">No conversations yet</div>
            <div class="empty-state-text">Start a new conversation to get chatting!</div>
        </div>
    ` : '';

    return `
        <div class="app-container">
        <div class="app-container">
            ${userHtml}
            <div class="header">
                <div class="header-title">
                    💬 Chats
                </div>
                <div class="header-actions">
                    <button class="btn btn-icon" id="newChatBtn" title="New Chat">
                        +
                    </button>
                    <button class="btn btn-icon" id="refreshBtn" title="Refresh">
                        ↻
                    </button>
                </div>
            </div>
            <div class="chat-list-view">
                ${conversationsHtml}
                ${groupsHtml}
                ${emptyHtml}
            </div>
        </div>
        </div>
    `;
}

export function UserSearchComponent(searchResults) {
    const resultsHtml = searchResults.length > 0 ? `
        <div class="conversation-list">
            ${searchResults.map(user => `
                <div class="conversation-item" data-id="${user.id}">
                    <div class="avatar ${user.isOnline ? 'online' : ''}">
                        ${user.avatarUrl 
                            ? `<img src="${user.avatarUrl}" alt="">` 
                            : getInitials(user.username)}
                    </div>
                    <div class="conversation-info">
                        <div class="conversation-name">${escapeHtml(user.username)}</div>
                        <div class="conversation-preview">${escapeHtml(user.email)}</div>
                    </div>
                    <div class="conversation-actions">
                        <button class="btn btn-icon select-user-btn">➝</button>
                    </div>
                </div>
            `).join('')}
        </div>
    ` : `
        <div class="empty-state">
            <div class="empty-state-icon">🔍</div>
            <div class="empty-state-text">Search for users by name or email</div>
        </div>
    `;

    return `
        <div class="app-container">
            <div class="chat-header">
                <button class="chat-header-back" id="backBtn">
                    ←
                </button>
                <div class="chat-header-info">
                    <div class="chat-header-name">New Chat</div>
                </div>
            </div>
            <div class="message-input-container" style="border-top: none; border-bottom: 1px solid var(--vscode-panel-border);">
                <input type="text" class="form-input" id="userSearchInput" placeholder="Search users..." autocomplete="off">
            </div>
            <div class="chat-list-view">
                ${resultsHtml}
            </div>
        </div>
    `;
}

// File extensions that can be opened in VS Code
const VSCODE_COMPATIBLE_EXTENSIONS = [
    'txt', 'md', 'json', 'xml', 'yaml', 'yml', 'csv',
    'js', 'ts', 'jsx', 'tsx', 'py', 'java', 'c', 'cpp', 'h', 'cs', 'go', 'rs', 'rb', 'php', 'html', 'css', 'scss', 'sql',
    'env', 'gitignore', 'editorconfig', 'prettierrc', 'eslintrc', 'sh', 'bash', 'zsh', 'ps1', 'bat', 'cmd'
];

function isVscodeCompatible(filename) {
    const ext = filename.split('.').pop()?.toLowerCase() || '';
    return VSCODE_COMPATIBLE_EXTENSIONS.includes(ext);
}

function formatFileSize(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

export function FileMessageComponent(file, isOwn) {
    const canOpenInVscode = isVscodeCompatible(file.originalName);
    
    return `
        <div class="file-message ${isOwn ? 'own' : ''}">
            <div class="file-icon">📁</div>
            <div class="file-info">
                <div class="file-name">${escapeHtml(file.originalName)}</div>
                <div class="file-size">${formatFileSize(file.size)}</div>
            </div>
            <div class="file-actions">
                ${canOpenInVscode ? `
                    <button class="file-action-btn file-open-vscode-btn" data-file-id="${file.id}" data-filename="${escapeAttr(file.originalName)}" title="Open in VS Code">
                        📝
                    </button>
                ` : ''}
                <button class="file-action-btn file-download-btn" data-file-id="${file.id}" data-filename="${escapeAttr(file.originalName)}" title="Download">
                    ⬇️
                </button>
            </div>
        </div>
    `;
}

export function MessageComponent(msg, currentUser) {
    const isOwn = currentUser && msg.sender.id === currentUser.id;
    let statusClass = '';
    if (msg.status === 'pending') statusClass = ' pending';
    if (msg.status === 'error') statusClass = ' error';
    
    const isFile = msg.type === 'file' && msg.file;

    // We need a way to increment codeBlockCounter or generate unique IDs if this is called in isolation
    // The current formatMessageContent uses a closure or passes a generator.
    // Ideally we pass a generator or just use a timestamp/random base in the utility.
    // For now we will use a global-ish counter or rely on the caller to handle block IDs?
    // formatMessageContent generates IDs. Let's make it robust.
    
    return `
        <div class="message ${isOwn ? 'own' : ''}${statusClass}${isFile ? ' file-type' : ''}" data-id="${msg.id}">
            <div class="message-avatar">
                ${msg.sender.avatarUrl 
                    ? `<img src="${msg.sender.avatarUrl}" alt="">` 
                    : getInitials(msg.sender.username)}
            </div>
            <div class="message-content">
                ${!isOwn ? `<div class="message-sender">${escapeHtml(msg.sender.username)}</div>` : ''}
                <div class="message-bubble">${isFile ? FileMessageComponent(msg.file, isOwn) : formatMessageContent(msg.content)}</div>
                <div class="message-time">${formatTime(msg.createdAt)}</div>
                ${msg.status === 'error' ? `
                    <div class="message-actions">
                        <span class="message-error-text">Failed to send</span>
                        <button class="message-retry" onclick="retryMessage('${msg.id}')">Retry</button>
                    </div>
                ` : ''}
            </div>
        </div>
    `;
}

export function ChatComponent(currentChat, messages, currentUser) {
    if (!currentChat) return '';

    const statusText = currentChat.type === 'dm' 
        ? (currentChat.isOnline ? 'Online' : 'Offline')
        : '';

    const messagesHtml = messages.map(msg => MessageComponent(msg, currentUser)).join('');

    return `
        <div class="app-container" id="chatContainer">
            <!-- Drop zone overlay -->
            <div class="drop-zone-overlay" id="dropZoneOverlay">
                <div class="drop-zone-content">
                    <div class="drop-zone-icon">📁</div>
                    <div class="drop-zone-text">Drop file to send</div>
                </div>
            </div>
            <div class="chat-header">
                <button class="chat-header-back" id="backBtn">
                    ←
                </button>
                <div class="avatar">
                    ${currentChat.avatarUrl 
                        ? `<img src="${currentChat.avatarUrl}" alt="">` 
                        : getInitials(currentChat.name)}
                </div>
                <div class="chat-header-info">
                    <div class="chat-header-name">${escapeHtml(currentChat.name)}</div>
                    ${statusText ? `<div class="chat-header-status ${currentChat.isOnline ? 'online' : ''}">${statusText}</div>` : ''}
                </div>
            </div>
            <div class="messages-container" id="messagesContainer">
                ${messagesHtml || `
                    <div class="empty-state">
                        <div class="empty-state-icon">✉️</div>
                        <div class="empty-state-title">No messages yet</div>
                        <div class="empty-state-text">Send a message to start the conversation!</div>
                    </div>
                `}
            </div>
            <div class="message-input-container">
                <div class="message-input-wrapper">
                    <textarea 
                        class="message-input" 
                        id="messageInput" 
                        placeholder="Type a message..."
                        rows="1"
                    ></textarea>
                    <button class="send-btn" id="sendBtn" title="Send">
                        ➤
                    </button>
                </div>
            </div>
        </div>
    `;
}

// Helper to format content with code blocks
let _codeBlockCounter = 0;
function formatMessageContent(content) {
    if (!content) {
        return '';
    }
    
    // Parse the message using the same logic as the server
    const parts = parseMessage(content);
    
    let html = '';
    
    for (const part of parts) {
        if (part.type === 'code') {
            const blockId = `code-${_codeBlockCounter++}-${Math.random().toString(36).substr(2, 5)}`;
            const encodedCode = encodeCode(part.code);
            html += `
                <div class="code-block" data-id="${blockId}" data-lang="${escapeAttr(part.language)}" data-code="${encodedCode}">
                    <div class="code-header">
                        <span class="code-lang">${escapeHtml(part.language)}</span>
                        <div class="code-actions">
                            <button class="code-action-btn code-copy-btn" title="Copy code">
                                📋
                            </button>
                            <button class="code-action-btn code-open-btn" title="Open in editor">
                                📄
                            </button>
                        </div>
                    </div>
                    <div class="code-content">
                        <pre><code>${escapeHtml(part.code)}</code></pre>
                    </div>
                </div>
            `;
        } else {
            html += formatTextContent(part.content);
        }
    }
    
    return html;
}

function formatTextContent(text) {
    let html = escapeHtml(text);
    
    // Inline code
    html = html.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>');
    
    // Bold
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    
    // Italic
    html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    
    // Line breaks
    html = html.replace(/\n/g, '<br>');
    
    return `<p>${html}</p>`;
}
