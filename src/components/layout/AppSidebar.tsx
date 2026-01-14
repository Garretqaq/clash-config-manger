"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import {
  Network,
  Rss,
  FileCode2,
  Settings2,
  LayoutDashboard,
  FileText
} from "lucide-react"
import { ThemeToggle } from "./ThemeToggle"

const menuItems = [
  {
    title: "节点管理",
    href: "/nodes",
    icon: Network,
  },
  {
    title: "订阅管理",
    href: "/subscriptions",
    icon: Rss,
  },
  {
    title: "模板管理",
    href: "/templates",
    icon: FileCode2,
  },
  {
    title: "配置生成",
    href: "/configs",
    icon: Settings2,
  },
  {
    title: "配置管理",
    href: "/generated-configs",
    icon: FileText,
  },
]

export function AppSidebar() {
  const pathname = usePathname()

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-64 border-r bg-card">
      <div className="flex h-full flex-col">
        {/* Logo */}
        <div className="flex h-16 items-center gap-2 border-b px-6">
          <LayoutDashboard className="h-6 w-6 text-primary" />
          <span className="font-heading text-lg font-semibold">
            Clash Manager
          </span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 p-4">
          {menuItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/")
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors cursor-pointer",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.title}
              </Link>
            )
          })}
        </nav>

        {/* Footer */}
        <div className="border-t p-4 flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            v1.0
          </p>
          <ThemeToggle />
        </div>
      </div>
    </aside>
  )
}
