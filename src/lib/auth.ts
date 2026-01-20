import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

// JWT Payload 接口
export interface JWTPayload {
  username: string;
  loginTime: number;
  [key: string]: unknown; // 添加索引签名以兼容 jose 库
}

// 常量配置（硬编码默认值）
const JWT_SECRET = process.env.JWT_SECRET || "clash-config-jwt-secret-key-change-in-production";
const JWT_SECRET_KEY = new TextEncoder().encode(JWT_SECRET);
const JWT_EXPIRY_DAYS = 7;
const COOKIE_MAX_AGE = JWT_EXPIRY_DAYS * 24 * 60 * 60; // 7天（秒）
const COOKIE_NAME = "clash-auth-token";
export const LOGIN_MAX_ATTEMPTS = 3;

// 生成 JWT token
export async function generateToken(username: string): Promise<string> {
  const payload: JWTPayload = {
    username,
    loginTime: Date.now(),
  };
  
  const token = await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${JWT_EXPIRY_DAYS}d`)
    .sign(JWT_SECRET_KEY);
  
  return token;
}

// 验证并解析 JWT token
export async function verifyToken(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET_KEY);
    return payload as JWTPayload;
  } catch (error) {
    console.error("Token verification failed:", error);
    return null;
  }
}

// 设置认证 cookie（用于 API Route）
export function setAuthCookie(response: NextResponse, token: string): void {
  response.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: COOKIE_MAX_AGE,
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
