import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

// 临时调试 API：检查节点 config 是否有效
export async function GET(request: NextRequest) {
  try {
    const nodes = await prisma.proxyNode.findMany({
      select: {
        id: true,
        name: true,
        type: true,
        config: true,
      },
    })

    const results = nodes.map((node) => {
      let isValid = true
      let error = null

      if (!node.config || node.config === '{}') {
        isValid = false
        error = 'empty'
      } else {
        try {
          JSON.parse(node.config)
        } catch (e) {
          isValid = false
          error = String(e)
        }
      }

      return {
        id: node.id,
        name: node.name,
        type: node.type,
        isValid,
        error,
        configLength: node.config?.length || 0,
        configPreview: node.config?.substring(0, 100),
      }
    })

    const invalidNodes = results.filter((n) => !n.isValid)

    return NextResponse.json({
      total: nodes.length,
      invalidCount: invalidNodes.length,
      invalidNodes,
      results: results.slice(0, 10), // 只返回前10个
    })
  } catch (error) {
    console.error('Debug error:', error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
