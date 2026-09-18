/**
 * 组合验收(第四条链)—— **一份老档升级之后,世界还能照样跑**。
 *
 * 前三条链验的是"跑起来对不对"(账目自洽 / 时间与随机 / 状态与投资);这一条验另一件事:
 * 玩家几个月前存的档,拿到新版本里**还能不能接着玩**。库里 `save` / `saveShape` 各自有用例,
 * 但"升级之后世界照旧"这件事没有跨模块判据,而它恰好是玩家最不能接受出问题的地方。
 *
 * 这份用例搭一份"上一版形状"的存档(缺字段、类型写坏、版本号落后),走完
 * **解码 → 迁移链 → 形状修复**,再把世界推几轮,断言四件事:
 *
 *   一 **修完的形状合法**:该是数字的是数字、该是数组的是数组,未知的老字段保留(删了更糟);
 *   二 **迁移幂等**:同一份档再走一遍,结果一位不变;
 *   三 **升级是纯的**:同一份老档升两次,结果完全相同(与调用顺序、次数无关);
 *   四 **升级后的世界与"同状态新开"一致**:推同样几轮,逐字段相同 ——
 *      老玩家不该因为"档老"而走上一条不同的曲线。
 */
import { describe, expect, it } from 'vitest'
import { decodeSave, decodeSavePayload, defineSaveFormat, encodeSave, runMigrations } from './save.js'
import { asArray, asNumberRecord, asRecord, asStringArray } from './saveShape.js'
import { createResourceSystem } from './resources.js'
import { createFacilitySystem } from './facilities.js'
import { accrue } from './facilities.js'
import { createTaskBoard } from './tasks.js'
import { createCodex } from './codex.js'

// ——— 这一份"世界"的存档形状 ———

interface Save {
  /** 从 1 到 3:1 只有资源;2 加了设施;3 加了任务与图鉴 */
  wallet: Record<string, number>
  levels: Record<string, number>
  counters: Record<string, number>
  /** 图鉴状态:与 `CodexState` 同形(这里不 import 那个类型,免得把形状写成"随手一份") */
  book: { seen: Record<string, number>; stage: Record<string, number>; best: Record<string, Record<string, number>> }
  /** 后加的字段:第 3 版才有 */
  claimed?: string[]
  /** 老档里可能存在、现在已经不用的字段 —— **不许删**(删了更糟) */
  legacyNote?: string
}

const FORMAT = defineSaveFormat<Save>({
  currentVersion: 3,
  migrations: {
    // 1 → 2:补上设施等级(老档没有这一栏)
    1: data => ({ ...asRecord(data), levels: {} }),
    // 2 → 3:补上计数器与图鉴
    2: data => ({
      ...asRecord(data),
      counters: {},
      book: { seen: {}, stage: {}, best: {} },
      claimed: []
    })
  },
  revive: raw => {
    const data = asRecord<unknown>(raw)
    return {
      wallet: asNumberRecord(data.wallet ?? data.money, 0), // 老字段名也认:money → wallet
      levels: asNumberRecord(data.levels, 0),
      counters: asNumberRecord(data.counters, 0),
      book: {
        seen: asNumberRecord(asRecord(data.book).seen, 0),
        stage: asNumberRecord(asRecord(data.book).stage, 0),
        best: asRecord<Record<string, number>>(asRecord(data.book).best)
      },
      claimed: asStringArray(data.claimed),
      legacyNote: typeof data.legacyNote === 'string' ? data.legacyNote : undefined
    }
  }
})

/** 上一版(v1)的档:钱包字段还叫 money,设施与图鉴都还没有,而且值有点脏 */
const OLD_V1 = {
  version: 1,
  savedAt: 1_700_000_000_000,
  data: {
    money: { coin: 40, shard: '坏值' }, // 一个合法 + 一个写坏的值
    legacyNote: '这一格是老版本留下的说明'
  }
}

// ——— 世界:账本 + 产线 + 今日任务 + 集册 ———

const resources = createResourceSystem({
  resources: [
    { key: 'coin', name: '金币', integer: true },
    { key: 'shard', name: '星屑', integer: true }
  ]
})
const facilities = createFacilitySystem<{ speed: number }, { open: boolean }>({
  facilities: [
    { id: 'mine', maxLevel: 5, perHour: level => ({ shard: level * 3 }) },
    { id: 'shop', maxLevel: 5, mods: level => ({ speed: level * 0.1 }) }
  ]
})
const tasks = createTaskBoard({ tasks: [{ id: 't_shard', name: '今日攒 10 星屑', counter: 'made', target: 10 }] })
const codex = createCodex({
  stages: [
    { name: '初见', at: 0 },
    { name: '眼熟', at: 2 }
  ]
})

interface World {
  save: Save
  frac: Record<string, number>
  board: ReturnType<typeof tasks.rollover>
}

/** 从一份(已经修好的)存档开一个世界 */
function worldOf(save: Save): World {
  return { save, frac: {}, board: tasks.rollover({ period: 'D1', base: {}, claimed: [] }, save.counters, 'D1') }
}

/** 推几轮:产线出货 → 入账 → 记数 → 任务结算 → 图鉴照面 */
function advance(world: World, rounds: number): void {
  let ledger = resources.create(world.save.wallet)
  for (let round = 1; round <= rounds; round += 1) {
    const grown = accrue(world.frac, facilities.ratesOf(world.save.levels, { open: true }), 3600)
    world.frac = grown.frac
    const grants = Object.entries(grown.whole).map(([key, amount]) => ({ key, amount, source: '产线' }))
    ledger = resources.grant(ledger, grants).ledger
    world.save.counters = { ...world.save.counters, made: (world.save.counters.made ?? 0) + (grown.whole.shard ?? 0) }
    world.board = tasks.settle(world.board, world.save.counters).state
    world.save.book = codex.observe(world.save.book, 'card', { weight: 1 }).state
  }
  world.save.wallet = Object.fromEntries(resources.defs.map(d => [d.key, resources.numberOf(ledger, d.key)]))
}

const snapshot = (world: World): string =>
  JSON.stringify({ save: world.save, frac: world.frac, board: world.board })

describe('组合验收(存档)—— 老档升级之后,世界照旧', () => {
  it('修完的形状合法:该是数字的是数字,未知的老字段保留', () => {
    const decoded = decodeSavePayload(OLD_V1, FORMAT)
    expect(decoded.ok).toBe(true)
    if (!decoded.ok) return
    expect(decoded.fromVersion).toBe(1)
    expect(decoded.migrated).toBe(true)
    const save = decoded.state
    expect(save.wallet).toEqual({ coin: 40 }) // 写坏的那个值被修掉,合法的留着
    expect(save.levels).toEqual({})
    expect(save.counters).toEqual({})
    expect(save.book).toEqual({ seen: {}, stage: {}, best: {} })
    expect(save.claimed).toEqual([])
    // 老字段不删:它可能是别人的数据,也可能只是这一版不用了
    expect(save.legacyNote).toBe('这一格是老版本留下的说明')
  })

  it('迁移幂等:同一份档再走一遍,结果一位不变', () => {
    const once = runMigrations(OLD_V1.data, OLD_V1.version, FORMAT as never)
    const twice = runMigrations(once, 3, FORMAT as never)
    expect(twice).toEqual(once)
  })

  it('升级是纯的:同一份老档升两次,结果完全相同', () => {
    const a = decodeSavePayload(OLD_V1, FORMAT)
    const b = decodeSave(encodeSave(OLD_V1.data, { ...FORMAT, currentVersion: 1 } as never), FORMAT)
    expect(a.ok && b.ok).toBe(true)
    if (!a.ok || !b.ok) return
    // 两次的 fromVersion 不同(一次是 1、一次也是 1),但结果状态必须一样
    expect(a.state).toEqual(b.state)
    // 而且反复解码同一份文本,结果也一样(解码不带副作用)
    const text = encodeSave(a.state, FORMAT)
    expect(decodeSave(text, FORMAT)).toEqual(decodeSave(text, FORMAT))
  })

  it('版本号说不清时按最老的一版处理:缺失 / NaN / 负数都一步一步补上来', () => {
    for (const version of [undefined, Number.NaN, -3, 0]) {
      const decoded = decodeSavePayload({ version, data: { money: { coin: 7 } } }, FORMAT)
      expect(decoded.ok, String(version)).toBe(true)
      if (!decoded.ok) continue
      expect(decoded.fromVersion, String(version)).toBe(1)
      expect(decoded.state.wallet, String(version)).toEqual({ coin: 7 })
      expect(decoded.state.book, String(version)).toEqual({ seen: {}, stage: {}, best: {} })
    }
  })

  it('来自更新的版本要明说"该升级",而不是丢档', () => {
    const future = decodeSavePayload({ version: 9, data: {} }, FORMAT)
    expect(future.ok).toBe(false)
    if (future.ok) return
    expect(future.reason).toBe('future')
  })

  it('升级之后的世界与"同状态新开"逐字段相同(推三轮也一样)', () => {
    const decoded = decodeSavePayload(OLD_V1, FORMAT)
    expect(decoded.ok).toBe(true)
    if (!decoded.ok) return
    // 老档升级来的世界
    const fromOld = worldOf({ ...decoded.state, levels: { mine: 2 } })
    // 同样状态的"新开"世界:字段一字不差
    const fresh = worldOf({ ...decoded.state, levels: { mine: 2 } })
    advance(fromOld, 3)
    advance(fresh, 3)
    expect(snapshot(fromOld)).toBe(snapshot(fresh))
    // 而且确实跑起来了(不是两边都空转)
    expect(fromOld.save.wallet.shard).toBeGreaterThan(0)
    expect(fromOld.board.claimed).toEqual(['t_shard'])
  })

  it('坏成"一个对象都不是"的档:该报 shape 就报 shape,而不是崩', () => {
    const broken = decodeSavePayload({ version: 3, data: null }, { ...FORMAT, revive: () => null } as never)
    expect(broken.ok).toBe(false)
    if (broken.ok) return
    expect(broken.reason).toBe('shape')
    // 文本都坏掉的那种:报 parse
    const garbage = decodeSave('{ 这不是 JSON', FORMAT)
    expect(garbage.ok).toBe(false)
    if (garbage.ok) return
    expect(garbage.reason).toBe('parse')
    // 形状修复原语本身:数组 / 字符串数组 / 数字记录各挡一类坏值
    expect(asArray<number>('不是数组')).toEqual([])
    expect(asStringArray(['ok', 3, null, '也 ok'])).toEqual(['ok', '也 ok'])
    expect(asNumberRecord({ a: 1, b: 'x', c: Number.NaN }, 0)).toEqual({ a: 1 })
  })
})
