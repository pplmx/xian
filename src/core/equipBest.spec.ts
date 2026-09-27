/**
 * 一键换装 / 一键穿齐套装 —— 自 yunyin-xiuxian 吸收(玩家反馈驱动)。
 *
 * 吸收时的评审把「最强」定作品质→层级→强化→词条粗排;yunyin 随后收到玩家新反馈
 * 「一键装备没有将最强的装备装上」,已把主判换成**真实战斗价值**(equippablePower),
 * 本作跟进同一升级:
 *   · 「最强」= 平铺(层级曲线 × 品质^1.8 × 强化加成,血按 1/6 折算)+ 词条战力
 *     (权重与战力面板同一张 POWER_STAT_WEIGHTS,会心按会心×会心伤联乘);
 *   · 粗排 betterEquip 降级为「同战力」的稳定裁决,不再当主判;
 *   · 成长类词条(修速等)不进战力,一键不为了修速换装。
 *
 * 不变的旧三条:只改装配零损耗、穿套绝不降级、幂等可反复点。
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useInventoryStore } from '@/stores/inventory'
import { equipAllBest, equipBestFor, bestEquipFor, betterEquip, equipSetCombo, equippablePower } from './equipBest'
import { resolveEquipStats } from './equipGen'
import { equipmentTemplate } from '@/data/equipment'
import type { EquipmentInstance, EquipSlot, QualityId } from '@/types'

const TPL: Record<EquipSlot, string> = {
  weapon: 'w_hanfeng',
  head: 'h_xuantie',
  body: 'b_qingyun',
  necklace: 'n_lingyu',
  wrist: 'wr_shuangwen',
  belt: 'bl_youtan',
  boots: 'bo_kuaixue',
  ring: 'r_xuanguang',
  talisman: 'tl_ningshuang',
  artifact: 'af_muyu' // 一键换装不碰法宝,此键只为吃满 Record<EquipSlot>
}

let seq = 0
/** 词条用真实 id + roll(0~1):真实战力要吃引擎解析,假 id 会被整条忽略 */
function item(slot: EquipSlot, quality: QualityId, tier: number, level = 0, affixes: { id: string; roll: number }[] = []): EquipmentInstance {
  seq += 1
  return { uid: `eq-${seq}`, templateId: TPL[slot]!, quality, tier, level, affixes }
}

function add(inv: ReturnType<typeof useInventoryStore>, ...items: EquipmentInstance[]): void {
  inv.items = [...inv.items, ...items]
}

function slotOf(itemInst: EquipmentInstance): EquipSlot {
  return equipmentTemplate(itemInst.templateId)!.slot
}

describe('equippablePower —— 真实战斗价值', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('平铺随强化放大:同件装备强化 10 胜过高 1 阶的裸件', () => {
    const fresh = item('weapon', 'heaven', 18)
    const leveled = { ...item('weapon', 'heaven', 17), level: 10 }
    expect(betterEquip(fresh, leveled), '粗排仍按阶高取胜 —— 这正是玩家说没装上最强的那把尺').toBe(true)
    expect(equippablePower(leveled), '强化 10 的平铺压过高一阶的裸件').toBeGreaterThan(equippablePower(fresh))
  })

  it('词条按战力权重计入且单调:同帧一条攻击% 的 roll 越高战力越高', () => {
    const low = item('weapon', 'heaven', 17, 0, [{ id: 'atk1', roll: 0.1 }])
    const high = { ...item('weapon', 'heaven', 17, 0, [{ id: 'atk1', roll: 0.9 }]) }
    expect(equippablePower(high)).toBeGreaterThan(equippablePower(low))
  })

  it('会心按「会心 ×(1+会心伤)」联乘:暴伤单上不改战力,会心与会心伤同出才放大', () => {
    const bare = item('weapon', 'heaven', 17)
    const crit = item('weapon', 'heaven', 17, 0, [{ id: 'crit1', roll: 0.5 }])
    const critDmg = item('weapon', 'heaven', 17, 0, [{ id: 'cdmg1', roll: 0.5 }])
    const both = item('weapon', 'heaven', 17, 0, [
      { id: 'crit1', roll: 0.5 },
      { id: 'cdmg1', roll: 0.5 }
    ])
    expect(equippablePower(critDmg) - equippablePower(bare)).toBeCloseTo(0, 9)
    expect(equippablePower(crit) - equippablePower(bare)).toBeGreaterThan(0)
    // 联乘:双上比只上会心,增量 = 会心 × 暴伤
    expect(equippablePower(both) - equippablePower(crit)).toBeGreaterThan(0)
    expect(equippablePower(both)).toBeGreaterThan(equippablePower(critDmg))
  })

  it('条件伤害词条也进战力:背水一击(残血增伤)的件比裸件强,不再记 0', () => {
    const bare = item('weapon', 'heaven', 17)
    const withCond = item('weapon', 'heaven', 17, 0, [{ id: 'bs1', roll: 0.9 }])
    expect(resolveEquipStats(withCond).mods.lowHpDamage ?? 0).toBeGreaterThan(0)
    expect(equippablePower(withCond)).toBeGreaterThan(equippablePower(bare))
  })

  it('成长类词条不进战力:带了修速,战力纹丝不动(一键不为了修速换装)', () => {
    const bare = item('weapon', 'heaven', 17)
    const withGrowth = item('weapon', 'heaven', 17, 0, [{ id: 'cult1', roll: 0.9 }])
    expect(resolveEquipStats(withGrowth).mods.cultivationSpeed ?? 0).toBeGreaterThan(0)
    expect(equippablePower(withGrowth) - equippablePower(bare)).toBeCloseTo(0, 9)
  })
})

describe('一键换装 · 「最强」按真实战力', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('同品质:强化满的一件压过高 1 阶的裸件(旧粗排会选错)', () => {
    const inv = useInventoryStore()
    const fresh = item('weapon', 'heaven', 18) // 天品 18 阶,0 强化
    const leveled = item('weapon', 'heaven', 17, 10) // 天品 17 阶,强化 10
    add(inv, fresh, leveled)
    expect(equippablePower(leveled)).toBeGreaterThan(equippablePower(fresh))
    expect(bestEquipFor('weapon')!.uid, '该穿强化满的那件').toBe(leveled.uid)
  })

  it('跨品质跨阶:高阶玄品满强化胜过低阶地品裸件(玩家反馈的主诉场景)', () => {
    const inv = useInventoryStore()
    const earned = item('weapon', 'profound', 20, 10) // 玄品 20 阶,强化满
    const polished = item('weapon', 'earth', 14) // 地品 14 阶,高一档品质
    add(inv, earned, polished)
    expect(slotOf(earned)).toBe('weapon')
    expect(equippablePower(earned)).toBeGreaterThan(equippablePower(polished))
    expect(bestEquipFor('weapon')!.uid, '玄品满强化是实打打来的战利').toBe(earned.uid)
  })

  it('空槽:把行囊里真实战力更强的一件换上', () => {
    const inv = useInventoryStore()
    const step = item('head', 'fine', 9)
    const better = item('head', 'excellent', 6)
    add(inv, step, better)
    expect(equipBestFor('head'), '空槽应当上一件').toBe(true)
    const picked = inv.items.find(i => i.uid === inv.equipped['head'])!
    const other = picked === better ? step : better
    // 真实战力为准:穿上去的那件就是更强的(不奉行「品质保底」)
    expect(equippablePower(picked)).toBeGreaterThanOrEqual(equippablePower(other))
  })

  it('已是最强则不动(幂等)', () => {
    const inv = useInventoryStore()
    const best = item('body', 'immortal', 20, 5)
    add(inv, best)
    inv.equip(best.uid, 'body')
    expect(equipBestFor('body'), '本就是最强,不该来回换').toBe(false)
  })

  it('已穿的更强就不换(真实战力口径)', () => {
    const inv = useInventoryStore()
    const worn = item('necklace', 'heaven', 12, 5)
    const weaker = item('necklace', 'heaven', 11) // 同品低一阶、无强化、无词条 —— 三围处处更差
    add(inv, worn, weaker)
    inv.equip(worn.uid, 'necklace')
    expect(equippablePower(weaker)).toBeLessThan(equippablePower(worn))
    expect(equipBestFor('necklace'), '已穿更强的,不该被更弱件换下').toBe(false)
    expect(inv.equipped['necklace']).toBe(worn.uid)
  })

  it('词条能翻转近平铺的胜负:同品同阶同强化,词条好的那件胜出(词条不是噪声)', () => {
    const inv = useInventoryStore()
    const weak = item('weapon', 'heaven', 16, 0, [{ id: 'atk1', roll: 0.1 }])
    const strong = item('weapon', 'heaven', 16, 0, [{ id: 'atk1', roll: 0.9 }])
    add(inv, weak, strong)
    expect(equippablePower(strong)).toBeGreaterThan(equippablePower(weak))
    expect(bestEquipFor('weapon')!.uid, '词条在排序里要真的能赢').toBe(strong.uid)
  })

  it('词条只在同阶/邻阶翻转 —— 整体层级差距面前,平铺仍然主导', () => {
    const inv = useInventoryStore()
    const low = item('weapon', 'heaven', 14, 0, [{ id: 'atk1', roll: 0.9 }]) // 满攻击成色
    const high = item('weapon', 'heaven', 17) // 高三阶裸件
    add(inv, low, high)
    expect(equippablePower(low)).toBeLessThan(equippablePower(high))
    expect(bestEquipFor('weapon')!.uid, '层级差不该被一条好词条吞掉').toBe(high.uid)
  })

  it('一键全槽:每槽换上最强,返回换了几件', () => {
    const inv = useInventoryStore()
    add(inv, item('head', 'fine', 6), item('body', 'excellent', 8), item('necklace', 'mortal', 3), item('weapon', 'spirit', 10))
    const changed = equipAllBest()
    expect(changed).toBe(4)
    for (const slot of ['head', 'body', 'necklace', 'weapon'] as EquipSlot[]) {
      expect(inv.equipped[slot], `${slot} 槽应已穿上`).toBeTruthy()
    }
  })
})

describe('betterEquip —— 仍是同战力的粗排裁决', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('品质 → 层级 → 强化 → 词条成色', () => {
    const a = item('weapon', 'heaven', 3) // 天品 3 阶
    const b = item('weapon', 'spirit', 8) // 灵品 8 阶
    expect(betterEquip(a, b), '天品压过灵品,不以阶数论').toBe(true)
    expect(betterEquip(b, a)).toBe(false)
    const c = item('weapon', 'heaven', 4)
    expect(betterEquip(c, a)).toBe(true)
    const d = { ...item('weapon', 'heaven', 4), level: 3 }
    expect(betterEquip(d, c)).toBe(true)
    const e = { ...c, affixes: [{ id: 'atk1', roll: 0.9 }] }
    expect(betterEquip(e, c)).toBe(true)
  })
})

/**
 * 一键穿齐共鸣套:各槽换上该套已持有里的最强,已穿更强的那件不动。
 * 铁壁套 s_tiebi = 玄铁重剑(weapon)+ 玄铁冠(head)。
 */
describe('一键穿齐套装', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('空槽换上套装里更强的一件,已穿更强的非套件不动', () => {
    const inv = useInventoryStore()
    const pieces: EquipmentInstance[] = [
      { uid: 'sa', templateId: 'w_xuantie', quality: 'fine', tier: 2, level: 0, affixes: [] },
      { uid: 'sb', templateId: 'w_xuantie', quality: 'heaven', tier: 4, level: 0, affixes: [] },
      { uid: 'sc', templateId: 'h_xuantie', quality: 'excellent', tier: 4, level: 0, affixes: [] },
      { uid: 'sd', templateId: 'h_xuantie', quality: 'divine', tier: 5, level: 0, affixes: [] }
    ]
    inv.items = pieces
    inv.equip('sd', 'head')
    const changed = equipSetCombo('s_tiebi')
    expect(changed, '只该换武器槽').toBe(1)
    expect(inv.equipped['weapon'], '换上天品重剑').toBe('sb')
    expect(inv.equipped['head'], '已穿更强 divine 不该被降级').toBe('sd')
  })

  it('已穿齐:再点一次不动(幂等)', () => {
    const inv = useInventoryStore()
    const a: EquipmentInstance = { uid: 'sa', templateId: 'w_xuantie', quality: 'heaven', tier: 4, level: 0, affixes: [] }
    const b: EquipmentInstance = { uid: 'sc', templateId: 'h_xuantie', quality: 'heaven', tier: 4, level: 0, affixes: [] }
    inv.items = [a, b]
    inv.equip(a.uid, 'weapon')
    inv.equip(b.uid, 'head')
    expect(equipSetCombo('s_tiebi'), '已穿齐,不应再动').toBe(0)
  })
})
