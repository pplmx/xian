/**
 * 天时(Phase 31.0 A1)—— 游戏内每日环境
 *
 * 世界每天有一个轻微变化,影响环境而非玩家硬任务:
 *   灵雨:灵气恢复 +20%,修炼速度 +10%
 *   赤阳:火系伤害 +15%,火系词条效率提升
 *   月蚀:幽冥系效果增强,夜行事件 +20%
 *   雷鸣:突破危险提高(渡劫难度 +8%),雷系收益提高
 *   清和:无损益,风和日丽
 *
 * 飞升之后天象随界域而变(见 WORLD_WEATHERS):仙界·仙雨/紫气/仙劫日,
 * 神界·神辉/法则潮/神威日,混沌海·混沌潮/本源涌动/道音。
 *
 * 关键:确定性(每游戏日固定,刷新不换),与"今日天道"同模式,
 * 由游戏总秒数派生,无现实时间依赖。
 */
import { useGameStore } from '@/stores/game'
import { usePlayerStore } from '@/stores/player'
import { createCycleSystem, type CycleContext } from 'wanxiang-engine'
import { worldOf } from '@/data/realms'
import type { StatMods, WorldId } from '@/types'

export type WeatherId =
  // 人间界
  | 'lingyu'
  | 'chiyang'
  | 'yueshi'
  | 'leiming'
  | 'qinghe'
  // 仙界
  | 'xianyu'
  | 'ziqi'
  | 'xianjie'
  // 神界
  | 'shenhui'
  | 'faze'
  | 'shenwei'
  // 混沌海
  | 'hundunchao'
  | 'benyuan'
  | 'daoyin'

export interface WeatherDef {
  id: WeatherId
  name: string
  desc: string
  /** 环境系数(并入 mods 的临时加成) */
  mods: StatMods
  /** 渡劫难度倍率(>1 更险) */
  tribulationMult: number
}

export const WEATHERS: WeatherDef[] = [
  {
    id: 'lingyu',
    name: '灵雨',
    desc: '灵雨润泽,灵气恢复与修炼皆有裨益。',
    mods: { qiRegen: 0.2, cultivationSpeed: 0.1 },
    tribulationMult: 1
  },
  {
    id: 'chiyang',
    name: '赤阳',
    desc: '赤阳高悬,火属之物更显威能。',
    mods: { attackPct: 0.05, damageBonus: 0.05 },
    tribulationMult: 1
  },
  {
    id: 'yueshi',
    name: '月蚀',
    desc: '月蚀之夜,幽冥之气弥漫。',
    mods: { luck: 0.05, dropRate: 0.05 },
    tribulationMult: 1
  },
  {
    id: 'leiming',
    name: '雷鸣',
    desc: '雷鸣阵阵,突破更险,雷属却更旺。',
    mods: { attackPct: 0.05, tribulationResist: -0.05 },
    tribulationMult: 1.08
  },
  {
    id: 'qinghe',
    name: '清和',
    desc: '风和日丽,四时清和。',
    mods: {},
    tribulationMult: 1
  }
]

/**
 * 界域专属天象。
 *
 * 人间界的五日天时是"看天吃饭"的俗世气象;飞升之后天象随界域而变——
 * 仙界是仙灵之气与仙劫,神界是神辉与法则潮,混沌海是本源涌动。
 * 它们不是新玩法,只是把每个界域写成能看见、也能吃到的东西,
 * 让 12 个新境界不至于同质成同一片天。
 *
 * 与人间界同构:纯确定性(游戏日 + 界域派生)、只并入 mods 的临时加成,
 * 不新开资源、不新开货币。
 */
export const WORLD_WEATHERS: Record<Exclude<WorldId, 'mortal'>, WeatherDef[]> = {
  immortal: [
    {
      id: 'xianyu',
      name: '仙雨',
      desc: '仙灵之气化雨而落,吐纳之间灵气自生。',
      mods: { qiRegen: 0.25, cultivationSpeed: 0.12 },
      tribulationMult: 1
    },
    {
      id: 'ziqi',
      name: '紫气东来',
      desc: '紫气自东而来,机缘与气运皆盛。',
      mods: { luck: 0.08, dropRate: 0.08 },
      tribulationMult: 1
    },
    {
      id: 'xianjie',
      name: '仙劫日',
      desc: '天门震动,仙劫将至——渡劫更险,锋芒却更利。',
      mods: { attackPct: 0.08, tribulationResist: -0.08 },
      tribulationMult: 1.1
    }
  ],
  god: [
    {
      id: 'shenhui',
      name: '神辉',
      desc: '神光普照,出手之间自有威势。',
      mods: { attackPct: 0.08, damageBonus: 0.08 },
      tribulationMult: 1
    },
    {
      id: 'faze',
      name: '法则潮',
      desc: '法则如潮涌动,周身受其护持。',
      mods: { defensePct: 0.08, damageReduction: 0.06 },
      tribulationMult: 1
    },
    {
      id: 'shenwei',
      name: '神威日',
      desc: '众神之威压下,神劫更烈,神躯亦更固。',
      mods: { maxHpPct: 0.1, tribulationResist: -0.1 },
      tribulationMult: 1.12
    }
  ],
  chaos: [
    {
      id: 'hundunchao',
      name: '混沌潮',
      desc: '混沌之气起落如潮,吞纳之间修为奔涌。',
      mods: { cultivationSpeed: 0.2, qiRegen: 0.3 },
      tribulationMult: 1
    },
    {
      id: 'benyuan',
      name: '本源涌动',
      desc: '本源翻涌,举手投足皆合大道。',
      mods: { attackPct: 0.1, damageBonus: 0.08 },
      tribulationMult: 1
    },
    {
      id: 'daoyin',
      name: '道音',
      desc: '虚空之中道音不绝,福至心灵。',
      mods: { luck: 0.1, dropRate: 0.1, breakthroughRate: 0.03 },
      tribulationMult: 1
    }
  ]
}

const BY_ID = new Map([...WEATHERS, ...Object.values(WORLD_WEATHERS).flat()].map(w => [w.id, w]))

export function weatherDef(id: WeatherId): WeatherDef | undefined {
  return BY_ID.get(id)
}

const DAY_SEC = 86400

/**
 * 天时换成"周期"这一层来管(见 packages/engine 的 cycles)。
 *
 * 库负责三件与题材无关的事:周期序号怎么从游戏时长里来、种子怎么派生、池子怎么切;
 * **本作自己的两条规矩原样保留**,故每一天的天时一位不变:
 *   种子公式(day × 2654435761 + 盐)与抽取规则(人间界清和 30% / 其余均分;
 *   界外各池等概率)—— 都是本作的口径,通过 `seedOf` 与 `pick` 交给库。
 */
const CYCLES = createCycleSystem({
  periodSec: DAY_SEC,
  pools: { mortal: WEATHERS, ...WORLD_WEATHERS },
  seedOf: (day, ctx) => (ctx.salt ? day * 2654435761 + ctx.salt * 131 + 0x51ed : day * 2654435761 + 0x9e3779b9),
  pick: (entries, rng) => {
    // 人间界:清和(第 5 条)30%,其余四条均分 70%
    if (entries === WEATHERS) {
      const roll = rng.next()
      if (roll < 0.3) return entries[4]
      const idx = Math.floor(((roll - 0.3) / 0.7) * 4)
      return entries[Math.min(3, idx)]
    }
    // 界外各池等概率
    return entries[rng.int(0, entries.length - 1)]
  }
})

/** 当前的池与盐:人间界五日天时;界外取该界域专属天象池 */
function contextOf(): CycleContext {
  const world = worldOf(usePlayerStore().major)
  if (world.id === 'mortal') return { pool: 'mortal' }
  return { pool: world.id, salt: world.start }
}

/**
 * 当天天时(确定性:游戏日 + 界域 → 种子 → 天时,同一天内不换)。
 * 人间界沿用五日天时;仙界及以上取该界域的专属天象池。
 */
export function todayWeather(): WeatherDef {
  const game = useGameStore()
  const entry = CYCLES.at(game.totalPlaySec, contextOf()).entry
  return (entry ? weatherDef(entry.id as WeatherId) : undefined) ?? WEATHERS[4]!
}

/** 距离天时更替还有多久(界面用) */
export function weatherRemainingSec(): number {
  return CYCLES.remainingSec(useGameStore().totalPlaySec)
}

/** 接下来几天的天时(界面预告用) */
export function upcomingWeather(count: number): WeatherDef[] {
  return CYCLES.schedule(useGameStore().totalPlaySec, count, contextOf())
    .map(s => (s.entry ? weatherDef(s.entry.id as WeatherId) : undefined))
    .filter((w): w is WeatherDef => w !== undefined)
}
