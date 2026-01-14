"use client"

import { useState, useEffect, useCallback } from "react"
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  useDroppable,
  useDraggable,
} from "@dnd-kit/core"
import { CSS } from "@dnd-kit/utilities"
import { PageHeader } from "@/components/layout/PageHeader"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
import {
  Plus,
  Download,
  Save,
  Trash2,
  FileCode2,
  Server,
  GripVertical,
  Folder,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { ProxyNode, Template, Config } from "@/lib/types"

// 小型可拖拽节点卡片
function DraggableNode({ node }: { node: ProxyNode }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `node-${node.id}`,
    data: { node },
  })

  const style = {
    transform: CSS.Translate.toString(transform),
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(
        "flex items-center gap-2 px-3 py-2 rounded-md border bg-card cursor-grab active:cursor-grabbing transition-all",
        isDragging ? "opacity-50 shadow-lg" : "hover:bg-accent"
      )}
    >
      <GripVertical className="h-3 w-3 text-muted-foreground" />
      <Server className="h-3 w-3 text-muted-foreground" />
      <span className="text-sm truncate flex-1">{node.name}</span>
      <Badge variant="secondary" className="text-xs px-1.5">
        {node.type}
      </Badge>
    </div>
  )
}

// 可放置的分组区域
function DroppableGroup({
  groupName,
  nodes,
  onRemoveNode,
}: {
  groupName: string
  nodes: ProxyNode[]
  onRemoveNode: (nodeId: string) => void
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `config-group-${groupName}`,
    data: { groupName },
  })

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "rounded-lg border p-4 transition-all min-h-[120px]",
        isOver && "ring-2 ring-primary border-primary bg-primary/5"
      )}
    >
      <div className="flex items-center gap-2 mb-3">
        <Folder className="h-4 w-4 text-primary" />
        <h4 className="font-medium">{groupName}</h4>
        <Badge variant="outline" className="ml-auto">
          {nodes.length}
        </Badge>
      </div>
      <div className="space-y-2">
        {nodes.length === 0 ? (
          <div className="text-sm text-muted-foreground text-center py-4 border-2 border-dashed rounded-lg">
            拖拽节点到此处
          </div>
        ) : (
          nodes.map((node) => (
            <div
              key={node.id}
              className="flex items-center gap-2 px-3 py-2 rounded-md bg-muted/50"
            >
              <Server className="h-3 w-3 text-muted-foreground" />
              <span className="text-sm truncate flex-1">{node.name}</span>
              <button
                onClick={() => onRemoveNode(node.id)}
                className="text-muted-foreground hover:text-destructive cursor-pointer"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

export default function ConfigsPage() {
  const [nodes, setNodes] = useState<ProxyNode[]>([])
  const [templates, setTemplates] = useState<Template[]>([])
  const [configs, setConfigs] = useState<Config[]>([])
  const [loading, setLoading] = useState(true)

  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null)
  const [nodeMapping, setNodeMapping] = useState<Record<string, ProxyNode[]>>({})
  const [configName, setConfigName] = useState("")
  const [previewContent, setPreviewContent] = useState("")
  const [activeNode, setActiveNode] = useState<ProxyNode | null>(null)

  const [isSaveOpen, setIsSaveOpen] = useState(false)

  const fetchData = useCallback(async () => {
    try {
      const [nodesRes, templatesRes, configsRes] = await Promise.all([
        fetch("/api/nodes"),
        fetch("/api/templates"),
        fetch("/api/configs"),
      ])
      const [nodesData, templatesData, configsData] = await Promise.all([
        nodesRes.json(),
        templatesRes.json(),
        configsRes.json(),
      ])
      setNodes(nodesData)
      setTemplates(templatesData)
      setConfigs(configsData)

      // 选择默认模板
      const defaultTemplate = templatesData.find((t: Template) => t.isDefault) || templatesData[0]
      if (defaultTemplate) {
        selectTemplate(defaultTemplate)
      }
    } catch (error) {
      console.error("获取数据失败:", error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const selectTemplate = (template: Template) => {
    setSelectedTemplate(template)
    // 解析模板中的分组
    const groupNames = extractGroupNames(template.content)
    const mapping: Record<string, ProxyNode[]> = {}
    groupNames.forEach((name) => {
      mapping[name] = []
    })
    setNodeMapping(mapping)
    setPreviewContent(template.content)
  }

  const extractGroupNames = (content: string): string[] => {
    const groups: string[] = []
    const lines = content.split("\n")
    let inGroups = false

    for (const line of lines) {
      if (line.trim() === "proxy-groups:") {
        inGroups = true
        continue
      }
      if (inGroups) {
        if (line.match(/^[a-z]/)) {
          break // 遇到新的顶级 key
        }
        const match = line.match(/^\s+-\s+name:\s+['"]?([^'"]+)['"]?/)
        if (match) {
          groups.push(match[1])
        }
      }
    }
    return groups
  }

  const handleDragStart = (event: DragStartEvent) => {
    const data = event.active.data.current as { node?: ProxyNode }
    if (data?.node) {
      setActiveNode(data.node)
    }
  }

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveNode(null)
    const { active, over } = event

    if (!over) return

    const data = active.data.current as { node?: ProxyNode }
    const overData = over.data.current as { groupName?: string }

    if (data?.node && overData?.groupName) {
      const node = data.node
      const groupName = overData.groupName

      // 检查是否已存在
      if (nodeMapping[groupName]?.some((n) => n.id === node.id)) {
        return
      }

      setNodeMapping((prev) => ({
        ...prev,
        [groupName]: [...(prev[groupName] || []), node],
      }))
    }
  }

  const handleRemoveNode = (groupName: string, nodeId: string) => {
    setNodeMapping((prev) => ({
      ...prev,
      [groupName]: prev[groupName]?.filter((n) => n.id !== nodeId) || [],
    }))
  }

  const handleSaveConfig = async () => {
    if (!configName.trim() || !selectedTemplate) return

    const nodeMappingIds: Record<string, string[]> = {}
    for (const [groupName, groupNodes] of Object.entries(nodeMapping)) {
      nodeMappingIds[groupName] = groupNodes.map((n) => n.id)
    }

    try {
      const res = await fetch("/api/configs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: configName,
          templateId: selectedTemplate.id,
          nodeMapping: nodeMappingIds,
        }),
      })
      const config = await res.json()

      if (res.ok) {
        setConfigs((prev) => [config, ...prev])
        setPreviewContent(config.content)
        setIsSaveOpen(false)
        setConfigName("")
        alert("配置保存成功！")
      } else {
        alert(config.error || "保存失败")
      }
    } catch (error) {
      console.error("保存配置失败:", error)
    }
  }

  const handleExport = (content: string, name: string) => {
    const blob = new Blob([content], { type: "text/yaml" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${name}.yaml`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleDeleteConfig = async (id: string) => {
    if (!confirm("确定要删除这个配置吗？")) return

    try {
      await fetch(`/api/configs?id=${id}`, { method: "DELETE" })
      setConfigs((prev) => prev.filter((c) => c.id !== id))
    } catch (error) {
      console.error("删除配置失败:", error)
    }
  }

  // 获取未被使用的节点（节点池）
  const usedNodeIds = new Set(
    Object.values(nodeMapping)
      .flat()
      .map((n) => n.id)
  )
  const availableNodes = nodes.filter((n) => !usedNodeIds.has(n.id))

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <PageHeader title="配置生成" description="选择模板，拖拽节点生成配置文件">
        <Button onClick={() => setIsSaveOpen(true)} disabled={!selectedTemplate}>
          <Save className="h-4 w-4 mr-2" />
          保存配置
        </Button>
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-[300px_1fr_300px]">
        {/* 左侧：节点池 */}
        <Card className="h-fit max-h-[calc(100vh-200px)]">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">节点池</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[400px] pr-4">
              <div className="space-y-2">
                {availableNodes.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    暂无可用节点
                  </p>
                ) : (
                  availableNodes.map((node) => (
                    <DraggableNode key={node.id} node={node} />
                  ))
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* 中间：分组配置 */}
        <div className="space-y-4">
          {/* 模板选择 */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">选择模板</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {templates.map((template) => (
                  <Button
                    key={template.id}
                    variant={selectedTemplate?.id === template.id ? "default" : "outline"}
                    size="sm"
                    onClick={() => selectTemplate(template)}
                  >
                    {template.name}
                    {template.isDefault && <Badge className="ml-2 text-xs">默认</Badge>}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* 分组区域 */}
          {selectedTemplate && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">分组配置</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2">
                  {Object.keys(nodeMapping).map((groupName) => (
                    <DroppableGroup
                      key={groupName}
                      groupName={groupName}
                      nodes={nodeMapping[groupName] || []}
                      onRemoveNode={(nodeId) => handleRemoveNode(groupName, nodeId)}
                    />
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* 右侧：已保存配置列表 */}
        <Card className="h-fit">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">已保存配置</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[400px] pr-4">
              <div className="space-y-3">
                {configs.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    暂无已保存配置
                  </p>
                ) : (
                  configs.map((config) => (
                    <div
                      key={config.id}
                      className="flex items-center gap-2 p-3 rounded-lg border hover:bg-accent transition-colors"
                    >
                      <FileCode2 className="h-4 w-4 text-primary" />
                      <span className="text-sm flex-1 truncate">{config.name}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => handleExport(config.content, config.name)}
                      >
                        <Download className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        onClick={() => handleDeleteConfig(config.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* 拖拽预览 */}
      <DragOverlay>
        {activeNode && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-md border bg-card shadow-lg">
            <Server className="h-3 w-3 text-primary" />
            <span className="text-sm">{activeNode.name}</span>
          </div>
        )}
      </DragOverlay>

      {/* 保存配置对话框 */}
      <Dialog open={isSaveOpen} onOpenChange={setIsSaveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>保存配置</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">配置名称</label>
              <Input
                placeholder="例如: 我的配置"
                value={configName}
                onChange={(e) => setConfigName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSaveConfig()}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSaveOpen(false)}>
              取消
            </Button>
            <Button onClick={handleSaveConfig}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DndContext>
  )
}
