/* eslint-disable no-console */
/**
 * 消融实验 —— 境界曲线的手感:一层涨多少、跨境那一步到底陡不陡、进阶卡几次。
 *
 * `realms.spec.ts` 钉的是语义(两段式成长、成功率的线性衰减与夹取、寿元可选、标签模板);
 * 这一份量的是**内容作者与玩家都最在意的那几件事**,而且量出来一条与直觉相反的:
 *
 *   ① **"越练越贵"主要发生在层内**:`layerGrowth 1.35` 让一境的十层从 40 涨到 595.75
 *      —— **境内涨了 14.9 倍**;而**跨境那一步只涨 1.28 倍**(`realmGrowth 19 ÷ 1.35⁹`)。
 *      换界域更是反直觉:`worldStepMult` 加在**旧世界最后一层**上,新世界第一层因为
 *      "层内指数归零"反而更低(实测 0.64 倍)—— 手感是"最后那一层特别难,进去之后重新爬";
 *   ② **最后一层是"大关"**,成功率另走一条线:小层 95% 起、每层 −3%;而每境的第 10 层
 *      走大关口径(78% 起、每跨境 −5%)—— 所以第 9 层 71%、第 10 层反而"回到"78%;
 *   ③ **期望尝试次数 = 1 / 成功率**:小层 1.05 次、大关 1.28 次,第 6 境的大关(53%)要 1.9 次 ——
 *      实测 1000 颗种子与理论值对得上,最长连败 9 次(长尾是真的)。
 * 另附一个内容侧有用的总数:这份配置里"从第一境第一层升到最后一境最后一层"要 57 亿点修为。
 */
import { describe, expect, it } from 'vitest'
import { createRng } from './rng.js'
import { createRealmSystem } from './realms.js'

/** 一份典型配置:两界、每界三境、每境十层 */
const realms = createRealmSystem({
  worlds: [
    { id: 'mortal', name: '尘世', realms: ['引气', '凝元', '化形'] },
    { id: 'heaven', name: '天界', realms: ['登天', '斩道', '合真'] }
  ],
  layerNames: Array.from({ length: 10 }, (_, i) => `第 ${i + 1} 层`),
  labelFormat: '{realm}·{layer}',
  exp: { base: 40, realmGrowth: 19, layerGrowth: 1.35, worldStepMult: 2 },
  combat: { base: { attack: 12, defense: 7, maxHp: 150 }, realmGrowth: 3.8, layerGrowth: 1.09 },
  breakthrough: { layerBase: 0.95, layerDecay: 0.03, majorBase: 0.78, majorDecay: 0.05, min: 0.15, max: 0.98 }
})

describe('消融实验 —— 境界曲线的手感', () => {
  it('"越练越贵"主要在层内:境内涨 14.9 倍,跨境那一步只涨 1.28 倍', () => {
    const within = Array.from({ length: 10 }, (_, layer) => realms.expCost(0, layer))
    for (const [layer, cost] of within.entries()) console.log(`  ${realms.label(0, layer)}:${cost.toFixed(2)}`)
    const cross = realms.expCost(1, 0) / within[9]!
    console.log(
      `  境内第 1 层 → 第 10 层:${(within[9]! / within[0]!).toFixed(2)} 倍 · 第 10 层 → 下一境第 1 层:${cross.toFixed(2)} 倍`
    )

    // ① 层内每层 ×1.35;一境之内累计 1.35⁹ ≈ 14.9 倍
    expect(within[1]! / within[0]!).toBeCloseTo(1.35, 6)
    expect(within[9]! / within[0]!).toBeCloseTo(1.35 ** 9, 6)
    expect(within[9]! / within[0]!).toBeGreaterThan(14)
    // 跨境那一步 = realmGrowth ÷ 1.35⁹ ≈ 1.28:看着比层内还温和(反直觉,但是这份配置的真实手感)
    expect(cross).toBeCloseTo(19 / 1.35 ** 9, 6)
    expect(cross).toBeLessThan(1.35)
    // 单调不回头(层内)
    for (let layer = 1; layer < 10; layer += 1) expect(within[layer]!).toBeGreaterThan(within[layer - 1]!)
    /**
     * 换界域那一步更有意思:`worldStepMult` 加在**旧世界的最后一层**上(那一层要乘 2),
     * 而新世界的第一层因为"层内指数归零"反而更低 —— 实测 0.64 倍。
     * 也就是说这份曲线的手感是"最后那一层特别难,进去之后重新爬"。
     */
    const worldStep = realms.expCost(3, 0) / realms.expCost(2, 9)!
    console.log(`  换界域(尘世最后一境 → 天界第一境):${worldStep.toFixed(2)} 倍`)
    expect(worldStep).toBeLessThan(1)
    // 但同一层的对比是陡的:天界第一境的第一层比尘世第一境的第一层贵得多
    expect(realms.expCost(3, 0) / realms.expCost(0, 0)).toBeGreaterThan(50)
    // 而"旧世界最后一层"确实被 worldStepMult 抬过:它是同一境里第 9 层的两倍
    expect(realms.expCost(2, 9) / realms.expCost(2, 8)!).toBeGreaterThan(2.5)
  })

  it('最后一层是"大关",成功率另走一条线', () => {
    const layers = Array.from({ length: 10 }, (_, layer) => realms.breakthroughRate(0, layer))
    const majors = Array.from({ length: 6 }, (_, major) => realms.breakthroughRate(major, 9))
    console.log(`  第 1 境的十层成功率:${layers.map(r => `${(r * 100).toFixed(0)}%`).join(' → ')}`)
    console.log(`  各界最后一层(大关):${majors.map(r => `${(r * 100).toFixed(0)}%`).join(' → ')}`)

    // ② 小层 95% 起、每层 −3%;第 10 层是大关,走 78% − 5%×境号
    expect(layers[0]).toBeCloseTo(0.95, 6)
    expect(layers[8]).toBeCloseTo(0.95 - 0.03 * 8, 6)
    expect(layers[9]).toBeCloseTo(0.78, 6) // 反而比第 9 层"高" —— 因为换了口径
    expect(layers[9]).toBeGreaterThan(layers[8]!)
    expect(majors[0]).toBeCloseTo(0.78, 6)
    expect(majors[5]).toBeCloseTo(0.78 - 0.05 * 5, 6)
    // 两条线都受 min/max 夹取:再深也不会掉到 0
    expect(realms.breakthroughRate(99, 9)).toBeGreaterThanOrEqual(0.15)
    expect(realms.breakthroughRate(0, 0)).toBeLessThanOrEqual(0.98)
    // 防空转:大关与同境小层的口径确实不同(否则"两条线"这句话是空的)
    expect(layers[9]).not.toBeCloseTo(0.95 - 0.03 * 9, 3)
  })

  it('期望尝试次数 = 1 / 成功率:实测与理论对得上,长尾也是真的', () => {
    const rows = [0, 8, 9].map(layer => {
      const rate = realms.breakthroughRate(0, layer)
      return { layer, rate, tries: 1 / rate, tenFails: (1 - rate) ** 10 }
    })
    for (const row of rows) {
      console.log(
        `  ${realms.label(0, row.layer)}:成功率 ${(row.rate * 100).toFixed(0)}% → 期望 ${row.tries.toFixed(2)} 次 · 连败 10 次 ${(row.tenFails * 100).toFixed(2)}%`
      )
    }
    // ③ 期望次数就是 1 / p;成功率越低期望越高
    expect(rows[0]!.tries).toBeCloseTo(1 / 0.95, 6)
    expect(rows[2]!.tries).toBeCloseTo(1 / 0.78, 6)
    expect(rows[2]!.tries).toBeGreaterThan(rows[0]!.tries)

    // 用随机源真掷 1000 遍:平均次数贴近 1 / p,并且确实有"连败 4 次以上"的种子
    const trials = (major: number, layer: number): number[] =>
      Array.from({ length: 1000 }, (_, seed) => {
        const rng = createRng(`进阶-${major}-${layer}-${seed}`)
        const rate = realms.breakthroughRate(major, layer)
        for (let tries = 1; tries <= 200; tries += 1) if (rng.chance(rate)) return tries
        return 201
      })
    const sixth = trials(5, 9) // 第 6 境的大关:53%
    const mean = sixth.reduce((a, b) => a + b, 0) / sixth.length
    console.log(`  实测(第 6 境大关 53%,1000 颗种子):平均 ${mean.toFixed(2)} 次 · 最长连败 ${Math.max(...sixth) - 1} 次`)
    expect(mean).toBeCloseTo(1 / 0.53, 1)
    expect(sixth.some(n => n >= 7)).toBe(true) // 连败 6 次以上确实出现过
    // 防空转:成功率更高的那一档,平均次数必须更小
    const easy = trials(0, 0)
    expect(easy.reduce((a, b) => a + b, 0) / easy.length).toBeLessThan(mean)
  })

  it('从零升到顶的总账,与不配寿元时的口径', () => {
    let total = 0
    let last = ''
    for (let major = 0; major < realms.realms.length; major += 1) {
      const layers = realms.layersOf(major).length
      for (let layer = 0; layer < layers; layer += 1) {
        total += Number(realms.expCost(major, layer))
        last = realms.label(major, layer)
      }
    }
    console.log(`  从 ${realms.label(0, 0)} 一路升到 ${last}:一共要 ${total.toFixed(0)} 点修为`)
    expect(total).toBeGreaterThan(0)
    // 需求是逐境放大的:最后一境的第一层比第一境的第一层贵两个数量级
    expect(realms.expCost(5, 0) / realms.expCost(0, 0)).toBeGreaterThan(50)

    // 这一份配置没写 lifespan:寿元是 Infinity(而不是 0 —— 0 会让"到点就死")
    expect(realms.lifespanOf(0)).toBe(Number.POSITIVE_INFINITY)
    // 写上就是有限值:两份配置的差别只在那一行
    const withLife = createRealmSystem({
      worlds: [{ id: 'mortal', name: '尘世', realms: ['引气'] }],
      layerNames: ['一层'],
      exp: { base: 10, realmGrowth: 2, layerGrowth: 1.1, worldStepMult: 1 },
      combat: { base: { attack: 1, defense: 1, maxHp: 10 }, realmGrowth: 2, layerGrowth: 1.1 },
      breakthrough: { layerBase: 1, layerDecay: 0, majorBase: 1, majorDecay: 0, min: 0, max: 1 },
      lifespan: { base: 120, growth: 3, worldStepMult: 1 }
    })
    expect(Number(withLife.lifespanOf(0))).toBe(120)
    // 防空转:本值也随境界长
    expect(Number(realms.baseStats(2, 0).attack)).toBeGreaterThan(Number(realms.baseStats(0, 0).attack))
  })
})
