"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { X } from "lucide-react"

interface ConfirmDialogProps {
  open: boolean
  title: string
  description: string
  confirmText?: string
  cancelText?: string
  variant?: "default" | "destructive"
  onConfirm: () => void
  onCancel: () => void
}

function ConfirmDialogInner({
  open,
  title,
  description,
  confirmText = "确定",
  cancelText = "取消",
  variant = "default",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open) return null

  // ESC key to close
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel()
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [onCancel])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onCancel}
      />

      {/* Dialog */}
      <div className="relative z-10 w-full max-w-sm rounded-lg bg-background border shadow-lg animate-in zoom-in-95">
        <div className="flex flex-col space-y-1.5 p-6">
          <div className="flex items-start justify-between">
            <h3 className="text-lg font-semibold">{title}</h3>
            <button
              onClick={onCancel}
              className="rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        <div className="flex items-center justify-end space-x-2 p-4 pt-0">
          <button
            onClick={onCancel}
            className={cn(
              "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors",
              "h-9 px-4 py-2",
              "bg-secondary text-secondary-foreground hover:bg-secondary/80"
            )}
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            className={cn(
              "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors",
              "h-9 px-4 py-2",
              variant === "destructive"
                ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                : "bg-primary text-primary-foreground hover:bg-primary/90"
            )}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}

// Global state
type ConfirmState = {
  id: number
  title: string
  description: string
  confirmText?: string
  cancelText?: string
  variant?: "default" | "destructive"
  resolve: (value: boolean) => void
} | null

let confirmState: ConfirmState = null
let listeners: ((state: ConfirmState) => void)[] = []

function notifyListeners() {
  listeners.forEach((listener) => listener(confirmState))
}

function setConfirmState(state: ConfirmState) {
  confirmState = state
  notifyListeners()
}

export function setConfirmCallback(callback: (state: ConfirmState) => void) {
  // This is kept for compatibility but not used
}

export function showConfirm(config: {
  title: string
  description: string
  confirmText?: string
  cancelText?: string
  variant?: "default" | "destructive"
}): Promise<boolean> {
  return new Promise((resolve) => {
    setConfirmState({
      id: Date.now(),
      title: config.title,
      description: config.description,
      confirmText: config.confirmText,
      cancelText: config.cancelText,
      variant: config.variant,
      resolve,
    })
  })
}

// Hook to use confirm dialog
export function useConfirmDialog() {
  const [state, setState] = React.useState<ConfirmState>(null)

  React.useEffect(() => {
    const listener = (newState: ConfirmState) => {
      setState(newState)
    }
    listeners.push(listener)
    return () => {
      listeners = listeners.filter((l) => l !== listener)
    }
  }, [])

  const confirm = React.useCallback(
    (options: {
      title: string
      description: string
      confirmText?: string
      cancelText?: string
      variant?: "default" | "destructive"
    }): Promise<boolean> => {
      return new Promise((resolve) => {
        setConfirmState({
          id: Date.now(),
          title: options.title,
          description: options.description,
          confirmText: options.confirmText,
          cancelText: options.cancelText,
          variant: options.variant,
          resolve,
        })
      })
    },
    []
  )

  const handleConfirm = React.useCallback(() => {
    if (state) {
      state.resolve(true)
      setConfirmState(null)
    }
  }, [state])

  const handleCancel = React.useCallback(() => {
    if (state) {
      state.resolve(false)
      setConfirmState(null)
    }
  }, [state])

  return {
    confirm,
    ConfirmDialog: state ? (
      <ConfirmDialogInner
        open={!!state}
        title={state.title}
        description={state.description}
        confirmText={state.confirmText}
        cancelText={state.cancelText}
        variant={state.variant}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    ) : null,
  }
}

// Provider component
export function ConfirmProvider() {
  const [state, setState] = React.useState<ConfirmState>(null)

  React.useEffect(() => {
    const listener = (newState: ConfirmState) => {
      setState(newState)
    }
    listeners.push(listener)
    return () => {
      listeners = listeners.filter((l) => l !== listener)
    }
  }, [])

  const handleConfirm = React.useCallback(() => {
    if (state) {
      state.resolve(true)
      setConfirmState(null)
    }
  }, [state])

  const handleCancel = React.useCallback(() => {
    if (state) {
      state.resolve(false)
      setConfirmState(null)
    }
  }, [state])

  if (!state) return null

  return (
    <ConfirmDialogInner
      open={!!state}
      title={state.title}
      description={state.description}
      confirmText={state.confirmText}
      cancelText={state.cancelText}
      variant={state.variant}
      onConfirm={handleConfirm}
      onCancel={handleCancel}
    />
  )
}
