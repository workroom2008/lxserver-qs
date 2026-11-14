import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { musicSearch, setFetcher } from '../src/modules/utils/musicSdk/qs/musicSearch'

const fixtureDir = join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'qs')
const fixtureBody = JSON.parse(readFileSync(join(fixtureDir, 'search-track.json'), 'utf8'))

// 与真实 httpFetch 契约一致：同步返回 {promise}。
const fakeFetcher = (body, counter: { calls: number }) => (url: string) => {
  counter.calls++
  counter.lastUrl = url
  return { promise: Promise.resolve({ statusCode: 200, body: JSON.parse(JSON.stringify(body)) }) }
}

test('search: 解析 fixture 首页 20 条，ID 字符串，has_more 时 allPage≥2', async () => {
  const counter = { calls: 0, lastUrl: '' }
  setFetcher(fakeFetcher(fixtureBody, counter))
  const result = await musicSearch.search('流行', 1, 20)

  assert.equal(counter.calls, 1)
  assert.match(counter.lastUrl, /\/luna\/search\/track\?/)
  assert.match(counter.lastUrl, /q=%E6%B5%81%E8%A1%8C/)
  assert.match(counter.lastUrl, /cursor=0/)
  assert.match(counter.lastUrl, /aid=386088/)
  assert.equal(result.source, 'qs')
  assert.equal(result.list.length, 20)
  assert.equal(typeof result.list[0].songmid, 'string')
  assert.equal(result.list[0].source, 'qs')
  assert.equal(result.has_more === undefined || result.has_more === undefined, true) // 不向外暴露原始字段
  assert.ok(result.allPage >= 2, `has_more=true 时 allPage 应≥2，实际 ${result.allPage}`)
  assert.equal(result.limit, 20)
})

test('search: 同参数二次调用命中缓存只发一次请求', async () => {
  const counter = { calls: 0, lastUrl: '' }
  setFetcher(fakeFetcher(fixtureBody, counter))
  await musicSearch.search('缓存测试', 1, 20)
  await musicSearch.search('缓存测试', 1, 20)
  assert.equal(counter.calls, 1)
})

test('search: limit≠20 时按 limit 截断', async () => {
  const counter = { calls: 0, lastUrl: '' }
  setFetcher(fakeFetcher(fixtureBody, counter))
  const result = await musicSearch.search('流行', 1, 5)
  assert.equal(result.list.length, 5)
  assert.equal(result.limit, 5)
})

test('search: 上游失败时抛出含上下文的错误', async () => {
  setFetcher(() => ({ promise: Promise.reject(new Error('boom')) }))
  await assert.rejects(() => musicSearch.search('失败', 1, 20), /汽水搜索失败/)
})
