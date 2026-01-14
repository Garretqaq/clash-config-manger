import yaml from 'js-yaml'
import type { ClashConfig, ClashProxyConfig, ClashProxyGroup } from './types'

interface GenerateOptions {
  template: string
  proxies: ClashProxyConfig[]
  nodeMapping: Record<string, string[]> // groupName -> nodeNames
}

export class ClashGenerator {
  /**
   * 生成完整的 Clash 配置
   */
  static generate(options: GenerateOptions): string {
    const { template, proxies, nodeMapping } = options

    // 解析模板
    const config = yaml.load(template) as ClashConfig

    // 设置代理节点
    config.proxies = proxies

    // 更新分组中的节点
    if (config['proxy-groups']) {
      config['proxy-groups'] = config['proxy-groups'].map((group) => {
        const mappedNodes = nodeMapping[group.name]
        if (mappedNodes && mappedNodes.length > 0) {
          return {
            ...group,
            proxies: mappedNodes,
          }
        }
        return group
      })
    }

    return yaml.dump(config, {
      indent: 2,
      lineWidth: -1,
      noRefs: true,
      sortKeys: false,
    })
  }

  /**
   * 生成代理节点配置
   */
  static generateProxies(nodes: Array<{
    name: string
    type: string
    server: string
    port: number
    config: Record<string, unknown>
  }>): ClashProxyConfig[] {
    return nodes.map((node) => ({
      name: node.name,
      type: node.type,
      server: node.server,
      port: node.port,
      ...node.config,
    }))
  }

  /**
   * 创建默认分组配置
   */
  static createDefaultGroups(): ClashProxyGroup[] {
    return [
      {
        name: 'Proxy',
        type: 'select',
        proxies: [],
      },
      {
        name: 'Auto',
        type: 'url-test',
        proxies: [],
        url: 'http://www.gstatic.com/generate_204',
        interval: 300,
      },
    ]
  }

  /**
   * 验证模板格式
   */
  static validateTemplate(template: string): { valid: boolean; error?: string } {
    try {
      const config = yaml.load(template) as ClashConfig
      if (!config) {
        return { valid: false, error: '配置为空' }
      }
      return { valid: true }
    } catch (error) {
      return { valid: false, error: String(error) }
    }
  }
}
