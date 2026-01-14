import yaml from 'js-yaml'
import type { ClashConfig, ClashProxyConfig } from './types'

// 支持的 URL 协议
const SUPPORTED_PROTOCOLS = ['trojan://', 'vless://', 'vmess://', 'ss://', 'ssr://', 'hysteria2://', 'hysteria://', 'socks5://', 'http://']

export class ClashParser {
  /**
   * 从 URL 获取并解析 Clash 配置
   */
  static async fetchFromUrl(url: string): Promise<ClashConfig> {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'ClashConfigManager/1.0',
      },
    })

    if (!response.ok) {
      throw new Error(`获取订阅失败: ${response.status}`)
    }

    const content = await response.text()
    return this.parseContent(content)
  }

  /**
   * 解析内容（自动检测格式）
   */
  static parseContent(content: string): ClashConfig {
    // 检测是否为 URL 格式（每行以协议开头）
    const lines = content.trim().split('\n').filter(l => l.trim())
    const isUrlFormat = lines.length > 0 && lines.some(line =>
      SUPPORTED_PROTOCOLS.some(protocol => line.trim().startsWith(protocol))
    )

    if (isUrlFormat) {
      // 解析 URL 格式
      const proxies = this.parseUrlLines(lines)
      return { proxies }
    }

    // 解析 YAML 格式
    return this.parseYaml(content)
  }

  /**
   * 解析 YAML 内容
   */
  static parseYaml(content: string): ClashConfig {
    try {
      const config = yaml.load(content) as ClashConfig
      return config || {}
    } catch (error) {
      throw new Error(`解析 YAML 失败: ${error}`)
    }
  }

  /**
   * 解析 URL 格式的行
   */
  static parseUrlLines(lines: string[]): ClashProxyConfig[] {
    const proxies: ClashProxyConfig[] = []

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed) continue

      try {
        const proxy = this.parseUrl(trimmed)
        if (proxy) {
          proxies.push(proxy)
        }
      } catch (error) {
        console.warn(`解析节点失败: ${trimmed.slice(0, 50)}...`)
      }
    }

    return proxies
  }

  /**
   * 解析单个 URL
   */
  static parseUrl(url: string): ClashProxyConfig | null {
    // URL 格式: protocol://userinfo@server:port?params#name
    const protocolMatch = url.match(/^(trojan|vless|vmess|ss|ssr|hysteria2|hysteria|socks5|http)s?:\/\//i)
    if (!protocolMatch) return null

    const protocol = protocolMatch[1].toLowerCase()
    const hashIndex = url.indexOf('#')
    const name = hashIndex !== -1 ? decodeURIComponent(url.slice(hashIndex + 1)) : `${protocol}-节点`

    // 移除 hash 部分
    let withoutHash = hashIndex !== -1 ? url.slice(0, hashIndex) : url

    // 提取 userinfo 和服务器部分
    const userInfoMatch = withoutHash.match(/^.+:\/\/([^@]+)@(.+)$/)
    if (!userInfoMatch) return null

    const userInfo = userInfoMatch[1]
    const serverPart = userInfoMatch[2]

    // 提取查询参数
    const queryIndex = serverPart.indexOf('?')
    let serverPort: string
    let queryString = ''
    if (queryIndex !== -1) {
      serverPort = serverPart.slice(0, queryIndex)
      queryString = serverPart.slice(queryIndex + 1)
    } else {
      serverPort = serverPart
    }

    // 解析服务器和端口
    const [server, portStr] = serverPort.split(':')
    const port = parseInt(portStr, 10) || 0

    // 解析查询参数
    const params: Record<string, string> = {}
    if (queryString) {
      queryString.split('&').forEach(pair => {
        const [key, value] = pair.split('=')
        if (key) {
          params[decodeURIComponent(key)] = decodeURIComponent(value || '')
        }
      })
    }

    // 根据协议构建节点配置
    const baseConfig: ClashProxyConfig = {
      name,
      type: protocol,
      server,
      port,
    }

    switch (protocol) {
      case 'trojan':
      case 'hysteria2':
        return {
          ...baseConfig,
          password: userInfo,
          ...this.buildTrojanParams(params),
        }

      case 'vless':
        return {
          ...baseConfig,
          uuid: userInfo,
          ...this.buildVlessParams(params),
        }

      case 'vmess':
        return {
          ...baseConfig,
          uuid: userInfo,
          ...this.buildVmessParams(params),
        }

      case 'ss':
        return {
          ...baseConfig,
          ...this.parseSSUserInfo(userInfo),
          ...this.buildSSParams(params),
        }

      case 'ssr':
        return {
          ...baseConfig,
          ...this.parseSSRUserInfo(userInfo),
          ...this.buildSSRParams(params),
        }

      case 'socks5':
      case 'http':
        return {
          ...baseConfig,
          ...this.buildSocks5HttpParams(userInfo, params),
        }

      case 'hysteria':
        return {
          ...baseConfig,
          auth: userInfo,
          ...this.buildHysteriaParams(params),
        }

      default:
        return baseConfig
    }
  }

  /**
   * 构建 Trojan/Hysteria2 参数
   */
  private static buildTrojanParams(params: Record<string, string>): Record<string, unknown> {
    const result: Record<string, unknown> = {}
    if (params.sni) result['sni'] = params.sni
    if (params.tls && params.tls === 'tls') result['tls'] = true
    if (params.insecure === '1') result['skip-cert-verify'] = true
    if (params.type) result['network'] = params.type
    if (params.path) result['ws-path'] = params.path
    if (params.host) result['ws-headers'] = { Host: params.host }
    if (params.mport) result['mport'] = params.mport
    return result
  }

  /**
   * 构建 VLESS 参数
   */
  private static buildVlessParams(params: Record<string, string>): Record<string, unknown> {
    const result: Record<string, unknown> = {}
    if (params.sni) result['sni'] = params.sni
    if (params.servername) result['servername'] = params.servername
    if (params.type) result['network'] = params.type
    if (params.path || params.spx) result['ws-path'] = params.path || params.spx
    if (params.host || params.spX) result['ws-headers'] = { Host: params.host || params.spX }
    if (params.flow) result['flow'] = params.flow
    if (params.security === 'tls') result['tls'] = true
    if (params.security === 'reality') result['reality'] = true
    if (params.pbkey) result['public-key'] = params.pbkey
    if (params.spkts) result['short-id'] = params.spkts || params.sid
    if (params.fp) result['fingerprint'] = params.fp
    return result
  }

  /**
   * 构建 VMess 参数
   */
  private static buildVmessParams(params: Record<string, string>): Record<string, unknown> {
    const result: Record<string, unknown> = {}
    if (params.aid || params.alterId) result['alterId'] = parseInt(params.aid || params.alterId || '0', 10)
    if (params.cipher) result['cipher'] = params.cipher
    if (params.type) result['network'] = params.type
    if (params.path) result['ws-path'] = params.path
    if (params.host) result['servername'] = params.host
    if (params.tls === 'tls' || params.tls === 'true') result['tls'] = true
    if (params.udp === 'true') result['udp'] = true
    return result
  }

  /**
   * 解析 Shadowsocks userinfo (base64 编码的 method:password)
   */
  private static parseSSUserInfo(userInfo: string): Record<string, string> {
    try {
      const decoded = atob(userInfo)
      const [cipher, password] = decoded.split(':')
      return { cipher: cipher || '', password: password || '' }
    } catch {
      // 如果不是有效的 base64，直接作为密码
      return { password: userInfo }
    }
  }

  /**
   * 构建 Shadowsocks 参数
   */
  private static buildSSParams(params: Record<string, string>): Record<string, unknown> {
    const result: Record<string, unknown> = {}
    if (params.plugin) {
      const pluginOpts = params['plugin-opts'] || ''
      const pluginMatch = pluginOpts.match(/;([^;]+)/g)
      if (pluginMatch) {
        pluginMatch.forEach(opt => {
          const [key, value] = opt.slice(1).split('=')
          if (key === 'host') result['servername'] = value
          if (key === 'path') result['ws-path'] = value
        })
      }
    }
    if (params.obfs) result['obfs'] = params.obfs
    if (params.obfs_host) result['obfs-host'] = params.obfs_host
    return result
  }

  /**
   * 解析 SSR userinfo
   */
  private static parseSSRUserInfo(userInfo: string): Record<string, string> {
    const parts = userInfo.split(':')
    return {
      cipher: parts[0] || '',
      password: parts[1] || '',
      protocol: parts[2] || '',
      obfs: parts[3] || '',
    }
  }

  /**
   * 构建 SSR 参数
   */
  private static buildSSRParams(params: Record<string, string>): Record<string, unknown> {
    const result: Record<string, unknown> = {}
    if (params.protocolparam) result['protocol-param'] = params.protocolparam
    if (params.obfsparam) result['obfs-param'] = params.obfsparam
    return result
  }

  /**
   * 构建 SOCKS5/HTTP 参数
   */
  private static buildSocks5HttpParams(userInfo: string, params: Record<string, string>): Record<string, unknown> {
    const result: Record<string, unknown> = {}
    if (userInfo) {
      const [username, password] = userInfo.split(':')
      if (username) result['username'] = username
      if (password) result['password'] = password
    }
    if (params.tls === 'true') result['tls'] = true
    if (params['skip-cert-verify'] === 'true') result['skip-cert-verify'] = true
    return result
  }

  /**
   * 构建 Hysteria 参数
   */
  private static buildHysteriaParams(params: Record<string, string>): Record<string, unknown> {
    const result: Record<string, unknown> = {}
    if (params.sni) result['sni'] = params.sni
    if (params.alpn) result['alpn'] = params.alpn
    if (params.insecure === '1') result['skip-cert-verify'] = true
    if (params.upmbps) result['up'] = parseInt(params.upmbps, 10)
    if (params.downmbps) result['down'] = parseInt(params.downmbps, 10)
    if (params.mport) result['mport'] = params.mport
    return result
  }

  /**
   * 提取所有代理节点
   */
  static extractProxies(config: ClashConfig): ClashProxyConfig[] {
    return config.proxies || []
  }

  /**
   * 验证节点配置
   */
  static validateProxy(proxy: ClashProxyConfig): boolean {
    return !!(
      proxy.name &&
      proxy.type &&
      proxy.server &&
      proxy.port
    )
  }

  /**
   * 转换节点配置用于数据库存储
   */
  static normalizeProxy(proxy: ClashProxyConfig): {
    name: string
    type: string
    server: string
    port: number
    config: Record<string, unknown>
  } {
    const { name, type, server, port, ...rest } = proxy
    return {
      name,
      type,
      server,
      port,
      config: rest,
    }
  }
}
