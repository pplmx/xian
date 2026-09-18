/**
 * 妖气复聚 —— 让「已靖」不是终点,让旧主能再碰面
 *
 * 起因(两处设计自己拆自己的台):
 *   一 首领认知写了三道门槛,还特意给首领「加倍」,可首领一条命只打一次 ——
 *     「知其路数」「洞悉」两层对首领永远够不着,而「残血变阵」「首领本相」这两块
 *     情报只在洞悉层才给。专门为首领写的那层情报,事实上没人看得到。
 *   二 妖气复聚(镇压满 72 小时自动解除)只复聚了杂兵:妖气之源(首领)不回来,
 *     而镇压资格永久、一键就能切回 —— 于是那个倒计时对玩家几乎只是一次点击,
 *     叙事上也是半截的("妖气再聚"而旧主不在)。
 *
 * 故把复聚定成**世界自己的节律**:够钟的已靖地界,旧主归来(该地界不再「已靖」)。
 *
 * 三条设计口径(为什么是这样,而不是更狠或更松):
 *   一 **不惩罚挂机**:复聚只把"已靖"收回去、把镇压松开,镇压资格仍然永久 ——
 *     玩家一键就能把收益接回来,想打首领的人自己去打。挂机是该玩的核心体验,
 *     不能让"三天没上线"变成二十场必修课(镇压本来就是每 72 小时要点一次的事)。
 *   二 **重逢是内容,不是税**:归来的首领按老规矩发(4× 灵石修为 + 保底一件装备),
 *     并推进认知 —— 这是给主动玩家的那一份,不去的人不损失什么。
 *   三 **告别"一次性内容"**:再靖一次即复「已靖」,此后还是老样子安静(pending 下一次妖气复聚)。
 *
 * 钟的起点见 worldMemory.regionTouchedAt:最后一次在当地战斗、或把它镇压下来。
 */
import { REGIONS, regionDef } from '@/data/regions'
import { useAdventureStore } from '@/stores/adventure'
import { usePlayerStore } from '@/stores/player'
import { useUiStore } from '@/stores/ui'
import { isRegionRevived, regionTouchedAt } from './worldMemory'

/** 提示里最多点名几处 —— 回来一次撞上二十处复聚时,别糊一屏名字 */
const LITANY_LIMIT = 3

/**
 * 结算妖气复聚:够钟的已靖地界旧主归来,镇压随之松开。
 *
 * 由 settleSuppressedRegions 每 tick 调用(在线)与离线结算调用同一处 ——
 * 复聚的判定只写这一份,免得两条路各有一个"够钟"。
 *
 * @returns 这一次刚复聚的地界 id
 */
export function settleRegionRevivals(now: number = Date.now()): string[] {
  const adventure = useAdventureStore()
  const player = usePlayerStore()
  const returned: string[] = []
  const loosened: string[] = []

  for (const region of REGIONS) {
    const clearedNow = adventure.cleared.includes(region.id)
    const suppressedNow = player.suppressedRegions.includes(region.id)
    // 既没靖也压着的地界,没有"妖气"可聚(首领本来就在)
    if (!clearedNow && !suppressedNow) continue
    // 旧主早已归来、镇压也早松开的,不必每 tick 再看一遍
    if (!suppressedNow && adventure.revived.includes(region.id)) continue
    const touchedAt = regionTouchedAt(
      player.regionStats[region.id]?.lastUpdateAt,
      player.suppressedSince[region.id],
      adventure.clearedAt[region.id]
    )
    if (!isRegionRevived(touchedAt, now)) continue
    // 妖气都聚起来了,压不住 —— 镇压松开(资格仍在,随时可再接回来)
    if (suppressedNow) {
      player.unsuppressRegion(region.id)
      loosened.push(region.id)
    }
    // 已靖的地界:旧主归来,此处不再「已靖」(再靖一次即复位)
    if (clearedNow) {
      adventure.markRevived(region.id)
      returned.push(region.id)
    }
  }

  const ui = useUiStore()
  if (returned.length > 0) {
    ui.toast(`仙路日久,妖气复聚:${litany(returned)}的旧主归来 —— 再历一程即可复靖`, 'info')
  }
  if (loosened.length > 0) {
    ui.toast(`${litany(loosened)}妖气复聚,镇压松动 —— 此地重新成为历练之地`, 'info')
  }
  return returned
}

/** 点名几处,多了就报个数 —— 回来一次撞上二十处复聚时别糊一屏名字 */
function litany(ids: string[]): string {
  const names = ids.map(id => regionDef(id)?.name ?? id)
  const head = names.slice(0, LITANY_LIMIT).join('、')
  return names.length > LITANY_LIMIT ? `${head} 等 ${names.length} 处` : head
}
