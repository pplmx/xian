import { describe, expect, it } from 'vitest'
import { defineSaveFormat, decodeSave, decodeSavePayload, encodeSave, runMigrations } from './save.js'
import { asArray, asFiniteNumber, asNumberRecord, asRecordOf, asStringArray } from './saveShape.js'

interface State {
  gold: number
  bag: string[]
}

const FORMAT = defineSaveFormat<State>({
  currentVersion: 3,
  migrations: {
    1: data => {
      const d = data as { gold?: unknown; bag?: unknown }
      // 版本 2 改过一件事:金币从字符串变成数字
      return { ...d, gold: Number(d.gold ?? 0) }
    },
    2: data => {
      const d = data as { gold: number }
      // 版本 3:多了背包
      return { ...d, bag: [] }
    }
  },
  revive: data => {
    const d = data as { gold?: unknown; bag?: unknown }
    return { gold: asFiniteNumber(d.gold, 0, 0), bag: asStringArray(d.bag) }
  }
})

describe('存档封装 —— 版本、迁移链、编解码', () => {
  it('往返:编码的版本与时刻写进封套,解码拿回同一份状态', () => {
    const text = encodeSave({ gold: 10, bag: ['剑'] }, FORMAT, 1_700_000_000_000)
    const result = decodeSave(text, FORMAT)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.state).toEqual({ gold: 10, bag: ['剑'] })
    expect(result.fromVersion).toBe(3)
    expect(result.migrated).toBe(false)
    expect(result.savedAt).toBe(1_700_000_000_000)
  })

  it('迁移是链:版本 1 的档一路走到当前版本', () => {
    const v1 = JSON.stringify({ version: 1, savedAt: 0, data: { gold: '7' } })
    const result = decodeSave(v1, FORMAT)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.state).toEqual({ gold: 7, bag: [] })
    expect(result.fromVersion).toBe(1)
    expect(result.migrated).toBe(true)
  })

  it('缺失的迁移跳按"形状没变"处理,不打断整条链', () => {
    const gaps = defineSaveFormat<{ a: number }>({ currentVersion: 4, migrations: { 2: d => ({ ...(d as object), a: 1 }) } })
    expect(runMigrations({ a: 0 }, 1, gaps as never)).toEqual({ a: 1 })
    expect(runMigrations({ a: 0 }, 4, gaps as never)).toEqual({ a: 0 })
  })

  it('版本号不认识时按最老的一版补起(不跳过整条链)', () => {
    const fmt = defineSaveFormat<unknown>({ currentVersion: 3, migrations: { 1: () => ({ done: 1 }), 2: d => ({ ...(d as object), done: 2 }) } })
    expect(runMigrations({}, Number.NaN, fmt)).toEqual({ done: 2 })
    expect(runMigrations({}, -5, fmt)).toEqual({ done: 2 })
  })

  it('未来的版本不猜:拒绝并说明', () => {
    const text = encodeSave({ gold: 1, bag: [] }, defineSaveFormat<State>({ currentVersion: 9 }))
    const result = decodeSave(text, FORMAT)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.reason).toBe('future')
    expect(result.message).toContain('9')
  })

  it('坏内容与修不回来的形状,各有各的原因', () => {
    const broken = decodeSave('这不是 JSON', FORMAT)
    expect(broken.ok).toBe(false)
    if (!broken.ok) expect(broken.reason).toBe('parse')

    const strict = defineSaveFormat<{ n: number }>({ currentVersion: 1, revive: d => (typeof (d as { n?: unknown }).n === 'number' ? (d as { n: number }) : null) })
    const rejected = decodeSave(JSON.stringify({ version: 1, savedAt: 0, data: {} }), strict)
    expect(rejected.ok).toBe(false)
    if (!rejected.ok) expect(rejected.reason).toBe('shape')
  })

  it('已经解析过的对象也能走同一条路(容器存储里读回来就是一坨对象)', () => {
    const result = decodeSavePayload({ version: 1, savedAt: 5, data: { gold: '3' } }, FORMAT)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.state).toEqual({ gold: 3, bag: [] })
    expect(result.savedAt).toBe(5)
  })

  it('形状修复原语:坏元素被滤掉、坏数字退回兜底', () => {
    expect(asArray<number>([1, null, 2, undefined])).toEqual([1, 2])
    expect(asStringArray(['a', 1, null])).toEqual(['a'])
    expect(asFiniteNumber('x', 5, 1)).toBe(5)
    expect(asFiniteNumber(-3, 5, 0)).toBe(0)
    expect(asNumberRecord({ a: 1, b: 'x', c: Infinity })).toEqual({ a: 1 })
    expect(asRecordOf<number>({ a: 1, b: null }, x => typeof x === 'number')).toEqual({ a: 1 })
  })

  it('编解码可自己接管:压缩/加密/换封套都行,迁移链与形状修复照旧', () => {
    // 这里用一个可逆的假"加密":整体反转字符串 —— 只为验流程,不是真加密
    const codec = {
      encode: (payload: unknown) => JSON.stringify(payload).split('').reverse().join(''),
      decode: (text: string) => JSON.parse(text.split('').reverse().join(''))
    }
    const fmt = defineSaveFormat<{ gold: number }>({
      currentVersion: 2,
      codec,
      migrations: { 1: d => ({ gold: Number((d as { gold?: unknown }).gold ?? 0) }) },
      revive: d => (typeof (d as { gold?: unknown }).gold === 'number' ? (d as { gold: number }) : null)
    })
    const text = encodeSave({ gold: 5 }, fmt)
    expect(text.startsWith('{')).toBe(false) // 已经不是裸 JSON
    const back = decodeSave(text, fmt)
    expect(back.ok && back.state.gold).toBe(5)
    // 旧版本的封套同样走编解码 + 迁移链
    const oldText = codec.encode({ version: 1, savedAt: 0, data: { gold: '7' } })
    const migrated = decodeSave(oldText, fmt)
    expect(migrated.ok && migrated.state.gold).toBe(7)
    // 解不开 → 归到 parse 这一类,而不是 shape
    expect(decodeSave('这不是我写的格式', fmt)).toMatchObject({ ok: false, reason: 'parse' })
  })
})
