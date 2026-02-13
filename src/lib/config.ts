import * as fs from "fs";
import * as path from "path";
import { randomBytes } from "crypto";

// 数据目录路径
const DATA_DIR = path.join(process.cwd(), "data");
const CONFIG_PATH = path.join(DATA_DIR, "config.json");

// 数据库类型
export type DatabaseType = "sqlite" | "mysql";

// 配置接口
export interface AppConfig {
  initialized: boolean;
  databaseType: DatabaseType;
  database: {
    // SQLite 配置
    filename?: string;
    // MySQL 配置
    host?: string;
    port?: number;
    username?: string;
    password?: string;
    database?: string;
  };
  admin: {
    username: string;
    password: string;
  };
  jwt: {
    secret: string;
  };
  session: {
    maxLoginAttempts: number;
    expiryDays: number;
  };
}

// 默认配置
const DEFAULT_CONFIG: AppConfig = {
  initialized: false,
  databaseType: "sqlite",
  database: {
    filename: "clash.db",
  },
  admin: {
    username: "admin",
    password: "admin123",
  },
  jwt: {
    secret: "",
  },
  session: {
    maxLoginAttempts: 3,
    expiryDays: 7,
  },
};

// 内存缓存
let configCache: AppConfig | null = null;

/**
 * 确保数据目录存在
 */
export function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

/**
 * 获取数据目录路径
 */
export function getDataDir(): string {
  return DATA_DIR;
}

/**
 * 生成随机 JWT 密钥
 */
export function generateJwtSecret(): string {
  return randomBytes(32).toString("hex");
}

/**
 * 检查配置文件是否存在
 */
export function hasConfigFile(): boolean {
  return fs.existsSync(CONFIG_PATH);
}

/**
 * 读取配置（带缓存）
 */
export function getConfig(): AppConfig {
  // 每次都从文件读取，确保获取最新配置
  if (fs.existsSync(CONFIG_PATH)) {
    try {
      const content = fs.readFileSync(CONFIG_PATH, "utf-8");
      configCache = JSON.parse(content) as AppConfig;
      return configCache;
    } catch (error) {
      console.error("Failed to read config file:", error);
    }
  }
  return DEFAULT_CONFIG;
}

/**
 * 写入配置
 */
export function saveConfig(config: AppConfig): void {
  ensureDataDir();
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), "utf-8");
  configCache = config;
}

/**
 * 检查系统是否已初始化
 */
export function isInitialized(): boolean {
  const config = getConfig();
  return config.initialized === true;
}

/**
 * 获取数据库类型
 */
export function getDatabaseType(): DatabaseType {
  const config = getConfig();
  return config.databaseType || "sqlite";
}

/**
 * 获取数据库连接 URL
 */
export function getDatabaseUrl(): string {
  const config = getConfig();

  if (config.databaseType === "sqlite") {
    const filename = config.database.filename || "clash.db";
    const dbPath = path.join(DATA_DIR, filename);
    return `file:${dbPath}`;
  } else {
    const { host, port, username, password, database } = config.database;
    const encodedPassword = encodeURIComponent(password || "");
    return `mysql://${username}:${encodedPassword}@${host}:${port}/${database}`;
  }
}

/**
 * 获取管理员配置
 */
export function getAdminConfig(): { username: string; password: string } {
  const config = getConfig();
  return config.admin;
}

/**
 * 获取 JWT 密钥
 */
export function getJwtSecret(): string {
  const config = getConfig();
  return config.jwt.secret || "clash-config-jwt-secret-key-change-in-production";
}

/**
 * 获取会话配置
 */
export function getSessionConfig(): { maxLoginAttempts: number; expiryDays: number } {
  const config = getConfig();
  return config.session;
}

/**
 * 清除配置缓存（用于测试或强制刷新）
 */
export function clearConfigCache(): void {
  configCache = null;
}
