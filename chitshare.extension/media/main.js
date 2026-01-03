// Chitshare VS Code Extension - Webview Script

(function () {
    // @ts-ignore
    const vscode = acquireVsCodeApi();

    // State management
    let currentView = 'loading'; // 'loading' | 'settings' | 'login' | 'chat-list' | 'chat'
    let currentUser = null;
    let conversations = [];
    let groups = [];
    let currentChat = null;
    let messages = [];
    let codeBlockCounter = 0;

    // DOM elements
    const app = document.getElementById('app');

    // ============================================
    // CODE DETECTION PATTERNS (from server)
    // ============================================

    // Language aliases
    const LANG_ALIASES = {
        js: 'javascript',
        ts: 'typescript',
        py: 'python',
        rb: 'ruby',
        yml: 'yaml',
        sh: 'bash',
        zsh: 'bash',
        shell: 'bash',
        kt: 'kotlin',
        rs: 'rust',
        cs: 'csharp',
        md: 'markdown',
    };

    // JavaScript/TypeScript patterns
    const JS_TS_PATTERNS = [
        /\b(const|let|var)\s+\w+\s*=/,
        /\bfunction\s+\w+\s*\(/,
        /\b(async\s+)?function\s*\(/,
        /=>\s*[{(]/,
        /\bclass\s+\w+/,
        /\b(import|export)\s+(default\s+)?[{*\w]/,
        /\bconsole\.(log|error|warn|info|debug)\s*\(/,
        /\b(await|async)\b/,
        /\b(interface|type)\s+\w+\s*[={<]/,
        /:\s*(string|number|boolean|any|void|never)\b/,
        /\bnew\s+\w+\s*\(/,
        /\.(map|filter|reduce|forEach|find|some|every)\s*\(/,
        /\b(try|catch|finally)\s*[{(]/,
        /\b(if|else if|else)\s*[({]/,
        /\bthrow\s+new\s+\w*Error/,
        /\breturn\s+[^;]*;?/,
        /\bmodule\.exports\b/,
        /require\s*\(\s*['"`]/,
        /\bPromise\.(all|race|resolve|reject)\s*\(/,
        /\.then\s*\(\s*(async\s*)?\(/,
        /\bsetTimeout|setInterval|clearTimeout|clearInterval\b/,
        /document\.(getElementById|querySelector|createElement)\s*\(/,
        /window\.\w+/,
        /\bevent\.(preventDefault|stopPropagation)\s*\(/,
    ];

    // React/JSX patterns
    const REACT_PATTERNS = [
        /<[A-Z]\w*[\s/>]/,
        /className\s*=\s*[{'"]/,
        /\buseState|useEffect|useCallback|useMemo|useRef\b/,
        /\bReact\.\w+/,
        /<\/\w+>/,
        /\{[^}]*\}/,
        /onClick|onChange|onSubmit|onKeyDown/,
        /props\.\w+/,
    ];

    // Python patterns
    const PYTHON_PATTERNS = [
        /\bdef\s+\w+\s*\([^)]*\)\s*:/,
        /\bclass\s+\w+(\([^)]*\))?\s*:/,
        /\bimport\s+\w+|from\s+\w+\s+import/,
        /\bif\s+.+:\s*$/m,
        /\bfor\s+\w+\s+in\s+/,
        /\bwhile\s+.+:/,
        /\bprint\s*\(/,
        /\bself\.\w+/,
        /\b(True|False|None)\b/,
        /\blambda\s+\w+\s*:/,
        /\bwith\s+.+\s+as\s+\w+:/,
        /\b(try|except|finally|raise)\b.*:/,
        /\basync\s+def\b/,
        /\bawait\s+\w+/,
        /__\w+__/,
        /\blist|dict|tuple|set\s*\(/,
        /\[\s*\w+\s+for\s+\w+\s+in\s+/,
    ];

    // Java/Kotlin patterns
    const JAVA_KOTLIN_PATTERNS = [
        /\bpublic\s+(static\s+)?(void|class|interface)\b/,
        /\bprivate\s+(final\s+)?\w+\s+\w+/,
        /\bSystem\.(out|err)\.(print|println)\s*\(/,
        /\bString\s+\w+\s*=/,
        /\bnew\s+\w+(<[^>]+>)?\s*\(/,
        /\bpackage\s+[\w.]+;/,
        /\b(extends|implements)\s+\w+/,
        /\b@\w+(\([^)]*\))?/,
        /\bfun\s+\w+\s*\(/,
        /\bval\s+\w+\s*[:=]/,
        /\bvar\s+\w+\s*[:=]/,
        /\bdata\s+class\b/,
    ];

    // C/C++ patterns
    const C_CPP_PATTERNS = [
        /#include\s*[<"]/,
        /\bint\s+main\s*\(/,
        /\b(int|char|float|double|void|long)\s+\w+\s*[=;(]/,
        /\bstd::\w+/,
        /\bcout\s*<</,
        /\bcin\s*>>/,
        /\bprintf\s*\(/,
        /\bscanf\s*\(/,
        /\bstruct\s+\w+\s*\{/,
        /\btemplate\s*</,
        /\bclass\s+\w+\s*:\s*(public|private|protected)/,
        /\b(nullptr|NULL)\b/,
        /\bsizeof\s*\(/,
        /\*\w+\s*=|&\w+/,
        /malloc\s*\(|free\s*\(/,
    ];

    // Go patterns
    const GO_PATTERNS = [
        /\bpackage\s+\w+$/m,
        /\bfunc\s+(\([^)]+\)\s+)?\w+\s*\(/,
        /\bimport\s+\(/,
        /\bgo\s+func\s*\(/,
        /\bchan\s+\w+/,
        /\bdefer\s+\w+/,
        /\b(make|append|len|cap)\s*\(/,
        /\btype\s+\w+\s+(struct|interface)\s*\{/,
        /\brange\s+\w+/,
        /\b(select|case)\s*.*:/,
        /\bfmt\.(Print|Println|Printf|Sprintf)\s*\(/,
        /:=|err\s*!=\s*nil/,
    ];

    // Rust patterns
    const RUST_PATTERNS = [
        /\bfn\s+\w+\s*(<[^>]+>)?\s*\(/,
        /\blet\s+(mut\s+)?\w+\s*[:=]/,
        /\bimpl\s+(<[^>]+>\s+)?\w+/,
        /\bstruct\s+\w+\s*[<{]/,
        /\benum\s+\w+\s*\{/,
        /\b(pub|priv)\s+(fn|struct|enum|trait)\b/,
        /\bmatch\s+\w+\s*\{/,
        /\buse\s+(crate|super|self)?\s*::/,
        /\b(Option|Result|Vec|String|Box)\s*[<:]/,
        /->\s*\w+/,
        /\bmod\s+\w+/,
        /println!\s*\(|format!\s*\(/,
        /\bunwrap\s*\(\)|expect\s*\(/,
        /&mut\s+\w+|&\w+/,
    ];

    // SQL patterns
    const SQL_PATTERNS = [
        /\bSELECT\s+(\*|\w+)/i,
        /\bFROM\s+\w+/i,
        /\bWHERE\s+\w+/i,
        /\b(INNER|LEFT|RIGHT|FULL)\s+JOIN\b/i,
        /\bINSERT\s+INTO\s+\w+/i,
        /\bUPDATE\s+\w+\s+SET\b/i,
        /\bDELETE\s+FROM\s+\w+/i,
        /\bCREATE\s+(TABLE|INDEX|VIEW|DATABASE)\b/i,
        /\bALTER\s+TABLE\b/i,
        /\bDROP\s+TABLE\b/i,
        /\bGROUP\s+BY\b/i,
        /\bORDER\s+BY\b/i,
    ];

    // CSS patterns
    const CSS_PATTERNS = [
        /^\s*[.#]?\w+(-\w+)*\s*\{/m,
        /\b(margin|padding|color|background|font|border|display|position)\s*:/i,
        /\burl\s*\(/,
        /\b(px|em|rem|%|vh|vw)\b/,
        /\b(flex|grid|block|inline|none)\b/,
        /\b@media\s+/,
        /\b@keyframes\s+\w+/,
        /\brgba?\s*\(/,
        /\bvar\s*\(--\w+\)/,
    ];

    // HTML patterns
    const HTML_PATTERNS = [
        /<!DOCTYPE\s+html>/i,
        /<html[^>]*>/i,
        /<(head|body|div|span|p|a|img|ul|ol|li|table|tr|td|th|form|input|button|script|style|link|meta)[^>]*>/i,
        /<\/\w+>/,
        /\s+(id|class|src|href|alt|title|style)\s*=/,
    ];

    // JSON patterns
    const JSON_PATTERNS = [
        /^\s*\{[\s\S]*\}\s*$/,
        /^\s*\[[\s\S]*\]\s*$/,
        /"[\w]+":\s*("[^"]*"|\d+|true|false|null|\{|\[)/,
    ];

    // Shell/Bash patterns
    const SHELL_PATTERNS = [
        /^#!/,
        /\$\(.*\)/,
        /\$\{?\w+\}?/,
        /\becho\s+/,
        /\b(cd|ls|mkdir|rm|mv|cp|cat|grep|awk|sed)\s+/,
        /\bif\s+\[\s+/,
        /\bdo\s*$/m,
        /\b(exit|export|source|alias)\s+/,
        /\|\s*\w+/,
        />\s*\w+|<\s*\w+/,
    ];

    // YAML patterns
    const YAML_PATTERNS = [
        /^\s*\w+:\s+.+$/m,
        /^\s*-\s+\w+/m,
        /^\s{2,}\w+:/m,
        /:\s*\|$/m,
        /:\s*>$/m,
    ];

    // Patterns that indicate NOT code
    const NOT_CODE_PATTERNS = [
        /^(hi|hello|hey|thanks|ok|yes|no|sure|okay|please|sorry|thank you|bye|goodbye)[\s!?.]*$/i,
        /^(what|how|why|when|where|who|can|could|would|should|is|are|do|does|did|have|has|had)[^{};=<>]*\?$/i,
        /^(I|you|we|they|he|she|it)\s+(am|is|are|was|were|will|would|can|could|should|have|has|had)\s+[^{};=<>]*$/i,
        /^[\w\s,.'!?-]{1,50}$/,
    ];

    function matchPatterns(text, patterns) {
        let count = 0;
        for (const pattern of patterns) {
            if (pattern.test(text)) {
                count++;
            }
        }
        return count;
    }

    function detectLanguage(code) {
        const scores = {
            javascript: matchPatterns(code, JS_TS_PATTERNS),
            typescript: matchPatterns(code, JS_TS_PATTERNS) + (code.includes(': string') || code.includes(': number') || code.includes('interface ') ? 3 : 0),
            tsx: matchPatterns(code, JS_TS_PATTERNS) + matchPatterns(code, REACT_PATTERNS),
            python: matchPatterns(code, PYTHON_PATTERNS),
            java: matchPatterns(code, JAVA_KOTLIN_PATTERNS),
            cpp: matchPatterns(code, C_CPP_PATTERNS),
            go: matchPatterns(code, GO_PATTERNS),
            rust: matchPatterns(code, RUST_PATTERNS),
            sql: matchPatterns(code, SQL_PATTERNS),
            css: matchPatterns(code, CSS_PATTERNS),
            html: matchPatterns(code, HTML_PATTERNS),
            json: matchPatterns(code, JSON_PATTERNS),
            bash: matchPatterns(code, SHELL_PATTERNS),
            yaml: matchPatterns(code, YAML_PATTERNS),
        };

        let maxLang = 'text';
        let maxScore = 0;
        for (const [lang, score] of Object.entries(scores)) {
            if (score > maxScore) {
                maxScore = score;
                maxLang = lang;
            }
        }
        return maxScore >= 1 ? maxLang : 'text';
    }

    function looksLikeCode(text) {
        if (text.length < 10) {
            return false;
        }

        for (const pattern of NOT_CODE_PATTERNS) {
            if (pattern.test(text.trim())) {
                return false;
            }
        }

        const allPatterns = [
            ...JS_TS_PATTERNS, ...REACT_PATTERNS, ...PYTHON_PATTERNS,
            ...JAVA_KOTLIN_PATTERNS, ...C_CPP_PATTERNS, ...GO_PATTERNS,
            ...RUST_PATTERNS, ...SQL_PATTERNS, ...CSS_PATTERNS,
            ...HTML_PATTERNS, ...JSON_PATTERNS, ...SHELL_PATTERNS, ...YAML_PATTERNS,
        ];

        let codeScore = matchPatterns(text, allPatterns);

        const hasMultipleLines = (text.match(/\n/g) || []).length >= 1;
        const hasIndentation = /\n\s{2,}/.test(text);
        const hasBraces = /[{}]/.test(text);
        const hasSemicolons = /;\s*(\n|$)/.test(text);
        const hasParens = /\([^)]*\)/.test(text);
        const hasOperators = /[=!<>]=|&&|\|\|/.test(text);

        if (hasIndentation) {
            codeScore += 3;
        }
        if (hasBraces && hasMultipleLines) {
            codeScore += 2;
        }
        if (hasSemicolons) {
            codeScore += 1;
        }
        if (hasOperators) {
            codeScore += 1;
        }
        if (hasParens && hasMultipleLines) {
            codeScore += 1;
        }

        return codeScore >= 2;
    }

    function parseMessage(content) {
        const parts = [];

        const regex = /```(\w*)\n?([\s\S]*?)```/g;
        let lastIndex = 0;
        let match;
        let hasExplicitBlocks = false;

        while ((match = regex.exec(content)) !== null) {
            hasExplicitBlocks = true;
            if (match.index > lastIndex) {
                const text = content.slice(lastIndex, match.index).trim();
                if (text) {
                    parts.push({ type: 'text', content: text });
                }
            }
            const rawLang = match[1].toLowerCase();
            const language = LANG_ALIASES[rawLang] || rawLang || 'text';
            parts.push({ type: 'code', language, code: match[2] });
            lastIndex = match.index + match[0].length;
        }

        if (hasExplicitBlocks) {
            if (lastIndex < content.length) {
                const text = content.slice(lastIndex).trim();
                if (text) {
                    parts.push({ type: 'text', content: text });
                }
            }
            return parts;
        }

        // Auto-detect code if no explicit blocks
        if (looksLikeCode(content)) {
            const language = detectLanguage(content);
            return [{ type: 'code', language, code: content }];
        }

        return [{ type: 'text', content }];
    }

    // Initialize
    init();

    function init() {
        // Restore state
        const state = vscode.getState();
        if (state) {
            currentView = state.currentView || 'loading';
            currentUser = state.currentUser;
            conversations = state.conversations || [];
            groups = state.groups || [];
            currentChat = state.currentChat;
            messages = state.messages || [];
        }

        // Listen for messages from extension
        window.addEventListener('message', handleMessage);

        // Request initial state
        vscode.postMessage({ type: 'ready' });
    }

    function saveState() {
        vscode.setState({
            currentView,
            currentUser,
            conversations,
            groups,
            currentChat,
            messages,
        });
    }

    function handleMessage(event) {
        const message = event.data;

        switch (message.type) {
            case 'init':
                handleInit(message);
                break;
            case 'loginSuccess':
                currentUser = message.user;
                currentView = 'chat-list';
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
                if (JSON.stringify(conversations) !== JSON.stringify(newConvs) ||
                    JSON.stringify(groups) !== JSON.stringify(newGroups)) {
                    conversations = newConvs;
                    groups = newGroups;
                    if (currentView === 'chat-list') {
                        render();
                    }
                }
                break;
            case 'messages':
                // Initial load - full render
                messages = message.messages || [];
                if (message.chat) {
                    currentChat = message.chat;
                }
                render();
                scrollToBottom();
                break;
            case 'newMessages':
                // Incremental update - only append new messages (no flicker)
                if (message.messages && message.messages.length > 0) {
                    const existingIds = new Set(messages.map(m => m.id));
                    const newMsgs = message.messages.filter(m => !existingIds.has(m.id));
                    if (newMsgs.length > 0) {
                        messages.push(...newMsgs);
                        appendMessages(newMsgs);
                        scrollToBottom();
                    }
                }
                break;
            case 'messageSent':
                // Check if message already exists (avoid duplicates)
                if (!messages.some(m => m.id === message.message.id)) {
                    messages.push(message.message);
                    appendMessages([message.message]);
                    scrollToBottom();
                }
                break;
            case 'error':
                showError(message.error);
                break;
            case 'logout':
                currentUser = null;
                currentView = 'login';
                conversations = [];
                groups = [];
                currentChat = null;
                messages = [];
                render();
                break;
            case 'highlightedCode':
                // Update the code block with highlighted HTML
                updateCodeBlock(message.id, message.html);
                break;
        }

        saveState();
    }

    function handleInit(message) {
        if (!message.serverConfigured) {
            currentView = 'settings';
        } else if (!message.isLoggedIn) {
            currentView = 'login';
        } else {
            currentUser = message.user;
            currentView = 'chat-list';
            vscode.postMessage({ type: 'loadConversations' });
        }
        render();
    }

    function render() {
        switch (currentView) {
            case 'loading':
                renderLoading();
                break;
            case 'settings':
                renderSettings();
                break;
            case 'login':
                renderLogin();
                break;
            case 'chat-list':
                renderChatList();
                break;
            case 'chat':
                renderChat();
                break;
        }
    }

    function renderLoading() {
        app.innerHTML = `
            <div class="app-container">
                <div class="loading">
                    <div class="spinner"></div>
                </div>
            </div>
        `;
    }

    function renderSettings() {
        app.innerHTML = `
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

        document.getElementById('openSettings').addEventListener('click', () => {
            vscode.postMessage({ type: 'openSettings' });
        });
    }

    function renderLogin() {
        app.innerHTML = `
            <div class="app-container">
                <div class="login-view">
                    <div class="login-header">
                        <div class="login-title">Chitshare</div>
                        <div class="login-subtitle">Sign in to start chatting</div>
                    </div>
                    <form class="login-form" id="loginForm">
                        <div id="loginError"></div>
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

        document.getElementById('loginForm').addEventListener('submit', handleLogin);
    }

    function renderLoginError(error) {
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

    function handleLogin(e) {
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
    }

    function renderChatList() {
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

        app.innerHTML = `
            <div class="app-container">
                <div class="header">
                    <div class="header-title">
                        💬 Chats
                    </div>
                    <div class="header-actions">
                        <button class="btn btn-icon" id="refreshBtn" title="Refresh">
                            ↻
                        </button>
                    </div>
                </div>
                ${userHtml}
                <div class="chat-list-view">
                    ${conversationsHtml}
                    ${groupsHtml}
                    ${emptyHtml}
                </div>
            </div>
        `;

        // Event listeners
        document.getElementById('refreshBtn')?.addEventListener('click', () => {
            vscode.postMessage({ type: 'loadConversations' });
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
    }

    function openChat(type, id) {
        currentView = 'chat';
        
        // Find chat info
        if (type === 'dm') {
            const conv = conversations.find(c => c.user.id === id);
            if (conv) {
                currentChat = {
                    type: 'dm',
                    id: id,
                    name: conv.user.username,
                    isOnline: conv.user.isOnline,
                    avatarUrl: conv.user.avatarUrl,
                };
            }
        } else {
            const group = groups.find(g => g.id === id);
            if (group) {
                currentChat = {
                    type: 'group',
                    id: id,
                    name: group.name,
                    avatarUrl: group.avatarUrl,
                };
            }
        }

        messages = [];
        render();

        vscode.postMessage({
            type: 'loadMessages',
            chatType: type,
            chatId: id,
        });
    }

    function renderChat() {
        if (!currentChat) {
            currentView = 'chat-list';
            render();
            return;
        }

        const statusText = currentChat.type === 'dm' 
            ? (currentChat.isOnline ? 'Online' : 'Offline')
            : '';

        // Reset code block counter for this render
        codeBlockCounter = 0;

        const messagesHtml = messages.map(msg => {
            const isOwn = currentUser && msg.sender.id === currentUser.id;
            return `
                <div class="message ${isOwn ? 'own' : ''}">
                    <div class="message-avatar">
                        ${msg.sender.avatarUrl 
                            ? `<img src="${msg.sender.avatarUrl}" alt="">` 
                            : getInitials(msg.sender.username)}
                    </div>
                    <div class="message-content">
                        ${!isOwn ? `<div class="message-sender">${escapeHtml(msg.sender.username)}</div>` : ''}
                        <div class="message-bubble">${formatMessageContent(msg.content)}</div>
                        <div class="message-time">${formatTime(msg.createdAt)}</div>
                    </div>
                </div>
            `;
        }).join('');

        app.innerHTML = `
            <div class="app-container">
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

        // Event listeners
        document.getElementById('backBtn').addEventListener('click', () => {
            currentView = 'chat-list';
            currentChat = null;
            messages = [];
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
            // Auto-resize textarea
            messageInput.style.height = 'auto';
            messageInput.style.height = Math.min(messageInput.scrollHeight, 120) + 'px';
        });

        sendBtn.addEventListener('click', sendMessage);

        // Set up code block event listeners
        setupCodeBlockListeners();

        // Request syntax highlighting for code blocks
        requestCodeHighlighting();

        scrollToBottom();
    }

    function setupCodeBlockListeners() {
        // Copy button listeners
        document.querySelectorAll('.code-copy-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const codeBlock = btn.closest('.code-block');
                const encodedCode = codeBlock.getAttribute('data-code');
                const code = decodeCode(encodedCode);
                copyToClipboard(code, btn);
            });
        });

        // Open in editor button listeners
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

    function copyToClipboard(text, button) {
        navigator.clipboard.writeText(text).then(() => {
            const originalText = button.textContent;
            button.textContent = '✓';
            button.classList.add('copied');
            setTimeout(() => {
                button.textContent = originalText;
                button.classList.remove('copied');
            }, 2000);
        });
    }

    function requestCodeHighlighting() {
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
    }

    function updateCodeBlock(id, html) {
        const codeContent = document.querySelector(`.code-block[data-id="${id}"] .code-content`);
        if (codeContent) {
            codeContent.innerHTML = html;
        }
    }

    function sendMessage() {
        const input = document.getElementById('messageInput');
        const content = input.value.trim();

        if (!content || !currentChat) {
            return;
        }

        input.value = '';
        input.style.height = 'auto';

        vscode.postMessage({
            type: 'sendMessage',
            content,
            chatType: currentChat.type,
            chatId: currentChat.id,
        });
    }

    // Append messages without full re-render (prevents flicker)
    function appendMessages(newMsgs) {
        const container = document.getElementById('messagesContainer');
        if (!container) {
            return;
        }

        // Remove empty state if present
        const emptyState = container.querySelector('.empty-state');
        if (emptyState) {
            emptyState.remove();
        }

        // Create and append each new message
        for (const msg of newMsgs) {
            const isOwn = currentUser && msg.sender.id === currentUser.id;
            const msgDiv = document.createElement('div');
            msgDiv.className = `message ${isOwn ? 'own' : ''}`;
            msgDiv.innerHTML = `
                <div class="message-avatar">
                    ${msg.sender.avatarUrl 
                        ? `<img src="${msg.sender.avatarUrl}" alt="">` 
                        : getInitials(msg.sender.username)}
                </div>
                <div class="message-content">
                    ${!isOwn ? `<div class="message-sender">${escapeHtml(msg.sender.username)}</div>` : ''}
                    <div class="message-bubble">${formatMessageContent(msg.content)}</div>
                    <div class="message-time">${formatTime(msg.createdAt)}</div>
                </div>
            `;
            container.appendChild(msgDiv);

            // Set up code block listeners for this message
            msgDiv.querySelectorAll('.code-copy-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const codeBlock = btn.closest('.code-block');
                    const encodedCode = codeBlock.getAttribute('data-code');
                    const code = decodeCode(encodedCode);
                    copyToClipboard(code, btn);
                });
            });

            msgDiv.querySelectorAll('.code-open-btn').forEach(btn => {
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

            // Request syntax highlighting for code blocks in this message
            msgDiv.querySelectorAll('.code-block').forEach(block => {
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
    }

    function scrollToBottom() {
        setTimeout(() => {
            const container = document.getElementById('messagesContainer');
            if (container) {
                container.scrollTop = container.scrollHeight;
            }
        }, 50);
    }

    // Utility functions
    function escapeHtml(text) {
        if (!text) {
            return '';
        }
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Escape for use in HTML attributes (handles quotes)
    function escapeAttr(text) {
        if (!text) {
            return '';
        }
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    // Encode code to Base64 for safe storage in attributes
    function encodeCode(code) {
        try {
            return btoa(unescape(encodeURIComponent(code)));
        } catch {
            return btoa(code);
        }
    }

    // Decode code from Base64
    function decodeCode(encoded) {
        try {
            return decodeURIComponent(escape(atob(encoded)));
        } catch {
            try {
                return atob(encoded);
            } catch {
                return encoded;
            }
        }
    }

    function getInitials(name) {
        if (!name) {
            return '?';
        }
        return name
            .split(/[\s_-]+/)
            .map(word => word.charAt(0).toUpperCase())
            .slice(0, 2)
            .join('');
    }

    function getPreview(content) {
        if (!content) {
            return '';
        }
        const plain = content
            .replace(/```[\s\S]*?```/g, '[code]')
            .replace(/`[^`]+`/g, '[code]')
            .replace(/\n/g, ' ')
            .trim();
        return plain.length > 40 ? plain.substring(0, 37) + '...' : plain;
    }

    function formatTime(dateString) {
        if (!dateString) {
            return '';
        }
        const date = new Date(dateString);
        const now = new Date();
        const diff = now.getTime() - date.getTime();
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));

        if (days === 0) {
            return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
        } else if (days === 1) {
            return 'Yesterday';
        } else if (days < 7) {
            return date.toLocaleDateString(undefined, { weekday: 'short' });
        } else {
            return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
        }
    }

    function formatMessageContent(content) {
        if (!content) {
            return '';
        }
        
        // Parse the message using the same logic as the server
        const parts = parseMessage(content);
        
        let html = '';
        
        for (const part of parts) {
            if (part.type === 'code') {
                const blockId = `code-${codeBlockCounter++}`;
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

    function showError(error) {
        console.error('Error:', error);
    }
})();
