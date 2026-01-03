import * as vscode from 'vscode';

export interface User {
    id: string;
    email: string;
    username: string;
    avatarUrl: string | null;
    isAdmin: boolean;
}

export interface LoginResponse {
    message: string;
    user: User;
    token: string;
}

export interface ApiError {
    error: string;
}

export class ApiClient {
    private context: vscode.ExtensionContext;
    private static TOKEN_KEY = 'chitshare.authToken';

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
    }

    /**
     * Get the server URL from settings
     */
    getServerUrl(): string {
        const config = vscode.workspace.getConfiguration('chitshare');
        return config.get<string>('serverUrl', '').replace(/\/$/, '');
    }

    /**
     * Get stored auth token
     */
    async getToken(): Promise<string | undefined> {
        return this.context.secrets.get(ApiClient.TOKEN_KEY);
    }

    /**
     * Store auth token securely
     */
    async setToken(token: string): Promise<void> {
        await this.context.secrets.store(ApiClient.TOKEN_KEY, token);
    }

    /**
     * Clear auth token
     */
    async clearToken(): Promise<void> {
        await this.context.secrets.delete(ApiClient.TOKEN_KEY);
    }

    /**
     * Check if user is logged in
     */
    async isLoggedIn(): Promise<boolean> {
        const token = await this.getToken();
        return !!token;
    }

    /**
     * Make authenticated API request
     */
    async request<T>(
        endpoint: string,
        options: {
            method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
            body?: unknown;
            requiresAuth?: boolean;
        } = {}
    ): Promise<T> {
        const { method = 'GET', body, requiresAuth = true } = options;
        const serverUrl = this.getServerUrl();

        if (!serverUrl) {
            throw new Error('Server URL not configured. Please set chitshare.serverUrl in settings.');
        }

        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
        };

        if (requiresAuth) {
            const token = await this.getToken();
            if (!token) {
                throw new Error('Not authenticated');
            }
            headers['Authorization'] = `Bearer ${token}`;
        }

        const url = `${serverUrl}${endpoint}`;
        
        try {
            const response = await fetch(url, {
                method,
                headers,
                body: body ? JSON.stringify(body) : undefined,
            });

            const data = await response.json();

            if (!response.ok) {
                if (response.status === 401) {
                    await this.clearToken();
                    throw new Error('Session expired. Please login again.');
                }
                throw new Error((data as ApiError).error || 'Request failed');
            }

            return data as T;
        } catch (error) {
            if (error instanceof TypeError && error.message.includes('fetch')) {
                throw new Error(`Cannot connect to server at ${serverUrl}`);
            }
            throw error;
        }
    }

    /**
     * Login with email and password
     */
    async login(email: string, password: string): Promise<User> {
        const response = await this.request<LoginResponse>('/api/auth/login', {
            method: 'POST',
            body: { email, password },
            requiresAuth: false,
        });

        await this.setToken(response.token);
        return response.user;
    }

    /**
     * Logout and clear token
     */
    async logout(): Promise<void> {
        await this.clearToken();
    }

    /**
     * Get current user info
     */
    async getCurrentUser(): Promise<User> {
        const response = await this.request<{ user: User }>('/api/auth/me');
        return response.user;
    }
}
