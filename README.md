# Clash Config Manager

管理和生成 Clash 配置文件的 Web 应用，支持从订阅链接导入节点、管理模板、通过拖拽生成新配置。

## 功能特性

- **节点管理**：查看和管理所有代理节点，支持拖拽分组
- **订阅管理**：添加订阅链接，一键同步获取节点，自动按订阅分组
- **模板管理**：创建和编辑 Clash 配置模板 (YAML)
- **配置生成**：通过拖拽节点到分组，生成自定义 Clash 配置文件

## 技术栈

| 类别 | 技术选型 |
|------|----------|
| 框架 | Next.js 14+ (App Router) + TypeScript |
| 数据库 | MySQL + Prisma ORM |
| UI | shadcn/ui + Tailwind CSS |
| 拖拽 | @dnd-kit/core + @dnd-kit/sortable |
| 状态管理 | Zustand |
| YAML处理 | js-yaml |
| 图标 | Lucide React |

## 项目结构

```
clash-config-manage/
├── prisma/
│   └── schema.prisma          # 数据库模型定义
├── src/
│   ├── app/
│   │   ├── layout.tsx         # 根布局
│   │   ├── page.tsx           # 首页 (重定向到 /nodes)
│   │   ├── nodes/             # 节点管理页面
│   │   ├── subscriptions/     # 订阅管理页面
│   │   ├── templates/         # 模板管理页面
│   │   ├── configs/           # 配置生成页面
│   │   └── api/               # API 路由
│   │       ├── nodes/
│   │       ├── subscriptions/
│   │       ├── templates/
│   │       └── configs/
│   ├── components/
│   │   ├── ui/                # shadcn/ui 组件
│   │   ├── layout/            # 布局组件 (侧边栏、页头)
│   │   ├── nodes/             # 节点相关组件
│   │   ├── groups/            # 分组相关组件
│   │   └── configs/           # 配置相关组件
│   ├── lib/
│   │   ├── db.ts              # Prisma 客户端
│   │   ├── clash-parser.ts    # 解析订阅配置
│   │   ├── clash-generator.ts # 生成 Clash 配置
│   │   └── utils.ts           # 工具函数
│   └── hooks/
│       └── use-theme.ts       # 主题管理 Hook
├── tailwind.config.ts
└── package.json
```

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置数据库

创建 `.env` 文件并配置数据库连接：

```env
# 基本连接（默认 UTC 时区）
DATABASE_URL="mysql://root:password@localhost:3306/clash_config"

# 使用上海时区（推荐）
DATABASE_URL="mysql://root:password@localhost:3306/clash_config?timezone=Asia%2FShanghai"
```

> **注意**：`timezone` 参数会影响数据库存储的 `createdAt` 和 `updatedAt` 时间。使用 `Asia%2FShanghai` 将以北京时间存储。

### 3. 初始化数据库

```bash
npx prisma db push
```

### 4. 启动开发服务器

```bash
npm run dev
```

访问 http://localhost:3000

## Docker 部署

### 构建镜像

```bash
docker build -t clash-config-manage .
```

### 运行容器

**使用 SQLite（无需额外配置）：**

```bash
docker run -d \
  --name clash-config-manage \
  -p 3000:3000 \
  -v ./data:/app/data \
  clash-config-manage
```

**使用 MySQL：**

```bash
docker run -d \
  --name clash-config-manage \
  -p 3000:3000 \
  -v ./data:/app/data \
  clash-config-manage
```

首次启动后，访问 http://localhost:3000/setup 初始化数据库配置。

### 数据持久化

| 路径 | 说明 |
|------|------|
| `/app/data` | 配置目录（包含 `config.json` 和 SQLite 数据库 `clash.db`） |

首次运行后，会在挂载目录生成 `config.json` 配置文件。

## 数据库设计

### ProxyNode (代理节点)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | String | 唯一标识 |
| name | String | 节点名称 |
| type | String | 节点类型 (ss, vmess, trojan 等) |
| server | String | 服务器地址 |
| port | Int | 端口 |
| config | Json | 完整节点配置 |
| groupId | String? | 所属分组 |
| subscriptionId | String? | 所属订阅 |

### Group (分组)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | String | 唯一标识 |
| name | String | 分组名称 |
| type | String | 分组类型 (select, url-test, fallback) |
| sortOrder | Int | 排序权重 |
| subscriptionId | String? | 所属订阅 |

### Subscription (订阅)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | String | 唯一标识 |
| name | String | 订阅名称 |
| url | String | 订阅链接 |
| enabled | Boolean | 是否启用 |
| lastSyncAt | DateTime? | 最后同步时间 |

### Template (模板)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | String | 唯一标识 |
| name | String | 模板名称 |
| description | String? | 模板描述 |
| content | String | YAML 内容 |
| isDefault | Boolean | 是否默认模板 |

### Config (配置)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | String | 唯一标识 |
| name | String | 配置名称 |
| templateId | String | 使用模板 ID |
| nodeMapping | Json | 节点映射 { groupId: [nodeIds] } |
| content | String | 生成配置内容 |

## API 接口

### 节点

- `GET /api/nodes` - 获取所有节点
- `POST /api/nodes` - 创建节点
- `PUT /api/nodes` - 更新节点
- `DELETE /api/nodes?id=xxx` - 删除节点

### 分组

- `GET /api/groups` - 获取所有分组
- `POST /api/groups` - 创建分组
- `PUT /api/groups` - 更新分组
- `DELETE /api/groups?id=xxx` - 删除分组

### 订阅

- `GET /api/subscriptions` - 获取所有订阅
- `POST /api/subscriptions` - 创建订阅
- `PUT /api/subscriptions` - 同步订阅 (`{ id, action: "sync" }`)
- `DELETE /api/subscriptions?id=xxx` - 删除订阅

### 模板

- `GET /api/templates` - 获取所有模板
- `POST /api/templates` - 创建模板
- `PUT /api/templates` - 更新模板
- `DELETE /api/templates?id=xxx` - 删除模板

### 配置

- `GET /api/configs` - 获取所有配置
- `POST /api/configs` - 创建配置
- `PUT /api/configs` - 更新配置
- `DELETE /api/configs?id=xxx` - 删除配置

## 使用说明

### 添加订阅

1. 进入「订阅管理」页面
2. 点击「添加订阅」按钮
3. 填写订阅名称和订阅链接
4. 点击「添加」完成创建

### 同步订阅

1. 在订阅列表中找到目标订阅
2. 点击「同步」按钮
3. 系统会自动从订阅链接获取节点
4. 节点会自动分配到该订阅的「xxx - 默认」分组

### 生成配置

1. 进入「配置生成」页面
2. 选择一个模板
3. 从节点池拖拽节点到各分组
4. 点击「保存配置」或「导出 YAML」

## 主题切换

支持三种主题模式：
- **深色模式** (默认)
- **浅色模式**
- **跟随系统**

切换按钮位于侧边栏底部。

## License

MIT
