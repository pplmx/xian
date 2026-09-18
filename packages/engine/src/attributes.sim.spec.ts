/* eslint-disable no-console */
/**
 * 消融实验 —— 第 N 条同名词条还值多少。
 *
 * `attributes.spec.ts` 钉的是语义(递减按贡献降序乘阶梯、软阈值折算、明细之和恒等于合计);
 * 这一份量的是**边际**:同一件装备上"再堆一条同名条件词条"到底还有多少价值 ——
 * 内容作者定"一件装备最多几条词条""同名要不要允许叠"时,需要的正是这张表。
 *
 * 三条量出来的结论:
 *   ① **默认阶梯只折前四条**:`[1, 0.75, 0.5, 0.25]` 之后**恒定 25%**,不是继续衰减 ——
 *      四条来源只算 2.5 条的份量,但再堆下去仍是线性涨:10 条名义 +100%、实际 +40%。
 *      想真封顶得靠软阈值或 `max`,光靠"递减阶梯"封不住;
 *   ② **`sum` / `max` 是两种完全不同的内容政策**:同样 6 条 +10%,默认 2.75 条,
 *      `sum` 是 6 条(叠满就爆),`max` 是 1 条("不许叠"最干脆);
 *   ③ **软阈值是第二道防线**:会心率越过 75% 之后,每 +1% 只值 +0.5%
 *      —— 堆到 100% 也只有 87.5%,堆到 200% 是 137.5%(永远不会"必暴")。
 */
import { describe, expect, it } from 'vitest'
import { createAttributeSystem } from './attributes.js'
import type { Mods } from './attributes.js'

/** 一件典型的"条件词条"装备:反击率走递减,会心率有软阈值 */
const attrs = createAttributeSystem({
  defs: [
    { key: 'power', name: '威能', kind: 'flat' },
    { key: 'guard', name: '护体', kind: 'flat' },
    { key: 'maxHp', name: '气血', kind: 'flat' },
    { key: 'counterRate', name: '反击率', kind: 'rate', diminishing: true },
    { key: 'critRate', name: '会心率', kind: 'rate', softCap: { cap: 0.75, diminish: 0.5 } }
  ]
})

const STEP = 0.1
const sources = (count: number, key: string): Mods[] =>
  Array.from({ length: count }, () => ({ [key]: STEP }))

const merged = (count: number, key: string, mode?: 'ranked' | 'max' | 'sum'): number => {
  const system =
    mode === undefined
      ? attrs
      : createAttributeSystem({
          defs: [
            { key: 'power', name: '威能', kind: 'flat' },
            { key: 'counterRate', name: '反击率', kind: 'rate', diminishing: true }
          ],
          diminish: { mode }
        })
  return system.mergeMods(sources(count, key))[key] ?? 0
}

describe('消融实验 —— 同名词条堆到第几条还值钱', () => {
  it('默认阶梯 [1, 0.75, 0.5, 0.25]:前四条只算 2.5 条,第 5 条起恒定 25%', () => {
    const rows = [1, 2, 3, 4, 5, 6, 10].map(count => ({ count, value: merged(count, 'counterRate') }))
    console.log('  同一条 +10% 的反击率,堆 N 条来源之后计入多少')
    for (const row of rows) {
      console.log(
        `  ${String(row.count).padStart(2, ' ')} 条 → ${(row.value * 100).toFixed(1)}%(≈ ${(row.value / STEP).toFixed(2)} 条的份量)`
      )
    }

    // ① 前四条按 1 / 0.75 / 0.5 / 0.25 计
    expect(merged(1, 'counterRate')).toBeCloseTo(0.1, 6)
    expect(merged(2, 'counterRate')).toBeCloseTo(0.175, 6)
    expect(merged(3, 'counterRate')).toBeCloseTo(0.225, 6)
    expect(merged(4, 'counterRate')).toBeCloseTo(0.25, 6)
    // 第 5 条起沿用最后一档(0.25):仍有用,但恒定只值四分之一
    expect(merged(5, 'counterRate')).toBeCloseTo(0.275, 6)
    expect(merged(6, 'counterRate')).toBeCloseTo(0.3, 6)
    expect(merged(10, 'counterRate')).toBeCloseTo(0.4, 6)
    // 六条来源 = 3.00 条的份量(名义六条,打对折)
    expect(merged(6, 'counterRate') / (6 * STEP)).toBeCloseTo(0.5, 2)
    // 关键::第 4 条之后每一名的边际**相同**(恒定 25%),不是继续衰减
    const margin = (n: number): number => merged(n, 'counterRate') - merged(n - 1, 'counterRate')
    expect(margin(5)).toBeCloseTo(margin(6), 9)
    expect(margin(6)).toBeCloseTo(margin(10), 9)
    expect(margin(5)).toBeCloseTo(STEP * 0.25, 9)
    // 而前四条的边际逐条变小(1 → 0.75 → 0.5 → 0.25)
    expect(margin(2)).toBeGreaterThan(margin(3))
    expect(margin(3)).toBeGreaterThan(margin(4))
    expect(margin(4)).toBeCloseTo(margin(5), 9)
    // 防空转:再堆第四条确实还涨(否则上面那张表是"加饱和"而不是递减)
    expect(merged(4, 'counterRate')).toBeGreaterThan(merged(3, 'counterRate'))
  })

  it('同六条词条,三种算法是三种内容政策', () => {
    const rows = (['ranked', 'max', 'sum'] as const).map(mode => ({ mode, value: merged(6, 'counterRate', mode) }))
    for (const row of rows) {
      console.log(`  ${row.mode.padEnd(7, ' ')}:6 条 +10% → ${(row.value * 100).toFixed(1)}%`)
    }
    const ranked = rows.find(r => r.mode === 'ranked')!.value
    const max = rows.find(r => r.mode === 'max')!.value
    const sum = rows.find(r => r.mode === 'sum')!.value

    // ② 三种政策的形状完全不同 —— 这是"同名能不能叠"的内容决定
    expect(max).toBeCloseTo(0.1, 6) // 只认最强的一条
    expect(sum).toBeCloseTo(0.6, 6) // 直接相加(等于关掉递减)
    expect(ranked).toBeGreaterThan(max)
    expect(ranked).toBeLessThan(sum)
    // 换算成"相当于几条":2.75 / 1 / 6
    console.log(`  —— 换算成"几条的份量":ranked ${(ranked / STEP).toFixed(2)} · max ${(max / STEP).toFixed(2)} · sum ${(sum / STEP).toFixed(2)}`)
  })

  it('软阈值是第二道防线:越过 75% 之后每 +1% 只值 +0.5%', () => {
    const at = (total: number): number => attrs.mergeMods([{ critRate: total }])['critRate'] ?? 0
    const rows = [0.5, 0.75, 0.8, 1, 1.5, 2].map(total => ({ total, actual: at(total) }))
    console.log('  会心率的名义合计 → 实际合计(软阈值 75% / 折半)')
    for (const row of rows) {
      console.log(`  ${(row.total * 100).toFixed(0)}% → ${(row.actual * 100).toFixed(1)}%`)
    }

    // ③ 阈值之内原样;越过之后超出部分折半
    expect(at(0.5)).toBeCloseTo(0.5, 6)
    expect(at(0.75)).toBeCloseTo(0.75, 6) // 正好在阈值上,不折
    expect(at(0.8)).toBeCloseTo(0.775, 6) // 75 + (80−75)/2
    expect(at(1)).toBeCloseTo(0.875, 6)
    expect(at(2)).toBeCloseTo(1.375, 6)
    // 每多 1% 只值 0.5% —— 这就是"堆到 100% 也不一定满"
    expect(at(1.01) - at(1)).toBeCloseTo(0.005, 6)
    // 防空转:阈值之内斜率是 1(没越过时不打折)
    expect(at(0.6) - at(0.5)).toBeCloseTo(0.1, 6)
  })

  it('摊回来源:面板明细之和恒等于面板值(递减也一样)', () => {
    const sources6 = sources(6, 'counterRate')
    const detailed = attrs.mergeModsDetailed(sources6)
    const rows = detailed.effective.map((bucket, index) => ({ index, counted: bucket['counterRate'] ?? 0 }))
    console.log(`  六条来源各自被计入多少:${rows.map(r => `${(r.counted * 100).toFixed(1)}%`).join(' · ')}`)
    const sum = rows.reduce((acc, r) => acc + r.counted, 0)
    expect(sum).toBeCloseTo(detailed.mods['counterRate']!, 9)
    // 第一条拿满、后面递减:数组顺序即来源顺序,明细也跟着这个顺序读
    expect(rows[0]!.counted).toBeCloseTo(0.1, 6)
    expect(rows[3]!.counted).toBeCloseTo(0.025, 6)
    // 防空转:六条里至少两条被折过(否则这个"明细"是假的)
    expect(rows.filter(r => r.counted < STEP - 1e-9).length).toBeGreaterThanOrEqual(2)
  })
})
