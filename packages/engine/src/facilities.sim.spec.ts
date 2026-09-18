/* eslint-disable no-console */
/**
 * 消融实验 —— 产线曲线、仓库上限与"结算粒度"的关系。
 *
 * `facilities.spec.ts` 钉的是语义(门槛顺序即说法、上限取小且只封升级、零头留在累加器里);
 * 这一份量的是**内容作者的账**:每小时产多少、按这个产量多久装满、装满之后每小时白产多少,
 * 以及**结算粒度**对总量的影响 —— 后者是"零头不丢"到底值多少的直接证据。
 *
 * 三条量出来的结论:
 *   ① **装满之后,多出来的产量全是浪费**:1 级产线 1.6 件/小时、仓库 40 格,25 小时装满;
 *      之后每小时产的 1.6 件一件也留不下(要么加消耗、要么扩仓、要么别再升级);
 *   ② **粒度越细,丢零头越狠**:同一份 1.6 件/小时的产线,若"每步向下取整"(而不是留零头),
 *      按小时结算是 1 件、按 10 分钟结算是 **0 件**、按 1 分钟结算也是 **0 件**
 *      —— 一秒一秒算会一件都发不出来;
 *   ③ **累加器让粒度无关**:按小时 / 10 分钟 / 1 分钟各结算一天,总量与余量**完全一致**
 *      (24 小时都是 38 件 + 余 0.4 件),这条是"零头不丢"最硬的判据。
 */
import { describe, expect, it } from 'vitest'
import { accrue, createFacilitySystem } from './facilities.js'

const HOUR = 3600

/** 一份典型的产线:每级每小时 1.6 件,仓库 40 格 */
const RATE_PER_LEVEL = 1.6
const CAP = 40

const shop = createFacilitySystem<string, { fame: number }>({
  facilities: [
    {
      id: 'stove',
      name: '灶台',
      maxLevel: 5,
      // 别人给的上限:口碑越好,才允许继续升
      cap: (_levels, ctx) => 1 + Math.floor(ctx.fame / 3),
      capReason: '口碑不够,再大也招呼不过来',
      costs: level => [{ key: 'coin', amount: 20 * (level + 1) }],
      perHour: level => ({ snack: RATE_PER_LEVEL * level }),
      mods: level => `灶台 ${level} 级:每小时 ${(RATE_PER_LEVEL * level).toFixed(1)} 件`
    },
    {
      id: 'shelf',
      name: '货架',
      maxLevel: 3,
      perHour: level => ({ fame: 0.8 * level })
    }
  ]
})

/** 一天(24 小时)按给定粒度结算:返回总量与余量 */
function settleADay(levels: Record<string, number>, stepSec: number): { total: number; frac: number; steps: number } {
  let frac: Record<string, number> = {}
  const rates = shop.ratesOf(levels, { fame: 3 })
  let total = 0
  const steps = Math.floor((24 * HOUR) / stepSec)
  for (let i = 0; i < steps; i += 1) {
    const made = accrue(frac, rates, stepSec)
    frac = made.frac
    total += made.whole.snack ?? 0
  }
  return { total, frac: frac.snack ?? 0, steps }
}

/** 反面对照:每步直接向下取整(不留零头) */
function settleADayWithTruncation(levels: Record<string, number>, stepSec: number): number {
  const rates = shop.ratesOf(levels, { fame: 3 })
  const perStep = ((rates.snack ?? 0) * stepSec) / HOUR
  const steps = Math.floor((24 * HOUR) / stepSec)
  return Math.floor(perStep) * steps
}

describe('消融实验 —— 产线曲线、仓库上限与结算粒度', () => {
  it('装满之后,多出来的产量全是浪费', () => {
    const rows = [1, 2, 3, 4, 5].map(level => {
      const rate = RATE_PER_LEVEL * level
      return { level, rate, hoursToFill: CAP / rate, wastedPerHour: rate }
    })
    console.log(`  仓库 ${CAP} 格、每级每小时 ${RATE_PER_LEVEL} 件:`)
    for (const row of rows) {
      console.log(
        `  ${row.level} 级:每小时 ${row.rate.toFixed(1)} 件 · ${row.hoursToFill.toFixed(1)} 小时装满 · 装满后每小时白产 ${row.wastedPerHour.toFixed(1)} 件`
      )
    }

    // ① 产量与等级成正比,装满时间与产量成反比
    expect(rows[0]!.hoursToFill).toBeCloseTo(25, 6)
    expect(rows[4]!.hoursToFill).toBeCloseTo(5, 6)
    for (let i = 1; i < rows.length; i += 1) {
      expect(rows[i]!.rate).toBeCloseTo(rows[i - 1]!.rate + RATE_PER_LEVEL, 9)
      expect(rows[i]!.hoursToFill).toBeLessThan(rows[i - 1]!.hoursToFill)
    }
    // 防空转:五级之间确实有差别(否则上面这张表是五行一样的数)
    expect(new Set(rows.map(r => r.rate)).size).toBe(5)
  })

  it('粒度越细,丢零头越狠:同一份产线,按分钟结算会一件都发不出', () => {
    const levels = { stove: 1 }
    const rows = [HOUR, 600, 60].map(stepSec => ({
      label: stepSec === HOUR ? '每小时' : stepSec === 600 ? '每 10 分钟' : '每分钟',
      stepSec,
      perStep: (RATE_PER_LEVEL * stepSec) / HOUR,
      truncated: settleADayWithTruncation(levels, stepSec),
      accumulated: settleADay(levels, stepSec).total
    }))
    console.log('  若"每步向下取整"(丢掉零头):')
    for (const row of rows) {
      console.log(
        `  ${row.label}:每步产 ${row.perStep.toFixed(3)} 件 → 一天 ${row.truncated} 件 · 同一份内容用累加器则是 ${row.accumulated} 件`
      )
    }

    // ② 粒度越细,截断越狠:10 分钟与 1 分钟粒度下每步都不足 1 件 → 一天 0 件
    expect(rows[0]!.truncated).toBe(24)
    expect(rows[1]!.truncated).toBe(0)
    expect(rows[2]!.truncated).toBe(0)
    // 而累加器下三种粒度给的是同一个数(下一例细说)
    expect(rows.every(r => r.accumulated === 38)).toBe(true)
    // 防空转:粗粒度下确实"能发出东西"(否则这条对照只是"都发不出")
    expect(rows[0]!.truncated).toBeGreaterThan(0)
  })

  it('累加器让粒度无关:按小时 / 10 分钟 / 1 分钟结算一天,总量与余量完全一致', () => {
    const levels = { stove: 1 }
    const rows = [HOUR, 600, 60].map(stepSec => ({ stepSec, ...settleADay(levels, stepSec) }))
    for (const row of rows) {
      console.log(`  每步 ${row.stepSec} 秒(${row.steps} 步):一天 ${row.total} 件,余 ${row.frac.toFixed(2)} 件`)
    }

    // ③ 三种粒度:总量一致、余量一致 —— 这正是"零头留在累加器里"的判据
    expect(new Set(rows.map(r => r.total)).size).toBe(1)
    expect(rows[0]!.total).toBe(38)
    for (const row of rows) expect(row.frac).toBeCloseTo(rows[0]!.frac, 6)
    // 24 小时 × 1.6 = 38.4 件:发 38 件、余 0.4 件
    expect(rows[0]!.total + rows[0]!.frac).toBeCloseTo(24 * RATE_PER_LEVEL, 9)
    // 防空转:换一级产量,数就跟着变(否则"一致"可能是三个 0)
    expect(settleADay({ stove: 2 }, HOUR).total).toBe(76)
  })

  it('上限取小:别人给的上限封住升级,但不把已有等级改小', () => {
    const low = shop.upgradeInfo({ stove: 1 }, 'stove', { fame: 0 }) // 口碑 0 → 上限 1 级
    const high = shop.upgradeInfo({ stove: 1 }, 'stove', { fame: 9 }) // 口碑 9 → 上限 4 级
    console.log(
      `  口碑 0:${low.can ? '能升' : `不能升(${low.reason})`} · 口碑 9:${high.can ? '能升' : '不能升'}(当前 ${high.level} 级 → ${high.nextLevel})`
    )

    expect(low.can).toBe(false)
    expect(low.reason).toBe('口碑不够,再大也招呼不过来')
    expect(high.can).toBe(true)
    // 上限是"自身上限与别人给的上限取小":口碑 9 → 1 + 3 = 4 级
    expect(shop.capOf({ stove: 1 }, 'stove', { fame: 9 })).toBe(4)
    expect(shop.capOf({ stove: 1 }, 'stove', { fame: 0 })).toBe(1)
    // 已经超过上限的等级**不会被改小**(降级是另一回事)
    expect(shop.levelOf({ stove: 4 }, 'stove')).toBe(4)
    expect(shop.capOf({ stove: 4 }, 'stove', { fame: 0 })).toBe(1)
    // 自家上限照样管着:货架最多 3 级,口碑再好也不越
    expect(shop.capOf({ shelf: 0 }, 'shelf', { fame: 99 })).toBe(3)
    // 防空转:两档口碑给的上限确实不同
    expect(shop.capOf({ stove: 1 }, 'stove', { fame: 9 })).toBeGreaterThan(shop.capOf({ stove: 1 }, 'stove', { fame: 0 }))
  })

  it('没建起来的设施不产东西:ratesOf 只算等级 > 0 的', () => {
    const none = shop.ratesOf({}, { fame: 3 })
    const one = shop.ratesOf({ stove: 1, shelf: 1 }, { fame: 3 })
    const two = shop.ratesOf({ stove: 2, shelf: 1 }, { fame: 3 })
    console.log(`  都没建:${JSON.stringify(none)} · 各 1 级:${JSON.stringify(one)} · 灶台 2 级:${JSON.stringify(two)}`)

    expect(none).toEqual({})
    expect(one.snack).toBeCloseTo(1.6, 9)
    expect(one.fame).toBeCloseTo(0.8, 9)
    expect(two.snack).toBeCloseTo(3.2, 9)
    // 两条产线各算各的:升级灶台不影响口碑那条
    expect(two.fame).toBe(one.fame)
    // 防空转:等级 0 与等级 1 的差别是真的(不是"都没建也产")
    expect(Object.keys(none).length).toBe(0)
  })
})
