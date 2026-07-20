# Clash Config Manager

> 自托管的 Clash 配置管理面板：拉取订阅、拖拽编排分组与规则、生成 YAML，并通过带 token 的分享链接直接喂给客户端订阅。

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](#-license)
[![Next.js](https://img.shields.io/badge/Next.js-14-black.svg)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue.svg)](https://www.typescriptlang.org)

**适合谁用**：手上有多个机场订阅、想把节点重新分组、按自己的规则集拼出一份干净配置，并且不愿把配置交给第三方在线转换服务的人。

**最短上手方式**（Docker，零配置，默认 SQLite）：

```bash
docker run -d \
  --name clash-config-manage \
  -p 3000:3000 \
  -v ./clash-data:/app/data \
  -e TZ=Asia/Shanghai \
  registry.cn-hangzhou.aliyuncs.com/dato/clash-config-manage
```

打开 http://localhost:3000 ，按初始化向导走完即可。

## ✨ 项目亮点

- **订阅聚合**：添加多个订阅链接，一键同步解析出节点，自动归入「订阅名 - 默认」分组。
- **拖拽编排**：节点拖进代理组、规则条目拖动排序，所见即所得地拼出配置，不用手写 YAML 缩进。
- **规则与规则集编辑**：`rules` 与 `rule-providers` 都有结构化编辑器，类型和目标是下拉选择，写错的机会更少。
- **动态分享链接**：生成 `?token=xxx` 的订阅地址给客户端。标记为「动态」的链接会在每次拉取时按当前节点与规则重新生成 YAML，改完配置客户端刷新就生效，链接不用换。
- **节点连通性测试**：批量测试节点是否可达，剔除失效节点再生成配置。
- **自带认证**：登录、图形验证码、登录失败次数限制、接口限流，可以放心暴露在公网上（仍建议套一层反代 + HTTPS）。
- **数据都在本地**：一个 `data/` 目录装下所有东西，删掉即彻底卸载。

## 📦 安装

需要 Node.js 20+。

```bash
git clone <your-repo-url> clash-config-manage
cd clash-config-manage
npm install
```

## 🚀 快速开始

### 本地开发

Prisma 的 `schema.prisma` 从环境变量读取数据库地址，本地开发时先建一个 `.env`：

```env
DATABASE_URL="file:./data/clash.db"
```

然后建表并启动：

```bash
npx prisma db push   # 建表
npm run dev          # 启动开发服务器
```

访问 http://localhost:3000 ，会被自动重定向到 `/setup` 初始化向导：填写数据库类型（SQLite 或 MySQL）、管理员账号密码。向导会把这些写入 `data/config.json`，并自动生成随机 JWT 密钥。

> 运行期的数据库连接由 `data/config.json` 决定，`.env` 里的 `DATABASE_URL` 只服务于 `prisma db push` / `prisma generate` 这类 CLI 命令。两者不要求一致，但本地开发建议保持一致，免得对着两个库调试。

### Docker 部署

镜像已发布到阿里云容器镜像服务，基于 `node:20-alpine` 的 Next.js standalone 产物，宿主机不需要装 Node。

```bash
docker run -d \
  --name clash-config-manage \
  --restart unless-stopped \
  -p 3000:3000 \
  -v ./clash-data:/app/data \
  -e TZ=Asia/Shanghai \
  registry.cn-hangzhou.aliyuncs.com/dato/clash-config-manage
```

然后访问 http://localhost:3000/setup 完成初始化向导。数据库选 SQLite 无需任何外部依赖；选 MySQL 则在向导里填连接信息，程序会自动建库（`utf8mb4` / `utf8mb4_unicode_ci`）。

参数说明：

| 参数 | 作用 |
|------|------|
| `-p 3000:3000` | 应用固定监听容器内 3000 端口（`ENV PORT 3000`）。宿主机 3000 被占用就改冒号左边，比如 `-p 6001:3000` |
| `-v ./clash-data:/app/data` | 唯一的持久化挂载点：`config.json`（应用配置）+ `clash.db`（SQLite 数据库，选 MySQL 时不生成）。删掉这个目录等于彻底重置应用 |
| `-e TZ=Asia/Shanghai` | 时区。影响日志时间戳与 `createdAt` / `updatedAt` 的显示 |
| `--restart unless-stopped` | 宿主机重启后自动拉起 |

常用运维命令：

```bash
docker pull registry.cn-hangzhou.aliyuncs.com/dato/clash-config-manage  # 拉取最新镜像
docker logs -f clash-config-manage    # 查看日志
docker restart clash-config-manage    # 重启
docker rm -f clash-config-manage      # 删除容器（数据目录保留）
```

容器以 root 运行并写入 `/app/data`，若宿主机目录报权限错误：`chmod 777 ./clash-data`。

> `-v ./clash-data:...` 这种相对路径写法需要 Docker 23+。老版本请写绝对路径，例如 `-v /root/app/clash-data:/app/data`。

### Docker Compose 部署

仓库根目录已提供 `docker-compose.yml`，默认是 SQLite 单服务：

```bash
docker compose up -d
```

然后访问 http://localhost:3000/setup 初始化。数据落在 compose 文件同级的 `./clash-data` 目录，宿主机端口在 `ports` 里改冒号左边。

**改用 MySQL**：取消 `docker-compose.yml` 里 `mysql` 服务和 `volumes` 段的注释，把 `MYSQL_ROOT_PASSWORD` 换成自己的密码，再 `docker compose up -d`。初始化向导里数据库主机填 `mysql`（compose 服务名，容器间可直接解析），端口 `3306`，用户 `root`，密码与 `MYSQL_ROOT_PASSWORD` 一致。

> compose 里没有给 app 加 `depends_on: mysql`。应用启动时并不连数据库——连接信息要等你在向导里填完才写进 `data/config.json`，所以先起谁都行。等你走到向导那一步，MySQL 早就绪了。

常用命令：

```bash
docker compose pull          # 拉取最新镜像
docker compose up -d         # 启动 / 更新
docker compose logs -f       # 查看日志
docker compose restart       # 重启
docker compose down          # 停止并删除容器（数据目录保留）
```

**从源码构建**：把 `docker-compose.yml` 里的 `image:` 注释掉、换成 `build: .`，然后 `docker compose up -d --build`。

## 🧭 使用示例

**典型流程**：添加订阅 → 同步 → 调整分组 → 编辑规则 → 生成配置 → 创建分享链接 → 填进客户端。

1. 「订阅管理」→ 添加订阅 → 填名称和链接 → 点「同步」拉取节点。
2. 「节点管理」→ 拖拽节点到目标分组；需要的话先跑一遍连通性测试。
3. 「配置生成」→ 选模板 → 把节点拖进各代理组 → 在规则编辑器里增删排序 → 保存。
4. 「分享管理」→ 为该配置创建分享链接，勾上「动态」。
5. 把返回的 URL（形如 `http://your-host:3000/api/share/<shareId>?token=<accessToken>`）填进 Clash 客户端的订阅地址。

之后再改节点或规则，客户端刷新订阅即可，链接保持不变。

**手动拉一次配置**：

```bash
curl "http://localhost:3000/api/share/<shareId>?token=<accessToken>"
```

token 不对、链接过期、或 `shareId` 不存在都会被拒绝。

## 📁 项目结构

```
clash-config-manage/
├── prisma/schema.prisma        # 数据模型（provider: sqlite）
├── data/                       # 运行时数据：config.json + clash.db
├── src/
│   ├── middleware.ts           # 认证拦截、公开路径放行、初始化重定向
│   ├── app/
│   │   ├── (setup)/setup/      # 首次初始化向导
│   │   ├── (auth)/login/       # 登录页
│   │   ├── (dashboard)/        # 节点 / 订阅 / 模板 / 配置 / 生成结果 / 分享
│   │   ├── (public)/share/     # 分享链接的公开访问页
│   │   └── api/                # 见下方「API 接口」
│   ├── components/             # ui / layout / nodes / groups / config / share
│   ├── lib/
│   │   ├── config.ts           # 读写 data/config.json
│   │   ├── db.ts               # Prisma 客户端单例
│   │   ├── setup.ts            # 初始化与 MySQL 建库
│   │   ├── auth.ts             # JWT 签发与校验（jose）
│   │   ├── captcha.ts          # 图形验证码
│   │   ├── rate-limit.ts       # 内存限流
│   │   ├── clash-parser.ts     # 订阅 YAML → 节点
│   │   ├── clash-generator.ts  # 节点 + 模板 → Clash YAML
│   │   ├── clash-rules.ts      # rules 解析 / 序列化
│   │   ├── clash-rule-providers.ts  # rule-providers 解析 / 校验
│   │   └── services/connectivity.ts # 节点连通性测试
│   └── hooks/ contexts/
└── Dockerfile
```

## 🗄️ 数据库设计

### ProxyNode（代理节点）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | String | 唯一标识 |
| name | String | 节点名称 |
| type | String | 节点类型（ss / vmess / vless / trojan / hysteria2 / anytls / tailscale / openvpn / trusttunnel / gost-relay 等） |
| server | String | 服务器地址 |
| port | Int | 端口 |
| config | String | 完整节点配置（JSON 字符串） |
| groupId | String? | 所属分组，分组删除时置空 |
| subscriptionId | String? | 来源订阅，订阅删除时置空 |

### Group（分组）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | String | 唯一标识 |
| name | String | 分组名称 |
| type | String | 分组类型（select / url-test / fallback） |
| sortOrder | Int | 排序权重 |
| subscriptionId | String? | 所属订阅 |

### Subscription（订阅）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | String | 唯一标识 |
| name | String | 订阅名称 |
| url | String | 订阅链接 |
| yamlContent | String? | 上次同步到的原始 YAML |
| enabled | Boolean | 是否启用 |
| lastSyncAt | DateTime? | 最后同步时间 |

### Template（模板）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | String | 唯一标识 |
| name | String | 模板名称 |
| description | String? | 模板描述 |
| content | String | YAML 内容 |
| isDefault | Boolean | 是否默认模板 |

### Config（配置）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | String | 唯一标识 |
| name | String | 配置名称 |
| templateId | String | 使用的模板 ID |
| nodeMapping | String | 节点映射 `{ groupId: [nodeIds] }`（JSON 字符串） |
| content | String | 生成的 YAML 内容 |

### ShareLink（分享链接）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | String | 唯一标识 |
| shareId | String | 对外暴露的链接 ID（唯一） |
| accessToken | String | 访问令牌，作为 `?token=` 传入（唯一） |
| configId | String? | 关联配置；动态链接据此重新生成 |
| configName / configContent | String? | 静态快照：链接创建时的配置名与内容 |
| description | String? | 备注 |
| expiresAt | DateTime? | 过期时间，为空则永不过期 |
| views | Int | 访问次数 |
| isDynamic | Boolean | 是否每次访问都重新生成 YAML |

## 🔌 API 接口

除 `/login`、`/api/auth/*`、`/api/setup/status`、`/api/setup/initialize`、`/share`、`/api/share/*` 外，其余路径都需要携带 `clash-auth-token` cookie，由 `src/middleware.ts` 统一拦截。

| 资源 | 接口 |
|------|------|
| 节点 | `GET/POST/PUT /api/nodes`、`DELETE /api/nodes?id=xxx`、`POST /api/nodes/test`（连通性测试） |
| 分组 | `GET/POST/PUT /api/groups`、`DELETE /api/groups?id=xxx` |
| 订阅 | `GET/POST /api/subscriptions`、`PUT /api/subscriptions`（传 `{ id, action: "sync" }` 同步）、`DELETE /api/subscriptions?id=xxx` |
| 模板 | `GET/POST/PUT /api/templates`、`DELETE /api/templates?id=xxx` |
| 配置 | `GET/POST/PUT /api/configs`、`DELETE /api/configs?id=xxx` |
| 分享 | `GET /api/share`（支持 `?q=` 搜索、`?status=` 过滤）、`POST /api/share`、`DELETE /api/share?shareId=xxx`、`POST /api/share/batch-delete` |
| 分享内容 | `GET /api/share/[shareId]?token=xxx` — **公开接口**，客户端订阅地址 |
| 认证 | `POST /api/auth/login`、`POST /api/auth/logout`、`GET /api/auth/status`、`GET /api/auth/captcha` |
| 初始化 | `GET /api/setup/status`、`POST /api/setup/validate-db`、`POST /api/setup/initialize` |
| 维护 | `POST /api/maintenance/fix-nodes` |

## 🔐 安全说明

- 管理员密码、JWT 密钥都存放在 `data/config.json`，**不要把这个目录提交进 Git**。
- JWT 密钥在初始化时随机生成；若跳过向导手工写配置且留空 secret，代码会退回到一个硬编码默认值——生产环境务必确保 `jwt.secret` 非空。
- 登录带图形验证码与失败次数限制（默认 3 次，见 `session.maxLoginAttempts`）；接口限流是**单实例内存实现**，多副本部署时不共享计数。
- 分享链接的 token 就是全部凭证，泄露等同于配置泄露。给公网链接设个 `expiresAt`。

## 🛠️ 开发

```bash
npm run dev          # 开发服务器
npm run build        # 生产构建
npm run start        # 启动生产服务器
npm run lint         # ESLint 检查

npm run db:push      # 同步 schema 到数据库
npm run db:studio    # 打开 Prisma Studio
npm run db:generate  # 生成 Prisma Client
```

技术栈：Next.js 14（App Router）+ TypeScript、Prisma + SQLite/MySQL、Tailwind CSS + shadcn/ui、Zustand、@dnd-kit、js-yaml、jose。

界面支持深色（默认）、浅色、跟随系统三种主题，切换按钮在侧边栏底部。

## 🤝 贡献

欢迎 Issue 与 PR。提交前请跑一遍 `npm run lint` 和 `npm run build`。

## 📝 License

MIT
