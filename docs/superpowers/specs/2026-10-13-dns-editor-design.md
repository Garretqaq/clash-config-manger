# 配置编辑器支持 dns 结构化编辑

日期：2026-10-13
范围：`src/lib/clash-dns.ts`、`src/lib/clash-generator.ts`、`src/components/config/dns-editor.tsx`、`src/app/(dashboard)/configs/page.tsx`、`src/app/(dashboard)/configs/edit/[id]/page.tsx`、`src/app/api/configs/route.ts`、`src/app/api/share/[shareId]/route.ts`

## 背景

`dns:` 段此前只能改模板的裸 YAML（`templates/page.tsx` 的 Textarea）。一旦配置生成，用户就无法在新建/编辑配置的流程里调 DNS。现状：

- 生成器 `ClashGenerator.generate()` 只覆盖 `proxies` / `rules` / `rule-providers` / `proxy-groups`，其余键 `yaml.load` → `yaml.dump` 原样往返。**无 dns 逻辑**。
- 新建页（`/configs`）与编辑页（`/configs/edit/[id]`）都已按「从已有 YAML 解析 rules/rule-providers → 结构化编辑 → 序列化回传 → 生成器覆盖」的模式工作。
- 编辑页保存时由 API 用 `template.content` 重建 content，凡未显式回传的段都会回退到模板。

关键结论：**dns 必须和 rules/rule-providers 走同一套覆盖通道**，否则用户改的 dns 会被模板值覆盖掉。

## 目标

在新建配置与编辑已有配置两个流程里，用结构化表单编辑 DNS 段，保存后随 `config.content` 持久化，并实时反映在预览与分享内容里。

一等字段（与仓库现有可配置参数一致）：

| 字段 | 控件 |
|------|------|
| `enable`、`ipv6`、`use-hosts` | 复选框 |
| `enhanced-mode` | 下拉（`fake-ip` / `redir-host` / `normal`） |
| `fake-ip-range` | 文本框 |
| `default-nameserver`、`nameserver`、`fallback` | 每行一条的 Textarea |
| `fallback-filter.geoip` | 复选框 |
| `fallback-filter.ipcidr` | 每行一条的 Textarea |

## 非目标（YAGNI）

- 模板编辑器的结构化 DNS 编辑（模板仍走裸 YAML，本就能改 dns）。
- `fake-ip-filter`、`nameserver-policy`、`proxy-server-nameserver`、`listen`、`respect-rules` 等子键的独立控件：**一律原样透传保留**，不展示、不丢失。
- `fallback-filter.geoip-code` 的独立控件（仓库模板里没有该键）。它是透传键：源 YAML 里有就原样保留；「填入推荐配置」会把它作为推荐值一并写入。
- DNS 连通性测试、ipcidr/nameserver 的语法校验（只校验 `fake-ip-range` 的 CIDR 形式）。
- 既存不一致：编辑页**预览**基于 `config.content`，而**保存**由 `template.content` 重建。本次不动（dns 因总是走覆盖通道，不受其影响）。
- 无 dns 段时 dns 键的插入位置：新键追加在 YAML 末尾（`sortKeys: false`），不做位置重排。

## 数据流与持久化（不新增数据库字段）

```
加载  源 YAML 的 dns: 段 ──parseDns──▶ DnsConfig (state)
       新建页源 = 选中模板的 content；编辑页源 = 该配置已存的 content
编辑  结构化表单（未知子键留在对象里，不渲染但保留）
预览  generate({ ..., dns: serializeDns(dns) }) 实时生效
保存  POST/PUT body 加 dns ──▶ API 透传 generate() ──▶ 落库 content ──▶ 下次加载再解析（闭环）
```

`config.content` 完成 dns 的往返，既有配置首次进入编辑页即可显示自己真实的 dns，无需数据迁移。

## 覆盖语义

`GenerateOptions` 增加 `dns?: Record<string, unknown>`：

- **非空对象** → 总是覆盖 `config.dns`（源无该段则新增）。
- **空对象 + 源已有 dns 段** → 删除该段（与 rules/rule-providers「空值即覆盖」的先例一致，同时给用户一条清空路径）。
- **空对象 + 源无 dns 段** → 不注入，避免凭空生成 `dns: {}`。
- **未传 `dns`** → 维持源原样（向后兼容既有调用）。

## 校验（轻量，保存时阻断）

1. `enable: true` 且 `nameserver` 为空。
2. `fake-ip-range` 不是合法 CIDR。
3. `fallback-filter.geoip: true` 且**显式写出**了空的 `geoip-code`（该键不是表单字段，未写出时不拦）。
4. `enhanced-mode` 不在 `fake-ip` / `redir-host` / `normal` 之内。

## 组件边界

- `parseDns` / `serializeDns` / `validateDns` / `applyPreset`：纯函数，不依赖 React，可在 node 自检里跑。
- `DnsEditor`：受控组件，`{ dns, onChange }`，自带折叠 Card 与展开态（照抄 `RuleProvidersEditor` 的 props 形状），不含业务逻辑。
- 页面：持有 `dns` state，串起 加载解析 → 编辑 → 预览 → 保存序列化。

## 改动点清单

1. `src/lib/clash-dns.ts`（新增）：`DnsConfig` 类型、`DNS_PRESET`、`parseDns`、`serializeDns`、`applyPreset`、`validateDns`。
2. `src/lib/clash-dns.check.ts`（新增）：`node:assert` 自检。
3. `src/lib/types.ts`：`ClashConfig` 加 `dns?`。
4. `src/lib/clash-generator.ts`：`GenerateOptions` 加 `dns`，`generate()` 注入。
5. `src/components/config/dns-editor.tsx`（新增）：折叠 Card + 表单 + 「填入推荐配置」/「清空」。
6. `src/app/api/configs/route.ts`：POST/PUT 读 body 的 `dns` 并透传。
7. `src/app/(dashboard)/configs/page.tsx`：state、选模板时 `parseDns`、预览、POST body、编辑器挂载。
8. `src/app/(dashboard)/configs/edit/[id]/page.tsx`：state、加载时按 `config.content` 解析、预览、PUT body、编辑器挂载。
9. `src/app/api/share/[shareId]/route.ts`：动态分享重建时按 `config.content` 解析 dns 一并传入（否则分享回退到模板 dns）。

## 测试/验证

- `npx tsx src/lib/clash-dns.check.ts`：示例配置解析、块式/流式序列、往返、未知子键（dns 层 + fallback-filter 层）保留、空/坏 YAML、空值丢弃、`enable: false` 保留、四种注入分支、四条校验、CIDR 边界、`applyPreset`。
- 真实数据：读取 `data/clash.db` 的 Template/Config，验证未改动时生成结果与原 dns 一致、只改 `nameserver` 时其余子键不丢、清空后段落消失。
- `npx tsc --noEmit`、`npx next build` 通过。
- 手动：两个流程各改一次 dns → 预览实时变化 → 保存 → 重新进入编辑页仍是改后的值。
