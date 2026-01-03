import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifySession } from "@/lib/session";

export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // Define protected routes
  const isProtectedRoute = path.startsWith("/chat");
  const isAdminRoute = path.startsWith("/admin");

  if (isProtectedRoute || isAdminRoute) {
    const token = request.cookies.get("auth_token")?.value;

    if (!token) {
      return NextResponse.redirect(new URL("/login", request.url));
    }

    const session = await verifySession(token);

    if (!session) {
      // Token is invalid or expired
      return NextResponse.redirect(new URL("/login", request.url));
    }

    // Check admin access
    if (isAdminRoute && !session.isAdmin) {
        // User is logged in but not admin
        // Redirect to chat or show 403? next/server doesn't support easy 403 render without rewriting.
        // Redirecting to chat seems safer/friendlier.
        return NextResponse.redirect(new URL("/chat", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - login (login page)
     * - auth (auth pages if any)
     */
    "/chat/:path*",
    "/admin/:path*",
  ],
};
