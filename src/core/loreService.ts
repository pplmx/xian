/**
 * 所知服务(Phase 32.3)—— 认知怎么长、技艺怎么长
 *
 * 设计要点:知识不靠点击"学习"按钮获得。
 * 它来自照面(采到过)、来自动手(炼过/砸过)、来自失手(炸过炉)、来自交手(打过/被打过)、
 * 来自藏经阁的日夜翻检。因此这里没有一个叫 unlock() 的函数——只有 encounter / note / study。
 */
import type { PillDef } from '@/types'
import { rng } from '@/utils/random'
import { LORE_MAX, materialDef, materialsNearRank, type MaterialBucket, type MaterialDef } from '@/data/materials'
import { recipeCraft, type SkillId } from '@/data/crafting'
import { pillDef, PILLS } from '@/data/pills'
import { enemyDef } from '@/data/enemies'
import { bearableRank } from './craftability'
import { softChance } from 'wanxiang-engine'
import { useLoreStore } from '@/stores/lore'
import { useDongfuStore } from '@/stores/dongfu'
import { usePlayerStore } from '@/stores/player'
import { useUiStore } from '@/stores/ui'

/** 认知层 1→2 所需的照面次数 */
export const SEEN_FOR_NATURE = 4
/**
 * 藏经阁每级每小时推进的丹方掌握度。
 *
 * 原值 0.006 是按"只补熟旧存档折算下来那几张半生方子"定的。自 studyTick 兼管
 * 求索新方之后,它扛的是整条丹方获取线——按旧值,一级藏经阁翻出一张方子要四十
 * 余个时辰,再读通它又是一百四十个,高阶丹依旧等同于拿不到。故按新职能重定。
 *
 * 现值下:六级藏经阁约三个时辰翻出一张新方,再五个时辰把它读通。
 */
export const STUDY_MASTERY_PER_HOUR = 0.05
/**
 * 翻出一张全新丹方所需的钻研量。
 *
 * 比读熟一张(0→1)省力得多 —— 听说有这么一张方子,与真把它读通,本就是两回事。
 * 但也绝非唾手可得:一级藏经阁要熬四十来个时辰才翻得出一张。
 */
export const NEW_RECIPE_COST = 0.25
/** 新翻到的方子只是"抄下来了",火候节点仍全靠猜 */
export const NEW_RECIPE_START = 0.15
/** 藏经阁翻得动的上限:够得着的,再往上够一阶 */
export const STUDY_REACH_OVER = 1

// 档位与门槛住在 core/loreThresholds(单独一份,免得与 stores/lore 绕成环);这里转出,
// 调用方与用例的 import 一行不用改
import {
  ENEMY_LORE_LOSS_WEIGHT,
  ENEMY_LORE_MAX
} from './loreThresholds'
export {
  ENEMY_LORE_BOSS_THRESHOLDS,
  ENEMY_LORE_LOSS_WEIGHT,
  ENEMY_LORE_MAX,
  ENEMY_LORE_STAGE_NAMES,
  ENEMY_LORE_THRESHOLDS
} from './loreThresholds'

// ============ 认知检定(纯函数,可独立测试) ============

/**
 * 辨识一味未知灵材的概率。
 * 材料阶位越高越难认,识材技艺越高越容易,照面次数给一点保底——
 * 见得够多,再迟钝的人也总有认出来的一天。
 *
 * 那份"见得多了概率涨"的曲线走库的软保底原语(见 packages/engine 的 pity):
 * 每多一次照面 +3%,最多 +35%,概率夹在 [4%, 90%] —— 涨幅封顶这一条很重要,
 * 不封顶的话到了后期概率会被抬到 1,等于把"越看越眼熟"改写成"第 N 次必认出"。
 */
export function discernChance(rank: number, discernLevel: number, seen: number): number {
  const base = 0.2 + discernLevel / 260 - (rank - 1) * 0.018
  return softChance(base, seen, { step: 0.03, cap: 0.35, floor: 0.04, ceil: 0.9 })
}

/**
 * 从"知道它叫什么"到"知道它什么性子"的概率。
 * 这一步吃的是专业技艺:草木问辨药,金石问锻打。
 */
export function natureChance(rank: number, discernLevel: number, craftLevel: number, seen: number): number {
  if (seen < SEEN_FOR_NATURE) return 0
  const base = 0.1 + discernLevel / 500 + craftLevel / 300 - (rank - 1) * 0.015
  // 门槛之后才开始涨:所以传进去的是"越过门槛之后见过几次"
  return softChance(base, seen - SEEN_FOR_NATURE, { step: 0.02, cap: 0.25, floor: 0.02, ceil: 0.75 })
}

// ============ 服务 ============

/** 该材料的"专业技艺":草木看辨药,金石看锻打 */
function craftSkillOf(def: MaterialDef): SkillId {
  return def.bucket === 'herb' ? 'herbLore' : 'smithing'
}

/**
 * 与一味灵材照面。采集、掉落、事件都应调用。
 * 只推进到第 2 层——第 3 层"已通用"必须靠真正用它做过东西,见 noteMaterialUsed。
 * @returns 本次是否推进了认知层
 */
export function encounterMaterial(id: string, quiet = false): boolean {
  const def = materialDef(id)
  if (!def) return false
  const lore = useLoreStore()
  lore.markSeen(id)

  const stage = lore.loreOf(id)
  if (stage >= 2) return false

  const seen = lore.seenOf(id)
  const discernLv = lore.skillLevel('discern')
  const hit =
    stage === 0
      ? rng.chance(discernChance(def.rank, discernLv, seen))
      : rng.chance(natureChance(def.rank, discernLv, lore.skillLevel(craftSkillOf(def)), seen))
  if (!hit) {
    // 没认出来也不算白看:识材技艺照长,只是长得慢
    lore.addSkillExp('discern', 0.6)
    return false
  }

  lore.advanceLore(id, stage + 1)
  lore.addSkillExp('discern', 4 + def.rank * 1.5)
  if (stage === 1) lore.addSkillExp(craftSkillOf(def), 3 + def.rank)
  if (!quiet) {
    const ui = useUiStore()
    ui.toast(stage === 0 ? `辨出一味灵材:「${def.name}」` : `已知「${def.name}」药性`, 'rare')
  }
  return true
}

/**
 * 采集/掉落时抽一味当前层级会撞见的灵材并推进认知。
 * 这是把既有的 `herb+3` 标量掉落接进认知体系的钩子:数量照旧进标量库存,
 * 但"你到底采到了什么"从此有了答案。
 */
export function rollFieldMaterial(tier: number, bucket?: MaterialBucket): MaterialDef | null {
  const pool = materialsNearRank(Math.max(1, Math.ceil(tier / 2)), bucket)
  if (pool.length === 0) return null
  // 低阶材料更常见,但高阶材料永远有一线机会撞见
  return rng.weighted(pool, x => 1 / x.rank)
}

/** 采集一批材料:抽出具体是什么并推进认知(静默,避免刷屏) */
export function harvestMaterials(tier: number, bucket: MaterialBucket, times = 1): void {
  for (let i = 0; i < Math.min(3, times); i += 1) {
    const def = rollFieldMaterial(tier, bucket)
    if (def) encounterMaterial(def.id, true)
  }
}

/** 真正用一味材料做过东西 —— 唯一能推到"已通用"的途径 */
export function noteMaterialUsed(id: string, succeeded: boolean): void {
  const def = materialDef(id)
  if (!def) return
  const lore = useLoreStore()
  lore.markSeen(id)
  if (lore.loreOf(id) !== 2) return
  // 上手过才谈得上"通用";失败反而记得更牢
  const chance = succeeded ? 0.22 : 0.34
  if (!rng.chance(chance)) return
  if (lore.advanceLore(id, LORE_MAX)) {
    lore.addSkillExp(craftSkillOf(def), 6 + def.rank * 2)
    useUiStore().toast(`已通晓「${def.name}」的用法`, 'rare')
  }
}

/**
 * 与一头敌人交手 —— 敌人认知的唯一来源(Phase 32.5)。
 *
 * 认知层不给任何属性,它给的是"知道它会怎么打":
 * 遭遇与战报界面据此逐层揭示元素、招式、残血变阵(见 ui/enemyLore.ts)。
 * 这份认知随神魂转世不灭 —— 第五世的你确实已经知道哪头妖物残血才发狂。
 *
 * 累计与升档交给库的图鉴层(见 core/engineCodex):本作只给"败绩算几次"与两张门槛表。
 * @returns 本次是否推进了认知层
 */
export function noteEnemy(enemyId: string, win: boolean): boolean {
  const def = enemyDef(enemyId)
  if (!def) return false
  const lore = useLoreStore()
  // 照面计数仍由 store 记(口径只有一处);"够门槛了吗"交给库的图鉴层判定
  lore.markEnemySeen(enemyId, win ? 1 : ENEMY_LORE_LOSS_WEIGHT)
  const step = lore.advanceEnemyLoreIfDue(enemyId)
  if (!step.advanced) return false

  const ui = useUiStore()
  if (step.stageIndex >= ENEMY_LORE_MAX) ui.toast(`你已洞悉「${def.name}」的路数`, 'rare')
  else if (step.stageIndex === 2) ui.toast(`你摸清了「${def.name}」惯用的招式`, 'info')
  return true
}

/**
 * 整段照面一次入账(离线整段结算用)。
 *
 * 照面权重与单场 `noteEnemy` 同式:胜 +1、负 +`ENEMY_LORE_LOSS_WEIGHT`。
 * 升档循环到不再够门槛为止,toast 最多一声(报最高档),避免挂一夜弹几十条。
 */
export function noteEnemyMany(enemyId: string, wins: number, losses: number): boolean {
  const def = enemyDef(enemyId)
  if (!def) return false
  const seen = Math.max(0, Math.floor(wins)) + Math.max(0, Math.floor(losses)) * ENEMY_LORE_LOSS_WEIGHT
  if (seen <= 0) return false
  const lore = useLoreStore()
  // 照面计数仍由 store 记(口径只有一处);"够门槛了吗"交给库的图鉴层判定
  lore.markEnemySeen(enemyId, seen)
  let advanced = false
  let lastStage = 0
  for (;;) {
    const step = lore.advanceEnemyLoreIfDue(enemyId)
    if (!step.advanced) break
    advanced = true
    lastStage = step.stageIndex
  }
  if (!advanced) return false

  const ui = useUiStore()
  if (lastStage >= ENEMY_LORE_MAX) ui.toast(`你已洞悉「${def.name}」的路数`, 'rare')
  else if (lastStage === 2) ui.toast(`你摸清了「${def.name}」惯用的招式`, 'info')
  return true
}

/** 研读丹方(典籍、师承、事件都走这里) */
export function studyRecipe(id: string, amount: number): number {
  return useLoreStore().addRecipeMastery(id, amount)
}

/** 研读图纸 */
export function studyBlueprint(id: string, amount: number): number {
  return useLoreStore().addBlueprintMastery(id, amount)
}

/**
 * 藏经阁此刻翻得到的方子 —— 按阶位从低到高,先易后难。
 *
 * 两道限制都不是"解锁开关"(那是 Phase 32.3 废掉的旧口径):
 * 准入境界说的是这张方子写给谁看,阶位上限说的是你现在读不读得懂。
 * 够一够能到的高一阶也收进来,免得境界卡在半途时架上无书可读。
 */
export function studiableRecipes(major: number, masteryOf: (id: string) => number): PillDef[] {
  const ceiling = bearableRank(major) + STUDY_REACH_OVER
  const rankOf = (p: PillDef): number => recipeCraft(p)?.rank ?? Number.MAX_SAFE_INTEGER
  return PILLS.filter(p => p.recipe && masteryOf(p.id) <= 0 && p.minRealm <= major && rankOf(p) <= ceiling).sort(
    (a, b) => rankOf(a) - rankOf(b) || a.minRealm - b.minRealm
  )
}

/**
 * 藏经阁被动钻研:每次心跳先补熟手头的方子,都读通了才向外求索。
 * 放着不管也在长学问——这是本体系与放置节奏的接缝,不需要玩家点任何按钮。
 * 在线与离线共用此函数,只是 dtSec 不同。
 *
 * 「翻出新方子」这一支是丹方的唯一持续来源。少了它,开局播种的那几张
 * 就是玩家这辈子会的全部——高阶丹会全部沦为看得见炼不出的死内容。
 */
export function studyTick(dtSec: number): void {
  const dongfu = useDongfuStore()
  const libLv = dongfu.levels.library
  if (libLv <= 0 || dtSec <= 0) return
  const lore = useLoreStore()
  lore.studyFrac += (libLv * STUDY_MASTERY_PER_HOUR * dtSec) / 3600
  if (lore.studyFrac < 0.001) return

  // 先专精:挑一张已知但未通的方子,专补最生的那张
  let target: string | null = null
  let lowest = 1
  for (const [id, v] of Object.entries(lore.recipeLore)) {
    if (v > 0 && v < 1 && v < lowest) {
      lowest = v
      target = id
    }
  }
  if (target !== null) {
    // 贴着这张方子还差的量吃,不整袋倒光:临近完成的方子(如 0.999)吃不下全部
    // studyFrac 时,超出的部分留在 studyFrac 里,下一拍继续喂下一张最生的方子,
    // 而不是 clamp 到 1 后把整段钻研连同溢出一起归零(那是进度蒸发)
    const room = 1 - lore.recipeMastery(target)
    const gain = Math.min(room, lore.studyFrac)
    lore.studyFrac -= gain
    lore.addRecipeMastery(target, gain)
    return
  }

  // 手头的都读通了,才谈得上求索新方
  if (lore.studyFrac < NEW_RECIPE_COST) return
  const found = studiableRecipes(usePlayerStore().major, id => lore.recipeMastery(id))[0]
  if (!found) {
    // 够得着的方子都已在手,再积也无书可翻
    lore.studyFrac = 0
    return
  }
  lore.studyFrac -= NEW_RECIPE_COST
  studyRecipe(found.id, NEW_RECIPE_START)
  useUiStore().toast(`藏经阁中翻出一张丹方:「${found.name}」`, 'rare')
}

/** 入门修士都会的三张方子 —— 不会做这几样,连炉都开不了 */
const STARTER_RECIPES = ['p_jvqisan', 'p_jvqidan', 'p_huichun'] as const
/** 旧存档折算:过去按等级门槛"能炼"的方子,折成半生不熟的掌握度 */
const LEGACY_MASTERY = 0.7
/**
 * 开局技艺底子(约合熟练度 25「入门」)。
 *
 * 会背三张方子的人,不可能没碰过炉子。若从零技艺起步,首炉聚气散把握不足两成,
 * 五炉炸四炉——那不叫"知识决定成败",那叫劝退。给个底子,让第一炉是搏一把,
 * 而不是必输。
 */
const STARTER_SKILL_EXP = 200
const STARTER_SKILLS: readonly SkillId[] = ['discern', 'herbLore', 'pairing', 'condense', 'temper', 'nurture', 'flame']

/**
 * 播种入门认知(幂等)。
 *
 * 两件事:新号得到三张入门方子;旧存档把过去凭丹炉等级能炼的方子折算成掌握度——
 * 折成 0.7 而非 1,因为旧口径下"能炼"只代表够级,并不代表真的懂。
 */
export function seedLoreIfNeeded(): void {
  const lore = useLoreStore()
  if (lore.seeded) return
  const dongfu = useDongfuStore()
  const player = usePlayerStore()

  for (const id of STARTER_RECIPES) {
    if (lore.recipeMastery(id) <= 0) lore.addRecipeMastery(id, 1)
  }
  for (const p of PILLS) {
    if (!p.recipe) continue
    const reachable = (p.alchemyLevel ?? 1) <= dongfu.alchemyLevel && p.minRealm <= player.major
    if (reachable && lore.recipeMastery(p.id) <= 0) lore.addRecipeMastery(p.id, LEGACY_MASTERY)
  }
  // 入门方子里的药必然见过,否则新号连第一炉都开不出来
  for (const id of STARTER_RECIPES) {
    const def = pillDef(id)
    const craft = def ? recipeCraft(def) : null
    for (const mid of craft?.materials ?? []) lore.advanceLore(mid, 1)
  }
  // 底子只补差额:老存档若已练出真本事,不该被这行重置或白送
  for (const id of STARTER_SKILLS) {
    const lack = STARTER_SKILL_EXP - lore.expOf(id)
    if (lack > 0) lore.addSkillExp(id, lack)
  }
  lore.seeded = true
}
