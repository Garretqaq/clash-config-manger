import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";

// Force Node.js runtime for JWT support
export const runtime = "nodejs";

// Mark as dynamic route since it uses cookies
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    
    if (user) {
      return NextResponse.json({
        isAuthenticated: true,
        user: {
          username: user.username,
          loginTime: user.loginTime,
        },
      });
    }
    
    return NextResponse.json({
      isAuthenticated: false,
      user: null,
    });
  } catch (error) {
    console.error("Status check error:", error);
    return NextResponse.json(
      { error: "状态检查失败" },
      { status: 500 }
    );
  }
}
