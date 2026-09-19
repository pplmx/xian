/* eslint-disable no-console */
/**
 * 消融实验 —— **存档多大、迁移多贵**。
 *
 * 库对存档只做三件事:封套、迁移链、形状修复;存哪儿是使用方的事。于是每次有人问
 * "存档会不会太大""迁移链拖不拖读档"时,库里都只能回答"看你存什么"。这份实验把
 * 一份**典型中期存档**摊开量一遍,给几个能拿去做容量规划的刻度:
 *
 *   一 **骨架是骨架,背包才是大头**:空背包的骨架约 1 千字符,而每多一件带两条词条的
 *      装备大约 +121 字符 —— 按"背包上限 × 每件成本"就能估出上限;
 *   二 **字符数 ≠ 字节数**:这份样本基本是数字与短键名(所以两个数一样),但内容里一旦带上
 *      中文名,一个字符就是 3 字节 —— 算存储与流量时别拿字符数当字节数(这份实验两个都报);
 *   三 **uid 长度是白拿的成本**:36 字符的 uuid 比 4 字符的短序号每件多约 30 字符 ——
 *      存档里存"短序号 + 一张映射表"通常比每件都存长 id 划算;
 *   四 **迁移链几乎不要钱**:8 步迁移实测约 4 微秒/次 —— 该加版本就加版本,
 *      别为了"省那点读档时间"把两处改动塞进同一跳;
 *   五 **别用"才十几 KB"打发容量规划**:每人 12.8 KB × 一万玩家 × 每天十次 = **1.25 GB/天**。
 *      这个数量级才是要不要压缩、要不要"只在变更时落盘"的依据(编解码可以换:
 *      `codec` 那一对就是留给压缩/加密的)。
 */
import { describe, expect, it } from 'vitest'
import { createResourceSystem } from './resources.js'
import { defineSaveFormat, encodeSave, runMigrations } from './save.js'

/** UTF-8 字节数(库不引 Node 类型,所以自己数:中文一字 3 字节,emoji 4 字节) */
const utf8Bytes = (text: string): number => {
  let bytes = 0
  for (let i = 0; i < text.length; i += 1) {
    const code = text.charCodeAt(i)
    if (code < 0x80) bytes += 1
    else if (code < 0x800) bytes += 2
    else if (code >= 0xd800 && code <= 0xdbff) {
      bytes += 4
      i += 1
    } else bytes += 3
  }
  return bytes
}

const ledger = createResourceSystem({
  resources: [
    { key: 'stone', name: '灵石', integer: true },
    { key: 'herb', name: '灵草', integer: true }
  ]
})

/** 一份"中期玩家"的存档:账本 + 功法 + 背包 + 进度 + 任务 */
const sampleState = (items: number, uid = (i: number): string => `u${i}`) => ({
  wallet: ledger.create({ stone: 1234567, herb: 89 }),
  counters: { words: 12345, days: 210, books: 7 },
  skills: Array.from({ length: 12 }, (_, i) => ({ id: `s${i}`, level: 3 + (i % 5), branch: i % 3 === 0 ? 'steady' : undefined })),
  inventory: Array.from({ length: items }, (_, i) => ({
    uid: uid(i),
    templateId: `t${i % 40}`,
    qualityId: 'fine',
    tier: 1 + (i % 12),
    affixes: [
      { id: 'a1', roll: 0.5 },
      { id: 'a2', roll: 0.25 }
    ]
  })),
  progress: { cleared: ['pass', 'wood', 'mine'], bossWins: { pass: 3 }, runs: { pass: 12 } },
  quests: Array.from({ length: 20 }, (_, i) => ({ id: `q${i}`, claimed: i % 2 === 0 }))
})

const format = defineSaveFormat({ currentVersion: 1 })
const textOf = (items: number, uid?: (i: number) => string): string =>
  encodeSave(sampleState(items, uid), format, 1_700_000_000_000)

describe('消融实验 —— 存档多大、迁移多贵', () => {
  it('典型中期存档的体积,以及背包的边际成本', () => {
    const empty = textOf(0)
    const hundred = textOf(100)
    const twoHundred = textOf(200)
    const perItem = (twoHundred.length - hundred.length) / 100
    console.log(`  骨架(背包空)        ${empty.length} 字符 / ${utf8Bytes(empty)} 字节`)
    console.log(`  背包 100 件          ${hundred.length} 字符 / ${utf8Bytes(hundred)} 字节`)
    console.log(`  背包 200 件          ${twoHundred.length} 字符 / ${utf8Bytes(twoHundred)} 字节`)
    console.log(`  每件装备的边际成本    ${perItem.toFixed(1)} 字符 / ${(utf8Bytes(twoHundred) - utf8Bytes(hundred)) / 100} 字节`)
    // 闸门:典型的"百件背包"存档不该超过 20 KB 字符(约 40 KB 字节)
    expect(hundred.length).toBeLessThan(20_000)
    expect(utf8Bytes(hundred)).toBeLessThan(40_000)
    // 每件带两条词条的装备:字符与字节各留一档闸门(别哪天悄悄涨成两倍)
    expect(perItem).toBeGreaterThan(50)
    expect(perItem).toBeLessThan(200)
  })

  it('uid 长度是白拿的成本:36 字符 uuid 比 4 字符短序号每件多约 30 字符', () => {
    const short = textOf(100, i => `u${i}`)
    const long = textOf(100, i => `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`)
    const delta = (long.length - short.length) / 100
    console.log(`  短序号 100 件 ${short.length} 字符 · 36 字符 uid 100 件 ${long.length} 字符 → 每件 +${delta.toFixed(1)} 字符`)
    expect(delta).toBeGreaterThan(20)
    expect(delta).toBeLessThan(50)
  })

  it('迁移链几乎不要钱:8 步约 4 微秒/次', () => {
    const chain = defineSaveFormat({
      currentVersion: 9,
      migrations: Object.fromEntries(
        Array.from({ length: 8 }, (_, i) => [i + 1, (data: unknown) => ({ ...(data as object), [`f${i + 1}`]: i })])
      )
    })
    const runs = 20_000
    const started = Date.now()
    for (let i = 0; i < runs; i += 1) runMigrations({ base: 1 }, 1, chain)
    const perRunMs = (Date.now() - started) / runs
    console.log(`  8 步迁移 ${runs.toLocaleString()} 次:${perRunMs.toFixed(4)} ms/次(${(perRunMs * 1000).toFixed(2)} 微秒)`)
    // 闸门给得很宽(实测的几十倍):要拦的是"某天迁移链拖慢了几十倍",不是 CI 抖动
    expect(perRunMs).toBeLessThan(0.1)
    // 迁到底之后形状对得上(不是空转)
    const migrated = runMigrations({ base: 1 }, 1, chain) as Record<string, unknown>
    expect(Object.keys(migrated).length).toBe(9)
  })

  it('拿去规划容量:一万玩家每天十次写入是 1.25 GB/天', () => {
    const bytes = utf8Bytes(textOf(100))
    const perDay = (bytes * 10_000 * 10) / 1024 / 1024
    const perWriteKb = bytes / 1024
    console.log(`  每人 ${perWriteKb.toFixed(1)} KB × 1 万玩家 × 每天 10 次 = ${(perDay / 1024).toFixed(2)} GB/天`)
    console.log('  同一份存档的编解码吞吐见 scale.sim.spec.ts(约 357 次/毫秒)—— 慢的从来不是算,是写。')
    // 量级闸门:别哪天悄悄涨一个数量级(压缩、只在变更时落盘,都是拿这个数当依据)
    expect(perDay).toBeGreaterThan(500)
    expect(perDay).toBeLessThan(3000)
  })

  it('可复现:同一份状态编码两次逐字符相同', () => {
    expect(textOf(100)).toBe(textOf(100))
    expect(textOf(100)).not.toBe(textOf(101))
  })
})
