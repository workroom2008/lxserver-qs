// 汽水音乐排行榜：GET /luna/pc/charts/{id}?charge=0（免登录，2026-11-14 实测）。
// 单榜 50 首一次拿全；主机失败回退 beta-luna.douyin.com/luna/charts/{id}?charge=0。
import { httpFetch } from '../../request'
import { PC_API_BASE, BETA_LUNA_BASE, buildQuery, mapTrack, fetchJson } from './utils'

const CACHE_TTL_MS = 5 * 60 * 1000
const LIST_DETAIL_LIMIT = 50

// 榜单清单为静态：chart_id 与发现页 discover_track_top_list 块 inner_block_id 交叉验证一致
// （来源：汽水直连插件 QISHUI_TOP_LIST_ITEMS + qs-discover.json 实测）。
const boardList = [
  { id: 'qs_rgeb', name: '热歌榜', bangid: '7036274230471712007' },
  { id: 'qs_xgeb', name: '新歌榜', bangid: '7060812597884869927' },
  { id: 'qs_omb', name: '欧美榜', bangid: '7061475546400005410' },
]

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
const cacheSet = (key, value) => cache.set(key, { value, time: Date.now() })

// 测试隔离用；生产侧无调用方。
export const clearCache = () => cache.clear()


const fetchChart = async (bangid) => {
  const primaryUrl = `${PC_API_BASE}/luna/pc/charts/${bangid}?charge=0&${buildQuery()}`
  const fallbackUrl = `${BETA_LUNA_BASE}/luna/charts/${bangid}?charge=0`
  let data = null
  let lastErr = null
  for (const url of [primaryUrl, fallbackUrl]) {
    try {
      const parsed = await fetchJson(doFetch, url, `汽水榜单失败(${bangid})`, 1)
      if (parsed?.chart) {
        data = parsed
        break
      }
    } catch (err) {
      lastErr = err
    }
  }
  if (!data) {
    throw new Error(`汽水榜单失败(${bangid}): ${lastErr?.message ?? '响应缺少 chart'}`)
  }
  return data.chart
}

export const leaderboard = {
  list: boardList,
  listDetailLimit: LIST_DETAIL_LIMIT,

  async getBoards() {
    this.list = boardList
    return { list: boardList, source: 'qs' }
  },

  async getList(bangid, page) {
    if (page > 1) {
      return { total: 0, list: [], limit: LIST_DETAIL_LIMIT, page, source: 'qs' }
    }

    const key = `chart:${bangid}`
    let list = cacheGet(key)
    if (!list) {
      const chart = await fetchChart(bangid)
      list = (chart.track_ranks || [])
        .filter((item) => item?.track?.id)
        .map((item) => mapTrack(item.track))
      cacheSet(key, list)
    }

    return {
      total: list.length,
      list,
      limit: LIST_DETAIL_LIMIT,
      page,
      source: 'qs',
    }
  },
}
