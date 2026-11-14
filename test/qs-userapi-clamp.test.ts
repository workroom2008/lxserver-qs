import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeQualityForSource } from '../src/server/sources/userApi'

test('qs 音质钳制: 默认上限 320k（hires/flac 均降为 320k，上游 flac 资源加密/VIP 不可播）', () => {
  assert.equal(normalizeQualityForSource('qs', 'hires'), '320k')
  assert.equal(normalizeQualityForSource('qs', 'flac'), '320k')
})

test('qs 音质钳制: 上限以内原样透传', () => {
  assert.equal(normalizeQualityForSource('qs', '320k'), '320k')
  assert.equal(normalizeQualityForSource('qs', '128k'), '128k')
})

test('qs 音质钳制: 其他源不受影响', () => {
  assert.equal(normalizeQualityForSource('kg', 'hires'), 'hires')
  assert.equal(normalizeQualityForSource('wy', 'flac24bit'), 'flac24bit')
})

test('qs 音质钳制: 上限可通过配置调整为 flac（上游修复后后台改设置即恢复无损）', () => {
  assert.equal(normalizeQualityForSource('qs', 'hires', 'flac'), 'flac')
  assert.equal(normalizeQualityForSource('qs', 'flac', 'flac'), 'flac')
  assert.equal(normalizeQualityForSource('qs', '320k', 'flac'), '320k')
})

test('qs 音质钳制: 非法配置回退 320k', () => {
  assert.equal(normalizeQualityForSource('qs', 'flac', 'bogus'), '320k')
  assert.equal(normalizeQualityForSource('qs', 'flac', ''), '320k')
})
