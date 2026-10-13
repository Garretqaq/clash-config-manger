import assert from 'node:assert'
import yaml from 'js-yaml'
import { parseDns, serializeDns, validateDns, applyPreset, DNS_PRESET, type DnsConfig } from './clash-dns'
import { ClashGenerator } from './clash-generator'

// 用户示例配置（含 geoip-code 与缩进块式序列）
const content = `dns:
  enable: true
  ipv6: false
  default-nameserver:
    - 223.5.5.5
    - 119.29.29.29
  enhanced-mode: fake-ip
  fake-ip-range: 198.18.0.1/16
  use-hosts: true
  nameserver:
    - https://doh.pub/dns-query
    - https://dns.alidns.com/dns-query
  fallback:
    - https://dns.cloudflare.com/dns-query
    - https://dns.google/dns-query
    - tls://8.8.4.4:853
  fallback-filter:
    geoip: true
    geoip-code: CN
    ipcidr:
      - 240.0.0.0/4
      - 0.0.0.0/32
proxies: []
`

const dns = parseDns(content)
assert.strictEqual(dns.enable, true)
assert.strictEqual(dns.ipv6, false)
assert.deepStrictEqual(dns['default-nameserver'], ['223.5.5.5', '119.29.29.29'])
assert.strictEqual(dns['enhanced-mode'], 'fake-ip')
assert.strictEqual(dns['fake-ip-range'], '198.18.0.1/16')
assert.strictEqual(dns['use-hosts'], true)
assert.deepStrictEqual(dns.nameserver, [
  'https://doh.pub/dns-query',
  'https://dns.alidns.com/dns-query',
])
assert.deepStrictEqual(dns.fallback, [
  'https://dns.cloudflare.com/dns-query',
  'https://dns.google/dns-query',
  'tls://8.8.4.4:853',
])
assert.deepStrictEqual(dns['fallback-filter'], {
  geoip: true,
  'geoip-code': 'CN',
  ipcidr: ['240.0.0.0/4', '0.0.0.0/32'],
})

// 往返：序列化后与解析结果一致（geoip-code 作为透传键保留）
assert.deepStrictEqual(serializeDns(dns), {
  enable: true,
  ipv6: false,
  'default-nameserver': ['223.5.5.5', '119.29.29.29'],
  'enhanced-mode': 'fake-ip',
  'fake-ip-range': '198.18.0.1/16',
  'use-hosts': true,
  nameserver: ['https://doh.pub/dns-query', 'https://dns.alidns.com/dns-query'],
  fallback: [
    'https://dns.cloudflare.com/dns-query',
    'https://dns.google/dns-query',
    'tls://8.8.4.4:853',
  ],
  'fallback-filter': { geoip: true, 'geoip-code': 'CN', ipcidr: ['240.0.0.0/4', '0.0.0.0/32'] },
})

// 流式序列写法同样解析正确
const flow = parseDns(`dns: { enable: true, default-nameserver: [223.5.5.5], fallback-filter: { geoip: true, ipcidr: [0.0.0.0/32] } }\n`)
assert.deepStrictEqual(flow['default-nameserver'], ['223.5.5.5'])
assert.deepStrictEqual(flow['fallback-filter'], { geoip: true, ipcidr: ['0.0.0.0/32'] })

// 未列入一等字段的子键原样保留（dns 层 + fallback-filter 层）
const extra = parseDns(`dns:
  enable: true
  nameserver: [1.1.1.1]
  fake-ip-filter: ['*.local', '+.lan']
  listen: 0.0.0.0:1053
  fallback-filter:
    geoip: true
    domain: ['+.google.com']
`)
assert.deepStrictEqual(extra['fake-ip-filter'], ['*.local', '+.lan'])
assert.strictEqual(extra.listen, '0.0.0.0:1053')
assert.deepStrictEqual((extra['fallback-filter'] as Record<string, unknown>).domain, ['+.google.com'])
assert.deepStrictEqual((extra['fallback-filter'] as Record<string, unknown>).geoip, true)
// 透传键在序列化后仍在
const extraOut = serializeDns(extra)
assert.deepStrictEqual(extraOut['fake-ip-filter'], ['*.local', '+.lan'])
assert.deepStrictEqual((extraOut['fallback-filter'] as Record<string, unknown>).domain, ['+.google.com'])

// 标量形式的列表键归一等价于单元素数组
assert.deepStrictEqual(parseDns('dns:\n  default-nameserver: 223.5.5.5\n')['default-nameserver'], ['223.5.5.5'])

// 空/坏/类型不符输入一律 {}，且序列化为空对象
assert.deepStrictEqual(parseDns('proxies: []'), {})
assert.deepStrictEqual(parseDns('dns: "unclosed'), {})
assert.deepStrictEqual(parseDns('dns: []'), {})
assert.deepStrictEqual(parseDns(''), {})
assert.deepStrictEqual(serializeDns({}), {})

// 空字符串 / 空列表在序列化时被丢弃（清空表单不会写回空值）
assert.deepStrictEqual(serializeDns({ 'fake-ip-range': '  ', nameserver: [], fallback: ['1.1.1.1'] }), {
  fallback: ['1.1.1.1'],
})
// enable: false 保留（不能当空值丢弃）
assert.deepStrictEqual(serializeDns({ enable: false }), { enable: false })

// generate 注入：非空总是覆盖
const template = `proxies: []\nproxy-groups: []\ndns:\n  enable: true\n  nameserver: [8.8.8.8]\n`
const overridden = yaml.load(
  ClashGenerator.generate({ template, proxies: [], nodeMapping: {}, dns: { enable: false, nameserver: ['1.1.1.1'] } }),
) as Record<string, unknown>
assert.deepStrictEqual(overridden.dns, { enable: false, nameserver: ['1.1.1.1'] })

// 空对象 + 源无 dns 段 -> 不注入（不凭空造 dns: {}）
const noDns = yaml.load(
  ClashGenerator.generate({ template: 'proxies: []\n', proxies: [], nodeMapping: {}, dns: {} }),
) as Record<string, unknown>
assert.strictEqual(noDns.dns, undefined)

// 空对象 + 源有 dns 段 -> 删除该段
const cleared = yaml.load(
  ClashGenerator.generate({ template, proxies: [], nodeMapping: {}, dns: {} }),
) as Record<string, unknown>
assert.strictEqual(cleared.dns, undefined)

// 未传 dns -> 维持模板原样（向后兼容）
const untouched = yaml.load(
  ClashGenerator.generate({ template, proxies: [], nodeMapping: {} }),
) as Record<string, unknown>
assert.deepStrictEqual(untouched.dns, { enable: true, nameserver: ['8.8.8.8'] })

// 源无 dns 段 + 非空 dns -> 新增该段
const added = yaml.load(
  ClashGenerator.generate({
    template: 'proxies: []\n',
    proxies: [],
    nodeMapping: {},
    dns: { enable: true, nameserver: ['1.1.1.1'] },
  }),
) as Record<string, unknown>
assert.deepStrictEqual(added.dns, { enable: true, nameserver: ['1.1.1.1'] })

// validateDns：四个轻校验
const okDns: DnsConfig = {
  enable: true,
  nameserver: ['1.1.1.1'],
  'fake-ip-range': '198.18.0.1/16',
  'enhanced-mode': 'fake-ip',
  'fallback-filter': { geoip: true, ipcidr: ['240.0.0.0/4'] },
}
assert.strictEqual(validateDns(okDns).ok, true)
assert.strictEqual(validateDns({}).ok, true)

const noNs = validateDns({ enable: true, nameserver: [] })
assert.strictEqual(noNs.ok, false)
assert.ok(noNs.errors.some((e) => e.includes('nameserver')))

const badRange = validateDns({ enable: true, nameserver: ['1.1.1.1'], 'fake-ip-range': '198.18.0.1' })
assert.strictEqual(badRange.ok, false)
assert.ok(badRange.errors.some((e) => e.includes('fake-ip-range')))

// geoip-code 未显式写出时不拦；显式写出且为空时拦
assert.strictEqual(
  validateDns({ enable: true, nameserver: ['1.1.1.1'], 'fallback-filter': { geoip: true } }).ok,
  true,
)
assert.strictEqual(
  validateDns({ enable: true, nameserver: ['1.1.1.1'], 'fallback-filter': { geoip: true, 'geoip-code': '  ' } }).ok,
  false,
)

const badMode = validateDns({ enable: true, nameserver: ['1.1.1.1'], 'enhanced-mode': 'bogus' })
assert.strictEqual(badMode.ok, false)
assert.ok(badMode.errors.some((e) => e.includes('enhanced-mode')))

// 合法 CIDR 边界
assert.strictEqual(validateDns({ 'fake-ip-range': '198.18.0.1/32' }).ok, true)
assert.strictEqual(validateDns({ 'fake-ip-range': '198.18.0.1/33' }).ok, false)
assert.strictEqual(validateDns({ 'fake-ip-range': '999.18.0.1/16' }).ok, false)
assert.strictEqual(validateDns({ 'fake-ip-range': 'fd00::/8' }).ok, true)

// 推荐配置：填满一等字段，且保留用户已有透传键
assert.deepStrictEqual(DNS_PRESET.nameserver, [
  'https://doh.pub/dns-query',
  'https://dns.alidns.com/dns-query',
])
const preset = applyPreset({ 'fake-ip-filter': ['*.local'] })
assert.deepStrictEqual(preset['fake-ip-filter'], ['*.local'])
assert.strictEqual(preset['enhanced-mode'], 'fake-ip')
assert.deepStrictEqual(preset['default-nameserver'], ['223.5.5.5', '119.29.29.29'])
assert.deepStrictEqual(preset.fallback, DNS_PRESET.fallback)
assert.deepStrictEqual(preset['fallback-filter'], DNS_PRESET['fallback-filter'])
assert.deepStrictEqual(validateDns(preset).ok, true)

console.log('clash-dns self-check passed')
