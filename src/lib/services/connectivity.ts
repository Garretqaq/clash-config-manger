import net from 'net'

export interface TestResult {
  nodeId: string
  port: number
  connected: boolean
  error?: string
  timestamp: Date
}

export interface NodeTestData {
  id: string
  type: string
  server: string
  port: number
  config: Record<string, unknown>
}

interface BatchOptions {
  concurrency?: number
  timeout?: number
}

/**
 * 从节点配置中获取测速端口
 */
function getTestPort(node: NodeTestData): number {
  const { config } = node

  // Hysteria/Hysteria2 的 mport 字段可能是 "32000-33000" 格式
  const mport = config?.mport
  if (mport && typeof mport === 'string' && mport.includes('-')) {
    // 取范围的第一个端口
    const [startPort] = mport.split('-')
    return parseInt(startPort, 10) || node.port
  }

  // 如果是单个端口范围值
  if (mport && typeof mport === 'string') {
    const parsed = parseInt(mport, 10)
    if (!isNaN(parsed)) return parsed
  }

  return node.port
}

/**
 * 测试单个节点的 TCP 连通性
 */
export async function testNodeConnectivity(
  node: NodeTestData,
  timeout: number = 3000
): Promise<TestResult> {
  const testPort = getTestPort(node)

  try {
    const connected = await testTCPConnection(node.server, testPort, timeout)
    return {
      nodeId: node.id,
      port: testPort,
      connected,
      error: connected ? undefined : 'TCP 连接失败',
      timestamp: new Date(),
    }
  } catch (error) {
    return {
      nodeId: node.id,
      port: testPort,
      connected: false,
      error: error instanceof Error ? error.message : '未知错误',
      timestamp: new Date(),
    }
  }
}

/**
 * TCP 端口连接测试
 */
function testTCPConnection(host: string, port: number, timeout: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket()
    socket.setTimeout(timeout)

    socket.connect(port, host, () => {
      socket.destroy()
      resolve(true)
    })

    socket.on('error', () => {
      socket.destroy()
      resolve(false)
    })

    socket.on('timeout', () => {
      socket.destroy()
      resolve(false)
    })
  })
}

/**
 * 批量测试节点 TCP 连通性
 */
export async function batchTestNodes(
  nodes: NodeTestData[],
  options: BatchOptions = {}
): Promise<TestResult[]> {
  const { concurrency = 5, timeout = 3000 } = options

  if (nodes.length === 0) return []

  const results: TestResult[] = []

  // 分批处理，控制并发数
  for (let i = 0; i < nodes.length; i += concurrency) {
    const batch = nodes.slice(i, i + concurrency)
    const batchResults = await Promise.all(
      batch.map((node) => testNodeConnectivity(node, timeout))
    )
    results.push(...batchResults)
  }

  return results
}
