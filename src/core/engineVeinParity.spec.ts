/**
 * 灵脉投资点对账 —— 加点规则搬进库之后,点数、主脉、灵石与提示语一位不差。
 *
 * 与 engineParity 同一条纪律:`legacy*` 是**迁移前那段实现的原样冻结**,与现在的
 * `core/veinService` 用同一条动作脚本、同一初始条件各跑一遍,比四件事:
 *   ① 点数与主脉(方向与深度);② 灵石余额(费用曲线按层级算,大数逐位比);
 *   ③ 每一次调用的返回值(成没成);④ **提示语的文案与顺序**(界面说什么,玩家才知道为什么)。
 *
 * 另有一条**有意修正**,写在明处:迁移前"首投自动认主"发生在付费之前 —— 玩家点了
 * 一点却没灵石时,主脉会被悄悄定在**没投成的那条脉**上,之后想投的那条就成了副脉。
 * 现在"投不成什么都不改"(库的口径),主脉只在**投成功**的那一次认下。
 * 谁要把这条改回去,下面那条用例会先红。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import type { VeinId } from '@/data/veins'
import { veinDef } from '@/data/veins'
import {
  VEIN_MAIN_CAPACITY,
  VEIN_POINT_STONE,
  VEIN_SIDE_CAP,
  VEIN_TOTAL_CAPACITY,
  VEIN_UNLOCK_MAJOR
} from '@/data/constants'
import { investVein, switchMainVein } from './veinService'
import { veinModsOf, veinStateOf, veinTotalOf } from './engineVeins'
import { stoneByTier } from './formulas'
import { playerTier } from './progress'
import { gn } from '@/utils/gnum'
import { formatExact } from '@/utils/format'
import { useDongfuStore } from '@/stores/dongfu'
import { usePlayerStore } from '@/stores/player'
import { useResourcesStore } from '@/stores/resources'
import { useUiStore } from '@/stores/ui'

type Action = { kind: 'invest' | 'switch'; id: VeinId }
type Snapshot = { points: Record<string, number>; main: string | null; stone: string }

/** 迁移前的投点(冻结) */
function legacyInvest(id: VeinId, toasts: string[]): boolean {
  const dongfu = useDongfuStore()
  const resources = useResourcesStore()
  if (usePlayerStore().major < VEIN_UNLOCK_MAJOR) return false
  if (dongfu.veinTotal >= VEIN_TOTAL_CAPACITY) {
    toasts.push('灵脉容量已尽,唯有取舍')
    return false
  }
  if (dongfu.veinMain === null) dongfu.setVeinMain(id)
  const current = dongfu.veinPoints[id] ?? 0
  const cap = dongfu.veinMain === id ? VEIN_MAIN_CAPACITY : VEIN_SIDE_CAP
  if (current >= cap) {
    toasts.push(dongfu.veinMain === id ? '主脉已至圆满' : '副脉有其上限,欲再进须立为主脉')
    return false
  }
  const cost = stoneByTier(playerTier(), VEIN_POINT_STONE)
  if (!resources.hasStone(cost)) {
    toasts.push('灵石不足')
    return false
  }
  resources.spendStone(cost)
  dongfu.addVeinPoint(id, 1)
  return true
}

/** 迁移前的换主脉(冻结) */
function legacySwitch(id: VeinId, toasts: string[]): boolean {
  const dongfu = useDongfuStore()
  const resources = useResourcesStore()
  if (usePlayerStore().major < VEIN_UNLOCK_MAJOR || dongfu.veinMain === id) return false
  const cost = stoneByTier(playerTier(), VEIN_POINT_STONE * 20)
  if (!resources.hasStone(cost)) {
    toasts.push('灵石不足,迁脉非小事')
    return false
  }
  resources.spendStone(cost)
  dongfu.setVeinMain(id)
  toasts.push(`主脉改走「${veinDef(id).name}」`)
  return true
}

const snapshot = (): Snapshot => {
  const dongfu = useDongfuStore()
  return {
    points: { ...dongfu.veinPoints },
    main: dongfu.veinMain,
    stone: formatExact(useResourcesStore().spiritStone)
  }
}

/** 跑一条脚本:impl 决定用哪一套实现,返回每一步的成功与最终快照 + 提示语 */
function run(actions: readonly Action[], opts: { major: number; stone: string }, impl: 'now' | 'legacy') {
  setActivePinia(createPinia())
  const player = usePlayerStore()
  player.major = opts.major
  useResourcesStore().spiritStone = gn(Number(opts.stone))
  const toasts: string[] = []
  if (impl === 'now') vi.spyOn(useUiStore(), 'toast').mockImplementation(msg => void toasts.push(msg))
  const ok = actions.map(a =>
    impl === 'now'
      ? a.kind === 'invest'
        ? investVein(a.id)
        : switchMainVein(a.id)
      : a.kind === 'invest'
        ? legacyInvest(a.id, toasts)
        : legacySwitch(a.id, toasts)
  )
  return { ok, toasts, final: snapshot() }
}

const repeat = (kind: Action['kind'], id: VeinId, n: number): Action[] =>
  Array.from({ length: n }, () => ({ kind, id }) as Action)

const RICH = { major: VEIN_UNLOCK_MAJOR, stone: '1e9' }

beforeEach(() => {
  setActivePinia(createPinia())
  vi.restoreAllMocks()
})

describe('灵脉投资点对账 —— 点数、主脉、灵石与提示语', () => {
  const scripts: [string, Action[], { major: number; stone: string }][] = [
    ['首投定主,一路投到主脉上限', repeat('invest', 'gather', VEIN_MAIN_CAPACITY + 3), RICH],
    ['投满总容量(100)', [...repeat('invest', 'gather', VEIN_MAIN_CAPACITY), ...repeat('invest', 'craft', VEIN_SIDE_CAP + 2)], RICH],
    ['主脉 40 点后改立,原主脉被副位上限拦住', [...repeat('invest', 'gather', 40), { kind: 'switch', id: 'craft' }, ...repeat('invest', 'gather', 2)], RICH],
    ['改回去再投', [...repeat('invest', 'gather', 20), { kind: 'switch', id: 'craft' }, { kind: 'switch', id: 'gather' }, ...repeat('invest', 'craft', 4)], RICH],
    ['反复换向(费用照付,点数不动)', [...repeat('invest', 'gather', 12), { kind: 'switch', id: 'insight' }, { kind: 'switch', id: 'gather' }, { kind: 'switch', id: 'insight' }], RICH]
  ]

  for (const [label, actions, opts] of scripts) {
    it(`${label}:每一步、每一处状态与提示语都一致`, () => {
      const now = run(actions, opts, 'now')
      const old = run(actions, opts, 'legacy')
      expect(now.ok, label).toEqual(old.ok)
      expect(now.final, label).toEqual(old.final)
      expect(now.toasts, label).toEqual(old.toasts)
    })
  }

  it('未开放时两边都静默:不投、不换、不提示(界面本来就不显示灵脉)', () => {
    const actions: Action[] = [{ kind: 'invest', id: 'gather' }, { kind: 'switch', id: 'craft' }]
    const now = run(actions, { major: VEIN_UNLOCK_MAJOR - 1, stone: '1e9' }, 'now')
    const old = run(actions, { major: VEIN_UNLOCK_MAJOR - 1, stone: '1e9' }, 'legacy')
    expect(now.ok).toEqual([false, false])
    expect(now.toasts).toEqual([])
    expect(now.final).toEqual(old.final)
    expect(now.toasts).toEqual(old.toasts)
  })

  it('已知差异(有意修正):"点了却没灵石"的那一次,主脉不再被悄悄认下', () => {
    const actions: Action[] = [{ kind: 'invest', id: 'gather' }]
    const poor = { major: VEIN_UNLOCK_MAJOR, stone: '0' }
    const old = run(actions, poor, 'legacy')
    const now = run(actions, poor, 'now')
    // 旧写法:钱不够、一点没投成,主脉却已经定在 gather 上(之后想投的路就成了副脉)
    expect(old.ok).toEqual([false])
    expect(old.final.main).toBe('gather')
    expect(old.final.points.gather).toBe(0)
    // 现在的口径:投不成什么都不改,主脉仍未定
    expect(now.ok).toEqual([false])
    expect(now.final.main).toBeNull()
    expect(now.final.points.gather).toBe(0)
    // 两边都提示了同一个原因
    expect(old.toasts).toEqual(['灵石不足'])
    expect(now.toasts).toEqual(['灵石不足'])
  })
})

describe('灵脉读数的对账 —— 总点数与属性加成', () => {
  it('总点数:账上所有键都算(与迁移前的 reduce 同一个数)', () => {
    for (const points of [
      { gather: 0, craft: 0, alchemy: 0, insight: 0 },
      { gather: 70, craft: 30, alchemy: 0, insight: 0 },
      { gather: 40, craft: 12, alchemy: 3, insight: 7 }
    ]) {
      const legacyTotal = Object.values(points).reduce((a, b) => a + b, 0)
      expect(veinTotalOf(veinStateOf(points, 'gather')), JSON.stringify(points)).toBe(legacyTotal)
    }
  })

  it('属性加成:每点 × 点数、按键相加(与迁移前的双重循环逐键相同)', () => {
    const legacyMods = (points: Record<VeinId, number>) => {
      const out: Record<string, number> = {}
      for (const id of ['gather', 'craft', 'alchemy', 'insight'] as VeinId[]) {
        const pts = points[id] ?? 0
        if (pts <= 0) continue
        for (const [k, v] of Object.entries(veinDef(id).perPoint)) out[k] = (out[k] ?? 0) + (v ?? 0) * pts
      }
      return out
    }
    for (const points of [
      { gather: 0, craft: 0, alchemy: 0, insight: 0 },
      { gather: 70, craft: 30, alchemy: 0, insight: 0 },
      { gather: 12, craft: 4, alchemy: 9, insight: 30 }
    ]) {
      const mine = veinModsOf(veinStateOf(points, 'gather'))
      expect({ ...mine }, JSON.stringify(points)).toEqual(legacyMods(points))
    }
  })
})
