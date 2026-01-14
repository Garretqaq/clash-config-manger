"use client"

import { useDroppable } from "@dnd-kit/core"
import { useCallback } from "react"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Folder, Trash2, Wifi, Loader2 } from "lucide-react"
import type { Group, ProxyNode } from "@/lib/types"
import { NodeCard } from "@/components/nodes/NodeCard"

interface GroupCardProps {
  group: Group
  nodes: ProxyNode[]
  onDeleteGroup?: (id: string) => void
  onDeleteNode?: (id: string) => void
  onEditNode?: (node: ProxyNode) => void
  onTestNodes?: (ids: string[]) => void
  connections?: Record<string, { connected: boolean; port: number }>
  testingNodes?: Set<string>
  selectionMode?: boolean
  selectedNodes?: Set<string>
  onSelectionChange?: (selected: Set<string>, lastSelected: string | null) => void
}

export function GroupCard({
  group,
  nodes,
  onDeleteGroup,
  onDeleteNode,
  onEditNode,
  onTestNodes,
  connections = {},
  testingNodes = new Set(),
  selectionMode = false,
  selectedNodes = new Set(),
  onSelectionChange,
}: GroupCardProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: `group-${group.id}`,
    data: { group },
  })

  const handleGroupTest = () => {
    if (onTestNodes && nodes.length > 0) {
      onTestNodes(nodes.map((n) => n.id))
    }
  }

  const handleSelectAll = (checked: boolean) => {
    if (onSelectionChange) {
      if (checked) {
        const allIds = new Set(nodes.map((n) => n.id))
        onSelectionChange(allIds, null)
      } else {
        onSelectionChange(new Set(), null)
      }
    }
  }

  const handleSelect = useCallback((nodeId: string, shiftKey: boolean) => {
    if (!onSelectionChange) return

    if (shiftKey && selectedNodes.size > 0) {
      // Shift 多选：选择范围内的所有节点
      const nodeIds = nodes.map((n) => n.id)
      const lastSelected = Array.from(selectedNodes).pop()
      const currentIndex = nodeIds.indexOf(nodeId)
      const lastIndex = lastSelected ? nodeIds.indexOf(lastSelected) : -1

      if (lastIndex >= 0 && currentIndex >= 0) {
        const start = Math.min(lastIndex, currentIndex)
        const end = Math.max(lastIndex, currentIndex)
        const newSelected = new Set(selectedNodes)
        for (let i = start; i <= end; i++) {
          newSelected.add(nodeIds[i])
        }
        onSelectionChange(newSelected, nodeId)
        return
      }
    }

    // 普通选择
    const newSelected = new Set(selectedNodes)
    if (newSelected.has(nodeId)) {
      newSelected.delete(nodeId)
    } else {
      newSelected.add(nodeId)
    }
    onSelectionChange(newSelected, nodeId)
  }, [nodes, selectedNodes, onSelectionChange])

  const handleBatchDelete = () => {
    if (!onDeleteNode || selectedNodes.size === 0) return

    // 使用最后一个选中的节点来触发确认
    const lastSelected = Array.from(selectedNodes).pop()
    if (lastSelected) {
      onDeleteNode(lastSelected)
    }
  }

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "rounded-lg border bg-card transition-all",
        isOver && "ring-2 ring-primary border-primary"
      )}
    >
      {/* Group Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-3">
          <Folder className="h-5 w-5 text-primary" />
          <div>
            <h3 className="font-semibold">{group.name}</h3>
            <p className="text-xs text-muted-foreground">{group.type}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {selectionMode ? (
            <div className="flex items-center gap-2">
              <Checkbox
                checked={selectedNodes.size === nodes.length && nodes.length > 0}
                onChange={(e) => handleSelectAll(e.target.checked)}
              />
              <span className="text-sm text-muted-foreground">
                {selectedNodes.size}/{nodes.length}
              </span>
              {selectedNodes.size > 0 && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleBatchDelete}
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  删除
                </Button>
              )}
            </div>
          ) : (
            <>
              <Badge variant="outline">{nodes.length} 节点</Badge>
              {onTestNodes && nodes.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleGroupTest}
                  disabled={testingNodes.size > 0}
                >
                  {testingNodes.size > 0 ? (
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  ) : (
                    <Wifi className="h-4 w-4 mr-1" />
                  )}
                  测试
                </Button>
              )}
              {onDeleteGroup && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  onClick={() => onDeleteGroup(group.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Nodes List */}
      <div className="p-4 space-y-2 min-h-[100px]">
        {nodes.length === 0 ? (
          <div className="flex items-center justify-center h-20 text-muted-foreground text-sm border-2 border-dashed rounded-lg">
            拖拽节点到此处
          </div>
        ) : (
          nodes.map((node) => (
            <NodeCard
              key={node.id}
              node={node}
              onDelete={selectionMode ? undefined : onDeleteNode}
              onEdit={onEditNode}
              connected={connections[node.id]?.connected}
              testPort={connections[node.id]?.port}
              isTesting={testingNodes.has(node.id)}
              onTest={onTestNodes ? (id) => onTestNodes([id]) : undefined}
              selectable={selectionMode}
              selected={selectedNodes.has(node.id)}
              onSelect={handleSelect}
            />
          ))
        )}
      </div>
    </div>
  )
}
