/**
 * 状态(增益 / 减益)对库的接入 —— 内容(`data/buffs`)仍住在本作,库只给骨架。
 *
 * 换算只在这一处:
 *   · 内容表写的是**秒**,而运行时时钟与存档都是**毫秒**(`Date.now()`),故建库时声明
 *     `clock: 'ms'` —— 库里的 `endsAt` 就是存档里的 `endsAt`,不再各处 ×1000;
 *   · 存档里的键叫 `defId`,库里叫 `id`(换名要动所有老档,不值当),进出口各转一次。
 *
 * 读取口径照旧:**到期与否由心跳剪掉**,这里只问"列表里有没有"。库给了更准的问法
 * (`active(list, now)` / `has(list, id, now)`),但换过去会让"还剩 0 秒"的那一拍少算一条
 * 状态 —— 那是行为变化,记在图谱里单独一次改,不混在这次搬迁里。
 */
import type { BuffInstance, StatMods } from '@/types'
import type { BuffInstance as EngineBuffInstance } from 'wanxiang-engine'
import { createBuffSystem } from 'wanxiang-engine'
import { BUFFS } from '@/data/buffs'

const BUFFS_SYSTEM = createBuffSystem<StatMods>({
  defs: BUFFS.map(d => ({ id: d.id, durationSec: d.durationSec, kind: d.kind, mods: d.mods })),
  clock: 'ms'
})

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

/** 当前状态的效果来源(喂给本作的属性汇总 `mergeMods`)—— 顺序即实例顺序 */
export function buffModSources(list: readonly BuffInstance[]): StatMods[] {
  const sources: StatMods[] = []
  for (const b of list) {
    const def = BUFFS_SYSTEM.defOf(b.defId)
    if (def?.mods) sources.push(def.mods)
  }
  return sources
}
