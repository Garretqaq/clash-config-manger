"use client"

import { useState } from "react"
import { ChevronDown, ChevronRight, Globe, Wand2, X } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Textarea } from "@/components/ui/textarea"
import {
  ENHANCED_MODES,
  applyPreset,
  serializeDns,
  type DnsConfig,
} from "@/lib/clash-dns"

// 数组 ⇆ 每行一条的 Textarea 文本
const listText = (value: unknown): string => (Array.isArray(value) ? value.map(String).join("\n") : "")

export function DnsEditor({
  dns,
  onChange,
}: {
  dns: DnsConfig
  onChange: (dns: DnsConfig) => void
}) {
  const [expanded, setExpanded] = useState(false)

  const set = (key: string, value: unknown) => onChange({ ...dns, [key]: value })

  const setList = (key: string, text: string) =>
    set(key, text.split("\n").map((s) => s.trim()).filter(Boolean))

  const fallbackFilter = (dns["fallback-filter"] && typeof dns["fallback-filter"] === "object"
    ? dns["fallback-filter"]
    : {}) as Record<string, unknown>

  const setFallbackFilter = (patch: Record<string, unknown>) =>
    set("fallback-filter", { ...fallbackFilter, ...patch })

  const serialized = serializeDns(dns)
  const configured = Object.keys(serialized).length > 0
  const enhancedMode = typeof dns["enhanced-mode"] === "string" ? dns["enhanced-mode"] : ""
  const extraModes =
    enhancedMode !== "" && !(ENHANCED_MODES as readonly string[]).includes(enhancedMode)
      ? [enhancedMode]
      : []

  // 未列入一等字段的子键（fake-ip-filter / nameserver-policy / listen 等）原样保留，不在此展示
  const passthroughKeys = Object.keys(serialized).filter(
    (k) =>
      ![
        "enable",
        "ipv6",
        "use-hosts",
        "default-nameserver",
        "nameserver",
        "fallback",
        "fallback-filter",
        "enhanced-mode",
        "fake-ip-range",
      ].includes(k),
  )

  return (
    <Card>
      <CardHeader className="pb-3 cursor-pointer select-none" onClick={() => setExpanded((v) => !v)}>
        <CardTitle className="text-base flex items-center gap-2">
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          <Globe className="h-4 w-4 text-primary" />
          DNS 配置
          <Badge variant="secondary" className="ml-1">
            {!configured ? "未配置" : serialized.enable === true ? "已启用" : "未启用"}
          </Badge>
        </CardTitle>
      </CardHeader>
      {expanded && (
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <label className="flex items-center gap-1.5 text-xs cursor-pointer">
              <Checkbox checked={dns.enable === true} onChange={(e) => set("enable", e.target.checked)} />
              enable
            </label>
            <label className="flex items-center gap-1.5 text-xs cursor-pointer">
              <Checkbox checked={dns.ipv6 === true} onChange={(e) => set("ipv6", e.target.checked)} />
              ipv6
            </label>
            <label className="flex items-center gap-1.5 text-xs cursor-pointer">
              <Checkbox
                checked={dns["use-hosts"] === true}
                onChange={(e) => set("use-hosts", e.target.checked)}
              />
              use-hosts
            </label>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">enhanced-mode</Label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-2 text-xs font-mono"
                value={enhancedMode}
                onChange={(e) => set("enhanced-mode", e.target.value)}
              >
                <option value="">未设置</option>
                {[...ENHANCED_MODES, ...extraModes].map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">fake-ip-range</Label>
              <Input
                className="font-mono text-xs"
                value={typeof dns["fake-ip-range"] === "string" ? dns["fake-ip-range"] : ""}
                onChange={(e) => set("fake-ip-range", e.target.value)}
                placeholder="198.18.0.1/16"
              />
            </div>
          </div>

          <div className="grid gap-2 md:grid-cols-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">default-nameserver</Label>
              <Textarea
                className="font-mono text-xs min-h-[76px]"
                rows={4}
                value={listText(dns["default-nameserver"])}
                onChange={(e) => setList("default-nameserver", e.target.value)}
                placeholder={"223.5.5.5\n119.29.29.29"}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">nameserver</Label>
              <Textarea
                className="font-mono text-xs min-h-[76px]"
                rows={4}
                value={listText(dns.nameserver)}
                onChange={(e) => setList("nameserver", e.target.value)}
                placeholder={"https://doh.pub/dns-query\nhttps://dns.alidns.com/dns-query"}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">fallback</Label>
              <Textarea
                className="font-mono text-xs min-h-[76px]"
                rows={4}
                value={listText(dns.fallback)}
                onChange={(e) => setList("fallback", e.target.value)}
                placeholder={"https://dns.cloudflare.com/dns-query\nhttps://dns.google/dns-query\ntls://8.8.4.4:853"}
              />
            </div>
          </div>

          <div className="rounded-lg border p-2 space-y-2">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <span className="text-xs font-medium text-muted-foreground">fallback-filter</span>
              <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                <Checkbox
                  checked={fallbackFilter.geoip === true}
                  onChange={(e) => setFallbackFilter({ geoip: e.target.checked })}
                />
                geoip
              </label>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">ipcidr（每行一条）</Label>
              <Textarea
                className="font-mono text-xs min-h-[76px]"
                rows={4}
                value={listText(fallbackFilter.ipcidr)}
                onChange={(e) =>
                  setFallbackFilter({
                    ipcidr: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean),
                  })
                }
                placeholder={"240.0.0.0/4\n0.0.0.0/32"}
              />
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            列表均按「每行一条」填写。其他 dns 子键（fake-ip-filter、nameserver-policy、listen 等）保留原值，
            不在此展示。
            {passthroughKeys.length > 0 && ` 当前保留：${passthroughKeys.join("、")}`}
          </p>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => onChange(applyPreset(dns))}>
              <Wand2 className="h-4 w-4 mr-2" />
              填入推荐配置
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-destructive"
              onClick={() => onChange({})}
              disabled={!configured}
            >
              <X className="h-4 w-4 mr-2" />
              清空
            </Button>
          </div>
        </CardContent>
      )}
    </Card>
  )
}
