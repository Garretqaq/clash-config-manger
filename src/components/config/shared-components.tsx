"use client"

import { useState } from "react"
import {
  useDraggable,
  useDroppable,
} from "@dnd-kit/core"
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Server,
  Folder,
  FolderTree,
  ChevronDown,
  ChevronRight,
  GripVertical,
  Trash2,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { ProxyNode, NodeMappingValue } from "@/lib/types"

// ============== 可拖拽的节点卡片 ==============
export function DraggablePoolNode({ node }: { node: ProxyNode }) {
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

// ============== 嵌套分组项 ==============
export function NestedGroupItem({
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
          className="text-muted-foreground hover:text-foreground p-1 rounded hover:bg-muted"
        >
          {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        </button>
        <button
          onClick={onRemove}
          className="text-muted-foreground hover:text-destructive p-1 rounded hover:bg-destructive/10"
          title="移除嵌套分组"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </div>
      {isExpanded && nodes.length > 0 && (
        <div className="mt-2 ml-6 space-y-1 p-2 bg-muted/30 rounded border border-dashed">
          {nodes.map((node) => (
            <div key={node.id} className="flex items-center gap-2 text-xs py-1">
              <Server className="h-3 w-3 text-muted-foreground" />
              <span className="flex-1 truncate">{node.name}</span>
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

// ============== 可排序的分组节点 ==============
export function SortableGroupNode({
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
    data: { node, groupName, fromGroup: true },
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

// ============== 可拖拽且可放置的分组卡片 ==============
export function DraggableGroupCard({
  groupName,
  nodes,
  nestedGroups,
  onRemoveNode,
  onRemoveGroup,
  onRemoveNestedGroup,
}: {
  groupName: string
  nodes: ProxyNode[]
  nestedGroups: Array<{ name: string; nodes: ProxyNode[] }>
  onRemoveNode: (nodeId: string) => void
  onRemoveGroup: () => void
  onRemoveNestedGroup: (nestedGroupName: string) => void
}) {
  const { attributes: dragAttributes, listeners: dragListeners, setNodeRef: setDragRef, isDragging } = useDraggable({
    id: `group-card-${groupName}`,
    data: { isGroupCard: true, groupName },
  })

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
          className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground"
        >
          <GripVertical className="h-4 w-4" />
        </div>
        <Folder className="h-4 w-4 text-primary" />
        <h4 className="font-medium">{groupName}</h4>
        <Badge variant="outline" className="ml-auto">
          {nestedGroups.length + nodes.length}
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
          {/* 嵌套分组优先显示 */}
          {nestedGroups.map((nestedGroup) => (
            <NestedGroupItem
              key={nestedGroup.name}
              groupName={nestedGroup.name}
              nodes={nestedGroup.nodes}
              onRemove={() => onRemoveNestedGroup(nestedGroup.name)}
            />
          ))}

          {/* 普通节点 */}
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

// ============== 节点池分组 ==============
export function NodePoolGroup({
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

// ============== 可放置的节点池 ==============
export function DroppableNodePool({
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
