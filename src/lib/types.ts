export type ProxyType = 'ss' | 'ssr' | 'vmess' | 'vless' | 'trojan' | 'socks5' | 'http' | 'hysteria' | 'hysteria2' | 'anytls'

export type ConnectionStatus = 'connected' | 'disconnected' | 'testing'

export interface NodeConnection {
  nodeId: string
  connected: boolean
  port?: number
  timestamp?: Date
}

export const CONNECTION_STATUS_COLORS: Record<ConnectionStatus, string> = {
  connected: 'text-green-500',
  disconnected: 'text-red-500',
  testing: 'text-yellow-500',
}

export const CONNECTION_STATUS_BG_COLORS: Record<ConnectionStatus, string> = {
  connected: 'bg-green-500/20',
  disconnected: 'bg-red-500/20',
  testing: 'bg-yellow-500/20',
}

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

// 节点映射项:可以是节点ID或分组引用
export type NodeMappingItem =
  | string                           // 节点ID
  | { type: 'group'; name: string }  // 分组引用

// 前端状态管理使用的增强类型
export type NodeMappingValue =
  | ProxyNode                        // 普通节点
  | { type: 'group'; name: string }  // 分组引用

export interface Config {
  id: string
  name: string
  templateId: string
  nodeMapping: Record<string, NodeMappingItem[]>  // 支持混合节点ID和分组引用
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

export interface ShareLink {
  id: string
  shareId: string
  configId?: string | null
  configName?: string | null
  description?: string | null
  expiresAt?: string | null
  views: number
  isDynamic: boolean
  createdAt: string
}
