"use client"

import { useState, useEffect, useCallback } from "react"
import { PageHeader } from "@/components/layout/PageHeader"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Plus, FileCode2, Trash2, Edit, Star } from "lucide-react"
import { showToast } from "@/components/ui/toast"
import { showConfirm } from "@/components/ui/confirm-dialog"
import type { Template } from "@/lib/types"

const DEFAULT_TEMPLATE = `mixed-port: 7890
allow-lan: true
bind-address: "*"
mode: rule
log-level: info
external-controller: 127.0.0.1:9090
dns:
    enable: true
    ipv6: false
    default-nameserver: [223.5.5.5, 119.29.29.29]
    enhanced-mode: fake-ip
    fake-ip-range: 198.18.0.1/16
    use-hosts: true
    nameserver: ['https://doh.pub/dns-query', 'https://dns.alidns.com/dns-query']
    fallback: ['https://doh.dns.sb/dns-query', 'https://dns.cloudflare.com/dns-query', 'https://dns.twnic.tw/dns-query', 'tls://8.8.4.4:853']
    fallback-filter: { geoip: true, ipcidr: [240.0.0.0/4, 0.0.0.0/32] }
proxies: []

proxy-groups:
  - name: 🚀自动选择
    type: url-test
    proxies:
    url: 'http://www.gstatic.com/generate_204'
rule-providers:
  reject:
    type: http
    behavior: domain
    url: "https://cdn.jsdelivr.net/gh/Loyalsoldier/clash-rules@release/reject.txt"
    path: ./ruleset/reject.yaml
    interval: 86400
  icloud:
    type: http
    behavior: domain
    url: "https://cdn.jsdelivr.net/gh/Loyalsoldier/clash-rules@release/icloud.txt"
    path: ./ruleset/icloud.yaml
    interval: 86400
  apple:
    type: http
    behavior: domain
    url: "https://cdn.jsdelivr.net/gh/Loyalsoldier/clash-rules@release/apple.txt"
    path: ./ruleset/apple.yaml
    interval: 86400
  google:
    type: http
    behavior: domain
    url: "https://cdn.jsdelivr.net/gh/Loyalsoldier/clash-rules@release/google.txt"
    path: ./ruleset/google.yaml
    interval: 86400
  proxy:
    type: http
    behavior: domain
    url: "https://cdn.jsdelivr.net/gh/Loyalsoldier/clash-rules@release/proxy.txt"
    path: ./ruleset/proxy.yaml
    interval: 86400
  direct:
    type: http
    behavior: domain
    url: "https://cdn.jsdelivr.net/gh/Loyalsoldier/clash-rules@release/direct.txt"
    path: ./ruleset/direct.yaml
    interval: 86400
  private:
    type: http
    behavior: domain
    url: "https://cdn.jsdelivr.net/gh/Loyalsoldier/clash-rules@release/private.txt"
    path: ./ruleset/private.yaml
    interval: 86400
  gfw:
    type: http
    behavior: domain
    url: "https://cdn.jsdelivr.net/gh/Loyalsoldier/clash-rules@release/gfw.txt"
    path: ./ruleset/gfw.yaml
    interval: 86400
  tld-not-cn:
    type: http
    behavior: domain
    url: "https://cdn.jsdelivr.net/gh/Loyalsoldier/clash-rules@release/tld-not-cn.txt"
    path: ./ruleset/tld-not-cn.yaml
    interval: 86400
  telegramcidr:
    type: http
    behavior: ipcidr
    url: "https://cdn.jsdelivr.net/gh/Loyalsoldier/clash-rules@release/telegramcidr.txt"
    path: ./ruleset/telegramcidr.yaml
    interval: 86400
  cncidr:
    type: http
    behavior: ipcidr
    url: "https://cdn.jsdelivr.net/gh/Loyalsoldier/clash-rules@release/cncidr.txt"
    path: ./ruleset/cncidr.yaml
    interval: 86400
  lancidr:
    type: http
    behavior: ipcidr
    url: "https://cdn.jsdelivr.net/gh/Loyalsoldier/clash-rules@release/lancidr.txt"
    path: ./ruleset/lancidr.yaml
    interval: 86400
  applications:
    type: http
    behavior: classical
    url: "https://cdn.jsdelivr.net/gh/Loyalsoldier/clash-rules@release/applications.txt"
    path: ./ruleset/applications.yaml
    interval: 86400
rules:
  - RULE-SET,applications,DIRECT
  - RULE-SET,private,DIRECT
  - RULE-SET,reject,REJECT
  - RULE-SET,icloud,DIRECT
  - RULE-SET,apple,DIRECT
  - RULE-SET,google,🚀自动选择
  - RULE-SET,proxy,🚀自动选择
  - RULE-SET,direct,DIRECT
  - RULE-SET,lancidr,DIRECT
  - RULE-SET,cncidr,DIRECT
  - RULE-SET,telegramcidr,🚀自动选择
  - GEOIP,LAN,DIRECT
  - GEOIP,CN,DIRECT
  - MATCH,🚀自动选择
`

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [isEditorOpen, setIsEditorOpen] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null)
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    content: DEFAULT_TEMPLATE,
    isDefault: false,
  })

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/templates")
      const data = await res.json()
      setTemplates(data)
    } catch (error) {
      console.error("获取模板失败:", error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const openEditor = (template?: Template) => {
    if (template) {
      setEditingTemplate(template)
      setFormData({
        name: template.name,
        description: template.description || "",
        content: template.content,
        isDefault: template.isDefault,
      })
    } else {
      setEditingTemplate(null)
      setFormData({
        name: "",
        description: "",
        content: DEFAULT_TEMPLATE,
        isDefault: false,
      })
    }
    setIsEditorOpen(true)
  }

  const handleSave = async () => {
    if (!formData.name.trim() || !formData.content.trim()) return

    try {
      if (editingTemplate) {
        // 更新
        const res = await fetch("/api/templates", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: editingTemplate.id, ...formData }),
        })
        const updated = await res.json()
        if (res.ok) {
          setTemplates((prev) =>
            prev.map((t) => (t.id === editingTemplate.id ? updated : t))
          )
        } else {
          showToast({ title: "保存失败", description: updated.error || "未知错误", variant: "destructive" })
          return
        }
      } else {
        // 创建
        const res = await fetch("/api/templates", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData),
        })
        const created = await res.json()
        if (res.ok) {
          setTemplates((prev) => [created, ...prev])
        } else {
          showToast({ title: "创建失败", description: created.error || "未知错误", variant: "destructive" })
          return
        }
      }
      setIsEditorOpen(false)
    } catch (error) {
      console.error("保存模板失败:", error)
    }
  }

  const handleDelete = async (id: string) => {
    const confirmed = await showConfirm({
      title: "删除模板",
      description: "确定要删除这个模板吗？",
      variant: "destructive",
    })
    if (!confirmed) return

    try {
      await fetch(`/api/templates?id=${id}`, { method: "DELETE" })
      setTemplates((prev) => prev.filter((t) => t.id !== id))
      showToast({ title: "删除成功", description: "模板已删除", variant: "success" })
    } catch (error) {
      console.error("删除模板失败:", error)
      showToast({ title: "删除失败", description: "网络错误，请稍后重试", variant: "destructive" })
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <>
      <PageHeader
        title="模板管理"
        description="管理 Clash 配置模板，包含规则和分组设置"
      >
        <Button onClick={() => openEditor()}>
          <Plus className="h-4 w-4 mr-2" />
          新建模板
        </Button>
      </PageHeader>

      {templates.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center h-64 text-muted-foreground">
            <FileCode2 className="h-12 w-12 mb-4 opacity-50" />
            <p>暂无模板</p>
            <p className="text-sm">点击上方按钮创建模板</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {templates.map((template) => (
            <Card
              key={template.id}
              className="hover:border-primary/50 transition-colors cursor-pointer"
              onClick={() => openEditor(template)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <FileCode2 className="h-5 w-5 text-primary" />
                    <CardTitle className="text-lg">{template.name}</CardTitle>
                  </div>
                  {template.isDefault && (
                    <Badge className="bg-yellow-500/20 text-yellow-400">
                      <Star className="h-3 w-3 mr-1" />
                      默认
                    </Badge>
                  )}
                </div>
                {template.description && (
                  <CardDescription>{template.description}</CardDescription>
                )}
              </CardHeader>
              <CardContent>
                <pre className="text-xs text-muted-foreground bg-muted/50 p-3 rounded-lg overflow-hidden max-h-32">
                  {template.content.slice(0, 200)}...
                </pre>
                <div className="flex gap-2 mt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={(e) => {
                      e.stopPropagation()
                      openEditor(template)
                    }}
                  >
                    <Edit className="h-4 w-4 mr-2" />
                    编辑
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground hover:text-destructive"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDelete(template.id)
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* 模板编辑器对话框 */}
      <Dialog open={isEditorOpen} onOpenChange={setIsEditorOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>
              {editingTemplate ? "编辑模板" : "新建模板"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">模板名称</label>
                <Input
                  placeholder="例如: 基础模板"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, name: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">描述（可选）</label>
                <Input
                  placeholder="模板描述"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, description: e.target.value }))
                  }
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">YAML 配置</label>
              <ScrollArea className="h-[400px] rounded-lg border">
                <textarea
                  className="w-full h-full min-h-[400px] p-4 bg-transparent font-mono text-sm resize-none focus:outline-none"
                  placeholder="输入 YAML 配置..."
                  value={formData.content}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, content: e.target.value }))
                  }
                />
              </ScrollArea>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isDefault"
                checked={formData.isDefault}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, isDefault: e.target.checked }))
                }
                className="rounded"
              />
              <label htmlFor="isDefault" className="text-sm">
                设为默认模板
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditorOpen(false)}>
              取消
            </Button>
            <Button onClick={handleSave}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
