// 汽水音乐热搜词：GET /luna/suggest-words/hot（免登录，2026-11-14 实测）。
// 该匿名端点固定返回 6 条（实测 count/page/limit 及其他 suggest_type 均无效），
// 不足 20 条时用热歌榜歌名补位充当"推荐搜索词"（榜单端点同样匿名可用，真实曲目）。
import { httpFetch } from '../../request'
import { PC_API_BASE, buildQuery, fetchJson } from './utils'
import { leaderboard } from './leaderboard'

const CACHE_TTL_MS = 5 * 60 * 1000
const MIN_WORDS = 20

let fetcher = null
export const setFetcher = (fn) => {
  fetcher = fn
}
const doFetch = (url) => (fetcher ? fetcher(url) : httpFetch(url))

let cache = { value: null, time: 0 }

// 清空缓存（测试隔离用；生产侧无调用方）。
export const clearCache = () => {
  cache = { value: null, time: 0 }
}


const fetchHotWords = async () => {
  const url = `${PC_API_BASE}/luna/suggest-words/hot?${buildQuery()}`
  const data = await fetchJson(doFetch, url, '汽水热搜失败')
  const words = (data?.suggest_words || [])
    .map((item) => item?.keyword)
    .filter((k) => typeof k === 'string' && k)
  if (words.length === 0) throw new Error('汽水热搜失败: 响应缺少 suggest_words')
  return words
}

export const hotSearch = {
  async getList() {
    if (cache.value && Date.now() - cache.time <= CACHE_TTL_MS) return cache.value

    const hotWords = await fetchHotWords()
    const merged = [...hotWords]
    if (merged.length < MIN_WORDS) {
      // 热歌榜歌名补位：失败不阻塞热搜（榜单挂了至少还有真实热搜词）
      try {
        const chart = await leaderboard.getList('7036274230471712007', 1)
        const seen = new Set(merged)
        for (const song of chart.list) {
          if (merged.length >= MIN_WORDS) break
          const name = String(song.name || '').trim()
          if (name && !seen.has(name)) {
            seen.add(name)
            merged.push(name)
          }
        }
      } catch {
        // 榜单补位失败时保持纯热搜词
      }
    }

    const result = { source: 'qs', list: merged }
    cache = { value: result, time: Date.now() }
    return result
  },
}
