/**
 * 状态层对账 —— 叠时长 / 剪过期 / 清负面搬进库之后,结果与迁移前一位不差。
 *
 * 与 engineParity 同一条纪律:下面 `legacy*` 是**迁移前那段实现的原样冻结**
 * (`stores/cultivation` 里的 addBuff / pruneBuffs / clearNegativeBuffs / buffMods),
 * 与 `core/engineBuffs` 用同一组输入跑,逐字段比 —— 包括 `endsAt` 这个绝对值,
 * 它是存档里真写着的东西("毫秒 ↔ 秒"这类换算是这类搬迁最容易悄悄错一千倍的地方)。
 *
 * 另把两条**已知差异**写在明处(它们不是漂移,是这次搬迁没有顺手改的东西):
 *   ① 到期判据:库把"正好到期"算过期(`endsAt > now`),本作读取路径仍然问
 *      "列表里有没有" —— 到期由心跳剪掉,故有一拍的窗口里"还算数";
 *   ② 由此,库的 `active / has / remainingSec / nextExpiry` 本作暂时没用上,
 *      它们的判据在库侧用例里钉着(`packages/engine/src/buffs.spec.ts`)。
 * 谁哪天把读取路径改成"按此刻过滤",①② 这两条会先红 —— 那时应该是一次**显式的**
 * 行为改动,而不是顺手改掉。
 */
import { describe, expect, it } from 'vitest'
import type { BuffInstance, StatMods } from '@/types'
import { buffDef, BUFFS } from '@/data/buffs'
import { activeBuffsOf, applyBuff, clearNegativeBuffList, pruneBuffList } from './engineBuffs'
import { mergeMods } from './statsCalc'

/** 更早那版写法(已被修掉,留在这里当反面对照):`Math.max(旧, now + 时长)` = 刷新 */
function legacyAddBuff(list: BuffInstance[], defId: string, now: number): BuffInstance[] {
  const def = buffDef(defId)
  if (!def) return list
  const add = def.durationSec * 1000
  const existing = list.find(b => b.defId === defId)
  if (existing) {
    const endsAt = Math.max(existing.endsAt, now + add)
    return list.map(b => (b.defId === defId ? { ...b, endsAt } : b))
  }
  return [...list, { defId, endsAt: now + add }]
}

/** 迁移前的施加(冻结,现在搬进库的就是这一版):剩余时长 + 新时长 */
function legacyExtendBuff(list: BuffInstance[], defId: string, now: number): BuffInstance[] {
  const def = buffDef(defId)
  if (!def) return list
  const add = def.durationSec * 1000
  const existing = list.find(b => b.defId === defId)
  if (existing) {
    const endsAt = Math.max(existing.endsAt, now) + add
    return list.map(b => (b.defId === defId ? { ...b, endsAt } : b))
  }
  return [...list, { defId, endsAt: now + add }]
}

/** 迁移前的剪枝 */
function legacyPrune(list: BuffInstance[], now: number): { list: BuffInstance[]; changed: boolean } {
  const next = list.filter(b => b.endsAt > now)
  return { list: next, changed: next.length !== list.length }
}

/** 迁移前的清负面 */
function legacyClearNegative(list: BuffInstance[]): BuffInstance[] {
  return list.filter(b => buffDef(b.defId)?.kind !== 'injury')
}

/** 迁移前的效果来源清单 */
function legacyModSources(list: BuffInstance[]): StatMods[] {
  const sources: StatMods[] = []
  for (const b of list) {
    const def = buffDef(b.defId)
    if (def) sources.push(def.mods)
  }
  return sources
}

const HOUR = 3_600_000
const NOW = 1_758_000_000_000

const cases: [string, BuffInstance[]][] = [
  ['空列表', []],
  ['一条增益还没过期', [{ defId: 'buff_juling', endsAt: NOW + 10 * 60_000 }]],
  ['同一条只剩 20 分钟', [{ defId: 'buff_juling', endsAt: NOW + 20 * 60_000 }]],
  ['同一条早就过期了(离线一晚上回来)', [{ defId: 'buff_juling', endsAt: NOW - 8 * HOUR }]],
  ['多条混着,还有一条查无定义的老 id', [
    { defId: 'buff_juling', endsAt: NOW + 60_000 },
    { defId: 'injury', endsAt: NOW + 2 * HOUR },
    { defId: 'curse_xinmo', endsAt: NOW + 5 * 60_000 },
    { defId: '改过名的老状态', endsAt: NOW + HOUR }
  ]]
]

const ids = ['buff_juling', 'injury', 'curse_xinmo', 'bless_jiyuan', '查无定义']

describe('状态层对账 —— 逐字段、逐毫秒与迁移前一致', () => {
  it('施加(叠时长口径):同一组输入下 `endsAt` 绝对值一位不差', () => {
    for (const [label, list] of cases) {
      for (const id of ids) {
        const now = NOW + 123
        expect(applyBuff(list, id, now), `${label} · 施加 ${id}`).toEqual(legacyExtendBuff(list, id, now))
      }
    }
  })

  it('施加:查无定义时列表**不动**(老档里的老 id 不该让存档炸,也不该凭空多一条)', () => {
    const list: BuffInstance[] = [{ defId: 'buff_juling', endsAt: NOW + 60_000 }]
    const next = applyBuff(list, '改过名的老状态', NOW)
    expect(next).toEqual(list)
    expect(next).toBe(list) // 连引用都不换:调用方不会因"没发生的事"重渲染
  })

  it('连加三次:叠时长而不是刷新,累计结果与冻结口径一致', () => {
    let mine: BuffInstance[] = []
    let ours: BuffInstance[] = []
    for (let i = 0; i < 3; i += 1) {
      const at = NOW + i * 90_000
      mine = applyBuff(mine, 'buff_juling', at)
      ours = legacyExtendBuff(ours, 'buff_juling', at)
    }
    expect(mine).toEqual(ours)
    // 顺带把"叠"这件事本身钉住:三次 = 3 × 1800 秒,不是 1800 秒
    expect(mine[0]!.endsAt - NOW).toBe(3 * 1800 * 1000)
  })

  it('旧的"取较长者"写法仍在判据里:它今天的结果说明"刷新会吞掉剩余时长"', () => {
    const list: BuffInstance[] = [{ defId: 'buff_juling', endsAt: NOW + 20 * 60_000 }]
    const refreshed = legacyAddBuff(list, 'buff_juling', NOW)
    const extended = applyBuff(list, 'buff_juling', NOW)
    expect(legacyPrune(refreshed, NOW).list[0]!.endsAt).toBe(NOW + 30 * 60_000) // 那 20 分钟被吞了
    expect(legacyPrune(extended, NOW).list[0]!.endsAt).toBe(NOW + 50 * 60_000) // 20 + 30
  })

  it('剪过期:边界(正好到期)与"有没有变化"的返回值都一致', () => {
    const list: BuffInstance[] = [
      { defId: 'buff_juling', endsAt: NOW - 1 },
      { defId: 'injury', endsAt: NOW },
      { defId: 'bless_jiyuan', endsAt: NOW + 1 }
    ]
    expect(pruneBuffList(list, NOW)).toEqual(legacyPrune(list, NOW))
    const alive: BuffInstance[] = [{ defId: 'buff_juling', endsAt: NOW + 1 }]
    expect(pruneBuffList(alive, NOW).changed).toBe(false)
    expect(legacyPrune(alive, NOW).changed).toBe(false)
  })

  it('清负面:只剪 injury 分类(重伤与心魔都在内),增益与无分类残留不动', () => {
    for (const [label, list] of cases) {
      expect(clearNegativeBuffList(list), label).toEqual(legacyClearNegative(list))
    }
  })

  it('生效状态的效果来源:未过期的那些逐条、逐顺序一致(喂给属性汇总的还是同一串)', () => {
    for (const [label, list] of cases) {
      const alive = list.filter(b => b.endsAt > NOW && buffDef(b.defId))
      const mine = activeBuffsOf(list, NOW).map(view => view.def.mods)
      expect(mine, label).toEqual(legacyModSources(alive))
    }
    const list = cases[4]![1].filter(b => b.endsAt > NOW)
    expect(mergeMods(activeBuffsOf(cases[4]![1], NOW).map(v => v.def.mods as StatMods))).toEqual(
      mergeMods(legacyModSources(list))
    )
  })

  it('内容表没被搬迁动过:库里的定义就是本作 BUFFS 的投影,条数与时长逐条对得上', () => {
    for (const def of BUFFS) {
      expect(buffDef(def.id)).toBe(def)
    }
    expect(BUFFS.every(d => d.durationSec > 0)).toBe(true)
  })

  it('有意修正(ISS-231):已过期但还没被心跳剪掉的那一条,不再算进属性', () => {
    const stale: BuffInstance[] = [{ defId: 'buff_juling', endsAt: NOW - 1 }]
    // 旧口径问"列表里有没有"→ 这条照样进属性汇总(到期后到下一拍之间多算一秒)
    expect(legacyModSources(stale)).toEqual([buffDef('buff_juling')!.mods])
    // 现在问"此刻还算不算数":过期即散,与剪枝共用同一个判据
    expect(activeBuffsOf(stale, NOW)).toEqual([])
    expect(activeBuffsOf(stale, NOW - 2).length).toBe(1) // 过期之前仍然算数
    expect(pruneBuffList(stale, NOW).list).toEqual([])
  })
})
