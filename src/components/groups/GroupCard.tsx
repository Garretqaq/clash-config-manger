"use client"

import { useDroppable } from "@dnd-kit/core"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Folder, MoreVertical, Trash2 } from "lucide-react"
import type { Group, ProxyNode } from "@/lib/types"
import { NodeCard } from "@/components/nodes/NodeCard"

interface GroupCardProps {
  group: Group
  nodes: ProxyNode[]
  onDeleteGroup?: (id: string) => void
  onDeleteNode?: (id: string) => void
}

export function GroupCard({ group, nodes, onDeleteGroup, onDeleteNode }: GroupCardProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: `group-${group.id}`,
    data: { group },
  })

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
          <Badge variant="outline">{nodes.length} 节点</Badge>
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
            <NodeCard key={node.id} node={node} onDelete={onDeleteNode} />
          ))
        )}
      </div>
    </div>
  )
}
