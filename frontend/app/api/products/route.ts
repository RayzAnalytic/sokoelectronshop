import { NextRequest, NextResponse } from 'next/server';

 

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
    const searchParams = new URL(req.url).searchParams;
    const target = new URL(`${API_BASE}/api/catalog/products/`);
    searchParams.forEach((value, key) => {
        target.searchParams.set(key, value);
    });

    try {
        const upstream = await fetch(target.toString(), {
            method: 'GET',
            headers: { Accept: 'application/json' }, 
            signal: req.signal,
        }); 
        if (upstream.status === 204) {
            return new NextResponse(null, { status: 204 });
        }

        const contentType = upstream.headers.get('content-type') ?? '';
        if (contentType.includes('application/json')) {
            const data = await upstream.json().catch(() => null);
            return NextResponse.json(data, { status: upstream.status });
        } 
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