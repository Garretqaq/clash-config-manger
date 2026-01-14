import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { prisma } from '@/lib/db'
import { nanoid } from 'nanoid'
import { createLimiter } from '@/lib/rate-limit'

// Generate access token from password
function generateAccessToken(shareId: string, password: string): string {
  return crypto
    .createHmac('sha256', shareId)
    .update(password)
    .digest('hex')
}

// GET /api/share - List all share links with search and filter
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const q = searchParams.get('q') || ''
    const status = searchParams.get('status') || 'all'

    // Build where clause
    const where: any = {}

    // Search filter (configName or description)
    if (q) {
      where.OR = [
        { configName: { contains: q } },
        { description: { contains: q } },
      ]
    }

    // Status filter
    if (status === 'active') {
      where.expiresAt = { gt: new Date() }
    } else if (status === 'expired') {
      where.expiresAt = { lte: new Date() }
    }

    const shareLinks = await prisma.shareLink.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        shareId: true,
        accessToken: true,
        configName: true,
        description: true,
        expiresAt: true,
        views: true,
        createdAt: true,
      },
    })

    // Add status field based on expiresAt
    const linksWithStatus = shareLinks.map(link => ({
      ...link,
      status: link.expiresAt && new Date(link.expiresAt) < new Date() ? 'expired' : 'active',
    }))

    return NextResponse.json(linksWithStatus)
  } catch (error) {
    console.error('Failed to list share links:', error)
    return NextResponse.json({ error: '获取分享列表失败' }, { status: 500 })
  }
}

// POST /api/share - Create a new share link (public)
export async function POST(request: NextRequest) {
  // Rate limiting
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

  try {
    const body = await request.json()
    const { configId, configName, configContent, description, expiresIn } = body

    // Validate required fields
    if (!configContent) {
      return NextResponse.json({ error: '配置内容不能为空' }, { status: 400 })
    }

    // Generate share ID and token
    const shareId = nanoid(12)
    const accessToken = nanoid(32)

    // Calculate expiry time
    let expiresAt: Date | null = null
    if (expiresIn && expiresIn !== 'never') {
      const now = new Date()
      switch (expiresIn) {
        case '1h':
          expiresAt = new Date(now.getTime() + 60 * 60 * 1000)
          break
        case '1d':
          expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000)
          break
        case '7d':
          expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
          break
        case '30d':
          expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
          break
      }
    }

    // Create share link with token
    const shareLink = await prisma.shareLink.create({
      data: {
        shareId,
        accessToken,
        configId: configId || null,
        configName: configName || '未命名配置',
        configContent,
        description,
        expiresAt,
      },
    })

    // Generate share URL with token
    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
    const shareUrl = `${baseUrl}/api/share/${shareId}?token=${accessToken}`

    return NextResponse.json({
      id: shareLink.id,
      shareId: shareLink.shareId,
      shareUrl,
      token: accessToken,
      expiresAt: shareLink.expiresAt,
      createdAt: shareLink.createdAt,
    }, { status: 201 })
  } catch (error) {
    console.error('Failed to create share link:', error)
    return NextResponse.json({ error: '创建分享链接失败' }, { status: 500 })
  }
}

// DELETE /api/share - Delete a share link
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const shareId = searchParams.get('shareId')

    if (!shareId) {
      return NextResponse.json({ error: '缺少分享 ID' }, { status: 400 })
    }

    const shareLink = await prisma.shareLink.findUnique({
      where: { shareId },
    })

    if (!shareLink) {
      return NextResponse.json({ error: '分享链接不存在' }, { status: 404 })
    }

    await prisma.shareLink.delete({ where: { id: shareLink.id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete share link:', error)
    return NextResponse.json({ error: '删除分享链接失败' }, { status: 500 })
  }
}

// POST /api/share/batch-delete - Batch delete share links
export async function batchDeleteShareLinks(request: NextRequest) {
  try {
    const body = await request.json()
    const { shareIds } = body

    if (!shareIds || !Array.isArray(shareIds) || shareIds.length === 0) {
      return NextResponse.json({ error: '缺少分享 ID 列表' }, { status: 400 })
    }

    // Find share links by shareId
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
