// 汽水音乐公开端点公共工具：纯函数，不发请求。
// 所有 ID 上游即为 JSON 字符串，全程保持字符串，防止 >2^53 精度丢失。
import { formatPlayTime } from '../../index'

export const PC_API_BASE = 'https://api.qishui.com'
export const BETA_LUNA_BASE = 'https://beta-luna.douyin.com'

export const COMMON_PARAMS = {
  aid: '386088',
  device_platform: 'web',
  channel: 'pc_web',
}

export const buildQuery = (extra = {}) => {
  const params = { ...COMMON_PARAMS, ...extra }
  return Object.entries(params)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    .join('&')
}

// url_cover: { uri, urls: ['https://p3-luna.douyinpic.com/img/', ...], template_prefix }
// 最终图 URL 形如 urls[0] + uri + '~' + template_prefix + '-resize:W:H' + uri 原扩展名（无扩展名则不追加）。
export const buildImageUrl = (urlCover, size = '500:500') => {
  if (!urlCover || typeof urlCover !== 'object') return null
  const { uri, urls, template_prefix: templatePrefix } = urlCover
  if (!uri || !Array.isArray(urls) || urls.length === 0 || !templatePrefix) return null
  const base = urls[0]
  if (typeof base !== 'string' || !base) return null
  const dotIndex = uri.lastIndexOf('.')
  const slashIndex = uri.lastIndexOf('/')
  const ext = dotIndex > slashIndex ? uri.slice(dotIndex) : ''
  return `${base}${uri}~${templatePrefix}-resize:${size}${ext}`
}

const DEFAULT_TYPES = [{ type: '128k' }, { type: '320k' }, { type: 'flac' }]

// 汽水 track → lx 歌目形状（与 kg/musicSearch.js filterData 同形）。
// 音质档固定 128k/320k/flac：与聆澜脚本 MUSIC_QUALITY.qs 对齐，取链走脚本。
export const mapTrack = (track) => {
  const durationSec = Math.round((track.duration || 0) / 1000)
  return {
    singer: (track.artists || []).map((a) => a.name).join(' / '),
    name: track.name || '',
    albumName: track.album?.name ?? '',
    albumId: track.album?.id != null ? String(track.album.id) : '',
    songmid: String(track.id),
    source: 'qs',
    interval: formatPlayTime(durationSec),
    _interval: durationSec,
    img: buildImageUrl(track.album?.url_cover),
    lrc: null,
    otherSource: null,
    hash: null,
    types: DEFAULT_TYPES.map((t) => ({ ...t })),
    _types: {},
    typeUrl: {},
  }
}
