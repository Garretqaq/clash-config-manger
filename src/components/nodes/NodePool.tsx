"use client"

import { useDroppable } from "@dnd-kit/core"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Inbox } from "lucide-react"
import type { ProxyNode } from "@/lib/types"
import { NodeCard } from "./NodeCard"

interface NodePoolProps {
  nodes: ProxyNode[]
  onDeleteNode?: (id: string) => void
}

export function NodePool({ nodes, onDeleteNode }: NodePoolProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: "node-pool",
    data: { isPool: true },
  })

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
        <Badge variant="outline">{nodes.length} 节点</Badge>
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
              <NodeCard key={node.id} node={node} onDelete={onDeleteNode} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
