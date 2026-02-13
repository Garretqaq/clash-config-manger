import { PrismaClient } from "@prisma/client"
import { getDatabaseUrl, isInitialized } from "./config"

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// 动态设置数据库 URL
function setupDatabaseUrl(): void {
  if (isInitialized()) {
    process.env.DATABASE_URL = getDatabaseUrl();
  }
}

// 在创建 PrismaClient 之前设置数据库 URL
setupDatabaseUrl();

export const prisma = globalForPrisma.prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma
