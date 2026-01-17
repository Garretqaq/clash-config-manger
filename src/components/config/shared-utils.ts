import type { DragEndEvent } from "@dnd-kit/core"
import { arrayMove } from "@dnd-kit/sortable"
import type { ProxyNode, NodeMappingValue } from "@/lib/types"
import { showToast } from "@/components/ui/toast"

// ============== 提取分组名称 ==============
export function extractGroupNames(content: string): string[] {
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

// ============== 检查分组引用关系 ==============
export function checkGroupReferences(
  groupName: string,
  nodeMapping: Record<string, NodeMappingValue[]>
): string[] {
  const referencedBy: string[] = []

  for (const [parentGroup, items] of Object.entries(nodeMapping)) {
    const hasReference = items.some(
      (item) =>
        typeof item === "object" &&
        "type" in item &&
        item.type === "group" &&
        item.name === groupName
    )
    if (hasReference) {
      referencedBy.push(parentGroup)
    }
  }

  return referencedBy
}

// ============== 拖拽结束处理器 ==============
export function createHandleDragEnd(
  nodeMapping: Record<string, NodeMappingValue[]>,
  setNodeMapping: React.Dispatch<React.SetStateAction<Record<string, NodeMappingValue[]>>>
) {
  return (event: DragEndEvent) => {
    const { active, over } = event

    if (!over) return

    const activeData = active.data.current as {
      node?: ProxyNode
      groupName?: string
      fromGroup?: boolean
      isGroupCard?: boolean
    }
    const overData = over.data.current as {
      node?: ProxyNode
      groupName?: string
      isPool?: boolean
    }

    // 场景1: 拖拽分组卡片到另一个分组
    if (activeData?.isGroupCard && activeData.groupName && overData?.groupName) {
      const draggedGroup = activeData.groupName
      const targetGroup = overData.groupName

      // 约束检查: 不能拖入自身
      if (draggedGroup === targetGroup) {
        showToast({ title: "无法操作", description: "分组不能嵌套自己", variant: "destructive" })
        return
      }

      // 检查目标分组是否已经包含该分组
      const targetMapping = nodeMapping[targetGroup] || []
      const hasNestedDraggedGroup = targetMapping.some(
        (item) =>
          typeof item === "object" &&
          "type" in item &&
          item.type === "group" &&
          item.name === draggedGroup
      )
      if (hasNestedDraggedGroup) {
        showToast({ title: "无法操作", description: "该分组已经在目标分组中", variant: "destructive" })
        return
      }

      // 检查是否会造成循环引用(目标分组已嵌套在拖拽分组中)
      const draggedMapping = nodeMapping[draggedGroup] || []
      const hasTargetAsNested = draggedMapping.some(
        (item) =>
          typeof item === "object" &&
          "type" in item &&
          item.type === "group" &&
          item.name === targetGroup
      )
      if (hasTargetAsNested) {
        showToast({
          title: "无法操作",
          description: `${targetGroup} 已嵌套在 ${draggedGroup} 中,无法反向嵌套`,
          variant: "destructive",
        })
        return
      }

      // 添加分组引用(排在嵌套分组末尾,节点之前)
      setNodeMapping((prev) => {
        const currentItems = prev[targetGroup] || []
        // 分离分组引用和节点
        const groups = currentItems.filter(
          (item) => typeof item === "object" && "type" in item && item.type === "group"
        )
        const nodes = currentItems.filter((item) => typeof item === "object" && "id" in item)

        return {
          ...prev,
          [targetGroup]: [...groups, { type: "group" as const, name: draggedGroup }, ...nodes],
        }
      })

      showToast({
        title: "添加成功",
        description: `已将 ${draggedGroup} 嵌套到 ${targetGroup}`,
        variant: "success",
      })
      return
    }

    // 场景2: 从分组拖回节点池
    if (activeData?.fromGroup && activeData?.node && activeData?.groupName && overData?.isPool) {
      const node = activeData.node
      const fromGroup = activeData.groupName

      // 从分组中移除节点
      setNodeMapping((prev) => ({
        ...prev,
        [fromGroup]:
          prev[fromGroup]?.filter(
            (item) => !(typeof item === "object" && "id" in item && item.id === node.id)
          ) || [],
      }))

      showToast({
        title: "移除成功",
        description: `已将节点 "${node.name}" 移回节点池`,
        variant: "success",
      })
      return
    }

    // 场景3: 分组内排序
    if (activeData?.node && activeData?.groupName && overData?.groupName) {
      const activeGroup = activeData.groupName
      const overGroup = overData.groupName

      if (activeGroup === overGroup) {
        // 同组排序
        const items = [...(nodeMapping[activeGroup] || [])]
        const nodes = items.filter(
          (item): item is ProxyNode => typeof item === "object" && "id" in item
        )
        const oldIndex = nodes.findIndex((n) => n.id === activeData.node?.id)
        const overNode = overData.node

        if (overNode) {
          const newIndex = nodes.findIndex((n) => n.id === overNode.id)
          if (oldIndex !== -1 && newIndex !== -1) {
            const newNodes = arrayMove(nodes, oldIndex, newIndex)
            // 保留分组引用,更新节点顺序
            const groups = items.filter(
              (item) => typeof item === "object" && "type" in item && item.type === "group"
            )
            setNodeMapping((prev) => ({
              ...prev,
              [activeGroup]: [...groups, ...newNodes],
            }))
          }
        }
        return
      }
    }

    // 场景4: 从节点池拖入分组
    if (activeData?.node && overData?.groupName && !activeData?.fromGroup) {
      const node = activeData.node
      const groupName = overData.groupName

      // 检查是否已存在
      if (
        nodeMapping[groupName]?.some(
          (item) => typeof item === "object" && "id" in item && item.id === node.id
        )
      ) {
        return
      }

      setNodeMapping((prev) => ({
        ...prev,
        [groupName]: [...(prev[groupName] || []), node],
      }))
    }
  }
}

// ============== 移除节点 ==============
export function createHandleRemoveNode(
  setNodeMapping: React.Dispatch<React.SetStateAction<Record<string, NodeMappingValue[]>>>
) {
  return (groupName: string, nodeId: string) => {
    setNodeMapping((prev) => ({
      ...prev,
      [groupName]:
        prev[groupName]?.filter(
          (item) => !(typeof item === "object" && "id" in item && item.id === nodeId)
        ) || [],
    }))
  }
}

// ============== 移除分组 ==============
export function createHandleRemoveGroup(
  nodeMapping: Record<string, NodeMappingValue[]>,
  setNodeMapping: React.Dispatch<React.SetStateAction<Record<string, NodeMappingValue[]>>>
) {
  return (groupName: string) => {
    // 检查是否被引用
    const references = checkGroupReferences(groupName, nodeMapping)

    if (references.length > 0) {
      showToast({
        title: "无法删除",
        description: `该分组被以下分组引用: ${references.join(", ")}。请先移除引用关系。`,
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
}

// ============== 移除嵌套分组引用 ==============
export function createHandleRemoveNestedGroup(
  setNodeMapping: React.Dispatch<React.SetStateAction<Record<string, NodeMappingValue[]>>>
) {
  return (parentGroup: string, nestedGroupName: string) => {
    setNodeMapping((prev) => ({
      ...prev,
      [parentGroup]: prev[parentGroup].filter(
        (item) =>
          !(
            typeof item === "object" &&
            "type" in item &&
            item.type === "group" &&
            item.name === nestedGroupName
          )
      ),
    }))

    showToast({
      title: "移除成功",
      description: `已从 ${parentGroup} 中移除 ${nestedGroupName}`,
      variant: "success",
    })
  }
}

// ============== 分离嵌套分组和普通节点 ==============
export function separateNestedGroupsAndNodes(
  items: NodeMappingValue[],
  allNodeMapping: Record<string, NodeMappingValue[]>
): {
  nestedGroups: Array<{ name: string; nodes: ProxyNode[] }>
  nodes: ProxyNode[]
} {
  const nestedGroups = items
    .filter(
      (item): item is { type: "group"; name: string } =>
        typeof item === "object" && "type" in item && item.type === "group"
    )
    .map((groupRef) => ({
      name: groupRef.name,
      nodes:
        allNodeMapping[groupRef.name]?.filter(
          (item): item is ProxyNode => typeof item === "object" && "id" in item
        ) || [],
    }))

  const nodes = items.filter(
    (item): item is ProxyNode => typeof item === "object" && "id" in item
  )

  return { nestedGroups, nodes }
}

// ============== 转换为保存格式 ==============
export function convertToSaveFormat(
  nodeMapping: Record<string, NodeMappingValue[]>
): Record<string, Array<string | { type: "group"; name: string }>> {
  const nodeMappingIds: Record<string, Array<string | { type: "group"; name: string }>> = {}

  for (const [groupName, items] of Object.entries(nodeMapping)) {
    nodeMappingIds[groupName] = items
      .map((item) => {
        if (typeof item === "object" && "type" in item && item.type === "group") {
          // 分组引用,直接保留
          return { type: "group" as const, name: item.name }
        } else if (typeof item === "object" && "id" in item) {
          // ProxyNode 对象,提取 ID
          return item.id
        }
        return ""
      })
      .filter(Boolean) as Array<string | { type: "group"; name: string }>
  }

  return nodeMappingIds
}

// ============== 生成节点名称映射(用于预览和YAML生成) ==============
export function generateNodeMappingNames(
  nodeMapping: Record<string, NodeMappingValue[]>
): Record<string, string[]> {
  const nodeMappingNames: Record<string, string[]> = {}

  for (const [groupName, items] of Object.entries(nodeMapping)) {
    nodeMappingNames[groupName] = items
      .map((item) => {
        if (typeof item === "object" && "type" in item && item.type === "group") {
          // 分组引用,使用分组名
          return item.name
        } else if (typeof item === "object" && "name" in item) {
          // 节点,使用节点名
          return item.name
        }
        return ""
      })
      .filter(Boolean)
  }

  return nodeMappingNames
}
