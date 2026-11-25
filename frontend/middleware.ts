import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const BACKEND = new URL(
    process.env.DJANGO_BACKEND_URL ?? "https://sokoelectronshop.onrender.com"
);

const ADMIN_PATH = (() => {
    const raw = process.env.ADMIN_PATH ?? "/ops-7f3k9z";
    return "/" + raw.replace(/^\/+|\/+$/g, "");
})();

// Paths that should NEVER exist — return 404 (scanner magnets).
const BLOCK_PREFIXES = [
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

// Backend paths that get proxied to Django.
const PROXY_PREFIXES = ["/api/", "/static/", "/media/"];

// Frontend routes that require a staff login.
// Anything under /admin/* is the custom Next.js dashboard.
const PROTECTED_ADMIN_PREFIXES = ["/admin"];

// Where to send unauthenticated users.
const LOGIN_PATH = "/auth/login";

// Cookie the login flow must set after a successful staff login.
// Value doesn't matter — presence is enough for this gate.
const STAFF_COOKIE = "rt_staff";

function proxy(pathname: string, request: NextRequest) {
    const url = request.nextUrl.clone();
    url.protocol = BACKEND.protocol;
    url.host = BACKEND.host;
    url.pathname = pathname;
    return NextResponse.rewrite(url);
}

function isProtectedAdminPath(pathname: string): boolean {
    return PROTECTED_ADMIN_PREFIXES.some(
        (p) => pathname === p || pathname.startsWith(p + "/")
    );
}

export function middleware(request: NextRequest) {
    const { pathname, search } = request.nextUrl;

    // 1) Scanner magnets → 404.
    for (const p of BLOCK_PREFIXES) {
        if (pathname === p || pathname.startsWith(p + "/") || pathname.startsWith(p + ".")) {
            return new NextResponse(null, { status: 404 });
        }
    }

    // 2) Admin UI → require a staff cookie, otherwise redirect to login.
    if (isProtectedAdminPath(pathname)) {
        const hasStaffCookie = request.cookies.get(STAFF_COOKIE)?.value === "1";
        if (!hasStaffCookie) {
            const loginUrl = new URL(LOGIN_PATH, request.url);
            loginUrl.searchParams.set("next", pathname + search);
            return NextResponse.redirect(loginUrl);
        }
        // Staff cookie present → let Next.js render the dashboard.
        return NextResponse.next();
    }

    // 3) Backend + hidden Django admin path → proxy to Django.
    if (
        PROXY_PREFIXES.some((p) => pathname.startsWith(p)) ||
        pathname === ADMIN_PATH ||
        pathname.startsWith(ADMIN_PATH + "/")
    ) {
        return proxy(pathname, request);
    }

    // 4) Everything else → normal Next.js.
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