import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// HARDCODED for diagnosis — ignore env vars for now
const DJANGO_BACKEND_URL = "https://sokoelectronshop.onrender.com";
const ADMIN_PATH_SECRET = "ops-7f3k9z";

function proxyTo(pathname: string, request: NextRequest) {
    const backend = new URL(DJANGO_BACKEND_URL);
    const url = request.nextUrl.clone();
    url.protocol = backend.protocol;
    url.host = backend.host;
    url.pathname = pathname;
    url.search = request.nextUrl.search;
    console.log("[mw] incoming:", request.nextUrl.pathname, "→ proxying to:", pathname);
    return NextResponse.rewrite(url);
}

export function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;

    if (pathname === "/admin" || pathname.startsWith("/admin/")) {
        let newPath = pathname.replace(/^\/admin/, `/${ADMIN_PATH_SECRET}`);
        if (!newPath.endsWith("/")) newPath += "/";
        return proxyTo(newPath, request);
    }

    if (
        pathname.startsWith(`/${ADMIN_PATH_SECRET}`) ||
        pathname.startsWith("/api/") ||
        pathname.startsWith("/static/") ||
        pathname.startsWith("/media/")
    ) {
        return proxyTo(pathname, request);
    }

    return NextResponse.next();
}

export const config = {
    matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};