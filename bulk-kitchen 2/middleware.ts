import { NextResponse, type NextRequest } from "next/server";
import { COOKIE, verifyToken, passcodeConfigured } from "@/lib/auth";

/**
 * Gate everything behind the passcode except the login page itself, the login
 * API, and Next's own static assets. Runs on the edge before any route so an
 * unauthenticated request never reaches the database.
 */
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/api/auth") ||
    pathname === "/favicon.ico" ||
    pathname === "/icon.svg" ||
    pathname === "/setup"
  ) {
    return NextResponse.next();
  }

  // If the deployment has no passcode configured yet, send everyone to the
  // setup page rather than locking the owner out of their own app.
  if (!passcodeConfigured()) {
    return NextResponse.redirect(new URL("/setup", req.url));
  }

  if (await verifyToken(req.cookies.get(COOKIE)?.value)) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const url = new URL("/login", req.url);
  if (pathname !== "/") url.searchParams.set("next", pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
