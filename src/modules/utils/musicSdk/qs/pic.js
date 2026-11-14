// 汽水音乐封面：复用 h5/seo_track 响应里的 album.url_cover。
import { fetchSeoTrack } from './seoTrack'
import { buildImageUrl } from './utils'

export const pic = {
  async getPic(songInfo) {
    const data = await fetchSeoTrack(songInfo?.songmid ?? songInfo?.songId ?? songInfo?.id)
    const url = buildImageUrl(data?.seo_track?.track?.album?.url_cover)
    if (!url) throw new Error('汽水封面失败: 响应缺少封面')
    return url
  },
}
