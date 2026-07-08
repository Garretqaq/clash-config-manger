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

// 空 rules 数组返回空
assert.deepStrictEqual(parseRules('rules: []'), [])

// 坏 YAML 返回空数组（try/catch 兜底）
assert.deepStrictEqual(parseRules('rules: "unclosed'), [])

// FINAL 类型 + MATCH 带额外尾段：尾段并入 target 不丢数据
const tailContent = `rules:
  - FINAL,🚀自动选择
  - MATCH,🚀自动选择,no-resolve
`
const tailItems = parseRules(tailContent)
assert.deepStrictEqual(tailItems[0], { type: 'FINAL', value: '', target: '🚀自动选择' })
assert.deepStrictEqual(tailItems[1], { type: 'MATCH', value: '', target: '🚀自动选择,no-resolve' })
assert.deepStrictEqual(serializeRules(tailItems), [
  'FINAL,🚀自动选择',
  'MATCH,🚀自动选择,no-resolve',
])

console.log('clash-rules self-check passed')
