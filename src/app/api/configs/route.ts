import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { ClashGenerator } from '@/lib/clash-generator'

// GET /api/configs - 获取所有配置
export async function GET() {
  try {
    const configs = await prisma.config.findMany({
      orderBy: {
        createdAt: 'desc',
      },
    })

    return NextResponse.json(configs)
  } catch (error) {
    console.error('获取配置失败:', error)
    return NextResponse.json({ error: '获取配置失败' }, { status: 500 })
  }
}

// POST /api/configs - 生成配置
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, templateId, nodeMapping } = body

    // 获取模板
    const template = await prisma.template.findUnique({
      where: { id: templateId },
    })

    if (!template) {
      return NextResponse.json({ error: '模板不存在' }, { status: 404 })
    }

    // 获取所有选中的节点
    const allNodeIds = Object.values(nodeMapping as Record<string, string[]>).flat()
    const nodes = await prisma.proxyNode.findMany({
      where: {
        id: { in: allNodeIds },
      },
    })

    // 转换节点格式
    const proxies = ClashGenerator.generateProxies(
      nodes.map((node) => ({
        name: node.name,
        type: node.type,
        server: node.server,
        port: node.port,
        config: node.config as Record<string, unknown>,
      }))
    )

    // 构建节点名称映射
    const nodeNameMapping: Record<string, string[]> = {}
    for (const [groupName, nodeIds] of Object.entries(nodeMapping as Record<string, string[]>)) {
      nodeNameMapping[groupName] = nodeIds
        .map((id) => nodes.find((n) => n.id === id)?.name)
        .filter(Boolean) as string[]
    }

    // 生成配置
    const content = ClashGenerator.generate({
      template: template.content,
      proxies,
      nodeMapping: nodeNameMapping,
    })

    const config = await prisma.config.create({
      data: {
        name,
        templateId,
        nodeMapping,
        content,
      },
    })

    return NextResponse.json(config, { status: 201 })
  } catch (error) {
    console.error('生成配置失败:', error)
    return NextResponse.json({ error: '生成配置失败' }, { status: 500 })
  }
}

// DELETE /api/configs - 删除配置
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: '缺少配置 ID' }, { status: 400 })
    }

    await prisma.config.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('删除配置失败:', error)
    return NextResponse.json({ error: '删除配置失败' }, { status: 500 })
  }
}
