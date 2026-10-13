"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

export interface CheckboxProps extends React.InputHTMLAttributes<HTMLInputElement> {}

const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, ...props }, ref) => {
    return (
      <input
        type="checkbox"
        className={cn(
        // appearance-none 关掉浏览器原生勾选框：否则原生蓝底勾号会和下面的圆角/描边叠成"双框"。
        // 勾号是自绘的（tailwind.config.ts 的 backgroundImage.check），焦点态统一用 focus-visible，
        // 鼠标点击不再留下高亮描边，键盘 Tab 仍有 indigo ring。
        "h-4 w-4 shrink-0 cursor-pointer appearance-none rounded-[4px] border border-input bg-background",
        "transition-colors duration-150 hover:border-primary/50",
        "checked:border-primary checked:bg-primary checked:hover:border-primary",
        "checked:bg-check checked:bg-[length:0.625rem_0.625rem] checked:bg-center checked:bg-no-repeat",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Checkbox.displayName = "Checkbox"

export { Checkbox }
