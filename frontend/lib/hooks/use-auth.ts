// lib/hooks/use-auth.ts
'use client';

import { useEffect, useState } from 'react';
import { api, ApiError, type Me } from '@/lib/api';

// ─────────────────────────────────────────────────────────────────────────────
// Module-level cache
//
// Every component that calls `useAuth()` shares one fetch of `/me/`.
// A page with 24 product cards each rendering a `<WishlistButton />`
// would otherwise fire 24 requests — this collapses them to one.
//
// The cache is intentionally module-scoped, not React state. It lives
// for the lifetime of the JS module, which is the tab. A hard reload
// clears it (correct — auth could have changed server-side).
// ─────────────────────────────────────────────────────────────────────────────
interface AuthCache {
    /** The signed-in user, or null if not signed in. */
    user: Me | null;
    /** True once we've resolved at least once. */
    resolved: boolean;
}

let cache: AuthCache = {
    user: null,
    resolved: false,
};

/**
 * The in-flight `/me/` promise, if any. Multiple components mounting at
 * the same time all await the same promise instead of racing to fetch.
 * Cleared once it settles so a later forced refetch can start fresh.
 */
let inflight: Promise<Me | null> | null = null;

/**
 * Subscribers to auth changes. Every `useAuth()` instance registers a
 * setter. When `invalidateAuthCache()` runs (after login/logout), all
 * subscribers are notified so their components re-render.
 */
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
        // A network error isn't "signed out" — it's "we don't know".
        // Returning null would flash the signed-out UI. Rethrow so
        // callers can decide. `api.me()` already returns null for
        // 401/403, so anything reaching here is a real failure.
        if (err instanceof ApiError && err.status >= 500) {
            throw err;
        }
        throw err;
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────────────
export interface UseAuthResult {
    /** The signed-in user, or null if signed out. */
    me: Me | null;
    /** True while the initial check is in flight. */
    loading: boolean;
    /** Convenience — `me !== null`. */
    isSignedIn: boolean;
    /**
     * Force a refetch. Call after login, register, logout, or anything
     * that changes the session server-side. Other mounted `useAuth()`
     * consumers update automatically — no refetch needed from them.
     */
    refresh: () => Promise<void>;
}

export function useAuth(): UseAuthResult {
    // Initial state: use cache if we have it, otherwise default to
    // "loading" and start a fetch.
    const [me, setMe] = useState<Me | null>(cache.user);
    const [loading, setLoading] = useState(!cache.resolved);

    useEffect(() => {
        // If another component already resolved the cache before this
        // one mounted, adopt it immediately — no fetch, no flash.
        if (cache.resolved) {
            setMe(cache.user);
            setLoading(false);
        }

        // Register a subscriber so this component updates when
        // `refresh()` or `invalidateAuthCache()` is called elsewhere.
        const notify = (next: AuthCache) => {
            setMe(next.user);
            setLoading(false);
        };
        subscribers.add(notify);

        // Only kick off a fetch if we haven't resolved yet AND no
        // fetch is already in flight. Otherwise every component
        // mounting on the same page would trigger its own request.
        if (!cache.resolved && !inflight) {
            inflight = fetchMe()
                .then((user) => {
                    publish({ user, resolved: true });
                    return user;
                })
                .catch((err) => {
                    // Don't poison the cache — leave `resolved: false`
                    // so a later mount or a manual refresh retries.
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
                    // Swallow — the cache remains unresolved and the
                    // next mount will retry. The component renders as
                    // signed-out in the interim.
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

// ─────────────────────────────────────────────────────────────────────────────
// Imperative helpers
//
// Call these from outside React — e.g. from a login handler, a logout
// button's `onClick`, or the top of `WishlistBoot`'s merge effect.
// All mounted `useAuth()` consumers update automatically.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Refetch `/me/` and notify every subscriber. Call after login,
 * register, logout, or any server-side session change.
 */
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

/**
 * Immediately mark the cache as signed-out without a network call.
 * Use this in a logout handler before the server responds, so the UI
 * snaps to the signed-out state.
 */
export function invalidateAuthCache(): void {
    publish({ user: null, resolved: true });
}

/**
 * Read the current cached user without subscribing to changes.
 * Useful in event handlers that don't want to cause a re-render.
 * Returns `null` if the cache hasn't been populated yet.
 */
export function getCachedUser(): Me | null {
    return cache.user;
}

/**
 * True if the cache has been populated at least once. Handlers can use
 * this to skip a redundant `refreshAuth()` call.
 */
export function isAuthCacheResolved(): boolean {
    return cache.resolved;
}