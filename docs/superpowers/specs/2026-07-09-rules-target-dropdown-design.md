# 规则目标下拉选择 设计规格

日期：2026-07-09
主题：配置编辑（规则配置）中规则"目标"字段改为自定义下拉选择

## 背景

`RulesEditor`（`src/components/config/rules-editor.tsx`）每条规则有三个字段：类型、值、目标。当前"目标"字段是 `<Input list="rule-targets">`，配合 `<datalist>` 提供建议值。用户希望把它改成自定义下拉 UI（非原生 `<select>`），从分组列表里挑选目标。

`ruleTargets` 由两个调用方（创建页 `src/app/(dashboard)/configs/page.tsx`、编辑页 `src/app/(dashboard)/configs/edit/[id]/page.tsx`）构造为：
```
['DIRECT', 'REJECT', 'REJECT-DROP', 'PASS', ...Object.keys(nodeMapping)]
```
即内置策略 + 当前配置的分组名。

## 约束与决策

- **不引入新依赖**：项目已安装 `@radix-ui/react-dropdown-menu`，`src/components/ui/dropdown-menu.tsx` 已是真正的自定义弹层 UI，直接复用。
- **不用 `src/components/ui/select.tsx`**：它内部是原生 `<select>` 薄封装，不满足"自定义 UI"要求。
- **不改组件签名**：`RulesEditor` 接收扁平 `ruleTargets: string[]`，在组件内用已知常量拆分内置策略与分组名，两个调用方零改动。
- **不动"类型"字段**：仅改"目标"，保持外科手术式改动。
- **纯下拉，不可自由输入**（用户已确认方案 A）。

## 设计

### 改动范围
仅 `src/components/config/rules-editor.tsx`。创建页与编辑页共用此组件，一次改动两边生效。

### 目标字段新实现
把"目标" `<Input list="rule-targets">` 替换为基于 `DropdownMenu` 的单选下拉：

- 常量：`const BUILTIN_TARGETS = ['DIRECT', 'REJECT', 'REJECT-DROP', 'PASS']`
- 在组件内从 `ruleTargets` 派生：
  - `policies = ruleTargets.filter(t => BUILTIN_TARGETS.includes(t))`
  - `groups = ruleTargets.filter(t => !BUILTIN_TARGETS.includes(t))`
- Trigger：`<Button variant="outline" className="h-9 w-40 justify-between font-mono text-xs">`，显示 `rule.target || '选择目标'`，右侧 `ChevronDown` 图标。
- Content：`<DropdownMenuContent className="max-h-60 overflow-y-auto">`
  - `<DropdownMenuLabel>` "策略" + 各 `policies` 项
  - `<DropdownMenuSeparator />`
  - `<DropdownMenuLabel>` "分组" + 各 `groups` 项
  - 项用 `DropdownMenuRadioGroup value={rule.target} onValueChange={v => updateRule(index, { target: v })}` 包裹，每项为 `DropdownMenuRadioItem value={t}`。
  - 分组为空时省略"分组"标签与分隔符。

### 数据保护
若 `rule.target` 不在 `ruleTargets` 中（外部编辑过的配置、分组被删后的残留值）：trigger 仍显示该值，用户未主动选择前不丢失；选中其他项时覆盖。不需要为 orphan 值额外插入 option。

### 清理
删除不再使用的 `<datalist id="rule-targets">`（"rule-types" 的 datalist 保留，类型字段不变）。

### 导入
新增导入：`DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuRadioGroup, DropdownMenuRadioItem` from `@/components/ui/dropdown-menu`；`ChevronDown` from `lucide-react`（`ChevronDown` 已在文件 lucide 导入中，复用即可）。

## 成功标准
1. 规则编辑展开后，每条规则"目标"是一个自定义下拉按钮（非原生 select），点击弹出面板。
2. 面板分"策略"与"分组"两段，分组段列出当前配置的所有分组名。
3. 选中某项后，目标字段更新为该值，面板关闭，配置预览实时刷新。
4. 已有规则的目标值若不在列表中，按钮仍显示原值，不丢失。
5. 创建页与编辑页均生效。
6. `npm run lint` 通过，`npm run build` 通过。

## 不做
- 不改"类型"字段的输入方式。
- 不做可输入+下拉的 combobox（用户已选纯下拉）。
- 不把下拉抽成独立可复用组件（当前只用一处，YAGNI；类型字段若以后也要下拉再抽）。
- 不引 `@radix-ui/react-popover` / `cmdk`。
