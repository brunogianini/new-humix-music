import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Next.js 16 renamed middleware.js -> proxy.js; this file replaces the old
// middleware.ts convention. Only an optimistic cookie-presence check (no JWT
// decrypt here) — real verification happens per-request in the DAL/API guard.
const PUBLIC_PATHS = ["/login", "/register"];

export default function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isPublic = PUBLIC_PATHS.includes(pathname);
  const hasSession = req.cookies.has("session");

  if (!isPublic && !hasSession) {
    return NextResponse.redirect(new URL("/login", req.nextUrl));
  }

  if (isPublic && hasSession) {
    return NextResponse.redirect(new URL("/", req.nextUrl));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
