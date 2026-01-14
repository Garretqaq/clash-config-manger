"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

interface ToastProps {
  title?: string
  description?: string
  variant?: "default" | "success" | "destructive"
  onClose?: () => void
}

function Toast({ title, description, variant = "default", onClose }: ToastProps) {
  React.useEffect(() => {
    const timer = setTimeout(() => {
      onClose?.()
    }, 3000)
    return () => clearTimeout(timer)
  }, [onClose])

  const variants = {
    default: "bg-background text-foreground border",
    success: "bg-green-500/90 text-white border-green-600",
    destructive: "bg-destructive/90 text-destructive-foreground border-destructive",
  }

  return (
    <div
      className={cn(
        "fixed bottom-4 right-4 z-50 w-80 rounded-lg p-4 shadow-lg animate-in slide-in-from-bottom-5",
        variants[variant]
      )}
    >
      {title && <p className="font-medium">{title}</p>}
      {description && <p className="text-sm opacity-90 mt-1">{description}</p>}
    </div>
  )
}

// Toast 管理器
let toastCallback: ((props: ToastProps) => void) | null = null

export function setToastCallback(callback: (props: ToastProps) => void) {
  toastCallback = callback
}

export function showToast(props: ToastProps) {
  toastCallback?.(props)
}

export function ToastContainer() {
  const [toasts, setToasts] = React.useState<Array<ToastProps & { id: number }>>([])

  React.useEffect(() => {
    setToastCallback((props) => {
      const id = Date.now()
      setToasts((prev) => [...prev, { ...props, id }])
    })
  }, [])

  const removeToast = (id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }

  return (
    <>
      {toasts.map((toast) => (
        <Toast
          key={toast.id}
          {...toast}
          onClose={() => removeToast(toast.id)}
        />
      ))}
    </>
  )
}
