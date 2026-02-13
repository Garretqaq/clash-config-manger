import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { getJwtSecret, getSessionConfig, getAdminConfig } from "./config";

// JWT Payload 接口
export interface JWTPayload {
  username: string;
  loginTime: number;
  [key: string]: unknown; // 添加索引签名以兼容 jose 库
}

// Cookie 名称
const COOKIE_NAME = "clash-auth-token";

// 动态获取 JWT 密钥
function getJwtSecretKey(): Uint8Array {
  return new TextEncoder().encode(getJwtSecret());
}

// 动态获取过期天数
function getExpiryDays(): number {
  return getSessionConfig().expiryDays;
}

// 获取登录最大尝试次数
export function getLoginMaxAttempts(): number {
  return getSessionConfig().maxLoginAttempts;
}

// 验证管理员凭证
export function validateAdminCredentials(username: string, password: string): boolean {
  const admin = getAdminConfig();
  return username === admin.username && password === admin.password;
}

// 生成 JWT token
export async function generateToken(username: string): Promise<string> {
  const payload: JWTPayload = {
    username,
    loginTime: Date.now(),
  };

  const expiryDays = getExpiryDays();
  const token = await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${expiryDays}d`)
    .sign(getJwtSecretKey());

  return token;
}

// 验证并解析 JWT token
export async function verifyToken(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecretKey());
    return payload as JWTPayload;
  } catch (error) {
    console.error("Token verification failed:", error);
    return null;
  }
}

// 设置认证 cookie（用于 API Route）
export function setAuthCookie(response: NextResponse, token: string): void {
  const expiryDays = getExpiryDays();
  const maxAge = expiryDays * 24 * 60 * 60; // 转换为秒

  response.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge,
    path: "/",
  });
}

// 清除认证 cookie（用于 API Route）
export function clearAuthCookie(response: NextResponse): void {
  response.cookies.set(COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });
}

// 从 cookies 中获取 token（用于服务端组件/中间件）
export async function getTokenFromCookies(): Promise<string | undefined> {
  const cookieStore = await cookies();
  return cookieStore.get(COOKIE_NAME)?.value;
}

// 从 request 中获取 token（用于中间件/API Route）
export function getTokenFromRequest(request: NextRequest): string | undefined {
  return request.cookies.get(COOKIE_NAME)?.value;
}

// 获取当前用户信息（用于中间件）
export async function getCurrentUser(request: NextRequest): Promise<JWTPayload | null> {
  const token = getTokenFromRequest(request);

  if (!token) {
    return null;
  }

  return await verifyToken(token);
}

// 获取当前用户信息（用于服务端组件）
export async function getCurrentUserFromCookies(): Promise<JWTPayload | null> {
  const token = await getTokenFromCookies();

  if (!token) {
    return null;
  }

  return await verifyToken(token);
}
