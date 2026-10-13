"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { useRouter, useParams } from "next/navigation"
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
import { ResizablePanel } from "@/components/ui/resizable-panel"
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
  ArrowLeft,
  FolderTree,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { ClashGenerator } from "@/lib/clash-generator"
import { parseRules, serializeRules, type RuleItem } from "@/lib/clash-rules"
import { parseRuleProviders, serializeRuleProviders, validateRuleProviders, type RuleProviderItem } from "@/lib/clash-rule-providers"
import { RulesEditor } from "@/components/config/rules-editor"
import { RuleProvidersEditor } from "@/components/config/rule-providers-editor"
import { DnsEditor } from "@/components/config/dns-editor"
import { parseDns, serializeDns, validateDns, type DnsConfig } from "@/lib/clash-dns"
import { showToast } from "@/components/ui/toast"
import type { ProxyNode, Template, Group, Config, NodeMappingValue } from "@/lib/types"

// 可拖拽的节点卡片
function DraggablePoolNode({ node }: { node: ProxyNode }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `pool-node-${node.id}`,
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

// 可排序的分组节点
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
    data: { node, groupName },
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

// 嵌套分组项
function NestedGroupItem({
  groupName,
  nodes,
  onRemove,
}: {
  groupName: string
  nodes: ProxyNode[]
  onRemove: () => void
}) {
  const [isExpanded, setIsExpanded] = useState(false)

  return (
    <div className="border-l-4 border-l-yellow-500 bg-yellow-50/50 dark:bg-yellow-900/10 rounded-md p-3 mb-2">
      <div className="flex items-center gap-2">
        <GripVertical className="h-3 w-3 text-muted-foreground" />
        <span className="text-muted-foreground text-sm">└─</span>
        <FolderTree className="h-3 w-3 text-yellow-600 dark:text-yellow-500" />
        <span className="text-sm font-medium flex-1">{groupName}</span>
        <Badge variant="outline" className="text-xs">
          {nodes.length} 节点
        </Badge>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-muted-foreground hover:text-foreground p-1"
          title={isExpanded ? "折叠" : "展开"}
        >
          {isExpanded ? (
            <ChevronDown className="h-3 w-3" />
          ) : (
            <ChevronRight className="h-3 w-3" />
          )}
        </button>
        <button
          onClick={onRemove}
          className="text-muted-foreground hover:text-destructive cursor-pointer p-1"
          title="移除引用"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </div>

      {isExpanded && nodes.length > 0 && (
        <div className="mt-2 ml-6 space-y-1 p-2 bg-muted/30 rounded border">
          {nodes.map((node) => (
            <div key={node.id} className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="text-xs">•</span>
              <Server className="h-3 w-3" />
              <span className="truncate">{node.name}</span>
              <Badge variant="outline" className="text-[10px] px-1">
                {node.type}
              </Badge>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// 可拖拽和可放置的分组卡片
function DraggableGroupCard({
  groupName,
  nodes,
  nestedGroups,
  onRemoveNode,
  onRemoveGroup,
  onRemoveNestedGroup,
  allNodeMapping,
}: {
  groupName: string
  nodes: ProxyNode[]
  nestedGroups: Array<{ name: string; nodes: ProxyNode[] }>
  onRemoveNode: (nodeId: string) => void
  onRemoveGroup: () => void
  onRemoveNestedGroup: (nestedGroupName: string) => void
  allNodeMapping: Record<string, NodeMappingValue[]>
}) {
  // 拖拽源
  const { attributes: dragAttributes, listeners: dragListeners, setNodeRef: setDragRef, isDragging } = useDraggable({
    id: `group-card-${groupName}`,
    data: { isGroupCard: true, groupName },
  })

  // 放置目标
  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: `config-group-${groupName}`,
    data: { groupName },
  })

  return (
    <div
      ref={setDropRef}
      className={cn(
        "rounded-lg border p-4 transition-all min-h-[120px]",
        isOver && "ring-2 ring-primary border-primary bg-primary/5",
        isDragging && "opacity-50"
      )}
    >
      <div className="flex items-center gap-2 mb-3">
        <div
          ref={setDragRef}
          {...dragAttributes}
          {...dragListeners}
          className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground p-1"
          title="拖拽分组"
        >
          <GripVertical className="h-4 w-4" />
        </div>
        <Folder className="h-4 w-4 text-primary" />
        <h4 className="font-medium">{groupName}</h4>
        <Badge variant="outline" className="ml-auto">
          {nestedGroups.length > 0 && `${nestedGroups.length} 组 + `}
          {nodes.length} 节点
        </Badge>
        <button
          onClick={onRemoveGroup}
          className="text-muted-foreground hover:text-destructive cursor-pointer p-1 rounded hover:bg-destructive/10"
          title="删除分组"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </div>

      {/* 嵌套分组区域 */}
      {nestedGroups.length > 0 && (
        <div className="mb-3">
          {nestedGroups.map((nestedGroup) => (
            <NestedGroupItem
              key={nestedGroup.name}
              groupName={nestedGroup.name}
              nodes={nestedGroup.nodes}
              onRemove={() => onRemoveNestedGroup(nestedGroup.name)}
            />
          ))}
        </div>
      )}

      {/* 普通节点区域 */}
      <SortableContext
        items={nodes.map((n) => `sort-${groupName}-${n.id}`)}
        strategy={verticalListSortingStrategy}
      >
        <div className="space-y-2">
          {nodes.length === 0 && nestedGroups.length === 0 ? (
            <div className="text-sm text-muted-foreground text-center py-4 border-2 border-dashed rounded-lg">
              拖拽节点或分组到此处
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

export default function EditConfigPage() {
  const router = useRouter()
  const params = useParams()
  const configId = params?.id as string

  const [nodes, setNodes] = useState<ProxyNode[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [isLoadingConfig, setIsLoadingConfig] = useState(false)
  const [configData, setConfigData] = useState<Config | null>(null)
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null)
  const [nodeMapping, setNodeMapping] = useState<Record<string, NodeMappingValue[]>>({})
  const [configName, setConfigName] = useState("")
  const [previewContent, setPreviewContent] = useState("")
  const [rules, setRules] = useState<RuleItem[]>([])
  const [ruleProviders, setRuleProviders] = useState<RuleProviderItem[]>([])
  const [dns, setDns] = useState<DnsConfig>({})
  const [activeNode, setActiveNode] = useState<ProxyNode | null>(null)

  const [isSaveOpen, setIsSaveOpen] = useState(false)
  const [isAddGroupOpen, setIsAddGroupOpen] = useState(false)
  const [newGroupName, setNewGroupName] = useState("")
  const [nodePoolWidth, setNodePoolWidth] = useState(320)

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
    } catch (error) {
      console.error("获取数据失败:", error)
    } finally {
      setLoading(false)
    }
  }, [])

  // 加载配置数据
  const loadConfigData = useCallback(async () => {
    if (!configId) return

    setIsLoadingConfig(true)
    try {
      // 先获取配置
      const configRes = await fetch(`/api/configs?id=${configId}`)
      if (!configRes.ok) throw new Error("配置不存在")
      const config = await configRes.json()

      setConfigData(config)
      setRules(parseRules(config.content))
      setRuleProviders(parseRuleProviders(config.content))
      setDns(parseDns(config.content))
      setConfigName(config.name)

      // 获取所有节点（不过滤）
      const nodesRes = await fetch("/api/nodes")
      const allNodes = await nodesRes.json()

      // 获取模板
      const templatesRes = await fetch("/api/templates")
      const templatesData = await templatesRes.json()

      setNodes(allNodes)
      setTemplates(templatesData)

      // 从配置文件内容中解析分组名称
      const groupNames = extractGroupNames(config.content)

      // 初始化 nodeMapping,保留现有映射,添加配置文件中存在但映射中不存在的分组
      const mapping: Record<string, NodeMappingValue[]> = {}
      groupNames.forEach((name: string) => {
        if (config.nodeMapping[name]) {
          const items = config.nodeMapping[name] as Array<string | { type: 'group'; name: string }>

          // 转换每个项:节点ID或分组引用
          const validItems = items.map(item => {
            if (typeof item === 'object' && item.type === 'group') {
              // 分组引用,直接保留
              return { type: 'group' as const, name: item.name }
            } else {
              // 节点ID,查找节点对象
              const nodeId = item as string
              const node = allNodes.find((n: ProxyNode) => n.id === nodeId)
              return node
            }
          }).filter((item): item is NodeMappingValue => {
            // 过滤掉不存在的节点(保留分组引用和有效节点)
            if (!item) return false
            if (typeof item === 'object' && 'type' in item && item.type === 'group') return true
            if (typeof item === 'object' && 'id' in item) return true
            return false
          })

          mapping[name] = validItems
        } else {
          // 配置文件中存在但映射中没有,初始化为空
          mapping[name] = []
        }
      })

      // 设置模板(只用于显示,不用于分组解析)
      const template = templatesData.find((t: Template) => t.id === config.templateId)
      if (template) {
        setSelectedTemplate(template)
      }

      setNodeMapping(mapping)
    } catch (error) {
      console.error("加载配置失败:", error)
      showToast({ title: "加载失败", description: "无法加载配置数据", variant: "destructive" })
    } finally {
      setIsLoadingConfig(false)
    }
  }, [configId])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  useEffect(() => {
    if (!loading) {
      loadConfigData()
    }
  }, [loading, loadConfigData])

  // 实时更新预览
  useEffect(() => {
    // 优先使用配置文件内容,如果没有则使用模板
    const templateContent = configData?.content || selectedTemplate?.content
    if (!templateContent) return

    // 收集所有已选择的节点(只包含ProxyNode,不包含分组引用)
    const allSelectedNodes = Object.values(nodeMapping)
      .flat()
      .filter((item): item is ProxyNode => typeof item === 'object' && 'id' in item)

    // 生成节点配置
    const proxyConfigs = ClashGenerator.generateProxies(allSelectedNodes)

    // 生成节点名称和分组名称的混合映射
    const nodeMappingNames: Record<string, string[]> = {}
    for (const [groupName, items] of Object.entries(nodeMapping)) {
      nodeMappingNames[groupName] = items.map(item => {
        if (typeof item === 'object' && 'type' in item && item.type === 'group') {
          // 分组引用:使用分组名称
          return item.name
        } else if (typeof item === 'object' && 'name' in item) {
          // ProxyNode:使用节点名称
          return item.name
        }
        return ''
      }).filter(Boolean)
    }

    // 生成预览
    const preview = ClashGenerator.generate({
      template: templateContent,
      proxies: proxyConfigs,
      nodeMapping: nodeMappingNames,
      removeUnusedGroups: true,
      rules: serializeRules(rules),
      ruleProviders: serializeRuleProviders(ruleProviders),
      dns: serializeDns(dns),
    })

    setPreviewContent(preview)
  }, [nodeMapping, selectedTemplate, configData, rules, ruleProviders, dns])

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
      node?: ProxyNode
      groupName?: string
      isGroupCard?: boolean
    }
    const overData = over.data.current as { node?: ProxyNode; groupName?: string }

    // 场景1: 拖拽分组卡片到另一个分组
    if (activeData?.isGroupCard && activeData.groupName && overData?.groupName) {
      const draggedGroup = activeData.groupName
      const targetGroup = overData.groupName

      // 约束检查1: 不能拖入自身
      if (draggedGroup === targetGroup) {
        showToast({ title: "无法操作", description: "分组不能嵌套自己", variant: "destructive" })
        return
      }

      // 约束检查2: 检查目标分组是否已经包含拖拽分组
      const targetMapping = nodeMapping[targetGroup] || []
      const hasNestedDraggedGroup = targetMapping.some(
        item => typeof item === 'object' && 'type' in item && item.type === 'group' && item.name === draggedGroup
      )
      if (hasNestedDraggedGroup) {
        showToast({ title: "无法操作", description: "该分组已经在目标分组中", variant: "destructive" })
        return
      }

      // 约束检查3: 检查是否会造成循环引用(一层嵌套下,只需检查目标是否嵌套在拖拽分组中)
      const draggedMapping = nodeMapping[draggedGroup] || []
      const hasTargetAsNested = draggedMapping.some(
        item => typeof item === 'object' && 'type' in item && item.type === 'group' && item.name === targetGroup
      )
      if (hasTargetAsNested) {
        showToast({
          title: "无法操作",
          description: `${targetGroup} 已嵌套在 ${draggedGroup} 中,无法反向嵌套`,
          variant: "destructive"
        })
        return
      }

      // 添加分组引用(排在嵌套分组末尾,节点之前)
      setNodeMapping(prev => {
        const currentItems = prev[targetGroup] || []
        // 分离分组引用和节点
        const groups = currentItems.filter(item => typeof item === 'object' && 'type' in item && item.type === 'group')
        const nodes = currentItems.filter(item => typeof item === 'object' && 'id' in item)

        return {
          ...prev,
          [targetGroup]: [
            ...groups,
            { type: 'group' as const, name: draggedGroup },
            ...nodes,
          ],
        }
      })

      showToast({
        title: "添加成功",
        description: `已将 ${draggedGroup} 嵌套到 ${targetGroup}`,
        variant: "success"
      })
      return
    }

    // 场景2: 分组内排序
    if (activeData?.node && activeData?.groupName && overData?.groupName) {
      const activeGroup = activeData.groupName
      const overGroup = overData.groupName

      if (activeGroup === overGroup) {
        // 同组排序
        const items = [...(nodeMapping[activeGroup] || [])]
        const oldIndex = items.findIndex((item) =>
          typeof item === 'object' && 'id' in item && item.id === activeData.node?.id
        )
        const overNode = overData.node

        if (overNode) {
          const newIndex = items.findIndex((item) =>
            typeof item === 'object' && 'id' in item && item.id === overNode.id
          )
          if (oldIndex !== -1 && newIndex !== -1) {
            const newItems = arrayMove(items, oldIndex, newIndex)
            setNodeMapping((prev) => ({
              ...prev,
              [activeGroup]: newItems,
            }))
          }
        }
        return
      }
    }

    // 场景3: 从节点池拖入分组
    if (activeData?.node && overData?.groupName) {
      const node = activeData.node
      const groupName = overData.groupName

      // 检查是否已存在
      if (nodeMapping[groupName]?.some((item) => typeof item === 'object' && 'id' in item && item.id === node.id)) {
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
      [groupName]: prev[groupName]?.filter((item) =>
        !(typeof item === 'object' && 'id' in item && item.id === nodeId)
      ) || [],
    }))
  }

  // 检查分组引用关系
  const checkGroupReferences = useCallback((groupName: string): string[] => {
    const referencedBy: string[] = []

    for (const [parentGroup, items] of Object.entries(nodeMapping)) {
      const hasReference = items.some(
        item => typeof item === 'object' && 'type' in item && item.type === 'group' && item.name === groupName
      )
      if (hasReference) {
        referencedBy.push(parentGroup)
      }
    }

    return referencedBy
  }, [nodeMapping])

  const handleRemoveGroup = (groupName: string) => {
    // 检查是否被引用
    const references = checkGroupReferences(groupName)

    if (references.length > 0) {
      showToast({
        title: "无法删除",
        description: `该分组被以下分组引用: ${references.join(', ')}。请先移除引用关系。`,
        variant: "destructive",
      })
      return
    }

    // 未被引用,可以删除
    setNodeMapping((prev) => {
      const newMapping = { ...prev }
      delete newMapping[groupName]
      return newMapping
    })

    showToast({ title: "删除成功", description: `分组 ${groupName} 已删除`, variant: "success" })
  }

  // 移除嵌套分组引用
  const handleRemoveNestedGroup = (parentGroup: string, nestedGroupName: string) => {
    setNodeMapping(prev => ({
      ...prev,
      [parentGroup]: prev[parentGroup].filter(
        item => !(typeof item === 'object' && 'type' in item && item.type === 'group' && item.name === nestedGroupName)
      ),
    }))

    showToast({
      title: "移除成功",
      description: `已从 ${parentGroup} 中移除 ${nestedGroupName}`,
      variant: "success"
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

  const ruleTargets = useMemo(
    () => ['DIRECT', 'REJECT', 'REJECT-DROP', 'PASS', ...Object.keys(nodeMapping)],
    [nodeMapping]
  )

  const handleSaveConfig = async () => {
    if (!configName.trim()) return

    // 如果是编辑已有配置,使用原有的 templateId(向后兼容)
    // 如果没有 templateId,则使用当前选中的模板
    const templateId = configData?.templateId || selectedTemplate?.id
    if (!templateId) {
      showToast({ title: "保存失败", description: "无法确定模板信息", variant: "destructive" })
      return
    }

    // 校验规则：所有规则须有类型与目标；非 MATCH/FINAL 类型须有值
    for (let i = 0; i < rules.length; i++) {
      const r = rules[i]
      if (!r.type || !r.target) {
        showToast({ title: "规则不完整", description: `第 ${i + 1} 条规则缺少类型或目标`, variant: "destructive" })
        return
      }
      if (r.type !== 'MATCH' && r.type !== 'FINAL' && !r.value) {
        showToast({ title: "规则不完整", description: `第 ${i + 1} 条规则缺少值`, variant: "destructive" })
        return
      }
    }

    // 校验 rule-providers 自身 + RULE-SET 引用一致性
    const rpValidation = validateRuleProviders(rules, ruleProviders)
    if (!rpValidation.ok) {
      showToast({ title: "规则集校验失败", description: rpValidation.errors[0], variant: "destructive" })
      return
    }

    // 校验 dns
    const dnsValidation = validateDns(dns)
    if (!dnsValidation.ok) {
      showToast({ title: "DNS 配置校验失败", description: dnsValidation.errors[0], variant: "destructive" })
      return
    }

    // 转换为保存格式:NodeMappingItem[]
    const nodeMappingIds: Record<string, Array<string | { type: 'group'; name: string }>> = {}
    for (const [groupName, items] of Object.entries(nodeMapping)) {
      nodeMappingIds[groupName] = items.map(item => {
        if (typeof item === 'object' && 'type' in item && item.type === 'group') {
          // 分组引用,直接保留
          return { type: 'group' as const, name: item.name }
        } else if (typeof item === 'object' && 'id' in item) {
          // ProxyNode 对象,提取 ID
          return item.id
        }
        return ''
      }).filter(Boolean) as Array<string | { type: 'group'; name: string }>
    }

    try {
      const res = await fetch("/api/configs", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: configId,
          name: configName,
          templateId: templateId,
          nodeMapping: nodeMappingIds,
          rules: serializeRules(rules),
          ruleProviders: serializeRuleProviders(ruleProviders),
          dns: serializeDns(dns),
        }),
      })
      const result = await res.json()

      if (res.ok) {
        setIsSaveOpen(false)
        showToast({ title: "更新成功", description: "配置已成功更新", variant: "success" })
        router.push("/generated-configs")
      } else {
        showToast({ title: "更新失败", description: result.error || "未知错误", variant: "destructive" })
      }
    } catch (error) {
      console.error("保存配置失败:", error)
      showToast({ title: "保存失败", description: "网络错误，请稍后重试", variant: "destructive" })
    }
  }

  // 节点池显示所有节点，支持重复拖动到不同分组
  const poolNodes = nodes

  // 按分组组织节点
  const nodesByGroup = useMemo(() => {
    const result: Record<string, ProxyNode[]> = {}
    // 未分组的节点
    result["ungrouped"] = poolNodes.filter((n) => !n.groupId)
    // 按 groupId 分组
    poolNodes.forEach((node) => {
      if (node.groupId) {
        if (!result[node.groupId]) result[node.groupId] = []
        result[node.groupId].push(node)
      }
    })
    return result
  }, [poolNodes])

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

  if (loading || isLoadingConfig) {
    return (
      <div className="flex items-center justify-center h-[50vh] flex-col gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-muted-foreground">正在加载配置数据...</p>
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
      <PageHeader
        title="编辑配置"
        description={`配置名称: ${configName}`}
      >
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.push("/generated-configs")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            取消
          </Button>
          <Button onClick={() => setIsSaveOpen(true)} disabled={!configData}>
            <Save className="h-4 w-4 mr-2" />
            保存
          </Button>
        </div>
      </PageHeader>

      <div className="flex gap-6">
        {/* 左侧：节点池（可调整宽度） */}
        <ResizablePanel
          width={nodePoolWidth}
          minWidth={200}
          maxWidth={500}
          onWidthChange={setNodePoolWidth}
        >
          <Card className="h-fit max-h-[calc(100vh-200px)]">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">节点池</CardTitle>
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
        </ResizablePanel>

        {/* 右侧：分组配置 + 预览 */}
        <div className="flex-1 space-y-4">
          {/* 模板信息（只读） */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">使用模板</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-sm">
                  {selectedTemplate?.name || "未知模板"}
                </Badge>
                {selectedTemplate?.isDefault && <Badge variant="secondary">默认</Badge>}
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
                  {Object.keys(nodeMapping).map((groupName) => {
                    const items = nodeMapping[groupName] || []
                    // 分离嵌套分组和普通节点
                    const nestedGroups = items
                      .filter((item): item is { type: 'group'; name: string } =>
                        typeof item === 'object' && 'type' in item && item.type === 'group'
                      )
                      .map(groupRef => ({
                        name: groupRef.name,
                        nodes: nodeMapping[groupRef.name]?.filter(
                          (item): item is ProxyNode => typeof item === 'object' && 'id' in item
                        ) || []
                      }))

                    const nodes = items.filter((item): item is ProxyNode =>
                      typeof item === 'object' && 'id' in item
                    )

                    return (
                      <DraggableGroupCard
                        key={groupName}
                        groupName={groupName}
                        nodes={nodes}
                        nestedGroups={nestedGroups}
                        onRemoveNode={(nodeId) => handleRemoveNode(groupName, nodeId)}
                        onRemoveGroup={() => handleRemoveGroup(groupName)}
                        onRemoveNestedGroup={(nestedGroupName) => handleRemoveNestedGroup(groupName, nestedGroupName)}
                        allNodeMapping={nodeMapping}
                      />
                    )
                  })}
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

          {/* 规则配置 */}
          <RulesEditor rules={rules} onChange={setRules} ruleTargets={ruleTargets} />

          {/* 规则集（rule-providers） */}
          <RuleProvidersEditor providers={ruleProviders} onChange={setRuleProviders} />

          {/* DNS 配置 */}
          <DnsEditor dns={dns} onChange={setDns} />

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
