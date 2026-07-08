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
