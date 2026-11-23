import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const BACKEND = new URL(
    process.env.DJANGO_BACKEND_URL ?? "https://sokoelectronshop.onrender.com"
);
const ADMIN_PATH_SECRET = process.env.ADMIN_PATH_SECRET ?? "ops-7f3k9z";

function proxy(pathname: string, request: NextRequest) {
    const url = request.nextUrl.clone();
    url.protocol = BACKEND.protocol;
    url.host = BACKEND.host;
    url.pathname = pathname;
    return NextResponse.rewrite(url);
}

export function middleware(request: NextRequest) {
    let { pathname } = request.nextUrl;

    if (pathname === "/admin" || pathname.startsWith("/admin/")) {
        pathname = pathname.replace(/^\/admin/, `/${ADMIN_PATH_SECRET}`);
        if (!pathname.endsWith("/")) pathname += "/";
        return proxy(pathname, request);
    }

    if (
        pathname.startsWith(`/${ADMIN_PATH_SECRET}`) ||
        pathname.startsWith("/api/") ||
        pathname.startsWith("/static/") ||
        pathname.startsWith("/media/")
    ) {
        return proxy(pathname, request);
    }

    return NextResponse.next();
}

export const config = {
    matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};