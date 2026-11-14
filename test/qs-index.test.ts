import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import musicSdk from '../src/modules/utils/musicSdk/index'

test('qs 模块注册进 musicSdk，导出契约齐全', () => {
  assert.ok(musicSdk.qs, 'musicSdk.qs 应存在')
  const entry = musicSdk.sources.find((s: any) => s.id === 'qs')
  assert.ok(entry, 'sources 列表应包含 qs')
  assert.equal(entry.name, '汽水音乐')

  for (const key of ['musicSearch', 'leaderboard', 'songList', 'hotSearch', 'getMusicUrl', 'getLyric', 'getPic']) {
    assert.ok(musicSdk.qs[key], `qs.${key} 应存在`)
  }
  assert.equal(typeof musicSdk.qs.getMusicUrl, 'function')
  assert.equal(typeof musicSdk.qs.getLyric, 'function')
})

test('server 侧 findMusic 聚合搜索排除 qs', async () => {
  // searchMusic 对 excludeSource 的源不发起搜索；qs 在排除清单中
  let called = false
  const origSearch = musicSdk.qs.musicSearch.search
  musicSdk.qs.musicSearch.search = (...args: any[]) => {
    called = true
    return origSearch.apply(musicSdk.qs.musicSearch, args)
  }
  try {
    await musicSdk.searchMusic({ name: '晴天', singer: '', source: 'wy' })
    assert.equal(called, false, 'qs 不应参与 server 端聚合搜索')
  } finally {
    musicSdk.qs.musicSearch.search = origSearch
  }
})

test('tipSearch: 联想词返回字符串数组', async () => {
  const { tipSearch, setFetcher } = await import('../src/modules/utils/musicSdk/qs/tipSearch')
  clearTipCache(tipSearch)
  const sugBody = JSON.parse(
    readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'qs', 'pc-sug.json'), 'utf8'),
  )
  setFetcher(() => ({ promise: Promise.resolve({ statusCode: 200, body: JSON.parse(JSON.stringify(sugBody)) }) }))
  const tips = await tipSearch.search('晴天')
  assert.ok(Array.isArray(tips))
  assert.ok(tips.length > 0)
  assert.equal(typeof tips[0], 'string')
})

// tipSearch 模块的缓存清空助手
function clearTipCache(tip: any) {
  if (typeof tip.clearCache === 'function') tip.clearCache()
}
