import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

// 临时调试 API：模拟 share API 的查询
export async function GET(request: NextRequest) {
  try {
    // 获取 shareLink
    const shareLinks = await prisma.shareLink.findMany()
    const shareLink = shareLinks[0]

    if (!shareLink || !shareLink.configId) {
      return NextResponse.json({ error: 'No share link found' })
    }

    // 获取 config
    const config = await prisma.config.findUnique({
      where: { id: shareLink.configId },
    })

    if (!config) {
      return NextResponse.json({ error: 'Config not found' })
    }

    // 解析 nodeMapping
    let nodeMapping: Record<string, unknown> = {}
    try {
      nodeMapping = typeof config.nodeMapping === 'string'
        ? JSON.parse(config.nodeMapping)
        : config.nodeMapping
    } catch (e) {
      return NextResponse.json({ error: 'Failed to parse nodeMapping', detail: String(e) })
    }

    // 提取节点 ID
    const allNodeIds = Object.values(nodeMapping)
      .flat()
      .filter((item): item is string => typeof item === 'string')

    // 查询节点
    const nodes = await prisma.proxyNode.findMany({
      where: {
        id: { in: allNodeIds },
      },
    })

    return NextResponse.json({
      shareLink: { shareId: shareLink.shareId, configId: shareLink.configId, isDynamic: shareLink.isDynamic },
      nodeMapping,
      allNodeIds,
      nodesFound: nodes.length,
      nodes: nodes.map(n => ({ id: n.id, name: n.name })),
    })
  } catch (error: unknown) {
    const err = error as { message?: string; code?: string }
    return NextResponse.json({
      error: 'Query failed',
      message: err.message,
      code: err.code,
    }, { status: 500 })
  }
}
