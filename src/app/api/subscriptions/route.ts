import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { ClashParser } from '@/lib/clash-parser'

// GET /api/subscriptions - 获取所有订阅
export async function GET() {
  try {
    const subscriptions = await prisma.subscription.findMany({
      include: {
        _count: {
          select: { nodes: true },
        },
        groups: {
          select: { id: true, name: true, _count: { select: { nodes: true } } },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    return NextResponse.json(subscriptions)
  } catch (error) {
    console.error('获取订阅失败:', error)
    return NextResponse.json({ error: '获取订阅失败' }, { status: 500 })
  }
}

// POST /api/subscriptions - 创建订阅
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, url, yamlContent } = body

    // 创建订阅
    const subscription = await prisma.subscription.create({
      data: {
        name,
        url: url || '',
        yamlContent: yamlContent || null,
      },
    })

    // 自动创建对应的分组
    const group = await prisma.group.create({
      data: {
        name: `${name} - 默认`,
        type: 'select',
        subscriptionId: subscription.id,
      },
    })

    // 如果有 yamlContent，直接解析导入节点
    if (yamlContent) {
      const config = ClashParser.parseContent(yamlContent)
      const proxies = ClashParser.extractProxies(config)
      const validatedProxies = proxies.filter(ClashParser.validateProxy)
      const normalizedProxies = validatedProxies.map(ClashParser.normalizeProxy)

      await prisma.proxyNode.createMany({
        data: normalizedProxies.map((proxy) => ({
          name: proxy.name,
          type: proxy.type,
          server: proxy.server,
          port: Number(proxy.port),
          config: proxy.config as object,
          subscriptionId: subscription.id,
          groupId: group.id,
        })),
      })
    }

    return NextResponse.json({
      ...subscription,
      nodeCount: yamlContent ? await prisma.proxyNode.count({ where: { subscriptionId: subscription.id } }) : 0,
    }, { status: 201 })
  } catch (error) {
    console.error('创建订阅失败:', error)
    return NextResponse.json({ error: '创建订阅失败' }, { status: 500 })
  }
}

// PUT /api/subscriptions - 同步订阅
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, action } = body

    if (action === 'sync') {
      const subscription = await prisma.subscription.findUnique({
        where: { id },
        select: {
          id: true,
          name: true,
          url: true,
          yamlContent: true,
          groups: true,
        },
      })

      if (!subscription) {
        return NextResponse.json({ error: '订阅不存在' }, { status: 404 })
      }

      // 获取并解析配置：优先使用 yamlContent，其次使用 URL
      let config
      if (subscription.yamlContent) {
        // 使用存储的 yamlContent
        config = ClashParser.parseContent(subscription.yamlContent)
      } else if (subscription.url) {
        // 从 URL 获取
        config = await ClashParser.fetchFromUrl(subscription.url)
      } else {
        return NextResponse.json({ error: '订阅没有可用的配置内容' }, { status: 400 })
      }

      const proxies = ClashParser.extractProxies(config)

      // 验证节点配置
      const validatedProxies = proxies.filter(ClashParser.validateProxy)

      // 删除该订阅下的旧节点
      await prisma.proxyNode.deleteMany({
        where: { subscriptionId: id },
      })

      // 规范化节点配置
      const normalizedProxies = validatedProxies.map(ClashParser.normalizeProxy)

      // 获取订阅的默认分组
      let defaultGroup = subscription.groups.find((g) => g.name.endsWith('默认'))
      if (!defaultGroup) {
        defaultGroup = await prisma.group.create({
          data: {
            name: `${subscription.name} - 默认`,
            type: 'select',
            subscriptionId: id,
          },
        })
      }

      // 批量创建节点
      await prisma.proxyNode.createMany({
        data: normalizedProxies.map((proxy) => ({
          name: proxy.name,
          type: proxy.type,
          server: proxy.server,
          port: Number(proxy.port),
          config: proxy.config as object,
          subscriptionId: id,
          groupId: defaultGroup.id,
        })),
      })

      // 更新同步时间
      await prisma.subscription.update({
        where: { id },
        data: { lastSyncAt: new Date() },
      })

      return NextResponse.json({
        success: true,
        count: normalizedProxies.length,
        groupId: defaultGroup.id,
        groupName: defaultGroup.name,
      })
    }

    // 更新订阅信息
    const { name, url, enabled } = body
    const subscription = await prisma.subscription.update({
      where: { id },
      data: { name, url, enabled },
    })

    return NextResponse.json(subscription)
  } catch (error) {
    console.error('操作订阅失败:', error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}

// DELETE /api/subscriptions - 删除订阅
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: '缺少订阅 ID' }, { status: 400 })
    }

    await prisma.proxyNode.deleteMany({
      where: { subscriptionId: id },
    })

    await prisma.group.deleteMany({
      where: { subscriptionId: id },
    })

    await prisma.subscription.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('删除订阅失败:', error)
    return NextResponse.json({ error: '删除订阅失败' }, { status: 500 })
  }
}
