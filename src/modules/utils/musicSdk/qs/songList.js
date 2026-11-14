// 汽水音乐歌单：搜索/详情走匿名端点（免登录，2026-11-14 实测）。
// - 列表/搜索：GET /luna/search/playlist?q={词}&cursor={(page-1)*20}
// - 详情：GET /luna/playlist/detail?playlist_id={id}&cursor=…
//   上游实测一次返回全量曲目（fixture 471 条 + next_cursor），故整单缓存后按页切片；
//   若上游未来截断，可基于已存的 next_cursor 扩展 cursor 链。
import { httpFetch } from '../../request'
import { PC_API_BASE, buildQuery, buildImageUrl, mapTrack } from './utils'

const PAGE_SIZE = 20
const CACHE_TTL_MS = 5 * 60 * 1000
const DETAIL_CACHE_TTL_MS = 10 * 60 * 1000
const DETAIL_CACHE_MAX = 50

// 预设标签：车机/web 均无歌单分类浏览端点，用标签词调搜索接口模拟分类。
export const TAGS = [
  { id: 'qs_tag_rege', name: '热歌' },
  { id: 'qs_tag_liuxing', name: '流行' },
  { id: 'qs_tag_yaogun', name: '摇滚' },
  { id: 'qs_tag_dianzi', name: '电子' },
  { id: 'qs_tag_yingshi', name: '影视' },
  { id: 'qs_tag_minyao', name: '民谣' },
  { id: 'qs_tag_shuochang', name: '说唱' },
  { id: 'qs_tag_qingyinle', name: '轻音乐' },
]

let fetcher = null
export const setFetcher = (fn) => {
  fetcher = fn
}
const doFetch = (url) => (fetcher ? fetcher(url) : httpFetch(url))

const cache = new Map()
const cacheGet = (key, ttl = CACHE_TTL_MS) => {
  const hit = cache.get(key)
  if (!hit) return null
  if (Date.now() - hit.time > ttl) {
    cache.delete(key)
    return null
  }
  return hit.value
}
const cacheSet = (key, value, maxSize = 100) => {
  if (cache.size >= maxSize) {
    const oldest = cache.keys().next().value
    cache.delete(oldest)
  }
  cache.set(key, { value, time: Date.now() })
}

// 测试隔离用；生产侧无调用方。
export const clearCache = () => cache.clear()

const parseBody = (body) => (typeof body === 'string' ? JSON.parse(body) : body)

const mapPlaylist = (pl) => ({
  id: pl.id != null ? String(pl.id) : '',
  name: pl.title ?? pl.public_title ?? '',
  total: pl.count_tracks ?? 0,
  img: buildImageUrl(pl.url_cover),
  author: pl.owner?.nickname ?? pl.owner?.name ?? '',
  desc: pl.desc ?? '',
  play_count: pl.stats?.play_count ?? null,
  source: 'qs',
})

const searchPlaylists = async (word, page) => {
  const url = `${PC_API_BASE}/luna/search/playlist?${buildQuery({
    q: word,
    cursor: (page - 1) * PAGE_SIZE,
    search_method: 'input',
  })}`
  let data
  try {
    const response = await doFetch(url).promise
    data = parseBody(response?.body)
  } catch (err) {
    throw new Error(`汽水歌单搜索失败(${word}): ${err?.message ?? String(err)}`)
  }
  const group = data?.result_groups?.[0]
  if (!group) throw new Error(`汽水歌单搜索失败(${word}): 响应缺少 result_groups`)
  const list = (group.data || [])
    .filter((item) => item?.entity?.playlist?.id)
    .map((item) => mapPlaylist(item.entity.playlist))
  const total = (page - 1) * PAGE_SIZE + list.length + (group.has_more ? PAGE_SIZE : 0)
  return { list, total, allPage: Math.ceil(total / PAGE_SIZE), limit: PAGE_SIZE }
}

const fetchDetailTracks = async (id) => {
  const url = `${PC_API_BASE}/luna/playlist/detail?${buildQuery({ playlist_id: id })}`
  let data
  try {
    const response = await doFetch(url).promise
    data = parseBody(response?.body)
  } catch (err) {
    throw new Error(`汽水歌单失败(${id}): ${err?.message ?? String(err)}`)
  }
  const tracks = (data?.media_resources || [])
    .filter((item) => {
      const t = item?.entity?.track_wrapper?.track ?? item?.entity?.track
      return t?.id
    })
    .map((item) => {
      const t = item.entity.track_wrapper?.track ?? item.entity.track
      return mapTrack(t)
    })
  const count = data?.playlist?.count_tracks ?? tracks.length
  return {
    list: tracks,
    total: count,
    // next_cursor 留档：上游若未来截断返回，可据此扩展 cursor 链。
    nextCursor: data?.next_cursor ?? null,
  }
}

export const songList = {
  sortList: [{ id: 'hot', name: '热门' }],

  async getTags() {
    return {
      hotTag: TAGS.map((t) => t.name),
      tags: [{ name: '默认', list: TAGS.map((t) => ({ ...t, source: 'qs' })) }],
      source: 'qs',
    }
  },

  async getList(sortId, tagId, page) {
    const tag = TAGS.find((t) => t.id === tagId)
    const word = tag ? tag.name : String(tagId ?? '')
    const key = `pl-list:${word}:${page}`
    let cached = cacheGet(key)
    if (!cached) {
      cached = await searchPlaylists(word, page)
      cacheSet(key, cached)
    }
    return { ...cached, source: 'qs' }
  },

  async search(text, page) {
    const word = String(text ?? '').trim()
    if (!word) throw new Error('汽水歌单搜索失败: 关键词不能为空')
    const key = `pl-search:${word}:${page}`
    let cached = cacheGet(key)
    if (!cached) {
      cached = await searchPlaylists(word, page)
      cacheSet(key, cached)
    }
    return { ...cached, source: 'qs' }
  },

  async getListDetail(id, page) {
    const key = `pl-detail:${id}`
    let cached = cacheGet(key, DETAIL_CACHE_TTL_MS)
    if (!cached) {
      cached = await fetchDetailTracks(String(id))
      cacheSet(key, cached, DETAIL_CACHE_MAX)
    }

    const start = (page - 1) * PAGE_SIZE
    return {
      list: cached.list.slice(start, start + PAGE_SIZE),
      total: cached.total,
      allPage: Math.max(1, Math.ceil(cached.total / PAGE_SIZE)),
      limit: PAGE_SIZE,
      page,
      source: 'qs',
    }
  },
}
