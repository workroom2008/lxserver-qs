// 汽水 h5/seo_track 共享取数：歌词与封面同源（免登录，2026-11-14 实测）。
import { httpFetch } from '../../request'
import { BETA_LUNA_BASE } from './utils'

let fetcher = null
export const setFetcher = (fn) => {
  fetcher = fn
}
const doFetch = (url) => (fetcher ? fetcher(url) : httpFetch(url))

const parseBody = (body) => (typeof body === 'string' ? JSON.parse(body) : body)

export const fetchSeoTrack = async (songmid) => {
  if (!songmid) throw new Error('缺少歌曲 ID')
  const url = `${BETA_LUNA_BASE}/luna/h5/seo_track?track_id=${encodeURIComponent(String(songmid))}&device_platform=web&aid=386088`
  const response = await doFetch(url).promise
  return parseBody(response?.body)
}
