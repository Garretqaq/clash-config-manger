"use client"

import { useEffect, useState, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Copy, Check, Download, AlertCircle, Loader2 } from "lucide-react"
import { showToast } from "@/components/ui/toast"

interface ConfigViewerProps {
  shareId: string
  initialConfigName: string
}

interface ShareData {
  configName: string
  content: string
  expiresAt: string | null
  views: number
  createdAt: string
}

export function ConfigViewer({ shareId, initialConfigName }: ConfigViewerProps) {
  const [data, setData] = useState<ShareData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const fetchConfig = useCallback(async () => {
    try {
      const res = await fetch(`/api/share/${shareId}`)

      if (res.status === 404) {
        setError("分享链接不存在")
        return
      }

      if (res.status === 410) {
        setError("分享链接已过期")
        return
      }

      if (!res.ok) {
        setError("获取配置失败")
        return
      }

      const content = await res.text()
      setData({
        configName: initialConfigName,
        content,
        expiresAt: null,
        views: 0,
        createdAt: new Date().toISOString(),
      })
    } catch (err) {
      setError("网络错误，请稍后重试")
    } finally {
      setLoading(false)
    }
  }, [shareId, initialConfigName])

  useEffect(() => {
    fetchConfig()
  }, [fetchConfig])

  const handleCopy = async () => {
    if (data?.content) {
      await navigator.clipboard.writeText(data.content)
      setCopied(true)
      showToast({ title: "已复制到剪贴板", variant: "success" })
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleDownload = () => {
    if (data?.content) {
      const blob = new Blob([data.content], { type: "text/yaml" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `${data.configName || "config"}.yaml`
      a.click()
      URL.revokeObjectURL(url)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/50">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/50">
        <Card className="max-w-md text-center">
          <CardContent className="pt-6">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h1 className="text-xl font-bold mb-2">
              {error === "分享链接不存在" ? "链接不存在" : error}
            </h1>
            <p className="text-muted-foreground">
              {error === "分享链接不存在"
                ? "此分享链接可能已被删除"
                : "无法访问此分享配置"}
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-muted/50">
      <div className="container mx-auto py-8 px-4">
        <Card className="max-w-4xl mx-auto">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-xl">{data?.configName}</CardTitle>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleCopy}>
                  {copied ? (
                    <Check className="h-4 w-4 mr-1 text-green-500" />
                  ) : (
                    <Copy className="h-4 w-4 mr-1" />
                  )}
                  复制
                </Button>
                <Button variant="outline" size="sm" onClick={handleDownload}>
                  <Download className="h-4 w-4 mr-1" />
                  下载
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[60vh] rounded-lg border">
              <pre className="p-4 text-sm font-mono whitespace-pre-wrap">
                {data?.content}
              </pre>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
