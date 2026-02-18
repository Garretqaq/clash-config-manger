# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 常用命令

```bash
# 开发
npm run dev              # 启动开发服务器
npm run build            # 构建生产版本
npm run start            # 启动生产服务器
npm run lint             # 运行 ESLint 检查

# 数据库
npx prisma db push       # 同步 Prisma schema 到数据库
npx prisma db studio     # 打开 Prisma Studio 数据库管理界面
npx prisma generate      # 生成 Prisma Client

# Docker
docker build -t clash-config-manage .
```

## 项目架构

### 技术栈
- **框架**: Next.js 14+ (App Router) + TypeScript
- **数据库**: MySQL + Prisma ORM
- **UI**: shadcn/ui + Tailwind CSS
- **状态管理**: Zustand
- **拖拽**: @dnd-kit/core + @dnd-kit/sortable

### 核心模块

| 模块 | 路径 | 说明 |
|------|------|------|
| API 路由 | `src/app/api/` | RESTful API 端点 |
| 页面组件 | `src/app/(dashboard)/` | 各功能页面 |
| 共享组件 | `src/components/` | 可复用 UI 组件 |
| 工具库 | `src/lib/` | 核心业务逻辑 |
| 数据库模型 | `prisma/schema.prisma` | Prisma 数据模型 |

### 核心库文件

- `src/lib/db.ts` - Prisma 客户端单例
- `src/lib/clash-parser.ts` - 解析订阅配置为节点
- `src/lib/clash-generator.ts` - 生成 Clash YAML 配置
- `src/middleware.ts` - 请求中间件（认证、限流）

### 数据模型

主要实体: ProxyNode、Group、Subscription、Template、Config、ShareLink

详见 README.md 中的「数据库设计」部分。
