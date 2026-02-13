import mysql, { Connection, RowDataPacket } from "mysql2/promise";
import * as fs from "fs";
import * as path from "path";
import {
  AppConfig,
  DatabaseType,
  saveConfig,
  hasConfigFile,
  isInitialized,
  generateJwtSecret,
  getDataDir,
  ensureDataDir,
} from "./config";

export interface DatabaseConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
}

export interface ValidationResult {
  success: boolean;
  error?: string;
  version?: string;
  databaseExists?: boolean;
}

// 重新导出配置相关函数
export { isInitialized as checkInitialized, hasConfigFile };

/**
 * 检查 MySQL 数据库是否存在
 */
export async function checkDatabaseExists(
  connection: Connection,
  databaseName: string
): Promise<boolean> {
  try {
    const [rows] = await connection.query<RowDataPacket[]>(
      "SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = ?",
      [databaseName]
    );
    return rows.length > 0;
  } catch {
    return false;
  }
}

/**
 * 创建 MySQL 数据库
 */
export async function createDatabase(
  connection: Connection,
  databaseName: string
): Promise<void> {
  await connection.query(
    `CREATE DATABASE IF NOT EXISTS \`${databaseName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
  );
}

/**
 * 验证 SQLite 连接（只检查目录是否可写）
 */
export async function validateSqliteConnection(): Promise<ValidationResult> {
  try {
    ensureDataDir();
    const dataDir = getDataDir();

    // 检查目录是否可写
    const testFile = path.join(dataDir, ".write-test");
    fs.writeFileSync(testFile, "test");
    fs.unlinkSync(testFile);

    return {
      success: true,
      version: "SQLite 3",
    };
  } catch (error: unknown) {
    const fsError = error as { message?: string };
    return {
      success: false,
      error: `无法写入数据目录: ${fsError.message || "未知错误"}`,
    };
  }
}

/**
 * 验证 MySQL 数据库连接
 */
export async function validateMysqlConnection(
  dbConfig: DatabaseConfig
): Promise<ValidationResult> {
  let connection: Connection | null = null;

  try {
    // 首先尝试连接到指定的数据库
    connection = await mysql.createConnection({
      host: dbConfig.host,
      port: dbConfig.port,
      user: dbConfig.user,
      password: dbConfig.password,
      database: dbConfig.database,
      connectTimeout: 10000,
    });

    // 获取 MySQL 版本
    const [rows] = await connection.query<RowDataPacket[]>("SELECT VERSION() as version");
    const version = rows[0]?.version || "unknown";

    await connection.end();

    return {
      success: true,
      version,
      databaseExists: true,
    };
  } catch (error: unknown) {
    // 关闭之前的连接
    if (connection) {
      try {
        await connection.end();
      } catch {
        // 忽略关闭错误
      }
    }

    const mysqlError = error as { code?: string; message?: string };

    // 数据库不存在的错误码
    if (mysqlError.code === "ER_BAD_DB_ERROR") {
      // 尝试连接 MySQL 服务器（不指定数据库）
      try {
        connection = await mysql.createConnection({
          host: dbConfig.host,
          port: dbConfig.port,
          user: dbConfig.user,
          password: dbConfig.password,
          connectTimeout: 10000,
        });

        const [rows] = await connection.query<RowDataPacket[]>("SELECT VERSION() as version");
        const version = rows[0]?.version || "unknown";

        await connection.end();

        return {
          success: true,
          version,
          databaseExists: false,
        };
      } catch (serverError: unknown) {
        const serverMysqlError = serverError as { message?: string };
        return {
          success: false,
          error: `无法连接到 MySQL 服务器: ${serverMysqlError.message || "未知错误"}`,
          databaseExists: false,
        };
      }
    }

    // 其他连接错误
    let errorMessage = "数据库连接失败";
    if (mysqlError.code === "ECONNREFUSED") {
      errorMessage = `无法连接到 MySQL 服务器 (${dbConfig.host}:${dbConfig.port})，请检查服务器是否运行`;
    } else if (mysqlError.code === "ER_ACCESS_DENIED_ERROR") {
      errorMessage = "用户名或密码错误";
    } else if (mysqlError.code === "ETIMEDOUT") {
      errorMessage = "连接超时，请检查网络和服务器地址";
    } else if (mysqlError.message) {
      errorMessage = mysqlError.message;
    }

    return {
      success: false,
      error: errorMessage,
      databaseExists: false,
    };
  }
}

/**
 * 复制对应数据库类型的 Prisma schema
 */
export function copyPrismaSchema(dbType: DatabaseType): void {
  const prismaDir = path.join(process.cwd(), "prisma");
  const sourceSchema = path.join(prismaDir, `schema.${dbType}.prisma`);
  const targetSchema = path.join(prismaDir, "schema.prisma");

  if (fs.existsSync(sourceSchema)) {
    fs.copyFileSync(sourceSchema, targetSchema);
  }
}

/**
 * 执行 SQLite 初始化流程
 */
export async function executeSqliteInitialization(config: {
  admin: {
    username: string;
    password: string;
  };
}): Promise<{ success: boolean; error?: string; step?: string }> {
  // Step 1: 确保数据目录存在
  try {
    ensureDataDir();
  } catch (error: unknown) {
    const fsError = error as { message?: string };
    return {
      success: false,
      error: `创建数据目录失败: ${fsError.message || "未知错误"}`,
      step: "directory",
    };
  }

  // Step 2: 复制 SQLite schema
  try {
    copyPrismaSchema("sqlite");
  } catch (error: unknown) {
    const fsError = error as { message?: string };
    return {
      success: false,
      error: `复制 Schema 文件失败: ${fsError.message || "未知错误"}`,
      step: "schema",
    };
  }

  // Step 3: 写入配置文件
  try {
    const appConfig: AppConfig = {
      initialized: true,
      databaseType: "sqlite",
      database: {
        filename: "clash.db",
      },
      admin: config.admin,
      jwt: {
        secret: generateJwtSecret(),
      },
      session: {
        maxLoginAttempts: 3,
        expiryDays: 7,
      },
    };
    saveConfig(appConfig);
  } catch (error: unknown) {
    const fsError = error as { message?: string };
    return {
      success: false,
      error: `写入配置文件失败: ${fsError.message || "未知错误"}`,
      step: "config",
    };
  }

  return { success: true };
}

/**
 * 执行 MySQL 初始化流程
 */
export async function executeMysqlInitialization(config: {
  database: {
    host: string;
    port: number;
    username: string;
    password: string;
    database: string;
  };
  admin: {
    username: string;
    password: string;
  };
}): Promise<{ success: boolean; error?: string; step?: string }> {
  const dbConfig = config.database;

  // Step 1: 连接 MySQL 服务器并检查/创建数据库
  let connection: Connection | null = null;
  try {
    connection = await mysql.createConnection({
      host: dbConfig.host,
      port: dbConfig.port,
      user: dbConfig.username,
      password: dbConfig.password,
      connectTimeout: 10000,
    });

    const dbExists = await checkDatabaseExists(connection, dbConfig.database);

    if (!dbExists) {
      await createDatabase(connection, dbConfig.database);
    }

    await connection.end();
  } catch (error: unknown) {
    if (connection) {
      try {
        await connection.end();
      } catch {
        // 忽略
      }
    }
    const mysqlError = error as { message?: string };
    return {
      success: false,
      error: `数据库操作失败: ${mysqlError.message || "未知错误"}`,
      step: "database",
    };
  }

  // Step 2: 复制 MySQL schema
  try {
    copyPrismaSchema("mysql");
  } catch (error: unknown) {
    const fsError = error as { message?: string };
    return {
      success: false,
      error: `复制 Schema 文件失败: ${fsError.message || "未知错误"}`,
      step: "schema",
    };
  }

  // Step 3: 确保数据目录存在
  ensureDataDir();

  // Step 4: 写入配置文件
  try {
    const appConfig: AppConfig = {
      initialized: true,
      databaseType: "mysql",
      database: config.database,
      admin: config.admin,
      jwt: {
        secret: generateJwtSecret(),
      },
      session: {
        maxLoginAttempts: 3,
        expiryDays: 7,
      },
    };
    saveConfig(appConfig);
  } catch (error: unknown) {
    const fsError = error as { message?: string };
    return {
      success: false,
      error: `写入配置文件失败: ${fsError.message || "未知错误"}`,
      step: "config",
    };
  }

  return { success: true };
}
