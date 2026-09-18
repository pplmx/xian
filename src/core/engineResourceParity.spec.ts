/**
 * 资源层对账 —— 本作的资源口径搬到万象引擎之后,与**迁移前冻结的旧实现**逐位相等。
 *
 * 与 `engineParity` 同一条纪律:迁移不是"看起来差不多",而是同一个数字一位不差。
 * 下面 `ref*` 那几行是从旧 `stores/resources.ts` 原样抄下来的(迁移前的样子),
 * 用来当尺子;新实现走库的 `createResourceSystem`(见 core/engineResources)。
 *
 * 一处**有意的收紧**写在用例里:材料是整数资源(库的 `integer: true`),
 * 所以"支出 0.5 个灵草"这种在内容里不存在、也没人看得懂的写法,新口径会夹回整数;
 * 旧口径会留下 4.5。整张内容表与全量用例里没有一条这样的支出,故不构成行为变化。
 */
import { describe, expect, it } from 'vitest'
import type { GNum } from '@/types'
import { add, gn, gte, subClamp } from '@/utils/gnum'
import { formatExact } from '@/utils/format'
import { QI_BANK_MULT } from '@/data/constants'
import { clampQi, gainSmall, gainStone, hasSmall, hasStone, paySmall, payStone } from './engineResources'

// —— 迁移前冻结的旧口径(原 stores/resources.ts 的实现)——
const refAddStone = (s: GNum, v: GNum): GNum => add(s, v)
const refSpendStone = (s: GNum, v: GNum): { ok: boolean; stone: GNum } =>
  gte(s, v) ? { ok: true, stone: subClamp(s, v) } : { ok: false, stone: s }
const refHasStone = (s: GNum, v: GNum): boolean => gte(s, v)
const refAddSmall = (value: number, n: number): number => Math.max(0, Math.floor(value + n))
const refSpendSmall = (value: number, n: number): { ok: boolean; value: number } =>
  value < n ? { ok: false, value } : { ok: true, value: value - n }
const refHasSmall = (value: number, n: number): boolean => value >= n
const refSetQi = (v: number, cap: number): number => Math.max(0, Math.min(cap * QI_BANK_MULT, v))

const STONE_GRID: [string, string][] = [
  ['0', '0'],
  ['0', '1000'],
  ['1', '1'],
  ['1000000', '250000'],
  ['1e40', '1e38'],
  ['1e40', '1e41'] // 付不起
]

describe('资源对账 —— 灵石(大数)', () => {
  it('收 / 付 / 够不够:与冻结的旧口径逐位相同', () => {
    for (const [balance, delta] of STONE_GRID) {
      const s = gn(Number(balance))
      const v = gn(Number(delta))
      expect(formatExact(gainStone(s, v)), `收 ${balance} + ${delta}`).toBe(formatExact(refAddStone(s, v)))
      const paid = payStone(s, v)
      const ref = refSpendStone(s, v)
      expect(paid.ok, `付 ${balance} - ${delta}`).toBe(ref.ok)
      expect(formatExact(paid.stone)).toBe(formatExact(ref.stone))
      expect(hasStone(s, v)).toBe(refHasStone(s, v))
    }
  })

  it('大数不被压成 double:1e40 的收付仍然精确', () => {
    const big = gn(1e40)
    const after = gainStone(big, big)
    expect(formatExact(after)).toBe(formatExact(add(big, big)))
    expect(after.e).toBe(40)
  })
})

describe('资源对账 —— 材料与灵气', () => {
  it('收材料:取整 + 不为负,与旧口径一致', () => {
    for (const value of [0, 1, 2.5, 100]) {
      for (const n of [-3, -0.5, 0, 0.5, 2.7, 10]) {
        expect(gainSmall({ herb: value }, 'herb', n), `${value} + ${n}`).toBe(refAddSmall(value, n))
      }
    }
  })

  it('付材料:够就扣、不够不动(内容里的支出都是整数)', () => {
    for (const value of [0, 1, 5, 100]) {
      for (const n of [0, 1, 5, 10]) {
        const paid = paySmall({ herb: value }, 'herb', n)
        const ref = refSpendSmall(value, n)
        expect(paid.ok, `${value} - ${n}`).toBe(ref.ok)
        expect(paid.value).toBe(ref.value)
        expect(hasSmall({ herb: value }, 'herb', n)).toBe(refHasSmall(value, n))
      }
    }
  })

  it('灵气积余:标称容量的 QI_BANK_MULT 倍是软顶,与旧口径一致', () => {
    for (const cap of [0, 10, 100]) {
      for (const v of [-3, 0, 5, 10.5, 100, 10_000]) {
        expect(clampQi(v, cap), `cap=${cap} v=${v}`).toBe(refSetQi(v, cap))
      }
    }
  })
})

describe('资源层交给库之后多出来的东西', () => {
  it('灵石收支带你给的来源标签,事后查得出来源(旧 store 没有这一层)', async () => {
    const { STONE_LEDGER } = await import('./engineResources')
    const wallet = STONE_LEDGER.create()
    const a = STONE_LEDGER.grant(wallet, [{ key: 'stone', amount: 120, source: '历练' }])
    const b = STONE_LEDGER.grant(a.ledger, [{ key: 'stone', amount: 30, source: '任务' }])
    const c = STONE_LEDGER.pay(b.ledger, [{ key: 'stone', amount: 50, source: '炼器' }])
    const report = STONE_LEDGER.audit([...a.entries, ...b.entries, ...c.entries])
    expect(formatExact(report.bySource['历练']!.net)).toBe(formatExact(gn(120)))
    expect(formatExact(report.bySource['任务']!.net)).toBe(formatExact(gn(30)))
    expect(formatExact(report.bySource['炼器']!.net)).toBe(formatExact(gn(-50)))
    // 明细恒等于合计:各来源净额之和 = 按资源算的净额
    const summed = Object.values(report.bySource).reduce((sum, row) => add(sum, row.net), gn(0))
    expect(formatExact(summed)).toBe(formatExact(report.byKey.stone!.net))
  })
})
