# 配置编辑器支持 rules 结构化编辑

日期：2026-07-08
范围：`src/app/(dashboard)/configs/edit/[id]/page.tsx`、`src/lib/clash-generator.ts`、`src/app/api/configs/route.ts`

## 背景

配置编辑器（`configs/edit/[id]`）当前只支持"节点拖进分组"（proxy-groups 节点映射），rules 完全来自模板、原样透传、不可编辑。用户希望在配置编辑器中解析并修改 rules。

关键现状：
- `config.content`（YAML）已包含 `rules:` 段。
- 保存时 API（POST/PUT）用 `ClashGenerator.generate({ template: template.content, ... })` **从模板重新生成 content**，rules 从模板拉取。
- `generate()` 目前只重写 `proxy-groups`，rules 原样保留模板的。

## 目标

在配置编辑器中，把 `rules:` 解析为结构化列表，支持增、删、改、排序，保存后随配置 content 持久化，并在预览中实时反映。

## 非目标（YAGNI）

- 模板编辑器的 rules 结构化编辑（本次不做）。
- 新建配置（POST）阶段的 rules 编辑（沿用模板）。
- rules 的语法校验/连通性校验。
- `no-resolve` 等尾部参数的独立开关（并入 target 原样保留）。

## 数据流与持久化（不新增数据库字段）

利用 `config.content` 作为 rules 的存储载体，闭环往返：

```
加载  configData.content ──js-yaml解析──▶ rules: RuleItem[]  (新 state)
编辑  结构化 UI 增删改排序
预览  preview useEffect 里 generate() 新增 rules 覆盖参数
保存  PUT body 加 rules: string[] ──▶ API 传给 generate() 覆盖 config.rules
      ──▶ 落库到 content ──▶ 下次加载再解析（闭环）
```

- `ClashGenerator.generate()` 增加可选入参 `rules?: string[]`：传入则在 dump 前 `config.rules = rules` 覆盖；未传维持模板原样（向后兼容 POST 和旧调用）。
- API 的 PUT 从 body 读取可选 `rules`，透传给 `generate()`。POST 不改。
- **不新增 Prisma 字段**，`content` 字段完成 rules 的往返。首次编辑存量配置时，content 已含模板 rules，前端解析出来即可正常往返。

## RuleItem 结构与解析

```ts
type RuleItem = { type: string; value: string; target: string }
```

纯函数（抽到可测位置，附 assert 自检）：
- `parseRules(content: string): RuleItem[]`
  - `yaml.load` 取 `rules: string[]`，每行按逗号 split。
  - `MATCH` 等无 value 的类型：`[type, target]`，value 置空。
  - 其余：`[type, value, ...rest]`，`target = rest.join(',')`，使 IP 规则第 4 段 `no-resolve` 原样并入 target。
- `serializeRules(items: RuleItem[]): string[]`
  - MATCH（value 空）→ `TYPE,TARGET`；否则 `TYPE,VALUE,TARGET`。

`// ponytail: no-resolve 尾段并入 target；需独立开关时再拆字段`

## 编辑 UI

右列在「分组配置」与「配置预览」之间新增一张「规则配置」Card，**默认折叠**（Card 头部可点击展开/收起）：

- 展开后是固定高度 ScrollArea，逐行渲染 RuleItem：
  - **类型** select：DOMAIN / DOMAIN-SUFFIX / DOMAIN-KEYWORD / IP-CIDR / IP-CIDR6 / GEOIP / RULE-SET / DST-PORT / PROCESS-NAME / MATCH，并允许自由输入其他类型。
  - **值** input：type=MATCH 时禁用。
  - **目标** input + datalist：内置 `DIRECT / REJECT / REJECT-DROP / PASS` + 当前分组名 `Object.keys(nodeMapping)`，也允许自由输入。
  - **排序**：每行「上移 / 下移」箭头按钮（不引入第二套拖拽）。
  - **删除**：行尾删除按钮。
- 底部「添加规则」按钮，追加一条空 RuleItem。

`// ponytail: 排序用上移/下移按钮；要真拖拽再叠独立 DndContext`

## 组件边界

- `parseRules` / `serializeRules`：纯函数，输入输出明确，独立可测，不依赖 React。
- 「规则配置」Card：受控组件，接收 `rules`、`onChange`、`groupNames`，内部不持有业务逻辑。
- `page.tsx`：持有 `rules` state，串起 加载解析 → 编辑 → 预览 → 保存序列化。

## 改动点清单

1. `src/lib/clash-generator.ts`：`GenerateOptions` 加 `rules?: string[]`，`generate()` 覆盖逻辑。
2. `src/lib/`：新增 rules 解析/序列化纯函数 + 自检。
3. `src/app/(dashboard)/configs/edit/[id]/page.tsx`：
   - `loadConfigData` 里解析 `configData.content` → `rules` state。
   - preview useEffect 传 `rules` 给 `generate()`。
   - handleSave 的 PUT body 加 `rules: serializeRules(...)`。
   - 新增「规则配置」Card + 行编辑 + 上移/下移/删除/添加。
4. `src/app/api/configs/route.ts`：PUT 读取 body 的 `rules` 并透传给 `generate()`。

## 测试/验证

- `parseRules`/`serializeRules` 往返自检（含 MATCH、含 no-resolve 的 IP 规则）。
- 手动：编辑一条 rule 的 target → 预览实时变化 → 保存 → 重新进入编辑页，rule 仍为修改后的值。
