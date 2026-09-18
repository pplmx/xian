/**
 * 掉落服务 —— 战斗胜利后的奖励结算
 */
import type { ArtifactDef, EquipmentInstance, GNum, RegionDef } from '@/types'
import { rng } from '@/utils/random'
import { gnZero, isZero } from '@/utils/gnum'
import { formatGN } from '@/utils/format'
import { qualityDef } from '@/data/qualities'
import { equipmentTemplate } from '@/data/equipment'
import { PILLS } from '@/data/pills'
import { ARTIFACTS, artifactDef } from '@/data/artifacts'
import {
  ARTIFACT_DROP_CHANCE,
  BATTLE_EXP_SECS,
  EQUIP_DROP_CHANCE,
  INSTANT_EXP_LAYER_CAP,
  PAGE_DROP_CHANCE,
  PILL_DROP_CHANCE
} from '@/data/constants'
import { generateEquipment } from './equipGen'
import { createIntake } from 'wanxiang-engine'
import { expFromSecs, stoneByTier } from './formulas'
import { modOf } from './statsCalc'
import { personalityEffects } from './petPersonality'
import { compareEvictable, keepVerdict, shouldAutoRecycle, smartKeepEnabled } from './smartKeep'
import { salvageOf } from './salvage'
import { checkQualityAchievement, collect, track } from './progress'
import { harvestMaterials } from './loreService'
import { usePlayerStore } from '@/stores/player'
import { useResourcesStore } from '@/stores/resources'
import { useInventoryStore } from '@/stores/inventory'
import { useLoreStore } from '@/stores/lore'
import { useUiStore } from '@/stores/ui'

export interface DropSummary {
  /** 战报文案(含「战利品翻倍」这类提示) */
  lines: string[]
  /**
   * 本次**真正入账**的灵石 —— 与上面 addStone 的同一份数,不是另一处另算的期望值。
   * 从前历练会话自己按 stoneByTier(tier, 10×modeMult) 记了一份,漏了福缘、区域事件与
   * 首领倍率,于是「本次所得」和行囊里实际多出来的灵石对不上。
   */
  stone: GNum
  /** 本次真正入账的修为(与 gainExp 的同一份数) */
  exp: GNum
  /** 战报里的实物条数(残页/装备/丹药/法宝);「战利品翻倍」这类提示不算拾获 */
  items: number
}

export interface AcquireResult {
  /** 给人看的文案(战斗报告/事件/弹窗行) */
  line: string
  /** 是否真正入了行囊(未入 = 自动化尘或满包化尘) */
  bagged: boolean
  /** 本次拾取带来的器灵尘增量(化尘时为尘量,入包为 0) */
  dust: number
  /** 本次拾取带来的灵石返还(化尘时可能有 —— 被挤掉的旧件若练过) */
  stone: GNum
}

/**
 * 装备入账漏斗 —— **唯一的一处**(历练 / 离线 / 际遇 / 秘境 / 镇压 / 开局馈赠都走它)。
 *
 * 顺序交给库的入库层(见 packages/engine 的 intake),本作只给它四个函数:
 *   witness   先记见闻(化尘的那件也是"见过" —— 图鉴收录因此不必另设埋点);
 *   accept    自动回收的裁决(总闸关着时一律照收;forceKeep 直接跳过);
 *   evictable 满了要不要腾位、挤掉谁(只有值得留的新件才腾);
 *   fallback  折算(与手动分解同一条账:底材 + 强化投入八成)。
 */
const EQUIP_INTAKE = createIntake<EquipmentInstance, { dust: number; stone: GNum }>({
  holding: {
    add: (holding, item) => {
      const inventory = useInventoryStore()
      return inventory.addEquipment(item)
        ? { ok: true, holding: { items: inventory.items } }
        : { ok: false, holding, reason: 'full' }
    },
    isFull: () => useInventoryStore().bagFull,
    remove: (holding, uid) => {
      const removed = holding.items.find(it => it.uid === uid)
      useInventoryStore().removeEquipment(uid)
      return { holding: { items: useInventoryStore().items }, removed }
    }
  },
  accept: inst => !shouldAutoRecycle(inst),
  evictable: (items, incoming) => {
    if (!smartKeepEnabled() || !keepVerdict(incoming).keep) return undefined
    const equipped = useInventoryStore().equippedUids
    return items.filter(it => !equipped.has(it.uid) && !it.locked && !keepVerdict(it).keep).sort(compareEvictable)[0]
  },
  witness: inst => {
    const q = qualityDef(inst.quality)
    useLoreStore().noteEquipSeen(inst.templateId, q.rank, inst.tier)
    track('equipsGained')
    collect('equip', inst.templateId)
    checkQualityAchievement(q.rank)
  },
  fallback: inst => {
    const gain = salvageOf(inst)
    const resources = useResourcesStore()
    resources.addSmall('dust', gain.dust)
    resources.addStone(gain.stone)
    const tail = isZero(gain.stone) ? `化作器灵尘×${gain.dust}` : `化作器灵尘×${gain.dust} · 退灵石 ${formatGN(gain.stone)}`
    return { line: tail, yield: { dust: gain.dust, stone: gain.stone } }
  }
})

/**
 * 拾取一件已生成的装备:入包或折算。
 *
 * 无论在线(战斗掉落 / 事件 / 镇压)还是离线(挂机结算),都走这一个漏斗 ——
 * 见证、裁决、腾位、折算的顺序见 `EQUIP_INTAKE`。
 */
export function acquireEquipment(inst: EquipmentInstance, opts: { quiet?: boolean; forceKeep?: boolean } = {}): AcquireResult {
  const { quiet = false, forceKeep = false } = opts
  const inventory = useInventoryStore()
  const ui = useUiStore()
  const q = qualityDef(inst.quality)
  const t = equipmentTemplate(inst.templateId)
  const label = `${q.name}·${t?.name ?? '不明之物'}`

  const result = EQUIP_INTAKE.admit({ items: inventory.items }, inst, { force: forceKeep })
  const first = result.yields[0]
  const dust = first?.yield?.dust ?? 0
  const stone = first?.yield?.stone ?? gnZero()

  if (result.admitted) {
    if (result.evicted) {
      const oldName = equipmentTemplate(result.evicted.templateId)?.name ?? '旧物'
      return { line: `${label}(收纳规则腾位:${oldName}${first?.line ?? ''})`, bagged: true, dust, stone }
    }
    if (!quiet && q.rank >= 3) {
      ui.toast(`灵光乍现,拾得「${label}」`, 'rare')
    }
    return { line: label, bagged: true, dust: 0, stone: gnZero() }
  }
  const prefix = result.reason === 'rejected' ? '自动回收' : '行囊已满'
  return { line: `${label}(${prefix},${first?.line ?? ''})`, bagged: false, dust, stone }
}

/** 获得法宝:重复则折算悟道点 */
export function acquireArtifact(defId: string, quiet = false): string {
  const inventory = useInventoryStore()
  const resources = useResourcesStore()
  const ui = useUiStore()
  const def = artifactDef(defId)
  if (!def) return ''
  collect('artifact', defId)
  if (!inventory.addArtifact(defId)) {
    resources.addSmall('wudao', 10)
    return `法宝「${def.name}」(已拥有,化作悟道点×10)`
  }
  if (!quiet) ui.toast(`天降机缘!获得法宝「${def.name}」`, 'rare')
  return `法宝「${def.name}」`
}

/** 随机一件当前境界可用的掉落丹药 */
export function randomDropPill(major: number): string | null {
  const pool = PILLS.filter(p => p.minRealm <= major && !p.recipe)
  if (pool.length === 0) return null
  const picked = rng.weighted(pool, p => 100 / (1 + qualityDef(p.quality).rank * 2))
  return picked.id
}

/**
 * 就近加成的窗口与幅度:层级差 5 阶以内的法宝吃加成,同层级的那件最多 ×21。
 *
 * 幅度从 ×6 提到 ×21(Phase 38,品阶重排同日):品阶标签诚实化之后,人间界的旧物
 * 大批落在凡品上(品质权重 100,是神品的十三倍),而本界域之物顶多落在玄/地/天
 * (权重 14~10)。×6 的窗口压不住这个差,混沌海的池子又会变回「多半是墨玉葫芦」
 * (ISS-196 的老毛病)。窗口形状不变(仍是加法、仍是 5 阶),只把幅度提到能压住
 * 品质差为止 —— 实测 32 阶抽到仙界以上之物的比例:×6 时 0.40,×21 时 0.61,
 * 与品阶重排前(0.63)同一量级。旧物仍拿得到:它们按件数占多数,合计仍有近四成。
 */
export const ARTIFACT_NEAR_WINDOW = 5
export const ARTIFACT_NEAR_BONUS = 4

/**
 * 一件法宝在某个层级下的掉落权重。
 *
 * 池子始终是「fromTier ≤ 当前层级」的全部法宝 —— 高界走一趟也会捡到人间界的旧葫芦,
 * 这本身不算错(图鉴要补齐)。但若权重只按品质折算,层级越高越不对劲:
 * 品质权重让凡品(40)压过神品(7.7),于是到了混沌海,掉出来的多半还是墨玉葫芦,
 * 而本界域那几件反而撞不见 —— 新加的法宝谁也看不到,等于没加。
 *
 * 故在品质权重上加一层**就近加成**:越贴近当前层级越容易被抽中。
 * 用加法而非指数衰减,是为了不把旧法宝彻底关掉(图鉴里的旧格子仍点得亮)。
 */
export function artifactDropWeight(def: ArtifactDef, tier: number): number {
  const qualityWeight = 100 / (1 + qualityDef(def.quality).rank * 1.5)
  const distance = Math.max(0, tier - def.fromTier)
  return qualityWeight * (1 + ARTIFACT_NEAR_BONUS * Math.max(0, ARTIFACT_NEAR_WINDOW - distance))
}

/** 随机一件玩家层级可及的法宝(品质与就近加成共同定权重,见 artifactDropWeight) */
export function randomDropArtifact(tier: number): string | null {
  const pool = ARTIFACTS.filter(a => a.fromTier <= tier)
  if (pool.length === 0) return null
  return rng.weighted(pool, a => artifactDropWeight(a, tier)).id
}

/**
 * 概率输入钳到 [0,1]:rng.chance 不钳制(rand()<p),法宝 ×(isBoss?6:1)×(1+luck)、
 * doubleDropRate、书页/丹药倍率堆叠出界时,>1 会变成"必然掉落"、<0 会"永不掉落"。
 * 此处与 equipChance 的 Math.min(0.9, ...) 同一纪律:概率在进判定前先归一。
 */
function capChance(p: number): number {
  return Math.min(1, Math.max(0, p))
}

/** 战斗胜利掉落 */
export function afterWin(region: RegionDef, rewardMult: number, isBoss: boolean): DropSummary {
  const player = usePlayerStore()
  const resources = useResourcesStore()
  const inventory = useInventoryStore()
  const mods = player.finalStats.mods
  const lines: string[] = []
  let items = 0
  const tier = region.tier
  const bossMult = isBoss ? 4 : 1
  const doubled = rng.chance(capChance(modOf(mods, 'doubleDropRate'))) ? 2 : 1
  if (doubled === 2) lines.push('福缘深厚,战利品翻倍!')

  // 灵石
  const stoneAmt = rng.float(0.8, 1.2) * rewardMult * bossMult * doubled * (1 + modOf(mods, 'spiritStoneGain'))
  const stone = stoneByTier(tier, 10 * stoneAmt)
  resources.addStone(stone)

  /**
   * 战斗修为 —— 与丹药、际遇同一把尺子:等效闭关时长 × 各种倍率,封顶不满一层。
   *
   * 倍率仍然照旧:出行方式(收益 ×1/1.4/1.9)、首领 ×4、福缘 ×2、修为增益词条。
   * 它们是"这一场值多少"的相对刻度,不再改变"一场遭遇值多少"的量级。
   */
  const expSecs = BATTLE_EXP_SECS * rewardMult * (isBoss ? 4 : 1) * doubled * (1 + modOf(mods, 'expGain'))
  const exp = expFromSecs(player.expReq, expSecs, player.cultPerSec, INSTANT_EXP_LAYER_CAP)
  player.gainExp(exp)

  // 材料 —— 数量进标量库存,同时抽出"你到底捡到了什么"推进认知
  if (rng.chance(0.5)) {
    const n = rng.int(1, 3) * doubled
    resources.addSmall('herb', n)
    harvestMaterials(tier, 'herb', n)
  }
  if (rng.chance(0.35)) {
    const n = rng.int(1, 2) * doubled
    resources.addSmall('ore', n)
    harvestMaterials(tier, 'ore', n)
  }
  if (rng.chance(capChance(PAGE_DROP_CHANCE * rewardMult))) {
    const n = rng.int(1, 2) * doubled
    resources.addSmall('page', n)
    lines.push(`功法残页×${n}`)
    items += 1
  }

  // 装备 —— 品质 luck 并入灵兽性格的掉落倾向:
  // 贪宝(dropLuck>0)更易出稀有,谨慎(dropLuck<0)则稍稍寻常 —— 图鉴承诺,此处兑现
  const luck = modOf(mods, 'luck') + personalityEffects(player.petId).dropLuck
  const equipChance = EQUIP_DROP_CHANCE * rewardMult * (1 + modOf(mods, 'dropRate')) * (isBoss ? 2.5 : 1)
  for (let i = 0; i < doubled; i += 1) {
    if (rng.chance(Math.min(0.9, equipChance)) || (isBoss && i === 0)) {
      const inst = generateEquipment(tier, rng, { luck, minQualityRank: isBoss ? 1 : 0 })
      lines.push(acquireEquipment(inst).line)
      items += 1
    }
  }

  // 丹药
  if (rng.chance(capChance(PILL_DROP_CHANCE * rewardMult * (isBoss ? 3 : 1)))) {
    const pillId = randomDropPill(player.major)
    if (pillId) {
      inventory.addPill(pillId, 1)
      collect('pill', pillId)
      const def = PILLS.find(p => p.id === pillId)
      lines.push(`丹药「${def?.name ?? ''}」`)
      items += 1
    }
  }

  // 法宝(稀有)——(1+luck) 可被叠加的 luck 推高,必须进判定前归一到 [0,1](ISS-030)
  if (rng.chance(capChance(ARTIFACT_DROP_CHANCE * (isBoss ? 6 : 1) * (1 + luck)))) {
    const artId = randomDropArtifact(tier)
    if (artId) {
      lines.push(acquireArtifact(artId))
      items += 1
    }
  }

  return { lines, stone, exp, items }
}
