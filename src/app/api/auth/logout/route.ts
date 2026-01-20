import { NextResponse } from "next/server";
import { clearAuthCookie } from "@/lib/auth";

// Force Node.js runtime for JWT support
export const runtime = "nodejs";

export async function POST() {
  try {
    const response = NextResponse.json({
      success: true,
      message: "退出登录成功",
    });
    
    clearAuthCookie(response);
    return response;
  } catch (error) {
    console.error("Logout error:", error);
    return NextResponse.json(
      { error: "退出登录失败" },
      { status: 500 }
    );
  }
}
