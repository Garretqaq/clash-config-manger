import { NextRequest, NextResponse } from "next/server";
import { executeSqliteInitialization, executeMysqlInitialization } from "@/lib/setup";
import { isInitialized, getDatabaseUrl } from "@/lib/config";
import { generateToken, setAuthCookie } from "@/lib/auth";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

// 初始化状态 cookie 名称
const INIT_COOKIE_NAME = "system-initialized";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    // 如果系统已初始化，禁止访问
    if (isInitialized()) {
      return NextResponse.json(
        { error: "系统已初始化" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { databaseType, database, admin } = body;

    // 验证管理员配置
    if (!admin || !admin.username || admin.username.length < 3) {
      return NextResponse.json(
        { error: "管理员用户名至少 3 个字符" },
        { status: 400 }
      );
    }

    if (!admin.password || admin.password.length < 6) {
      return NextResponse.json(
        { error: "管理员密码至少 6 个字符" },
        { status: 400 }
      );
    }

    let initResult: { success: boolean; error?: string; step?: string };

    if (databaseType === "sqlite") {
      // SQLite 初始化
      initResult = await executeSqliteInitialization({ admin });
    } else if (databaseType === "mysql") {
      // MySQL 初始化 - 验证数据库配置
      if (!database || !database.host || !database.username || !database.database) {
        return NextResponse.json(
          { error: "请提供完整的数据库配置" },
          { status: 400 }
        );
      }

      initResult = await executeMysqlInitialization({
        database: {
          host: database.host,
          port: parseInt(database.port) || 3306,
          username: database.username,
          password: database.password || "",
          database: database.database,
        },
        admin,
      });
    } else {
      return NextResponse.json(
        { error: "不支持的数据库类型" },
        { status: 400 }
      );
    }

    if (!initResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: initResult.error,
          step: initResult.step
        },
        { status: 500 }
      );
    }

    // 设置数据库 URL 环境变量（供 Prisma 使用）
    process.env.DATABASE_URL = getDatabaseUrl();

    // 执行 Prisma 命令
    try {
      // 使用本地安装的 prisma（避免 npx 安装全局最新版本导致兼容性问题）
      const prismaBin = "./node_modules/.bin/prisma";

      // 生成 Prisma 客户端
      await execAsync(`${prismaBin} generate`, {
        cwd: process.cwd(),
        timeout: 60000,
        env: { ...process.env, DATABASE_URL: getDatabaseUrl() },
      });

      // 推送数据库结构
      await execAsync(`${prismaBin} db push --accept-data-loss`, {
        cwd: process.cwd(),
        timeout: 120000,
        env: { ...process.env, DATABASE_URL: getDatabaseUrl() },
      });
    } catch (prismaError: unknown) {
      const error = prismaError as { message?: string; stderr?: string };
      console.error("Prisma command error:", error);
      return NextResponse.json(
        {
          success: false,
          error: `数据库表结构创建失败: ${error.stderr || error.message || "未知错误"}`,
          step: "prisma"
        },
        { status: 500 }
      );
    }

    // 初始化成功，自动登录管理员账号
    const token = await generateToken(admin.username);
    const response = NextResponse.json({
      success: true,
      message: "初始化完成",
      databaseType,
    });

    // 设置认证 cookie，这样用户无需再次登录
    setAuthCookie(response, token);

    // 设置初始化标记 cookie（长期有效）
    response.cookies.set(INIT_COOKIE_NAME, "true", {
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 365 * 24 * 60 * 60, // 1 年
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("Error during initialization:", error);
    return NextResponse.json(
      {
        success: false,
        error: "初始化过程中发生错误",
        step: "unknown"
      },
      { status: 500 }
    );
  }
}
