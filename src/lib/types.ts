export type ProxyType = 'ss' | 'ssr' | 'vmess' | 'vless' | 'trojan' | 'socks5' | 'http' | 'hysteria' | 'hysteria2'

export interface ProxyNode {
  id: string
  name: string
  type: ProxyType | string
  server: string
  port: number
  config: Record<string, unknown>
  groupId?: string | null
  subscriptionId?: string | null
  createdAt: Date
  updatedAt: Date
}

export interface Group {
  id: string
  name: string
  type: 'select' | 'url-test' | 'fallback' | 'load-balance'
  sortOrder: number
  nodes?: ProxyNode[]
  createdAt: Date
  updatedAt: Date
}

export interface Template {
  id: string
  name: string
  description?: string | null
  content: string
  isDefault: boolean
  createdAt: Date
  updatedAt: Date
}

export interface Subscription {
  id: string
  name: string
  url: string
  enabled: boolean
  nodes?: ProxyNode[]
  lastSyncAt?: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface Config {
  id: string
  name: string
  templateId: string
  nodeMapping: Record<string, string[]>
  content: string
  createdAt: Date
  updatedAt: Date
}

// Clash 原始配置类型
export interface ClashProxyConfig {
  name: string
  type: string
  server: string
  port: number
  [key: string]: unknown
}

export interface ClashProxyGroup {
  name: string
  type: string
  proxies?: string[]
  url?: string
  interval?: number
  [key: string]: unknown
}

export interface ClashConfig {
  proxies?: ClashProxyConfig[]
  'proxy-groups'?: ClashProxyGroup[]
  rules?: string[]
  [key: string]: unknown
}
