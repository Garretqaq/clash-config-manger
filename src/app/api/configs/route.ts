import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { ClashGenerator } from '@/lib/clash-generator'

// Mark as dynamic route
export const dynamic = "force-dynamic";

// GET /api/configs - 获取所有配置或单个配置
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (id) {
      // 获取单个配置
      const config = await prisma.config.findUnique({
        where: { id },
      })

      if (!config) {
        return NextResponse.json({ error: '配置不存在' }, { status: 404 })
      }

      // 解析 nodeMapping 字符串为对象
      return NextResponse.json({
        ...config,
        nodeMapping: typeof config.nodeMapping === 'string' ? JSON.parse(config.nodeMapping) : config.nodeMapping,
      })
    }

    // 获取所有配置
    const configs = await prisma.config.findMany({
      orderBy: {
        createdAt: 'desc',
      },
    })

    // 解析所有配置的 nodeMapping 字符串为对象
    const configsWithMapping = configs.map((config) => ({
      ...config,
      nodeMapping: typeof config.nodeMapping === 'string' ? JSON.parse(config.nodeMapping) : config.nodeMapping,
    }))

    return NextResponse.json(configsWithMapping)
  } catch (error) {
    console.error('获取配置失败:', error)
    return NextResponse.json({ error: '获取配置失败' }, { status: 500 })
  }
}

// 生成"副本"名称：剥离已有的 " 副本"/" 副本 N" 后缀得到基础名，
// 再在同基础名的副本中找最大序号并 +1
async function generateDuplicateName(originalName: string): Promise<string> {
  const baseName = originalName.replace(/\s副本(\s\d+)?$/, '')

  const existing = await prisma.config.findMany({
    where: {
      name: {
        startsWith: `${baseName} 副本`,
      },
    },
    select: { name: true },
  })

  const suffixPattern = new RegExp(`^${baseName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} 副本(?: (\\d+))?$`)
  let maxN = 0
  for (const { name: existingName } of existing) {
    const match = existingName.match(suffixPattern)
    if (match) {
      maxN = Math.max(maxN, match[1] ? parseInt(match[1], 10) : 1)
    }
  }

  return maxN === 0 ? `${baseName} 副本` : `${baseName} 副本 ${maxN + 1}`
}

// POST /api/configs - 生成配置，或复制已有配置（body 携带 duplicateFromId）
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // 复制已有配置：直接克隆存储字段，不重新走模板生成逻辑
    if (body.duplicateFromId) {
      const original = await prisma.config.findUnique({
        where: { id: body.duplicateFromId },
      })

      if (!original) {
        return NextResponse.json({ error: '配置不存在' }, { status: 404 })
      }

      const newName = await generateDuplicateName(original.name)

      const duplicated = await prisma.config.create({
        data: {
          name: newName,
          templateId: original.templateId,
          nodeMapping: original.nodeMapping,
          content: original.content,
        },
      })

      return NextResponse.json({
        ...duplicated,
        nodeMapping: JSON.parse(duplicated.nodeMapping),
      }, { status: 201 })
    }

    const { name, templateId, nodeMapping, rules, ruleProviders, dns } = body

    // 获取模板
    const template = await prisma.template.findUnique({
      where: { id: templateId },
    })

    if (!template) {
      return NextResponse.json({ error: '模板不存在' }, { status: 404 })
    }

    // 获取所有选中的节点 (过滤出纯节点ID,排除分组引用)
    const allNodeIds = Object.values(nodeMapping as Record<string, Array<string | { type: 'group'; name: string }>>)
      .flat()
      .filter((item): item is string => typeof item === 'string')

    const nodes = await prisma.proxyNode.findMany({
      where: {
        id: { in: allNodeIds },
      },
    })

    // 转换节点格式
    const proxies = ClashGenerator.generateProxies(
      nodes.map((node) => {
        // 安全解析 config，处理无效的 JSON 字符串
        let parsedConfig: Record<string, unknown> = {}
        if (node.config) {
          try {
            parsedConfig = typeof node.config === 'string'
              ? JSON.parse(node.config)
              : node.config
          } catch (e) {
            console.error(`Failed to parse config for node ${node.id}:`, e)
          }
        }
        return {
          name: node.name,
          type: node.type,
          server: node.server,
          port: node.port,
          config: parsedConfig,
        }
      })
    )

    // 构建节点名称映射 (处理节点ID和分组引用)
    const nodeNameMapping: Record<string, string[]> = {}
    for (const [groupName, items] of Object.entries(nodeMapping as Record<string, Array<string | { type: 'group'; name: string }>>)) {
      nodeNameMapping[groupName] = items
        .map((item) => {
          if (typeof item === 'string') {
            // 节点ID - 查找节点名称
            return nodes.find((n) => n.id === item)?.name
          } else {
            // 分组引用 - 直接使用分组名称
            return item.name
          }
        })
        .filter(Boolean) as string[]
    }

    // 生成配置，移除模板中不在 nodeMapping 的分组
    const content = ClashGenerator.generate({
      template: template.content,
      proxies,
      nodeMapping: nodeNameMapping,
      removeUnusedGroups: true,
      rules,
      ruleProviders,
      dns,
    })

    const config = await prisma.config.create({
      data: {
        name,
        templateId,
        nodeMapping: JSON.stringify(nodeMapping),
        content,
      },
    })

    return NextResponse.json(config, { status: 201 })
  } catch (error) {
    console.error('生成配置失败:', error)
    return NextResponse.json({ error: '生成配置失败' }, { status: 500 })
  }
}

// PUT /api/configs - 更新配置
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, name, templateId, nodeMapping, rules, ruleProviders, dns } = body

    if (!id) {
      return NextResponse.json({ error: '缺少配置 ID' }, { status: 400 })
    }

    // 获取现有配置
    const existingConfig = await prisma.config.findUnique({
      where: { id },
    })

    if (!existingConfig) {
      return NextResponse.json({ error: '配置不存在' }, { status: 404 })
    }

    // 获取模板
    const template = await prisma.template.findUnique({
      where: { id: templateId || existingConfig.templateId },
    })

    if (!template) {
      return NextResponse.json({ error: '模板不存在' }, { status: 404 })
    }

    // 获取所有选中的节点 (过滤出纯节点ID,排除分组引用)
    const allNodeIds = Object.values(nodeMapping as Record<string, Array<string | { type: 'group'; name: string }>>)
      .flat()
      .filter((item): item is string => typeof item === 'string')

    const nodes = await prisma.proxyNode.findMany({
      where: {
        id: { in: allNodeIds },
      },
    })

    // 转换节点格式
    const proxies = ClashGenerator.generateProxies(
      nodes.map((node) => {
        // 安全解析 config，处理无效的 JSON 字符串
        let parsedConfig: Record<string, unknown> = {}
        if (node.config) {
          try {
            parsedConfig = typeof node.config === 'string'
              ? JSON.parse(node.config)
              : node.config
          } catch (e) {
            console.error(`Failed to parse config for node ${node.id}:`, e)
          }
        }
        return {
          name: node.name,
          type: node.type,
          server: node.server,
          port: node.port,
          config: parsedConfig,
        }
      })
    )

    // 构建节点名称映射 (处理节点ID和分组引用)
    const nodeNameMapping: Record<string, string[]> = {}
    for (const [groupName, items] of Object.entries(nodeMapping as Record<string, Array<string | { type: 'group'; name: string }>>)) {
      nodeNameMapping[groupName] = items
        .map((item) => {
          if (typeof item === 'string') {
            // 节点ID - 查找节点名称
            return nodes.find((n) => n.id === item)?.name
          } else {
            // 分组引用 - 直接使用分组名称
            return item.name
          }
        })
        .filter(Boolean) as string[]
    }

    // 生成配置
    const content = ClashGenerator.generate({
      template: template.content,
      proxies,
      nodeMapping: nodeNameMapping,
      removeUnusedGroups: true,
      rules,
      ruleProviders,
      dns,
    })

    // 更新配置
    const config = await prisma.config.update({
      where: { id },
      data: {
        name: name || existingConfig.name,
        templateId: templateId || existingConfig.templateId,
        nodeMapping: JSON.stringify(nodeMapping),
        content,
      },
    })

    return NextResponse.json(config)
  } catch (error) {
    console.error('更新配置失败:', error)
    return NextResponse.json({ error: '更新配置失败' }, { status: 500 })
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
