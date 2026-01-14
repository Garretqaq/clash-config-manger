"use client"

import { useState, useEffect, useCallback } from "react"
import { PageHeader } from "@/components/layout/PageHeader"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Trash2, Copy, Search, Loader2 } from "lucide-react"
import { showToast } from "@/components/ui/toast"
import { showConfirm } from "@/components/ui/confirm-dialog"
import type { ShareLink } from "@/lib/types"

interface ShareLinkWithStatus extends ShareLink {
  status: "active" | "expired"
  accessToken: string
}

export default function SharesPage() {
  const [shareLinks, setShareLinks] = useState<ShareLinkWithStatus[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const fetchShareLinks = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (search) params.set("q", search)
      if (statusFilter !== "all") params.set("status", statusFilter)

      const res = await fetch(`/api/share?${params.toString()}`)
      const data = await res.json()

      if (res.ok) {
        setShareLinks(data)
      } else {
        showToast({ title: "获取分享列表失败", description: data.error, variant: "destructive" })
      }
    } catch (error) {
      showToast({ title: "获取分享列表失败", description: "网络错误", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }, [search, statusFilter])

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchShareLinks()
    }, 300)
    return () => clearTimeout(timer)
  }, [fetchShareLinks])

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(shareLinks.map(link => link.shareId)))
    } else {
      setSelectedIds(new Set())
    }
  }

  const handleSelectOne = (shareId: string, checked: boolean) => {
    const newSelected = new Set(selectedIds)
    if (checked) {
      newSelected.add(shareId)
    } else {
      newSelected.delete(shareId)
    }
    setSelectedIds(newSelected)
  }

  const handleDelete = async (shareId: string) => {
    const confirmed = await showConfirm({
      title: "确认删除",
      description: "确定要删除这条分享链接吗？此操作无法撤销。",
      confirmText: "删除",
      variant: "destructive",
    })

    if (!confirmed) return

    try {
      const res = await fetch(`/api/share?shareId=${shareId}`, { method: "DELETE" })
      if (res.ok) {
        showToast({ title: "删除成功", variant: "success" })
        fetchShareLinks()
        setSelectedIds(prev => {
          const next = new Set(prev)
          next.delete(shareId)
          return next
        })
      } else {
        const data = await res.json()
        showToast({ title: "删除失败", description: data.error, variant: "destructive" })
      }
    } catch {
      showToast({ title: "删除失败", description: "网络错误", variant: "destructive" })
    }
  }

  const handleBatchDelete = async () => {
    if (selectedIds.size === 0) return

    const confirmed = await showConfirm({
      title: "确认批量删除",
      description: `确定要删除选中的 ${selectedIds.size} 条分享链接吗？此操作无法撤销。`,
      confirmText: "删除",
      variant: "destructive",
    })

    if (!confirmed) return

    try {
      const res = await fetch("/api/share/batch-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shareIds: Array.from(selectedIds) }),
      })

      if (res.ok) {
        showToast({ title: `成功删除 ${selectedIds.size} 条分享链接`, variant: "success" })
        fetchShareLinks()
        setSelectedIds(new Set())
      } else {
        const data = await res.json()
        showToast({ title: "批量删除失败", description: data.error, variant: "destructive" })
      }
    } catch {
      showToast({ title: "批量删除失败", description: "网络错误", variant: "destructive" })
    }
  }

  const handleCopyLink = (link: ShareLinkWithStatus) => {
    const baseUrl = typeof window !== "undefined" ? window.location.origin : ""
    const shareUrl = `${baseUrl}/api/share/${link.shareId}?token=${link.accessToken}`
    navigator.clipboard.writeText(shareUrl)
    showToast({ title: "已复制到剪贴板", variant: "success" })
  }

  const formatDate = (date: string | null | undefined) => {
    if (!date) return "永久有效"
    return new Date(date).toLocaleString("zh-CN")
  }

  return (
    <div>
      <PageHeader title="分享管理" description="管理已分享的配置文件链接">
        {selectedIds.size > 0 && (
          <Button variant="destructive" onClick={handleBatchDelete}>
            <Trash2 className="h-4 w-4 mr-2" />
            删除选中 ({selectedIds.size})
          </Button>
        )}
      </PageHeader>

      {/* Filters */}
      <Card className="mb-4">
        <CardContent className="p-4">
          <div className="flex gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="搜索配置名称或描述..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="状态" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部</SelectItem>
                <SelectItem value="active">有效</SelectItem>
                <SelectItem value="expired">已过期</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Share List */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : shareLinks.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            {search || statusFilter !== "all"
              ? "没有找到匹配的分享链接"
              : "暂无分享链接"}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="p-4 text-left">
                      <Checkbox
                        checked={selectedIds.size === shareLinks.length && shareLinks.length > 0}
                        onChange={(e) => handleSelectAll(e.target.checked)}
                      />
                    </th>
                    <th className="p-4 text-left font-medium">配置名称</th>
                    <th className="p-4 text-left font-medium">类型</th>
                    <th className="p-4 text-left font-medium">有效期</th>
                    <th className="p-4 text-left font-medium">浏览</th>
                    <th className="p-4 text-left font-medium">状态</th>
                    <th className="p-4 text-left font-medium">创建时间</th>
                    <th className="p-4 text-right font-medium">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {shareLinks.map((link) => (
                    <tr key={link.shareId} className="border-b hover:bg-muted/25">
                      <td className="p-4">
                        <Checkbox
                          checked={selectedIds.has(link.shareId)}
                          onChange={(e) => handleSelectOne(link.shareId, e.target.checked)}
                        />
                      </td>
                      <td className="p-4 font-medium">{link.configName || "-"}</td>
                      <td className="p-4">
                        <Badge variant={link.isDynamic ? "default" : "outline"}>
                          {link.isDynamic ? "动态" : "静态"}
                        </Badge>
                      </td>
                      <td className="p-4 text-sm">{formatDate(link.expiresAt)}</td>
                      <td className="p-4 text-sm">{link.views}</td>
                      <td className="p-4">
                        <Badge variant={link.status === "active" ? "default" : "secondary"}>
                          {link.status === "active" ? "有效" : "已过期"}
                        </Badge>
                      </td>
                      <td className="p-4 text-sm text-muted-foreground">
                        {new Date(link.createdAt).toLocaleString("zh-CN")}
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleCopyLink(link)}
                            title="复制链接"
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(link.shareId)}
                            title="删除"
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
