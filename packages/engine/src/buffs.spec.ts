import { describe, expect, it } from 'vitest'
import type { BuffInstance } from './buffs.js'
import { createBuffSystem } from './buffs.js'

interface Mods {
  [key: string]: number
}

const defs = [
  { id: 'jing', durationSec: 600, kind: 'gain', mods: { speed: 0.5 } },
  { id: 'injury', durationSec: 300, kind: 'loss', mods: { speed: -0.5 } }
]

const sec = createBuffSystem<Mods>({ defs })
const ms = createBuffSystem<Mods>({ defs, clock: 'ms' })
const capped = createBuffSystem<Mods>({ defs: [{ id: 'stack', durationSec: 100, maxDurationSec: 250 }] })
const reset = createBuffSystem<Mods>({ defs, stacking: 'reset' })
const longest = createBuffSystem<Mods>({ defs, stacking: 'longest' })

describe('状态层 —— 还在不在、还剩多久、再叠一次会怎样', () => {
  it('重复施加**叠时长**(默认 extend):剩余的那 500 秒不会被吞', () => {
    const first = sec.apply([], 'jing', 0)
    expect(first.endsAt).toBe(600)
    const again = sec.apply(first.instances, 'jing', 100)
    expect(again.endsAt).toBe(1200) // max(600, 100) + 600 = 剩余 500 + 新 600
    expect(sec.remainingSec(again.instances, 'jing', 100)).toBe(1100)
    expect(again.instances.length).toBe(1) // 同一条状态只有一个实例,不堆两份
  })

  it('另外两种口径各有用处:longest 是"取较长者"(剩余被吞),reset 一律从现在起算', () => {
    expect(longest.apply([{ id: 'jing', endsAt: 600 }], 'jing', 100).endsAt).toBe(700) // max(600, 700)
    expect(longest.apply([{ id: 'jing', endsAt: 900 }], 'jing', 100).endsAt).toBe(900) // max(900, 700)
    expect(reset.apply([{ id: 'jing', endsAt: 600 }], 'jing', 100).endsAt).toBe(700)
    expect(reset.apply([], 'jing', 0).endsAt).toBe(600) // 没有旧实例时,三种口径一致
  })

  it('已过期的旧实例以"现在"起算,不把负剩余叠进来', () => {
    // 离线一晚上回来:旧实例早过期了,再服一次只给一份完整时长
    expect(sec.apply([{ id: 'jing', endsAt: 100 }], 'jing', 5000).endsAt).toBe(5600)
    expect(reset.apply([{ id: 'jing', endsAt: 100 }], 'jing', 5000).endsAt).toBe(5600)
    expect(longest.apply([{ id: 'jing', endsAt: 100 }], 'jing', 5000).endsAt).toBe(5600)
  })

  it('生效与清理共用一个判据:正好到期的那一刻就算过期', () => {
    const list: BuffInstance[] = [{ id: 'jing', endsAt: 600 }]
    expect(sec.has(list, 'jing', 599.999)).toBe(true)
    expect(sec.active(list, 599.999)[0]!.remainingSec).toBeCloseTo(0.001, 10)
    expect(sec.has(list, 'jing', 600)).toBe(false)
    expect(sec.active(list, 600)).toEqual([])
    expect(sec.remainingSec(list, 'jing', 600)).toBe(0)
    expect(sec.prune(list, 600)).toEqual({ instances: [], removed: 1 })
    expect(sec.prune(list, 599)).toEqual({ instances: list, removed: 0 })
  })

  it('未知 id 静默无效:内容改名后旧存档里的那条不该让存档炸,也不该被当成"施加成功"', () => {
    const list: BuffInstance[] = [{ id: 'jing', endsAt: 600 }]
    const r = sec.apply(list, '已经没有这条内容了', 0)
    expect(r.applied).toBe(false)
    expect(r.endsAt).toBeNull()
    expect(r.instances).toEqual(list)
    expect(sec.active([{ id: '没有定义', endsAt: 1e9 }], 0)).toEqual([]) // 渲染也跳过
    expect(sec.nextExpiry([{ id: '没有定义', endsAt: 1e9 }], 0)).toBeNull()
  })

  it('按分类清除:只剪该分类,并回报剪掉几条', () => {
    const list: BuffInstance[] = [
      { id: 'jing', endsAt: 600 },
      { id: 'injury', endsAt: 300 },
      { id: '没有定义', endsAt: 900 }
    ]
    const cleared = sec.clear(list, 'loss')
    expect(cleared.removed).toBe(1)
    // 增益与"无分类的残留"都不动
    expect(cleared.instances.map(i => i.id)).toEqual(['jing', '没有定义'])
    expect(sec.clear(list, '根本没有的分类').removed).toBe(0)
  })

  it('active 按实例顺序给出:定义、实例、剩余秒数三件套(界面直接用)', () => {
    const list: BuffInstance[] = [
      { id: 'injury', endsAt: 300 },
      { id: 'jing', endsAt: 600 },
      { id: 'jing', endsAt: 700 }
    ]
    const views = sec.active(list, 100)
    expect(views.map(v => [v.def.id, v.def.kind, v.remainingSec])).toEqual([
      ['injury', 'loss', 200],
      ['jing', 'gain', 500],
      ['jing', 'gain', 600]
    ])
    expect(views[0]!.def.mods).toEqual({ speed: -0.5 })
  })

  it('下一次状态变化:最近的那一条,给到期时刻与还有多久;全空 / 全过期 → null', () => {
    const list: BuffInstance[] = [
      { id: 'jing', endsAt: 600 },
      { id: 'injury', endsAt: 300 }
    ]
    expect(sec.nextExpiry(list, 100)).toEqual({ id: 'injury', at: 300, afterSec: 200 })
    expect(sec.nextExpiry([], 100)).toBeNull()
    // 正好到期那一刻已经算过期(与 active / prune 同一判据),没有"下一次变化"可言
    expect(sec.nextExpiry(list, 600)).toBeNull()
    expect(sec.nextExpiry(list, 601)).toBeNull()
  })

  it('时钟单位只声明一次:内容写秒、时钟给毫秒时,durationSec 自己换算', () => {
    const r = ms.apply([], 'jing', 1_700_000_000_000)
    expect(r.endsAt).toBe(1_700_000_600_000) // 600 秒 = 600000 毫秒
    // 报给界面的仍然是秒
    expect(ms.remainingSec(r.instances, 'jing', 1_700_000_300_000)).toBe(300)
    expect(ms.nextExpiry(r.instances, 1_700_000_300_000)).toEqual({ id: 'jing', at: 1_700_000_600_000, afterSec: 300 })
    expect(ms.perSec).toBe(1000)
    expect(sec.perSec).toBe(1)
  })

  it('可叠到顶就封住(maxDurationSec):叠再多次也不超过那个上限', () => {
    let list: BuffInstance[] = []
    for (let i = 0; i < 10; i += 1) list = capped.apply(list, 'stack', 0).instances
    expect(list[0]!.endsAt).toBe(250)
    expect(capped.remainingSec(list, 'stack', 0)).toBe(250)
  })

  it('纯函数:不改入参数组,也不改定义表', () => {
    const list: BuffInstance[] = [{ id: 'jing', endsAt: 600 }]
    const snapshot = JSON.stringify(list)
    const defsSnapshot = JSON.stringify(defs)
    sec.apply(list, 'jing', 10)
    sec.prune(list, 1000)
    sec.clear(list, 'loss')
    expect(JSON.stringify(list)).toBe(snapshot)
    expect(JSON.stringify(defs)).toBe(defsSnapshot)
  })
})
