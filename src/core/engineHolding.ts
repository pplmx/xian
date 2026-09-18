/**
 * 背包(持有)—— 本作对库的"持有层"那份定制。
 *
 * 库里只认"每件有个 uid"(连"这是装备"都不知道),所以下面这两条本作口径写在这里:
 *
 *   一 背包容量取 `BAG_CAPACITY`;
 *   二 **已装配的不占背包位** —— 本作的口径:穿在身上的不算行囊里的。别的游戏可以全都占。
 */
import { createHoldingSystem, type SlotMap } from 'wanxiang-engine'
import type { EquipmentInstance, EquipSlot } from '@/types'
import { BAG_CAPACITY } from '@/data/constants'

/** 装配表在库那边是张普通的"槽位 → uid"表;本作的槽位名是 EquipSlot */
export type EquipSlots = Partial<Record<EquipSlot, string>>

export function createBag(equippedUids: () => Set<string>) {
  return createHoldingSystem<EquipmentInstance>({
    capacity: BAG_CAPACITY,
    counted: item => !equippedUids().has(item.uid)
  })
}

export const asSlotMap = (slots: EquipSlots): SlotMap => slots as SlotMap
export const asEquipSlots = (slots: SlotMap): EquipSlots => slots as EquipSlots
