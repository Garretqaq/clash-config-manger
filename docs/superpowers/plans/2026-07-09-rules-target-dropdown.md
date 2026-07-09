# 规则目标下拉选择 实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 把 `RulesEditor` 规则"目标"字段从 `<Input list>` 改为基于 Radix `DropdownMenu` 的自定义下拉，支持从分组列表挑选。

**架构：** 仅改 `src/components/config/rules-editor.tsx`。用已安装的 `@radix-ui/react-dropdown-menu`（封装在 `src/components/ui/dropdown-menu.tsx`）构建单选下拉；在组件内用已知常量把扁平 `ruleTargets` 拆成"策略"与"分组"两段。创建页与编辑页共用此组件，零改动生效。

**技术栈：** Next.js 14 App Router、TypeScript、shadcn/ui、Radix DropdownMenu、Tailwind。

---

## 文件结构

- **修改：** `src/components/config/rules-editor.tsx`
  - 职责：规则列表的增删改、排序；其中"目标"字段改为下拉。
  - 唯一改动点。不动 `rule-providers-editor.tsx`、创建页、编辑页。

不创建新文件。不抽取可复用组件（YAGNI，当前只用一处）。

---

## 任务 1：替换目标字段为 DropdownMenu 自定义下拉

**文件：**
- 修改：`src/components/config/rules-editor.tsx`

- [ ] **步骤 1：更新导入**

在 `src/components/config/rules-editor.tsx` 顶部，lucide-react 导入已含 `ChevronDown`（第 4 行：`import { ChevronDown, ChevronRight, ListFilter, ArrowUp, ArrowDown, Trash2, Plus } from "lucide-react"`），无需再加。

新增 dropdown-menu 导入（放在现有 ui 导入之后，`ScrollArea` 那行之后）：

```tsx
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu"
```

- [ ] **步骤 2：新增内置策略常量**

在 `const NO_VALUE_TYPES = new Set(['MATCH', 'FINAL'])`（第 13 行）之后新增：

```tsx
const BUILTIN_TARGETS = ['DIRECT', 'REJECT', 'REJECT-DROP', 'PASS']
```

- [ ] **步骤 3：在组件内派生策略/分组两段**

在 `RulesEditor` 组件函数体内，`const [expanded, setExpanded] = useState(false)` 之后新增派生（基于 `ruleTargets` prop）：

```tsx
const policies = ruleTargets.filter((t) => BUILTIN_TARGETS.includes(t))
const groupTargets = ruleTargets.filter((t) => !BUILTIN_TARGETS.includes(t))
```

- [ ] **步骤 4：替换目标 Input 为 DropdownMenu**

把当前目标字段（第 86-92 行）：

```tsx
                  <Input
                    className="w-40 font-mono text-xs"
                    list="rule-targets"
                    value={rule.target}
                    onChange={(e) => updateRule(index, { target: e.target.value })}
                    placeholder="目标"
                  />
```

整体替换为：

```tsx
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-40 h-9 justify-between font-mono text-xs shrink-0"
                      >
                        <span className="truncate">{rule.target || "选择目标"}</span>
                        <ChevronDown className="h-3 w-3 opacity-50 shrink-0" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="max-h-60 overflow-y-auto w-40">
                      <DropdownMenuRadioGroup
                        value={rule.target}
                        onValueChange={(v) => updateRule(index, { target: v })}
                      >
                        <DropdownMenuLabel className="text-xs text-muted-foreground">策略</DropdownMenuLabel>
                        {policies.map((t) => (
                          <DropdownMenuRadioItem key={t} value={t} className="text-xs font-mono">
                            {t}
                          </DropdownMenuRadioItem>
                        ))}
                        {groupTargets.length > 0 && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuLabel className="text-xs text-muted-foreground">分组</DropdownMenuLabel>
                            {groupTargets.map((t) => (
                              <DropdownMenuRadioItem key={t} value={t} className="text-xs font-mono">
                                {t}
                              </DropdownMenuRadioItem>
                            ))}
                          </>
                        )}
                      </DropdownMenuRadioGroup>
                    </DropdownMenuContent>
                  </DropdownMenu>
```

说明：
- trigger 用 `Button variant="outline"`，`h-9` 对齐行高，`justify-between` 让值与箭头两端分布。
- `max-h-60 overflow-y-auto` 防止分组多时撑爆屏幕。
- orphan 值（`rule.target` 不在列表）：trigger 仍显示原值，`DropdownMenuRadioGroup` 无匹配项不报错，用户选其他项时覆盖——不丢值。
- 分组为空时省略"分组"标签与分隔符。

- [ ] **步骤 5：删除不再使用的 rule-targets datalist**

删除第 62-64 行：

```tsx
          <datalist id="rule-targets">
            {ruleTargets.map((t) => <option key={t} value={t} />)}
          </datalist>
```

（"rule-types" 的 datalist 保留，类型字段不变。）

- [ ] **步骤 6：确认 Input 仍被使用**

`Input` 仍在"类型"和"值"字段使用，导入保持不变。无需清理。

- [ ] **步骤 7：Lint**

运行：`npm run lint`
预期：PASS，无 `@typescript-eslint/no-unused-vars` 报错（所有新导入均被使用）。

- [ ] **步骤 8：Build**

运行：`npm run build`
预期：PASS，无类型错误。

- [ ] **步骤 9：手动验证**

启动 `npm run dev`，在创建页（`/configs`）和编辑页（`/configs/edit/[id]`）：
1. 展开规则配置，每条规则"目标"是一个带箭头的按钮（非原生 select 下拉箭头）。
2. 点击弹出面板，分"策略"和"分组"两段，分组段列出当前分组名。
3. 选中某项，按钮文本更新，配置预览实时刷新。
4. 切换模板使分组变化，下拉分组段随之变化。
5. 编辑一个已有配置，规则目标若不在列表中，按钮仍显示原值。

- [ ] **步骤 10：Commit**

```bash
git add src/components/config/rules-editor.tsx
git commit -m "feat: 规则目标字段改为自定义下拉选择

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## 自检

**1. 规格覆盖度：**
- 改动范围（仅 rules-editor.tsx）→ 任务 1。
- DropdownMenu + RadioGroup 实现 → 步骤 4。
- 分两段展示 → 步骤 3 + 4。
- 数据保护（orphan 值）→ 步骤 4 说明。
- 清理 datalist → 步骤 5。
- 不动类型字段 → 步骤 6 确认。
- 成功标准 lint/build/手测 → 步骤 7-9。
- 创建页+编辑页生效 → 步骤 9 双页验证。
全覆盖，无遗漏。

**2. 占位符扫描：** 无 TODO/待定，每步含完整代码或精确命令。

**3. 类型一致性：** `ruleTargets: string[]`、`updateRule(index, { target: v })`、`rule.target` 均与现有代码一致；`policies`/`groupTargets` 派生自 `ruleTargets`，类型为 `string[]`。`DropdownMenuRadioGroup` 的 `value`/`onValueChange` 与 Radix API 一致。
