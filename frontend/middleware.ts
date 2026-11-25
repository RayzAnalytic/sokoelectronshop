import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const BACKEND = new URL(
    process.env.DJANGO_BACKEND_URL ?? "https://sokoelectronshop.onrender.com"
);

// Leading slash, no trailing slash.
const ADMIN_PATH = (() => {
    const raw = process.env.ADMIN_PATH ?? "/ops-7f3k9z";
    return "/" + raw.replace(/^\/+|\/+$/g, "");
})();

const BLOCK_PREFIXES = [
    "/admin",
    "/wp-admin",
    "/wp-login.php",
    "/phpmyadmin",
    "/xmlrpc.php",
    "/cgi-bin",
    "/actuator",
    "/console",
    "/.env",
    "/.git",
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

    // 1) Block scanner magnets. Runs FIRST so /admin never reaches Django.
    for (const p of BLOCK_PREFIXES) {
        if (pathname === p || pathname.startsWith(p + "/") || pathname.startsWith(p + ".")) {
            return new NextResponse(null, { status: 404 });
        }
    }

    // 2) Proxy backend paths (including the hidden admin path).
    if (
        PROXY_PREFIXES.some((p) => pathname.startsWith(p)) ||
        pathname === ADMIN_PATH ||
        pathname.startsWith(ADMIN_PATH + "/")
    ) {
        return proxy(pathname, request);
    }

    // 3) Everything else is a normal Next.js page.
    return NextResponse.next();
}

export const config = {
    matcher: [
        "/api/:path*",
        "/static/:path*",
        "/media/:path*",
        "/admin",
        "/admin/:path*",
        "/wp-admin/:path*",
        "/wp-login.php",
        "/phpmyadmin/:path*",
        "/xmlrpc.php",
        "/ops-7f3k9z",
        "/ops-7f3k9z/:path*",
    ],
};