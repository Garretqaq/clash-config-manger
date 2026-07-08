import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

// Mark as dynamic route
export const dynamic = "force-dynamic";

// GET /api/nodes - 获取所有节点
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const groupId = searchParams.get('groupId')
    const pool = searchParams.get('pool') // pool=true 获取未分组节点

    const where: Record<string, unknown> = {}

    if (pool === 'true') {
      where.groupId = null
    } else if (groupId) {
      where.groupId = groupId
    }

    // ponytail: 不 include group/subscription —— 前端只用 groupId/subscriptionId 标量。
    // include subscription 会把订阅完整 yamlContent 复制进每个节点，网络传输爆炸。
    const nodes = await prisma.proxyNode.findMany({
      where,
      orderBy: {
        createdAt: 'desc',
      },
    })

    // 将 config 字符串解析为对象
    const nodesWithConfig = nodes.map((node) => ({
      ...node,
      config: typeof node.config === 'string' ? JSON.parse(node.config) : node.config,
    }))

    return NextResponse.json(nodesWithConfig)
  } catch (error) {
    console.error('获取节点失败:', error)
    return NextResponse.json({ error: '获取节点失败' }, { status: 500 })
  }
}

// POST /api/nodes - 创建节点
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, type, server, port, config, groupId } = body

    const node = await prisma.proxyNode.create({
      data: {
        name,
        type,
        server,
        port,
        config: typeof config === 'string' ? config : JSON.stringify(config || {}),
        groupId,
      },
    })

    return NextResponse.json({
      ...node,
      config: typeof node.config === 'string' ? JSON.parse(node.config) : node.config,
    }, { status: 201 })
  } catch (error) {
    console.error('创建节点失败:', error)
    return NextResponse.json({ error: '创建节点失败' }, { status: 500 })
  }
}

// PUT /api/nodes - 更新节点（支持单个节点完整更新和批量分组更新）
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    
    // 判断是批量更新分组还是单个节点完整更新
    if (body.nodeIds) {
      // 批量更新分组（拖拽功能）
      const { nodeIds, groupId } = body
      
      await prisma.proxyNode.updateMany({
        where: {
          id: { in: nodeIds },
        },
        data: {
          groupId,
        },
      })

      return NextResponse.json({ success: true })
    } else if (body.id) {
      // 单个节点完整更新（编辑功能）
      const { id, name, type, server, port, config, groupId } = body
      
      const updatedNode = await prisma.proxyNode.update({
        where: {
          id,
        },
        data: {
          name,
          type,
          server,
          port,
          config: typeof config === 'string' ? config : JSON.stringify(config || {}),
          groupId: groupId || null,
        },
      })

      return NextResponse.json({
        ...updatedNode,
        config: typeof updatedNode.config === 'string' ? JSON.parse(updatedNode.config) : updatedNode.config,
      })
    } else {
      return NextResponse.json({ error: '无效的请求参数' }, { status: 400 })
    }
  } catch (error) {
    console.error('更新节点失败:', error)
    return NextResponse.json({ error: '更新节点失败' }, { status: 500 })
  }
}

// DELETE /api/nodes - 批量删除节点
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const ids = searchParams.get('ids')

    if (!ids) {
      return NextResponse.json({ error: '缺少节点 ID' }, { status: 400 })
    }

    const nodeIds = ids.split(',')

    await prisma.proxyNode.deleteMany({
      where: {
        id: { in: nodeIds },
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('删除节点失败:', error)
    return NextResponse.json({ error: '删除节点失败' }, { status: 500 })
  }
}
