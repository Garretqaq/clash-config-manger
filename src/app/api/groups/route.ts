import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

// GET /api/groups - 获取所有分组
export async function GET() {
  try {
    const groups = await prisma.group.findMany({
      include: {
        nodes: true,
      },
      orderBy: {
        sortOrder: 'asc',
      },
    })

    return NextResponse.json(groups)
  } catch (error) {
    console.error('获取分组失败:', error)
    return NextResponse.json({ error: '获取分组失败' }, { status: 500 })
  }
}

// POST /api/groups - 创建分组
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, type = 'select' } = body

    const maxOrder = await prisma.group.aggregate({
      _max: { sortOrder: true },
    })

    const group = await prisma.group.create({
      data: {
        name,
        type,
        sortOrder: (maxOrder._max.sortOrder || 0) + 1,
      },
    })

    return NextResponse.json(group, { status: 201 })
  } catch (error) {
    console.error('创建分组失败:', error)
    return NextResponse.json({ error: '创建分组失败' }, { status: 500 })
  }
}

// PUT /api/groups - 更新分组
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, name, type } = body

    const group = await prisma.group.update({
      where: { id },
      data: { name, type },
    })

    return NextResponse.json(group)
  } catch (error) {
    console.error('更新分组失败:', error)
    return NextResponse.json({ error: '更新分组失败' }, { status: 500 })
  }
}

// DELETE /api/groups - 删除分组
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: '缺少分组 ID' }, { status: 400 })
    }

    // 先将该分组下的节点移出分组
    await prisma.proxyNode.updateMany({
      where: { groupId: id },
      data: { groupId: null },
    })

    await prisma.group.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('删除分组失败:', error)
    return NextResponse.json({ error: '删除分组失败' }, { status: 500 })
  }
}
