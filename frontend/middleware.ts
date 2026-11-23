import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const DJANGO_BACKEND_URL = process.env.DJANGO_BACKEND_URL!;
const ADMIN_PATH_SECRET = process.env.ADMIN_PATH_SECRET ?? "ops-7f3k9z";

function proxyTo(pathname: string, request: NextRequest) {
    const backend = new URL(DJANGO_BACKEND_URL);
    const url = request.nextUrl.clone();
    url.protocol = backend.protocol;
    url.host = backend.host;
    url.pathname = pathname;
    return NextResponse.rewrite(url);
}

export function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // Friendly /admin → rewrite to Django's real secret admin path.
    // No Basic Auth. Django's own login form handles authentication.
    if (pathname === "/admin" || pathname.startsWith("/admin/")) {
        const newPath = pathname.replace(/^\/admin/, `/${ADMIN_PATH_SECRET}`);
        return proxyTo(newPath, request);
    }

    // Proxy everything else Django needs.
    if (
        pathname.startsWith(`/${ADMIN_PATH_SECRET}`) ||  // direct secret-path hits
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