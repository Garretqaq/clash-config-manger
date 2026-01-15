import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSession } from "@/lib/session";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Paths that don't require authentication
  const publicPaths = [
    "/login",
    "/api/auth/login",
    "/api/auth/captcha",
    "/api/auth/logout",
    "/api/auth/status",
    "/share",
    "/api/share/",
    "/_next",
    "/favicon.ico",
  ];
  
  // Check if path is public
  const isPublicPath = publicPaths.some((path) => pathname.startsWith(path));
  
  if (isPublicPath) {
    return NextResponse.next();
  }
  
  // Check authentication status
  try {
    const session = await getSession();
    
    if (!session.isAuthenticated) {
      // Not authenticated, redirect to login
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(loginUrl);
    }
    
    return NextResponse.next();
  } catch (error) {
    console.error("Middleware auth check error:", error);
    
    // On error, redirect to login
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (public directory)
     */
    "/((?!_next/static|_next/image|favicon.ico|public).*)",
  ],
};
