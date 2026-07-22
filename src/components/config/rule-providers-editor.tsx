"use client"

import { useState } from "react"
import { ChevronDown, ChevronRight, Server, ArrowUp, ArrowDown, Trash2, Plus } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
        <CardContent className="space-y-2">
          {providers.map((p, index) => {
            const dup = p.name !== '' && (nameCounts.get(p.name) ?? 0) > 1
            return (
              <div key={index} className="rounded-lg border p-2 space-y-1">
                <div className="flex items-center gap-1.5">
                  <Input
                    className="flex-1 h-8 font-mono text-xs"
                    value={p.name}
                    onChange={(e) => update(index, { name: e.target.value })}
                    placeholder="名称（唯一）"
                  />
                  <select
                    className="flex h-8 w-20 rounded-md border border-input bg-transparent px-2 text-xs shrink-0"
                    value={p.type}
                    onChange={(e) => update(index, { type: e.target.value })}
                  >
                    {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <select
                    className="flex h-8 w-28 rounded-md border border-input bg-transparent px-2 text-xs shrink-0"
                    value={p.behavior}
                    onChange={(e) => update(index, { behavior: e.target.value })}
                  >
                    {BEHAVIORS.map((b) => <option key={b} value={b}>{b}</option>)}
                  </select>
                  <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => move(index, -1)} disabled={index === 0}>
                    <ArrowUp className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => move(index, 1)} disabled={index === providers.length - 1}>
                    <ArrowDown className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive" onClick={() => remove(index)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
                {dup && <p className="text-xs text-destructive">名称重复</p>}
                <Input
                  className="h-8 font-mono text-xs"
                  value={p.url}
                  disabled={p.type === 'file'}
                  onChange={(e) => update(index, { url: e.target.value })}
                  placeholder={p.type === 'file' ? 'file 类型无需 url' : 'https://...'}
                />
                <div className="grid grid-cols-2 gap-1.5">
                  <Input className="h-8 font-mono text-xs" value={p.path} onChange={(e) => update(index, { path: e.target.value })} placeholder="path: ./ruleset/xx.yaml" />
                  <Input className="h-8 font-mono text-xs" value={p.interval} onChange={(e) => update(index, { interval: e.target.value })} placeholder="interval: 86400" />
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
