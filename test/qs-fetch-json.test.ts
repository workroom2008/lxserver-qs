import test from 'node:test'
import assert from 'node:assert/strict'
import { fetchJson } from '../src/modules/utils/musicSdk/qs/utils'

const ok = (data: any) => ({ promise: Promise.resolve({ statusCode: 200, body: JSON.stringify(data) }) })

test('fetchJson: 正常 JSON 字符串解析', async () => {
  let calls = 0
  const result = await fetchJson(() => {
    calls++
    return ok({ a: 1 })
  }, 'https://x', '测试')
  assert.equal(calls, 1)
  assert.deepEqual(result, { a: 1 })
})

test('fetchJson: 已解析对象透传', async () => {
  const result = await fetchJson(() => ({ promise: Promise.resolve({ statusCode: 200, body: { b: 2 } }) }), 'https://x', '测试')
  assert.deepEqual(result, { b: 2 })
})

test('fetchJson: 空响应自动重试后成功', async () => {
  let calls = 0
  const result = await fetchJson(() => {
    calls++
    return calls <= 2
      ? { promise: Promise.resolve({ statusCode: 200, body: '' }) }
      : ok({ c: 3 })
  }, 'https://x', '测试')
  assert.equal(calls, 3)
  assert.deepEqual(result, { c: 3 })
})

test('fetchJson: 坏 JSON 自动重试后成功', async () => {
  let calls = 0
  const result = await fetchJson(() => {
    calls++
    return calls === 1
      ? { promise: Promise.resolve({ statusCode: 200, body: '<html>blocked</html>' }) }
      : ok({ d: 4 })
  }, 'https://x', '测试')
  assert.equal(calls, 2)
  assert.deepEqual(result, { d: 4 })
})

test('fetchJson: 重试耗尽后抛带上下文错误', async () => {
  let calls = 0
  await assert.rejects(
    () => fetchJson(() => {
      calls++
      return { promise: Promise.resolve({ statusCode: 200, body: '' }) }
    }, 'https://x', '汽水搜索失败', 2),
    /汽水搜索失败.*Unexpected end|汽水搜索失败.*空/,
  )
  assert.equal(calls, 3) // 首次 + 2 次重试
})

test('fetchJson: 网络错误也重试', async () => {
  let calls = 0
  const result = await fetchJson(() => {
    calls++
    return calls === 1
      ? { promise: Promise.reject(new Error('ECONNRESET')) }
      : ok({ e: 5 })
  }, 'https://x', '测试')
  assert.equal(calls, 2)
  assert.deepEqual(result, { e: 5 })
})
