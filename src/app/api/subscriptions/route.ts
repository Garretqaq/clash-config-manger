import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { ClashParser } from '@/lib/clash-parser'

// Mark as dynamic route
export const dynamic = "force-dynamic";

// GET /api/subscriptions - 获取所有订阅
export async function GET() {
  try {
    // ponytail: select 排除 yamlContent —— 列表页不用它，整份 YAML 白传
    const subscriptions = await prisma.subscription.findMany({
      select: {
        id: true,
        name: true,
        url: true,
        enabled: true,
        lastSyncAt: true,
        _count: { select: { nodes: true } },
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
    // ponytail: 有 URL 就不存 yamlContent —— 同步时从 URL 拉最新，存整份快照既占空间又会读到旧数据。
    // 仅纯粘贴（无 URL）时保留 yaml 作为唯一的再同步源。
    const subscription = await prisma.subscription.create({
      data: {
        name,
        url: url || '',
        yamlContent: url ? null : (yamlContent || null),
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

      // 分批创建节点，避免 MySQL max_allowed_packet 限制
      const BATCH_SIZE = 500
      for (let i = 0; i < normalizedProxies.length; i += BATCH_SIZE) {
        const batch = normalizedProxies.slice(i, i + BATCH_SIZE)
        await prisma.proxyNode.createMany({
          data: batch.map((proxy) => ({
            name: proxy.name,
            type: proxy.type,
            server: proxy.server,
            port: Number(proxy.port),
            config: JSON.stringify(proxy.config),
            subscriptionId: subscription.id,
            groupId: group.id,
          })),
        })
      }
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

      // 获取并解析配置：优先从 URL 拉最新，纯粘贴订阅才回退到存储的 yamlContent
      let config
      if (subscription.url) {
        // 从 URL 获取最新配置
        config = await ClashParser.fetchFromUrl(subscription.url)
      } else if (subscription.yamlContent) {
        // 无 URL 的纯粘贴订阅，用存储的 yamlContent 再解析
        config = ClashParser.parseContent(subscription.yamlContent)
      } else {
        return NextResponse.json({ error: '订阅没有可用的配置内容' }, { status: 400 })
      }

      const proxies = ClashParser.extractProxies(config)
      console.log(`[订阅同步] ${subscription.name}: 获取到 ${proxies.length} 个原始节点`)

      // 验证节点配置
      const validatedProxies = proxies.filter(ClashParser.validateProxy)
      console.log(`[订阅同步] ${subscription.name}: 验证通过 ${validatedProxies.length} 个节点，${proxies.length - validatedProxies.length} 个被过滤`)

      // 删除该订阅下的旧节点
      await prisma.proxyNode.deleteMany({
        where: { subscriptionId: id },
      })

      // 规范化节点配置
      const normalizedProxies = validatedProxies.map(ClashParser.normalizeProxy)
      console.log(`[订阅同步] ${subscription.name}: 准备导入 ${normalizedProxies.length} 个节点`)

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

      // 分批创建节点，避免 MySQL max_allowed_packet 限制
      const BATCH_SIZE = 500
      for (let i = 0; i < normalizedProxies.length; i += BATCH_SIZE) {
        const batch = normalizedProxies.slice(i, i + BATCH_SIZE)
        await prisma.proxyNode.createMany({
          data: batch.map((proxy) => ({
            name: proxy.name,
            type: proxy.type,
            server: proxy.server,
            port: Number(proxy.port),
            config: JSON.stringify(proxy.config),
            subscriptionId: id,
            groupId: defaultGroup.id,
          })),
        })
      }
      console.log(`[订阅同步] ${subscription.name}: 成功导入 ${normalizedProxies.length} 个节点`)

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
