import { PrismaClient } from "@prisma/client"
import { getDatabaseUrl, isInitialized } from "./config"

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// 初始化后从 config.json 读取数据库配置
if (isInitialized()) {
  process.env.DATABASE_URL = getDatabaseUrl();
}

export const prisma = globalForPrisma.prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma
