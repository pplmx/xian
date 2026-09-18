/* eslint-disable no-console */
/**
 * 消融实验 —— **数字什么时候不够用**:`number` 的精度边界、面板的显示分辨率,以及换 `Numeric<T>` 的时机。
 *
 * 这份实验回答的是内容作者迟早会问的那句话:"我这游戏数值涨到多少就该换大数了?"
 * 库里此前只有一句"后期涨到 1e40 也不稀奇,换个实现即可",没有任何刻度。这里把边界量出来:
 *
 *   一 **安全区到哪**:整数从 `2^53` 起,"+1" 会被吞掉(注意不是 `MAX_SAFE_INTEGER`:
 *      在它上面 +1 还对,正好等于 `2^53`,从 `2^53` 起才开始失效);
 *   二 **面板先失真**:`formatAmount` 在"京"档只保留一位小数,同一个字符串
 *      ("1.0京")盖住 500 万亿的跨度 —— 也就是说**数值还没到精度边界,界面先看不出差别了**;
 *   三 **什么时候该换**:把最常见的"每层 ×growth"曲线代进去,量出"第几层越界";
 *   四 **换过去真的能用**:同一个 `createRealmSystem` 配置,喂一份 `Numeric<bigint>`
 *      实现,公式与内容一行不改,越界那几层立刻精确 —— 这条是"数值层可替换"的正面判据。
 *
 * 顺带钉住一个容易踩的边界:`clamp(NaN, lo, hi)` 仍然是 `NaN`(NaN 的比较全为 false),
 * 所以"叠出来的概率"进骰子之前必须先自己判 `Number.isFinite` —— `recipes` 与 `realms`
 * 都是这么做的,这一条由 `realms.spec.ts` 的回归用例守着。
 */
import { describe, expect, it } from 'vitest'
import { createRealmSystem } from './realms.js'
import { clamp, formatAmount, numberNumeric, type Numeric } from './numeric.js'

/** `2^53` —— JS 里"再往后 +1 未必有效"的那个整数边界 */
const UNSAFE_FROM = 2 ** 53

/** 最常见的放置曲线:首层 100,每层 ×growth */
const curveCost = (level: number, growth: number): number => numberNumeric.mulN(numberNumeric.powN(growth, level), 100)

/** 一层层往上找:从哪一层开始,这个数"+1"不再改变它(找不到就 -1) */
const firstLevelWhereAddOneIsLost = (growth: number, limit = 500): number => {
  for (let level = 0; level <= limit; level += 1) {
    const cost = curveCost(level, growth)
    if (numberNumeric.add(cost, 1) === cost) return level
  }
  return -1
}

/**
 * 一份 30 行的 `Numeric<bigint>` —— 用来证明"换数值层"这件事的**成本**:
 * 接口一共 15 个成员,公式与内容一行都不用动。
 *
 * 两处是刻意留白的(不是遗漏):`powN` 的底数取整(要小数底数就得自己定精度策略),
 * `format` 借道 `number` 只为演示 —— 真上大数,显示层也得跟着换。
 */
const bigintNumeric: Numeric<bigint> = {
  zero: 0n,
  one: 1n,
  from: n => BigInt(Math.round(n)),
  of: value => (typeof value === 'bigint' ? value : BigInt(Math.round(value))),
  add: (a, b) => a + b,
  sub: (a, b) => a - b,
  mul: (a, b) => a * b,
  mulN: (a, k) => a * BigInt(Math.round(k)),
  div: (a, b) => (b === 0n ? 0n : a / b),
  pow: (a, k) => a ** BigInt(Math.round(k)),
  powN: (base, k) => BigInt(Math.round(base)) ** BigInt(Math.round(k)),
  cmp: (a, b) => (a < b ? -1 : a > b ? 1 : 0),
  max: (a, b) => (a > b ? a : b),
  toNumber: a => Number(a),
  format: (a, decimals) => formatAmount(Number(a), decimals)
}

/**
 * "每层 ×3、每境 ×9"的一张表:整倍率,便于逐位核对。
 * 层数给得深(22 境 × 10 层),是为了让最深那几层真的越过 `2^53` ——
 * 3^30 ≈ 2.06e16,乘上首层的 100 之后,`number` 的个位已经不存在了。
 */
const ladderConfig = {
  worlds: [
    {
      id: 'ladder',
      name: '阶梯',
      realms: Array.from({ length: 22 }, (_, i) => `第 ${i + 1} 阶`)
    }
  ],
  layerNames: Array.from({ length: 10 }, (_, i) => `${i + 1} 层`),
  exp: { base: 100, layerGrowth: 3, realmGrowth: 9, lateRealmGrowth: 9 },
  combat: { base: { 值: 10 }, layerGrowth: 2, realmGrowth: 4, lateRealmGrowth: 4 },
  breakthrough: { layerBase: 0.9, layerDecay: 0.1, majorBase: 0.7, majorDecay: 0.1, min: 0.05, max: 0.95 }
}

describe('消融实验 —— 数字什么时候不够用', () => {
  it('安全区:2^53 起 +1 会被吞掉(边界不是 MAX_SAFE_INTEGER)', () => {
    console.log(`  MAX_SAFE_INTEGER                 ${Number.MAX_SAFE_INTEGER}`)
    console.log(`  2^53                             ${UNSAFE_FROM}`)
    console.log(`  MAX_SAFE + 1                     ${numberNumeric.add(Number.MAX_SAFE_INTEGER, 1)}`)
    console.log(`  MAX_SAFE + 2                     ${numberNumeric.add(Number.MAX_SAFE_INTEGER, 2)}`)
    console.log(`  2^53 + 1 === 2^53                ${numberNumeric.add(UNSAFE_FROM, 1) === UNSAFE_FROM}`)
    // 边界很窄:MAX_SAFE 上 +1 还对(正好是 2^53),+2 就已经吞掉一个
    expect(numberNumeric.add(Number.MAX_SAFE_INTEGER, 1)).toBe(UNSAFE_FROM)
    expect(numberNumeric.add(Number.MAX_SAFE_INTEGER, 2)).toBe(UNSAFE_FROM)
    expect(numberNumeric.add(UNSAFE_FROM, 1)).toBe(UNSAFE_FROM)
  })

  it('显示先失真:"京"档下同一个字符串盖住 500 万亿', () => {
    const base = 1e16 // "京"档的起点
    const shown = formatAmount(base)
    let lo = 1
    let hi = 1e15
    while (hi - lo > 1) {
      const mid = Math.floor((lo + hi) / 2)
      if (formatAmount(base + mid) === shown) lo = mid
      else hi = mid
    }
    const ulp = base + 2 !== base // 1e16 处相邻可表示数的间隔是 2
    console.log(`  formatAmount(1e16)               ${shown}`)
    console.log(`  同一个字符串盖住的跨度            ${hi.toLocaleString()}(占 1e16 的 ${((hi / base) * 100).toFixed(1)}%)`)
    console.log(`  这一段里被"合并"的可表示数        约 ${(hi / 2).toExponential(1)} 个`)
    console.log(`  1e16 处相邻可表示数只差           2(而不是 1):${ulp}`)
    expect(shown).toBe('1.0京')
    expect(formatAmount(base + 2)).toBe(shown) // 涨了 2,面板上看不出来
    expect(hi).toBeGreaterThan(4.9e14) // 同一字符串至少盖住 4.9e14 的跨度
    expect(hi).toBeLessThan(1e15)
  })

  it('该换大数的时机:×1.5 到第 80 层、×3.2 到第 28 层', () => {
    const growth15 = firstLevelWhereAddOneIsLost(1.5)
    const growth32 = firstLevelWhereAddOneIsLost(3.2)
    console.log(`  100 × 1.5^level 越界层           第 ${growth15} 层(${formatAmount(curveCost(growth15, 1.5))})`)
    console.log(`  100 × 3.2^level 越界层           第 ${growth32} 层(${formatAmount(curveCost(growth32, 3.2))})`)
    // 曲线的形状决定"多久必须换":倍率越大,越早越界
    expect(growth15).toBe(80)
    expect(growth32).toBe(28)
    expect(growth32).toBeLessThan(growth15)
    // 越界那一层起,"+1" 已经改变不了数 —— 也就是说"这一层涨了 1 点"在账上不存在
    expect(numberNumeric.add(curveCost(growth32, 3.2), 1)).toBe(curveCost(growth32, 3.2))
  })

  it('溢出:1e308 × 10 直接变成 Infinity,formatAmount 显示成 ∞', () => {
    const big = 1e308
    console.log(`  1e308 × 10                       ${numberNumeric.mulN(big, 10)}`)
    console.log(`  formatAmount(Infinity)           ${formatAmount(Number.POSITIVE_INFINITY)}`)
    expect(numberNumeric.mulN(big, 10)).toBe(Number.POSITIVE_INFINITY)
    expect(formatAmount(Number.POSITIVE_INFINITY)).toBe('∞')
  })

  it('换 bigint:同一份配置、同一套公式,越界那几层立刻逐位精确', () => {
    const asNumber = createRealmSystem(ladderConfig, numberNumeric)
    const asBigint = createRealmSystem(ladderConfig, bigintNumeric)
    // 最深的那个格子:100 × 3^(境) × 3^(层) —— 22 境 × 10 层时是 100 × 3^30
    const major = 21
    const layer = 9
    const viaNumber = asNumber.expCost(major, layer)
    const viaBigint = asBigint.expCost(major, layer)
    // expCost = 首层 100 × 每境 ×9 的大跃 × 每层 ×3
    const exact = 100n * bigintNumeric.powN(9, major) * bigintNumeric.powN(3, layer)
    console.log(`  number 层算出来                   ${viaNumber.toExponential(20)}`)
    console.log(`  bigint 层算出来                   ${viaBigint}(精确值 ${exact})`)
    console.log(`  两者的相对差                       ${(Math.abs(Number(viaBigint) - viaNumber) / viaNumber).toExponential(2)}`)
    console.log(`  number 层"+1"还有效吗              ${numberNumeric.add(viaNumber, 1) !== viaNumber}`)
    console.log(`  bigint 层"+1"还有效吗              ${bigintNumeric.add(viaBigint, 1n) !== viaBigint}`)
    console.log(`  把 bigint +1 转回 number 看得出来吗 ${Number(viaBigint + 1n) !== Number(viaBigint)}`)
    expect(viaBigint).toBe(exact)
    // 两条路算出来的数只在 double 的舍入上差一点点 —— 真正的问题不是"差多少",
    // 而是"个位根本没有意义了":number 层 +1 不变,连换成 bigint 再 +1 都表示不出来
    expect(Math.abs(Number(viaBigint) - viaNumber) / viaNumber).toBeLessThan(1e-12)
    // 同一个数:number 层已经把个位丢了(+1 不变),bigint 层每次 +1 都算数
    expect(numberNumeric.add(viaNumber, 1)).toBe(viaNumber)
    expect(bigintNumeric.add(viaBigint, 1n)).not.toBe(viaBigint)
    expect(Number(viaBigint + 1n)).toBe(Number(viaBigint)) // 连 +1 都表示不出来的量级
    // 面板进度两边都要落在 [0,1](调用方读到的是比值,不是原始数)
    const numberProgress = asNumber.progress({ major, layer, exp: viaNumber })
    const bigintProgress = asBigint.progress({ major, layer, exp: viaBigint })
    console.log(`  number 满修为时的比值              ${numberProgress.ratio}`)
    console.log(`  bigint 满修为时的比值              ${bigintProgress.ratio}`)
    expect(numberProgress.ready).toBe(true)
    expect(bigintProgress.ready).toBe(true)
    expect(numberProgress.ratio).toBe(1)
    expect(bigintProgress.ratio).toBe(1)
  })

  it('clamp 不兜底 NaN:交给它之前必须自己判 Number.isFinite', () => {
    console.log(`  clamp(NaN, 0, 1)                 ${clamp(Number.NaN, 0, 1)}`)
    console.log(`  clamp(2, 0, 1) / clamp(-1, 0, 1) ${clamp(2, 0, 1)} / ${clamp(-1, 0, 1)}`)
    expect(Number.isNaN(clamp(Number.NaN, 0, 1))).toBe(true)
    expect(clamp(2, 0, 1)).toBe(1)
    expect(clamp(-1, 0, 1)).toBe(0)
  })
})
