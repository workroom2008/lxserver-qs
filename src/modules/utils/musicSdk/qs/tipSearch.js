// 汽水音乐搜索联想：GET /luna/pc/sug（免登录，2026-11-14 实测）。
// 服务端 /api/music/tipSearch 契约：tipSearch.search(name) → 字符串数组（缺模块时路由返回 []）。
import { randomUUID } from 'node:crypto'
import { httpFetch } from '../../request'
import { PC_API_BASE, buildQuery } from './utils'

const CACHE_TTL_MS = 5 * 60 * 1000

let fetcher = null
export const setFetcher = (fn) => {
  fetcher = fn
}
const doFetch = (url) => (fetcher ? fetcher(url) : httpFetch(url))

const cache = new Map()
// 测试隔离用；生产侧无调用方。
export const clearCache = () => cache.clear()

const parseBody = (body) => (typeof body === 'string' ? JSON.parse(body) : body)

export const tipSearch = {
  async search(str) {
    const query = String(str ?? '').trim()
    if (!query) return []

    const key = `sug:${query}`
    const cached = cache.get(key)
    if (cached && Date.now() - cached.time <= CACHE_TTL_MS) return cached.value

    const url = `${PC_API_BASE}/luna/pc/sug?${buildQuery({
      q: query,
      sug_scene: 'main',
      sug_search_id: randomUUID(),
    })}`
    let data
    try {
      const response = await doFetch(url).promise
      data = parseBody(response?.body)
    } catch (err) {
      throw new Error(`汽水联想失败: ${err?.message ?? String(err)}`)
    }

    const tips = (data?.sugs || [])
      .map((item) => item?.suggestion)
      .filter((s) => typeof s === 'string' && s)
    cache.set(key, { value: tips, time: Date.now() })
    return tips
  },
}
