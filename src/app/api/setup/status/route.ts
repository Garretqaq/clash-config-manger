import { NextResponse } from "next/server";
import { isInitialized, hasConfigFile } from "@/lib/config";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json({
      initialized: isInitialized(),
      hasConfigFile: hasConfigFile(),
    });
  } catch (error) {
    console.error("Error checking initialization status:", error);
    return NextResponse.json(
      { error: "检查初始化状态失败" },
      { status: 500 }
    );
  }
}
