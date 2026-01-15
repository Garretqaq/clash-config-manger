"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent } from "@dnd-kit/core"
import { PageHeader } from "@/components/layout/PageHeader"
import { Button } from "@/components/ui/button"
import { NodePool } from "@/components/nodes/NodePool"
import { GroupCard } from "@/components/groups/GroupCard"
import { NodeCard } from "@/components/nodes/NodeCard"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useConfirmDialog } from "@/components/ui/confirm-dialog"
import { showToast } from "@/components/ui/toast"
import { FolderPlus, Plus, ChevronDown, ChevronRight, Eye, Code, Wifi, Loader2, CheckSquare, Square } from "lucide-react"
import type { ProxyNode, Group, ProxyType } from "@/lib/types"

const NODE_TYPES: { value: ProxyType; label: string }[] = [
  { value: "ss", label: "Shadowsocks" },
  { value: "ssr", label: "ShadowsocksR" },
  { value: "vmess", label: "VMess" },
  { value: "vless", label: "VLESS" },
  { value: "trojan", label: "Trojan" },
  { value: "socks5", label: "SOCKS5" },
  { value: "http", label: "HTTP" },
  { value: "hysteria", label: "Hysteria" },
  { value: "hysteria2", label: "Hysteria2" },
]

// 各类型节点的额外配置字段
const NODE_TYPE_PARAMS: Record<ProxyType, { key: string; label: string; placeholder?: string; type?: string }[]> = {
  ss: [
    { key: "cipher", label: "加密方式", placeholder: "aes-256-gcm" },
    { key: "password", label: "密码", placeholder: "密码" },
  ],
  ssr: [
    { key: "cipher", label: "加密方式", placeholder: "aes-256-cfb" },
    { key: "password", label: "密码", placeholder: "密码" },
    { key: "protocol", label: "协议", placeholder: "origin" },
    { key: "obfs", label: "混淆", placeholder: "plain" },
  ],
  vmess: [
    { key: "uuid", label: "UUID", placeholder: "7d1511d1-397f-4ffa-99a2-022a7cf20b83" },
    { key: "alterId", label: "Alter ID", placeholder: "0" },
    { key: "cipher", label: "加密方式", placeholder: "auto" },
    { key: "network", label: "传输方式", placeholder: "ws" },
    { key: "servername", label: "SNI/Host", placeholder: "www.bing.com" },
    { key: "ws-path", label: "WebSocket 路径", placeholder: "/" },
    { key: "tls", label: "TLS", placeholder: "true/false" },
    { key: "udp", label: "UDP", placeholder: "true/false" },
  ],
  vless: [
    { key: "uuid", label: "UUID", placeholder: "7d1511d1-397f-4ffa-99a2-022a7cf20b83" },
    { key: "network", label: "传输方式", placeholder: "ws" },
    { key: "servername", label: "SNI/Host", placeholder: "www.bing.com" },
    { key: "ws-path", label: "WebSocket 路径", placeholder: "/" },
    { key: "tls", label: "TLS", placeholder: "true/false" },
    { key: "flow", label: "Flow", placeholder: "xtls-rprx-vision" },
  ],
  trojan: [
    { key: "password", label: "密码", placeholder: "密码" },
    { key: "sni", label: "SNI", placeholder: "www.bing.com" },
    { key: "network", label: "传输方式", placeholder: "ws" },
    { key: "ws-path", label: "WebSocket 路径", placeholder: "/" },
    { key: "tls", label: "TLS", placeholder: "true/false" },
  ],
  socks5: [
    { key: "username", label: "用户名", placeholder: "用户名（可选）" },
    { key: "password", label: "密码", placeholder: "密码（可选）" },
    { key: "udp", label: "UDP", placeholder: "true/false" },
  ],
  http: [
    { key: "username", label: "用户名", placeholder: "用户名（可选）" },
    { key: "password", label: "密码", placeholder: "密码（可选）" },
  ],
  hysteria: [
    { key: "auth", label: "认证字符串", placeholder: "认证字符串" },
    { key: "upmbps", label: "上传带宽 (Mbps)", placeholder: "100" },
    { key: "downmbps", label: "下载带宽 (Mbps)", placeholder: "100" },
    { key: "sni", label: "SNI", placeholder: "www.bing.com" },
    { key: "alpn", label: "ALPN", placeholder: "h3" },
  ],
  hysteria2: [
    { key: "password", label: "密码", placeholder: "密码" },
    { key: "upmbps", label: "上传带宽 (Mbps)", placeholder: "100" },
    { key: "downmbps", label: "下载带宽 (Mbps)", placeholder: "100" },
    { key: "sni", label: "SNI", placeholder: "www.bing.com" },
  ],
}

interface NewNodeForm {
  name: string
  type: ProxyType
  server: string
  port: string
  groupId: string
  params: Record<string, string>
}

export default function NodesPage() {
  const [nodes, setNodes] = useState<ProxyNode[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [activeNode, setActiveNode] = useState<ProxyNode | null>(null)
  const [isAddGroupOpen, setIsAddGroupOpen] = useState(false)
  const [isAddNodeOpen, setIsAddNodeOpen] = useState(false)
  const [isEditNodeOpen, setIsEditNodeOpen] = useState(false)
  const [editingNode, setEditingNode] = useState<ProxyNode | null>(null)
  const [editNode, setEditNode] = useState<NewNodeForm>({
    name: "",
    type: "vmess",
    server: "",
    port: "",
    groupId: "",
    params: {},
  })
  const [showEditAdvanced, setShowEditAdvanced] = useState(false)
  const [showEditPreview, setShowEditPreview] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [newGroupName, setNewGroupName] = useState("")
  const [newNode, setNewNode] = useState<NewNodeForm>({
    name: "",
    type: "vmess",
    server: "",
    port: "",
    groupId: "",
    params: {},
  })
  const [loading, setLoading] = useState(true)
  const [connections, setConnections] = useState<Record<string, { connected: boolean; port: number }>>({})
  const [testingNodes, setTestingNodes] = useState<Set<string>>(new Set())
  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedNodes, setSelectedNodes] = useState<Set<string>>(new Set())
  const { confirm } = useConfirmDialog()

  const fetchData = useCallback(async () => {
    try {
      const [nodesRes, groupsRes] = await Promise.all([
        fetch("/api/nodes"),
        fetch("/api/groups"),
      ])
      const nodesData = await nodesRes.json()
      const groupsData = await groupsRes.json()
      setNodes(nodesData)
      setGroups(groupsData)
    } catch (error) {
      console.error("获取数据失败:", error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // 生成 YAML 预览
  const yamlPreview = useMemo(() => {
    const { name, type, server, port, params } = newNode
    const configLines = [
      `- name: ${name || "未命名节点"}`,
      `  type: ${type}`,
      `  server: ${server || "xxx.xxx.xxx.xxx"}`,
      `  port: ${port || "0"}`,
    ]

    Object.entries(params).forEach(([key, value]) => {
      const strValue = String(value || "")
      if (strValue.trim()) {
        // 布尔值保持原样，字符串加引号
        const formattedValue = strValue.toLowerCase() === "true" || strValue.toLowerCase() === "false" ? strValue : `"${strValue}"`
        configLines.push(`  ${key}: ${formattedValue}`)
      }
    })

    return configLines.join("\n")
  }, [newNode])

  // 编辑节点的 YAML 预览
  const editYamlPreview = useMemo(() => {
    const { name, type, server, port, params } = editNode
    const configLines = [
      `- name: ${name || "未命名节点"}`,
      `  type: ${type}`,
      `  server: ${server || "xxx.xxx.xxx.xxx"}`,
      `  port: ${port || "0"}`,
    ]

    Object.entries(params).forEach(([key, value]) => {
      const strValue = String(value || "")
      if (strValue.trim()) {
        const formattedValue = strValue.toLowerCase() === "true" || strValue.toLowerCase() === "false" ? strValue : `"${strValue}"`
        configLines.push(`  ${key}: ${formattedValue}`)
      }
    })

    return configLines.join("\n")
  }, [editNode])

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event
    const node = nodes.find((n) => n.id === active.id)
    if (node) {
      setActiveNode(node)
    }
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    setActiveNode(null)

    if (!over) return

    const nodeId = active.id as string
    let newGroupId: string | null = null

    if (over.id === "node-pool") {
      newGroupId = null
    } else if (typeof over.id === "string" && over.id.startsWith("group-")) {
      newGroupId = over.id.replace("group-", "")
    } else {
      return
    }

    setNodes((prev) =>
      prev.map((n) =>
        n.id === nodeId ? { ...n, groupId: newGroupId } : n
      )
    )

    try {
      await fetch("/api/nodes", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nodeIds: [nodeId], groupId: newGroupId }),
      })
    } catch (error) {
      console.error("更新节点分组失败:", error)
      fetchData()
    }
  }

  const handleAddGroup = async () => {
    if (!newGroupName.trim()) return

    try {
      const res = await fetch("/api/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newGroupName, type: "select" }),
      })
      const group = await res.json()
      setGroups((prev) => [...prev, group])
      setNewGroupName("")
      setIsAddGroupOpen(false)
      showToast({ title: "创建成功", description: `分组 "${group.name}" 已创建`, variant: "success" })
    } catch (error) {
      console.error("创建分组失败:", error)
      showToast({ title: "创建失败", variant: "destructive" })
    }
  }

  const handleAddNode = async () => {
    if (!newNode.name.trim() || !newNode.server.trim() || !newNode.port.trim()) {
      showToast({ title: "请填写完整信息", variant: "destructive" })
      return
    }

    const port = parseInt(newNode.port, 10)
    if (isNaN(port) || port <= 0 || port > 65535) {
      showToast({ title: "端口号无效", description: "请输入 1-65535 之间的端口号", variant: "destructive" })
      return
    }

    // 构建配置对象
    const config: Record<string, unknown> = {}
    Object.entries(newNode.params).forEach(([key, value]) => {
      const strValue = String(value || "")
      if (strValue.trim()) {
        // 处理布尔值
        if (strValue.toLowerCase() === "true") config[key] = true
        else if (strValue.toLowerCase() === "false") config[key] = false
        else config[key] = strValue
      }
    })

    try {
      const res = await fetch("/api/nodes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newNode.name,
          type: newNode.type,
          server: newNode.server,
          port,
          groupId: newNode.groupId || null,
          config,
        }),
      })

      if (!res.ok) throw new Error("创建失败")

      const node = await res.json()
      setNodes((prev) => [node, ...prev])
      setNewNode({ name: "", type: "vmess", server: "", port: "", groupId: "", params: {} })
      setShowAdvanced(false)
      setIsAddNodeOpen(false)
      showToast({ title: "创建成功", description: `节点 "${node.name}" 已添加`, variant: "success" })
    } catch (error) {
      console.error("创建节点失败:", error)
      showToast({ title: "创建失败", variant: "destructive" })
    }
  }

  const handleOpenEditNode = (node: ProxyNode) => {
    setEditingNode(node)
    setEditNode({
      name: node.name,
      type: node.type as ProxyType,
      server: node.server,
      port: String(node.port),
      groupId: node.groupId || "",
      params: node.config as Record<string, string> || {},
    })
    setShowEditAdvanced(false)
    setShowEditPreview(false)
    setIsEditNodeOpen(true)
  }

  const handleEditNode = async () => {
    if (!editingNode || !editNode.name.trim() || !editNode.server.trim() || !editNode.port.trim()) {
      showToast({ title: "请填写完整信息", variant: "destructive" })
      return
    }

    const port = parseInt(editNode.port, 10)
    if (isNaN(port) || port <= 0 || port > 65535) {
      showToast({ title: "端口号无效", description: "请输入 1-65535 之间的端口号", variant: "destructive" })
      return
    }

    // 构建配置对象
    const config: Record<string, unknown> = {}
    Object.entries(editNode.params).forEach(([key, value]) => {
      const strValue = String(value || "")
      if (strValue.trim()) {
        if (strValue.toLowerCase() === "true") config[key] = true
        else if (strValue.toLowerCase() === "false") config[key] = false
        else config[key] = strValue
      }
    })

    try {
      const res = await fetch("/api/nodes", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingNode.id,
          name: editNode.name.trim(),
          type: editNode.type,
          server: editNode.server.trim(),
          port,
          groupId: editNode.groupId || null,
          config,
        }),
      })

      if (!res.ok) throw new Error("更新失败")

      // 更新本地状态，包含所有字段（特别是 groupId）
      setNodes((prev) =>
        prev.map((n) =>
          n.id === editingNode.id
            ? { 
                ...n, 
                name: editNode.name, 
                type: editNode.type, 
                server: editNode.server, 
                port, 
                config,
                groupId: editNode.groupId || null  // 修复：同步更新 groupId
              }
            : n
        )
      )
      setIsEditNodeOpen(false)
      setEditingNode(null)
      showToast({ title: "更新成功", description: `节点 "${editNode.name}" 已更新`, variant: "success" })
    } catch (error) {
      console.error("更新节点失败:", error)
      showToast({ title: "更新失败", variant: "destructive" })
    }
  }

  const handleDeleteGroup = async (id: string) => {
    const confirmed = await confirm({
      title: "删除分组",
      description: "确定要删除这个分组吗？分组内的节点将移到节点池。",
      variant: "destructive",
    })
    if (!confirmed) return

    try {
      await fetch(`/api/groups?id=${id}`, { method: "DELETE" })
      setGroups((prev) => prev.filter((g) => g.id !== id))
      setNodes((prev) =>
        prev.map((n) => (n.groupId === id ? { ...n, groupId: null } : n))
      )
      showToast({ title: "已删除", variant: "success" })
    } catch (error) {
      console.error("删除分组失败:", error)
      showToast({ title: "删除失败", variant: "destructive" })
    }
  }

  const handleDeleteNode = async (id: string) => {
    // 如果在选择模式下且选中了多个节点，执行批量删除
    if (selectionMode && selectedNodes.size > 1) {
      const idsToDelete = Array.from(selectedNodes)
      const confirmed = await confirm({
        title: "批量删除节点",
        description: `确定要删除选中的 ${idsToDelete.length} 个节点吗？`,
        variant: "destructive",
      })
      if (!confirmed) return

      try {
        await fetch("/api/nodes", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids: idsToDelete }),
        })
        setNodes((prev) => prev.filter((n) => !selectedNodes.has(n.id)))
        setSelectedNodes(new Set())
        showToast({ title: "已删除", description: `成功删除 ${idsToDelete.length} 个节点`, variant: "success" })
      } catch (error) {
        console.error("批量删除节点失败:", error)
        showToast({ title: "删除失败", variant: "destructive" })
      }
      return
    }

    // 单个删除
    const confirmed = await confirm({
      title: "删除节点",
      description: "确定要删除这个节点吗？",
      variant: "destructive",
    })
    if (!confirmed) return

    try {
      await fetch(`/api/nodes?ids=${id}`, { method: "DELETE" })
      setNodes((prev) => prev.filter((n) => n.id !== id))
      setSelectedNodes((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
      showToast({ title: "已删除", variant: "success" })
    } catch (error) {
      console.error("删除节点失败:", error)
      showToast({ title: "删除失败", variant: "destructive" })
    }
  }

  const handleSelectionChange = (selected: Set<string>, _lastSelected: string | null) => {
    setSelectedNodes(selected)
  }

  const toggleSelectionMode = () => {
    setSelectionMode(!selectionMode)
    setSelectedNodes(new Set())
  }

  const handleTestNodes = useCallback(async (nodeIds: string[]) => {
    setTestingNodes((prev) => new Set(Array.from(prev).concat(nodeIds)))

    try {
      const res = await fetch("/api/nodes/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nodeIds,
          options: { concurrency: 5, timeout: 3000 },
        }),
      })

      if (!res.ok) throw new Error("测试失败")

      const data = await res.json()

      // 更新连通性数据
      setConnections((prev) => {
        const updated = { ...prev }
        data.results.forEach((result: { nodeId: string; connected: boolean; port: number }) => {
          updated[result.nodeId] = {
            connected: result.connected,
            port: result.port,
          }
        })
        return updated
      })

      // 统计结果
      const successCount = data.results.filter((r: { connected: boolean }) => r.connected).length
      const totalCount = data.results.length
      showToast({
        title: "测试完成",
        description: `${successCount}/${totalCount} 个节点连通`,
        variant: successCount === totalCount ? "success" : "default",
      })
    } catch (error) {
      console.error("测试失败:", error)
      showToast({ title: "测试失败", variant: "destructive" })
    } finally {
      setTestingNodes((prev) => {
        const next = new Set(prev)
        nodeIds.forEach((id) => next.delete(id))
        return next
      })
    }
  }, [])

  const updateParam = (key: string, value: string) => {
    setNewNode((prev) => ({
      ...prev,
      params: { ...prev.params, [key]: value },
    }))
  }

  const updateEditParam = (key: string, value: string) => {
    setEditNode((prev) => ({
      ...prev,
      params: { ...prev.params, [key]: value },
    }))
  }

  const poolNodes = nodes.filter((n) => !n.groupId)
  const getGroupNodes = (groupId: string) =>
    nodes.filter((n) => n.groupId === groupId)

  const advancedParams = NODE_TYPE_PARAMS[newNode.type] || []
  const editAdvancedParams = NODE_TYPE_PARAMS[editNode.type] || []

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <PageHeader
        title="节点管理"
        description={selectionMode ? "选择节点进行批量操作" : "管理代理节点，拖拽节点到分组中"}
      >
        <div className="flex gap-2">
          {selectionMode ? (
            <Button variant="outline" onClick={toggleSelectionMode}>
              <Square className="h-4 w-4 mr-2" />
              取消选择
            </Button>
          ) : (
            <>
              <Button onClick={() => setIsAddNodeOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                添加节点
              </Button>
              <Button variant="outline" onClick={() => setIsAddGroupOpen(true)}>
                <FolderPlus className="h-4 w-4 mr-2" />
                新建分组
              </Button>
              {nodes.length > 0 && (
                <Button
                  variant="secondary"
                  onClick={() => handleTestNodes(nodes.map((n) => n.id))}
                  disabled={testingNodes.size > 0}
                >
                  {testingNodes.size > 0 ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Wifi className="h-4 w-4 mr-2" />
                  )}
                  测试连通
                </Button>
              )}
              {nodes.length > 0 && (
                <Button variant="outline" onClick={toggleSelectionMode}>
                  <CheckSquare className="h-4 w-4 mr-2" />
                  选择
                </Button>
              )}
            </>
          )}
        </div>
      </PageHeader>

      <div className="space-y-6">
        <NodePool
          nodes={poolNodes}
          onDeleteNode={handleDeleteNode}
          onEditNode={handleOpenEditNode}
          onTestNodes={handleTestNodes}
          connections={connections}
          testingNodes={testingNodes}
          selectionMode={selectionMode}
          selectedNodes={selectedNodes}
          onSelectionChange={handleSelectionChange}
        />

        <div className="grid gap-6 md:grid-cols-2">
          {groups.map((group) => (
            <GroupCard
              key={group.id}
              group={group}
              nodes={getGroupNodes(group.id)}
              onDeleteGroup={handleDeleteGroup}
              onDeleteNode={handleDeleteNode}
              onEditNode={handleOpenEditNode}
              onTestNodes={handleTestNodes}
              connections={connections}
              testingNodes={testingNodes}
              selectionMode={selectionMode}
              selectedNodes={selectedNodes}
              onSelectionChange={handleSelectionChange}
            />
          ))}
        </div>
      </div>

      <DragOverlay>
        {activeNode && <NodeCard node={activeNode} />}
      </DragOverlay>

      {/* 新建分组对话框 */}
      <Dialog open={isAddGroupOpen} onOpenChange={setIsAddGroupOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新建分组</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Input
              placeholder="分组名称"
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddGroup()}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddGroupOpen(false)}>
              取消
            </Button>
            <Button onClick={handleAddGroup}>创建</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 添加节点对话框 */}
      <Dialog open={isAddNodeOpen} onOpenChange={(open) => {
        setIsAddNodeOpen(open)
        if (!open) {
          setNewNode({ name: "", type: "vmess", server: "", port: "", groupId: "", params: {} })
          setShowAdvanced(false)
          setShowPreview(false)
        }
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>添加节点</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* 基本信息 */}
            <div className="space-y-3">
              <Label className="text-sm font-semibold text-muted-foreground">基本信息</Label>
              <div className="space-y-2">
                <Label htmlFor="node-name">节点名称</Label>
                <Input
                  id="node-name"
                  placeholder="例如: 日本东京节点"
                  value={newNode.name}
                  onChange={(e) => setNewNode((prev) => ({ ...prev, name: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="node-type">类型</Label>
                  <Select
                    value={newNode.type}
                    onValueChange={(value) => setNewNode((prev) => ({ ...prev, type: value as ProxyType, params: {} }))}
                  >
                    <SelectTrigger id="node-type">
                      <SelectValue placeholder="选择类型" />
                    </SelectTrigger>
                    <SelectContent>
                      {NODE_TYPES.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="node-port">端口</Label>
                  <Input
                    id="node-port"
                    placeholder="443"
                    value={newNode.port}
                    onChange={(e) => setNewNode((prev) => ({ ...prev, port: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="node-server">服务器</Label>
                  <Input
                    id="node-server"
                    placeholder="jp.example.com"
                    value={newNode.server}
                    onChange={(e) => setNewNode((prev) => ({ ...prev, server: e.target.value }))}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="node-group">分配到分组（可选）</Label>
                <Select
                  value={newNode.groupId}
                  onValueChange={(value) => setNewNode((prev) => ({ ...prev, groupId: value }))}
                >
                  <SelectTrigger id="node-group">
                    <SelectValue placeholder="节点池（不分配）" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">节点池（不分配）</SelectItem>
                    {groups.map((group) => (
                      <SelectItem key={group.id} value={group.id}>
                        {group.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* 高级配置 */}
            <div className="border-t pt-4">
              <Button
                variant="ghost"
                className="w-full justify-between h-auto py-2"
                onClick={() => setShowAdvanced(!showAdvanced)}
              >
                <span className="flex items-center gap-2">
                  <Code className="h-4 w-4" />
                  高级配置
                </span>
                {showAdvanced ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </Button>

              {showAdvanced && (
                <div className="mt-3 space-y-3 p-4 bg-muted/50 rounded-lg">
                  <Label className="text-xs text-muted-foreground">
                    根据节点类型显示对应配置项，留空则不生成该字段
                  </Label>
                  <div className="grid grid-cols-2 gap-3">
                    {advancedParams.map((param) => (
                      <div key={param.key} className="space-y-1">
                        <Label htmlFor={`param-${param.key}`} className="text-xs">
                          {param.label}
                        </Label>
                        <Input
                          id={`param-${param.key}`}
                          placeholder={param.placeholder || param.label}
                          value={newNode.params[param.key] || ""}
                          onChange={(e) => updateParam(param.key, e.target.value)}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* 预览 */}
            <div className="border-t pt-4">
              <Button
                variant="ghost"
                className="w-full justify-between h-auto py-2"
                onClick={() => setShowPreview(!showPreview)}
              >
                <span className="flex items-center gap-2">
                  <Eye className="h-4 w-4" />
                  YAML 预览
                </span>
                {showPreview ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </Button>

              {showPreview && (
                <div className="mt-3 p-4 bg-zinc-950 rounded-lg overflow-x-auto">
                  <pre className="text-xs text-zinc-300 font-mime whitespace-pre-wrap">
                    <code>{yamlPreview}</code>
                  </pre>
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddNodeOpen(false)}>
              取消
            </Button>
            <Button onClick={handleAddNode}>添加</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 编辑节点对话框 */}
      <Dialog open={isEditNodeOpen} onOpenChange={(open) => {
        setIsEditNodeOpen(open)
        if (!open) {
          setEditingNode(null)
        }
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>编辑节点</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* 基本信息 */}
            <div className="space-y-3">
              <Label className="text-sm font-semibold text-muted-foreground">基本信息</Label>
              <div className="space-y-2">
                <Label htmlFor="edit-node-name">节点名称</Label>
                <Input
                  id="edit-node-name"
                  placeholder="例如: 日本东京节点"
                  value={editNode.name}
                  onChange={(e) => setEditNode((prev) => ({ ...prev, name: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="edit-node-type">类型</Label>
                  <Select
                    value={editNode.type}
                    onValueChange={(value) => setEditNode((prev) => ({ ...prev, type: value as ProxyType, params: {} }))}
                  >
                    <SelectTrigger id="edit-node-type">
                      <SelectValue placeholder="选择类型" />
                    </SelectTrigger>
                    <SelectContent>
                      {NODE_TYPES.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-node-port">端口</Label>
                  <Input
                    id="edit-node-port"
                    placeholder="443"
                    value={editNode.port}
                    onChange={(e) => setEditNode((prev) => ({ ...prev, port: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-node-server">服务器</Label>
                  <Input
                    id="edit-node-server"
                    placeholder="jp.example.com"
                    value={editNode.server}
                    onChange={(e) => setEditNode((prev) => ({ ...prev, server: e.target.value }))}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-node-group">分配到分组（可选）</Label>
                <Select
                  value={editNode.groupId}
                  onValueChange={(value) => setEditNode((prev) => ({ ...prev, groupId: value }))}
                >
                  <SelectTrigger id="edit-node-group">
                    <SelectValue placeholder="节点池（不分配）" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">节点池（不分配）</SelectItem>
                    {groups.map((group) => (
                      <SelectItem key={group.id} value={group.id}>
                        {group.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* 高级配置 */}
            <div className="border-t pt-4">
              <Button
                variant="ghost"
                className="w-full justify-between h-auto py-2"
                onClick={() => setShowEditAdvanced(!showEditAdvanced)}
              >
                <span className="flex items-center gap-2">
                  <Code className="h-4 w-4" />
                  高级配置
                </span>
                {showEditAdvanced ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </Button>

              {showEditAdvanced && (
                <div className="mt-3 space-y-3 p-4 bg-muted/50 rounded-lg">
                  <Label className="text-xs text-muted-foreground">
                    根据节点类型显示对应配置项，留空则不生成该字段
                  </Label>
                  <div className="grid grid-cols-2 gap-3">
                    {editAdvancedParams.map((param) => (
                      <div key={param.key} className="space-y-1">
                        <Label htmlFor={`edit-param-${param.key}`} className="text-xs">
                          {param.label}
                        </Label>
                        <Input
                          id={`edit-param-${param.key}`}
                          placeholder={param.placeholder || param.label}
                          value={editNode.params[param.key] || ""}
                          onChange={(e) => updateEditParam(param.key, e.target.value)}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* 预览 */}
            <div className="border-t pt-4">
              <Button
                variant="ghost"
                className="w-full justify-between h-auto py-2"
                onClick={() => setShowEditPreview(!showEditPreview)}
              >
                <span className="flex items-center gap-2">
                  <Eye className="h-4 w-4" />
                  YAML 预览
                </span>
                {showEditPreview ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </Button>

              {showEditPreview && (
                <div className="mt-3 p-4 bg-zinc-950 rounded-lg overflow-x-auto">
                  <pre className="text-xs text-zinc-300 font-mono whitespace-pre-wrap">
                    <code>{editYamlPreview}</code>
                  </pre>
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditNodeOpen(false)}>
              取消
            </Button>
            <Button onClick={handleEditNode}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DndContext>
  )
}
