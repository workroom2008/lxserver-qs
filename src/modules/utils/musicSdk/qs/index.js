// 汽水音乐（qs）音源模块入口，结构对齐 mg/index.js。
// 列表能力走汽水匿名公开端点；取链委托已导入的自定义源脚本（apis('qs')），
// 与 kw/mg 的 getMusicUrl 同模式。脚本未导入时该调用抛出明确错误。
import { apis } from '../api-source'
import { leaderboard } from './leaderboard'
import { songList } from './songList'
import { musicSearch } from './musicSearch'
import { lyric } from './lyric'
import { pic } from './pic'
import { hotSearch } from './hotSearch'
import { tipSearch } from './tipSearch'

const qs = {
  tipSearch,
  musicSearch,
  leaderboard,
  songList,
  hotSearch,
  getMusicUrl(songInfo, type) {
    // 使用 api-source 获取 API（自定义源脚本，聆澜适配）
    return apis('qs').getMusicUrl(songInfo, type)
  },
  getLyric(songInfo) {
    return lyric.getLyric(songInfo)
  },
  getPic(songInfo) {
    return pic.getPic(songInfo)
  },
  getMusicDetailPageUrl(songInfo) {
    return `https://music.douyin.com/qishui/share/track?track_id=${songInfo.songmid}`
  },
}

export default qs
