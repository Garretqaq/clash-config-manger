import yaml from 'js-yaml'
import type { ClashConfig } from './types'

export type RuleItem = { type: string; value: string; target: string; noResolve?: boolean }

// 无 value 段的规则类型（只有 TYPE,TARGET）
const NO_VALUE_TYPES = new Set(['MATCH', 'FINAL'])

// 支持 no-resolve 尾段的基于 IP 的规则类型
const NO_RESOLVE_TYPES = new Set(['IP-CIDR', 'IP-CIDR6', 'IP-ASN', 'GEOIP'])

// 从 YAML content 解析出结构化规则列表
export function parseRules(content: string): RuleItem[] {
  let rules: string[] = []
  try {
    const config = yaml.load(content) as ClashConfig
    rules = Array.isArray(config?.rules) ? config.rules : []
  } catch {
    return []
  }
  return rules.map((line) => {
    const parts = String(line).split(',')
    const type = (parts[0] ?? '').trim().toUpperCase()
    if (NO_VALUE_TYPES.has(type)) {
      return { type, value: '', target: parts.slice(1).join(',').trim() }
    }
    const value = (parts[1] ?? '').trim()
    const tail = parts.slice(2).map((p) => p.trim())
    // 仅对基于 IP 的类型剥离末尾的 no-resolve；其余尾段原样保留在 target
    if (NO_RESOLVE_TYPES.has(type) && tail[tail.length - 1]?.toLowerCase() === 'no-resolve') {
      return { type, value, target: tail.slice(0, -1).join(','), noResolve: true }
    }
    return { type, value, target: tail.join(',') }
  })
}

// 结构化规则列表序列化回 string[]（丢弃空 type 行）
export function serializeRules(items: RuleItem[]): string[] {
  return items
    .filter((r) => r.type)
    .map((r) => {
      const base = NO_VALUE_TYPES.has(r.type)
        ? `${r.type},${r.target}`
        : `${r.type},${r.value},${r.target}`
      return r.noResolve ? `${base},no-resolve` : base
    })
}
