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
import { EQUIP_SLOT_NAMES, equipmentTemplate } from '@/data/equipment'
import { pillDef } from '@/data/pills'
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

    /**
     * 背包「新」角标的已见账:最近一次打开背包时行囊里的那一批 uid。
     * 新入包的 uid 不在账上,卡片挂「新」;开包(InventoryView onMounted)整批替换,
     * 数组恒等于「上次开包时的行囊」,天然有界无需裁剪(见 inventorySeen.spec)。
     */
    const seenUids = ref<string[]>([])
    /** 旧档播种标记:首次清洗把当时行囊整批当「已见」,此后不再覆盖账上已有的「新」 */
    const seenSeeded = ref(false)

    /** 存档修复:行囊/丹药/法宝被写坏时,装备合计与图鉴会在渲染期抛错 */
    function sanitize(): void {
      items.value = asArray<EquipmentInstance>(items.value, [], it => {
        const item = it as EquipmentInstance
        return !!item && typeof item.uid === 'string' && !!equipmentTemplate(item.templateId)
      })
      equipped.value = asRecord<string>(equipped.value)
      // Dangling uid, unknown slot key, or a piece sitting in the wrong slot:
      // the UI only walks real EquipSlots, but equippedUids is Object.values —
      // a mismatched row still counts as worn (stats + bag occupancy) while
      // slotRows never shows it.
      const held = new Map(items.value.map(it => [it.uid, it]))
      const nextEquipped: Partial<Record<EquipSlot, string>> = {}
      for (const [slot, uid] of Object.entries(equipped.value)) {
        if (typeof uid !== 'string' || !(slot in EQUIP_SLOT_NAMES)) continue
        const item = held.get(uid)
        if (!item) continue
        if (equipmentTemplate(item.templateId)?.slot === slot) nextEquipped[slot as EquipSlot] = uid
      }
      equipped.value = nextEquipped
      const nextPills: Record<string, number> = {}
      for (const [id, n] of Object.entries(asNumberRecord(pills.value, 0))) {
        if (n > 0 && pillDef(id)) nextPills[id] = Math.floor(n)
      }
      pills.value = nextPills
      artifacts.value = asArray<ArtifactOwned>(artifacts.value, [], a => {
        const art = a as ArtifactOwned
        return !!art && typeof art.defId === 'string' && !!artifactDef(art.defId)
      })
      // 佩戴表要先对过持有表:坏档可能让 equippedArtifacts 指向不存在的法宝,
      // 幽灵占位会把槽位占满(新法宝佩不上、也换不进来),见 inventory.spec 回归
      const ownedDefIds = new Set(artifacts.value.map(a => a.defId))
      equippedArtifacts.value = asStringArray(equippedArtifacts.value).filter(id => ownedDefIds.has(id))
      // 「新」角标的账:写坏就洗成纯字符串表;旧档首次清洗把当时行囊整批播种为
      // 已见 —— 不这样做,老玩家一开背包满屏假新。播种只一次(seenSeeded 落位),
      // 此后再清洗也不会把账上新入包的「新」顺手抹平。
      seenUids.value = asStringArray(seenUids.value)
      if (!seenSeeded.value) {
        seenUids.value = items.value.map(i => i.uid)
        seenSeeded.value = true
      }
    }

    /** 打开背包 = 这一批都看过了:整批替换,此后新入包的 uid 才挂「新」 */
    function markInventorySeen(): void {
      seenUids.value = items.value.map(i => i.uid)
    }

    /** 行囊里还有「新入包没开包看过」的件 —— 底部导航的背包页签点挂它(见 inventorySeen.spec) */
    const hasNewItem = computed(() => items.value.some(i => !seenUids.value.includes(i.uid)))

    /** 还没开包看过的新件数 —— 底导计数徽标用(量才值得报:一件小点、好几件报个数,9+ 封顶由界面收口) */
    const newItemCount = computed(() => items.value.filter(i => !seenUids.value.includes(i.uid)).length)

    /** 这一件是「新入包、还没开过包看它」吗(卡片挂「新」角标的唯一判据) */
    function isNewItem(uid: string): boolean {
      return !seenUids.value.includes(uid)
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
      seenUids,
      seenSeeded,
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
      markInventorySeen,
      isNewItem,
      hasNewItem,
      newItemCount,
      sanitize
    }
  },
  { persist: persistConfig('inventory') }
)
