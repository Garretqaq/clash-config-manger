"use client"

import { useState } from "react"
import { ChevronDown, ChevronRight, ListFilter, GripVertical, Trash2, Plus } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu"
import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
} from "@dnd-kit/core"
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import type { RuleItem } from "@/lib/clash-rules"

const RULE_TYPES = ['DOMAIN', 'DOMAIN-SUFFIX', 'DOMAIN-KEYWORD', 'IP-CIDR', 'IP-CIDR6', 'IP-ASN', 'GEOIP', 'RULE-SET', 'DST-PORT', 'PROCESS-NAME', 'MATCH']
const NO_VALUE_TYPES = new Set(['MATCH', 'FINAL'])
const NO_RESOLVE_TYPES = new Set(['IP-CIDR', 'IP-CIDR6', 'IP-ASN', 'GEOIP'])
const BUILTIN_TARGETS = ['DIRECT', 'REJECT', 'REJECT-DROP', 'PASS']

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
  const policies = ruleTargets.filter((t) => BUILTIN_TARGETS.includes(t))
  const groupTargets = ruleTargets.filter((t) => !BUILTIN_TARGETS.includes(t))

  const addRule = () =>
    onChange([...rules, { type: 'DOMAIN-SUFFIX', value: '', target: 'DIRECT' }])

  const updateRule = (index: number, patch: Partial<RuleItem>) =>
    onChange(
      rules.map((r, i) => {
        if (i !== index) return r
        const next = { ...r, ...patch }
        if (patch.type !== undefined) next.type = patch.type.toUpperCase()
        if (next.type === 'MATCH' || next.type === 'FINAL') next.value = ''
        if (!NO_RESOLVE_TYPES.has(next.type)) next.noResolve = false
        return next
      })
    )

  const deleteRule = (index: number) => onChange(rules.filter((_, i) => i !== index))

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = Number(active.id)
    const newIndex = Number(over.id)
    if (Number.isNaN(oldIndex) || Number.isNaN(newIndex)) return
    onChange(arrayMove(rules, oldIndex, newIndex))
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
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <ScrollArea className="h-[320px] pr-4">
              <SortableContext items={rules.map((_, i) => i)} strategy={verticalListSortingStrategy}>
                <div className="space-y-1.5">
                  {rules.map((rule, index) => (
                    <SortableRuleRow
                      key={index}
                      rule={rule}
                      index={index}
                      policies={policies}
                      groupTargets={groupTargets}
                      onUpdate={updateRule}
                      onDelete={deleteRule}
                    />
                  ))}
                </div>
              </SortableContext>
            </ScrollArea>
          </DndContext>
          <Button variant="outline" size="sm" className="mt-4 w-full" onClick={addRule}>
            <Plus className="h-4 w-4 mr-2" />
            添加规则
          </Button>
        </CardContent>
      )}
    </Card>
  )
}

function SortableRuleRow({
  rule,
  index,
  policies,
  groupTargets,
  onUpdate,
  onDelete,
}: {
  rule: RuleItem
  index: number
  policies: string[]
  groupTargets: string[]
  onUpdate: (index: number, patch: Partial<RuleItem>) => void
  onDelete: (index: number) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: index })
  const style = { transform: CSS.Transform.toString(transform), transition }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-1.5 ${isDragging ? "opacity-50" : ""}`}
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground shrink-0 px-0.5"
      >
        <GripVertical className="h-3.5 w-3.5" />
      </button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            className="w-36 h-9 justify-between font-mono text-xs shrink-0"
          >
            <span className="truncate">{rule.type || "选择类型"}</span>
            <ChevronDown className="h-3 w-3 opacity-50 shrink-0" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="max-h-60 overflow-y-auto w-36">
          <DropdownMenuRadioGroup
            value={rule.type}
            onValueChange={(v) => onUpdate(index, { type: v })}
          >
            {RULE_TYPES.map((t) => (
              <DropdownMenuRadioItem key={t} value={t} className="text-xs font-mono">
                {t}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      <Input
        className="flex-1 font-mono text-xs"
        value={rule.value}
        disabled={NO_VALUE_TYPES.has(rule.type)}
        onChange={(e) => onUpdate(index, { value: e.target.value })}
        placeholder="值"
      />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            className="w-36 h-9 justify-between font-mono text-xs shrink-0"
          >
            <span className="truncate">{rule.target || "选择目标"}</span>
            <ChevronDown className="h-3 w-3 opacity-50 shrink-0" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="max-h-60 overflow-y-auto w-36">
          <DropdownMenuRadioGroup
            value={rule.target}
            onValueChange={(v) => onUpdate(index, { target: v })}
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
      {NO_RESOLVE_TYPES.has(rule.type) && (
        <label className="flex items-center gap-1 shrink-0 cursor-pointer select-none text-xs font-mono text-muted-foreground">
          <Checkbox
            checked={!!rule.noResolve}
            onChange={(e) => onUpdate(index, { noResolve: e.target.checked })}
          />
          no-resolve
        </label>
      )}
      <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive" onClick={() => onDelete(index)}>
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  )
}
