"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

// Context to pass value/onValueChange down from Select to SelectTrigger
interface SelectContextValue {
  value?: string
  onValueChange?: (value: string) => void
  children?: React.ReactNode // SelectContent children (options)
}
const SelectContext = React.createContext<SelectContextValue>({})

interface SelectProps {
  value?: string
  onValueChange?: (value: string) => void
  children?: React.ReactNode
}

function Select({ value, onValueChange, children }: SelectProps) {
  // Separate SelectTrigger and SelectContent children
  let triggerChild: React.ReactNode = null
  let contentChild: React.ReactNode = null
  React.Children.forEach(children, (child) => {
    if (!React.isValidElement(child)) return
    const type = child.type as { displayName?: string }
    if (type.displayName === "SelectTrigger") triggerChild = child
    if (type.displayName === "SelectContent") contentChild = child
  })

  return (
    <SelectContext.Provider value={{ value, onValueChange, children: contentChild }}>
      {triggerChild}
    </SelectContext.Provider>
  )
}

const SelectTrigger = React.forwardRef<
  HTMLSelectElement,
  React.HTMLAttributes<HTMLSelectElement> & { id?: string }
>(({ className, id }, ref) => {
  const { value, onValueChange, children } = React.useContext(SelectContext)
  // Extract <option> elements from SelectContent > SelectItem
  const options: React.ReactNode[] = []
  if (React.isValidElement(children)) {
    const content = children as React.ReactElement<{ children?: React.ReactNode }>
    React.Children.forEach(content.props.children, (opt) => {
      options.push(opt)
    })
  }

  return (
    <select
      ref={ref}
      id={id}
      value={value ?? ""}
      onChange={(e) => onValueChange?.(e.target.value)}
      className={cn(
        "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
    >
      {options}
    </select>
  )
})
SelectTrigger.displayName = "SelectTrigger"

const SelectContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ children }, ref) => <div ref={ref} style={{ display: "none" }}>{children}</div>
)
SelectContent.displayName = "SelectContent"

const SelectItem = React.forwardRef<HTMLOptionElement, React.OptionHTMLAttributes<HTMLOptionElement>>(
  ({ className, children, ...props }, ref) => (
    <option ref={ref} {...props}>{children}</option>
  )
)
SelectItem.displayName = "SelectItem"

const SelectValue = React.forwardRef<HTMLSpanElement, React.HTMLAttributes<HTMLSpanElement> & { placeholder?: string }>(
  (_props, _ref) => null // rendered inside select natively; no-op
)
SelectValue.displayName = "SelectValue"

export { Select, SelectContent, SelectItem, SelectTrigger, SelectValue }
