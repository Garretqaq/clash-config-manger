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
import { Plus, FileCode2, Trash2, Edit, Star, Copy } from "lucide-react"
import type { Template } from "@/lib/types"

const DEFAULT_TEMPLATE = `# Clash 配置模板
port: 7890
socks-port: 7891
allow-lan: true
mode: rule
log-level: info

proxies: []

proxy-groups:
  - name: Proxy
    type: select
    proxies: []
  - name: Auto
    type: url-test
    proxies: []
    url: 'http://www.gstatic.com/generate_204'
    interval: 300

rules:
  - GEOIP,LAN,DIRECT
  - GEOIP,CN,DIRECT
  - MATCH,Proxy
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
          alert(updated.error || "保存失败")
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
          alert(created.error || "创建失败")
          return
        }
      }
      setIsEditorOpen(false)
    } catch (error) {
      console.error("保存模板失败:", error)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("确定要删除这个模板吗？")) return

    try {
      await fetch(`/api/templates?id=${id}`, { method: "DELETE" })
      setTemplates((prev) => prev.filter((t) => t.id !== id))
    } catch (error) {
      console.error("删除模板失败:", error)
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
