import { NextResponse } from "next/server";
import { generateCaptcha } from "@/lib/captcha";

// Mark as dynamic route
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const captcha = generateCaptcha();
    
    return NextResponse.json({
      captchaId: captcha.captchaId,
      svg: captcha.svg,
    });
  } catch (error) {
    console.error("Captcha generation error:", error);
    return NextResponse.json(
      { error: "验证码生成失败" },
      { status: 500 }
    );
  }
}
