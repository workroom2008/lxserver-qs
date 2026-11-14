import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { hotSearch, setFetcher, clearCache } from '../src/modules/utils/musicSdk/qs/hotSearch'
import { leaderboard, setFetcher as setLbFetcher, clearCache as clearLbCache } from '../src/modules/utils/musicSdk/qs/leaderboard'

const fixtureDir = join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'qs')
const fixtureBody = JSON.parse(readFileSync(join(fixtureDir, 'suggest-words-hot.json'), 'utf8'))
const chartsBody = JSON.parse(readFileSync(join(fixtureDir, 'charts-hot.json'), 'utf8'))

// 分别注入两个模块：hotSearch 走 suggest-words，榜单补位走 leaderboard 模块
const injectBoth = (counter?: { calls: number }) => {
  setFetcher((url: string) => {
    if (counter) counter.calls++
    return { promise: Promise.resolve({ statusCode: 200, body: JSON.parse(JSON.stringify(fixtureBody)) }) }
  })
  setLbFetcher((url: string) => {
    if (counter) counter.calls++
    return { promise: Promise.resolve({ statusCode: 200, body: JSON.parse(JSON.stringify(chartsBody)) }) }
  })
}

const clearAllCaches = () => {
  clearCache()
  clearLbCache()
}

test('getList: 真实热搜词打头，不足 20 用热歌榜歌名补位', async () => {
  clearAllCaches()
  const counter = { calls: 0 }
  injectBoth(counter)
  const result = await hotSearch.getList()

  assert.equal(result.source, 'qs')
  assert.ok(result.list.length >= 20, `应补位到 ≥20 条，实际 ${result.list.length}`)
  // 前 6 条 = 上游真实热搜词（顺序保持）
  assert.deepEqual(result.list.slice(0, 6), ['Lonely', '琵琶曲', '慢速重播', '牡丹亭', '外婆的桂花糕', '我走后'])
  // 补位词来自热歌榜（去重后无空词）
  assert.ok(result.list.every((w: string) => typeof w === 'string' && w.trim()))
  const uniq = new Set(result.list)
  assert.equal(uniq.size, result.list.length, '补位词不得与热搜词/彼此重复')
})

test('getList: 二次调用命中缓存只发一次请求', async () => {
  clearAllCaches()
  const counter = { calls: 0 }
  injectBoth(counter)
  await hotSearch.getList()
  await hotSearch.getList()
  assert.equal(counter.calls, 2) // suggest + charts 各一次，缓存后不再发
})

test('getList: 上游失败抛含上下文错误', async () => {
  clearAllCaches()
  setFetcher(() => ({ promise: Promise.reject(new Error('net down')) }))
  await assert.rejects(() => hotSearch.getList(), /汽水热搜失败/)
})

