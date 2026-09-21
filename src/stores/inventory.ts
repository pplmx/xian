/** 背包与装备状态 */
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { ArtifactOwned, EquipmentInstance, EquipSlot, GNum, StatMods } from '@/types'
import { add, gnZero } from '@/utils/gnum'
import { persistConfig } from '@/utils/storage'
import { asEquipSlots, asSlotMap, createBag } from '@/core/engineHolding'
import { resolveEquipStats } from '@/core/equipGen'
import { mergeMods } from '@/core/statsCalc'
import { useLoreStore } from '@/stores/lore'
import { artifactDef, artifactValue } from '@/data/artifacts'
import { asArray, asNumberRecord, asRecord, asStringArray } from '@/utils/saveShape'

export const useInventoryStore = defineStore(
  'inventory',
  () => {
    const items = ref<EquipmentInstance[]>([])
    const equipped = ref<Partial<Record<EquipSlot, string>>>({})
    const pills = ref<Record<string, number>>({})
    const artifacts = ref<ArtifactOwned[]>([])
    /** 已祭炼的法宝(元婴起可佩两件) */
    const equippedArtifacts = ref<string[]>([])

    /** 存档修复:行囊/丹药/法宝被写坏时,装备合计与图鉴会在渲染期抛错 */
    function sanitize(): void {
      items.value = asArray<EquipmentInstance>(items.value, [], it => !!it && typeof (it as EquipmentInstance).uid === 'string')
      equipped.value = asRecord<string>(equipped.value)
      pills.value = asNumberRecord(pills.value, 0)
      artifacts.value = asArray<ArtifactOwned>(artifacts.value, [], a => !!a && typeof (a as ArtifactOwned).defId === 'string')
      // 佩戴表要先对过持有表:坏档可能让 equippedArtifacts 指向不存在的法宝,
      // 幽灵占位会把槽位占满(新法宝佩不上、也换不进来),见 inventory.spec 回归
      const ownedDefIds = new Set(artifacts.value.map(a => a.defId))
      equippedArtifacts.value = asStringArray(equippedArtifacts.value).filter(id => ownedDefIds.has(id))
    }

    const equippedUids = computed(() => new Set(Object.values(equipped.value).filter(Boolean) as string[]))

    const equippedItems = computed(() => items.value.filter(it => equippedUids.value.has(it.uid)))

    const bagItems = computed(() => items.value.filter(it => !equippedUids.value.has(it.uid)))

    /**
     * 背包口径走库的持有层(见 core/engineHolding):容量、什么算占位、删一件顺带卸下,
     * 都由那一层回答 —— 这个文件只剩"状态怎么存"。
     */
    const bag = createBag(() => equippedUids.value)

    const bagFull = computed(() => bag.isFull({ items: items.value }))

    /** 已装备件的平铺数值合计 */
    const equipFlats = computed(() => {
      const out = { attack: gnZero() as GNum, defense: gnZero() as GNum, maxHp: gnZero() as GNum }
      for (const it of equippedItems.value) {
        const r = resolveEquipStats(it)
        out.attack = add(out.attack, r.flats.attack)
        out.defense = add(out.defense, r.flats.defense)
        out.maxHp = add(out.maxHp, r.flats.maxHp)
      }
      return out
    })

    /** 已装备件 + 法宝被动的百分比属性合计 */
    const equipMods = computed<StatMods>(() => {
      const sources: StatMods[] = equippedItems.value.map(it => resolveEquipStats(it).mods)
      for (const art of currentArtifacts.value) {
        const def = artifactDef(art.defId)
        if (!def) continue
        // 被动按「品阶 × 祭炼」放大 —— 与背包卡片、图鉴、战斗读同一份(artifactValue)
        sources.push(artifactValue(def, art.level).passive)
      }
      return mergeMods(sources)
    })

    const currentArtifacts = computed<ArtifactOwned[]>(() =>
      equippedArtifacts.value.map(id => artifacts.value.find(a => a.defId === id)).filter((a): a is ArtifactOwned => a !== undefined)
    )

    function findItem(uid: string): EquipmentInstance | undefined {
      return bag.find({ items: items.value }, uid)
    }

    /** 加入装备;背包满则返回 false(由调用方决定折算) */
    function addEquipment(inst: EquipmentInstance): boolean {
      const added = bag.add({ items: items.value }, inst)
      if (!added.ok) return false
      items.value = added.holding.items
      return true
    }

    function removeEquipment(uid: string): void {
      const taken = bag.remove({ items: items.value }, uid)
      if (!taken.removed) return
      items.value = taken.holding.items
      // 删一件要把所有槽位上的它摘掉,否则装配表里会留一个悬空 uid
      const off = bag.unassignUid(asSlotMap(equipped.value), uid)
      if (off.cleared.length > 0) equipped.value = asEquipSlots(off.slots)
    }

    function replaceItem(inst: EquipmentInstance): void {
      const replaced = bag.replace({ items: items.value }, inst)
      if (replaced.found) items.value = replaced.holding.items
    }

    function equip(uid: string, slot: EquipSlot): void {
      equipped.value = asEquipSlots(bag.assign(asSlotMap(equipped.value), slot, uid))
      // 「亲手用过」记在图鉴的见闻里:收录深度因此有一档由玩家自己推进(见 ui/codex)
      const inst = findItem(uid)
      if (inst) useLoreStore().noteEquipUsed(inst.templateId)
    }

    function unequip(slot: EquipSlot): void {
      equipped.value = asEquipSlots(bag.unassignSlot(asSlotMap(equipped.value), slot))
    }

    function addPill(id: string, n: number): void {
      pills.value = { ...pills.value, [id]: (pills.value[id] ?? 0) + n }
    }

    function spendPill(id: string, n = 1): boolean {
      const have = pills.value[id] ?? 0
      if (have < n) return false
      const next = { ...pills.value }
      if (have - n <= 0) delete next[id]
      else next[id] = have - n
      pills.value = next
      return true
    }

    /** 获得法宝;重复返回 false(由调用方折算) */
    function addArtifact(defId: string): boolean {
      if (artifacts.value.some(a => a.defId === defId)) return false
      artifacts.value = [...artifacts.value, { defId, level: 0 }]
      if (equippedArtifacts.value.length === 0) equippedArtifacts.value = [defId]
      return true
    }

    function levelUpArtifact(defId: string): void {
      artifacts.value = artifacts.value.map(a => (a.defId === defId ? { ...a, level: a.level + 1 } : a))
    }

    /** 祭炼/收回法宝;槽满时替换最早佩戴的一件 */
    function toggleArtifact(defId: string, maxSlots: number): 'equipped' | 'unequipped' | 'replaced' {
      if (equippedArtifacts.value.includes(defId)) {
        equippedArtifacts.value = equippedArtifacts.value.filter(id => id !== defId)
        return 'unequipped'
      }
      if (equippedArtifacts.value.length < maxSlots) {
        equippedArtifacts.value = [...equippedArtifacts.value, defId]
        return 'equipped'
      }
      equippedArtifacts.value = [...equippedArtifacts.value.slice(1), defId]
      return 'replaced'
    }

    return {
      items,
      equipped,
      pills,
      artifacts,
      equippedArtifacts,
      equippedItems,
      equippedUids,
      bagItems,
      bagFull,
      equipFlats,
      equipMods,
      currentArtifacts,
      findItem,
      addEquipment,
      removeEquipment,
      replaceItem,
      equip,
      unequip,
      addPill,
      spendPill,
      addArtifact,
      levelUpArtifact,
      toggleArtifact,
      sanitize
    }
  },
  { persist: persistConfig('inventory') }
)
