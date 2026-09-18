import { describe, expect, it } from 'vitest'
import type { LevelMap } from './facilities.js'
import { accrue, createFacilitySystem } from './facilities.js'

interface Ctx {
  realm: number
}

const system = createFacilitySystem<{ speed: number }, Ctx, number>({
  facilities: [
    {
      id: 'hall',
      name: '主屋',
      maxLevel: 4,
      blocked: (_levels, _level, ctx) => (ctx.realm < 0 ? '还不够格' : undefined),
      costs: level => [{ key: 'coin', amount: 100 * (level + 1) }],
      mods: level => ({ speed: level * 0.04 })
    },
    {
      id: 'desk',
      name: '书桌',
      maxLevel: 10,
      cap: levels => ((levels.hall ?? 0) + 1) * 3,
      capReason: '受主屋所限',
      blocked: (_levels, level, ctx) => (ctx.realm < 1 && level >= 2 ? '需二级' : undefined),
      costs: level => [{ key: 'coin', amount: 10 * (level + 1) }],
      mods: level => ({ speed: level * 0.1 }),
      perHour: level => ({ focus: level * 1.5 })
    },
    {
      id: 'lamp',
      name: '台灯',
      maxLevel: 3,
      perHour: level => ({ focus: level * 1.5, warm: level * 0.5 })
    }
  ]
})

const ctx: Ctx = { realm: 2 }
const levels = (patch: LevelMap = {}): LevelMap => ({ hall: 0, desk: 0, lamp: 0, ...patch })

describe('设施 —— 能不能升、上限取小、每小时产出', () => {
  it('能升:理由为空、下一级与花费出自同一次判定', () => {
    const info = system.upgradeInfo(levels(), 'desk', ctx)
    expect(info).toEqual({ can: true, reason: '', level: 0, nextLevel: 1, costs: [{ key: 'coin', amount: 10 }] })
    expect(system.upgradeInfo(levels({ desk: 4 }), 'desk', ctx).costs).toEqual([{ key: 'coin', amount: 50 }])
  })

  it('门槛由内容给,顺序即内容写的顺序(先报哪一句,玩家先看到哪一句)', () => {
    // 境界不够先说,哪怕同时也已经到顶
    expect(system.upgradeInfo(levels({ desk: 10 }), 'desk', { realm: 0 }).reason).toBe('需二级')
    // 境界够了才轮到"受主屋所限"
    expect(system.upgradeInfo(levels({ hall: 1, desk: 6 }), 'desk', ctx).reason).toBe('受主屋所限')
  })

  it('等级上限取小:(主屋 + 1) × 3 与自身上限谁小听谁的', () => {
    expect(system.capOf(levels({ hall: 0 }), 'desk', ctx)).toBe(3)
    expect(system.capOf(levels({ hall: 3 }), 'desk', ctx)).toBe(10) // (3+1)×3 = 12,被自身上限 10 截住
    expect(system.capOf(levels({ hall: 0 }), 'hall', ctx)).toBe(4) // 主屋自己不受自己限制
    expect(system.upgradeInfo(levels({ hall: 0, desk: 3 }), 'desk', ctx).can).toBe(false)
    expect(system.upgradeInfo(levels({ hall: 1, desk: 3 }), 'desk', ctx).can).toBe(true)
  })

  it('上限只封升级,不改已有等级:已经超了的等级照旧显示', () => {
    const over: LevelMap = { hall: 0, desk: 9, lamp: 0 }
    expect(system.levelOf(over, 'desk')).toBe(9)
    expect(system.upgradeInfo(over, 'desk', ctx).can).toBe(false) // 升不动
    expect(system.levelOf(over, 'desk')).toBe(9) // 也没被改小
  })

  it('没建起来就不算:等级 0 的设施既不出效果,也不出产出', () => {
    expect(system.modsOf(levels({ hall: 2 }), ctx)).toEqual([{ speed: 0.08 }])
    expect(system.ratesOf(levels({ hall: 2 }), ctx)).toEqual({})
  })

  it('效果按声明顺序给出(喂给属性汇总的东西是稳定的)', () => {
    expect(system.modsOf(levels({ hall: 1, desk: 2 }), ctx)).toEqual([{ speed: 0.04 }, { speed: 0.2 }])
  })

  it('每小时产出按键合计:同一键的多个设施加在一起', () => {
    expect(system.ratesOf(levels({ desk: 2 }), ctx)).toEqual({ focus: 3 })
    expect(system.ratesOf(levels({ desk: 2, lamp: 1 }), ctx)).toEqual({ focus: 4.5, warm: 0.5 })
  })

  it('未知 id 不炸:当成 0 级、没得升', () => {
    expect(system.levelOf(levels({ 别的: 3 }), '别的')).toBe(3) // 记过的等级照读
    expect(system.upgradeInfo(levels(), '没有这座', ctx)).toEqual({
      can: false,
      reason: '',
      level: 0,
      nextLevel: 1,
      costs: []
    })
    expect(system.capOf(levels(), '没有这座', ctx)).toBe(0)
  })

  it('坏值当成 0 级:NaN / 负数 / 小数都不该渗进界面', () => {
    expect(system.levelOf({ hall: Number.NaN }, 'hall')).toBe(0)
    expect(system.levelOf({ hall: -3 }, 'hall')).toBe(0)
    expect(system.levelOf({ hall: 2.7 }, 'hall')).toBe(2)
  })

  it('产出留零头:不足一份的留到下一次,够了才发', () => {
    // 1.5 份/小时,900 秒 = 0.375 份 —— 一份都发不出来,但零头留着
    const first = accrue({}, { focus: 1.5 }, 900)
    expect(first.whole).toEqual({})
    expect(first.frac.focus).toBeCloseTo(0.375, 12)
    // 再来 3600 秒:0.375 + 1.5 = 1.875 → 发 1 份,留 0.875
    const second = accrue(first.frac, { focus: 1.5 }, 3600)
    expect(second.whole).toEqual({ focus: 1 })
    expect(second.frac.focus).toBeCloseTo(0.875, 12)
    // 零头从不丢:连推 24 次 3600 秒,总量 = 1.5 × 24 份
    let frac: Record<string, number> = {}
    let total = 0
    for (let i = 0; i < 24; i += 1) {
      const r = accrue(frac, { focus: 1.5 }, 3600)
      frac = r.frac
      total += r.whole.focus ?? 0
    }
    expect(total).toBe(36)
  })

  it('按键各自算:一个键够了不影响另一个键', () => {
    const r = accrue({ warm: 0 }, { focus: 60, warm: 0.5 }, 60)
    expect(r.whole).toEqual({ focus: 1 })
    expect(r.frac.warm).toBeCloseTo(0.5 / 60, 12)
  })

  it('设施没了也要把攒下的零头发出来(不能烂在累加器里)', () => {
    const r = accrue({ focus: 1.2, warm: 0.3 }, {}, 0)
    expect(r.whole).toEqual({ focus: 1 })
    expect(r.frac.focus).toBeCloseTo(0.2, 12)
    expect(r.frac.warm).toBeCloseTo(0.3, 12)
  })

  it('累加器里的坏值当 0(坏档不该让产出变成 NaN)', () => {
    const r = accrue({ focus: Number.NaN }, { focus: 1 }, 3600)
    expect(r.whole).toEqual({ focus: 1 })
    expect(r.frac.focus).toBeCloseTo(0, 12)
  })

  it('纯函数:入参不动', () => {
    const frac = { focus: 0.5 }
    const rates = { focus: 1.5 }
    const snapshot = JSON.stringify([frac, rates])
    accrue(frac, rates, 900)
    expect(JSON.stringify([frac, rates])).toBe(snapshot)
  })
})
