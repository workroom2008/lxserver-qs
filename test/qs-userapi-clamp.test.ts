import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeQualityForSource } from '../src/server/sources/userApi'

test('qs 音质钳制: hires → flac', () => {
  assert.equal(normalizeQualityForSource('qs', 'hires'), 'flac')
})

test('qs 音质钳制: 其他音质原样透传', () => {
  assert.equal(normalizeQualityForSource('qs', '320k'), '320k')
  assert.equal(normalizeQualityForSource('qs', 'flac'), 'flac')
})

test('qs 音质钳制: 其他源不受影响', () => {
  assert.equal(normalizeQualityForSource('kg', 'hires'), 'hires')
  assert.equal(normalizeQualityForSource('wy', 'flac24bit'), 'flac24bit')
})
