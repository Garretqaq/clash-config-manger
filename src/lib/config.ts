import * as fs from "fs";
import * as path from "path";
import { randomBytes } from "crypto";

// 配置文件路径
const CONFIG_PATH = path.join(process.cwd(), "config.json");

// 配置接口
export interface AppConfig {
  initialized: boolean;
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
  database: {
    host: "localhost",
    port: 3306,
    username: "root",
    password: "",
    database: "clash_config",
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
 * 获取数据库连接 URL
 */
export function getDatabaseUrl(): string {
  const config = getConfig();
  const { host, port, username, password, database } = config.database;
  const encodedPassword = encodeURIComponent(password);
  return `mysql://${username}:${encodedPassword}@${host}:${port}/${database}`;
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
