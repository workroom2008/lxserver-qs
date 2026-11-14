import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { leaderboard, setFetcher, clearCache } from '../src/modules/utils/musicSdk/qs/leaderboard'

const fixtureDir = join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'qs')
const fixtureBody = JSON.parse(readFileSync(join(fixtureDir, 'charts-hot.json'), 'utf8'))

test('getBoards: 三榜静态清单', async () => {
  clearCache()
  const result = await leaderboard.getBoards()
  assert.equal(result.source, 'qs')
  assert.equal(result.list.length, 3)
  assert.equal(result.list[0].name, '热歌榜')
  assert.equal(result.list[0].bangid, '7036274230471712007')
  assert.equal(result.list[2].name, '欧美榜')
})

test('getList: 热歌榜解析 50 首，rank 信息不进歌目，ID 字符串', async () => {
  clearCache()
  let calls = 0
  const urls: string[] = []
  setFetcher((url: string) => {
    calls++
    urls.push(url)
    return { promise: Promise.resolve({ statusCode: 200, body: JSON.parse(JSON.stringify(fixtureBody)) }) }
  })
  const result = await leaderboard.getList('7036274230471712007', 1)

  assert.equal(calls, 1)
  assert.match(urls[0], /\/luna\/pc\/charts\/7036274230471712007\?charge=0/)
  assert.equal(result.source, 'qs')
  assert.equal(result.limit, 50)
  assert.equal(result.page, 1)
  assert.equal(result.list.length, 50)
  assert.equal(result.total, 50)
  assert.equal(typeof result.list[0].songmid, 'string')
  assert.equal(result.list[0].songmid, '6778775242320906241')
})

test('getList: page>1 返回空列表不发起请求', async () => {
  clearCache()
  let calls = 0
  setFetcher((url: string) => {
    calls++
    return { promise: Promise.resolve({ statusCode: 200, body: JSON.parse(JSON.stringify(fixtureBody)) }) }
  })
  const result = await leaderboard.getList('7036274230471712007', 2)
  assert.equal(calls, 0)
  assert.deepEqual(result.list, [])
  assert.equal(result.page, 2)
})

test('getList: 主机失败回退 beta-luna 主机', async () => {
  clearCache()
  const urls: string[] = []
  setFetcher((url: string) => {
    urls.push(url)
    if (url.includes('api.qishui.com')) {
      return { promise: Promise.reject(new Error('primary down')) }
    }
    return { promise: Promise.resolve({ statusCode: 200, body: JSON.parse(JSON.stringify(fixtureBody)) }) }
  })
  const result = await leaderboard.getList('7036274230471712007', 1)
  assert.equal(urls.length, 2)
  assert.match(urls[0], /api\.qishui\.com/)
  assert.match(urls[1], /beta-luna\.douyin\.com/)
  assert.equal(result.list.length, 50)
})

test('getList: 缓存命中只发一次请求', async () => {
  clearCache()
  let calls = 0
  setFetcher((url: string) => {
    calls++
    return { promise: Promise.resolve({ statusCode: 200, body: JSON.parse(JSON.stringify(fixtureBody)) }) }
  })
  await leaderboard.getList('7036274230471712007', 1)
  await leaderboard.getList('7036274230471712007', 1)
  assert.equal(calls, 1)
})
