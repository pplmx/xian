/**
 * 宿命传承(ISS-302)—— 机制回归。
 *
 * 覆盖设计文档的测试清单:
 *   ① 门槛        gateMajor<=major 才候选;浅修(major<2)永不返回
 *   ② 一世一悟      同世多门槛只锻造最高那一个
 *   ③ 浅修农场反例   永远锻造不出超过循环最高境界的传承
 *   ④ 跨世持久      入 reincarnation.heritage,rebirth 不清空
 *   ⑤ 非倍率红线    任何传承的文案/机制描述不得含攻防/修速/倍率等词
 *   ⑥ 遗产覆盖度量  samsaraAudit 的 HERITAGE 已登记 heritage 一行(kind='legacy')
 *   ⑦ 经济不变量    forge 判定是纯计算:不写任何资源流,economySim 不因传承增减
 */
import { describe, expect, it, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import {
  HERITAGE_DEFS,
  heritageDef
} from '@/data/heritage'
import { forgeCandidate, lifeForge, ownedHeritage } from './heritageForge'
import { HERITAGE } from './samsaraAudit'
import { usePlayerStore } from '@/stores/player'
import { useResourcesStore } from '@/stores/resources'

/**
 * 非倍率红线的禁词(仅测试期生效的静态守卫,故住在 spec 而非运行时数据里):
 * 任何传承的文案/机制描述出现这些,即被当作"折成了量"而判负 ——
 * 一旦可折算成攻防/修速/战力倍率,就塌回 deepCultivationRoi 实测的 267 倍补偿陷阱。
 */
const HERITAGE_FORBIDDEN_TOKENS = [
  '攻', '攻速', '防御', '修速', '修炼速度', '倍率', '战力', '伤害',
  '暴击', '百分比', '气血加成', '加成', '+', '%'
] as const

describe('宿命传承(ISS-302)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('①门槛:forgeCandidate 只返回 gateMajor<=major 的未锻造传承;浅修(major<2)永不返回', () => {
    expect(forgeCandidate(0)).toEqual([])
    expect(forgeCandidate(1)).toEqual([])
    const at2 = forgeCandidate(2)
    expect(at2.length).toBeGreaterThan(0)
    for (const d of at2) expect(d.gateMajor).toBeLessThanOrEqual(2)
    // 已锻造后被排除
    usePlayerStore().addHeritage(at2[0]!.id)
    const after = forgeCandidate(2)
    expect(after.some(d => d.id === at2[0]!.id)).toBe(false)
  })

  it('②一世一悟:同世到达多个未锻造门槛,只锻造最高那一个', () => {
    // major 6 时,gateMajor 2..6 全部未锻造 → lifeForge 取最深(6)
    const forger = lifeForge(6)
    expect(forger).not.toBeNull()
    expect(forger!.gateMajor).toBe(6)
    // 已锻造后,下一世只能往更深的门槛走
    usePlayerStore().addHeritage(forger!.id)
    const next = lifeForge(9)
    expect(next!.gateMajor).toBeGreaterThan(6)
  })

  it('③浅修农场反例:循环永远锻造不出超过其最高境界的传承', () => {
    // 模拟浅修:每世只停到元婴(major 3)以内,循环 20 次
    const shallowCeiling = 3
    for (let i = 0; i < 20; i += 1) {
      const d = lifeForge(shallowCeiling)
      if (d) usePlayerStore().addHeritage(d.id)
    }
    // 浅修只能拿到 gateMajor<=3 的最低那一个,拿不到 4 及以上
    for (const id of ownedHeritage()) {
      expect(heritageDef(id)!.gateMajor).toBeLessThanOrEqual(shallowCeiling)
    }
    // 纯金丹农场(major 2,从不越界)永远锻造不出 danxin 以外的传承
    setActivePinia(createPinia())
    const goldenFarmer: string[] = []
    usePlayerStore().addHeritage('danxin')
    for (let i = 0; i < 50; i += 1) {
      const d = lifeForge(2)
      if (d && !goldenFarmer.includes(d.id)) goldenFarmer.push(d.id)
    }
    expect(goldenFarmer).toEqual([]) // danxin 已锻造后,金丹农场再无可锻造项
  })

  it('④跨世持久:锻造后 rebirth 不清空 heritage', () => {
    const player = usePlayerStore()
    player.addHeritage('danxin')
    player.addDaoFruit(10)
    // rebirth 只加转世计数,不清 reincarnation 的永久字段
    player.rebirth(player.linggen!)
    expect(player.reincarnation.heritage).toContain('danxin')
    expect(player.reincarnation.count).toBe(1)
  })

  it('⑤非倍率红线:任何传承的文案/机制描述不得含攻防/修速/倍率等词', () => {
    expect(HERITAGE_DEFS.length).toBeGreaterThanOrEqual(8)
    for (const d of HERITAGE_DEFS) {
      expect(d.effect, `${d.id} 必须是 bounded-flat 平直能力位`).toBe('bounded-flat')
      const blob = `${d.name}${d.desc}${d.effectDesc}`
      for (const tok of HERITAGE_FORBIDDEN_TOKENS) {
        expect(blob.indexOf(tok), `${d.id} 描述含禁词「${tok}」—— 把能力位做成了倍率`).toBe(-1)
      }
    }
  })

  it('⑥遗产覆盖度量:samsaraAudit 的 HERITAGE 已登记 heritage 一行(kind=legacy)', () => {
    const row = HERITAGE.find(r => r.id === 'heritage')
    expect(row, 'samsaraAudit 未登记 heritage 的跨世去留').toBeDefined()
    expect(row!.kind).toBe('legacy')
    expect(row!.mode).toBe('full')
  })

  it('⑦经济不变量:forge 判定是纯计算,不写任何资源流', () => {
    const resources = useResourcesStore()
    resources.addSmall('herb', 1000)
    resources.addStone({ m: 5, e: 0 })
    const beforeStone = { m: resources.spiritStone.m, e: resources.spiritStone.e }
    const beforeHerb = resources.herb
    forgeCandidate(9)
    lifeForge(9)
    expect({ m: resources.spiritStone.m, e: resources.spiritStone.e }).toEqual(beforeStone)
    expect(resources.herb).toBe(beforeHerb)
  })
})
