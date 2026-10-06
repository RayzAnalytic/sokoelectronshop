import { NextRequest, NextResponse } from 'next/server';

/**
 * Proxy for the legacy `/api/products/` URL.
 *
 * The storefront now talks to Django directly at `/api/catalog/products/`
 * via `catalogApi.products.list()` in `lib/api.ts`. This route exists only
 * to keep any legacy callers of `/api/products/` working during the
 * transition. It forwards query params verbatim and passes the backend's
 * DRF envelope (`{ count, next, previous, results }`) straight through.
 *
 * Delete this file once no caller hits `/api/products/`.
 *
 * NOTE: This proxy does NOT strip the Next.js origin's cookies, so
 * session-authenticated requests pass through. Django's CORS still
 * applies on the backend side because the browser sees the request to
 * the Next.js origin, and Next.js initiates a server-to-server fetch —
 * which Django accepts as a same-origin call only if you allow it.
 * Since the catalog endpoint is public, this is a non-issue today.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? '';

export async function GET(req: NextRequest) {
    if (!API_BASE) {
        return NextResponse.json(
            {
                detail:
                    'NEXT_PUBLIC_API_BASE_URL is not set. Either configure it ' +
                    'or delete this proxy route.',
            },
            { status: 500 },
        );
    }

    // Preserve every query param the caller sent, including `full=1`
    // and the page/limit/sort/stock/q combination.
    const searchParams = new URL(req.url).searchParams;
    const target = new URL(`${API_BASE}/api/catalog/products/`);
    searchParams.forEach((value, key) => {
        target.searchParams.set(key, value);
    });

    try {
        const upstream = await fetch(target.toString(), {
            method: 'GET',
            headers: { Accept: 'application/json' },
            // Pass through the incoming abort signal so the client cancelling
            // doesn't leave the upstream request dangling.
            signal: req.signal,
        });

        // 204 has no body
        if (upstream.status === 204) {
            return new NextResponse(null, { status: 204 });
        }

        const contentType = upstream.headers.get('content-type') ?? '';
        if (contentType.includes('application/json')) {
            const data = await upstream.json().catch(() => null);
            return NextResponse.json(data, { status: upstream.status });
        }

        // Non-JSON (error page, plain text, etc.) — pass through as text
        const text = await upstream.text();
        return new NextResponse(text, {
            status: upstream.status,
            headers: { 'Content-Type': contentType || 'text/plain' },
        });
    } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
            return new NextResponse(null, { status: 499 });
        }
        return NextResponse.json(
            {
                detail: 'Upstream catalog service is unreachable.',
                error: err instanceof Error ? err.message : String(err),
            },
            { status: 502 },
        );
    }
}