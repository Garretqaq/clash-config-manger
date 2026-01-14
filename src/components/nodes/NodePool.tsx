"use client"

import { useDroppable } from "@dnd-kit/core"
import { useCallback, useState } from "react"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Inbox, Wifi, Loader2, Trash2 } from "lucide-react"
import type { ProxyNode } from "@/lib/types"
import { NodeCard } from "./NodeCard"

interface NodePoolProps {
  nodes: ProxyNode[]
  onDeleteNode?: (id: string) => void
  onEditNode?: (node: ProxyNode) => void
  onTestNodes?: (ids: string[]) => void
  connections?: Record<string, { connected: boolean; port: number }>
  testingNodes?: Set<string>
  selectionMode?: boolean
  selectedNodes?: Set<string>
  onSelectionChange?: (selected: Set<string>, lastSelected: string | null) => void
}

export function NodePool({
  nodes,
  onDeleteNode,
  onEditNode,
  onTestNodes,
  connections = {},
  testingNodes = new Set(),
  selectionMode = false,
  selectedNodes = new Set(),
  onSelectionChange,
}: NodePoolProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: "node-pool",
    data: { isPool: true },
  })

  const [isBatchTesting, setIsBatchTesting] = useState(false)

  const handleBatchTest = useCallback(async () => {
    if (!onTestNodes || nodes.length === 0) return

    setIsBatchTesting(true)
    try {
      await onTestNodes(nodes.map((n) => n.id))
    } finally {
      setIsBatchTesting(false)
    }
  }, [nodes, onTestNodes])

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

  const handleBatchDelete = async () => {
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
      {/* Pool Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-3">
          <Inbox className="h-5 w-5 text-muted-foreground" />
          <div>
            <h3 className="font-semibold">节点池</h3>
            <p className="text-xs text-muted-foreground">未分组的节点</p>
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
                  删除 ({selectedNodes.size})
                </Button>
              )}
            </div>
          ) : (
            <>
              <Badge variant="outline">{nodes.length} 节点</Badge>
              {onTestNodes && nodes.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleBatchTest}
                  disabled={isBatchTesting || testingNodes.size > 0}
                >
                  {isBatchTesting || testingNodes.size > 0 ? (
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  ) : (
                    <Wifi className="h-4 w-4 mr-1" />
                  )}
                  测试连通
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Nodes Grid */}
      <div className="p-4 min-h-[200px]">
        {nodes.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
            <Inbox className="h-12 w-12 mb-2 opacity-50" />
            <p className="text-sm">暂无节点</p>
            <p className="text-xs">添加订阅或手动添加节点</p>
          </div>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {nodes.map((node) => (
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
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
