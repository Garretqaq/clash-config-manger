import { NextResponse } from "next/server";
import { destroySession } from "@/lib/session";

export async function POST() {
  try {
    await destroySession();
    
    return NextResponse.json({
      success: true,
      message: "退出登录成功",
    });
  } catch (error) {
    console.error("Logout error:", error);
    return NextResponse.json(
      { error: "退出登录失败" },
      { status: 500 }
    );
  }
}
