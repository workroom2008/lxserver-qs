// 汽水音乐歌词：GET /luna/h5/seo_track（免登录，2026-11-14 实测）。
// lyric.content 为卡拉OK逐字串：`[行起始ms,行时长ms]<字offsetms,字时长ms,0>字…`，\n 分行。
// 转换为 LRC（[mm:ss.xx] 行时间戳 = 行起始ms + 首字offset），原串作为 lxlyric 保留。
import { setFetcher, fetchSeoTrack } from './seoTrack'

// setFetcher/clearCache 再导出：歌词与封面共用同一注入点，测试只注入一次。
export { setFetcher }

const cache = new Map()
const CACHE_TTL_MS = 10 * 60 * 1000
const CACHE_MAX_ENTRIES = 100

const cacheSet = (key, value) => {
  if (cache.size >= CACHE_MAX_ENTRIES) {
    const oldest = cache.keys().next().value
    cache.delete(oldest)
  }
  cache.set(key, { value, time: Date.now() })
}
// 测试隔离用；生产侧无调用方。
export const clearCache = () => cache.clear()

export const karaokeToLrc = (content) => {
  if (typeof content !== 'string' || !content.trim()) {
    throw new Error('汽水歌词失败: 内容为空')
  }
  const pad2 = (n) => String(n).padStart(2, '0')
  const lines = []
  for (const rawLine of content.split('\n')) {
    const header = rawLine.match(/^\[(\d+),(\d+)\]/)
    if (!header) continue
    const lineStart = Number(header[1])
    const rest = rawLine.slice(header[0].length)
    let firstOffset = null
    const chars = []
    for (const match of rest.matchAll(/<(\d+),\d+,\d+>([^<]*)/g)) {
      const offset = Number(match[1])
      if (firstOffset === null) firstOffset = offset
      chars.push(match[2])
    }
    const ts = lineStart + (firstOffset ?? 0)
    const mm = Math.floor(ts / 60000)
    const ss = Math.floor((ts % 60000) / 1000)
    const xx = Math.floor((ts % 1000) / 10)
    lines.push(`[${pad2(mm)}:${pad2(ss)}.${pad2(xx)}]${chars.join('')}`)
  }
  if (lines.length === 0) throw new Error('汽水歌词失败: 无法解析卡拉OK内容')
  return lines.join('\n')
}

export const lyric = {
  getLyric(songInfo) {
    const songmid = songInfo?.songmid ?? songInfo?.songId ?? songInfo?.id
    return {
      promise: (async () => {
        if (!songmid) throw new Error('汽水歌词失败: 缺少歌曲 ID')

        const key = `lyric:${songmid}`
        const cached = cache.get(key)
        if (cached && Date.now() - cached.time <= CACHE_TTL_MS) return cached.value

        let data
        try {
          data = await fetchSeoTrack(songmid)
        } catch (err) {
          throw new Error(`汽水歌词失败: ${err?.message ?? String(err)}`)
        }
        const content = data?.lyric?.content
        if (typeof content !== 'string' || !content.trim()) {
          throw new Error('汽水歌词失败: 响应缺少歌词内容')
        }

        const result = {
          lyric: karaokeToLrc(content),
          tlyric: '',
          rlyric: '',
          lxlyric: content,
        }
        cacheSet(key, result)
        return result
      })(),
    }
  },
}
