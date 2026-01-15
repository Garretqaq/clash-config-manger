import { notFound } from "next/navigation"
import { prisma } from "@/lib/db"
import { ConfigViewer } from "@/components/share/ConfigViewer"

interface PageProps {
  params: Promise<{ shareId: string }>
}

export default async function SharePage({ params }: PageProps) {
  const { shareId } = await params

  // Get share info without content
  const shareLink = await prisma.shareLink.findUnique({
    where: { shareId },
    select: {
      id: true,
      configName: true,
      description: true,
      expiresAt: true,
      createdAt: true,
    },
  })

  if (!shareLink) {
    notFound()
  }

  // Check expiry
  if (shareLink.expiresAt && new Date() > shareLink.expiresAt) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/50">
        <div className="text-center p-8">
          <h1 className="text-2xl font-bold text-destructive mb-2">链接已过期</h1>
          <p className="text-muted-foreground">此分享链接已过期，无法继续访问</p>
        </div>
      </div>
    )
  }

  return <ConfigViewer shareId={shareId} initialConfigName={shareLink.configName || "未命名配置"} />
}
