"use client"

import { useState, useEffect, useCallback } from "react"
import { PageHeader } from "@/components/layout/PageHeader"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { showToast } from "@/components/ui/toast"
import { useConfirmDialog } from "@/components/ui/confirm-dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import {
  Plus,
  Rss,
  RefreshCw,
  Trash2,
  Loader2,
  ChevronDown,
  ChevronRight,
  Folder,
  FileText,
} from "lucide-react"
import type { Subscription } from "@/lib/types"
import { formatDate } from "@/lib/utils"

interface SubscriptionGroup {
  id: string
  name: string
  _count?: { nodes: number }
}

interface SubscriptionWithGroups extends Subscription {
  _count?: { nodes: number }
  groups?: SubscriptionGroup[]
}

export default function SubscriptionsPage() {
  const [subscriptions, setSubscriptions] = useState<SubscriptionWithGroups[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState<string | null>(null)
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [addTab, setAddTab] = useState("url")
  const [newSub, setNewSub] = useState({ name: "", url: "" })
  const [yamlContent, setYamlContent] = useState("")
  const [expandedSubs, setExpandedSubs] = useState<Set<string>>(new Set())
  const { confirm } = useConfirmDialog()

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/subscriptions")
      const data = await res.json()
      setSubscriptions(data)
    } catch (error) {
      console.error("获取订阅失败:", error)
      showToast({ title: "获取订阅失败", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const toggleExpand = (subId: string) => {
    setExpandedSubs((prev) => {
      const next = new Set(prev)
      if (next.has(subId)) {
        next.delete(subId)
      } else {
        next.add(subId)
      }
      return next
    })
  }

  const handleAdd = async () => {
    if (!newSub.name.trim()) {
      showToast({ title: "请填写订阅名称", variant: "destructive" })
      return
    }

    if (addTab === "url" && !newSub.url.trim()) {
      showToast({ title: "请填写订阅链接", variant: "destructive" })
      return
    }

    if (addTab === "yaml" && !yamlContent.trim()) {
      showToast({ title: "请粘贴 YAML 内容", variant: "destructive" })
      return
    }

    try {
      const payload: { name: string; url?: string; yamlContent?: string } = { name: newSub.name }
      if (addTab === "url") {
        payload.url = newSub.url
      } else {
        payload.yamlContent = yamlContent
      }

      const res = await fetch("/api/subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        showToast({ title: "添加订阅失败", variant: "destructive" })
        return
      }
      const sub = await res.json()
      setSubscriptions((prev) => [sub, ...prev])
      setNewSub({ name: "", url: "" })
      setYamlContent("")
      setIsAddOpen(false)
      const desc = sub.nodeCount ? `导入 ${sub.nodeCount} 个节点` : sub.name
      showToast({ title: "添加成功", description: desc, variant: "success" })
    } catch (error) {
      console.error("添加订阅失败:", error)
      showToast({ title: "添加订阅失败", variant: "destructive" })
    }
  }

  const handleAddOpenChange = (open: boolean) => {
    setIsAddOpen(open)
    if (!open) {
      setAddTab("url")
      setNewSub({ name: "", url: "" })
      setYamlContent("")
    }
  }

  const handleSync = async (id: string) => {
    setSyncing(id)
    try {
      const res = await fetch("/api/subscriptions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action: "sync" }),
      })
      const result = await res.json()

      if (result.success) {
        showToast({ title: "同步成功", description: `获取到 ${result.count} 个节点，已分配到「${result.groupName}」分组`, variant: "success" })
        fetchData()
      } else {
        showToast({ title: "同步失败", description: result.error, variant: "destructive" })
      }
    } catch (error) {
      console.error("同步失败:", error)
      showToast({ title: "同步失败", description: "请检查订阅链接是否有效", variant: "destructive" })
    } finally {
      setSyncing(null)
    }
  }

  const handleDelete = async (id: string, name: string) => {
    const confirmed = await confirm({
      title: "删除订阅",
      description: `确定要删除订阅「${name}」吗？关联的节点和分组也会被删除。`,
      variant: "destructive",
    })
    if (!confirmed) return

    try {
      await fetch(`/api/subscriptions?id=${id}`, { method: "DELETE" })
      setSubscriptions((prev) => prev.filter((s) => s.id !== id))
      showToast({ title: "已删除", variant: "success" })
    } catch (error) {
      console.error("删除订阅失败:", error)
      showToast({ title: "删除失败", variant: "destructive" })
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
        title="订阅管理"
        description="管理 Clash 订阅链接，同步获取节点"
      >
        <Button onClick={() => setIsAddOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          添加订阅
        </Button>
      </PageHeader>

      {subscriptions.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center h-64 text-muted-foreground">
            <Rss className="h-12 w-12 mb-4 opacity-50" />
            <p>暂无订阅</p>
            <p className="text-sm">点击上方按钮添加订阅链接</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {subscriptions.map((sub) => (
            <Card key={sub.id} className="hover:border-primary/50 transition-colors">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <Rss className="h-5 w-5 text-primary" />
                    <CardTitle className="text-lg">{sub.name}</CardTitle>
                    <Badge variant={sub.enabled ? "default" : "secondary"} className="ml-2">
                      {sub.enabled ? "启用" : "禁用"}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">
                      {sub._count?.nodes || 0} 节点
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => toggleExpand(sub.id)}
                      className="h-8 w-8"
                    >
                      {expandedSubs.has(sub.id) ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-sm text-muted-foreground truncate">
                  {sub.url}
                </div>

                {sub.lastSyncAt && (
                  <div className="text-xs text-muted-foreground">
                    上次同步: {formatDate(sub.lastSyncAt)}
                  </div>
                )}

                {/* 展开显示分组信息 */}
                {expandedSubs.has(sub.id) && sub.groups && sub.groups.length > 0 && (
                  <div className="space-y-2 pt-2">
                    <Separator />
                    <div className="text-sm font-medium">分组列表</div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {sub.groups.map((group) => (
                        <div
                          key={group.id}
                          className="flex items-center gap-2 px-3 py-2 rounded-md bg-muted/50"
                        >
                          <Folder className="h-4 w-4 text-primary" />
                          <span className="text-sm flex-1">{group.name}</span>
                          <Badge variant="outline" className="text-xs">
                            {group._count?.nodes || 0}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex gap-2 pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => handleSync(sub.id)}
                    disabled={syncing === sub.id}
                  >
                    {syncing === sub.id ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4 mr-2" />
                    )}
                    同步
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => handleDelete(sub.id, sub.name)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* 添加订阅对话框 */}
      <Dialog open={isAddOpen} onOpenChange={handleAddOpenChange}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>添加订阅</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">订阅名称</label>
              <Input
                placeholder="例如: 我的订阅"
                value={newSub.name}
                onChange={(e) => setNewSub((prev) => ({ ...prev, name: e.target.value }))}
              />
            </div>

            <Tabs value={addTab} onValueChange={setAddTab}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="url" className="flex items-center gap-2">
                  <Rss className="h-4 w-4" />
                  远程订阅
                </TabsTrigger>
                <TabsTrigger value="yaml" className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  YAML 导入
                </TabsTrigger>
              </TabsList>

              <TabsContent value="url" className="space-y-4 mt-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">订阅链接</label>
                  <Input
                    placeholder="https://..."
                    value={newSub.url}
                    onChange={(e) => setNewSub((prev) => ({ ...prev, url: e.target.value }))}
                  />
                </div>
              </TabsContent>

              <TabsContent value="yaml" className="space-y-4 mt-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">YAML 内容</label>
                  <Textarea
                    placeholder="mixed-port: 7890&#10;proxies:&#10;  - name: 节点1&#10;    type: trojan&#10;    ..."
                    value={yamlContent}
                    onChange={(e) => setYamlContent(e.target.value)}
                    className="font-mono text-xs min-h-[200px]"
                  />
                  <p className="text-xs text-muted-foreground">
                    直接粘贴 Clash 配置文件或节点 URL 列表
                  </p>
                </div>
              </TabsContent>
            </Tabs>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddOpen(false)}>
              取消
            </Button>
            <Button onClick={handleAdd}>
              {addTab === "yaml" ? "导入" : "添加"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </>
  )
}
