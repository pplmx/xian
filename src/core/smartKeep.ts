/**
 * 智能收纳(Phase 26)—— 行囊的自动去留裁决
 * 不只按品质:识别流派核心件与组合技关键件——
 * 「这件装备单看一般,但它是你罡盾·反震组合技的关键部件」
 *
 * 另外三类**永不自动处置**(玩家没说可以扔,就不能替他扔):
 *   练过的件 —— 强化过 / 重铸过 / 封存过词条的,身上有他的投入,只有本人能决定;
 *   成套共鸣件 —— 机制 > 数值,凑不齐第二件才是真亏;
 *   词条近满件 —— 条条都在满值线以上,数值本就高过同档。
 */
import type { EquipmentInstance } from '@/types'
import { compareBy, createTriage } from 'wanxiang-engine'
import { qualityDef } from '@/data/qualities'
import { SMART_KEEP_PERFECT_ROLL } from '@/data/constants'
import { equipmentTemplate } from '@/data/equipment'
import { BUILD_STYLES, detectBuild } from './buildDetect'
import { matchComboArt } from '@/data/comboArts'
import { equipSetDef } from './equipSet'
import { resolveEquipStats } from './equipGen'
import { usePlayerStore } from '@/stores/player'
import { useSettingsStore } from '@/stores/settings'

export interface SmartKeepConfig {
  enabled: boolean
  /** 达到此品质 rank 一律保留 */
  minQuality: number
  /**
   * 低于此**阶级**一律回收(0 = 关)。与品质下限是两条独立的「废料定义」。
   *
   * 为什么要它:品质下限管"这一件成色如何",阶级下限管"这一件是哪一界的旧物"。
   * 到元婴期,一件凡品 7 阶与一件精品 5 阶都是废料,而天品 12 阶在真仙期同样是废料 ——
   * 只按品质裁,玩家得逐档去猜"哪一档现在算旧";按阶级裁,一句"12 阶以下全清"就够。
   * 它是**无条件**的(与玩家的原话一致:多少阶以下的全都回收),故排在缘分规则之前;
   * 但**动不了练过的件** —— 身上有投入的东西不属于自动裁决的管辖范围(见下)。
   */
  minTier: number
  /**
   * 线下的件不看缘分,一律回收(默认关)。
   *
   * 这是「一键分解勾选档」那股需求的**正确归宿**:从前它藏在另一个弹窗里,
   * 而且排在保留规则之前 —— 于是出现「保留线设在灵品,玄品却被自动回收」这种打架
   * (玩家实测)。自动化的政策只能在**这一个**弹窗里说,且必须排在保留线之后:
   * 线上的件永远不因它被回收。
   */
  junkBelowLine: boolean
  /** 保留含当前主流派核心词条的装备 */
  keepCoreAffix: boolean
  /** 保留可能促成组合技的副体系件 */
  keepComboPiece: boolean
  /** 保留词条条条近满的件 */
  keepPerfectRolls: boolean
  /** 保留成套共鸣件 */
  keepSetPiece: boolean
}

/**
 * 按当前规则体检行囊 —— 给界面用的**读数**(与裁决同一口径,不在界面里另算)。
 *
 * 收纳规则的可怕之处在于"看不见" :玩家打开弹窗只看到一排开关,不知道关掉某一项
 * 会让多少件东西被扔。故这里把结果摊成三栏:留下几件、化尘几件、每一条规则各判掉多少 ——
 * 调开关时数字跟着动,「这一下按下去会扔什么」就不再是盲盒。
 */
export interface SmartKeepImpact {
  /** 行囊内未上锁的件数(上锁不参与自动裁决) */
  candidates: number
  keep: number
  recycle: number
  /** 化尘原因 → 件数(按"谁先命中谁负责"计,与裁决顺序一致) */
  byReason: { reason: string; count: number }[]
}

export function smartKeepImpact(items: EquipmentInstance[]): SmartKeepImpact {
  // 读数与裁决共用同一条链(库那边同一个 `decide`),不在界面里另算一遍
  // 上锁的件不参与自动裁决 —— 与旧口径一致:它在裁决之外,连候选都不算
  const impact = TRIAGE.impact(items.filter(item => !item.locked))
  return { candidates: impact.candidates, keep: impact.keep, recycle: impact.junk, byReason: impact.byReason }
}

export interface KeepVerdict {
  keep: boolean
  reason: string
}

/**
 * 裁决链 —— **顺序与读数交给库的分流层**(见 packages/engine 的 triage),
 * 判据与文案仍是本作的内容:哪条规则先问、凭什么留、凭什么扔,都写在这里。
 *
 * 三条顺序上的教训(都是实测撞出来的)已经固化在下面的排列里:
 *   一 练过的件最先豁免 —— 身上有玩家的投入,不属于自动裁决的管辖;
 *   二 阶级下限与品质下限是两条独立的"废料定义",阶级那条排在缘分之前;
 *   三 成套件与词条近满不看流派,排在新档"道途未成"之前。
 */
const TRIAGE = createTriage<EquipmentInstance>({
  rules: [
    {
      id: 'investment',
      label: '已淬养,留待你自己定夺',
      decide: item => (hasInvestment(item) ? { keep: true, reason: '已淬养,留待你自己定夺' } : undefined)
    },
    {
      id: 'tierFloor',
      label: '往下看层级',
      decide: item => {
        const cfg = useSettingsStore().smartKeep
        if (cfg.minTier > 0 && item.tier < cfg.minTier) return { keep: false, reason: `低于 ${cfg.minTier} 阶` }
        return undefined
      }
    },
    {
      id: 'qualityLine',
      label: '往上看成色',
      decide: item => {
        const cfg = useSettingsStore().smartKeep
        const q = qualityDef(item.quality)
        return q.rank >= cfg.minQuality ? { keep: true, reason: `${q.name}当藏` } : undefined
      }
    },
    {
      id: 'junkBelowLine',
      label: '线下不看缘分',
      decide: () => (useSettingsStore().smartKeep.junkBelowLine ? { keep: false, reason: '线下不看缘分' } : undefined)
    },
    {
      id: 'setPiece',
      label: '成套共鸣件',
      decide: item => {
        if (!useSettingsStore().smartKeep.keepSetPiece) return undefined
        const setId = equipmentTemplate(item.templateId)?.set
        return setId ? { keep: true, reason: `「${equipSetDef(setId)?.name ?? '成套'}」套件` } : undefined
      }
    },
    {
      id: 'perfectRolls',
      label: '词条近满',
      decide: item =>
        useSettingsStore().smartKeep.keepPerfectRolls && perfectRolls(item) ? { keep: true, reason: '词条近满' } : undefined
    },
    {
      id: 'build',
      label: '看这一件与你的道途有没有关系',
      decide: item => {
        const cfg = useSettingsStore().smartKeep
        const build = detectBuild(usePlayerStore().finalStats.mods)
        // 新档还没形成流派:到此为止,唯品质论(与"与道无缘"是两句不同的话)
        if (!build) return { keep: false, reason: '道途未成,唯品质论' }
        const mods = resolveEquipStats(item).mods
        if (cfg.keepCoreAffix) {
          for (const key of Object.keys(build.style.core)) {
            if ((mods[key as keyof typeof mods] ?? 0) > 0) return { keep: true, reason: `含${build.style.name}核心词条` }
          }
        }
        if (cfg.keepComboPiece) {
          for (const style of BUILD_STYLES) {
            if (style.id === build.style.id) continue
            const art = matchComboArt(build.style.id, style.id)
            if (!art) continue
            for (const key of Object.keys(style.core)) {
              if ((mods[key as keyof typeof mods] ?? 0) > 0) return { keep: true, reason: `「${art.name}」组合技部件` }
            }
          }
        }
        return undefined
      }
    }
  ],
  fallback: { keep: false, reason: '与道无缘' }
})
/**
 * 自动回收裁决 —— 装备进包前的第一道闸
 * **智能收纳是总闸**:没开,装备一律不替你扔 —— 历练/挂机掉落的凡俗之物也照常入包。
 * 开启后,命中任一条、该件不入行囊、直接化尘(在线离线统一):
 *   1. 玩家在「一键分解」里勾选的品质档(显式废料声明,开启收纳后才生效)
 *   2. 判「与道无缘」
 * 上锁者豁免。
 */
export function shouldAutoRecycle(item: EquipmentInstance): boolean {
  if (item.locked) return false
  const settings = useSettingsStore()
  if (!settings.smartKeep.enabled) return false
  /**
   * 这里从前还有一条「一键分解勾选档一律回收」,排在所有保留规则之前。
   *
   * 它造成的实测事故:玩家在「智能收纳」里把保留线设在灵品,而「一键分解」的勾选
   * 里勾过玄品 —— 玄品在保留线**之上**,照旧被扔。两个弹窗都能管同一件事,
   * 而玩家只记得自己设过的那个。现在自动回收的**唯一政策入口是本配置**
   * (junkBelowLine 承接"线下不看缘分"那股需求),「一键分解」只管手动批量那一次。
   */
  return !TRIAGE.decide(item).keep
}

/** 身上有没有玩家的投入(强化 / 重铸 / 封存词条)—— 有则不参与一切自动去留 */
export function hasInvestment(item: EquipmentInstance): boolean {
  return item.level > 0 || (item.reforgeCount ?? 0) > 0 || (item.sealedAffixIds ?? []).length > 0
}

/** 词条是否条条都在满值线以上(0 词条的件不算 —— 那是没得夸,不是满值) */
export function perfectRolls(item: EquipmentInstance): boolean {
  return item.affixes.length > 0 && item.affixes.every(a => a.roll >= SMART_KEEP_PERFECT_ROLL)
}

/** 判定一件装备是否值得收纳 */
export function keepVerdict(item: EquipmentInstance): KeepVerdict {
  // 对外形状不变(调用方只要 keep 与理由);"是哪一条规则判的"在 TRIAGE.decide 里,
  // 界面哪天想显示规则名再取(现在不显示,就不往公开形状里塞)。
  const { keep, reason } = TRIAGE.decide(item)
  return { keep, reason }
}

/**
 * 行囊满时该挤掉谁:品质最低 → 层级最低 → 词条最弱。
 * (练过的件根本进不了候选 —— 见 keepVerdict 的第一条。)
 */
export function compareEvictable(a: EquipmentInstance, b: EquipmentInstance): number {
  return EVICT_ORDER(a, b)
}

function rollSum(item: EquipmentInstance): number {
  return item.affixes.reduce((s, x) => s + x.roll, 0)
}

/**
 * 行囊满时先挤掉谁:成色最低 → 层级最低 → 词条最弱。
 *
 * 三层依次比由库的 `compareBy` 串起来(前一层分出胜负就不再看下一层);
 * "先比什么"仍是本作的口径 —— 换个游戏可能先比"有没有被强化过"。
 */
const EVICT_ORDER = compareBy<EquipmentInstance>(
  (a, b) => qualityDef(a.quality).rank - qualityDef(b.quality).rank,
  (a, b) => a.tier - b.tier,
  (a, b) => rollSum(a) - rollSum(b)
)

/** 是否启用智能收纳 */
export function smartKeepEnabled(): boolean {
  return useSettingsStore().smartKeep.enabled
}
