"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import {
  Network,
  Rss,
  FileCode2,
  Settings2,
  LayoutDashboard,
  FileText,
  Share2,
  LogOut,
  User,
  ChevronRight,
} from "lucide-react"
import { ThemeToggle } from "./ThemeToggle"
import { useAuth } from "@/contexts/AuthContext"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

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
  {
    title: "分享管理",
    href: "/shares",
    icon: Share2,
  },
]

export function AppSidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { isAuthenticated, user, logout } = useAuth()

  const handleLogout = async () => {
    await logout()
    router.replace("/login")
  }

  // Don't render sidebar on login page
  if (pathname === "/login") {
    return null
  }

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-64 border-r bg-card/80 backdrop-blur-xl">
      <div className="flex h-full flex-col">
        {/* Logo Section */}
        <div className="flex h-16 items-center gap-3 border-b px-6">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <LayoutDashboard className="h-5 w-5" />
          </div>
          <span className="font-heading text-lg font-semibold tracking-tight text-foreground">
            Clash Manager
          </span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 p-4 overflow-y-auto">
          <div className="px-2 py-2">
            <h4 className="mb-2 px-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
              Platform
            </h4>
            <div className="space-y-1">
              {menuItems.map((item) => {
                const isActive = pathname === item.href || pathname.startsWith(item.href + "/")
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "group flex items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200 ease-in-out",
                      isActive
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <item.icon className={cn("h-4 w-4 transition-colors", isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground")} />
                      {item.title}
                    </div>
                    {isActive && (
                      <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                    )}
                  </Link>
                )
              })}
            </div>
          </div>
        </nav>

        {/* User Footer */}
        <div className="border-t p-4">
          <div className="flex items-center justify-between gap-2 rounded-xl border bg-background/50 p-2 shadow-sm">
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <User className="h-4 w-4 text-primary" />
              </div>
              <div className="flex flex-col overflow-hidden">
                <span className="truncate text-sm font-medium text-foreground">
                  {user?.username || 'User'}
                </span>
                <span className="truncate text-xs text-muted-foreground">
                  Online
                </span>
              </div>
            </div>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-muted">
                  <Settings2 className="h-4 w-4 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel>My Account</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="cursor-pointer">
                  Profile
                </DropdownMenuItem>
                <DropdownMenuItem className="cursor-pointer">
                  Settings
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  className="cursor-pointer text-destructive focus:text-destructive"
                  onClick={handleLogout}
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          
          <div className="mt-4 flex items-center justify-between px-2">
             <span className="text-xs text-muted-foreground font-mono opacity-50">v1.0.0</span>
             <ThemeToggle />
          </div>
        </div>
      </div>
    </aside>
  )
}
