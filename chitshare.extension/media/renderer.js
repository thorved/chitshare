// Renderer Logic
import { state } from './state.js';
import * as Components from './ui-components.js';
import { attachLoginListeners, attachSettingsListeners, attachChatListListeners, attachChatListeners, attachUserSearchListeners } from './event-handlers.js';
import { escapeHtml, decodeCode } from './utils.js';
import { getVsCodeApi } from './vscode-api.js';

const app = document.getElementById('app');
const vscode = getVsCodeApi(); // Need this for highlighting event calls

export function appendMessages(messages) {
    const container = document.getElementById('messagesContainer');
    if (!container) return;

    // Remove empty state if present
    const emptyState = container.querySelector('.empty-state');
    if (emptyState) {
        emptyState.remove();
    }

    // Append new messages
    const fragment = document.createRange().createContextualFragment(
        messages.map(msg => Components.MessageComponent(msg, state.currentUser)).join('')
    );
    
    container.appendChild(fragment);

    // Setup listeners for new messages
    // Note: We need to target only the new ones or re-run setup.
    // Querying all .code-block in container is safe/idempotent if we re-attach, 
    // but better to limit if possible. For simplicity, we can re-run highlight request logic for new blocks?
    // Actually `attachChatListeners` sets up listeners on the whole doc/container or delegates?
    // In `event-handlers.js`, it does `document.querySelectorAll('.code-copy-btn')`.
    // We need to re-run that setup for *new* elements.
    // We'll export a helper for that.
    
    setupDynamicListeners(container);
}

export function prependMessages(messages) {
    const container = document.getElementById('messagesContainer');
    if (!container) return;
    
    const oldHeight = container.scrollHeight;

    const fragment = document.createRange().createContextualFragment(
        messages.map(msg => Components.MessageComponent(msg, state.currentUser)).join('')
    );
    
    container.insertBefore(fragment, container.firstChild);
    
    const newHeight = container.scrollHeight;
    container.scrollTop = newHeight - oldHeight;

    setupDynamicListeners(container);
}

export function replaceMessage(oldId, newMessage) {
    const container = document.getElementById('messagesContainer');
    if (!container) return;

    const oldEl = container.querySelector(`.message[data-id="${oldId}"]`);
    if (oldEl) {
        // Option 1: Replace entire element
        // const newHTML = Components.MessageComponent(newMessage, state.currentUser);
        // oldEl.outerHTML = newHTML;
        // BUT outerHTML replacement destroys the element, we need to re-attach listeners.
        
        // Option 2: Update attributes and content (cleaner for transitions)
        oldEl.setAttribute('data-id', newMessage.id);
        oldEl.classList.remove('pending', 'error');
        // Re-render content? The content might be same, just ID and status changed.
        // If content changed (e.g. server sanitized it), we should update.
        // For simplicity, let's swap outerHTML.
        
        const fragment = document.createRange().createContextualFragment(
            Components.MessageComponent(newMessage, state.currentUser)
        );
        oldEl.replaceWith(fragment);
        
        setupDynamicListeners(container);
    }
}

// Function to attach listeners to code blocks (reused from event-handlers, but moved here or duplicated)
// Ideally this logic belongs in `renderer.js` since it touches DOM.
function setupDynamicListeners(container) {
    // We can just re-run this safely on the container
    container.querySelectorAll('.code-copy-btn').forEach(btn => {
        // Remove old to prevent double binding? 
        // `addEventListener` acts up? cloneNode?
        // Simpler: use event delegation on the container! 
        // But `attachChatListeners` uses direct attachment.
        // Let's stick to direct attachment for now but check if already processed?
        // or just let it be, worst case double copy?
        // Better: add a class 'initialized'
        if (btn.classList.contains('js-init')) return;
        btn.classList.add('js-init');
        
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

    container.querySelectorAll('.code-open-btn').forEach(btn => {
        if (btn.classList.contains('js-init')) return;
        btn.classList.add('js-init');
        
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
    
    // Request highlighting for *unhighlighted* or all blocks
    // Code blocks don't have 'js-init' but we can just re-request.
    // The extension side handles duplications or we can check.
    container.querySelectorAll('.code-block').forEach(block => {
        if (block.classList.contains('highlight-requested')) return;
        block.classList.add('highlight-requested');
        
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
}

export function render() {
    switch (state.currentView) {
        case 'loading':
            app.innerHTML = Components.LoadingComponent();
            break;
        case 'settings':
            app.innerHTML = Components.SettingsComponent();
            attachSettingsListeners();
            break;
        case 'login':
            app.innerHTML = Components.LoginComponent();
            attachLoginListeners();
            break;
        case 'chat-list':
            app.innerHTML = Components.ChatListComponent(state.currentUser, state.conversations, state.groups);
            attachChatListListeners();
            break;
        case 'chat':
            app.innerHTML = Components.ChatComponent(state.currentChat, state.messages, state.currentUser);
            attachChatListeners();
            break;
        case 'user-search':
            app.innerHTML = Components.UserSearchComponent(state.searchResults);
            attachUserSearchListeners();
            break;
    }
}

export function renderLoginError(error) {
    const errorDiv = document.getElementById('loginError');
    if (errorDiv) {
        errorDiv.innerHTML = `<div class="login-error">${escapeHtml(error)}</div>`;
    }
    const loginBtn = document.getElementById('loginBtn');
    if (loginBtn) {
        loginBtn.disabled = false;
        loginBtn.textContent = 'Sign In';
    }
}

export function scrollToBottom() {
    const container = document.getElementById('messagesContainer');
    if (container) {
        container.scrollTop = container.scrollHeight;
    }
}

export function showLoadingIndicator() {
    const container = document.getElementById('messagesContainer');
    if (!container) return;

    const existingLoader = container.querySelector('.loading-more');
    if (!existingLoader) {
        const loader = document.createElement('div');
        loader.className = 'loading-more';
        loader.innerHTML = '<div class="spinner"></div>';
        container.insertBefore(loader, container.firstChild);
    }
}

export function hideLoadingIndicator() {
    const loader = document.querySelector('.loading-more');
    if (loader) {
        loader.remove();
    }
}

export function updateCodeBlock(id, html) {
    const codeContent = document.querySelector(`.code-block[data-id="${id}"] .code-content`);
    if (codeContent) {
        codeContent.innerHTML = html;
    }
}
