"use client"

import { useConfirmDialog } from "@/components/ui/confirm-dialog"

export function ConfirmProvider() {
  const { ConfirmDialog } = useConfirmDialog()
  return ConfirmDialog
}
