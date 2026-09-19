/**
 * 丹药服务 —— 服用与炼制
 *
 * Phase 32.3 起,炼制不再是「够级必成」的兑换按钮:
 * 成败由认知与技艺决定(见 core/craftability.ts),失手要赔料,但也长本事。
 */
import { gn } from '@/utils/gnum'
import { rng } from '@/utils/random'
import { pillDef } from '@/data/pills'
import { INSTANT_EXP_LAYER_CAP } from '@/data/constants'
import { formatDuration, formatGN } from '@/utils/format'
import { recipeCraft, type SkillId } from '@/data/crafting'
import { expFromSecs, stoneByTier } from './formulas'
import { maxTierForMajor } from '@/data/regions'
import { collect, track } from './progress'
import { craftability, knownRecipes } from './craftability'
import { runCraft, spentOf } from './engineCraft'
import { buffOverflowOf } from './engineBuffs'
import { noteMaterialUsed } from './loreService'
import { noteTaboo } from './samsaraService'
import { usePlayerStore } from '@/stores/player'
import { useResourcesStore } from '@/stores/resources'
import { useInventoryStore } from '@/stores/inventory'
import { useCultivationStore } from '@/stores/cultivation'
import { useLoreStore } from '@/stores/lore'
import { useUiStore } from '@/stores/ui'
import { playSfx } from './audio'
import type { GNum } from '@/types'

/** 服用丹药 */
export function usePill(id: string): boolean {
  const player = usePlayerStore()
  const resources = useResourcesStore()
  const inventory = useInventoryStore()
  const cultivation = useCultivationStore()
  const ui = useUiStore()
  const def = pillDef(id)
  if (!def) return false
  if (!inventory.spendPill(id)) {
    ui.toast('丹药不足', 'warn')
    return false
  }
  const lines: string[] = []
  if (def.kind === 'instant' && def.instant) {
    /**
     * 修为丹:药力 = 服丹者当下的修炼速度 × 等效闭关秒数,封顶在「不满一层」。
     *
     * 走的是与一场遭遇、一次际遇**同一个**结算函数(expFromSecs)——
     * 三条来源只在"这段时长有多长"上不同,不再各有各的公式与各自的漂移。
     * 读 player.cultPerSec 而不是裸修速:丹药说的那句"服之如闭关一时",
     * 就该是他自己的一时(功法/建筑/状态/增益都在里头)。
     */
    if (def.instant.expSecs) {
      const gain = expFromSecs(player.expReq, def.instant.expSecs, player.cultPerSec, INSTANT_EXP_LAYER_CAP)
      player.gainExp(gain)
      lines.push(`修为 +${formatGN(gain)}(约抵闭关 ${formatDuration(def.instant.expSecs)})`)
    }
    if (def.instant.expFixed) {
      player.gainExp(gn(def.instant.expFixed))
      lines.push('修为精进')
    }
    if (def.instant.qiPct) {
      resources.setQi(resources.qi + player.qiCapValue * def.instant.qiPct, player.qiCapValue)
      lines.push('灵气充盈')
    }
    if (def.instant.lifespanYears) {
      player.addLifespan(def.instant.lifespanYears)
      lines.push(`寿元 +${def.instant.lifespanYears} 载`)
    }
    if (def.instant.wudao) {
      resources.addSmall('wudao', def.instant.wudao)
      lines.push(`悟道点 +${def.instant.wudao}`)
    }
  } else if (def.buffId) {
    // 贴着上限再服,药力会被削(甚至一点不加)—— 说出来,别让玩家自己猜"为什么没变"
    const overflow = buffOverflowOf(cultivation.buffs, def.buffId, Date.now())
    cultivation.addBuff(def.buffId, Date.now())
    lines.push(
      overflow === 'full'
        ? '药力已至上限,这一颗白费了'
        : overflow === 'partial'
          ? '药力已至上限,这一颗只延续到顶'
          : '药力化开,状态加身'
    )
  }
  track('pillsUsed')
  // Phase 32.5:「不假外物」之誓在按下这一刻就落空,不必等到转世才被告知
  noteTaboo('pill')
  collect('pill', id)
  playSfx('success')
  ui.toast(`服下「${def.name}」,${lines.join(',') || '药力温养周身'}`, 'success')
  return true
}

/** 炼丹消耗 */
export function pillCraftCost(id: string): { herb: number; stone: GNum } | null {
  const def = pillDef(id)
  if (!def?.recipe) return null
  /**
   * 灵石开销按这张方子**准入境界能拿到的最高层级**折算。
   *
   * 从前这里自写 `minRealm × 2 + 1`,界外就飞出区域表了:第 18 境的方子算出层级 37,
   * 而玩家在混沌海能到的最高层级是 32 —— 一张方子的价格凭空高出 322 倍(1.9^5),
   * 于是界外炼丹被自己的报价挡在门外(ISS-211)。层级只有一个事实源:区域表。
   */
  const tier = maxTierForMajor(def.minRealm)
  return { herb: def.recipe.herb, stone: stoneByTier(tier, def.recipe.stoneBase / 10) }
}

/**
 * 当前看得见的丹方 —— 你知道的,不是你够级的。
 * 炸炉风险由 craftability 呈现给玩家自行判断,这里不代玩家做决定。
 */
export function availableRecipes(): string[] {
  return knownRecipes().map(p => p.id)
}

/**
 * 失手时按技艺随机保下的残料比例:手越稳,赔得越少。
 *
 * 导出供 core/pillValue.ts 折算炼制代价 —— 那边若另抄一份,两处口径迟早分叉。
 */
export function salvageRatio(skill: number): number {
  return 0.2 + 0.3 * Math.min(1, skill / 100)
}

/** 开炉长的本事:成功长得快,失败也长——只是慢些,且偏向补最欠缺的一环 */
function gainCraftExp(skills: Readonly<Partial<Record<SkillId, number>>>, rank: number, succeeded: boolean): void {
  const lore = useLoreStore()
  const base = (succeeded ? 10 : 6) * (1 + rank * 0.35)
  for (const [k, w] of Object.entries(skills)) {
    if (w === undefined) continue
    lore.addSkillExp(k as SkillId, base * w)
  }
}

export interface CraftOutcome {
  ok: boolean
  /** 出丹数;失败为 0 */
  count: number
  /** 未开炉(材料不足/不知此方)时为 true —— 与"开炉失败"是两回事 */
  aborted?: boolean
}

/**
 * 炼制丹药。
 *
 * 失败不是白费:料照赔(按技艺保下一部分),但技艺照长,
 * 而且失手对灵材的印象比顺手时更深(见 noteMaterialUsed)。
 */
export function craftPill(id: string): CraftOutcome {
  const resources = useResourcesStore()
  const inventory = useInventoryStore()
  const ui = useUiStore()
  const def = pillDef(id)
  const able = craftability(id)
  const cost = pillCraftCost(id)
  if (!def || !cost || !able) return { ok: false, count: 0, aborted: true }

  /**
   * 开一次炉:门槛、材料、成败与双成由库同一次判定给出(见 core/engineCraft)。
   * **"没开炉"与"开炉失败"从这里开始就是两件事** —— 前者什么都不发生,
   * 后者要扣料、长技艺、记失败。
   */
  const canPay = resources.hasSmall('herb', cost.herb) && resources.hasStone(cost.stone)
  const roll = runCraft(id, { pillId: id, canPay }, rng)
  if (!roll.fired) {
    ui.toast(roll.reason, 'warn')
    return { ok: false, count: 0, aborted: true }
  }
  const craft = recipeCraft(def)
  const succeeded = roll.succeeded

  // 无论成败,炉先开了,料先下了 —— 扣多少照回报记账,不再自己算一遍
  resources.spendStone(spentOf(roll, 'stone') as GNum)
  resources.spendSmall('herb', spentOf(roll, 'herb') as number)

  gainCraftExp(craft?.skills ?? {}, able.rank, succeeded)
  for (const mid of able.materials) noteMaterialUsed(mid, succeeded)

  if (!succeeded) {
    // 炸炉长记性:这张方子反而更熟了一点
    useLoreStore().addRecipeMastery(id, 0.02)
    track('pillsFailed')
    playSfx('fail')
    ui.toast(failLine(able.weakness), 'warn')
    return { ok: false, count: 0 }
  }

  const extra = roll.extra
  inventory.addPill(id, roll.produced)
  track('pillsCrafted', roll.produced)
  collect('pill', id)
  playSfx('success')
  ui.toast(extra ? `丹成两枚!「${def.name}」品相极佳` : `炼成「${def.name}」×${roll.produced}`, extra ? 'rare' : 'success')
  return { ok: true, count: roll.produced }
}

/** 炸炉话术:优先复述最要命的那条短板,让玩家知道该补什么 */
function failLine(weakness: readonly string[]): string {
  const reason = weakness[0]
  return reason ? `炉中一声闷响,丹毁了。${reason}` : '炉中一声闷响,丹毁了——火候差了那么一线。'
}
