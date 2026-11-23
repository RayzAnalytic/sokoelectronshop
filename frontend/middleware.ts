import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const RAW_BACKEND = process.env.DJANGO_BACKEND_URL ?? "";
const ADMIN_PATH_SECRET = process.env.ADMIN_PATH_SECRET ?? "ops-7f3k9z";

let BACKEND: URL | null = null;
try {
    if (RAW_BACKEND) BACKEND = new URL(RAW_BACKEND);
} catch (e) {
    console.error("Invalid DJANGO_BACKEND_URL:", RAW_BACKEND);
}

function proxyTo(pathname: string, request: NextRequest): NextResponse {
    if (!BACKEND) {
        return NextResponse.json(
            { error: "Backend not configured (DJANGO_BACKEND_URL missing/invalid)" },
            { status: 500 }
        );
    }
    const url = request.nextUrl.clone();
    url.protocol = BACKEND.protocol;
    url.host = BACKEND.host;
    url.pathname = pathname;
    url.search = request.nextUrl.search;
    return NextResponse.rewrite(url);
}

export function middleware(request: NextRequest) {
    try {
        let { pathname } = request.nextUrl;

        if (pathname === "/admin" || pathname.startsWith("/admin/")) {
            pathname = pathname.replace(/^\/admin/, `/${ADMIN_PATH_SECRET}`);
            if (!pathname.endsWith("/")) pathname += "/";
            return proxyTo(pathname, request);
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
    } catch (err) {
        console.error("middleware error:", err);
        return NextResponse.json({ error: "Middleware failure" }, { status: 500 });
    }
}

export const config = {
    matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};