import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { batchTestNodes } from '@/lib/services/connectivity'

// POST /api/nodes/test - 测试节点连通性
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { nodeIds, options } = body

    if (!nodeIds || !Array.isArray(nodeIds) || nodeIds.length === 0) {
      return NextResponse.json(
        { error: '请提供要测试的节点 ID 列表' },
        { status: 400 }
      )
    }

    // 获取节点数据
    const nodes = await prisma.proxyNode.findMany({
      where: { id: { in: nodeIds } },
    })

    if (nodes.length === 0) {
      return NextResponse.json(
        { error: '未找到指定的节点' },
        { status: 404 }
      )
    }

    // 执行批量测试
    const nodeData = nodes.map((node) => ({
      id: node.id,
      type: node.type,
      server: node.server,
      port: node.port,
      config: node.config as Record<string, unknown>,
    }))

    const results = await batchTestNodes(nodeData, {
      concurrency: options?.concurrency ?? 5,
      timeout: options?.timeout ?? 3000,
    })

    return NextResponse.json({
      success: true,
      results,
      timestamp: new Date(),
    })
  } catch (error) {
    console.error('节点测试失败:', error)
    return NextResponse.json(
      { error: '测试失败' },
      { status: 500 }
    )
  }
}
