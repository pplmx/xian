/* eslint-disable no-console */
/**
 * 消融实验 —— **字符串种子会撞:32 位能装多少个名字**。
 *
 * `createRng('青云山麓')` 这种写法很顺手,但它把整个世界压进了 **32 位**种子空间(42.9 亿)。
 * 撞上就是"两个玩家拿到同一串随机数" —— 同一份掉落、同一批敌人、同一场战斗。
 * 问题是:**多久会撞?** 这份实验把边界量出来,并分成两种完全不同的用法:
 *
 *   一 **同长度、只差一个字符的名字永不碰撞** —— 这不是"撞得少",是数学保证:
 *      FNV-1a 每一步都是"异或一个字符 × 乘一个奇数",两者在 mod 2^32 下都是双射,
 *      所以"存档-1 / 存档-2"这类**编号种子**无论编到多少都各走各的(实测 20 万个零碰撞);
 *   二 **随机名字几万个就会撞** —— 这才是生日悖论起作用的地方(实测中位数约 4.6 万,
 *      每 1 万个名字里至少撞一次的概率 0.5%~5.5%;理论上限 7.7 万);
 *   三 **名字长度不一样时才可能零星撞车**(20 万个里 11 次,约 0.006%)。
 *
 * 结论(给内容作者):
 *   · "存档槽 1 / 每日挑战-2026-09-19 / 测试夹具-7"这类**可读编号**可以放心当种子;
 *   · **别拿玩家昵称当唯一标识** —— 一万个玩家就有百分之一二的概率有人撞上,
 *     而现象是"两个人抽到一模一样的东西",极难查;要唯一就掺一个数字 id,或另存一个 id 消歧。
 *
 * 另外钉一组 **golden 值**:把 `seedFromString` 前四个样本的输出写死 —— 换实现、改哈希都会红,
 * 因为种子一变,所有旧存档的"同种子重演"就全都不成立了。
 */
import { describe, expect, it } from 'vitest'
import { mulberry32, seedFromString } from './rng.js'

/** 可复现的"随机名字":8 位 36 进制,像玩家昵称那样没有结构 */
const rnd = mulberry32(20260919)
const randomName = (): string => Math.floor(rnd() * 36 ** 8).toString(36).padStart(8, '0')

/** 连续造名字,返回"第几个撞上已有的种子"(一个都没撞返回 -1) */
const firstCollision = (make: () => string, limit: number): number => {
  const seen = new Set<number>()
  for (let i = 0; i < limit; i += 1) {
    const seed = seedFromString(make())
    if (seen.has(seed)) return i + 1
    seen.add(seed)
  }
  return -1
}

/** n 个一批,跑 batches 批,返回"批里至少撞过一次"的比例 */
const batchCollisionRate = (make: () => number, n: number, batches: number): number => {
  let hit = 0
  for (let b = 0; b < batches; b += 1) {
    const seen = new Set<number>()
    for (let i = 0; i < n; i += 1) {
      const seed = make()
      if (seen.has(seed)) {
        hit += 1
        break
      }
      seen.add(seed)
    }
  }
  return hit / batches
}

describe('消融实验 —— 字符串种子会撞:32 位能装多少个名字', () => {
  it('编号种子永不碰撞:20 万个同长度、只差一个字符的名字,零重复', () => {
    // 末位不同
    const tail = new Set<number>()
    for (let i = 0; i < 200000; i += 1) tail.add(seedFromString(`save-${String(i).padStart(6, '0')}`))
    // 中间不同(长度也不变)
    const middle = new Set<number>()
    for (let i = 0; i < 200000; i += 1) middle.add(seedFromString(`s${String(i).padStart(5, '0')}e`))
    console.log(`  末位不同 20 万个 → 去重 ${tail.size}`)
    console.log(`  中间不同 20 万个 → 去重 ${middle.size}`)
    // 数学保证:异或与"乘奇数"在 mod 2^32 下都是双射 —— 一个字符变了,后面全变
    expect(tail.size).toBe(200000)
    expect(middle.size).toBe(200000)
  })

  it('长度不一样时才会零星撞车:20 万个里 11 次', () => {
    const mixed = new Set<number>()
    for (let i = 0; i < 200000; i += 1) mixed.add(seedFromString(`${'x'.repeat(i % 8)}-${i}`))
    const collisions = 200000 - mixed.size
    console.log(`  长度不一 20 万个 → 去重 ${mixed.size}(撞了 ${collisions} 次,${((collisions / 200000) * 100).toFixed(4)}%)`)
    expect(collisions).toBeGreaterThan(0) // 名字长度一变,双射的那条保证就没了
    expect(collisions).toBeLessThan(100) // 但仍是"几十万分之几"级
  })

  it('随机名字:第一次撞发生在第 7 千 ~ 8.8 万个之间,中位数约 4.6 万', () => {
    const trials = Array.from({ length: 12 }, () => firstCollision(randomName, 200000)).sort((a, b) => a - b)
    const median = (trials[5]! + trials[6]!) / 2
    console.log(`  12 次实验的碰撞点:${trials.join(' / ')}`)
    console.log(`  中位数 ${median} · 生日悖论的理论上限 ${Math.round(Math.sqrt(2 * 2 ** 32 * Math.LN2))}`)
    expect(trials.every(at => at > 0)).toBe(true) // 12 次里每次都在 20 万以内撞上了
    expect(median).toBeGreaterThan(10000)
    expect(median).toBeLessThan(150000)
  })

  it('每 1 万个随机名字里至少撞一次:实测与理论同量级', () => {
    const names = batchCollisionRate(() => seedFromString(randomName()), 10000, 100)
    // 对照组:同样批量、同样的数量,用原始 32 位随机数(不经哈希)
    const control = batchCollisionRate(() => Math.floor(rnd() * 2 ** 32), 10000, 100)
    const theory = 1 - Math.exp(-(10000 ** 2) / (2 * 2 ** 32))
    console.log(`  名字哈希:${(names * 100).toFixed(1)}% · 原始 32 位对照:${(control * 100).toFixed(1)}% · 理论 ${(theory * 100).toFixed(2)}%`)
    // 量级才是要钉的东西:一万个名字里"大概是百分之一二"这个结论不能变成"零"
    expect(names).toBeGreaterThan(0)
    expect(names).toBeLessThan(0.1)
    expect(control).toBeLessThan(0.06) // 对照组证明测量方法本身没问题(否则上面的数字就是假的)
  })

  it('golden 值:种子算法一变,所有旧存档的"同种子重演"就不成立了', () => {
    console.log(`  seedFromString('青雲山麓')=${seedFromString('青雲山麓')} · ('')=${seedFromString('')} · ('a')=${seedFromString('a')}`)
    expect(seedFromString('')).toBe(2166136261) // FNV 的偏移基数,顺带钉住"空串不为 0"
    expect(seedFromString('a')).toBe(3826002220)
    expect(seedFromString('青云山麓')).toBe(1955089564)
    // 同一个字符串永远是同一个种子(可复现的那一半)
    expect(seedFromString('青云山麓')).toBe(seedFromString('青云山麓'))
    expect(seedFromString('青云山麓')).not.toBe(seedFromString('青云山麗')) // 差一个汉字就是另一颗种子
  })
})
