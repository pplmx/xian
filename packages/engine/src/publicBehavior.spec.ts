/* eslint-disable no-console */
/**
 * 公开面的**行为判据** —— 那批"只被列在清单里、没人真用过"的导出。
 *
 * 起因是一次审计:把 src 下的全部用例文件(去掉注释、并排除只罗列名字的 `publicApi.spec.ts`)
 * 与 `examples/` 全文扫一遍,对 `dist` 的 75 个运行时导出逐个查"有没有被真正用起来" ——
 * 结果有 9 个从没被任何行为性判据碰过,只在公开面清单里露过名字:
 *
 *   `clamp` `formatAmount` `numberNumeric` `mulberry32` `seedFromString` `randomRng`
 *   `DEFAULT_ATTRIBUTES` `DEFAULT_LAYER_NAMES` `progressText`
 *
 * 清单里有、却没判据,等于"承诺了一个没人试过的行为":改名不会红、边界写错也不会红。
 * 这一份给这 9 个各配一条最小判据(默认值 / 边界 / 与内容包的配合),
 * 并让 `scripts/verify-dist.mjs` 常驻盯着"每个导出都得有人真用过"。
 */
import { describe, expect, it } from 'vitest'
import { DEFAULT_ATTRIBUTES, attributeDefs, createAttributeSystem } from './attributes.js'
import { DEFAULT_LAYER_NAMES, createRealmSystem, progressText } from './realms.js'
import { clamp, formatAmount, numberNumeric } from './numeric.js'
import { createRng, mulberry32, pickWeighted, randomRng, seedFromString } from './rng.js'

describe('公开面行为判据 —— 数值适配与展示', () => {
  it('clamp 夹的是开区间之外:边界值原样返回', () => {
    expect(clamp(5, 0, 10)).toBe(5)
    expect(clamp(-5, 0, 10)).toBe(0)
    expect(clamp(15, 0, 10)).toBe(10)
    // 边界本身不算越界(这类 off-by-one 最容易写错)
    expect(clamp(0, 0, 10)).toBe(0)
    expect(clamp(10, 0, 10)).toBe(10)
    // 反向区间(lo > hi)的写法是确定的:先判 lo,所以给 lo
    expect(clamp(5, 10, 0)).toBe(10)
    console.log(`  clamp:5→${clamp(5, 0, 10)} · -5→${clamp(-5, 0, 10)} · 15→${clamp(15, 0, 10)} · 边界 0/10 原样`)
  })

  it('formatAmount 一万以下写原数,再往上换单位', () => {
    const rows: [number, string][] = [
      [0, '0'],
      [9999, '9999'],
      [12345, '1.2万'],
      [1.2e8, '1.2亿'],
      [1e12, '1.0万亿'],
      [Number.POSITIVE_INFINITY, '∞']
    ]
    for (const [value, text] of rows) {
      console.log(`  ${value} → ${formatAmount(value)}`)
      expect(formatAmount(value)).toBe(text)
    }
    // 阈值是 10000:9999 还是原数,10000 就已经进"万"档
    expect(formatAmount(9999)).toBe('9999')
    expect(formatAmount(10_000)).toBe('1.0万')
    // 负号与小数位都跟着走
    expect(formatAmount(-12345)).toBe('-1.2万')
    expect(formatAmount(12345, 2)).toBe('1.23万')
    expect(formatAmount(Number.NEGATIVE_INFINITY)).toBe('-∞')
  })

  it('numberNumeric 是默认适配层:四则、比较、除零、格式化都在这一处', () => {
    const n = numberNumeric
    expect(n.zero).toBe(0)
    expect(n.one).toBe(1)
    expect(n.add(2, 3)).toBe(5)
    expect(n.sub(2, 3)).toBe(-1)
    expect(n.mul(2, 3)).toBe(6)
    expect(n.mulN(2, 3)).toBe(6)
    expect(n.pow(2, 10)).toBe(1024)
    expect(n.powN(2, 10)).toBe(1024)
    expect(n.cmp(1, 2)).toBe(-1)
    expect(n.cmp(2, 1)).toBe(1)
    expect(n.cmp(2, 2)).toBe(0)
    expect(n.max(2, 3)).toBe(3)
    expect(n.toNumber(7)).toBe(7)
    expect(n.format(12345)).toBe(formatAmount(12345))
    // 除零的口径是 0(不是 Infinity 也不是 NaN)—— 账本做比例时靠它兜底
    expect(n.div(1, 0)).toBe(0)
    console.log(`  numberNumeric:除零给 ${n.div(1, 0)}(不是 Infinity)`)
  })
})

describe('公开面行为判据 —— 随机源三件', () => {
  it('mulberry32:同种子同序列,不同种子不同序列', () => {
    const a = mulberry32(42)
    const b = mulberry32(42)
    const first = [a(), a(), a()]
    const second = [b(), b(), b()]
    expect(second).toEqual(first)
    // 与 createRng 同源:同种子下第一条随机数一致(迁移对账靠这条)
    expect(first[0]).toBe(createRng(42).next())
    const other = mulberry32(43)
    expect(other()).not.toBe(first[0])
    // 值域 [0, 1)
    const rng = mulberry32(7)
    const values = Array.from({ length: 200 }, () => rng())
    expect(Math.min(...values)).toBeGreaterThanOrEqual(0)
    expect(Math.max(...values)).toBeLessThan(1)
    console.log(`  mulberry32(42) 前三条:${first.map(v => v.toFixed(6)).join(' · ')}`)
  })

  it('seedFromString:同一个字符串永远是同一个 32 位种子', () => {
    const seed = seedFromString('青云山麓')
    expect(seed).toBe(seedFromString('青云山麓'))
    expect(seed).toBeGreaterThanOrEqual(0)
    expect(seed).toBeLessThan(2 ** 32)
    expect(Number.isInteger(seed)).toBe(true)
    // 差一个字就是另一个种子
    expect(seedFromString('青云山')).not.toBe(seed)
    // 空串也有确定的种子(0x811c9dc5,FNV-1a 的初值)
    expect(seedFromString('')).toBe(0x811c9dc5)
    // 与 createRng 串起来:字符串种子可复现(库里推荐的用法就是这个)
    expect(createRng('青云山麓').next()).toBe(mulberry32(seed)())
    console.log(`  "青云山麓" → ${seed}(空串 → ${seedFromString('')})`)
  })

  it('randomRng 是"非可复现"的那一个:每次都不一样,但接口与可复现源相同', () => {
    const values = Array.from({ length: 100 }, () => randomRng.next())
    expect(new Set(values).size).toBeGreaterThan(90) // 基本不会重复
    // 接口一致:该有的方法都在,且能直接喂给库(例如掉落表)
    for (const method of ['next', 'int', 'float', 'chance', 'pick', 'weighted'] as const) {
      expect(typeof randomRng[method]).toBe('function')
    }
    expect(randomRng.int(3, 5)).toBeGreaterThanOrEqual(3)
    expect(randomRng.int(3, 5)).toBeLessThanOrEqual(5)
    expect(randomRng.pick(['a'])).toBe('a')
    expect(randomRng.weighted([{ w: 0 }, { w: 1 }], x => x.w)).toEqual({ w: 1 })
    console.log(`  randomRng 100 次里有 ${new Set(values).size} 个不同的值(可复现源则会只有 1 个种子下的确定序列)`)
  })

  it('pickWeighted: next()===0 never selects a leading zero-weight item', () => {
    const items = [
      { id: 'zero', w: 0 },
      { id: 'first-positive', w: 1 },
      { id: 'second-positive', w: 1 }
    ]
    // next()===0 used to pick the first item even when its weight was 0
    // (roll <= 0 after subtracting nothing). Half-open buckets skip it.
    expect(pickWeighted(items, it => it.w, () => 0).id).toBe('first-positive')
    expect(createRng(1).weighted(items, it => it.w).id).not.toBe('zero')

    // Negative weights are treated as 0; all-nonpositive falls back to uniform.
    const zeros = [
      { id: 'a', w: 0 },
      { id: 'b', w: -3 }
    ]
    expect(pickWeighted(zeros, it => it.w, () => 0).id).toBe('a')
    expect(pickWeighted(zeros, it => it.w, () => 0.99).id).toBe('b')

    // Exact bucket boundary belongs to the next positive item (half-open).
    const two = [
      { id: 'left', w: 1 },
      { id: 'right', w: 1 }
    ]
    expect(pickWeighted(two, it => it.w, () => 0.5).id).toBe('right')
    expect(pickWeighted(two, it => it.w, () => 0).id).toBe('left')
    console.log('  pickWeighted: next()===0 + leading zero-weight → first positive')
  })
})

describe('公开面行为判据 —— 两张默认表与进度文案', () => {
  it('DEFAULT_ATTRIBUTES 就是不含任何改名时的默认表', () => {
    const keys = DEFAULT_ATTRIBUTES.map(d => d.key)
    expect(keys).toContain('attack')
    expect(keys).toContain('critRate')
    expect(new Set(keys).size).toBe(keys.length) // 键不重复
    // attributeDefs() 不给参数时就是它的副本(内容包改的是副本,不动原表)
    const copy = attributeDefs({})
    expect(copy.map(d => d.key)).toEqual(keys)
    copy[0]!.name = '被改了'
    expect(DEFAULT_ATTRIBUTES[0]!.name).not.toBe('被改了')

    // 真装起来能用:默认表能建出属性系统,且核心三围就是攻防血
    const attrs = createAttributeSystem({ defs: attributeDefs({}) })
    expect(attrs.coreKeys).toEqual(['attack', 'defense', 'maxHp'])
    console.log(`  默认属性 ${DEFAULT_ATTRIBUTES.length} 条,核心:${attrs.coreKeys.join('/')}`)
  })

  it('DEFAULT_LAYER_NAMES:十层、末尾是"圆满" —— 与玄门惯用的九层一圆满一致', () => {
    expect(DEFAULT_LAYER_NAMES.length).toBe(10)
    expect(DEFAULT_LAYER_NAMES[0]).toBe('一层')
    expect(DEFAULT_LAYER_NAMES.at(-1)).toBe('圆满')
    // 不给 layerNames 时,境界系统就用这一份:第 0 境第 5 层叫"六层"
    const realms = createRealmSystem({
      worlds: [{ id: 'w', name: '凡界', realms: ['引气'] }],
      exp: { base: 10, realmGrowth: 2, layerGrowth: 1.2, worldStepMult: 2 },
      combat: { base: { attack: 1, defense: 1, maxHp: 10 }, realmGrowth: 2, layerGrowth: 1.1 },
      breakthrough: { layerBase: 1, layerDecay: 0, majorBase: 1, majorDecay: 0, min: 0, max: 1 }
    })
    expect(realms.layerNames).toEqual([...DEFAULT_LAYER_NAMES])
    expect(realms.label(0, 5)).toContain('六层')
    console.log(`  默认层名:${realms.label(0, 0)} → ${realms.label(0, 9)}`)
  })

  it('progressText:一行"现在到哪、还差多少、几成"', () => {
    const realms = createRealmSystem({
      worlds: [{ id: 'w', name: '凡界', realms: ['引气'] }],
      layerNames: ['一层', '二层'],
      exp: { base: 100, realmGrowth: 2, layerGrowth: 1, worldStepMult: 2 },
      combat: { base: { attack: 1, defense: 1, maxHp: 10 }, realmGrowth: 2, layerGrowth: 1.1 },
      breakthrough: { layerBase: 1, layerDecay: 0, majorBase: 1, majorDecay: 0, min: 0, max: 1 }
    })
    const empty = progressText(realms, { major: 0, layer: 0, exp: 0 }, String)
    const half = progressText(realms, { major: 0, layer: 0, exp: 50 }, String)
    console.log(`  0 修为:${empty}`)
    console.log(`  50 修为:${half}`)

    // 文案是"标签 当前/需求(百分比)",且百分比向下取整
    expect(empty).toContain('/')
    expect(empty).toContain('(0%)')
    expect(half).toContain('(50%)')
    expect(half.startsWith(realms.progress({ major: 0, layer: 0, exp: 50 }).label)).toBe(true)
    // 防空转:两份输入的文案确实不同
    expect(half).not.toBe(empty)
  })
})
