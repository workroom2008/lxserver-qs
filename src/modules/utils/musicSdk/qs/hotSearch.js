// 汽水音乐热搜词：GET /luna/suggest-words/hot（免登录，2026-11-14 实测）。
import { httpFetch } from '../../request'
import { PC_API_BASE, buildQuery } from './utils'

const CACHE_TTL_MS = 5 * 60 * 1000

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

const parseBody = (body) => (typeof body === 'string' ? JSON.parse(body) : body)

export const hotSearch = {
  async getList() {
    if (cache.value && Date.now() - cache.time <= CACHE_TTL_MS) return cache.value

    const url = `${PC_API_BASE}/luna/suggest-words/hot?${buildQuery()}`
    let data
    try {
      const response = await doFetch(url).promise
      data = parseBody(response?.body)
    } catch (err) {
      throw new Error(`汽水热搜失败: ${err?.message ?? String(err)}`)
    }

    const words = (data?.suggest_words || [])
      .map((item) => item?.keyword)
      .filter((k) => typeof k === 'string' && k)
    if (words.length === 0) throw new Error('汽水热搜失败: 响应缺少 suggest_words')

    const result = { source: 'qs', list: words }
    cache = { value: result, time: Date.now() }
    return result
  },
}
