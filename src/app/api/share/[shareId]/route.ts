import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { publicLimiter } from '@/lib/rate-limit'

// GET /api/share/[shareId] - Get share link content (requires token)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ shareId: string }> }
) {
  try {
    const { shareId } = await params

    // Rate limiting
    const ip = request.headers.get('x-forwarded-for') || 'unknown'
    const rateLimitResult = publicLimiter(ip)

    if (!rateLimitResult.success) {
      return new NextResponse('请求过于频繁，请稍后再试', {
        status: 429,
        headers: {
          'X-RateLimit-Remaining': String(rateLimitResult.remaining),
          'X-RateLimit-Reset': String(rateLimitResult.resetTime),
        },
      })
    }

    // Get token from query params
    const token = request.nextUrl.searchParams.get('token')

    if (!token) {
      return new NextResponse('缺少访问令牌', { status: 401 })
    }

    // Find share link
    const shareLink = await prisma.shareLink.findUnique({
      where: { shareId },
    })

    if (!shareLink) {
      return new NextResponse('分享链接不存在', { status: 404 })
    }

    // Verify token
    if (token !== shareLink.accessToken) {
      return new NextResponse('访问令牌无效', { status: 403 })
    }

    // Check if expired
    if (shareLink.expiresAt && new Date() > shareLink.expiresAt) {
      // Clean up expired link
      await prisma.shareLink.delete({ where: { id: shareLink.id } })
      return new NextResponse('分享链接已过期', { status: 410 })
    }

    // Increment view count
    await prisma.shareLink.update({
      where: { id: shareLink.id },
      data: { views: { increment: 1 } },
    })

    // Return raw YAML content
    return new NextResponse(shareLink.configContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Content-Disposition': `attachment; filename=${(shareLink.configName || 'config').replace(/[^a-zA-Z0-9_-]/g, '_')}.yaml`,
      },
    })
  } catch (error) {
    console.error('Failed to get share link:', error)
    return new NextResponse('获取分享配置失败', { status: 500 })
  }
}
