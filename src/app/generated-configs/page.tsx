"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { PageHeader } from "@/components/layout/PageHeader"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  FileCode2,
  Download,
  Trash2,
  Eye,
  Copy,
  Check,
  Pencil,
} from "lucide-react"
import { showToast } from "@/components/ui/toast"
import { showConfirm } from "@/components/ui/confirm-dialog"
import type { Config } from "@/lib/types"

export default function GeneratedConfigsPage() {
  const router = useRouter()
  const [configs, setConfigs] = useState<Config[]>([])
  const [loading, setLoading] = useState(true)
  const [previewConfig, setPreviewConfig] = useState<Config | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const fetchConfigs = useCallback(async () => {
    try {
      const res = await fetch("/api/configs")
      const data = await res.json()
      setConfigs(data)
    } catch (error) {
      console.error("获取配置失败:", error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchConfigs()
  }, [fetchConfigs])

  const handleExport = (content: string, name: string) => {
    const blob = new Blob([content], { type: "text/yaml" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${name}.yaml`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleCopy = async (content: string, id: string) => {
    await navigator.clipboard.writeText(content)
    setCopiedId(id)
    showToast({ title: "已复制", description: "配置内容已复制到剪贴板", variant: "success" })
    setTimeout(() => setCopiedId(null), 2000)
  }

  const handleDelete = async (id: string) => {
    const confirmed = await showConfirm({
      title: "删除配置",
      description: "确定要删除这个配置吗？",
      variant: "destructive",
    })
    if (!confirmed) return

    try {
      await fetch(`/api/configs?id=${id}`, { method: "DELETE" })
      setConfigs((prev) => prev.filter((c) => c.id !== id))
      showToast({ title: "删除成功", description: "配置已删除", variant: "success" })
    } catch (error) {
      console.error("删除配置失败:", error)
      showToast({ title: "删除失败", description: "网络错误，请稍后重试", variant: "destructive" })
    }
  }

  const formatDate = (date: string) => {
    const d = new Date(date)
    const now = new Date()
    const diff = now.getTime() - d.getTime()
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))

    if (days === 0) return "今天"
    if (days === 1) return "昨天"
    if (days < 7) return `${days}天前`
    return d.toLocaleDateString("zh-CN")
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
        title="配置管理"
        description="管理所有已生成的配置文件"
      />

      {configs.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center h-64 text-muted-foreground">
            <FileCode2 className="h-12 w-12 mb-4 opacity-50" />
            <p>暂无已保存的配置</p>
            <p className="text-sm">请先到配置生成页面创建配置</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {configs.map((config) => (
            <Card key={config.id} className="hover:border-primary/50 transition-colors">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <FileCode2 className="h-5 w-5 text-primary" />
                    <CardTitle className="text-lg">{config.name}</CardTitle>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {formatDate(config.createdAt)}
                  </span>
                </div>
                <CardDescription>
                  节点映射: {Object.keys(config.nodeMapping).length} 个分组
                </CardDescription>
              </CardHeader>
              <CardContent>
                <pre className="text-xs text-muted-foreground bg-muted/50 p-3 rounded-lg overflow-hidden max-h-24 mb-4">
                  {config.content.slice(0, 150)}...
                </pre>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => setPreviewConfig(config)}
                  >
                    <Eye className="h-3 w-3 mr-1" />
                    预览
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => router.push(`/configs/edit/${config.id}`)}
                  >
                    <Pencil className="h-3 w-3 mr-1" />
                    编辑
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => handleExport(config.content, config.name)}
                  >
                    <Download className="h-3 w-3 mr-1" />
                    导出
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleCopy(config.content, config.id)}
                  >
                    {copiedId === config.id ? (
                      <Check className="h-3 w-3 text-green-500" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => handleDelete(config.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* 预览对话框 */}
      <Dialog open={!!previewConfig} onOpenChange={() => setPreviewConfig(null)}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>{previewConfig?.name}</DialogTitle>
          </DialogHeader>
          <ScrollArea className="h-[60vh] rounded-lg border">
            <pre className="p-4 text-sm font-mono whitespace-pre-wrap">
              {previewConfig?.content}
            </pre>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  )
}
