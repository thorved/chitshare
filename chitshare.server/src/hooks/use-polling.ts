import { useState, useEffect, useRef } from 'react';

export function useNotificationPolling({ 
    onUpdates, 
    enabled = true, 
    interval = 3000 
}: { 
    onUpdates: () => void; 
    enabled?: boolean; 
    interval?: number; 
}) {
    const lastPollTimeRef = useRef<string | null>(null);

    useEffect(() => {
        if (!enabled) return;

        const poll = async () => {
            try {
                const url = new URL('/api/notifications/status', window.location.origin);
                if (lastPollTimeRef.current) {
                    url.searchParams.set('since', lastPollTimeRef.current);
                }

                // Get token
                const token = document.cookie
                    .split("; ")
                    .find((row) => row.startsWith("auth_token="))
                    ?.split("=")[1];

                const headers: Record<string, string> = {};
                if (token) {
                    headers['Authorization'] = `Bearer ${token}`;
                }

                const res = await fetch(url.toString(), {
                    headers
                });
                
                if (res.status === 401) {
                    // Auth failed, maybe stop polling or just log
                    console.error('Polling unauthorized');
                    return;
                }
                if (res.ok) {
                    const data = await res.json();
                    
                    if (data.timestamp) {
                        lastPollTimeRef.current = data.timestamp;
                    } else {
                        lastPollTimeRef.current = new Date().toISOString();
                    }

                    if (data.hasUpdates) {
                        onUpdates();
                    }
                }
            } catch (error) {
                console.error('Polling error:', error);
            }
        };

        // Initial set of time to now, to avoid fetching old history as "new" if this is a fresh load?
        // Actually, if we just landed, we want to know about updates since *now*.
        if (!lastPollTimeRef.current) {
            lastPollTimeRef.current = new Date().toISOString();
        }

        const timer = setInterval(poll, interval);
        return () => clearInterval(timer);
    }, [enabled, interval, onUpdates]);
}
