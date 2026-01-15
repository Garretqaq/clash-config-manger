import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { createLimiter } from '@/lib/rate-limit'

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for') || 'unknown'
    const rateLimitResult = createLimiter(ip)

    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: '请求过于频繁，请稍后再试' },
        {
          status: 429,
          headers: {
            'X-RateLimit-Remaining': String(rateLimitResult.remaining),
            'X-RateLimit-Reset': String(rateLimitResult.resetTime),
          },
        }
      )
    }

    const body = await request.json()
    const { shareIds } = body

    if (!shareIds || !Array.isArray(shareIds) || shareIds.length === 0) {
      return NextResponse.json({ error: '缺少分享 ID 列表' }, { status: 400 })
    }

    const shareLinks = await prisma.shareLink.findMany({
      where: { shareId: { in: shareIds } },
      select: { id: true },
    })

    const ids = shareLinks.map(link => link.id)

    if (ids.length > 0) {
      await prisma.shareLink.deleteMany({
        where: { id: { in: ids } },
      })
    }

    return NextResponse.json({
      success: true,
      deleted: ids.length,
    })
  } catch (error) {
    console.error('Failed to batch delete share links:', error)
    return NextResponse.json({ error: '批量删除分享链接失败' }, { status: 500 })
  }
}
