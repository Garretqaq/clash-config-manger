import type { Metadata } from "next"
import "./globals.css"
import { AppSidebar } from "@/components/layout/AppSidebar"
import { ToastProvider } from "@/components/layout/ToastProvider"
import { ConfirmProvider } from "@/components/layout/ConfirmProvider"

export const metadata: Metadata = {
  title: "Clash Config Manager",
  description: "管理和生成 Clash 配置文件",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var stored = localStorage.getItem('theme-storage');
                  var theme = 'dark';
                  if (stored) {
                    var parsed = JSON.parse(stored);
                    theme = parsed.state?.theme || 'dark';
                  }
                  if (theme === 'system') {
                    theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
                  }
                  document.documentElement.classList.add(theme);
                } catch (e) {
                  document.documentElement.classList.add('dark');
                }
              })();
            `,
          }}
        />
      </head>
      <body>
        <div className="flex min-h-screen">
          <AppSidebar />
          <main className="flex-1 ml-64 p-8">
            {children}
          </main>
        </div>
        <ToastProvider />
        <ConfirmProvider />
      </body>
    </html>
  )
}
