import { NextRequest, NextResponse } from "next/server";
import { validateSqliteConnection, validateMysqlConnection } from "@/lib/setup";
import { isInitialized } from "@/lib/config";

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
    const { databaseType, host, port, username, password, database } = body;

    if (databaseType === "sqlite") {
      // SQLite 只需要检查目录是否可写
      const result = await validateSqliteConnection();
      return NextResponse.json(result);
    } else if (databaseType === "mysql") {
      // MySQL 需要完整的连接信息
      if (!host || !username || !database) {
        return NextResponse.json(
          { error: "请提供完整的数据库配置" },
          { status: 400 }
        );
      }

      const result = await validateMysqlConnection({
        host,
        port: parseInt(port) || 3306,
        user: username,
        password: password || "",
        database,
      });

      return NextResponse.json(result);
    } else {
      return NextResponse.json(
        { error: "不支持的数据库类型" },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error("Error validating database:", error);
    return NextResponse.json(
      {
        success: false,
        error: "验证数据库连接时发生错误",
      },
      { status: 500 }
    );
  }
}
