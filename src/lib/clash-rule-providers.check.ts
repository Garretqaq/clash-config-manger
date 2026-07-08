import assert from 'node:assert'
import yaml from 'js-yaml'
import { parseRuleProviders, serializeRuleProviders, validateRuleProviders } from './clash-rule-providers'
import type { RuleItem } from './clash-rules'
import { ClashGenerator } from './clash-generator'

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

// --- generate-verification: ruleProviders flows through ClashGenerator ---
const template = `proxies: []
proxy-groups: []
rules: []
`
const generated = ClashGenerator.generate({
  template,
  proxies: [],
  nodeMapping: {},
  ruleProviders: obj,
})
const reparsed = yaml.load(generated) as any
assert.deepStrictEqual(reparsed['rule-providers'], obj)

// 空对象 + 模板无 rule-providers 段 -> 不注入
const generatedEmpty = ClashGenerator.generate({
  template,
  proxies: [],
  nodeMapping: {},
  ruleProviders: {},
})
const reparsedEmpty = yaml.load(generatedEmpty) as any
assert.strictEqual(reparsedEmpty['rule-providers'], undefined)
// --- end generate-verification ---

// validateRuleProviders: 引用存在 -> ok
const okRules: RuleItem[] = [{ type: 'RULE-SET', value: 'reject', target: 'REJECT' }]
assert.strictEqual(validateRuleProviders(okRules, items).ok, true)

// 引用缺失 -> 报错
const badRules: RuleItem[] = [{ type: 'RULE-SET', value: 'nonexist', target: 'REJECT' }]
const badResult = validateRuleProviders(badRules, items)
assert.strictEqual(badResult.ok, false)
assert.ok(badResult.errors.some((e) => e.includes('nonexist')))

// provider 重名 -> 报错
const dupProviders = [
  { name: 'reject', type: 'http', behavior: 'domain', url: 'https://a.com', path: './a.yaml', interval: '86400' },
  { name: 'reject', type: 'http', behavior: 'domain', url: 'https://b.com', path: './b.yaml', interval: '86400' },
]
assert.ok(!validateRuleProviders([], dupProviders).ok)

// http 无 url -> 报错
const noUrl = [{ name: 'x', type: 'http', behavior: 'domain', url: '', path: './x.yaml', interval: '86400' }]
assert.ok(!validateRuleProviders([], noUrl).ok)

console.log('clash-rule-providers self-check passed')
