"use client"

import React, { useCallback, useRef, useState } from "react"
import { cn } from "@/lib/utils"
import { GripHorizontal } from "lucide-react"

interface ResizablePanelProps {
  width: number
  minWidth?: number
  maxWidth?: number
  onWidthChange: (width: number) => void
  children: React.ReactNode
}

export function ResizablePanel({
  width,
  minWidth = 200,
  maxWidth = 400,
  onWidthChange,
  children,
}: ResizablePanelProps) {
  const [isResizing, setIsResizing] = useState(false)
  const [isHovered, setIsHovered] = useState(false)
  const startXRef = useRef<number>(0)
  const startWidthRef = useRef<number>(0)

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      setIsResizing(true)
      startXRef.current = e.clientX
      startWidthRef.current = width

      // 添加全局事件监听
      const handleMouseMove = (moveEvent: MouseEvent) => {
        const deltaX = moveEvent.clientX - startXRef.current
        const newWidth = startWidthRef.current + deltaX
        const clampedWidth = Math.min(Math.max(newWidth, minWidth), maxWidth)
        onWidthChange(clampedWidth)
      }

      const handleMouseUp = () => {
        setIsResizing(false)
        document.removeEventListener("mousemove", handleMouseMove)
        document.removeEventListener("mouseup", handleMouseUp)
        document.body.style.cursor = ""
        document.body.style.userSelect = ""
      }

      document.addEventListener("mousemove", handleMouseMove)
      document.addEventListener("mouseup", handleMouseUp)
      document.body.style.cursor = "col-resize"
      document.body.style.userSelect = "none"
    },
    [width, minWidth, maxWidth, onWidthChange]
  )

  return (
    <div className="relative" style={{ width }}>
      {/* 拖拽手柄区域 */}
      <div
        className={cn(
          "absolute right-0 top-0 bottom-0 w-4 -mr-2 cursor-col-resize z-10",
          "flex items-center justify-center select-none",
          "transition-colors duration-200",
          isHovered && !isResizing && "bg-primary/10 rounded-md",
          isResizing && "bg-primary/20"
        )}
        onMouseDown={handleMouseDown}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* 拖拽指示器 - 始终显示但悬停时更明显 */}
        <div
          className={cn(
            "flex flex-col gap-0.5 transition-all duration-200",
            isHovered || isResizing ? "opacity-100 scale-110" : "opacity-40"
          )}
        >
          <GripHorizontal className="h-3 w-4 text-muted-foreground" />
          <GripHorizontal className="h-3 w-4 text-muted-foreground" />
          <GripHorizontal className="h-3 w-4 text-muted-foreground" />
        </div>
      </div>

      {/* 子内容 */}
      <div className={cn("h-full pr-2", isResizing && "select-none")}>
        {children}
      </div>
    </div>
  )
}
