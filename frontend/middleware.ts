import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
    const url = request.nextUrl.clone();
    url.protocol = "http:";
    url.host = "127.0.0.1:8000";
    return NextResponse.rewrite(url);
}

export const config = {
    matcher: "/api/:path*",
};