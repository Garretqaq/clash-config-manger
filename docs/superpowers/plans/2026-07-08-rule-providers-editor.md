# rule-providers 编辑器 实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 为编辑器增加 rule-providers 的解析与完整编辑能力（增删改排序），并将 rules + rule-providers 编辑扩展到创建页。

**架构：** 新建 `src/lib/clash-rule-providers.ts` 提供 `parseRuleProviders`/`serializeRuleProviders`/`validateRuleProviders`（镜像现有 `clash-rules.ts`），generator 接收已序列化的 `Record<string,object>` 注入 `config['rule-providers']`，API 透传，两页通过共享组件 `RulesEditor`/`RuleProvidersEditor` 复用。与 rules 现状完全对齐：前端序列化、API 透传、generator 接收已序列化值。

**技术栈：** Next.js 14 (App Router) + TypeScript + js-yaml + shadcn/ui + Tailwind。自检用 `node:assert` + `npx tsx` 运行。

**约定：** 所有 commit 消息末尾附 `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`。

---

## 文件结构

| 文件 | 操作 | 职责 |
|------|------|------|
| `src/lib/clash-rule-providers.ts` | 创建 | `RuleProviderItem` 类型、`parseRuleProviders`、`serializeRuleProviders`、`validateRuleProviders` |
| `src/lib/clash-rule-providers.check.ts` | 创建 | 自检（node:assert），任务 1/2/3 逐步追加 |
| `src/lib/types.ts` | 修改 | `ClashConfig` 加 `'rule-providers'` 字段 |
| `src/lib/clash-generator.ts` | 修改 | `GenerateOptions` 加 `ruleProviders`，`generate()` 注入 |
| `src/components/config/rules-editor.tsx` | 创建 | 共享 RulesEditor 组件（含折叠 Card） |
| `src/components/config/rule-providers-editor.tsx` | 创建 | 共享 RuleProvidersEditor 组件（卡片式） |
| `src/app/api/configs/route.ts` | 修改 | POST/PUT body 接收 ruleProviders（POST 另加 rules） |
| `src/app/(dashboard)/configs/edit/[id]/page.tsx` | 修改 | 接入共享组件 + ruleProviders |
| `src/app/(dashboard)/configs/page.tsx` | 修改 | 创建页加 rules + rule-providers |

**说明：** `validateRuleProviders` 放在 `clash-rule-providers.ts`（纯逻辑、可在 node 自检），不放规格原说的 `shared-utils.ts`--因 `shared-utils.ts` 顶层 `import { showToast }` 依赖 React，node 环境跑自检会失败。放纯逻辑文件更可测，两页从 `@/lib/clash-rule-providers` 引入即可。

---

## Task 1: rule-providers 解析与序列化

**文件：**
- 创建：`src/lib/clash-rule-providers.ts`
- 创建：`src/lib/clash-rule-providers.check.ts`
- 修改：`src/lib/types.ts:106-111`

- [ ] **步骤 1：编写失败的自检**

创建 `src/lib/clash-rule-providers.check.ts`：

```ts
import assert from 'node:assert'
import { parseRuleProviders, serializeRuleProviders } from './clash-rule-providers'

const content = `rule-providers:
  reject:
    type: http
    behavior: domain
    url: https://cdn.jsdelivr.net/gh/Loyalsoldier/clash-rules@release/reject.txt
    path: ./ruleset/reject.yaml
    interval: 86400
  telegramcidr:
    type: http
    behavior: ipcidr
    url: https://cdn.jsdelivr.net/gh/Loyalsoldier/clash-rules@release/telegramcidr.txt
    path: ./ruleset/telegramcidr.yaml
    interval: 86400
`

const items = parseRuleProviders(content)
assert.strictEqual(items.length, 2)
assert.deepStrictEqual(items[0], {
  name: 'reject',
  type: 'http',
  behavior: 'domain',
  url: 'https://cdn.jsdelivr.net/gh/Loyalsoldier/clash-rules@release/reject.txt',
  path: './ruleset/reject.yaml',
  interval: '86400',
})
assert.deepStrictEqual(items[1], {
  name: 'telegramcidr',
  type: 'http',
  behavior: 'ipcidr',
  url: 'https://cdn.jsdelivr.net/gh/Loyalsoldier/clash-rules@release/telegramcidr.txt',
  path: './ruleset/telegramcidr.yaml',
  interval: '86400',
})

// 往返：序列化后应还原为等价对象（interval 为数字）
const obj = serializeRuleProviders(items)
assert.deepStrictEqual(obj, {
  reject: {
    type: 'http',
    behavior: 'domain',
    url: 'https://cdn.jsdelivr.net/gh/Loyalsoldier/clash-rules@release/reject.txt',
    path: './ruleset/reject.yaml',
    interval: 86400,
  },
  telegramcidr: {
    type: 'http',
    behavior: 'ipcidr',
    url: 'https://cdn.jsdelivr.net/gh/Loyalsoldier/clash-rules@release/telegramcidr.txt',
    path: './ruleset/telegramcidr.yaml',
    interval: 86400,
  },
})

// 无 rule-providers 段返回空数组
assert.deepStrictEqual(parseRuleProviders('proxies: []'), [])

// 空 rule-providers 返回空
assert.deepStrictEqual(parseRuleProviders('rule-providers: {}'), [])

// 坏 YAML 返回空数组
assert.deepStrictEqual(parseRuleProviders('rule-providers: "unclosed'), [])

// interval 为字符串形式时归一为数字输出
const strIntervalContent = `rule-providers:
  foo:
    type: http
    behavior: domain
    url: https://example.com/foo.txt
    path: ./foo.yaml
    interval: '3600'
`
const strItems = parseRuleProviders(strIntervalContent)
assert.strictEqual(strItems[0].interval, '3600')
assert.strictEqual((serializeRuleProviders(strItems) as any).foo.interval, 3600)

// file 类型序列化时省略 url（且空 interval 不输出）
const fileItem = [{ name: 'local', type: 'file', behavior: 'classical', url: '', path: './local.yaml', interval: '' }]
assert.deepStrictEqual(serializeRuleProviders(fileItem), {
  local: { type: 'file', behavior: 'classical', path: './local.yaml' },
})

console.log('clash-rule-providers self-check passed')
```

- [ ] **步骤 2：运行自检验证失败**

运行：`npx tsx src/lib/clash-rule-providers.check.ts`
预期：FAIL，报错找不到模块 `./clash-rule-providers`

- [ ] **步骤 3：编写实现**

创建 `src/lib/clash-rule-providers.ts`：

```ts
import yaml from 'js-yaml'
import type { ClashConfig } from './types'

export type RuleProviderItem = {
  name: string // YAML 中的键名，必须唯一
  type: string // 'http' | 'file'
  behavior: string // 'domain' | 'ipcidr' | 'classical'
  url: string // type=http 时必填
  path: string
  interval: string // 存字符串方便 UI；序列化时 Number() 转 YAML 数字
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
    if (item.interval !== '') {
      const n = Number(item.interval)
      if (!Number.isNaN(n)) entry.interval = n
    }
    // type=file 或 url 为空时不输出 url 键
    if (item.type === 'file' || item.url === '') {
      delete entry.url
    }
    result[item.name] = entry
  }
  return result
}
```

- [ ] **步骤 4：修改 types.ts**

`src/lib/types.ts` 第 106-111 行，将：

```ts
export interface ClashConfig {
  proxies?: ClashProxyConfig[]
  'proxy-groups'?: ClashProxyGroup[]
  rules?: string[]
  [key: string]: unknown
}
```

替换为：

```ts
export interface ClashConfig {
  proxies?: ClashProxyConfig[]
  'proxy-groups'?: ClashProxyGroup[]
  rules?: string[]
  'rule-providers'?: Record<string, unknown>
  [key: string]: unknown
}
```

- [ ] **步骤 5：运行自检验证通过**

运行：`npx tsx src/lib/clash-rule-providers.check.ts`
预期：PASS，输出 `clash-rule-providers self-check passed`

- [ ] **步骤 6：Commit**

```bash
git add src/lib/clash-rule-providers.ts src/lib/clash-rule-providers.check.ts src/lib/types.ts
git commit -m "feat: 新增 rule-providers 解析与序列化

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Task 2: generator 接收 rule-providers

**文件：**
- 修改：`src/lib/clash-generator.ts:4-10, 26-31`
- 修改：`src/lib/clash-rule-providers.check.ts`（追加 generate 验证）

- [ ] **步骤 1：追加失败的自检**

在 `src/lib/clash-rule-providers.check.ts` 顶部 import 区追加：

```ts
import yaml from 'js-yaml'
import { ClashGenerator } from './clash-generator'
```

在文件末尾 `console.log(...)` 之前追加：

```ts
// generate 注入 rule-providers
const template = `proxies: []
proxy-groups: []
rules: []
`
const generated = ClashGenerator.generate({
  template,
  proxies: [],
  nodeMapping: {},
  ruleProviders: obj,
})
const reparsed = yaml.load(generated) as any
assert.deepStrictEqual(reparsed['rule-providers'], obj)

// 空对象 + 模板无 rule-providers 段 -> 不注入
const generatedEmpty = ClashGenerator.generate({
  template,
  proxies: [],
  nodeMapping: {},
  ruleProviders: {},
})
const reparsedEmpty = yaml.load(generatedEmpty) as any
assert.strictEqual(reparsedEmpty['rule-providers'], undefined)
```

- [ ] **步骤 2：运行自检验证失败**

运行：`npx tsx src/lib/clash-rule-providers.check.ts`
预期：FAIL，TypeScript 报错 `ruleProviders` 不在 `GenerateOptions` 上

- [ ] **步骤 3：修改 generator**

`src/lib/clash-generator.ts` 第 4-10 行，将：

```ts
interface GenerateOptions {
  template: string
  proxies: ClashProxyConfig[]
  nodeMapping: Record<string, string[]> // groupName -> (nodeNames | groupNames)
  removeUnusedGroups?: boolean // 是否移除不在 nodeMapping 中的分组
  rules?: string[] // 覆盖模板 rules；未传则维持模板原样
}
```

替换为：

```ts
interface GenerateOptions {
  template: string
  proxies: ClashProxyConfig[]
  nodeMapping: Record<string, string[]> // groupName -> (nodeNames | groupNames)
  removeUnusedGroups?: boolean // 是否移除不在 nodeMapping 中的分组
  rules?: string[] // 覆盖模板 rules；未传则维持模板原样
  ruleProviders?: Record<string, object> // 覆盖模板 rule-providers；未传则维持原样（前端已 serializeRuleProviders）
}
```

第 17 行解构追加 `ruleProviders`，将：

```ts
    const { template, proxies, nodeMapping, removeUnusedGroups = false, rules } = options
```

替换为：

```ts
    const { template, proxies, nodeMapping, removeUnusedGroups = false, rules, ruleProviders } = options
```

第 31 行（rules 注入逻辑的 `}` 之后）追加：

```ts

    // 覆盖 rule-providers（若调用方提供）
    if (ruleProviders) {
      // 非空对象总是覆盖；空对象仅在模板已有 rule-providers 段时覆盖
      // （避免向无 rule-providers 的模板注入 rule-providers: {}）
      if (Object.keys(ruleProviders).length > 0 || config['rule-providers'] !== undefined) {
        config['rule-providers'] = ruleProviders
      }
    }
```

- [ ] **步骤 4：运行自检验证通过**

运行：`npx tsx src/lib/clash-rule-providers.check.ts`
预期：PASS，输出 `clash-rule-providers self-check passed`

- [ ] **步骤 5：Commit**

```bash
git add src/lib/clash-generator.ts src/lib/clash-rule-providers.check.ts
git commit -m "feat: generator 支持注入 rule-providers

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Task 3: 共享校验函数 validateRuleProviders

**文件：**
- 修改：`src/lib/clash-rule-providers.ts`（追加函数）
- 修改：`src/lib/clash-rule-providers.check.ts`（追加验证）

- [ ] **步骤 1：追加失败的自检**

在 `src/lib/clash-rule-providers.check.ts` 顶部 import 区，将：

```ts
import { parseRuleProviders, serializeRuleProviders } from './clash-rule-providers'
```

替换为：

```ts
import { parseRuleProviders, serializeRuleProviders, validateRuleProviders } from './clash-rule-providers'
import type { RuleItem } from './clash-rules'
```

在文件末尾 `console.log(...)` 之前追加：

```ts
// validateRuleProviders: 引用存在 -> ok
const okRules: RuleItem[] = [{ type: 'RULE-SET', value: 'reject', target: 'REJECT' }]
assert.strictEqual(validateRuleProviders(okRules, items).ok, true)

// 引用缺失 -> 报错
const badRules: RuleItem[] = [{ type: 'RULE-SET', value: 'nonexist', target: 'REJECT' }]
const badResult = validateRuleProviders(badRules, items)
assert.strictEqual(badResult.ok, false)
assert.ok(badResult.errors.some((e) => e.includes('nonexist')))

// provider 重名 -> 报错
const dupProviders = [
  { name: 'reject', type: 'http', behavior: 'domain', url: 'https://a.com', path: './a.yaml', interval: '86400' },
  { name: 'reject', type: 'http', behavior: 'domain', url: 'https://b.com', path: './b.yaml', interval: '86400' },
]
assert.ok(!validateRuleProviders([], dupProviders).ok)

// http 无 url -> 报错
const noUrl = [{ name: 'x', type: 'http', behavior: 'domain', url: '', path: './x.yaml', interval: '86400' }]
assert.ok(!validateRuleProviders([], noUrl).ok)
```

- [ ] **步骤 2：运行自检验证失败**

运行：`npx tsx src/lib/clash-rule-providers.check.ts`
预期：FAIL，报错 `validateRuleProviders` 未导出

- [ ] **步骤 3：追加实现**

在 `src/lib/clash-rule-providers.ts` 顶部 import 区追加：

```ts
import type { RuleItem } from './clash-rules'
```

在文件末尾追加：

```ts
// 校验 provider 列表自身 + 与 rules 的 RULE-SET 引用一致性
export function validateRuleProviders(
  rules: RuleItem[],
  providers: RuleProviderItem[],
): { ok: boolean; errors: string[] } {
  const errors: string[] = []

  // 1. provider name 非空且唯一；type=http 时 url 必填
  const names = providers.map((p) => p.name)
  const seen = new Set<string>()
  providers.forEach((p, i) => {
    if (!p.name) {
      errors.push(`第 ${i + 1} 个 provider 名称为空`)
    } else if (seen.has(p.name)) {
      errors.push(`provider 名称重复：${p.name}`)
    } else {
      seen.add(p.name)
    }
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

- [ ] **步骤 4：运行自检验证通过**

运行：`npx tsx src/lib/clash-rule-providers.check.ts`
预期：PASS

- [ ] **步骤 5：Commit**

```bash
git add src/lib/clash-rule-providers.ts src/lib/clash-rule-providers.check.ts
git commit -m "feat: 新增 validateRuleProviders 引用一致性校验

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Task 4: 共享 RulesEditor 组件

**文件：**
- 创建：`src/components/config/rules-editor.tsx`

说明：从编辑页 `edit/[id]/page.tsx` 第 761-790、1047-1142 行抽出。组件自带折叠 Card 与 expanded state（原编辑页的 `rulesExpanded` state 移入组件）。`NO_VALUE_TYPES` 本地定义（`clash-rules.ts` 的同名常量未导出）。

- [ ] **步骤 1：创建组件**

创建 `src/components/config/rules-editor.tsx`：

```tsx
"use client"

import { useState } from "react"
import { ChevronDown, ChevronRight, ListFilter, ArrowUp, ArrowDown, Trash2, Plus } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import type { RuleItem } from "@/lib/clash-rules"

const RULE_TYPES = ['DOMAIN', 'DOMAIN-SUFFIX', 'DOMAIN-KEYWORD', 'IP-CIDR', 'IP-CIDR6', 'GEOIP', 'RULE-SET', 'DST-PORT', 'PROCESS-NAME', 'MATCH']
const NO_VALUE_TYPES = new Set(['MATCH', 'FINAL'])

export function RulesEditor({
  rules,
  onChange,
  ruleTargets,
}: {
  rules: RuleItem[]
  onChange: (rules: RuleItem[]) => void
  ruleTargets: string[]
}) {
  const [expanded, setExpanded] = useState(false)

  const addRule = () =>
    onChange([...rules, { type: 'DOMAIN-SUFFIX', value: '', target: 'DIRECT' }])

  const updateRule = (index: number, patch: Partial<RuleItem>) =>
    onChange(
      rules.map((r, i) => {
        if (i !== index) return r
        const next = { ...r, ...patch }
        if (patch.type !== undefined) next.type = patch.type.toUpperCase()
        if (next.type === 'MATCH' || next.type === 'FINAL') next.value = ''
        return next
      })
    )

  const deleteRule = (index: number) => onChange(rules.filter((_, i) => i !== index))

  const moveRule = (index: number, dir: -1 | 1) => {
    const j = index + dir
    if (j < 0 || j >= rules.length) return
    const next = [...rules]
    ;[next[index], next[j]] = [next[j], next[index]]
    onChange(next)
  }

  return (
    <Card>
      <CardHeader className="pb-3 cursor-pointer select-none" onClick={() => setExpanded((v) => !v)}>
        <CardTitle className="text-base flex items-center gap-2">
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          <ListFilter className="h-4 w-4 text-primary" />
          规则配置
          <Badge variant="secondary" className="ml-1">{rules.length}</Badge>
        </CardTitle>
      </CardHeader>
      {expanded && (
        <CardContent>
          <datalist id="rule-targets">
            {ruleTargets.map((t) => <option key={t} value={t} />)}
          </datalist>
          <datalist id="rule-types">
            {RULE_TYPES.map((t) => <option key={t} value={t} />)}
          </datalist>
          <ScrollArea className="h-[320px] pr-4">
            <div className="space-y-2">
              {rules.map((rule, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Input
                    className="w-40 font-mono text-xs"
                    list="rule-types"
                    value={rule.type}
                    onChange={(e) => updateRule(index, { type: e.target.value })}
                    placeholder="类型"
                  />
                  <Input
                    className="flex-1 font-mono text-xs"
                    value={rule.value}
                    disabled={NO_VALUE_TYPES.has(rule.type)}
                    onChange={(e) => updateRule(index, { value: e.target.value })}
                    placeholder="值"
                  />
                  <Input
                    className="w-40 font-mono text-xs"
                    list="rule-targets"
                    value={rule.target}
                    onChange={(e) => updateRule(index, { target: e.target.value })}
                    placeholder="目标"
                  />
                  <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => moveRule(index, -1)} disabled={index === 0}>
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => moveRule(index, 1)} disabled={index === rules.length - 1}>
                    <ArrowDown className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive" onClick={() => deleteRule(index)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </ScrollArea>
          <Button variant="outline" size="sm" className="mt-4 w-full" onClick={addRule}>
            <Plus className="h-4 w-4 mr-2" />
            添加规则
          </Button>
        </CardContent>
      )}
    </Card>
  )
}
```

- [ ] **步骤 2：lint 验证类型**

运行：`npm run lint`
预期：PASS（无新错误）

- [ ] **步骤 3：Commit**

```bash
git add src/components/config/rules-editor.tsx
git commit -m "feat: 抽取共享 RulesEditor 组件

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Task 5: 共享 RuleProvidersEditor 组件

**文件：**
- 创建：`src/components/config/rule-providers-editor.tsx`

说明：卡片式布局，每 provider 一张卡片。type/behavior 用原生 `<select>` + Tailwind 样式（与 Input 风格匹配，功能等价于下拉）。`type=file` 时 url 输入框 disabled。name 重复时标红提示。

- [ ] **步骤 1：创建组件**

创建 `src/components/config/rule-providers-editor.tsx`：

```tsx
"use client"

import { useState } from "react"
import { ChevronDown, ChevronRight, Server, ArrowUp, ArrowDown, Trash2, Plus } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { RuleProviderItem } from "@/lib/clash-rule-providers"

const TYPES = ['http', 'file']
const BEHAVIORS = ['domain', 'ipcidr', 'classical']

export function RuleProvidersEditor({
  providers,
  onChange,
}: {
  providers: RuleProviderItem[]
  onChange: (providers: RuleProviderItem[]) => void
}) {
  const [expanded, setExpanded] = useState(false)

  const add = () =>
    onChange([...providers, { name: '', type: 'http', behavior: 'domain', url: '', path: '', interval: '86400' }])

  const update = (index: number, patch: Partial<RuleProviderItem>) =>
    onChange(providers.map((p, i) => (i === index ? { ...p, ...patch } : p)))

  const remove = (index: number) => onChange(providers.filter((_, i) => i !== index))

  const move = (index: number, dir: -1 | 1) => {
    const j = index + dir
    if (j < 0 || j >= providers.length) return
    const next = [...providers]
    ;[next[index], next[j]] = [next[j], next[index]]
    onChange(next)
  }

  const nameCounts = new Map<string, number>()
  providers.forEach((p) => nameCounts.set(p.name, (nameCounts.get(p.name) ?? 0) + 1))

  return (
    <Card>
      <CardHeader className="pb-3 cursor-pointer select-none" onClick={() => setExpanded((v) => !v)}>
        <CardTitle className="text-base flex items-center gap-2">
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          <Server className="h-4 w-4 text-primary" />
          规则集（rule-providers）
          <Badge variant="secondary" className="ml-1">{providers.length}</Badge>
        </CardTitle>
      </CardHeader>
      {expanded && (
        <CardContent className="space-y-3">
          {providers.map((p, index) => {
            const dup = p.name !== '' && (nameCounts.get(p.name) ?? 0) > 1
            return (
              <div key={index} className="rounded-lg border p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <Input
                    className="flex-1 font-mono text-xs"
                    value={p.name}
                    onChange={(e) => update(index, { name: e.target.value })}
                    placeholder="名称（唯一）"
                  />
                  <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => move(index, -1)} disabled={index === 0}>
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => move(index, 1)} disabled={index === providers.length - 1}>
                    <ArrowDown className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive" onClick={() => remove(index)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                {dup && <p className="text-xs text-destructive">名称重复</p>}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs text-muted-foreground">type</Label>
                    <select
                      className="flex h-9 w-full rounded-md border border-input bg-transparent px-2 text-xs"
                      value={p.type}
                      onChange={(e) => update(index, { type: e.target.value })}
                    >
                      {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">behavior</Label>
                    <select
                      className="flex h-9 w-full rounded-md border border-input bg-transparent px-2 text-xs"
                      value={p.behavior}
                      onChange={(e) => update(index, { behavior: e.target.value })}
                    >
                      {BEHAVIORS.map((b) => <option key={b} value={b}>{b}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">url</Label>
                  <Input
                    className="font-mono text-xs"
                    value={p.url}
                    disabled={p.type === 'file'}
                    onChange={(e) => update(index, { url: e.target.value })}
                    placeholder={p.type === 'file' ? 'file 类型无需 url' : 'https://...'}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs text-muted-foreground">path</Label>
                    <Input className="font-mono text-xs" value={p.path} onChange={(e) => update(index, { path: e.target.value })} placeholder="./ruleset/xx.yaml" />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">interval</Label>
                    <Input className="font-mono text-xs" value={p.interval} onChange={(e) => update(index, { interval: e.target.value })} placeholder="86400" />
                  </div>
                </div>
              </div>
            )
          })}
          <Button variant="outline" size="sm" className="w-full" onClick={add}>
            <Plus className="h-4 w-4 mr-2" />
            添加 provider
          </Button>
        </CardContent>
      )}
    </Card>
  )
}
```

- [ ] **步骤 2：lint 验证类型**

运行：`npm run lint`
预期：PASS

- [ ] **步骤 3：Commit**

```bash
git add src/components/config/rule-providers-editor.tsx
git commit -m "feat: 新增共享 RuleProvidersEditor 卡片式组件

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Task 6: API 改造

**文件：**
- 修改：`src/app/api/configs/route.ts:55, 118-123, 145, 221-227`

- [ ] **步骤 1：POST 接收 rules + ruleProviders**

`src/app/api/configs/route.ts` 第 55 行，将：

```ts
    const { name, templateId, nodeMapping } = body
```

替换为：

```ts
    const { name, templateId, nodeMapping, rules, ruleProviders } = body
```

第 118-123 行，将：

```ts
    const content = ClashGenerator.generate({
      template: template.content,
      proxies,
      nodeMapping: nodeNameMapping,
      removeUnusedGroups: true,
    })
```

替换为：

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

- [ ] **步骤 2：PUT 接收 ruleProviders**

第 145 行，将：

```ts
    const { id, name, templateId, nodeMapping, rules } = body
```

替换为：

```ts
    const { id, name, templateId, nodeMapping, rules, ruleProviders } = body
```

第 221-227 行，将：

```ts
    const content = ClashGenerator.generate({
      template: template.content,
      proxies,
      nodeMapping: nodeNameMapping,
      removeUnusedGroups: true,
      rules,
    })
```

替换为：

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

- [ ] **步骤 3：lint 验证**

运行：`npm run lint`
预期：PASS

- [ ] **步骤 4：Commit**

```bash
git add src/app/api/configs/route.ts
git commit -m "feat: API 接收 rules 与 rule-providers 传参

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Task 7: 编辑页接入共享组件与 rule-providers

**文件：**
- 修改：`src/app/(dashboard)/configs/edit/[id]/page.tsx`（多处）

- [ ] **步骤 1：补充 import**

第 57 行，将：

```ts
import { parseRules, serializeRules, type RuleItem } from "@/lib/clash-rules"
```

替换为：

```ts
import { parseRules, serializeRules, type RuleItem } from "@/lib/clash-rules"
import { parseRuleProviders, serializeRuleProviders, validateRuleProviders, type RuleProviderItem } from "@/lib/clash-rule-providers"
import { RulesEditor } from "@/components/config/rules-editor"
import { RuleProvidersEditor } from "@/components/config/rule-providers-editor"
```

- [ ] **步骤 2：调整 state**

第 368-369 行，将：

```ts
  const [rules, setRules] = useState<RuleItem[]>([])
  const [rulesExpanded, setRulesExpanded] = useState(false)
```

替换为：

```ts
  const [rules, setRules] = useState<RuleItem[]>([])
  const [ruleProviders, setRuleProviders] = useState<RuleProviderItem[]>([])
```

（`rulesExpanded` 移入 RulesEditor 组件，删除。）

- [ ] **步骤 3：加载时解析 rule-providers**

第 411 行，将：

```ts
      setRules(parseRules(config.content))
```

替换为：

```ts
      setRules(parseRules(config.content))
      setRuleProviders(parseRuleProviders(config.content))
```

- [ ] **步骤 4：预览传 rule-providers**

第 515-521 行，将：

```ts
    const preview = ClashGenerator.generate({
      template: templateContent,
      proxies: proxyConfigs,
      nodeMapping: nodeMappingNames,
      removeUnusedGroups: true,
      rules: serializeRules(rules),
    })
```

替换为：

```ts
    const preview = ClashGenerator.generate({
      template: templateContent,
      proxies: proxyConfigs,
      nodeMapping: nodeMappingNames,
      removeUnusedGroups: true,
      rules: serializeRules(rules),
      ruleProviders: serializeRuleProviders(ruleProviders),
    })
```

该预览位于 `useCallback` 中，第 524 行依赖数组 `}, [nodeMapping, selectedTemplate, configData, rules])` 替换为 `}, [nodeMapping, selectedTemplate, configData, rules, ruleProviders])`。

- [ ] **步骤 5：删除已移入组件的 rules 操作函数**

删除以下四个函数（已迁入 RulesEditor，原第 761-790 行）。保留其上方的 `ruleTargets`（第 756-759 行）：

```ts
  const addRule = () =>
    setRules((prev) => [...prev, { type: 'DOMAIN-SUFFIX', value: '', target: 'DIRECT' }])

  const updateRule = (index: number, patch: Partial<RuleItem>) =>
    setRules((prev) =>
      prev.map((r, i) => {
        if (i !== index) return r
        const next = { ...r, ...patch }
        if (patch.type !== undefined) {
          next.type = patch.type.toUpperCase()
        }
        // 切到 MATCH/FINAL 时清空 value（无 value 段）
        if (next.type === 'MATCH' || next.type === 'FINAL') {
          next.value = ''
        }
        return next
      })
    )

  const deleteRule = (index: number) =>
    setRules((prev) => prev.filter((_, i) => i !== index))

  const moveRule = (index: number, dir: -1 | 1) =>
    setRules((prev) => {
      const j = index + dir
      if (j < 0 || j >= prev.length) return prev
      const next = [...prev]
      ;[next[index], next[j]] = [next[j], next[index]]
      return next
    })
```

- [ ] **步骤 6：handleSave 追加 rule-providers 校验与传参**

在 `handleSaveConfig`（第 792 行起）中，找到现有 rules 校验循环之后、`const nodeMappingIds` 之前，插入：

```ts
    // 校验 rule-providers 自身 + RULE-SET 引用一致性
    const rpValidation = validateRuleProviders(rules, ruleProviders)
    if (!rpValidation.ok) {
      showToast({ title: "规则集校验失败", description: rpValidation.errors[0], variant: "destructive" })
      return
    }
```

在 PUT body 的 `rules: serializeRules(rules),` 之后追加一行：

```ts
          ruleProviders: serializeRuleProviders(ruleProviders),
```

- [ ] **步骤 7：替换 rules UI 为共享组件，新增 rule-providers UI**

第 1047-1142 行（整段 `{/* 规则配置 */}` 的 `<Card>...</Card>`），替换为：

```tsx
          {/* 规则配置 */}
          <RulesEditor rules={rules} onChange={setRules} ruleTargets={ruleTargets} />

          {/* 规则集（rule-providers） */}
          <RuleProvidersEditor providers={ruleProviders} onChange={setRuleProviders} />
```

- [ ] **步骤 8：lint + 手动验证**

运行：`npm run lint`，预期 PASS。
运行：`npm run dev`，打开一个含 rule-providers 的配置编辑页，验证：
1. 规则配置 Card 折叠/展开正常，rules 增删改排序正常。
2. rule-providers Card 展开后显示为卡片列表，字段完整。
3. 改名某 provider 后，若 rules 有 RULE-SET 引用旧名，保存时报错提示。
4. 预览 YAML 中 `rule-providers` 段顺序与字段正确，`interval` 为数字。

- [ ] **步骤 9：Commit**

```bash
git add "src/app/(dashboard)/configs/edit/[id]/page.tsx"
git commit -m "feat: 编辑页接入 rule-providers 编辑与共享组件

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Task 8: 创建页接入 rules + rule-providers

**文件：**
- 修改：`src/app/(dashboard)/configs/page.tsx`（多处）

- [ ] **步骤 1：补充 import**

在第 29 行 `import { ClashGenerator } from "@/lib/clash-generator"` 之后追加：

```ts
import { parseRules, serializeRules, type RuleItem } from "@/lib/clash-rules"
import { parseRuleProviders, serializeRuleProviders, validateRuleProviders, type RuleProviderItem } from "@/lib/clash-rule-providers"
import { RulesEditor } from "@/components/config/rules-editor"
import { RuleProvidersEditor } from "@/components/config/rule-providers-editor"
import { useMemo } from "react"
```

（`useMemo` 若已在顶部 import 则不重复。）

- [ ] **步骤 2：新增 state**

在 state 区（第 64 行 `nodePoolWidth` 之后）追加：

```ts
  const [rules, setRules] = useState<RuleItem[]>([])
  const [ruleProviders, setRuleProviders] = useState<RuleProviderItem[]>([])
```

- [ ] **步骤 3：新增 ruleTargets**

在 state 区之后追加：

```ts
  const ruleTargets = useMemo(
    () => ['DIRECT', 'REJECT', 'REJECT-DROP', 'PASS', ...Object.keys(nodeMapping)],
    [nodeMapping]
  )
```

- [ ] **步骤 4：预览传 rules + rule-providers**

第 129-134 行，将：

```ts
    const preview = ClashGenerator.generate({
      template: selectedTemplate.content,
      proxies: proxyConfigs,
      nodeMapping: nodeMappingNames,
      removeUnusedGroups: true,
    })
```

替换为：

```ts
    const preview = ClashGenerator.generate({
      template: selectedTemplate.content,
      proxies: proxyConfigs,
      nodeMapping: nodeMappingNames,
      removeUnusedGroups: true,
      rules: serializeRules(rules),
      ruleProviders: serializeRuleProviders(ruleProviders),
    })
```

第 137 行依赖数组 `}, [nodeMapping, selectedTemplate])` 替换为：

```ts
  }, [nodeMapping, selectedTemplate, rules, ruleProviders])
```

- [ ] **步骤 5：handleSave 追加校验与传参**

`handleSaveConfig`（第 184 行起）中，在 `const nodeMappingIds = convertToSaveFormat(nodeMapping)` 之前插入：

```ts
    // 校验 rules
    for (let i = 0; i < rules.length; i++) {
      const r = rules[i]
      if (!r.type || !r.target) {
        showToast({ title: "规则不完整", description: `第 ${i + 1} 条规则缺少类型或目标`, variant: "destructive" })
        return
      }
      if (r.type !== 'MATCH' && r.type !== 'FINAL' && !r.value) {
        showToast({ title: "规则不完整", description: `第 ${i + 1} 条规则缺少值`, variant: "destructive" })
        return
      }
    }
    // 校验 rule-providers
    const rpValidation = validateRuleProviders(rules, ruleProviders)
    if (!rpValidation.ok) {
      showToast({ title: "规则集校验失败", description: rpValidation.errors[0], variant: "destructive" })
      return
    }
```

POST body（第 191-196 行）的 `nodeMapping: nodeMappingIds,` 之后追加：

```ts
          rules: serializeRules(rules),
          ruleProviders: serializeRuleProviders(ruleProviders),
```

- [ ] **步骤 6：JSX 插入两个编辑器**

在分组配置 Card 之后、配置预览 Card 之前（约第 358 行位置），插入：

```tsx
          {/* 规则配置 */}
          {selectedTemplate && (
            <div className="space-y-4">
              <RulesEditor rules={rules} onChange={setRules} ruleTargets={ruleTargets} />
              <RuleProvidersEditor providers={ruleProviders} onChange={setRuleProviders} />
            </div>
          )}
```

- [ ] **步骤 7：lint + 手动验证**

运行：`npm run lint`，预期 PASS。
运行：`npm run dev`，新建配置流程验证：
1. 选择模板后，规则配置与 rule-providers 两个 Card 显示。
2. 从零添加 rules 与 rule-providers，保存成功。
3. 添加一条 `RULE-SET,nonexist,REJECT` 但不建对应 provider，保存时报错。
4. 预览 YAML 含 rules 与 rule-providers 两段。

- [ ] **步骤 8：Commit**

```bash
git add "src/app/(dashboard)/configs/page.tsx"
git commit -m "feat: 创建页接入 rules 与 rule-providers 编辑

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## 完成标准

- `npx tsx src/lib/clash-rule-providers.check.ts` 通过。
- `npm run lint` 无新错误。
- 编辑页：加载含 rule-providers 的配置 -> 13 张卡片 -> 增删改排序 -> 改名触发引用校验 -> 保存 -> 预览 YAML 正确。
- 创建页：从零配置 rules + rule-providers -> 保存 -> 生成配置含两段。
