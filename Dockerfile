# 使用官方 Node.js 运行时作为基础镜像
FROM node:20-alpine AS base

# 安装依赖阶段
FROM base AS deps
# 安装 libc6-compat 以支持某些 npm 包
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

# 复制 package.json 和 package-lock.json
COPY package.json package-lock.json* ./
# 安装依赖
RUN npm ci

# 生成 Prisma Client 阶段
FROM base AS prisma
# 安装必要的依赖
RUN apk add --no-cache libc6-compat openssl openssl-dev
WORKDIR /app
# 安装 Prisma 5.x（避免使用 Prisma 7.x 的新配置要求）
RUN npm install prisma@5 @prisma/client@5
# 从 deps 阶段复制 node_modules
COPY --from=deps /app/node_modules ./node_modules
# 复制 Prisma schema 文件
COPY prisma ./prisma
# 设置占位符 DATABASE_URL（生成 Client 时只需要验证格式，不需要真实连接）
ENV DATABASE_URL="mysql://placeholder:placeholder@localhost:3306/placeholder"
# 生成 Prisma Client
RUN npx prisma generate

# 构建阶段
FROM base AS builder
WORKDIR /app
# 从 deps 阶段复制 node_modules
COPY --from=deps /app/node_modules ./node_modules
# 从 prisma 阶段复制生成的 Prisma Client
COPY --from=prisma /app/node_modules/.prisma ./node_modules/.prisma
# 复制源代码
COPY . .

# 设置环境变量
ENV NEXT_TELEMETRY_DISABLED 1
ENV NODE_ENV production

# 构建 Next.js 应用
RUN npm run build

# 生产运行阶段
FROM base AS runner
WORKDIR /app

ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

# 安装 OpenSSL 和必要的运行时依赖（Prisma 需要）
RUN apk add --no-cache openssl openssl-dev libc6-compat

# 创建数据目录
RUN mkdir -p /app/data

# 复制必要的文件
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
# 复制 Prisma schema 和生成的 Client（运行时可能需要）
COPY --from=prisma /app/prisma ./prisma
COPY --from=prisma /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=prisma /app/node_modules/@prisma ./node_modules/@prisma

# 切换到 root 用户
USER root

# 暴露端口
EXPOSE 3000

ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

# 启动应用
CMD ["node", "server.js"]
