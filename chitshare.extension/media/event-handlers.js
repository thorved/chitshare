// Event Handlers
import { getVsCodeApi } from './vscode-api.js';
import { state, saveState, updateMessage } from './state.js';
import { render, renderLoginError, scrollToBottom, showLoadingIndicator, hideLoadingIndicator, updateCodeBlock, appendMessages, prependMessages, replaceMessage } from './renderer.js';
import { decodeCode, uuidv4, escapeHtml, getPreview, formatTime } from './utils.js';

const vscode = getVsCodeApi();

export function init() {
    // Listen for messages from extension
    window.addEventListener('message', handleMessage);

    // Request initial state
    vscode.postMessage({ type: 'ready' });
}

export function handleMessage(event) {
    const message = event.data;

    switch (message.type) {
        case 'init':
            handleInit(message);
            break;
        case 'loginSuccess':
            state.currentUser = message.user;
            state.currentView = 'chat-list';
            render();
            vscode.postMessage({ type: 'loadConversations' });
            break;
        case 'loginError':
            renderLoginError(message.error);
            break;
        case 'conversations':
            // Only re-render if data actually changed
            const newConvs = message.conversations || [];
            const newGroups = message.groups || [];
            if (JSON.stringify(state.conversations) !== JSON.stringify(newConvs) ||
                JSON.stringify(state.groups) !== JSON.stringify(newGroups)) {
                
                state.conversations = newConvs;
                state.groups = newGroups;
                
                // Update current chat status if it exists
                if (state.currentChat && state.currentChat.type === 'dm') {
                    const updatedConv = state.conversations.find(c => c.user.id === state.currentChat.id);
                    if (updatedConv) {
                        const wasOnline = state.currentChat.isOnline;
                        state.currentChat.isOnline = updatedConv.user.isOnline;
                        state.currentChat.avatarUrl = updatedConv.user.avatarUrl;
                        
                        // If status changed and we are in chat view, re-render
                        if (state.currentView === 'chat' && wasOnline !== state.currentChat.isOnline) {
                            render();
                        }
                    }
                }

                if (state.currentView === 'chat-list') {
                    render();
                }
            }
            break;
        case 'messages':
            handleMessagesUpdate(message);
            break;
        case 'messageSent':
            handleMessageSent(message);
            break;
        case 'error':
             if (message.tempId) {
                updateMessage(message.tempId, { status: 'error' });
                render();
             } else {
                vscode.postMessage({ type: 'log', message: 'Error: ' + message.error});
             }
             break;
        case 'newMessages':
            handleNewMessages(message);
            break;
        case 'olderMessages':
            handleOlderMessages(message);
            break;
        case 'logout':
            state.currentUser = null;
            state.currentView = 'login';
            state.conversations = [];
            state.groups = [];
            state.currentChat = null;
            state.messages = [];
            render();
            break;
        case 'highlightedCode':
            updateCodeBlock(message.id, message.html);
            break;
        case 'searchResults':
            state.searchResults = message.users || [];
            render();
            break;
    }

    saveState();
}

function handleInit(message) {
    if (!message.serverConfigured) {
        state.currentView = 'settings';
    } else if (!message.isLoggedIn) {
        state.currentView = 'login';
    } else {
        state.currentUser = message.user;
        state.currentView = 'chat-list';
        vscode.postMessage({ type: 'loadConversations' });
    }
    render();
}

function handleMessagesUpdate(message) {
    const container = document.getElementById('messagesContainer');
    const isNearBottom = container ? (container.scrollHeight - container.scrollTop - container.clientHeight <= 100) : true;
    const oldScrollTop = container ? container.scrollTop : 0;

    const incomingMessages = message.messages || [];
    
    if (message.chat) {
        state.currentChat = message.chat;
    }
    state.hasMore = message.hasMore || false;
    
    // Preserve pending/error messages from local state
    const localPending = state.messages.filter(m => m.status === 'pending' || m.status === 'error');
    
    const mergedMessages = [...incomingMessages];
    
    for (const pending of localPending) {
        mergedMessages.push(pending);
    }

    state.messages = mergedMessages;
    
    render();
    
    if (isNearBottom) {
        scrollToBottom();
    } else if (container) {
         container.scrollTop = oldScrollTop;
    }
}

function handleMessageSent(message) {
    // Update temporary message with real one
    if (message.tempId) {
        const idx = state.messages.findIndex(m => m.id === message.tempId);
        if (idx !== -1) {
            state.messages[idx] = message.message;
            
            // Deduplicate: If the real message ID now exists elsewhere in the list (from poll), remove the duplicate
            const firstIdx = state.messages.findIndex(m => m.id === message.message.id);
            const lastIdx = state.messages.findLastIndex(m => m.id === message.message.id);
            
            if (firstIdx !== lastIdx) {
                const duplicateIdx = (firstIdx === idx) ? lastIdx : firstIdx;
                state.messages.splice(duplicateIdx, 1);
                render(); // Fallback to render for complex dedupe case
            } else {
                // Happy path: Update in place
                replaceMessage(message.tempId, message.message);
            }
        } else {
            // Not found, just append if not exists
            const exists = state.messages.some(m => m.id === message.message.id);
            if (!exists) {
                state.messages.push(message.message);
                appendMessages([message.message]);
                scrollToBottom();
            }
        }
    } else {
        state.messages.push(message.message);
        appendMessages([message.message]);
        scrollToBottom();
    }
}

function handleNewMessages(message) {
    if (message.messages && message.messages.length > 0) {
        const existingIds = new Set(state.messages.map(m => m.id));
        const newMsgs = message.messages.filter(m => !existingIds.has(m.id));
        if (newMsgs.length > 0) {
            state.messages.push(...newMsgs);
            appendMessages(newMsgs);
            scrollToBottom();
        }
    }
}

function handleOlderMessages(message) {
    state.loadingMore = false;
    if (message.messages && message.messages.length > 0) {
        const existingIds = new Set(state.messages.map(m => m.id));
        const olderMsgs = message.messages.filter(m => !existingIds.has(m.id));
        if (olderMsgs.length > 0) {
            state.messages.unshift(...olderMsgs);
            prependMessages(olderMsgs);
        }
    }
    state.hasMore = message.hasMore || false;
    // hideLoadingIndicator is handled by render re-creating DOM or we call it if we didn't re-render
    hideLoadingIndicator(); // Explicitly call it now since we don't render
}


// Listener Attachments

export function attachSettingsListeners() {
    document.getElementById('openSettings').addEventListener('click', () => {
        vscode.postMessage({ type: 'openSettings' });
    });
}

export function attachLoginListeners() {
    document.getElementById('loginForm').addEventListener('submit', (e) => {
        e.preventDefault();
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const loginBtn = document.getElementById('loginBtn');

        loginBtn.disabled = true;
        loginBtn.textContent = 'Signing in...';

        document.getElementById('loginError').innerHTML = '';

        vscode.postMessage({
            type: 'login',
            email,
            password,
        });
    });
}

export function attachChatListListeners() {
    document.getElementById('refreshBtn')?.addEventListener('click', () => {
        vscode.postMessage({ type: 'loadConversations' });
    });

    document.getElementById('newChatBtn')?.addEventListener('click', () => {
        state.currentView = 'user-search';
        state.searchResults = [];
        render();
        setTimeout(() => document.getElementById('userSearchInput')?.focus(), 50);
    });

    document.getElementById('logoutBtn')?.addEventListener('click', () => {
        vscode.postMessage({ type: 'logout' });
    });

    document.querySelectorAll('.conversation-item').forEach(item => {
        item.addEventListener('click', () => {
            const type = item.getAttribute('data-type');
            const id = item.getAttribute('data-id');
            openChat(type, id);
        });
    });

    document.querySelectorAll('.delete-conversation-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const userId = btn.getAttribute('data-id');
            vscode.postMessage({
                type: 'deleteConversation',
                userId: userId
            });
        });
    });
}

function openChat(type, id, details = null) {
    state.currentView = 'chat';
    
    if (type === 'dm') {
        const conv = state.conversations.find(c => c.user.id === id);
        if (conv) {
            state.currentChat = {
                type: 'dm',
                id: id,
                name: conv.user.username,
                isOnline: conv.user.isOnline,
                avatarUrl: conv.user.avatarUrl,
            };
        } else if (details) {
            state.currentChat = {
                type: 'dm',
                id: id,
                name: details.username,
                isOnline: details.isOnline,
                avatarUrl: details.avatarUrl,
            };
        }
    } else {
        const group = state.groups.find(g => g.id === id);
        if (group) {
            state.currentChat = {
                type: 'group',
                id: id,
                name: group.name,
                avatarUrl: group.avatarUrl,
            };
        }
    }

    state.messages = [];
    render();

    vscode.postMessage({
        type: 'loadMessages',
        chatType: type,
        chatId: id,
    });
}

let searchTimer = null;

export function attachUserSearchListeners() {
    document.getElementById('backBtn').addEventListener('click', () => {
        state.currentView = 'chat-list';
        render();
    });

    const input = document.getElementById('userSearchInput');
    input.addEventListener('input', (e) => {
        const query = e.target.value.trim();
        
        if (searchTimer) clearTimeout(searchTimer);
        
        if (query.length < 2) {
            state.searchResults = [];
             // Don't re-render here to avoid losing focus if not needed, 
             // but if we want to clear results we must.
             // Simplest is to re-render.
            render();
            setTimeout(() => {
                const el = document.getElementById('userSearchInput');
                if (el) {
                    el.focus();
                    el.value = query;
                }
            }, 0);
            return;
        }

        searchTimer = setTimeout(() => {
            vscode.postMessage({ type: 'searchUsers', query });
        }, 300);
    });

    document.querySelectorAll('.conversation-item').forEach(item => {
        item.addEventListener('click', () => {
            const userId = item.getAttribute('data-id');
            const user = state.searchResults.find(u => u.id === userId);
            if (user) {
                 openChat('dm', userId, user);
            }
        });
    });
}

export function attachChatListeners() {
    document.getElementById('backBtn').addEventListener('click', () => {
        state.currentView = 'chat-list';
        state.currentChat = null;
        state.messages = [];
        render();
        vscode.postMessage({ type: 'closeChat' });
    });

    const messageInput = document.getElementById('messageInput');
    const sendBtn = document.getElementById('sendBtn');

    messageInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    messageInput.addEventListener('input', () => {
        messageInput.style.height = 'auto';
        messageInput.style.height = Math.min(messageInput.scrollHeight, 120) + 'px';
    });

    sendBtn.addEventListener('click', sendMessage);

    // File upload button
    const attachBtn = document.getElementById('attachBtn');
    const fileInput = document.getElementById('fileInput');
    
    if (attachBtn && fileInput) {
        attachBtn.addEventListener('click', () => {
            fileInput.click();
        });
        
        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                uploadFile(file);
                fileInput.value = ''; // Reset for next upload
            }
        });
    }

    setupCodeBlockListeners();
    setupDragDropListeners();
    setupFileActionListeners();

    // Request highlighting
    document.querySelectorAll('.code-block').forEach(block => {
        const id = block.getAttribute('data-id');
        const encodedCode = block.getAttribute('data-code');
        const code = decodeCode(encodedCode);
        const lang = block.getAttribute('data-lang') || 'text';
        
        vscode.postMessage({
            type: 'highlightCode',
            id: id,
            code: code,
            language: lang,
        });
    });

    // Scroll listener
    const messagesContainer = document.getElementById('messagesContainer');
    if (messagesContainer) {
        messagesContainer.addEventListener('scroll', handleScroll);
    }
}

function setupDragDropListeners() {
    const chatContainer = document.getElementById('chatContainer');
    const dropZoneOverlay = document.getElementById('dropZoneOverlay');
    
    if (!chatContainer || !dropZoneOverlay) return;
    
    let dragCounter = 0;
    
    chatContainer.addEventListener('dragenter', (e) => {
        e.preventDefault();
        e.stopPropagation();
        dragCounter++;
        if (e.dataTransfer.types.includes('Files')) {
            dropZoneOverlay.classList.add('active');
        }
    });
    
    chatContainer.addEventListener('dragleave', (e) => {
        e.preventDefault();
        e.stopPropagation();
        dragCounter--;
        if (dragCounter === 0) {
            dropZoneOverlay.classList.remove('active');
        }
    });
    
    chatContainer.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.stopPropagation();
    });
    
    chatContainer.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
        dragCounter = 0;
        dropZoneOverlay.classList.remove('active');
        
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            uploadFile(files[0]);
        }
    });
}

function uploadFile(file) {
    if (!state.currentChat) {
        return;
    }
    
    const tempId = 'file-' + Date.now() + '-' + uuidv4();
    const tempMessage = {
        id: tempId,
        content: file.name,
        type: 'file',
        createdAt: new Date().toISOString(),
        sender: state.currentUser,
        status: 'pending',
        file: {
            id: tempId,
            originalName: file.name,
            mimeType: file.type || 'application/octet-stream',
            size: file.size
        }
    };

    state.messages.push(tempMessage);
    appendMessages([tempMessage]);
    scrollToBottom();

    // Send file to extension for upload
    const reader = new FileReader();
    reader.onerror = (e) => {
        // Handle error silently or show toast handled by error listener?
        // console.error('FileReader error:', e); 
    };
    reader.onload = () => {
        const base64 = reader.result.split(',')[1];
        vscode.postMessage({
            type: 'uploadFile',
            fileName: file.name,
            mimeType: file.type || 'application/octet-stream',
            size: file.size,
            data: base64,
            chatType: state.currentChat.type,
            chatId: state.currentChat.id,
            tempId: tempId
        });
    };
    reader.readAsDataURL(file);
}

function setupFileActionListeners() {
    // Use event delegation
    document.addEventListener('click', (e) => {
        const openBtn = e.target.closest('.file-open-vscode-btn');
        const downloadBtn = e.target.closest('.file-download-btn');
        
        if (openBtn) {
            e.stopPropagation();
            const fileId = openBtn.getAttribute('data-file-id');
            const filename = openBtn.getAttribute('data-filename');
            vscode.postMessage({
                type: 'openFileInVscode',
                fileId: fileId,
                filename: filename
            });
        }
        
        if (downloadBtn) {
            e.stopPropagation();
            const fileId = downloadBtn.getAttribute('data-file-id');
            const filename = downloadBtn.getAttribute('data-filename');
            vscode.postMessage({
                type: 'downloadFile',
                fileId: fileId,
                filename: filename
            });
        }
    });
}

function sendMessage() {
    const input = document.getElementById('messageInput');
    const content = input.value.trim();

    if (!content || !state.currentChat) {
        return;
    }

    input.value = '';
    
    const tempId = 'temp-' + Date.now() + '-' + uuidv4();
    const tempMessage = {
        id: tempId,
        content: content,
        type: 'text',
        createdAt: new Date().toISOString(),
        sender: state.currentUser,
        status: 'pending' 
    };

    state.messages.push(tempMessage);
    appendMessages([tempMessage]);
    scrollToBottom();

    vscode.postMessage({
        type: 'sendMessage',
        content,
        chatType: state.currentChat.type,
        chatId: state.currentChat.id,
        tempId: tempId
    });
}

function handleScroll() {
    const container = document.getElementById('messagesContainer');
    if (!container || state.loadingMore || !state.hasMore) {
        return;
    }

    if (container.scrollTop < 50) {
        loadMoreMessages();
    }
}

function loadMoreMessages() {
    if (state.loadingMore || !state.hasMore || !state.currentChat || state.messages.length === 0) {
        return;
    }

    state.loadingMore = true;
    
    const oldestMessage = state.messages[0];
    const cursor = oldestMessage.createdAt;

    showLoadingIndicator();

    vscode.postMessage({
        type: 'loadMoreMessages',
        chatType: state.currentChat.type,
        chatId: state.currentChat.id,
        cursor: cursor,
    });
}

function setupCodeBlockListeners() {
    document.querySelectorAll('.code-copy-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const codeBlock = btn.closest('.code-block');
            const encodedCode = codeBlock.getAttribute('data-code');
            const code = decodeCode(encodedCode);
            navigator.clipboard.writeText(code).then(() => {
                const originalText = btn.textContent;
                btn.textContent = '✓';
                btn.classList.add('copied');
                setTimeout(() => {
                    btn.textContent = originalText;
                    btn.classList.remove('copied');
                }, 2000);
            });
        });
    });

    document.querySelectorAll('.code-open-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const codeBlock = btn.closest('.code-block');
            const encodedCode = codeBlock.getAttribute('data-code');
            const code = decodeCode(encodedCode);
            const lang = codeBlock.getAttribute('data-lang') || 'text';
            vscode.postMessage({
                type: 'openInEditor',
                code: code,
                language: lang,
            });
        });
    });
}

// Global scope logic for retry
window.retryMessage = function(tempId) {
    const msg = state.messages.find(m => m.id === tempId);
    if (msg) {
        msg.status = 'pending';
        render();
        
        vscode.postMessage({
            type: 'sendMessage',
            content: msg.content,
            chatType: state.currentChat.type,
            chatId: state.currentChat.id,
            tempId: tempId
        });
    }
};
