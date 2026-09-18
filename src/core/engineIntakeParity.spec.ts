/**
 * 入库漏斗对账 —— 装备入账交给库的入库层之后,四条去路的**文案与去向**与迁移前一一对应。
 *
 * 与 engineParity 同一条纪律。冻结的是迁移前那四条文案与它们各自的去向
 * (`AcquireResult` 的 line / bagged / dust / stone):
 *   ① 被自动回收   → `(自动回收,…)`、不入包、有化尘;
 *   ② 行囊已满     → `(行囊已满,…)`、不入包、有化尘;
 *   ③ 收纳规则腾位 → `(收纳规则腾位:旧件…化尘…)`、**入包**、且带被挤掉那件的化尘;
 *   ④ 顺利入包     → 只有名字、入包、无化尘。
 * 另有两条时机上的约定:见闻在裁决**之前**记(化尘的也算见过),`forceKeep` 跳过裁决。
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import type { EquipmentInstance, QualityId } from '@/types'
import { acquireEquipment } from './loot'
import { useInventoryStore } from '@/stores/inventory'
import { useResourcesStore } from '@/stores/resources'
import { useSettingsStore } from '@/stores/settings'
import { useLoreStore } from '@/stores/lore'
import { usePlayerStore } from '@/stores/player'
import { BAG_CAPACITY } from '@/data/constants'
import { gn } from '@/utils/gnum'

let seq = 0
function mk(quality: QualityId, uid?: string): EquipmentInstance {
  seq += 1
  return { uid: uid ?? `u${seq}`, templateId: 'b_qingyun', quality, tier: 3, level: 0, affixes: [] }
}

function smartOn(): void {
  useSettingsStore().decomposeRanks = []
  useSettingsStore().smartKeep = {
    enabled: true,
    minQuality: 3,
    minTier: 0,
    junkBelowLine: false,
    keepCoreAffix: true,
    keepComboPiece: true,
    keepPerfectRolls: true,
    keepSetPiece: true
  }
  useResourcesStore().spiritStone = gn(0)
}

beforeEach(() => {
  setActivePinia(createPinia())
})

describe('入库漏斗对账 —— 四条去路的文案与去向', () => {
  it('① 被自动回收:文案带"自动回收"、不入包、有化尘', () => {
    smartOn()
    const resources = useResourcesStore()
    const result = acquireEquipment(mk('mortal'))
    expect(result.line).toMatch(/^.+\(自动回收,化作器灵尘×\d+\)$/)
    expect(result.bagged).toBe(false)
    expect(result.dust).toBeGreaterThan(0)
    expect(resources.dust).toBe(result.dust) // 折算到账,与回执同一份数
    expect(useInventoryStore().items.length).toBe(0)
  })

  it('② 行囊已满:文案带"行囊已满"、不入包、有化尘', () => {
    // 收纳关着(不收也不腾),背包塞满
    useSettingsStore().decomposeRanks = []
    useSettingsStore().smartKeep.enabled = false
    const inventory = useInventoryStore()
    fillBag(inventory)
    const result = acquireEquipment(mk('mortal'))
    expect(result.line).toMatch(/\(行囊已满,化作器灵尘×\d+\)$/)
    expect(result.bagged).toBe(false)
    expect(result.dust).toBeGreaterThan(0)
    expect(inventory.items.length).toBe(BAG_CAPACITY) // 满着的还是满着
  })

  it('③ 收纳规则腾位:入包、且回执带被挤掉那件的化尘', () => {
    smartOn()
    const inventory = useInventoryStore()
    fillBag(inventory) // 全是凡品(与道无缘)
    const before = inventory.items.length
    const result = acquireEquipment(mk('divine')) // 神品:值得留
    expect(result.line).toMatch(/\(收纳规则腾位:.+化作器灵尘×\d+\)$/)
    expect(result.bagged).toBe(true)
    expect(result.dust).toBeGreaterThan(0) // 被挤掉那件的化尘
    expect(inventory.items.length).toBe(before) // 挤一件、进一件
    expect(inventory.items.some(it => it.quality === 'divine')).toBe(true)
  })

  it('④ 顺利入包:只有名字、无化尘', () => {
    useSettingsStore().decomposeRanks = []
    useSettingsStore().smartKeep.enabled = false
    const result = acquireEquipment(mk('divine'))
    expect(result.line).not.toContain('(')
    expect(result.bagged).toBe(true)
    expect(result.dust).toBe(0)
    expect(Number(result.stone.e)).toBe(0)
  })

  it('时机:见闻在裁决之前(化尘的那件也算见过);forceKeep 跳过裁决', () => {
    smartOn()
    const lore = useLoreStore()
    usePlayerStore().major = 0
    const junk = mk('mortal')
    acquireEquipment(junk)
    // 化尘了,但见过:收录深度里有它
    expect(lore.equipSeen(junk.templateId)).toBeDefined()

    const gift = mk('mortal')
    const kept = acquireEquipment(gift, { forceKeep: true, quiet: true })
    expect(kept.bagged).toBe(true) // 自动回收的口径管不到它
    expect(kept.line).not.toContain('自动回收')
  })
})

/** 把行囊塞满凡品(与道无缘,值得被挤掉) */
function fillBag(inventory: ReturnType<typeof useInventoryStore>): void {
  inventory.items = Array.from({ length: BAG_CAPACITY }, (_, i) => mk('mortal', `full${i}`))
}
