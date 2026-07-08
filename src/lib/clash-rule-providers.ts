import yaml from 'js-yaml'
import type { ClashConfig } from './types'
import type { RuleItem } from './clash-rules'

export type RuleProviderItem = {
  name: string // YAML 中的键名，必须唯一
  type: string // 'http' | 'file'
  behavior: string // 'domain' | 'ipcidr' | 'classical'
  url: string // type=http 时必填
  path: string
  interval: string // 存字符串方便 UI；序列化时 Number() 转 YAML 数字
}

// 从 YAML content 解析出结构化 provider 列表，保留键顺序
export function parseRuleProviders(content: string): RuleProviderItem[] {
  let providers: Record<string, any> = {}
  try {
    const config = yaml.load(content) as ClashConfig
    const rp = config?.['rule-providers']
    if (rp && typeof rp === 'object' && !Array.isArray(rp)) {
      providers = rp as Record<string, any>
    }
  } catch {
    return []
  }
  return Object.entries(providers).map(([name, p]) => ({
    name,
    type: String(p?.type ?? ''),
    behavior: String(p?.behavior ?? ''),
    url: String(p?.url ?? ''),
    path: String(p?.path ?? ''),
    interval: String(p?.interval ?? ''),
  }))
}

// 结构化 provider 列表序列化回对象（丢弃空 name 项）
export function serializeRuleProviders(items: RuleProviderItem[]): Record<string, object> {
  const result: Record<string, object> = {}
  for (const item of items.filter((p) => p.name)) {
    const entry: Record<string, unknown> = {
      type: item.type,
      behavior: item.behavior,
      url: item.url,
      path: item.path,
    }
    if (item.interval !== '') {
      const n = Number(item.interval)
      if (!Number.isNaN(n)) entry.interval = n
    }
    // type=file 或 url 为空时不输出 url 键
    if (item.type === 'file' || item.url === '') {
      delete entry.url
    }
    result[item.name] = entry
  }
  return result
}

// 校验 provider 列表自身 + 与 rules 的 RULE-SET 引用一致性
export function validateRuleProviders(
  rules: RuleItem[],
  providers: RuleProviderItem[],
): { ok: boolean; errors: string[] } {
  const errors: string[] = []

  // 1. provider name 非空且唯一；type=http 时 url 必填
  const names = providers.map((p) => p.name)
  const seen = new Set<string>()
  providers.forEach((p, i) => {
    if (!p.name) {
      errors.push(`第 ${i + 1} 个 provider 名称为空`)
    } else if (seen.has(p.name)) {
      errors.push(`provider 名称重复：${p.name}`)
    } else {
      seen.add(p.name)
    }
    if (p.type === 'http' && !p.url) {
      errors.push(`provider「${p.name || `第 ${i + 1} 个`}」类型为 http 但 url 为空`)
    }
  })

  // 2. rules 中 RULE-SET 引用必须存在于 provider name 集合
  const nameSet = new Set(names.filter(Boolean))
  rules.forEach((r, i) => {
    if (r.type === 'RULE-SET' && r.value && !nameSet.has(r.value)) {
      errors.push(`第 ${i + 1} 条规则引用了不存在的规则集：${r.value}`)
    }
  })

  return { ok: errors.length === 0, errors }
}
