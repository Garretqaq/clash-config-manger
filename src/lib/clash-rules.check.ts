import assert from 'node:assert'
import { parseRules, serializeRules } from './clash-rules'

const content = `rules:
  - RULE-SET,google,🚀自动选择
  - IP-CIDR,127.0.0.0/8,DIRECT,no-resolve
  - MATCH,🚀自动选择
`

const items = parseRules(content)
assert.deepStrictEqual(items[0], { type: 'RULE-SET', value: 'google', target: '🚀自动选择' })
assert.deepStrictEqual(items[1], { type: 'IP-CIDR', value: '127.0.0.0/8', target: 'DIRECT,no-resolve' })
assert.deepStrictEqual(items[2], { type: 'MATCH', value: '', target: '🚀自动选择' })

// 往返：序列化后应还原为原始规则行
assert.deepStrictEqual(serializeRules(items), [
  'RULE-SET,google,🚀自动选择',
  'IP-CIDR,127.0.0.0/8,DIRECT,no-resolve',
  'MATCH,🚀自动选择',
])

// 无 rules 段返回空数组
assert.deepStrictEqual(parseRules('proxies: []'), [])

console.log('clash-rules self-check passed')
