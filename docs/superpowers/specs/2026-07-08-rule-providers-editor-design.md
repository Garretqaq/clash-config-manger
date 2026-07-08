# 设计：编辑器支持 rule-providers 解析与编辑

- 日期：2026-07-08
- 状态：已批准（待规格审查）
- 关联：rules 解析/保存链路（近期 commit `9463538` `1bcbb53` `9bd0525` `e329c06`）

## 背景

rules 已在编辑页具备完整链路：`src/lib/clash-rules.ts` 提供 `parseRules`/`serializeRules`/`RuleItem`，编辑页 `src/app/(dashboard)/configs/edit/[id]/page.tsx` 内联实现 rules UI（增删改排序 + datalist 补全 + 保存校验），`PUT /api/configs` 接收 `rules` 字段经 `ClashGenerator.generate` 注入 `config.rules`，整体 `yaml.dump` 后存入 `Config.content`。数据库无独立 rules 字段，靠 `content` YAML 字符串往返解析。

`rule-providers` 当前完全无管理能力。它之所以能出现在最终配置里，仅因为 `ClashGenerator.generate` 用 `yaml.load` 加载完整模板对象后只改写 `proxies/rules/proxy-groups`，`rule-providers` 作为模板原样透传。没有解析、没有 UI、没有校验，`types.ts` 的 `ClashConfig` 连 `rule-providers` 字段都未定义（靠 `[key: string]: unknown` 索引签名透传）。

本设计为 rule-providers 提供与 rules 对齐的完整编辑能力，并将 rules + rule-providers 的编辑能力扩展到创建页。

## 目标与成功标准

- 编辑页加载用户提供的 Loyalsoldier 风格配置（13 个 provider）后，rule-providers 正确解析为 13 张卡片，字段完整。
- rule-providers 支持新增/删除/改名/改字段/排序，保存后生成的 YAML 中 `rule-providers` 段顺序与字段正确。
- 保存时校验 rules 中 `RULE-SET` 引用的 provider 是否存在，缺失则阻止保存并提示具体规则。
- 创建页也能从零配置 rules + rule-providers。
- rules 与 rule-providers 的编辑器代码在创建页与编辑页之间复用（共享组件），不重复实现。
- 现有 `clash-rules.check.ts` 自检不受影响；新增 `clash-rule-providers.check.ts` 通过往返一致性断言。

## 关键决策

| 决策点 | 选择 | 理由 |
|--------|------|------|
| 编辑能力范围 | 完整增删改排序 | 与 rules 对齐 |
| RULE-SET 引用耦合 | 保存时校验，不联动改名 | 简单安全，避免联动复杂度 |
| 字段范围 | 核心 6 字段（name/type/behavior/url/path/interval） | 覆盖 Loyalsoldier 常见用法，YAGNI |
| 创建页范围 | rules + rule-providers 都加 | 创建时即可完整配置规则体系 |
| 代码组织 | 抽取 rules/rule-providers 共享组件 | 两页复用，避免重复两份 |
| UI 布局 | 卡片式（每 provider 一张卡片） | 字段多且 url 长，卡片能容纳，与 proxy-group 卡片风格一致 |

## 数据模型与解析层

新建 `src/lib/clash-rule-providers.ts`，镜像 `src/lib/clash-rules.ts` 的设计。

```ts
import yaml from 'js-yaml'
import type { ClashConfig } from './types'

export type RuleProviderItem = {
  name: string       // YAML 中的键名，必须唯一
  type: string       // 'http' | 'file'
  behavior: string   // 'domain' | 'ipcidr' | 'classical'
  url: string        // type=http 时必填
  path: string
  interval: string   // 存字符串方便 UI 输入；序列化时 Number() 转 YAML 数字
}

// 从 YAML content 解析出结构化 provider 列表，保留键顺序
export function parseRuleProviders(content: string): RuleProviderItem[] {
  let providers: Record<string, any> = {}
  try {
    const config = yaml.load(content) as ClashConfig
    const rp = config?.['rule-providers']
    if (rp && typeof rp === 'object' && !Array.isArray(rp)) {
      providers = rp as Record<string, any>
    }
  } catch {
    return []
  }
  return Object.entries(providers).map(([name, p]) => ({
    name,
    type: String(p?.type ?? ''),
    behavior: String(p?.behavior ?? ''),
    url: String(p?.url ?? ''),
    path: String(p?.path ?? ''),
    interval: String(p?.interval ?? ''),
  }))
}

// 结构化 provider 列表序列化回对象（丢弃空 name 项）
export function serializeRuleProviders(items: RuleProviderItem[]): Record<string, object> {
  const result: Record<string, object> = {}
  for (const item of items.filter((p) => p.name)) {
    const entry: Record<string, unknown> = {
      type: item.type,
      behavior: item.behavior,
      url: item.url,
      path: item.path,
    }
    // interval 非空时输出为数字；空则省略
    if (item.interval !== '') {
      const n = Number(item.interval)
      if (!Number.isNaN(n)) entry.interval = n
    }
    // type=file 或 url 为空时不输出 url 键（file 类型无 url）
    if (item.type === 'file' || item.url === '') {
      delete entry.url
    }
    result[item.name] = entry
  }
  return result
}
```

说明：
- `interval` 在原 YAML 中是数字（如 `86400`）。解析时 `String()` 转字符串存 UI，序列化时 `Number()` 转回数字输出。原值若为字符串形式（如 `'86400'`）也统一归一。
- `type=file` 时 `url`/`interval` 不适用，序列化时省略 `url`（`interval` 本就空时省略）。
- `name` 是 YAML 键，必须唯一，UI 层校验。
- 保留键顺序：`Object.entries` 按插入序遍历，`serializeRuleProviders` 按数组顺序写入新对象，`yaml.dump` 对 JS 对象保留键序。

新建自检 `src/lib/clash-rule-providers.check.ts`，用 `node:assert` 验证往返一致性，与 `src/lib/clash-rules.check.ts` 同模式。fixtures 采用背景中提到的 Loyalsoldier 风格配置（13 个 provider，含 domain/ipcidr/classical 三种 behavior）。

`src/lib/types.ts` 的 `ClashConfig` 补字段定义：

```ts
['rule-providers']?: Record<string, unknown>
```

当前靠 `[key: string]: unknown` 索引签名透传，补显式字段以提升类型安全。

## generator 改造

`src/lib/clash-generator.ts`：

1. `GenerateOptions` 增字段：

```ts
ruleProviders?: Record<string, object> // 覆盖模板 rule-providers；未传则维持模板原样（前端已 serializeRuleProviders）
```

无需 import `RuleProviderItem`（generator 只接收已序列化的对象，与 rules 接收 `string[]` 同构）。

2. `generate()` 中，在现有 rules 注入逻辑（第 26-31 行）之后，增加 rule-providers 注入，镜像 rules 的空值处理：

```ts
if (ruleProviders) {
  // 非空对象总是覆盖；空对象仅在模板已有 rule-providers 段时覆盖
  // （避免向无 rule-providers 的模板注入 rule-providers: {}）
  if (Object.keys(ruleProviders).length > 0 || config['rule-providers'] !== undefined) {
    config['rule-providers'] = ruleProviders
  }
}
```

## API 改造

`src/app/api/configs/route.ts`：

**POST（创建，第 52-139 行）**：
- 第 55 行 body 解构增 `rules, ruleProviders`：

```ts
const { name, templateId, nodeMapping, rules, ruleProviders } = body
```

- 第 118-123 行 `ClashGenerator.generate` 调用增 `rules, ruleProviders`：

```ts
const content = ClashGenerator.generate({
  template: template.content,
  proxies,
  nodeMapping: nodeNameMapping,
  removeUnusedGroups: true,
  rules,
  ruleProviders,
})
```

**PUT（更新，第 142-244 行）**：
- 第 145 行 body 解构增 `ruleProviders`：

```ts
const { id, name, templateId, nodeMapping, rules, ruleProviders } = body
```

- 第 221-227 行 `ClashGenerator.generate` 调用增 `ruleProviders`：

```ts
const content = ClashGenerator.generate({
  template: template.content,
  proxies,
  nodeMapping: nodeNameMapping,
  removeUnusedGroups: true,
  rules,
  ruleProviders,
})
```

## 共享 UI 组件

新建两个共享组件到 `src/components/config/`（与现有 `shared-components.tsx`/`shared-utils.ts` 同目录）：

### `rules-editor.tsx`

```tsx
'use client'
import type { RuleItem } from '@/lib/clash-rules'

interface Props {
  rules: RuleItem[]
  onChange: (rules: RuleItem[]) => void
  // 传入可用目标候选（DIRECT/REJECT/... + 分组名），用于 datalist 补全
  ruleTargets: string[]
}

export function RulesEditor({ rules, onChange, ruleTargets }: Props) {
  // 从编辑页现有内联 rules UI 抽出：行式横排（type/value/target 三输入框）
  // + datalist 补全 + 增删/上移下移；MATCH/FINAL 时 value 输入框 disabled
  // 逻辑与现有实现一致，仅搬迁到共享组件
}
```

抽取自编辑页 `edit/[id]/page.tsx` 第 1047-1142 行的 rules 渲染及第 761-790 行的 `addRule`/`updateRule`/`deleteRule`/`moveRule` 逻辑。type 候选仍用 datalist（第 1126-1130 行那组）。

### `rule-providers-editor.tsx`

```tsx
'use client'
import type { RuleProviderItem } from '@/lib/clash-rule-providers'

interface Props {
  providers: RuleProviderItem[]
  onChange: (providers: RuleProviderItem[]) => void
}

export function RuleProvidersEditor({ providers, onChange }: Props) {
  // 卡片式 UI：
  // - 每个 provider 一张卡片，标题区显示 name + [上移][下移][删除]
  // - 字段：name(Input)、type(select: http/file)、behavior(select: domain/ipcidr/classical)
  //         url(Input)、path(Input)、interval(Input，数字)
  // - type=file 时 url 输入框 disabled 并提示「file 类型无需 url」
  // - 底部「+ 添加 provider」按钮，默认 { name:'', type:'http', behavior:'domain', url:'', path:'', interval:'86400' }
  // - 新增/改名时校验 name 非空且唯一（重复则输入框标红提示）
}
```

type 与 behavior 用 select 下拉（固定枚举，比 datalist 更合适）；rules 的 type 仍保持 datalist（类型多且可扩展）。

### 页面接入

- **编辑页** `edit/[id]/page.tsx`：
  - 新增 state `const [ruleProviders, setRuleProviders] = useState<RuleProviderItem[]>([])`
  - 加载时（第 411 行附近）`setRuleProviders(parseRuleProviders(config.content))`
  - 把内联 rules UI 替换为 `<RulesEditor rules={rules} onChange={setRules} ruleTargets={ruleTargets} />`
  - 在规则配置 Card 下方新增 rule-providers 可折叠 Card，内含 `<RuleProvidersEditor providers={ruleProviders} onChange={setRuleProviders} />`
  - `handleSave` 调用共享校验（见下节），通过后 PUT body 增 `ruleProviders: serializeRuleProviders(ruleProviders)`（前端序列化为对象，API 透传给 generator）
  - 实时预览的 `ClashGenerator.generate` 调用增 `ruleProviders: serializeRuleProviders(ruleProviders)`

- **创建页** `configs/page.tsx`：
  - 新增 `rules` 与 `ruleProviders` 两个 state
  - 新增 `<RulesEditor>` 与 `<RuleProvidersEditor>`
  - `handleSave` 调用共享校验，通过后 POST body 增 `rules: serializeRules(rules), ruleProviders: serializeRuleProviders(ruleProviders)`

**不动既有的分组拖拽重复实现**（编辑页与创建页的分组拖拽逻辑重复是既有问题，不在本次范围）。

## 保存校验（引用一致性）

新建共享校验函数。放在 `src/components/config/shared-utils.ts`（已存在的共享工具文件），两页复用：

```ts
import type { RuleItem } from '@/lib/clash-rules'
import type { RuleProviderItem } from '@/lib/clash-rule-providers'

export function validateRuleProviders(
  rules: RuleItem[],
  providers: RuleProviderItem[],
): { ok: boolean; errors: string[] } {
  const errors: string[] = []

  // 1. provider name 非空且唯一
  const names = providers.map((p) => p.name)
  const seen = new Set<string>()
  providers.forEach((p, i) => {
    if (!p.name) errors.push(`第 ${i + 1} 个 provider 名称为空`)
    else if (seen.has(p.name)) errors.push(`provider 名称重复：${p.name}`)
    else seen.add(p.name)
    // type=http 时 url 必填
    if (p.type === 'http' && !p.url) {
      errors.push(`provider「${p.name || `第 ${i + 1} 个`}」类型为 http 但 url 为空`)
    }
  })

  // 2. rules 中 RULE-SET 引用必须存在于 provider name 集合
  const nameSet = new Set(names.filter(Boolean))
  rules.forEach((r, i) => {
    if (r.type === 'RULE-SET' && r.value && !nameSet.has(r.value)) {
      errors.push(`第 ${i + 1} 条规则引用了不存在的规则集：${r.value}`)
    }
  })

  return { ok: errors.length === 0, errors }
}
```

两页 `handleSave` 在现有 rules 校验（每条须有 type 和 target；非 MATCH/FINAL 须有 value）之后，追加调用 `validateRuleProviders(rules, ruleProviders)`，`ok` 为 false 时阻止保存并展示 `errors` 列表。

## 测试与验证

- `src/lib/clash-rule-providers.check.ts`：往返一致性（`parseRuleProviders(content)` -> `serializeRuleProviders` -> 比对关键字段；fixtures 用 Loyalsoldier 13 provider 配置）。
- `validateRuleProviders` 断言：RULE-SET 引用存在/缺失、provider 重名、http 无 url 三种情况。
- 现有 `src/lib/clash-rules.check.ts` 不受影响（不改 `clash-rules.ts`）。
- 手动验证流程：
  1. 编辑页加载背景中的配置 -> rule-providers 解析为 13 张卡片，字段完整。
  2. 改名某 provider（如 `reject` -> `blocked`）-> rules 中 `RULE-SET,reject,REJECT` 保存时报错「引用了不存在的规则集：reject」。
  3. 把 rules 那条改成 `RULE-SET,blocked,REJECT` 或改回 -> 保存成功。
  4. 新增/删除 provider -> 生成的 YAML 中 `rule-providers` 段顺序与字段正确，`interval` 为数字。
  5. 创建页从零配置 rules + rule-providers -> 保存 -> 生成配置包含两段。

## 范围之外

- 不重构编辑页与创建页之间既有的分组拖拽逻辑重复。
- 不支持 mihomo 的 `format`/`proxy`/`header`/`payload` 等可选字段（靠模板透传）。
- 不在创建页/编辑页做 rule-providers 的 `type:inline` 支持（核心字段范围内 type 仅 http/file）。
- 不改变数据库 schema（rule-providers 仍注入 `Config.content` YAML 字符串，无独立字段）。

## API 传参形式

与 rules 现状一致：前端 `serializeRuleProviders` 序列化为 `Record<string, object>` 后放入 body，API 透传给 `ClashGenerator.generate`，generator 接收已序列化的对象直接赋值给 `config['rule-providers']`。

- `GenerateOptions.ruleProviders` 类型为 `Record<string, object>`（不是 `RuleProviderItem[]`）。
- 前端实时预览：`ClashGenerator.generate({ ..., ruleProviders: serializeRuleProviders(ruleProviders) })`。
- API body：`ruleProviders: serializeRuleProviders(ruleProviders)`，POST/PUT 均如此。
- 序列化逻辑集中在 `clash-rule-providers.ts` 的 `serializeRuleProviders`，generator 不 import `RuleProviderItem`。

此方案与 rules 的"前端序列化、API 透传、generator 接收已序列化值"模式完全对齐。
