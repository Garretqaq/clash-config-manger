import { NextRequest, NextResponse } from "next/server";
import { saveSession, getSession, destroySession } from "@/lib/session";
import { verifyCaptcha, generateCaptcha } from "@/lib/captcha";

// Login attempt tracking (in-memory, will reset on server restart)
const loginAttempts = new Map<string, { count: number; lastAttempt: number }>();
const ATTEMPT_WINDOW = 15 * 60 * 1000; // 15 minutes
const MAX_ATTEMPTS = parseInt(process.env.LOGIN_MAX_ATTEMPTS || "3");

function getClientIdentifier(request: NextRequest): string {
  const ip = request.headers.get("x-forwarded-for") || "unknown";
  const userAgent = request.headers.get("user-agent") || "unknown";
  return `${ip}-${userAgent}`;
}

function getLoginAttempts(key: string): number {
  const attempt = loginAttempts.get(key);
  if (!attempt) return 0;
  
  // Reset if window has passed
  if (Date.now() - attempt.lastAttempt > ATTEMPT_WINDOW) {
    loginAttempts.delete(key);
    return 0;
  }
  
  return attempt.count;
}

function incrementLoginAttempts(key: string): void {
  const attempt = loginAttempts.get(key) || { count: 0, lastAttempt: 0 };
  attempt.count++;
  attempt.lastAttempt = Date.now();
  loginAttempts.set(key, attempt);
}

function resetLoginAttempts(key: string): void {
  loginAttempts.delete(key);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { username, password, captchaId, captchaCode } = body;
    
    if (!username || !password) {
      return NextResponse.json(
        { error: "用户名和密码不能为空" },
        { status: 400 }
      );
    }
    
    const clientId = getClientIdentifier(request);
    const attemptCount = getLoginAttempts(clientId);
    
    // Check if captcha is required
    if (attemptCount >= MAX_ATTEMPTS) {
      if (!captchaId || !captchaCode) {
        return NextResponse.json(
          { 
            error: "验证码错误，请重新输入",
            requireCaptcha: true,
          },
          { status: 400 }
        );
      }
      
      if (!verifyCaptcha(captchaId, captchaCode)) {
        return NextResponse.json(
          { 
            error: "验证码错误，请重新输入",
            requireCaptcha: true,
          },
          { status: 400 }
        );
      }
    }
    
    // Verify credentials
    const adminUsername = process.env.ADMIN_USERNAME || "admin";
    const adminPassword = process.env.ADMIN_PASSWORD || "admin123";
    
    if (username !== adminUsername || password !== adminPassword) {
      incrementLoginAttempts(clientId);
      
      const remainingAttempts = MAX_ATTEMPTS - getLoginAttempts(clientId);
      
      if (remainingAttempts <= 0) {
        // Generate new captcha for next attempt
        const newCaptcha = generateCaptcha();
        return NextResponse.json(
          { 
            error: "用户名或密码错误",
            requireCaptcha: true,
            captchaId: newCaptcha.captchaId,
            captchaSvg: newCaptcha.svg,
          },
          { status: 401 }
        );
      }
      
      return NextResponse.json(
        { 
          error: `用户名或密码错误，还剩 ${remainingAttempts} 次尝试机会`,
          remainingAttempts,
        },
        { status: 401 }
      );
    }
    
    // Check if already logged in
    const existingSession = await getSession();
    if (existingSession.isAuthenticated && existingSession.username === username) {
      // Already logged in, just return success
      return NextResponse.json({
        success: true,
        message: "登录成功",
        user: { username },
      });
    }
    
    // Create new session
    await saveSession({ username });
    resetLoginAttempts(clientId);
    
    return NextResponse.json({
      success: true,
      message: "登录成功",
      user: { username },
    });
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      { error: "登录失败，请稍后重试" },
      { status: 500 }
    );
  }
}
