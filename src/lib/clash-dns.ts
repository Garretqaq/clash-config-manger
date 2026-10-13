import yaml from 'js-yaml'
import type { ClashConfig } from './types'

// DNS 段中做成一等字段的列表键（每行一条的 Textarea 对应）
const LIST_KEYS = ['default-nameserver', 'nameserver', 'fallback'] as const

// 做成一等字段的布尔键
const BOOL_KEYS = ['enable', 'ipv6', 'use-hosts'] as const

// 字符串键
const STRING_KEYS = ['enhanced-mode', 'fake-ip-range'] as const

export const ENHANCED_MODES = ['fake-ip', 'redir-host', 'normal'] as const

export type DnsFallbackFilter = {
  geoip?: boolean
  ipcidr?: string[]
  [key: string]: unknown
}

// 结构化 DNS 配置。未列出的子键（fake-ip-filter / nameserver-policy / listen 等）一律原样透传保留。
export type DnsConfig = {
  enable?: boolean
  ipv6?: boolean
  'default-nameserver'?: string[]
  'enhanced-mode'?: string
  'fake-ip-range'?: string
  'use-hosts'?: boolean
  nameserver?: string[]
  fallback?: string[]
  'fallback-filter'?: DnsFallbackFilter
  [key: string]: unknown
}

// 「填入推荐配置」按钮的预设值。geoip-code 不是表单字段，仅作为推荐值随透传键写入。
export const DNS_PRESET: DnsConfig = {
  enable: true,
  ipv6: false,
  'default-nameserver': ['223.5.5.5', '119.29.29.29'],
  'enhanced-mode': 'fake-ip',
  'fake-ip-range': '198.18.0.1/16',
  'use-hosts': true,
  nameserver: ['https://doh.pub/dns-query', 'https://dns.alidns.com/dns-query'],
  fallback: [
    'https://dns.cloudflare.com/dns-query',
    'https://dns.google/dns-query',
    'tls://8.8.4.4:853',
  ],
  'fallback-filter': {
    geoip: true,
    'geoip-code': 'CN',
    ipcidr: ['240.0.0.0/4', '0.0.0.0/32'],
  },
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

// 标量或数组统一归一为去空白的字符串数组
function toStringList(value: unknown): string[] {
  if (value === null || value === undefined) return []
  const raw = Array.isArray(value) ? value : [value]
  return raw.map((v) => String(v).trim()).filter((v) => v !== '')
}

// 从 YAML content 解析出结构化 DNS 配置；无 dns 段/坏 YAML/类型不符一律返回 {}
export function parseDns(content: string): DnsConfig {
  let raw: unknown
  try {
    const config = yaml.load(content) as ClashConfig
    raw = config?.dns
  } catch {
    return {}
  }
  if (!isPlainObject(raw)) return {}

  // 未知子键原样带过（含 fallback-filter 同层的其他键）
  const dns: DnsConfig = { ...raw }

  for (const key of LIST_KEYS) {
    if (key in raw) dns[key] = toStringList(raw[key])
  }
  for (const key of BOOL_KEYS) {
    if (key in raw) dns[key] = raw[key] === true
  }
  for (const key of STRING_KEYS) {
    if (!(key in raw)) continue
    if (raw[key] === null || raw[key] === undefined) delete dns[key]
    else dns[key] = String(raw[key])
  }

  const ff = raw['fallback-filter']
  if (isPlainObject(ff)) {
    const next: DnsFallbackFilter = { ...ff }
    if ('ipcidr' in ff) next.ipcidr = toStringList(ff.ipcidr)
    if ('geoip' in ff) next.geoip = ff.geoip === true
    dns['fallback-filter'] = next
  }

  return dns
}

// 结构化 DNS 配置序列化为可注入 YAML 的对象：丢弃空值/空列表/空字符串
export function serializeDns(dns: DnsConfig): Record<string, unknown> {
  const out: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(dns)) {
    if (value === null || value === undefined) continue

    if ((LIST_KEYS as readonly string[]).includes(key)) {
      const list = toStringList(value)
      if (list.length > 0) out[key] = list
      continue
    }

    if (key === 'fallback-filter') {
      if (!isPlainObject(value)) continue
      const ff: Record<string, unknown> = {}
      for (const [k, v] of Object.entries(value)) {
        if (v === null || v === undefined) continue
        if (k === 'ipcidr') {
          const list = toStringList(v)
          if (list.length > 0) ff.ipcidr = list
          continue
        }
        if (k === 'geoip') {
          ff.geoip = v === true
          continue
        }
        // 未知子键（如 geoip-code / domain）原样保留
        ff[k] = typeof v === 'string' ? v.trim() : v
      }
      if (Object.keys(ff).length > 0) out[key] = ff
      continue
    }

    if (typeof value === 'string') {
      const trimmed = value.trim()
      if (trimmed !== '') out[key] = trimmed
      continue
    }

    out[key] = value
  }

  return out
}

// 「填入推荐配置」：预设值覆盖同名键，用户原有的其他子键保留
export function applyPreset(dns: DnsConfig): DnsConfig {
  const current = isPlainObject(dns['fallback-filter']) ? dns['fallback-filter'] : {}
  return {
    ...dns,
    ...DNS_PRESET,
    'fallback-filter': { ...current, ...(DNS_PRESET['fallback-filter'] as DnsFallbackFilter) },
  }
}

function isCidr(value: string): boolean {
  const [addr, prefixRaw] = value.split('/')
  if (!addr || prefixRaw === undefined || prefixRaw === '') return false
  const prefix = Number(prefixRaw)
  if (!Number.isInteger(prefix) || prefix < 0) return false

  if (addr.includes(':')) return prefix <= 128

  const parts = addr.split('.')
  if (parts.length !== 4) return false
  if (!parts.every((p) => /^\d{1,3}$/.test(p) && Number(p) <= 255)) return false
  return prefix <= 32
}

// 轻量校验：只拦明显跑不起来的组合，其余自由输入
export function validateDns(dns: DnsConfig): { ok: boolean; errors: string[] } {
  const errors: string[] = []
  const serialized = serializeDns(dns)

  // 1. enable: true 时 nameserver 不能为空
  if (serialized.enable === true) {
    const nameserver = serialized.nameserver
    if (!Array.isArray(nameserver) || nameserver.length === 0) {
      errors.push('启用 DNS（enable: true）时 nameserver 不能为空')
    }
  }

  // 2. fake-ip-range 必须是合法 CIDR
  const fakeIpRange = serialized['fake-ip-range']
  if (typeof fakeIpRange === 'string' && !isCidr(fakeIpRange)) {
    errors.push(`fake-ip-range 不是合法 CIDR：${fakeIpRange}`)
  }

  // 3. fallback-filter.geoip 为 true 时，若显式写了 geoip-code 则不能为空
  //    （geoip-code 不是表单字段，仅在源 YAML 显式写出且为空时才拦）
  const fallbackFilter = serialized['fallback-filter']
  if (isPlainObject(fallbackFilter)) {
    if (fallbackFilter.geoip === true && 'geoip-code' in fallbackFilter) {
      if (String(fallbackFilter['geoip-code'] ?? '').trim() === '') {
        errors.push('fallback-filter.geoip 为 true 时 geoip-code 不能为空')
      }
    }
  }

  // 4. enhanced-mode 取值有限
  const enhancedMode = serialized['enhanced-mode']
  if (
    typeof enhancedMode === 'string' &&
    !(ENHANCED_MODES as readonly string[]).includes(enhancedMode)
  ) {
    errors.push(`enhanced-mode 非法：${enhancedMode}（可选 ${ENHANCED_MODES.join(' / ')}）`)
  }

  return { ok: errors.length === 0, errors }
}
