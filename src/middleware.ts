import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 公开路径列表（始终允许访问，不需要检查初始化状态）
  const publicPaths = [
    "/login",
    "/api/auth/login",
    "/api/auth/captcha",
    "/api/auth/logout",
    "/api/auth/status",
    "/api/setup/status",
    "/api/setup/initialize",
    "/share",
    "/api/share/",
    "/_next",
    "/favicon.ico",
  ];

  // 检查是否为公开路径
  const isPublicPath = publicPaths.some((path) => pathname.startsWith(path));

  // 公开路径始终允许访问
  if (isPublicPath) {
    return NextResponse.next();
  }

  // 初始化相关路径
  const setupPaths = ["/setup", "/api/setup"];
  const isSetupPath = setupPaths.some((path) => pathname.startsWith(path));

  // 已初始化后，阻止访问 /setup 页面，跳转到首页
  if (isSetupPath) {
    const homeUrl = new URL("/nodes", request.url);
    return NextResponse.redirect(homeUrl);
  }

  // 需要认证的路径 - 检查是否有 auth token
  const hasAuthToken = request.cookies.has("clash-auth-token");

  if (!hasAuthToken) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|public).*)",
  ],
};
