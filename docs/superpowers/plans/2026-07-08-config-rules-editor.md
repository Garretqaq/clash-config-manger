# 配置编辑器 rules 结构化编辑 实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 在配置编辑器（`configs/edit/[id]`）中把 `rules:` 解析为结构化列表，支持增删改与上移/下移排序，保存后随 `config.content` 持久化并在预览中实时反映。

**架构：** 抽 `parseRules`/`serializeRules` 纯函数（`src/lib/clash-rules.ts`）；`ClashGenerator.generate()` 加可选 `rules` 覆盖参数；API PUT 透传 `rules`；编辑页新增 state + 折叠式「规则配置」Card。不新增数据库字段，靠 content 往返。

**技术栈：** Next.js 14 + TypeScript、js-yaml、shadcn/ui（Card/Select/Input/Button/ScrollArea）、lucide-react 图标。无测试框架，纯函数自检用 `npx tsx`，UI 用 `npm run build` 类型检查 + 手动浏览器往返验证。

---

## 文件结构

| 文件 | 职责 |
|------|------|
| 创建 `src/lib/clash-rules.ts` | `RuleItem` 类型 + `parseRules`/`serializeRules` 纯函数（无 React 依赖） |
| 创建 `src/lib/clash-rules.check.ts` | 纯函数往返 assert 自检，`npx tsx` 运行 |
| 修改 `src/lib/clash-generator.ts` | `GenerateOptions` 加 `rules?`，`generate()` 覆盖 `config.rules` |
| 修改 `src/app/api/configs/route.ts` | PUT 从 body 读 `rules` 透传给 `generate()` |
| 修改 `src/app/(dashboard)/configs/edit/[id]/page.tsx` | `rules` state、加载解析、预览、保存序列化、「规则配置」Card |

---

## 任务 1：rules 解析/序列化纯函数

**文件：**
- 创建：`src/lib/clash-rules.ts`
- 自检：`src/lib/clash-rules.check.ts`

- [ ] **步骤 1：编写纯函数**

创建 `src/lib/clash-rules.ts`：

```ts
import yaml from 'js-yaml'
import type { ClashConfig } from './types'

export type RuleItem = { type: string; value: string; target: string }

// 无 value 段的规则类型（只有 TYPE,TARGET）
const NO_VALUE_TYPES = new Set(['MATCH', 'FINAL'])

// 从 YAML content 解析出结构化规则列表
export function parseRules(content: string): RuleItem[] {
  let rules: string[] = []
  try {
    const config = yaml.load(content) as ClashConfig
    rules = Array.isArray(config?.rules) ? config.rules : []
  } catch {
    return []
  }
  return rules.map((line) => {
    const parts = String(line).split(',')
    const type = (parts[0] ?? '').trim()
    if (NO_VALUE_TYPES.has(type)) {
      return { type, value: '', target: (parts[1] ?? '').trim() }
    }
    // ponytail: no-resolve 等尾段并入 target 原样保留；需独立开关时再拆字段
    return {
      type,
      value: (parts[1] ?? '').trim(),
      target: parts.slice(2).join(',').trim(),
    }
  })
}

// 结构化规则列表序列化回 string[]（丢弃空 type 行）
export function serializeRules(items: RuleItem[]): string[] {
  return items
    .filter((r) => r.type)
    .map((r) =>
      NO_VALUE_TYPES.has(r.type)
        ? `${r.type},${r.target}`
        : `${r.type},${r.value},${r.target}`
    )
}
```

- [ ] **步骤 2：编写自检**

创建 `src/lib/clash-rules.check.ts`：

```ts
import assert from 'node:assert'
import { parseRules, serializeRules } from './clash-rules'

const content = `rules:
  - RULE-SET,google,🚀自动选择
  - IP-CIDR,127.0.0.0/8,DIRECT,no-resolve
  - MATCH,🚀自动选择
`

const items = parseRules(content)
assert.deepStrictEqual(items[0], { type: 'RULE-SET', value: 'google', target: '🚀自动选择' })
assert.deepStrictEqual(items[1], { type: 'IP-CIDR', value: '127.0.0.0/8', target: 'DIRECT,no-resolve' })
assert.deepStrictEqual(items[2], { type: 'MATCH', value: '', target: '🚀自动选择' })

// 往返：序列化后应还原为原始规则行
assert.deepStrictEqual(serializeRules(items), [
  'RULE-SET,google,🚀自动选择',
  'IP-CIDR,127.0.0.0/8,DIRECT,no-resolve',
  'MATCH,🚀自动选择',
])

// 无 rules 段返回空数组
assert.deepStrictEqual(parseRules('proxies: []'), [])

console.log('clash-rules self-check passed')
```

- [ ] **步骤 3：运行自检验证通过**

运行：`npx tsx src/lib/clash-rules.check.ts`
预期：输出 `clash-rules self-check passed`，退出码 0。

- [ ] **步骤 4：Commit**

```bash
git add src/lib/clash-rules.ts src/lib/clash-rules.check.ts
git commit -m "feat: 新增 clash rules 解析/序列化纯函数"
```

---

## 任务 2：generate() 支持 rules 覆盖

**文件：**
- 修改：`src/lib/clash-generator.ts:4-9`（`GenerateOptions`）、`src/lib/clash-generator.ts:15-22`（`generate` 解构与设置）

- [ ] **步骤 1：给 GenerateOptions 加 rules 字段**

把 `src/lib/clash-generator.ts` 顶部的 interface 改为：

```ts
interface GenerateOptions {
  template: string
  proxies: ClashProxyConfig[]
  nodeMapping: Record<string, string[]> // groupName -> (nodeNames | groupNames)
  removeUnusedGroups?: boolean // 是否移除不在 nodeMapping 中的分组
  rules?: string[] // 覆盖模板 rules；未传则维持模板原样
}
```

- [ ] **步骤 2：在 generate 中应用覆盖**

在 `generate()` 里，把解构行与"设置代理节点"之后改为：

```ts
    const { template, proxies, nodeMapping, removeUnusedGroups = false, rules } = options

    // 解析模板
    const config = yaml.load(template) as ClashConfig

    // 设置代理节点
    config.proxies = proxies

    // 覆盖规则（若调用方提供）
    if (rules) {
      config.rules = rules
    }
```

（其余 proxy-groups 逻辑不变。）

- [ ] **步骤 3：类型检查**

运行：`npm run build`
预期：编译通过，无 TS 报错。

- [ ] **步骤 4：Commit**

```bash
git add src/lib/clash-generator.ts
git commit -m "feat: generate() 支持 rules 覆盖参数"
```

---

## 任务 3：API PUT 透传 rules

**文件：**
- 修改：`src/app/api/configs/route.ts:145`（解构 body）、`:221-225`（generate 调用）

- [ ] **步骤 1：从 body 读取 rules**

将 PUT 中的：

```ts
    const { id, name, templateId, nodeMapping } = body
```

改为：

```ts
    const { id, name, templateId, nodeMapping, rules } = body
```

- [ ] **步骤 2：把 rules 传给 generate**

将 PUT 中的 generate 调用（`src/app/api/configs/route.ts:221` 附近）：

```ts
    const content = ClashGenerator.generate({
      template: template.content,
      proxies,
      nodeMapping: nodeNameMapping,
      removeUnusedGroups: true,
    })
```

改为（新增 `rules` 一行；变量名 `proxies`/`nodeNameMapping` 沿用该函数已有的局部变量，勿改动）：

```ts
    const content = ClashGenerator.generate({
      template: template.content,
      proxies,
      nodeMapping: nodeNameMapping,
      removeUnusedGroups: true,
      rules,
    })
```

> 说明：`rules` 为 `undefined` 时 generate 维持模板原样，向后兼容旧客户端。POST 不改。

- [ ] **步骤 3：类型检查**

运行：`npm run build`
预期：编译通过。

- [ ] **步骤 4：Commit**

```bash
git add src/app/api/configs/route.ts
git commit -m "feat: 配置 PUT 接口透传 rules 覆盖"
```

---

## 任务 4：编辑页接线（state / 加载 / 预览 / 保存）

**文件：**
- 修改：`src/app/(dashboard)/configs/edit/[id]/page.tsx`

- [ ] **步骤 1：新增 import**

在文件顶部 `import { ClashGenerator } ...` 之后加：

```ts
import { parseRules, serializeRules, type RuleItem } from "@/lib/clash-rules"
```

- [ ] **步骤 2：新增 rules state**

在组件内 `const [previewContent, setPreviewContent] = useState("")` 这一行（约 `:363`）之后加：

```ts
  const [rules, setRules] = useState<RuleItem[]>([])
```

- [ ] **步骤 3：加载配置时解析 rules**

在 `loadConfigData` 里 `setConfigData(config)` 之后加：

```ts
      setRules(parseRules(config.content))
```

- [ ] **步骤 4：预览时应用 rules 覆盖**

在实时预览 useEffect（约 `:508`）的 `ClashGenerator.generate({ ... })` 调用中，加入 `rules`：

```ts
    const preview = ClashGenerator.generate({
      template: templateContent,
      proxies: proxyConfigs,
      nodeMapping: nodeMappingNames,
      removeUnusedGroups: true,
      rules: serializeRules(rules),
    })
```

并把该 useEffect 的依赖数组由 `[nodeMapping, selectedTemplate, configData]` 改为：

```ts
  }, [nodeMapping, selectedTemplate, configData, rules])
```

- [ ] **步骤 5：保存时序列化 rules 进 PUT body**

在 `handleSave` 的 PUT `body: JSON.stringify({ ... })`（约 `:778`）中加入 `rules`：

```ts
        body: JSON.stringify({
          id: configId,
          name: configName,
          templateId: templateId,
          nodeMapping: nodeMappingIds,
          rules: serializeRules(rules),
        }),
```

- [ ] **步骤 6：类型检查**

运行：`npm run build`
预期：编译通过（此时 `rules` state 已被 setRules 使用、被预览读取，无未使用告警）。

- [ ] **步骤 7：Commit**

```bash
git add "src/app/(dashboard)/configs/edit/[id]/page.tsx"
git commit -m "feat: 编辑页接入 rules 解析/预览/保存"
```

---

## 任务 5：规则配置 Card（UI 编辑）

**文件：**
- 修改：`src/app/(dashboard)/configs/edit/[id]/page.tsx`

- [ ] **步骤 1：新增编辑处理函数**

在组件内（`handleSave` 附近）加入 rules 编辑处理器：

```ts
  const ruleTargets = useMemo(
    () => ['DIRECT', 'REJECT', 'REJECT-DROP', 'PASS', ...Object.keys(nodeMapping)],
    [nodeMapping]
  )

  const addRule = () =>
    setRules((prev) => [...prev, { type: 'DOMAIN-SUFFIX', value: '', target: 'DIRECT' }])

  const updateRule = (index: number, patch: Partial<RuleItem>) =>
    setRules((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)))

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

- [ ] **步骤 2：新增折叠状态与图标 import**

在文件顶部 lucide-react 的 import 列表中加入 `ArrowUp, ArrowDown, ListFilter`（`ChevronDown`/`ChevronRight`/`Trash2`/`Plus` 已存在，勿重复）：

```ts
  ArrowUp,
  ArrowDown,
  ListFilter,
```

在 `const [rules, setRules] = useState<RuleItem[]>([])` 之后加折叠 state：

```ts
  const [rulesExpanded, setRulesExpanded] = useState(false)
```

- [ ] **步骤 3：渲染规则配置 Card**

在右列「分组配置」Card 的闭合 `)}`（约 `:987`，即 `{selectedTemplate && (...)}` 之后）与「配置预览」Card 之间插入：

```tsx
          {/* 规则配置 */}
          <Card>
            <CardHeader
              className="pb-3 cursor-pointer select-none"
              onClick={() => setRulesExpanded((v) => !v)}
            >
              <CardTitle className="text-base flex items-center gap-2">
                {rulesExpanded ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
                <ListFilter className="h-4 w-4 text-primary" />
                规则配置
                <Badge variant="secondary" className="ml-1">{rules.length}</Badge>
              </CardTitle>
            </CardHeader>
            {rulesExpanded && (
              <CardContent>
                <datalist id="rule-targets">
                  {ruleTargets.map((t) => (
                    <option key={t} value={t} />
                  ))}
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
                          disabled={rule.type === 'MATCH' || rule.type === 'FINAL'}
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
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 shrink-0"
                          onClick={() => moveRule(index, -1)}
                          disabled={index === 0}
                        >
                          <ArrowUp className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 shrink-0"
                          onClick={() => moveRule(index, 1)}
                          disabled={index === rules.length - 1}
                        >
                          <ArrowDown className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                          onClick={() => deleteRule(index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
                <datalist id="rule-types">
                  {['DOMAIN', 'DOMAIN-SUFFIX', 'DOMAIN-KEYWORD', 'IP-CIDR', 'IP-CIDR6', 'GEOIP', 'RULE-SET', 'DST-PORT', 'PROCESS-NAME', 'MATCH'].map((t) => (
                    <option key={t} value={t} />
                  ))}
                </datalist>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4 w-full"
                  onClick={addRule}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  添加规则
                </Button>
              </CardContent>
            )}
          </Card>
```

> 说明：类型/目标用原生 `<datalist>`（可自由输入 + 下拉建议），零新组件、零新拖拽。`disabled` 让 MATCH/FINAL 的值输入不可编辑。

- [ ] **步骤 4：类型检查**

运行：`npm run build`
预期：编译通过。

- [ ] **步骤 5：手动往返验证**

运行：`npm run dev`，浏览器打开某个已生成配置的编辑页：
1. 展开「规则配置」，确认规则列表来自该配置 content。
2. 改一条规则的目标（如把某条改到某分组），确认「配置预览」的 `rules:` 实时更新。
3. 新增/删除/上移下移各操作一次，确认预览同步。
4. 点保存 → 回到列表 → 重新进入该配置编辑页，确认修改后的规则被持久化（仍是改后的值）。

- [ ] **步骤 6：Commit**

```bash
git add "src/app/(dashboard)/configs/edit/[id]/page.tsx"
git commit -m "feat: 配置编辑器新增规则配置 UI（增删改排序）"
```

---

## 自检结果

**规格覆盖度：**
- 数据流/持久化（content 往返、无新字段）→ 任务 2/3/4 ✓
- `generate()` 加 `rules?` 覆盖 → 任务 2 ✓
- API PUT 透传、POST 不改 → 任务 3 ✓
- `RuleItem` + `parseRules`/`serializeRules` + no-resolve 并入 target → 任务 1 ✓
- 编辑 UI（类型/值/目标、MATCH 禁用值、目标含分组名、默认折叠、上移下移、增删）→ 任务 5 ✓
- 纯函数自检 + 手动往返验证 → 任务 1 步骤 3、任务 5 步骤 5 ✓

**占位符扫描：** 无 TODO/待定；每个代码步骤含完整代码。

**类型一致性：** `RuleItem`、`parseRules`、`serializeRules` 命名跨任务一致；`generate()` 的 `rules?: string[]` 与 `serializeRules` 返回 `string[]` 匹配；`ruleTargets`/`addRule`/`updateRule`/`deleteRule`/`moveRule` 定义与使用一致。
