import yaml from 'js-yaml'
import type { ClashConfig } from './types'

export type RuleItem = { type: string; value: string; target: string }

// 无 value 段的规则类型（只有 TYPE,TARGET）
const NO_VALUE_TYPES = new Set(['MATCH', 'FINAL'])

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
      return { type, value: '', target: (parts[1] ?? '').trim() }
    }
    // ponytail: no-resolve 等尾段并入 target 原样保留；需独立开关时再拆字段
    return {
      type,
      value: (parts[1] ?? '').trim(),
      target: parts.slice(2).join(',').trim(),
    }
  })
}

// 结构化规则列表序列化回 string[]（丢弃空 type 行）
export function serializeRules(items: RuleItem[]): string[] {
  return items
    .filter((r) => r.type)
    .map((r) =>
      NO_VALUE_TYPES.has(r.type)
        ? `${r.type},${r.target}`
        : `${r.type},${r.value},${r.target}`
    )
}
