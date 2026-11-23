import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const BACKEND = new URL(
    process.env.DJANGO_BACKEND_URL ?? "https://sokoelectronshop.onrender.com"
);

function proxy(pathname: string, request: NextRequest) {
    const url = request.nextUrl.clone();
    url.protocol = BACKEND.protocol;
    url.host = BACKEND.host;
    url.pathname = pathname;
    return NextResponse.rewrite(url);
}

export function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;
    if (
        pathname.startsWith("/api/") ||
        pathname.startsWith("/static/") ||
        pathname.startsWith("/media/")
    ) {
        return proxy(pathname, request);
    }
    return NextResponse.next();
}

export const config = {
    matcher: ["/api/:path*", "/static/:path*", "/media/:path*"],
};