"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { useRouter } from "next/navigation"
import {
  DndContext,
  DragOverlay,
  DragStartEvent,
  DragEndEvent,
  useDroppable,
  useDraggable,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core"
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable"
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
  Save,
  Server,
  Folder,
  ChevronDown,
  ChevronRight,
  GripVertical,
  Trash2,
  Plus,
  Loader2,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { ClashGenerator } from "@/lib/clash-generator"
import { showToast } from "@/components/ui/toast"
import type { ProxyNode, Template, Group } from "@/lib/types"

// 可拖拽的节点卡片
function DraggablePoolNode({ node }: { node: ProxyNode }) {
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
        "flex items-center gap-2 px-3 py-1.5 rounded hover:bg-accent text-sm cursor-grab active:cursor-grabbing transition-all",
        isDragging && "opacity-50 shadow-lg bg-accent"
      )}
    >
      <GripVertical className="h-3 w-3 text-muted-foreground" />
      <Server className="h-3 w-3 text-muted-foreground" />
      <span className="truncate flex-1">{node.name}</span>
      <Badge variant="outline" className="text-[10px] px-1">
        {node.type}
      </Badge>
    </div>
  )
}

// 节点池分组（可折叠）
function NodePoolGroup({
  groupName,
  nodes,
  groupColor = "border-l-primary",
}: {
  groupName: string
  nodes: ProxyNode[]
  groupColor?: string
}) {
  const [isExpanded, setIsExpanded] = useState(true)

  if (nodes.length === 0) return null

  return (
    <div className={cn("border rounded-lg overflow-hidden", groupColor)}>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center gap-2 px-3 py-2 bg-muted/50 hover:bg-muted transition-colors text-left"
      >
        {isExpanded ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        )}
        <span className="font-medium text-sm flex-1">{groupName}</span>
        <Badge variant="secondary" className="text-xs">
          {nodes.length}
        </Badge>
      </button>
      {isExpanded && (
        <div className="p-2 space-y-1">
          {nodes.map((node) => (
            <DraggablePoolNode key={node.id} node={node} />
          ))}
        </div>
      )}
    </div>
  )
}

// 可放置的节点池（支持拖回节点）
function DroppableNodePool({
  poolGroupList,
}: {
  poolGroupList: { id: string; name: string; nodes: ProxyNode[] }[]
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: "config-node-pool",
    data: { isPool: true },
  })

  return (
    <Card 
      ref={setNodeRef}
      className={cn(
        "h-fit max-h-[calc(100vh-200px)] transition-all",
        isOver && "ring-2 ring-primary border-primary bg-primary/5"
      )}
    >
      <CardHeader className="pb-3">
        <CardTitle className="text-base">
          节点池
          {isOver && <span className="text-xs text-primary ml-2">(松开以放回)</span>}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[calc(100vh-280px)] pr-4">
          <div className="space-y-2">
            {poolGroupList.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                暂无可用节点
              </p>
            ) : (
              poolGroupList.map((group, index) => (
                <NodePoolGroup
                  key={group.id}
                  groupName={group.name}
                  nodes={group.nodes}
                  groupColor={
                    group.id === "ungrouped"
                      ? "border-l-muted"
                      : index === 1
                      ? "border-l-primary"
                      : index === 2
                      ? "border-l-blue-500"
                      : "border-l-purple-500"
                  }
                />
              ))
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}

// 可排序的分组节点（支持拖回节点池）
function SortableGroupNode({
  node,
  groupName,
  onRemove,
}: {
  node: ProxyNode
  groupName: string
  onRemove: (nodeId: string) => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: `sort-${groupName}-${node.id}`,
    data: { node, groupName, fromGroup: true }, // 标记来自分组，支持拖回节点池
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-2 px-3 py-2 rounded-md bg-muted/50 transition-colors",
        isDragging && "opacity-50 shadow-lg bg-primary/10"
      )}
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground"
      >
        <GripVertical className="h-3 w-3" />
      </button>
      <Server className="h-3 w-3 text-muted-foreground" />
      <span className="text-sm truncate flex-1">{node.name}</span>
      <button
        onClick={() => onRemove(node.id)}
        className="text-muted-foreground hover:text-destructive cursor-pointer"
      >
        <Trash2 className="h-3 w-3" />
      </button>
    </div>
  )
}

// 可放置的分组区域
function DroppableGroup({
  groupName,
  nodes,
  onRemoveNode,
  onRemoveGroup,
}: {
  groupName: string
  nodes: ProxyNode[]
  onRemoveNode: (nodeId: string) => void
  onRemoveGroup: () => void
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
        <button
          onClick={onRemoveGroup}
          className="text-muted-foreground hover:text-destructive cursor-pointer p-1 rounded hover:bg-destructive/10"
          title="删除分组"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </div>
      <SortableContext
        items={nodes.map((n) => `sort-${groupName}-${n.id}`)}
        strategy={verticalListSortingStrategy}
      >
        <div className="space-y-2">
          {nodes.length === 0 ? (
            <div className="text-sm text-muted-foreground text-center py-4 border-2 border-dashed rounded-lg">
              拖拽节点到此处
            </div>
          ) : (
            nodes.map((node) => (
              <SortableGroupNode
                key={node.id}
                node={node}
                groupName={groupName}
                onRemove={onRemoveNode}
              />
            ))
          )}
        </div>
      </SortableContext>
    </div>
  )
}

export default function ConfigsPage() {
  const router = useRouter()

  const [nodes, setNodes] = useState<ProxyNode[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)

  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null)
  const [nodeMapping, setNodeMapping] = useState<Record<string, ProxyNode[]>>({})
  const [configName, setConfigName] = useState("")
  const [previewContent, setPreviewContent] = useState("")
  const [activeNode, setActiveNode] = useState<ProxyNode | null>(null)

  const [isSaveOpen, setIsSaveOpen] = useState(false)
  const [isAddGroupOpen, setIsAddGroupOpen] = useState(false)
  const [newGroupName, setNewGroupName] = useState("")

  // 定义 selectTemplate 函数（需要放在 fetchData 之前）
  const selectTemplate = useCallback((template: Template) => {
    setSelectedTemplate(template)
    // 解析模板中的分组
    const groupNames = extractGroupNames(template.content)
    const mapping: Record<string, ProxyNode[]> = {}
    groupNames.forEach((name) => {
      mapping[name] = []
    })
    setNodeMapping(mapping)
  }, [])

  const fetchData = useCallback(async () => {
    try {
      const [nodesRes, templatesRes, groupsRes] = await Promise.all([
        fetch("/api/nodes"),
        fetch("/api/templates"),
        fetch("/api/groups"),
      ])
      const [nodesData, templatesData, groupsData] = await Promise.all([
        nodesRes.json(),
        templatesRes.json(),
        groupsRes.json(),
      ])
      setNodes(nodesData)
      setGroups(groupsData)
      setTemplates(templatesData)

      // 首次进入时自动选中默认模板或第一个模板
      if (templatesData && templatesData.length > 0) {
        const defaultTemplate = templatesData.find((t: Template) => t.isDefault)
        const templateToSelect = defaultTemplate || templatesData[0]
        selectTemplate(templateToSelect)
      }
    } catch (error) {
      console.error("获取数据失败:", error)
    } finally {
      setLoading(false)
    }
  }, [selectTemplate])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // 实时更新预览
  useEffect(() => {
    if (!selectedTemplate || !selectedTemplate.content) return

    // 收集所有已选择的节点
    const allSelectedNodes = Object.values(nodeMapping).flat()

    // 生成节点配置
    const proxyConfigs = ClashGenerator.generateProxies(allSelectedNodes)

    // 生成节点名称映射
    const nodeMappingNames: Record<string, string[]> = {}
    for (const [groupName, groupNodes] of Object.entries(nodeMapping)) {
      nodeMappingNames[groupName] = groupNodes.map((n) => n.name)
    }

    // 生成预览
    const preview = ClashGenerator.generate({
      template: selectedTemplate.content,
      proxies: proxyConfigs,
      nodeMapping: nodeMappingNames,
      removeUnusedGroups: true,
    })

    setPreviewContent(preview)
  }, [nodeMapping, selectedTemplate])

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

    const activeData = active.data.current as { 
      node?: ProxyNode; 
      groupName?: string; 
      fromGroup?: boolean 
    }
    const overData = over.data.current as { 
      node?: ProxyNode; 
      groupName?: string; 
      isPool?: boolean 
    }

    // 从分组拖回节点池
    if (activeData?.fromGroup && activeData?.node && activeData?.groupName && overData?.isPool) {
      const node = activeData.node
      const fromGroup = activeData.groupName
      
      // 从分组中移除节点
      setNodeMapping((prev) => ({
        ...prev,
        [fromGroup]: prev[fromGroup]?.filter((n) => n.id !== node.id) || [],
      }))
      
      showToast({ 
        title: "移除成功", 
        description: `已将节点 "${node.name}" 移回节点池`, 
        variant: "success" 
      })
      return
    }

    // 分组内排序
    if (activeData?.node && activeData?.groupName && overData?.groupName) {
      const activeGroup = activeData.groupName
      const overGroup = overData.groupName

      if (activeGroup === overGroup) {
        // 同组排序
        const nodes = [...(nodeMapping[activeGroup] || [])]
        const oldIndex = nodes.findIndex((n) => n.id === activeData.node?.id)
        const overNode = overData.node

        if (overNode) {
          const newIndex = nodes.findIndex((n) => n.id === overNode.id)
          if (oldIndex !== -1 && newIndex !== -1) {
            const newNodes = arrayMove(nodes, oldIndex, newIndex)
            setNodeMapping((prev) => ({
              ...prev,
              [activeGroup]: newNodes,
            }))
          }
        }
        return
      }
    }

    // 从节点池拖入分组
    if (activeData?.node && overData?.groupName && !activeData?.fromGroup) {
      const node = activeData.node
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

  const handleRemoveGroup = (groupName: string) => {
    setNodeMapping((prev) => {
      const newMapping = { ...prev }
      delete newMapping[groupName]
      return newMapping
    })
  }

  const handleAddGroup = () => {
    if (!newGroupName.trim()) return

    if (nodeMapping[newGroupName.trim()]) {
      showToast({ title: "分组已存在", description: "该分组名称已存在", variant: "destructive" })
      return
    }

    setNodeMapping((prev) => ({
      ...prev,
      [newGroupName.trim()]: [],
    }))
    showToast({ title: "添加成功", description: `分组 "${newGroupName.trim()}" 已添加`, variant: "success" })
    setIsAddGroupOpen(false)
    setNewGroupName("")
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
        setIsSaveOpen(false)
        setConfigName("")
        showToast({ title: "保存成功", description: "配置已成功保存", variant: "success" })
      } else {
        showToast({ title: "保存失败", description: config.error || "未知错误", variant: "destructive" })
      }
    } catch (error) {
      console.error("保存配置失败:", error)
      showToast({ title: "保存失败", description: "网络错误，请稍后重试", variant: "destructive" })
    }
  }

  // 获取未被使用的节点（节点池）
  const usedNodeIds = new Set(
    Object.values(nodeMapping)
      .flat()
      .map((n) => n.id)
  )
  const availableNodes = nodes.filter((n) => !usedNodeIds.has(n.id))

  // 按分组组织节点
  const nodesByGroup = useMemo(() => {
    const result: Record<string, ProxyNode[]> = {}
    // 未分组的节点
    result["ungrouped"] = availableNodes.filter((n) => !n.groupId)
    // 按 groupId 分组
    availableNodes.forEach((node) => {
      if (node.groupId) {
        if (!result[node.groupId]) result[node.groupId] = []
        result[node.groupId].push(node)
      }
    })
    return result
  }, [availableNodes])

  // 生成节点池分组列表（未分组优先）
  const poolGroupList = useMemo(() => {
    const list: { id: string; name: string; nodes: ProxyNode[] }[] = []
    // 先添加未分组
    if (nodesByGroup["ungrouped"]?.length > 0) {
      list.push({ id: "ungrouped", name: "未分组", nodes: nodesByGroup["ungrouped"] })
    }
    // 再添加其他分组
    groups.forEach((group) => {
      if (nodesByGroup[group.id]?.length > 0) {
        list.push({ id: group.id, name: group.name, nodes: nodesByGroup[group.id] })
      }
    })
    return list
  }, [nodesByGroup, groups])

  // sensors 必须在所有条件之前定义
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor)
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <PageHeader title="配置生成" description="选择模板，拖拽节点生成配置文件">
        <Button onClick={() => setIsSaveOpen(true)} disabled={!selectedTemplate}>
          <Save className="h-4 w-4 mr-2" />
          保存配置
        </Button>
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        {/* 左侧：节点池（支持拖回） */}
        <DroppableNodePool poolGroupList={poolGroupList} />

        {/* 右侧：分组配置 + 预览 */}
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
                      onRemoveGroup={() => handleRemoveGroup(groupName)}
                    />
                  ))}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4 w-full"
                  onClick={() => setIsAddGroupOpen(true)}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  添加分组
                </Button>
              </CardContent>
            </Card>
          )}

          {/* 配置预览 */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">配置预览</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[300px] rounded-lg border">
                <pre className="p-4 text-xs font-mono whitespace-pre-wrap">
                  {previewContent || "选择模板后将显示预览"}
                </pre>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
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

      {/* 添加分组对话框 */}
      <Dialog open={isAddGroupOpen} onOpenChange={setIsAddGroupOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>添加分组</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">分组名称</label>
              <Input
                placeholder="例如: 香港节点"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddGroup()}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddGroupOpen(false)}>
              取消
            </Button>
            <Button onClick={handleAddGroup}>添加</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DndContext>
  )
}
