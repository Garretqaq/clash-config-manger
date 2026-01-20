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

    const nodes = await prisma.proxyNode.findMany({
      where,
      include: {
        group: true,
        subscription: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    return NextResponse.json(nodes)
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
        config: config || {},
        groupId,
      },
    })

    return NextResponse.json(node, { status: 201 })
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
          config: config || {},
          groupId: groupId || null,
        },
      })

      return NextResponse.json(updatedNode)
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
