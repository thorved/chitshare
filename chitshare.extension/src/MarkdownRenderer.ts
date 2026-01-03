import { marked } from 'marked';

/**
 * Configure marked for safe HTML output
 */
marked.setOptions({
    breaks: true,
    gfm: true,
});

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text: string): string {
    const map: Record<string, string> = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;',
    };
    return text.replace(/[&<>"']/g, (m) => map[m]);
}

/**
 * Render markdown to HTML with syntax highlighting
 */
export async function renderMarkdown(content: string): Promise<string> {
    try {
        // Use marked to parse markdown
        const html = await marked.parse(content);
        return html;
    } catch (error) {
        // Fallback to escaped plain text
        return `<p>${escapeHtml(content)}</p>`;
    }
}

/**
 * Get a preview of markdown content (first line, no formatting)
 */
export function getPreview(content: string, maxLength: number = 50): string {
    // Remove markdown formatting for preview
    const plain = content
        .replace(/```[\s\S]*?```/g, '[code]')
        .replace(/`[^`]+`/g, '[code]')
        .replace(/\*\*([^*]+)\*\*/g, '$1')
        .replace(/\*([^*]+)\*/g, '$1')
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
        .replace(/#+\s/g, '')
        .replace(/\n/g, ' ')
        .trim();

    if (plain.length <= maxLength) {
        return plain;
    }
    return plain.substring(0, maxLength - 3) + '...';
}

/**
 * Format date for display
 */
export function formatDate(dateString: string): string {
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

/**
 * Generate initials from username
 */
export function getInitials(username: string): string {
    return username
        .split(/[\s_-]+/)
        .map((word) => word.charAt(0).toUpperCase())
        .slice(0, 2)
        .join('');
}
