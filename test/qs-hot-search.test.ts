import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { hotSearch, setFetcher, clearCache } from '../src/modules/utils/musicSdk/qs/hotSearch'

const fixtureDir = join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'qs')
const fixtureBody = JSON.parse(readFileSync(join(fixtureDir, 'suggest-words-hot.json'), 'utf8'))

test('getList: 解析 suggest_words 为关键词字符串数组', async () => {
  clearCache()
  let calls = 0
  setFetcher(() => {
    calls++
    return { promise: Promise.resolve({ statusCode: 200, body: JSON.parse(JSON.stringify(fixtureBody)) }) }
  })
  const result = await hotSearch.getList()

  assert.equal(calls, 1)
  assert.equal(result.source, 'qs')
  assert.equal(result.list.length, 6)
  assert.equal(result.list[0], 'Lonely')
})

test('getList: 二次调用命中缓存只发一次请求', async () => {
  clearCache()
  let calls = 0
  setFetcher(() => {
    calls++
    return { promise: Promise.resolve({ statusCode: 200, body: JSON.parse(JSON.stringify(fixtureBody)) }) }
  })
  await hotSearch.getList()
  await hotSearch.getList()
  assert.equal(calls, 1)
})

test('getList: 上游失败抛含上下文错误', async () => {
  clearCache()
  setFetcher(() => ({ promise: Promise.reject(new Error('net down')) }))
  await assert.rejects(() => hotSearch.getList(), /汽水热搜失败/)
})
