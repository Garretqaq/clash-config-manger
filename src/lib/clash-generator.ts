import yaml from 'js-yaml'
import type { ClashConfig, ClashProxyConfig, ClashProxyGroup } from './types'

interface GenerateOptions {
  template: string
  proxies: ClashProxyConfig[]
  nodeMapping: Record<string, string[]> // groupName -> (nodeNames | groupNames)
  removeUnusedGroups?: boolean // 是否移除不在 nodeMapping 中的分组
  rules?: string[] // 覆盖模板 rules；未传则维持模板原样
}

export class ClashGenerator {
  /**
   * 生成完整的 Clash 配置
   */
  static generate(options: GenerateOptions): string {
    const { template, proxies, nodeMapping, removeUnusedGroups = false, rules } = options

    // 解析模板
    const config = yaml.load(template) as ClashConfig

    // 设置代理节点
    config.proxies = proxies

    // 覆盖规则（若调用方提供）
    if (rules) {
      config.rules = rules
    }

    // 获取模板中原始的分组名称
    const templateGroupNames = new Set(
      (config['proxy-groups'] || []).map((g) => g.name)
    )

    // 更新分组中的节点
    if (config['proxy-groups']) {
      const nodeMappingGroupNames = Object.keys(nodeMapping)
      config['proxy-groups'] = config['proxy-groups']
        .filter((group) => {
          // 如果启用了移除未使用分组，则过滤掉不在 nodeMapping 中的分组
          if (removeUnusedGroups) {
            return nodeMappingGroupNames.includes(group.name)
          }
          return true
        })
        .map((group) => {
          const mappedNodes = nodeMapping[group.name]
          if (mappedNodes && mappedNodes.length > 0) {
            return {
              ...group,
              proxies: mappedNodes,
            }
          }
          // 如果没有节点，保留原有 proxies（不覆盖为空）
          return group
        })

      // 添加自定义分组（模板中不存在但在 nodeMapping 中的）
      if (removeUnusedGroups) {
        const customGroups = nodeMappingGroupNames
          .filter((name) => !templateGroupNames.has(name))
          .map((name) => ({
            name,
            type: 'select' as const,
            proxies: nodeMapping[name] || [],
          }))
        config['proxy-groups'] = [...config['proxy-groups'], ...customGroups]
      }
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
