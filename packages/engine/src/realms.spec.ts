import { describe, expect, it } from 'vitest'
import type { RealmSystemConfig } from './realms.js'
import { createRealmSystem } from './realms.js'
import { createRng } from './rng.js'

function makeSystem(overrides: Partial<RealmSystemConfig> = {}) {
  return createRealmSystem({
    worlds: [
      { id: 'a', name: '下界', realms: ['青铜', '白银', '黄金'] },
      { id: 'b', name: '上界', realms: ['铂金', '钻石'] }
    ],
    layerNames: ['一层', '二层', '三层', '圆满'],
    exp: { base: 100, realmGrowth: 10, layerGrowth: 2, worldStepMult: 3 },
    combat: { base: { attack: 10, defense: 5, maxHp: 100 }, realmGrowth: 4, layerGrowth: 1.5 },
    breakthrough: { layerBase: 0.9, layerDecay: 0.05, majorBase: 0.6, majorDecay: 0.05, min: 0.1, max: 0.95 },
    lifespan: { byWorld: { a: { base: 100, growth: 3 }, b: { base: 9000, growth: 4 } } },
    ...overrides
  })
}

describe('等级体系 —— 名目、曲线、进阶、寿元', () => {
  it('境界名与小层名拼成一行字,模板可换', () => {
    const sys = makeSystem()
    expect(sys.label(0, 0)).toBe('青铜·一层')
    expect(sys.label(3, 3)).toBe('铂金·圆满')
    const custom = makeSystem({ labelFormat: '{realm} {layer} 阶' })
    expect(custom.label(1, 2)).toBe('白银 三层 阶')
  })

  it('世界划分连续无缝,序号即境界序号', () => {
    const sys = makeSystem()
    expect(sys.realms.map(r => r.major)).toEqual([0, 1, 2, 3, 4])
    expect(sys.worlds).toEqual([
      { id: 'a', name: '下界', desc: undefined, start: 0, end: 2 },
      { id: 'b', name: '上界', desc: undefined, start: 3, end: 4 }
    ])
    expect(sys.isWorldEntry(3)).toBe(true)
    expect(sys.isWorldEntry(2)).toBe(false)
  })

  it('修为需求随层、随境单调上涨;界末圆满再乘跨界系数', () => {
    const sys = makeSystem()
    for (let major = 0; major < sys.maxMajor; major += 1) {
      for (let layer = 0; layer < sys.maxLayer; layer += 1) {
        expect(Number(sys.expCost(major, layer + 1))).toBeGreaterThan(Number(sys.expCost(major, layer)))
      }
    }
    // 跨界那一层单独加价:界末圆满 = 同境界内同层需求 × 世界的跨界系数
    const worldStep = sys.expCost(2, sys.maxLayer)
    const inside = sys.expCost(2, sys.maxLayer - 1)
    expect(Number(worldStep)).toBeCloseTo(Number(inside) * 2 * 3, 6)
    // 注意:**不保证**「下一界的第一层 > 上一界的圆满」—— 界末被加了墙、
    // 而新界的第一层又从头起步,这正是"飞升是一次大跃,之后重新爬"的形状。
    expect(Number(sys.expCost(3, 0))).toBeLessThan(Number(worldStep))
  })

  it('基础属性随境界与层数成长', () => {
    const sys = makeSystem()
    expect(Number(sys.baseStats(0, 0).attack)).toBeCloseTo(10, 6)
    expect(Number(sys.baseStats(1, 0).attack)).toBeCloseTo(40, 6)
    expect(Number(sys.baseStats(0, 1).attack)).toBeCloseTo(15, 6)
    expect(Number(sys.baseStats(0, 0).maxHp)).toBeCloseTo(100, 6)
  })

  it('寿元按世界复利,跨界为大跃', () => {
    const sys = makeSystem()
    expect(sys.lifespanOf(0)).toBe(100)
    expect(sys.lifespanOf(1)).toBe(300)
    expect(sys.lifespanOf(2)).toBe(900)
    expect(sys.lifespanOf(3)).toBe(9000)
    expect(sys.lifespanOf(4)).toBe(36000)
  })

  it('不配寿元 = 无限:日常/学习这类没有生死的题材不该被迫编一个数', () => {
    const withoutLifespan = {
      worlds: [{ id: 'a', name: '一段', realms: ['一年级', '二年级'] }],
      layerNames: ['第一周', '期末'],
      exp: { base: 10, realmGrowth: 2, layerGrowth: 1.5 },
      combat: { base: { attack: 10, defense: 5, maxHp: 100 }, realmGrowth: 2, layerGrowth: 1.2 },
      breakthrough: { layerBase: 0.9, layerDecay: 0.05, majorBase: 0.6, majorDecay: 0.05, min: 0.1, max: 1 }
    }
    const sys = createRealmSystem(withoutLifespan)
    expect(sys.lifespanOf(0)).toBe(Number.POSITIVE_INFINITY)
    expect(sys.lifespanOf(1)).toBe(Number.POSITIVE_INFINITY)
    expect(sys.realmAt(0).lifespanYears).toBe(Number.POSITIVE_INFINITY)
  })

  it('修为封顶在当前小层的需求上', () => {
    const sys = makeSystem()
    const cost = sys.expCost(0, 0)
    const capped = sys.addExp({ major: 0, layer: 0, exp: 0 }, 100000)
    expect(capped.exp).toBe(cost)
  })

  it('修为不满不能进阶;满了才掷骰;失败保留修为', () => {
    const sys = makeSystem()
    const rng = createRng(1)
    const notReady = sys.attemptBreakthrough({ major: 0, layer: 0, exp: 0 }, { rng })
    expect(notReady.ok).toBe(false)
    expect(notReady.reason).toBe('not-ready')

    const cost = Number(sys.expCost(0, 0))
    const state = { major: 0, layer: 0, exp: cost }
    const result = sys.attemptBreakthrough(state, { rng, bonusRate: 10 }) // 加成拉满,必成
    expect(result.ok).toBe(true)
    expect(result.state).toEqual({ major: 0, layer: 1, exp: 0 })
    expect(result.to).toBe('青铜·二层')
  })

  it('大关可声明必须走试炼:不给掷骰的机会', () => {
    const sys = makeSystem({
      breakthrough: { layerBase: 1, layerDecay: 0, majorBase: 1, majorDecay: 0, min: 1, max: 1, majorRequiresTrial: true }
    })
    const state = { major: 0, layer: sys.maxLayer, exp: sys.expCost(0, sys.maxLayer) }
    const result = sys.attemptBreakthrough(state, { rng: createRng(3) })
    expect(result.requiresTrial).toBe(true)
    expect(result.ok).toBe(false)
    expect(result.state.major).toBe(0)
  })

  it('走到最后一个境界的圆满不能再进阶', () => {
    const sys = makeSystem()
    const state = { major: sys.maxMajor, layer: sys.maxLayer, exp: sys.expCost(sys.maxMajor, sys.maxLayer) }
    const result = sys.attemptBreakthrough(state, { rng: createRng(1) })
    expect(result.reason).toBe('max')
  })

  it('进度视图给出比例与是否可进阶', () => {
    const sys = makeSystem()
    const cost = Number(sys.expCost(0, 0))
    const half = sys.progress({ major: 0, layer: 0, exp: cost / 2 })
    expect(half.ratio).toBeCloseTo(0.5, 6)
    expect(half.ready).toBe(false)
    expect(sys.progress({ major: 0, layer: 0, exp: cost }).ready).toBe(true)
  })

  it('自己接管曲线:给 costFn / statsFn 时,引擎不猜、原样用你的数', () => {
    // 一张手调的等级表(不是"倍率 × 倍率"那种形状)
    const table: Record<string, number> = { '0-0': 7, '0-1': 13, '1-0': 99 }
    const sys = makeSystem({
      exp: { realmGrowth: 1, costFn: (major, layer) => table[`${major}-${layer}`] ?? 1 },
      combat: { realmGrowth: 1, statsFn: (major, layer) => ({ attack: 10 + major * 100 + layer }) }
    })
    expect(Number(sys.expCost(0, 0))).toBe(7)
    expect(Number(sys.expCost(0, 1))).toBe(13)
    expect(Number(sys.expCost(1, 0))).toBe(99)
    expect(Number(sys.baseStats(2, 3).attack)).toBe(10 + 200 + 3)
    // 本值集合也由你定:想要几个维度就几个
    const three = makeSystem({ combat: { realmGrowth: 1, statsFn: () => ({ power: 5, guard: 3, vitality: 40 }) } })
    expect(Object.keys(three.baseStats(0, 0))).toEqual(['power', 'guard', 'vitality'])
  })

  it('进阶成功率也能自己接管:rateFn 返回基础值,仍受 min/max 夹取', () => {
    const sys = makeSystem({
      breakthrough: { min: 0.1, max: 0.9, rateFn: (major, layer) => 0.5 + major * 0.1 - layer * 0.05 }
    })
    expect(sys.breakthroughRate(0, 0)).toBeCloseTo(0.5, 10)
    expect(sys.breakthroughRate(2, 0)).toBeCloseTo(0.7, 10)
    // 层数会被夹到本境界的最大层(这组配置是 3 层)
    expect(sys.breakthroughRate(0, 99)).toBeCloseTo(0.5 - 3 * 0.05, 10)
    // 低于下限时被夹到 min;高于上限时被夹到 max
    const floored = makeSystem({ breakthrough: { min: 0.1, max: 0.9, rateFn: () => 0.01 } })
    expect(floored.breakthroughRate(0, 0)).toBe(0.1)
    const clamped = makeSystem({ breakthrough: { min: 0.1, max: 0.9, rateFn: () => 5 } })
    expect(clamped.breakthroughRate(0, 0)).toBe(0.9)
  })

  it('逐境层数可不同:前境两层、后境四层,各自独立', () => {
    const sys = createRealmSystem({
      worlds: [{ id: 'a', name: '一段', realms: [{ name: '一境', layers: ['上', '下'] }, '二境', '三境'] }],
      layerNames: ['一', '二', '三', '圆满'],
      exp: { base: 10, realmGrowth: 2, layerGrowth: 2 },
      combat: { base: { attack: 10 }, realmGrowth: 2, layerGrowth: 1.5 },
      breakthrough: { layerBase: 1, layerDecay: 0, majorBase: 1, majorDecay: 0, min: 1, max: 1 }
    })
    // 第一境两层,后两境用全局那套四层
    expect(sys.layersOf(0)).toEqual(['上', '下'])
    expect(sys.maxLayerOf(0)).toBe(1)
    expect(sys.maxLayerOf(1)).toBe(3)
    expect(sys.maxLayer).toBe(3) // 所有境界里最多的层数
    expect(sys.label(0, 1)).toBe('一境·下')
    expect(sys.label(0, 99)).toBe('一境·下') // 超出的层被夹到本境最后一层
    expect(sys.label(1, 3)).toBe('二境·圆满')
    // 第一境走到"下"就是大关:再进阶即进入第二境
    const step = sys.attemptBreakthrough({ major: 0, layer: 1, exp: sys.expCost(0, 1) }, { rng: createRng(1) })
    expect(step.ok).toBe(true)
    expect(step.state).toEqual({ major: 1, layer: 0, exp: 0 })
    expect(step.to).toBe('二境·一')
    // 修为封顶按**本境**的层需求,不是按别境
    expect(sys.addExp({ major: 0, layer: 1, exp: 0 }, 999999).exp).toBe(sys.expCost(0, 1))
  })
})
