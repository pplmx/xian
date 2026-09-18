/**
 * 背包对账 —— 本作的背包口径搬到万象引擎的持有层之后,与**迁移前冻结的旧实现**逐位相等。
 *
 * 与 `engineParity` / `engineResourceParity` 同一条纪律。下面 `ref*` 是从旧
 * `stores/inventory.ts` 原样抄下来的那几行(迁移前的样子),用来当尺子;
 * 新实现走库的 `createHoldingSystem`(见 core/engineHolding)。
 *
 * 一处**有意的收紧**写在最后那条用例里:uid 是身份,重复的件新口径拒收(返回 `duplicate`),
 * 旧口径会照收 —— 而 uid 由生成器产出,重复只可能来自坏数据,故不构成行为变化。
 */
import { describe, expect, it } from 'vitest'
import type { EquipmentInstance, EquipSlot } from '@/types'
import { BAG_CAPACITY } from '@/data/constants'
import { asEquipSlots, asSlotMap, createBag } from './engineHolding'

type Bag = { items: EquipmentInstance[] }
type Slots = Partial<Record<EquipSlot, string>>

const item = (uid: string): EquipmentInstance => ({ uid, templateId: 't', quality: 'mortal', tier: 1, level: 0, affixes: [] })

// —— 迁移前冻结的旧口径(原 stores/inventory.ts 的实现)——
const refBagItems = (items: EquipmentInstance[], equippedUids: Set<string>): EquipmentInstance[] =>
  items.filter(it => !equippedUids.has(it.uid))
const refBagFull = (items: EquipmentInstance[], equippedUids: Set<string>): boolean =>
  refBagItems(items, equippedUids).length >= BAG_CAPACITY
const refAdd = (items: EquipmentInstance[], inst: EquipmentInstance, equippedUids: Set<string>): { ok: boolean; items: EquipmentInstance[] } =>
  refBagFull(items, equippedUids) ? { ok: false, items } : { ok: true, items: [...items, inst] }
const refRemove = (items: EquipmentInstance[], equipped: Slots, uid: string): { items: EquipmentInstance[]; equipped: Slots } => {
  const nextItems = items.filter(it => it.uid !== uid)
  const nextSlots: Slots = { ...equipped }
  for (const slot of Object.keys(nextSlots) as EquipSlot[]) {
    if (nextSlots[slot] === uid) delete nextSlots[slot]
  }
  return { items: nextItems, equipped: nextSlots }
}
const refReplace = (items: EquipmentInstance[], inst: EquipmentInstance): EquipmentInstance[] =>
  items.map(it => (it.uid === inst.uid ? inst : it))

describe('背包对账 —— 容量 / 占位 / 装配联动', () => {
  it('"已装配的不占背包位"与旧口径一致(容量边界逐个试)', () => {
    const bag = createBag(() => new Set(['worn']))
    const full: Bag = { items: [item('worn')] }
    for (let i = 0; i < BAG_CAPACITY; i += 1) full.items.push(item(`bag${i}`))
    const uids = new Set(['worn'])
    expect(bag.isFull(full)).toBe(refBagFull(full.items, uids))
    expect(bag.count(full)).toBe(refBagItems(full.items, uids).length)
    expect(bag.isFull({ items: [item('worn'), item('a')] })).toBe(refBagFull([item('worn'), item('a')], uids))
  })

  it('满了收不进、没满收得进,与旧口径一致(且入参不被就地改)', () => {
    const bag = createBag(() => new Set())
    const near: Bag = { items: Array.from({ length: BAG_CAPACITY - 1 }, (_, i) => item(`b${i}`)) }
    const before = [...near.items]
    const added = bag.add(near, item('new'))
    expect(added.ok).toBe(refAdd(near.items, item('new'), new Set()).ok)
    expect(added.holding.items.length).toBe(refAdd(before, item('new'), new Set()).items.length)
    expect(near.items).toEqual(before) // 原样

    const packed: Bag = { items: Array.from({ length: BAG_CAPACITY }, (_, i) => item(`c${i}`)) }
    const rejected = bag.add(packed, item('overflow'))
    expect(rejected.ok).toBe(false)
    expect(rejected.reason).toBe('full')
    expect(rejected.holding.items.length).toBe(BAG_CAPACITY)
  })

  it('删一件要顺带把所有槽位上的它摘掉,与旧口径一致', () => {
    const bag = createBag(() => new Set())
    const items = [item('a'), item('b'), item('c')]
    const slots: Slots = { weapon: 'a', ring: 'b', talisman: 'a' }
    const ref = refRemove(items, slots, 'a')
    const taken = bag.remove({ items }, 'a')
    const off = bag.unassignUid(asSlotMap(slots), 'a')
    expect(taken.holding.items.map(i => i.uid)).toEqual(ref.items.map(i => i.uid))
    expect(asEquipSlots(off.slots)).toEqual(ref.equipped)
    expect(bag.unassignUid(asSlotMap(slots), '不存在').slots).toBe(asSlotMap(slots)) // 没关系就不动它
  })

  it('替换同 uid 的件(强化 / 重铸走这条),与旧口径一致', () => {
    const bag = createBag(() => new Set())
    const items = [item('a'), item('b')]
    const upgraded = { ...item('b'), level: 3 }
    const ref = refReplace(items, upgraded)
    const replaced = bag.replace({ items }, upgraded)
    expect(replaced.found).toBe(true)
    expect(replaced.holding.items).toEqual(ref)
    expect(bag.replace({ items }, item('zzz')).found).toBe(false)
  })

  it('装配表:装 / 卸与旧口径一致(旧实现是直接改一个对象)', () => {
    const bag = createBag(() => new Set())
    const slots: Slots = { weapon: 'a' }
    const equipped = asEquipSlots(bag.assign(asSlotMap(slots), 'ring', 'b'))
    expect(equipped).toEqual({ weapon: 'a', ring: 'b' })
    expect(asEquipSlots(bag.unassignSlot(asSlotMap(equipped), 'weapon'))).toEqual({ ring: 'b' })
    expect([...bag.assignedUids(asSlotMap(equipped))].sort()).toEqual(['a', 'b'])
  })

  it('一处有意的收紧:uid 是身份,重复的件拒收(旧口径会照收)', () => {
    const bag = createBag(() => new Set())
    const items = [item('a')]
    const dup = bag.add({ items }, item('a'))
    expect(dup.ok).toBe(false)
    expect(dup.reason).toBe('duplicate')
    expect(dup.holding.items.length).toBe(1)
  })
})
