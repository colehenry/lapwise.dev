import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const authRoutes = new Set([
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
]);

const protectedRoutes = new Set(["/settings"]);

function normalizePathname(pathname: string): string {
  if (pathname !== "/" && pathname.endsWith("/")) {
    return pathname.slice(0, -1);
  }
  return pathname;
}

function isAdminRoute(pathname: string): boolean {
  return pathname === "/admin" || pathname.startsWith("/admin/");
}

export function middleware(request: NextRequest): NextResponse {
  const pathname = normalizePathname(request.nextUrl.pathname);
  // lw_logged_in is a UX-only cookie — real auth is enforced by the backend via JWT.
  // This middleware only prevents obvious wrong-page landings; it is not a security gate.
  const loggedInCookie = request.cookies.get("lw_logged_in")?.value;
  const hasLoggedIn = Boolean(loggedInCookie);

  if (
    !hasLoggedIn &&
    (protectedRoutes.has(pathname) || isAdminRoute(pathname))
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirect", pathname);
    return NextResponse.redirect(url);
  }

  if (hasLoggedIn && authRoutes.has(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.searchParams.delete("redirect");
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
