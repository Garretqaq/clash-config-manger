import type { Metadata } from "next"
import { Poppins, Inter } from "next/font/google"
import "./globals.css"
import { ToastProvider } from "@/components/layout/ToastProvider"
import { ConfirmProvider } from "@/components/layout/ConfirmProvider"
import { AuthProvider } from "@/contexts/AuthContext"

// Modern Professional font pairing
const poppins = Poppins({ 
  weight: ['400', '500', '600', '700'],
  subsets: ['latin'],
  variable: '--font-heading',
  display: 'swap',
})

const inter = Inter({ 
  subsets: ['latin'],
  variable: '--font-body',
  display: 'swap',
})

export const metadata: Metadata = {
  title: "Clash Config Manager",
  description: "管理和生成 Clash 配置文件",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-CN" suppressHydrationWarning className={`${poppins.variable} ${inter.variable}`}>
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
      <body className={`${inter.className} min-h-screen bg-background`}>
        <AuthProvider>
          <div className="fixed inset-0 z-[-1] bg-dot-pattern opacity-50 pointer-events-none" />
          {children}
          <ToastProvider />
          <ConfirmProvider />
        </AuthProvider>
      </body>
    </html>
  )
}
