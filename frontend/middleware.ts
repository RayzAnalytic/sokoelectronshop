import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const BACKEND = new URL(
    process.env.DJANGO_BACKEND_URL ?? "https://sokoelectronshop.onrender.com"
);

const ADMIN_PATH = process.env.ADMIN_PATH ?? "/ops-7f3k9z";

const NOISE_PREFIXES = [
    "/admin",
    "/wp-admin",
    "/wp-login.php",
    "/phpmyadmin",
    "/.env",
    "/.git",
    "/xmlrpc.php",
    "/cgi-bin",
    "/actuator",
    "/console",
];

const PROXY_PREFIXES = ["/api/", "/static/", "/media/"];

function proxy(pathname: string, request: NextRequest) {
    const url = request.nextUrl.clone();
    url.protocol = BACKEND.protocol;
    url.host = BACKEND.host;
    url.pathname = pathname;
    return NextResponse.rewrite(url);
}

export function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // 1. Hide the admin. The real admin lives at /<ADMIN_PATH>/
    //    and is only reachable if you know the secret path.
    //    /admin and other scanner magnets return 404 at the edge.
    if (NOISE_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/") || pathname === p)) {
        return new NextResponse(null, { status: 404 });
    }

    // 2. Proxy backend paths. Also proxy the *hidden* admin path
    //    so /ops-7f3k9z/ reaches Django.
    if (
        PROXY_PREFIXES.some((p) => pathname.startsWith(p)) ||
        pathname === ADMIN_PATH ||
        pathname.startsWith(ADMIN_PATH + "/")
    ) {
        return proxy(pathname, request);
    }

    // 3. Everything else is a normal Next.js page.
    return NextResponse.next();
}

export const config = {
    matcher: [
        "/api/:path*",
        "/static/:path*",
        "/media/:path*",
        "/admin/:path*",
        "/admin",
        "/wp-admin/:path*",
        "/phpmyadmin/:path*",
        "/xmlrpc.php",
        "/ops-7f3k9z/:path*",
        "/ops-7f3k9z",
    ],
};