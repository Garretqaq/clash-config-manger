"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"

type Theme = "light" | "dark" | "system"

interface ThemeStore {
  theme: Theme
  setTheme: (theme: Theme) => void
}

export const useThemeStore = create<ThemeStore>()(
  persist(
    (set) => ({
      theme: "system",
      setTheme: (theme) => set({ theme }),
    }),
    {
      name: "theme-storage",
    }
  )
)

export function useTheme() {
  const { theme, setTheme } = useThemeStore()

  const applyTheme = (newTheme: Theme) => {
    const root = document.documentElement
    const systemTheme = window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light"
    const resolvedTheme = newTheme === "system" ? systemTheme : newTheme

    root.classList.remove("light", "dark")
    root.classList.add(resolvedTheme)
    setTheme(newTheme)
  }

  return { theme, setTheme: applyTheme }
}
