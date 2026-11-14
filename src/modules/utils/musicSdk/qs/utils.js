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
// 最终图 URL 形如 urls[0] + uri + '~' + template_prefix + '-resize:W:H' + 扩展名。
// 扩展名取 uri 自带的（.png/.jpg 等）；uri 无扩展名时必须补 .jpg——
// 实测（2026-11-14）无格式后缀的模板 URL 返回 HTTP 400，补 .jpg 后返回 200 image/jpeg。
export const buildImageUrl = (urlCover, size = '500:500') => {
  if (!urlCover || typeof urlCover !== 'object') return null
  const { uri, urls, template_prefix: templatePrefix } = urlCover
  if (!uri || !Array.isArray(urls) || urls.length === 0 || !templatePrefix) return null
  const base = urls[0]
  if (typeof base !== 'string' || !base) return null
  const dotIndex = uri.lastIndexOf('.')
  const slashIndex = uri.lastIndexOf('/')
  const ext = dotIndex > slashIndex ? uri.slice(dotIndex) : '.jpg'
  return `${base}${uri}~${templatePrefix}-resize:${size}${ext}`
}

const DEFAULT_TYPES = [{ type: '128k' }, { type: '320k' }, { type: 'flac' }]

// 统一的"取数 + 解析"：汽水匿名端点偶发返回空 body/坏 JSON（软限流，2026-11-14 容器内实测复现），
// 统一自动重试，重试耗尽后抛出带业务上下文的错误。
// doFetch: (url) => { promise }; label: 错误信息业务前缀。
export const fetchJson = async (doFetch, url, label, retries = 2) => {
  let lastErr = null
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) {
      await new Promise((resolve) => setTimeout(resolve, 400 * attempt))
    }
    try {
      const response = await doFetch(url).promise
      const body = response?.body
      if (body == null || (typeof body === 'string' && !body.trim())) {
        lastErr = new Error('上游返回空响应')
        continue
      }
      if (typeof body !== 'string') return body
      return JSON.parse(body)
    } catch (err) {
      lastErr = err
    }
  }
  throw new Error(`${label}: ${lastErr?.message ?? String(lastErr)}`)
}

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
