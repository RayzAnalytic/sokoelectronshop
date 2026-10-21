'use client';

import { useEffect, useState } from 'react';
import { api, ApiError, type Me } from '@/lib/api';

interface AuthCache {
    user: Me | null;
    resolved: boolean;
}

let cache: AuthCache = {
    user: null,
    resolved: false,
};

let inflight: Promise<Me | null> | null = null;

const subscribers = new Set<(next: AuthCache) => void>();

function publish(next: AuthCache) {
    cache = next;
    for (const notify of subscribers) {
        notify(next);
    }
}

async function fetchMe(): Promise<Me | null> {
    try {
        return await api.me();
    } catch (err) {
        if (err instanceof ApiError && err.status >= 500) {
            throw err;
        }
        throw err;
    }
}

export interface UseAuthResult {
    me: Me | null;
    loading: boolean;
    isSignedIn: boolean;
    refresh: () => Promise<void>;
}

export function useAuth(): UseAuthResult {
    const [me, setMe] = useState<Me | null>(cache.user);
    const [loading, setLoading] = useState(!cache.resolved);

    useEffect(() => {
        if (cache.resolved) {
            setMe(cache.user);
            setLoading(false);
        }

        const notify = (next: AuthCache) => {
            setMe(next.user);
            setLoading(false);
        };
        subscribers.add(notify);

        if (!cache.resolved && !inflight) {
            inflight = fetchMe()
                .then((user) => {
                    publish({ user, resolved: true });
                    return user;
                })
                .catch((err) => {
                    publish({ user: null, resolved: false });
                    throw err;
                })
                .finally(() => {
                    inflight = null;
                });
        }

        if (inflight) {
            inflight
                .then((user) => {
                    setMe(user);
                    setLoading(false);
                })
                .catch(() => {
                    setMe(null);
                    setLoading(false);
                });
        }

        return () => {
            subscribers.delete(notify);
        };
    }, []);

    const refresh = async () => {
        setLoading(true);
        try {
            const user = await fetchMe();
            publish({ user, resolved: true });
        } catch {
            publish({ user: null, resolved: false });
        } finally {
            setLoading(false);
        }
    };

    return {
        me,
        loading,
        isSignedIn: me !== null,
        refresh,
    };
}

export async function refreshAuth(): Promise<Me | null> {
    try {
        const user = await fetchMe();
        publish({ user, resolved: true });
        return user;
    } catch {
        publish({ user: null, resolved: false });
        return null;
    }
}

export function invalidateAuthCache(): void {
    publish({ user: null, resolved: true });
}

export function getCachedUser(): Me | null {
    return cache.user;
}

export function isAuthCacheResolved(): boolean {
    return cache.resolved;
}