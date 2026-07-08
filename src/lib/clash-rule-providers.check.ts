import assert from 'node:assert'
import { parseRuleProviders, serializeRuleProviders } from './clash-rule-providers'

const content = `rule-providers:
  reject:
    type: http
    behavior: domain
    url: https://cdn.jsdelivr.net/gh/Loyalsoldier/clash-rules@release/reject.txt
    path: ./ruleset/reject.yaml
    interval: 86400
  telegramcidr:
    type: http
    behavior: ipcidr
    url: https://cdn.jsdelivr.net/gh/Loyalsoldier/clash-rules@release/telegramcidr.txt
    path: ./ruleset/telegramcidr.yaml
    interval: 86400
`

const items = parseRuleProviders(content)
assert.strictEqual(items.length, 2)
assert.deepStrictEqual(items[0], {
  name: 'reject',
  type: 'http',
  behavior: 'domain',
  url: 'https://cdn.jsdelivr.net/gh/Loyalsoldier/clash-rules@release/reject.txt',
  path: './ruleset/reject.yaml',
  interval: '86400',
})
assert.deepStrictEqual(items[1], {
  name: 'telegramcidr',
  type: 'http',
  behavior: 'ipcidr',
  url: 'https://cdn.jsdelivr.net/gh/Loyalsoldier/clash-rules@release/telegramcidr.txt',
  path: './ruleset/telegramcidr.yaml',
  interval: '86400',
})

// 往返：序列化后应还原为等价对象（interval 为数字）
const obj = serializeRuleProviders(items)
assert.deepStrictEqual(obj, {
  reject: {
    type: 'http',
    behavior: 'domain',
    url: 'https://cdn.jsdelivr.net/gh/Loyalsoldier/clash-rules@release/reject.txt',
    path: './ruleset/reject.yaml',
    interval: 86400,
  },
  telegramcidr: {
    type: 'http',
    behavior: 'ipcidr',
    url: 'https://cdn.jsdelivr.net/gh/Loyalsoldier/clash-rules@release/telegramcidr.txt',
    path: './ruleset/telegramcidr.yaml',
    interval: 86400,
  },
})

// 无 rule-providers 段返回空数组
assert.deepStrictEqual(parseRuleProviders('proxies: []'), [])

// 空 rule-providers 返回空
assert.deepStrictEqual(parseRuleProviders('rule-providers: {}'), [])

// 坏 YAML 返回空数组
assert.deepStrictEqual(parseRuleProviders('rule-providers: "unclosed'), [])

// interval 为字符串形式时归一为数字输出
const strIntervalContent = `rule-providers:
  foo:
    type: http
    behavior: domain
    url: https://example.com/foo.txt
    path: ./foo.yaml
    interval: '3600'
`
const strItems = parseRuleProviders(strIntervalContent)
assert.strictEqual(strItems[0].interval, '3600')
assert.strictEqual((serializeRuleProviders(strItems) as any).foo.interval, 3600)

// file 类型序列化时省略 url（且空 interval 不输出）
const fileItem = [{ name: 'local', type: 'file', behavior: 'classical', url: '', path: './local.yaml', interval: '' }]
assert.deepStrictEqual(serializeRuleProviders(fileItem), {
  local: { type: 'file', behavior: 'classical', path: './local.yaml' },
})

console.log('clash-rule-providers self-check passed')
