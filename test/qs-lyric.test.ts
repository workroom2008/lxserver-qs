import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { lyric, karaokeToLrc, setFetcher, clearCache } from '../src/modules/utils/musicSdk/qs/lyric'
import { pic } from '../src/modules/utils/musicSdk/qs/pic'

const fixtureDir = join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'qs')
const seoBody = JSON.parse(readFileSync(join(fixtureDir, 'qs-seo.json'), 'utf8'))

test('karaokeToLrc: 行数与首行时间戳/文本', () => {
  const content = seoBody.lyric.content
  const lrc = karaokeToLrc(content)
  const srcLines = content.split('\n').filter((l) => l.trim())
  const outLines = lrc.split('\n').filter((l) => l.trim())

  assert.equal(outLines.length, srcLines.length)
  // 14690ms → 00:14.69
  assert.match(outLines[0], /^\[00:14\.69\]/)
  assert.equal(outLines[0].replace(/^\[\d+:\d+\.\d+\]/, ''), '故事的小黄花 从出生那年就飘着')
})

test('karaokeToLrc: 空内容抛错', () => {
  assert.throws(() => karaokeToLrc(''), /汽水歌词/)
})

test('getLyric: 返回 {lyric, tlyric, rlyric, lxlyric}，lxlyric 必须为空', async () => {
  clearCache()
  let url = ''
  setFetcher((u: string) => {
    url = u
    return { promise: Promise.resolve({ statusCode: 200, body: JSON.parse(JSON.stringify(seoBody)) }) }
  })
  const request = lyric.getLyric({ songmid: '7676337516358617115' })
  const result = await request.promise

  assert.match(url, /\/luna\/h5\/seo_track\?track_id=7676337516358617115/)
  assert.match(result.lyric, /^\[00:14\.69\]故事的小黄花/)
  // Web 端 LinePlayer 优先吃 lxlyric 且解析不了汽水卡拉OK变体（渲染为空），
  // 因此响应绝不能带逐字串
  assert.equal(result.lxlyric, '')
  assert.equal(result.tlyric, '')
  assert.equal(result.rlyric, '')
})

test('getLyric: 上游失败抛含上下文错误', async () => {
  clearCache()
  setFetcher(() => ({ promise: Promise.reject(new Error('net down')) }))
  await assert.rejects(() => lyric.getLyric({ songmid: '1' }).promise, /汽水歌词失败/)
})

test('getLyric: 缓存超过 100 条时淘汰最旧条目', async () => {
  clearCache()
  const karaoke = '[0,100]<0,50,0>词'
  let calls = 0
  setFetcher((u: string) => {
    calls++
    return {
      promise: Promise.resolve({
        statusCode: 200,
        body: { lyric: { content: karaoke }, seo_track: { track: {} } },
      }),
    }
  })
  // 写入 1 首 + 100 首不同的歌，共 101 条 → 第 1 首被淘汰
  await lyric.getLyric({ songmid: 'keep-me' }).promise
  for (let i = 0; i < 100; i++) {
    await lyric.getLyric({ songmid: `filler-${i}` }).promise
  }
  const callsBefore = calls
  await lyric.getLyric({ songmid: 'keep-me' }).promise
  assert.equal(calls, callsBefore + 1, 'keep-me 已被淘汰，应重新发起请求')
})

test('getPic: 从 seo_track 取封面（无扩展名 uri 补 .jpg）', async () => {
  clearCache()
  setFetcher((u: string) => ({ promise: Promise.resolve({ statusCode: 200, body: JSON.parse(JSON.stringify(seoBody)) }) }))
  const url = await pic.getPic({ songmid: '7676337516358617115' })
  assert.equal(
    url,
    'https://p3-luna.douyinpic.com/img/tos-cn-v-2774c002/oIAIAITAzvMIVFCeSAWEEgfGIeCGaCLtGqbBpj~tplv-b829550vbb-resize:500:500.jpg',
  )
})
