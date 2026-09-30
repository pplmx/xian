/** 洞府建筑 —— 7 座,长线成长 */
import type { BuildingDef, BuildingId, StatMods } from '@/types'
import { formatSignedPercent } from '@/utils/format'
import {
  ARRAY_QI_CAP_PER_LEVEL,
  BEAST_MULT_PER_LEVEL,
  FIELD_HERB_PER_HOUR,
  FIELD_ORE_PER_HOUR,
  FORGE_LEVEL_PER_CAP,
  LIBRARY_WUDAO_FLOOR_LEVEL,
  LIBRARY_WUDAO_MIN_PER_HOUR,
  LIBRARY_WUDAO_PER_HOUR,
  OFFLINE_CAP_HOURS
} from './constants'

/**
 * 每级数值 —— **mods 与卡面同读这一处**。
 *
 * 此前卡面的「修炼速度 +4%」与 mods 的 `0.04 * lv` 相邻双写,一方改一方忘,
 * 卡面就撒谎。抽出每级倍率常量后,两侧都从它现算 —— 数字只写这一份。
 */
const MANSION_CULT_SPEED_PER_LEVEL = 0.04
const ARRAY_QI_REGEN_PER_LEVEL = 0.1
const ARRAY_CULT_SPEED_PER_LEVEL = 0.03
const ALCHEMY_YIELD_PER_LEVEL = 0.05
const FORGE_DISCOUNT_PER_LEVEL = 0.04
const LIBRARY_EXP_GAIN_PER_LEVEL = 0.03

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
      `修炼速度 +${formatSignedPercent(lv * MANSION_CULT_SPEED_PER_LEVEL)}`
    ],
    mods: (lv): StatMods => ({ cultivationSpeed: lv * MANSION_CULT_SPEED_PER_LEVEL })
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
      `灵气恢复 +${formatSignedPercent(lv * ARRAY_QI_REGEN_PER_LEVEL)}`,
      `灵气上限 +${Math.round(lv * ARRAY_QI_CAP_PER_LEVEL * 100)}%`,
      `修炼速度 +${formatSignedPercent(lv * ARRAY_CULT_SPEED_PER_LEVEL)}`
    ],
    mods: (lv): StatMods => ({
      qiRegen: lv * ARRAY_QI_REGEN_PER_LEVEL,
      cultivationSpeed: lv * ARRAY_CULT_SPEED_PER_LEVEL
    })
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
      `炼丹双成率 +${formatSignedPercent(lv * ALCHEMY_YIELD_PER_LEVEL)}`,
      '炉子只管出丹多寡,成与不成看你懂多少'
    ],
    mods: (lv): StatMods => ({ alchemyYield: lv * ALCHEMY_YIELD_PER_LEVEL })
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
      `强化上限 +${Math.floor(lv / FORGE_LEVEL_PER_CAP)}`,
      `炼器省耗 +${formatSignedPercent(lv * FORGE_DISCOUNT_PER_LEVEL)}`
    ],
    mods: (lv): StatMods => ({ forgeDiscount: lv * FORGE_DISCOUNT_PER_LEVEL })
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
      `辅修栏 ${librarySubGongfaSlots(lv)} 个 · 战斗修为 +${formatSignedPercent(lv * LIBRARY_EXP_GAIN_PER_LEVEL)}`,
      '日夜翻检,读熟手上丹方,进而翻出新方'
    ],
    mods: (lv): StatMods => ({ expGain: lv * LIBRARY_EXP_GAIN_PER_LEVEL })
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
    effectText: lv => [`可驯养灵兽 · 灵兽属性效果 +${Math.round(lv * BEAST_MULT_PER_LEVEL * 100)}%`],
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

/**
 * 藏经阁的辅修栏格数 —— 卡面与 store 同读这一处(每 3 级 +1,起始 1 格)。
 * 此前 `1 + Math.floor(lv / 3)` 在卡面与 `subGongfaSlots` 各写一份,改格距只动一处会分叉。
 */
export function librarySubGongfaSlots(lv: number): number {
  return 1 + Math.floor(lv / 3)
}

/** 整量不印 .0:2.4 显示 2.4,12.0 显示 12 */
const fmtHour = (n: number): string => String(n.toFixed(1).replace(/\.0$/, ''))

const BY_ID = new Map(BUILDINGS.map(x => [x.id, x]))

export function buildingDef(id: BuildingId): BuildingDef | undefined {
  return BY_ID.get(id)
}
