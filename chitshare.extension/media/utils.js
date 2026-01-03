// Utility functions

export function uuidv4() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

export function escapeHtml(text) {
    if (!text) {
        return '';
    }
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Escape for use in HTML attributes (handles quotes)
export function escapeAttr(text) {
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
export function encodeCode(code) {
    try {
        return btoa(unescape(encodeURIComponent(code)));
    } catch {
        return btoa(code);
    }
}

// Decode code from Base64
export function decodeCode(encoded) {
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

export function getInitials(name) {
    if (!name) {
        return '?';
    }
    return name
        .split(/[\s_-]+/)
        .map(word => word.charAt(0).toUpperCase())
        .slice(0, 2)
        .join('');
}

export function getPreview(content) {
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

export function formatTime(dateString) {
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
