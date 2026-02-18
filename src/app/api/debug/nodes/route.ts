import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

// 临时调试 API：检查所有可能包含 JSON 的字段
export async function GET(request: NextRequest) {
  try {
    // 检查 ProxyNode
    const nodes = await prisma.proxyNode.findMany({
      select: { id: true, name: true, type: true, config: true },
    })

    const nodeResults = nodes.map((node) => {
      let isValid = true
      let error = null
      if (!node.config || node.config === '{}') {
        isValid = false
        error = 'empty'
      } else {
        try { JSON.parse(node.config) } catch (e) { isValid = false; error = String(e) }
      }
      return { id: node.id, name: node.name, table: 'ProxyNode', isValid, error }
    })

    // 检查 Config
    const configs = await prisma.config.findMany({
      select: { id: true, name: true, nodeMapping: true },
    })

    const configResults = configs.map((c) => {
      let isValid = true
      let error = null
      if (!c.nodeMapping || c.nodeMapping === '{}') {
        isValid = false
        error = 'empty'
      } else {
        try { JSON.parse(c.nodeMapping) } catch (e) { isValid = false; error = String(e) }
      }
      return { id: c.id, name: c.name, table: 'Config', isValid, error }
    })

    // 检查 ShareLink
    const shareLinks = await prisma.shareLink.findMany({
      select: { id: true, shareId: true, configId: true, accessToken: true },
    })

    // 检查 Template
    const templates = await prisma.template.findMany({
      select: { id: true, name: true },
    })

    const allResults = [...nodeResults, ...configResults]
    const invalidItems = allResults.filter((r) => !r.isValid)

    return NextResponse.json({
      nodesTotal: nodes.length,
      configsTotal: configs.length,
      shareLinksTotal: shareLinks.length,
      templatesTotal: templates.length,
      shareLinks: shareLinks.map(s => ({ id: s.id, shareId: s.shareId, configId: s.configId })),
      invalidCount: invalidItems.length,
      invalidItems,
    })
  } catch (error) {
    console.error('Debug error:', error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
