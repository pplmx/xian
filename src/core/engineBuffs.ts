/**
 * 状态(增益 / 减益)对库的接入 —— 内容(`data/buffs`)仍住在本作,库只给骨架。
 *
 * 换算只在这一处:
 *   · 内容表写的是**秒**,而运行时时钟与存档都是**毫秒**(`Date.now()`),故建库时声明
 *     `clock: 'ms'` —— 库里的 `endsAt` 就是存档里的 `endsAt`,不再各处 ×1000;
 *   · 存档里的键叫 `defId`,库里叫 `id`(换名要动所有老档,不值当),进出口各转一次。
 *
 * 读取口径:**问的是"此刻还算不算数"**(库的 `active`,到期即散),而不是"列表里有没有" ——
 * 列表里那些已经过期、还没被心跳剪掉的,不该继续算进属性(见 ISS-231)。
 */
import type { BuffDef, BuffInstance, StatMods } from '@/types'
import type { BuffInstance as EngineBuffInstance } from 'wanxiang-engine'
import { createBuffSystem } from 'wanxiang-engine'
import { BUFFS, buffDef } from '@/data/buffs'
import { PILLS } from '@/data/pills'

/**
 * 可消耗增益的时长上限 —— **单颗时长的 2 倍**。
 *
 * 起因(ISS-232):丹药的叠法是"加上"(`'extend'`),吃得比时长勤就能攒 ——
 * 实测 20 分钟一颗、连吃 24 小时后还剩 12 小时;10 分钟一颗则剩 48 小时。
 * 那等于把"限时加速"按材料成本换成了"半常驻",而"什么时候吃"这个决策随之消失
 * (最优解永远是"能多勤就多勤"),连"药效过去"这个节拍也感受不到了。
 *
 * 现在给**凡丹药能给的增益**加上这条上限:最长只能攒到"一次服药的两倍时长",
 * 到顶之后再服只延续到上限 —— "连吃两颗把时间顶满"的顺手感还在,囤积则被封在一次服药节奏之内。
 * 上限是**明说的**(界面上写着"至多 X"),不是暗改。
 *
 * 口径写在装配这一层、由数据推导,而不是逐个 def 手写:新增一味丹只要在 `data/pills` 里挂上
 * `buffId`,上限自动生效 —— 少一处"记得改"的地方。判据见 `core/consumableBuffCap.spec.ts`。
 */
export const CONSUMABLE_BUFF_CAP_MULT = 2

/** 凡能被丹药施加的增益 id —— 上限只对它们生效(事件祝福 / 闭关 / 惩罚不在此列) */
const CONSUMABLE_BUFF_IDS = new Set(PILLS.map(p => p.buffId).filter((id): id is string => !!id))

const BUFFS_SYSTEM = createBuffSystem<StatMods>({
  defs: BUFFS.map(d => ({
    id: d.id,
    durationSec: d.durationSec,
    kind: d.kind,
    mods: d.mods,
    // 丹药能吃出"囤"的那一类才封顶;其余状态的时长由内容或事件决定,不该被这里改口径
    maxDurationSec: CONSUMABLE_BUFF_IDS.has(d.id) ? d.durationSec * CONSUMABLE_BUFF_CAP_MULT : undefined
  })),
  clock: 'ms'
})

/** 某条增益的时长上限(秒);不受上限管的返回 `undefined` */
export function buffCapSec(defId: string): number | undefined {
  const def = buffDef(defId)
  return def && CONSUMABLE_BUFF_IDS.has(defId) ? def.durationSec * CONSUMABLE_BUFF_CAP_MULT : undefined
}

/** 本作存的键是 `defId`,库里叫 `id`:`endsAt` 是同一个数,只换个键名 */
const toEngine = (list: readonly BuffInstance[]): EngineBuffInstance[] =>
  list.map(b => ({ id: b.defId, endsAt: b.endsAt }))
const fromEngine = (list: readonly EngineBuffInstance[]): BuffInstance[] =>
  list.map(i => ({ defId: i.id, endsAt: i.endsAt }))

/**
 * 施加一条状态:**同一状态重复施加时叠时长,不是刷新**。
 *
 * 旧写法 `Math.max(旧到期, now + 时长)` 等价于刷新:增益还剩 20 分钟时再服同一味丹,
 * 那 20 分钟被清零重算,药力白丢。库的默认口径 `'extend'` 把新时长加到**剩余时长**上;
 * 已过期(离线 / 坏档残留)的实例以 `now` 为基准,不把负剩余叠进来。
 *
 * 查无此定义时**原样返回同一个数组** —— 旧实现是静默返回:内容改名后老档里的 id
 * 不该让存档炸,也不该被当成"施加成功"。
 */
export function applyBuff(list: readonly BuffInstance[], defId: string, now: number): BuffInstance[] {
  const applied = BUFFS_SYSTEM.apply(toEngine(list), defId, now)
  return applied.applied ? fromEngine(applied.instances) : (list as BuffInstance[])
}

/** 剪掉过期状态:返回新列表与"有没有变化"(没变化时调用方不必改 ref) */
export function pruneBuffList(list: readonly BuffInstance[], now: number): { list: BuffInstance[]; changed: boolean } {
  const pruned = BUFFS_SYSTEM.prune(toEngine(list), now)
  return { list: fromEngine(pruned.instances), changed: pruned.removed > 0 }
}

/** 清除负面状态(本作口径:分类为 `injury` 的那些,含心魔) */
export function clearNegativeBuffList(list: readonly BuffInstance[]): BuffInstance[] {
  return fromEngine(BUFFS_SYSTEM.clear(toEngine(list), 'injury').instances)
}

/**
 * 此刻再服一次,这一颗会被上限怎么对待 —— 给"服药"那条路用。
 *
 *   `full`    已经顶到上限:一点也加不上去,这一颗**白费**;
 *   `partial` 加上去会越过上限:只延续到顶,剩余的那一截被削掉;
 *   `none`    不受影响,足额兑现。
 *
 * 为什么要在界面上说:上限是"相对服药那一刻"封的,于是贴着上限连服时,
 * 每一颗实际只延续几十秒 —— 玩家看到的是"药吃了,时间几乎没动",若不说清楚,
 * 下一个结论就是"这游戏坏了"。容差 0.5 秒:剩余时间以毫秒在走,差半秒不算到顶。
 */
export type BuffOverflow = 'none' | 'partial' | 'full'

export function buffOverflowOf(list: readonly BuffInstance[], defId: string, now: number): BuffOverflow {
  const def = buffDef(defId)
  const cap = buffCapSec(defId)
  if (!def || cap === undefined) return 'none'
  const remain = BUFFS_SYSTEM.remainingSec(toEngine(list), defId, now)
  if (remain >= cap - 0.5) return 'full'
  return remain + def.durationSec > cap ? 'partial' : 'none'
}

/** 一条生效中的状态:内容定义(带名字 / 图标)+ 实例 + 还剩多少秒 */
export interface ActiveBuff {
  def: BuffDef
  instance: BuffInstance
  remainingSec: number
}

/**
 * 此刻真正生效的状态(顺序即实例顺序):过期的散掉、认不出的跳过,每条带上定义与剩余秒数。
 * 属性汇总、"还在不在"与界面胶囊都用它 —— 与库的 `active` 同一判据。
 */
export function activeBuffsOf(list: readonly BuffInstance[], now: number): ActiveBuff[] {
  const out: ActiveBuff[] = []
  for (const view of BUFFS_SYSTEM.active(toEngine(list), now)) {
    const def = buffDef(view.def.id)
    if (def) {
      out.push({ def, instance: { defId: view.instance.id, endsAt: view.instance.endsAt }, remainingSec: view.remainingSec })
    }
  }
  return out
}
