import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";

export async function GET() {
  try {
    const session = await getSession();
    
    if (session.isAuthenticated && session.username) {
      return NextResponse.json({
        isAuthenticated: true,
        user: {
          username: session.username,
          loginTime: session.loginTime,
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
