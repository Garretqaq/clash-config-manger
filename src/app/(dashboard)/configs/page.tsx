"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import {
  DndContext,
  DragOverlay,
  DragStartEvent,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core"
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
import { Save, Server, Plus } from "lucide-react"
import { ClashGenerator } from "@/lib/clash-generator"
import { parseRules, serializeRules, type RuleItem } from "@/lib/clash-rules"
import { parseRuleProviders, serializeRuleProviders, validateRuleProviders, type RuleProviderItem } from "@/lib/clash-rule-providers"
import { RulesEditor } from "@/components/config/rules-editor"
import { RuleProvidersEditor } from "@/components/config/rule-providers-editor"
import { showToast } from "@/components/ui/toast"
import type { ProxyNode, Template, Group, NodeMappingValue } from "@/lib/types"

// 导入共享组件和工具
import {
  DroppableNodePool,
  DraggableGroupCard,
} from "@/components/config/shared-components"
import {
  extractGroupNames,
  createHandleDragEnd,
  createHandleRemoveNode,
  createHandleRemoveGroup,
  createHandleRemoveNestedGroup,
  separateNestedGroupsAndNodes,
  convertToSaveFormat,
  generateNodeMappingNames,
} from "@/components/config/shared-utils"

export default function ConfigsPage() {
  const [nodes, setNodes] = useState<ProxyNode[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)

  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null)
  const [nodeMapping, setNodeMapping] = useState<Record<string, NodeMappingValue[]>>({})
  const [configName, setConfigName] = useState("")
  const [previewContent, setPreviewContent] = useState("")
  const [activeNode, setActiveNode] = useState<ProxyNode | null>(null)

  const [isSaveOpen, setIsSaveOpen] = useState(false)
  const [isAddGroupOpen, setIsAddGroupOpen] = useState(false)
  const [newGroupName, setNewGroupName] = useState("")
  const [nodePoolWidth, setNodePoolWidth] = useState(320)
  const [rules, setRules] = useState<RuleItem[]>([])
  const [ruleProviders, setRuleProviders] = useState<RuleProviderItem[]>([])

  const ruleTargets = useMemo(
    () => ['DIRECT', 'REJECT', 'REJECT-DROP', 'PASS', ...Object.keys(nodeMapping)],
    [nodeMapping]
  )

  // 定义 selectTemplate 函数（需要放在 fetchData 之前）
  const selectTemplate = useCallback((template: Template) => {
    setSelectedTemplate(template)
    // 解析模板中的分组
    const groupNames = extractGroupNames(template.content)
    const mapping: Record<string, NodeMappingValue[]> = {}
    groupNames.forEach((name) => {
      mapping[name] = []
    })
    setNodeMapping(mapping)
    // 解析模板中的 rules 和 rule-providers，实现"继承后编辑"而非"清空后重建"
    setRules(parseRules(template.content))
    setRuleProviders(parseRuleProviders(template.content))
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

    // 收集所有已选择的节点（仅ProxyNode，不包括分组引用）
    const allSelectedNodes = Object.values(nodeMapping)
      .flat()
      .filter((item): item is ProxyNode =>
        typeof item === 'object' && 'id' in item
      )

    // 生成节点配置
    const proxyConfigs = ClashGenerator.generateProxies(allSelectedNodes)

    // 生成节点名称映射（包括节点名和分组名）
    const nodeMappingNames = generateNodeMappingNames(nodeMapping)

    // 生成预览
    const preview = ClashGenerator.generate({
      template: selectedTemplate.content,
      proxies: proxyConfigs,
      nodeMapping: nodeMappingNames,
      removeUnusedGroups: true,
      rules: serializeRules(rules),
      ruleProviders: serializeRuleProviders(ruleProviders),
    })

    setPreviewContent(preview)
  }, [nodeMapping, selectedTemplate, rules, ruleProviders])

  const handleDragStart = (event: DragStartEvent) => {
    const data = event.active.data.current as { node?: ProxyNode }
    if (data?.node) {
      setActiveNode(data.node)
    }
  }

  // 使用共享工具创建处理器
  const handleDragEnd = useMemo(
    () => createHandleDragEnd(nodeMapping, setNodeMapping),
    [nodeMapping]
  )

  const handleRemoveNode = useMemo(
    () => createHandleRemoveNode(setNodeMapping),
    []
  )

  const handleRemoveGroup = useMemo(
    () => createHandleRemoveGroup(nodeMapping, setNodeMapping),
    [nodeMapping]
  )

  const handleRemoveNestedGroup = useMemo(
    () => createHandleRemoveNestedGroup(setNodeMapping),
    []
  )

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

    // 校验 rules
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
    // 校验 rule-providers
    const rpValidation = validateRuleProviders(rules, ruleProviders)
    if (!rpValidation.ok) {
      showToast({ title: "规则集校验失败", description: rpValidation.errors[0], variant: "destructive" })
      return
    }

    // 转换为保存格式: NodeMappingValue[] -> NodeMappingItem[]
    const nodeMappingIds = convertToSaveFormat(nodeMapping)

    try {
      const res = await fetch("/api/configs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: configName,
          templateId: selectedTemplate.id,
          nodeMapping: nodeMappingIds,
          rules: serializeRules(rules),
          ruleProviders: serializeRuleProviders(ruleProviders),
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
      onDragEnd={(event) => {
        setActiveNode(null)
        handleDragEnd(event)
      }}
    >
      <PageHeader title="配置生成" description="选择模板，拖拽节点生成配置文件">
        <Button onClick={() => setIsSaveOpen(true)} disabled={!selectedTemplate}>
          <Save className="h-4 w-4 mr-2" />
          保存配置
        </Button>
      </PageHeader>

      <div className="flex gap-6">
        {/* 左侧：节点池（支持拖回，可调整宽度） */}
        <ResizablePanel
          width={nodePoolWidth}
          minWidth={200}
          maxWidth={500}
          onWidthChange={setNodePoolWidth}
        >
          <DroppableNodePool poolGroupList={poolGroupList} />
        </ResizablePanel>

        {/* 右侧：分组配置 + 预览 */}
        <div className="flex-1 space-y-4">
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
                  {Object.keys(nodeMapping).map((groupName) => {
                    const items = nodeMapping[groupName] || []

                    // 使用共享工具分离嵌套分组和普通节点
                    const { nestedGroups, nodes } = separateNestedGroupsAndNodes(items, nodeMapping)

                    return (
                      <DraggableGroupCard
                        key={groupName}
                        groupName={groupName}
                        nodes={nodes}
                        nestedGroups={nestedGroups}
                        onRemoveNode={(nodeId) => handleRemoveNode(groupName, nodeId)}
                        onRemoveGroup={() => handleRemoveGroup(groupName)}
                        onRemoveNestedGroup={(nestedGroupName) => handleRemoveNestedGroup(groupName, nestedGroupName)}
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
          {selectedTemplate && (
            <div className="space-y-4">
              <RulesEditor rules={rules} onChange={setRules} ruleTargets={ruleTargets} />
              <RuleProvidersEditor providers={ruleProviders} onChange={setRuleProviders} />
            </div>
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
