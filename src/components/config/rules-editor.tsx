"use client"

import { useState } from "react"
import { ChevronDown, ChevronRight, ListFilter, ArrowUp, ArrowDown, Trash2, Plus } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
import type { RuleItem } from "@/lib/clash-rules"

const RULE_TYPES = ['DOMAIN', 'DOMAIN-SUFFIX', 'DOMAIN-KEYWORD', 'IP-CIDR', 'IP-CIDR6', 'GEOIP', 'RULE-SET', 'DST-PORT', 'PROCESS-NAME', 'MATCH']
const NO_VALUE_TYPES = new Set(['MATCH', 'FINAL'])
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
