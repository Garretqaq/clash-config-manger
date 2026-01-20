import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { ClashGenerator } from '@/lib/clash-generator'

// Mark as dynamic route
export const dynamic = "force-dynamic";

// GET /api/templates - 获取所有模板
export async function GET() {
  try {
    const templates = await prisma.template.findMany({
      orderBy: {
        createdAt: 'desc',
      },
    })

    return NextResponse.json(templates)
  } catch (error) {
    console.error('获取模板失败:', error)
    return NextResponse.json({ error: '获取模板失败' }, { status: 500 })
  }
}

// POST /api/templates - 创建模板
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, description, content, isDefault } = body

    // 验证模板格式
    const validation = ClashGenerator.validateTemplate(content)
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 })
    }

    // 如果设为默认，取消其他默认模板
    if (isDefault) {
      await prisma.template.updateMany({
        data: { isDefault: false },
      })
    }

    const template = await prisma.template.create({
      data: {
        name,
        description,
        content,
        isDefault: isDefault || false,
      },
    })

    return NextResponse.json(template, { status: 201 })
  } catch (error) {
    console.error('创建模板失败:', error)
    return NextResponse.json({ error: '创建模板失败' }, { status: 500 })
  }
}

// PUT /api/templates - 更新模板
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, name, description, content, isDefault } = body

    // 验证模板格式
    if (content) {
      const validation = ClashGenerator.validateTemplate(content)
      if (!validation.valid) {
        return NextResponse.json({ error: validation.error }, { status: 400 })
      }
    }

    // 如果设为默认，取消其他默认模板
    if (isDefault) {
      await prisma.template.updateMany({
        where: { id: { not: id } },
        data: { isDefault: false },
      })
    }

    const template = await prisma.template.update({
      where: { id },
      data: {
        name,
        description,
        content,
        isDefault,
      },
    })

    return NextResponse.json(template)
  } catch (error) {
    console.error('更新模板失败:', error)
    return NextResponse.json({ error: '更新模板失败' }, { status: 500 })
  }
}

// DELETE /api/templates - 删除模板
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: '缺少模板 ID' }, { status: 400 })
    }

    await prisma.template.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('删除模板失败:', error)
    return NextResponse.json({ error: '删除模板失败' }, { status: 500 })
  }
}
