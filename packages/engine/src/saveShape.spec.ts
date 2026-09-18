import { describe, expect, it } from 'vitest'
import {
  asArray,
  asFiniteNumber,
  asNumberRecord,
  asObjectOrNull,
  asRecord,
  asRecordOf,
  asStringArray
} from './saveShape'

describe('存档形状修复 —— 形状不对就用兜底,而不是抛错', () => {
  it('asArray:不是数组给空数组,数组里的坏元素被滤掉,可自定义判据', () => {
    expect(asArray<number>('nope')).toEqual([])
    expect(asArray<number>([1, null, 2, undefined, 3])).toEqual([1, 2, 3])
    // 判据不必自己防 null:先滤一层再交给它 —— 少了那次"忘了写 !!x &&"
    expect(asArray<{ id?: string }>([{ id: 'a' }, {}, null], [], x => typeof (x as { id?: string }).id === 'string')).toEqual([{ id: 'a' }])
    expect(asArray<number>(null, [9])).toEqual([9])
  })

  it('asStringArray:混进去的非字符串直接丢掉', () => {
    expect(asStringArray(['a', 1, null, 'b'])).toEqual(['a', 'b'])
    expect(asStringArray({ a: 1 })).toEqual([])
  })

  it('asRecord:数组与 null 都不算对象', () => {
    expect(asRecord<number>({ a: 1 })).toEqual({ a: 1 })
    expect(asRecord<number>([1, 2])).toEqual({})
    expect(asRecord<number>(null)).toEqual({})
    expect(asRecord<number>('x', { fallback: 1 })).toEqual({ fallback: 1 })
  })

  it('asRecordOf:键对值烂的条目也丢掉(它们同样会在渲染期炸)', () => {
    const raw = { a: 1, b: null, c: 'x', d: 2 }
    expect(asRecordOf<number>(raw, x => typeof x === 'number')).toEqual({ a: 1, d: 2 })
  })

  it('asFiniteNumber:NaN/Infinity/字符串都退回兜底,并可设下限', () => {
    expect(asFiniteNumber(3, 0)).toBe(3)
    expect(asFiniteNumber(Number.NaN, 7)).toBe(7)
    expect(asFiniteNumber(Number.POSITIVE_INFINITY, 7)).toBe(7)
    expect(asFiniteNumber('3', 7)).toBe(7)
    expect(asFiniteNumber(-5, 0, 0)).toBe(0)
  })

  it('asNumberRecord:非数字的键丢掉,可设下限', () => {
    expect(asNumberRecord({ a: 1, b: 'x', c: Number.NaN, d: -2 })).toEqual({ a: 1, d: -2 })
    expect(asNumberRecord({ a: -2 }, 0)).toEqual({ a: 0 })
  })

  it('asObjectOrNull:数组不算,空对象算', () => {
    expect(asObjectOrNull<{ a: number }>({ a: 1 })).toEqual({ a: 1 })
    expect(asObjectOrNull<{ a: number }>([1])).toBeNull()
    expect(asObjectOrNull<{ a: number }>(null)).toBeNull()
  })
})
