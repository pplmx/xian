/** 洞府建筑 —— 7 座,长线成长 */
import type { BuildingDef, BuildingId, StatMods } from '@/types'
import {
  FIELD_HERB_PER_HOUR,
  FIELD_ORE_PER_HOUR,
  LIBRARY_WUDAO_FLOOR_LEVEL,
  LIBRARY_WUDAO_MIN_PER_HOUR,
  LIBRARY_WUDAO_PER_HOUR,
  OFFLINE_CAP_HOURS
} from './constants'

export const BUILDINGS: BuildingDef[] = [
  {
    id: 'mansion',
    name: '洞府',
    desc: '居所即道场。洞府等级决定离线收益上限,并影响其余建筑的等级上限',
    icon: 'home',
    maxLevel: 4,
    unlockRealm: 0,
    costBase: 200,
    costOre: 20,
    effectText: lv => [
      `离线收益上限 ${OFFLINE_CAP_HOURS[Math.min(lv, OFFLINE_CAP_HOURS.length - 1)]} 小时`,
      '其余建筑等级上限 +5/级',
      `修炼速度 +${lv * 4}%`
    ],
    mods: (lv): StatMods => ({ cultivationSpeed: lv * 0.04 })
  },
  {
    id: 'array',
    name: '聚灵阵',
    desc: '汇聚天地灵气,滋养洞府',
    icon: 'wind',
    maxLevel: 20,
    unlockRealm: 0,
    costBase: 60,
    costOre: 6,
    effectText: lv => [
      `灵气恢复 +${lv * 10}%`,
      `灵气上限 +${lv * 8}%`,
      `修炼速度 +${lv * 3}%`
    ],
    mods: (lv): StatMods => ({ qiRegen: lv * 0.1, cultivationSpeed: lv * 0.03 })
  },
  {
    id: 'alchemy',
    name: '炼丹炉',
    desc: '开炉炼丹,以药辅道',
    icon: 'flame',
    maxLevel: 10,
    unlockRealm: 0,
    costBase: 100,
    costOre: 10,
    // Phase 32.3 之后丹方不再由炉火高低"解锁",炉子只管出丹多寡 —— 成与不成看所知与手上功夫
    effectText: lv => [
      `炼丹双成率 +${lv * 5}%`,
      '炉子只管出丹多寡,成与不成看你懂多少'
    ],
    mods: (lv): StatMods => ({ alchemyYield: lv * 0.05 })
  },
  {
    id: 'forge',
    name: '炼器台',
    desc: '锻造强化,点石成金',
    icon: 'hammer',
    maxLevel: 10,
    unlockRealm: 1,
    costBase: 150,
    costOre: 15,
    effectText: lv => [
      `强化上限 +${Math.floor(lv / 2)}`,
      `炼器消耗 -${lv * 4}%`
    ],
    mods: (lv): StatMods => ({ forgeDiscount: lv * 0.04 })
  },
  {
    id: 'field',
    name: '灵田',
    desc: '春种一粒粟,秋收万颗灵',
    icon: 'sprout',
    maxLevel: 15,
    unlockRealm: 0,
    costBase: 80,
    costOre: 8,
    effectText: lv => [
      `每小时产灵草 ${(lv * FIELD_HERB_PER_HOUR).toFixed(0)} 株、玄铁 ${fmtHour(lv * FIELD_ORE_PER_HOUR)} 块`
    ],
  },
  {
    id: 'library',
    name: '藏经阁',
    desc: '藏尽天下道藏,参悟其中真意',
    icon: 'book',
    maxLevel: 12,
    unlockRealm: 1,
    costBase: 120,
    costOre: 12,
    // 钻研丹方是藏经阁的第三桩职能(见 core/loreService.ts studyTick),不写出来玩家无从得知
    effectText: lv => [
      `每小时产悟道点 ${fmtHour(libraryWudaoPerHour(lv))}`,
      `辅修栏 ${1 + Math.floor(lv / 3)} 个 · 战斗修为 +${lv * 3}%`,
      '日夜翻检,读熟手上丹方,进而翻出新方'
    ],
    mods: (lv): StatMods => ({ expGain: lv * 0.03 })
  },
  {
    id: 'beast',
    name: '灵兽园',
    desc: '驯养灵兽,与道为伴',
    icon: 'paw',
    maxLevel: 8,
    unlockRealm: 2,
    costBase: 300,
    costOre: 30,
    effectText: lv => [`可驯养灵兽 · 灵兽属性效果 +${lv * 10}%`],
  }
]

/**
 * 藏经阁每级每小时悟道点 —— 唯一实现住在这里(engineFacilities 转发):
 * 低级(lv≤FLOOR_LEVEL)给保底起步(快赢3,ISS-303),卡片文案与产出同源,
 * 不再出现"卡面印 1.5、实产 4"这类字面低于实情。
 */
export function libraryWudaoPerHour(lv: number): number {
  return lv <= LIBRARY_WUDAO_FLOOR_LEVEL
    ? Math.max(LIBRARY_WUDAO_MIN_PER_HOUR, lv * LIBRARY_WUDAO_PER_HOUR)
    : lv * LIBRARY_WUDAO_PER_HOUR
}

/** 整量不印 .0:2.4 显示 2.4,12.0 显示 12 */
const fmtHour = (n: number): string => String(n.toFixed(1).replace(/\.0$/, ''))

const BY_ID = new Map(BUILDINGS.map(x => [x.id, x]))

export function buildingDef(id: BuildingId): BuildingDef | undefined {
  return BY_ID.get(id)
}
