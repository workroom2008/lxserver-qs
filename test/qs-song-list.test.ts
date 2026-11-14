import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { songList, setFetcher, clearCache } from '../src/modules/utils/musicSdk/qs/songList'

const fixtureDir = join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'qs')
const searchBody = JSON.parse(readFileSync(join(fixtureDir, 'qs-pl.json'), 'utf8'))
const detailBody = JSON.parse(readFileSync(join(fixtureDir, 'qs-pl-detail.json'), 'utf8'))

const fetcherFor = (urls: string[], bodies: Record<string, any>) => (url: string) => {
  urls.push(url)
  const key = url.includes('/search/playlist') ? 'search' : url.includes('/playlist/detail') ? 'detail' : 'other'
  return { promise: Promise.resolve({ statusCode: 200, body: JSON.parse(JSON.stringify(bodies[key])) }) }
}

test('getTags: 8 个预设标签', async () => {
  clearCache()
  const result = await songList.getTags()
  assert.equal(result.source, 'qs')
  assert.equal(result.tags.length, 1)
  assert.equal(result.tags[0].list.length, 8)
  assert.equal(result.tags[0].list[0].name, '热歌')
  assert.equal(result.tags[0].list[0].source, 'qs')
  assert.deepEqual(songList.sortList, [{ id: 'hot', name: '热门' }])
})

test('getList: 标签映射为关键词搜索歌单，条目形状对齐 APP', async () => {
  clearCache()
  const urls: string[] = []
  setFetcher(fetcherFor(urls, { search: searchBody }))
  const result = await songList.getList('hot', 'qs_tag_rege', 1)

  assert.equal(urls.length, 1)
  assert.match(urls[0], /\/luna\/search\/playlist\?/)
  assert.match(urls[0], /q=%E7%83%AD%E6%AD%8C/) // 热歌
  assert.equal(result.source, 'qs')
  assert.ok(result.list.length > 0)
  const first = result.list[0]
  assert.equal(first.id, '7200303206223773734')
  assert.equal(typeof first.id, 'string')
  assert.match(first.name, /抖音流行热歌/)
  assert.equal(first.total, 471)
  assert.equal(first.author, '菊离')
})

test('search: 文本直接搜歌单，同形状', async () => {
  clearCache()
  const urls: string[] = []
  setFetcher(fetcherFor(urls, { search: searchBody }))
  const result = await songList.search('流行', 1)
  assert.match(urls[0], /q=%E6%B5%81%E8%A1%8C/)
  assert.equal(result.list[0].id, '7200303206223773734')
})

test('getListDetail: 首页 20 条、total 471、首条 ID 字符串、info 歌单元数据', async () => {
  clearCache()
  const urls: string[] = []
  setFetcher(fetcherFor(urls, { detail: detailBody }))
  const result = await songList.getListDetail('7200303206223773734', 1)

  assert.equal(urls.length, 1)
  assert.match(urls[0], /\/luna\/playlist\/detail\?/)
  assert.match(urls[0], /playlist_id=7200303206223773734/)
  assert.equal(result.source, 'qs')
  assert.equal(result.total, 471)
  assert.equal(result.list.length, 20)
  assert.equal(result.list[0].songmid, '7654496187366426641')
  assert.equal(typeof result.list[0].songmid, 'string')
  assert.equal(result.list[0].singer, '蒋雪儿Snow.J')
  // Web 端 renderDetail 在 info 缺失时直接 return，详情页整页不渲染
  assert.ok(result.info, '详情响应必须带 info')
  assert.match(result.info.name, /抖音流行热歌/)
  assert.match(result.info.img, /\.jpg$/)
  assert.equal(result.info.author, '菊离')
})

test('getListDetail: 末页切片（471 条 → 第 24 页 11 条），不重复请求', async () => {
  clearCache()
  const urls: string[] = []
  setFetcher(fetcherFor(urls, { detail: detailBody }))
  const page1 = await songList.getListDetail('7200303206223773734', 1)
  const page24 = await songList.getListDetail('7200303206223773734', 24)

  assert.equal(urls.length, 1) // 整单缓存：第二页不重新请求
  assert.equal(page24.total, 471)
  assert.equal(page24.list.length, 471 - 23 * 20)
  assert.equal(page24.page, 24)
})

test('getList: 空 tagId 回退默认标签（热歌），不发空关键词', async () => {
  clearCache()
  const urls: string[] = []
  setFetcher(fetcherFor(urls, { search: searchBody }))
  const result = await songList.getList('hot', '', 1)
  assert.match(urls[0], /q=%E7%83%AD%E6%AD%8C/) // 热歌
  assert.ok(result.list.length > 0)
})

test('getListDetail: 未知 id 且上游失败，抛含上下文错误', async () => {
  clearCache()
  setFetcher(() => ({ promise: Promise.reject(new Error('net down')) }))
  await assert.rejects(() => songList.getListDetail('999', 1), /汽水歌单失败/)
})
