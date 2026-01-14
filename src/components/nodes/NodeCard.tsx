"use client"

import { useDraggable } from "@dnd-kit/core"
import { CSS } from "@dnd-kit/utilities"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { GripVertical, Server, Trash2 } from "lucide-react"
import type { ProxyNode } from "@/lib/types"
import { Button } from "@/components/ui/button"

interface NodeCardProps {
  node: ProxyNode
  onDelete?: (id: string) => void
}

const typeColors: Record<string, string> = {
  ss: "bg-blue-500/20 text-blue-400",
  vmess: "bg-green-500/20 text-green-400",
  vless: "bg-emerald-500/20 text-emerald-400",
  trojan: "bg-purple-500/20 text-purple-400",
  hysteria: "bg-orange-500/20 text-orange-400",
  hysteria2: "bg-amber-500/20 text-amber-400",
}

export function NodeCard({ node, onDelete }: NodeCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: node.id,
    data: { node },
  })

  const style = {
    transform: CSS.Translate.toString(transform),
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-3 rounded-lg border bg-card p-3 transition-all cursor-pointer",
        isDragging ? "opacity-50 shadow-lg ring-2 ring-primary" : "hover:bg-accent"
      )}
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground"
      >
        <GripVertical className="h-4 w-4" />
      </button>

      <Server className="h-4 w-4 text-muted-foreground" />

      <div className="flex-1 min-w-0">
        <p className="font-medium truncate text-sm">{node.name}</p>
        <p className="text-xs text-muted-foreground truncate">
          {node.server}:{node.port}
        </p>
      </div>

      <Badge
        variant="secondary"
        className={cn("text-xs", typeColors[node.type] || "bg-gray-500/20 text-gray-400")}
      >
        {node.type.toUpperCase()}
      </Badge>

      {onDelete && (
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-destructive"
          onClick={(e) => {
            e.stopPropagation()
            onDelete(node.id)
          }}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      )}
    </div>
  )
}
