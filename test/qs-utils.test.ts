import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { mapTrack, buildImageUrl } from '../src/modules/utils/musicSdk/qs/utils'

const fixtureDir = join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'qs')
const fixture = (name: string) => JSON.parse(readFileSync(join(fixtureDir, name), 'utf8'))

test('mapTrack: 搜索结果 track 映射为 lx 歌目形状，ID 保持字符串', () => {
  const d = fixture('search-track.json')
  const raw = d.result_groups[0].data[0].entity.track
  const item = mapTrack(raw)

  assert.equal(item.songmid, '7643728674814986256')
  assert.equal(typeof item.songmid, 'string')
  assert.equal(item.name, raw.name)
  assert.equal(item.singer, 'Twin Tower')
  assert.equal(item.source, 'qs')
  assert.equal(item.albumId, '7643728674814969872')
  assert.match(item.interval, /^\d+:\d{2}$/)
  assert.equal(item._interval, 245)
  assert.deepEqual(item.types.map((t: { type: string }) => t.type), ['128k', '320k', 'flac'])
  assert.equal(item.lrc, null)
  assert.equal(item.hash, null)
})

test('mapTrack: 无 artists/album 的 track 有安全回退', () => {
  const item = mapTrack({ id: 12345, name: '歌', duration: 0 })
  assert.equal(item.singer, '')
  assert.equal(item.albumName, '')
  assert.equal(item.albumId, '')
  assert.equal(item.img, null)
  assert.equal(item.songmid, '12345')
  assert.equal(item._interval, 0)
})

test('buildImageUrl: urls[0]+uri+~template+resize+原扩展名', () => {
  const urlCover = {
    uri: 'tos-cn-i-b829550vbb/abc.png',
    urls: ['https://p3-luna.douyinpic.com/img/', 'https://p6-luna.douyinpic.com/img/'],
    template_prefix: 'tplv-b829550vbb',
  }
  assert.equal(
    buildImageUrl(urlCover),
    'https://p3-luna.douyinpic.com/img/tos-cn-i-b829550vbb/abc.png~tplv-b829550vbb-resize:500:500.png',
  )
})

test('buildImageUrl: 无扩展名 uri 不追加扩展名', () => {
  const urlCover = {
    uri: 'tos-cn-v-2774c002/ok2qXyvVACAsAZvhgEFVFCQDFfVHe8AEBtBAUE',
    urls: ['https://p3-luna.douyinpic.com/img/'],
    template_prefix: 'tplv-b829550vbb',
  }
  assert.equal(
    buildImageUrl(urlCover),
    'https://p3-luna.douyinpic.com/img/tos-cn-v-2774c002/ok2qXyvVACAsAZvhgEFVFCQDFfVHe8AEBtBAUE~tplv-b829550vbb-resize:500:500',
  )
})

test('buildImageUrl: 非法输入返回 null', () => {
  assert.equal(buildImageUrl(null), null)
  assert.equal(buildImageUrl(undefined), null)
  assert.equal(buildImageUrl({}), null)
  assert.equal(buildImageUrl({ uri: 'x' }), null)
  assert.equal(buildImageUrl({ uri: 'x', urls: [] }), null)
})
