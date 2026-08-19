import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { publicLimiter } from '@/lib/rate-limit'
import { ClashGenerator } from '@/lib/clash-generator'
import { parseRules, serializeRules } from '@/lib/clash-rules'
import { parseRuleProviders, serializeRuleProviders } from '@/lib/clash-rule-providers'

// Mark as dynamic route
export const dynamic = "force-dynamic";

// PATCH /api/share/[shareId] - Update share link title
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ shareId: string }> }
) {
  try {
    const { shareId } = await params
    const body = await request.json()
    const { title } = body

    const trimmedTitle = typeof title === 'string' && title.trim() ? title.trim() : null

    const shareLink = await prisma.shareLink.findUnique({
      where: { shareId },
    })

    if (!shareLink) {
      return NextResponse.json({ error: '分享链接不存在' }, { status: 404 })
    }

    const updated = await prisma.shareLink.update({
      where: { id: shareLink.id },
      data: { title: trimmedTitle },
    })

    return NextResponse.json({ id: updated.id, shareId: updated.shareId, title: updated.title })
  } catch (error) {
    console.error('Failed to update share link title:', error)
    return NextResponse.json({ error: '更新标题失败' }, { status: 500 })
  }
}

// GET /api/share/[shareId] - Get share link content (requires token)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ shareId: string }> }
) {
  try {
    const { shareId } = await params

    // Rate limiting
    const ip = request.headers.get('x-forwarded-for') || 'unknown'
    const rateLimitResult = publicLimiter(ip)

    if (!rateLimitResult.success) {
      return new NextResponse('请求过于频繁，请稍后再试', {
        status: 429,
        headers: {
          'X-RateLimit-Remaining': String(rateLimitResult.remaining),
          'X-RateLimit-Reset': String(rateLimitResult.resetTime),
        },
      })
    }

    // Get token from query params
    const token = request.nextUrl.searchParams.get('token')

    if (!token) {
      return new NextResponse('缺少访问令牌', { status: 401 })
    }

    // Find share link
    const shareLink = await prisma.shareLink.findUnique({
      where: { shareId },
    })

    if (!shareLink) {
      return new NextResponse('分享链接不存在', { status: 404 })
    }

    // Verify token
    if (token !== shareLink.accessToken) {
      return new NextResponse('访问令牌无效', { status: 403 })
    }

    // Check if expired
    if (shareLink.expiresAt && new Date() > shareLink.expiresAt) {
      // Clean up expired link
      await prisma.shareLink.delete({ where: { id: shareLink.id } })
      return new NextResponse('分享链接已过期', { status: 410 })
    }

    // Increment view count
    await prisma.shareLink.update({
      where: { id: shareLink.id },
      data: { views: { increment: 1 } },
    })

    // Get config content - either from dynamic config or stored content
    let configContent: string
    let configName: string

    if (shareLink.isDynamic && shareLink.configId) {
      // Dynamic share: fetch latest content by regenerating config with current node data
      const config = await prisma.config.findUnique({
        where: { id: shareLink.configId },
      })

      if (!config) {
        return new NextResponse('关联的配置已被删除', { status: 404 })
      }

      configName = config.name

      // Get template for regeneration
      const template = await prisma.template.findUnique({
        where: { id: config.templateId },
      })

      if (!template) {
        return new NextResponse('关联的模板已被删除', { status: 404 })
      }

      // Extract node IDs from nodeMapping (handle both node IDs and group references)
      // nodeMapping 在数据库中是 JSON 字符串，需要先解析
      let nodeMapping: Record<string, Array<string | { type: 'group'; name: string }>> = {}
      try {
        nodeMapping = typeof config.nodeMapping === 'string'
          ? JSON.parse(config.nodeMapping)
          : config.nodeMapping
      } catch (e) {
        console.error('Failed to parse nodeMapping:', e)
        return new NextResponse('配置数据格式错误', { status: 500 })
      }
      const allNodeIds = Object.values(nodeMapping)
        .flat()
        .filter((item): item is string => typeof item === 'string')

      // Fetch latest node information from database
      const nodes = await prisma.proxyNode.findMany({
        where: {
          id: { in: allNodeIds },
        },
      })

      // Generate proxy configurations with latest node data
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

      // Build node name mapping (handle node IDs and group references)
      const nodeNameMapping: Record<string, string[]> = {}
      for (const [groupName, items] of Object.entries(nodeMapping)) {
        nodeNameMapping[groupName] = items
          .map((item) => {
            if (typeof item === 'string') {
              // Node ID - find node name
              return nodes.find((n) => n.id === item)?.name
            } else {
              // Group reference - use group name directly
              return item.name
            }
          })
          .filter(Boolean) as string[]
      }

      // Regenerate config with latest node information
      // 从已保存的 content 中解析 rules / rule-providers 一并传入，
      // 否则生成器会回退到模板默认 rules，导致分享内容落后于用户编辑
      const rules = serializeRules(parseRules(config.content))
      const ruleProviders = serializeRuleProviders(parseRuleProviders(config.content))

      configContent = ClashGenerator.generate({
        template: template.content,
        proxies,
        nodeMapping: nodeNameMapping,
        removeUnusedGroups: true,
        rules,
        ruleProviders,
      })
    } else {
      // Use stored content
      if (!shareLink.configContent) {
        return new NextResponse('配置内容不存在', { status: 404 })
      }
      configContent = shareLink.configContent
      configName = shareLink.configName || 'config'
    }

    // Return raw YAML content
    // filename 字段只支持 ASCII 字符，filename* 支持 UTF-8 编码
    const asciiFileName = configName.replace(/[^a-zA-Z0-9_\-]/g, '_')
    const encodedFileName = encodeURIComponent(configName)
    return new NextResponse(configContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Content-Disposition': `attachment; filename="${asciiFileName}.yaml"; filename*=UTF-8''${encodedFileName}.yaml`,
      },
    })
  } catch (error) {
    console.error('Failed to get share link:', error)
    return new NextResponse('获取分享配置失败', { status: 500 })
  }
}
