import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Cookie 名称
const INIT_COOKIE_NAME = "system-initialized";
const AUTH_COOKIE_NAME = "clash-auth-token";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 检查系统是否已初始化（只通过 cookie 判断）
  const isInitializedByCookie = request.cookies.get(INIT_COOKIE_NAME)?.value === "true";
  const hasAuthToken = request.cookies.has(AUTH_COOKIE_NAME);
  const isInitialized = isInitializedByCookie || hasAuthToken;

  // 初始化相关路径
  const setupPaths = ["/setup", "/api/setup"];
  const isSetupPath = setupPaths.some((path) => pathname.startsWith(path));

  // 未初始化时的处理
  if (!isInitialized) {
    // 允许访问静态资源
    if (pathname.startsWith("/_next") || pathname === "/favicon.ico") {
      return NextResponse.next();
    }

    // 允许访问初始化页面和 API
    if (isSetupPath) {
      return NextResponse.next();
    }

    // 其他路径重定向到初始化页面
    const setupUrl = new URL("/setup", request.url);
    return NextResponse.redirect(setupUrl);
  }

  // 已初始化后，阻止访问 /setup 页面，跳转到首页
  if (pathname === "/setup" || pathname.startsWith("/setup/")) {
    const homeUrl = new URL("/nodes", request.url);
    return NextResponse.redirect(homeUrl);
  }

  // Paths that don't require authentication
  const publicPaths = [
    "/login",
    "/api/auth/login",
    "/api/auth/captcha",
    "/api/auth/logout",
    "/api/auth/status",
    "/api/setup/status",
    "/api/debug",
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

  // 简单检查是否有认证 token（实际验证在 API 层进行）
  if (!hasAuthToken) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
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
