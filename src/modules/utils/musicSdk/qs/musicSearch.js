// 汽水音乐搜索：GET /luna/search/track（免登录免签名，2026-11-14 实测）。
// 上游单页固定 20 条、cursor 偏移分页；limit≠20 时仅在映射后截断。
import { httpFetch } from '../../request'
import { PC_API_BASE, buildQuery, mapTrack, fetchJson } from './utils'

const PAGE_SIZE = 20
const CACHE_TTL_MS = 5 * 60 * 1000
const CACHE_MAX_ENTRIES = 100

// 测试注入点：setFetcher(fn) 替换默认 httpFetch（同签名：url => {promise}）。
let fetcher = null
export const setFetcher = (fn) => {
  fetcher = fn
}
const doFetch = (url) => (fetcher ? fetcher(url) : httpFetch(url))

const cache = new Map()
const cacheGet = (key) => {
  const hit = cache.get(key)
  if (!hit) return null
  if (Date.now() - hit.time > CACHE_TTL_MS) {
    cache.delete(key)
    return null
  }
  return hit.value
}
const cacheSet = (key, value) => {
  if (cache.size >= CACHE_MAX_ENTRIES) {
    const oldest = cache.keys().next().value
    cache.delete(oldest)
  }
  cache.set(key, { value, time: Date.now() })
}


export const musicSearch = {
  limit: PAGE_SIZE,
  async search(str, page = 1, limit = PAGE_SIZE) {
    const query = String(str ?? '').trim()
    if (!query) throw new Error('汽水搜索失败: 关键词不能为空')

    const key = `search:${query}:${page}`
    // 缓存存全量 20 条映射结果 + has_more；limit 截断在返回时按调用方参数做，
    // 使缓存与 limit 解耦（同 q+page 不同 limit 共用一份缓存）。
    let cached = cacheGet(key)
    if (!cached) {
      const url = `${PC_API_BASE}/luna/search/track?${buildQuery({
        q: query,
        cursor: (page - 1) * PAGE_SIZE,
        search_method: 'input',
      })}`

      const data = await fetchJson(doFetch, url, '汽水搜索失败')

      const group = data?.result_groups?.[0]
      if (!group) throw new Error('汽水搜索失败: 响应缺少 result_groups')

      cached = {
        list: (group.data || [])
          .filter((item) => item?.entity?.track?.id)
          .map((item) => mapTrack(item.entity.track)),
        hasMore: Boolean(group.has_more),
      }
      cacheSet(key, cached)
    }

    const total = (page - 1) * PAGE_SIZE + cached.list.length + (cached.hasMore ? PAGE_SIZE : 0)
    return {
      list: cached.list.slice(0, limit),
      allPage: Math.ceil(total / PAGE_SIZE),
      limit,
      total,
      source: 'qs',
    }
  },
}
