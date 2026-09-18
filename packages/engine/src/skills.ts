/**
 * 技能 / 功法 —— 「学一部、养到满级、满级再择一条路」这件事的通用骨架。
 *
 * 三条与具体作品无关的规则:
 *
 *   一 **等级曲线**:第 N 级的词条 = 基础词条 + 每级词条 × (N-1)。
 *      基础是"入门就会的",每级是"练出来的" —— 两者分开写,调平衡时才分得清
 *      "它本来就这么强"与"练满才有这么强"。
 *   二 **升级消耗按曲线算**:每项消耗一条 `{ 基数 × 倍率^等级 + 每级线性 }` 的式,
 *      可带折扣(功法折扣、活动期之类由调用方给)。
 *   三 **满级分支**:一部功法修满后可择一条路,追加一组词条;择定之后不再改。
 *      引擎只负责"这条路给什么",至于"什么时候能择、能不能改",由玩法层决定。
 *
 * 装配汇总返回的是**一组来源**(每部功法一份),而不是一个加总 ——
 * 因为作品侧通常还要过一遍自己的合并规则(递减、软上限),加总就把那层信息丢了。
 */
import type { Mods } from './attributes.js'

/** 一条升级消耗:`基数 × 倍率^等级 + 每级线性`,再乘折扣,最后向上取整 */
export interface SkillCostSpec {
  /** 资源名(悟道点、残页、金币……) */
  key: string
  /**
   * 自己接管这一项的数额(**可选**):给了它,base/growth/levelStep 全部忽略,
   * 只保留折扣与下限。手里有张手调的价目表时用它。
   */
  amount?: (level: number) => number
  /** 基数;默认 0 */
  base?: number
  /** 每级倍率;默认 1(不随等级涨) */
  growth?: number
  /** 与等级线性相关的部分;默认 0 */
  levelStep?: number
  /**
   * 是否吃折扣;默认 true。
   *
   * 现实里一组消耗常常**只有一部分**打折 —— 本作是"悟道点可折、残页不打折"。
   * 若把折扣一刀切地乘到所有项上,省下的是几行配置,换来的是一处静默的平衡漂移。
   */
  discountable?: boolean
  /** 折扣后的下限;默认 1 */
  min?: number
}

/** 满级之后可择的一条路 */
export interface SkillBranchDef {
  id: string
  name?: string
  /** 选了它追加的词条 */
  mods: Mods
  desc?: string
  /**
   * 前置分支(**可选**):要能选它,这些分支必须**已经选过**。
   *
   * 用于"先走某条道才解锁另一条"的谱系(例:先悟"悟理"才能再悟"观微")。
   * 引擎只回答"这一条现在能不能选",至于"一次能选几条、能不能反悔"归玩法层。
   */
  requires?: readonly string[]
}

export interface SkillDef {
  id: string
  name: string
  /** 分类标签(主修 / 辅修 / 秘术……);引擎不当它是规则,只当标签 */
  kind?: string
  maxLevel: number
  /** 第 1 级就有的词条 */
  baseMods?: Mods
  /** 每升一级追加的词条 */
  perLevelMods?: Mods
  /**
   * 自己接管"某等级给什么词条"(**可选**):给了它,baseMods/perLevelMods 全部忽略。
   *
   * 线性成长(基础 + 每级 ×(N-1))覆盖大多数情况,但"前段猛、后段缓""到某级突然开窍"
   * 这类手感需要别的形状 —— 直接给函数,不必把曲线硬掰成两段。
   */
  modsFn?: (level: number) => Mods
  /** 学习门槛(等级序号之类);引擎只存不判,由玩法层决定何时可用 */
  requiredLevel?: number
  /** 升级消耗:按上面的曲线算 */
  costs?: SkillCostSpec[]
  /** 满级可择的路 */
  branches?: SkillBranchDef[]
  desc?: string
}

export interface SkillConfig {
  skills: SkillDef[]
}

/** 一部功法当前的状态:学到第几级、选了哪条路 */
export interface SkillState {
  skillId: string
  level: number
  branchId?: string
}

export interface SkillSystem {
  readonly defs: readonly SkillDef[]
  def(id: string): SkillDef | undefined
  /**
   * 某等级的词条。
   *
   * 与上游工程同口径:先铺 `baseMods`,再对每个 `perLevelMods` 键加
   * `值 × max(0, 等级-1)` —— 于是**只有 perLevelMods 里出现的键,在 1 级时也会以 0 出现**。
   * 这不是疏忽:面板要能显示"这一条要练上去才有"。
   */
  modsAt(id: string, level: number): Mods
  /** 从 level 升到 level+1 的消耗;满级返回空数组 */
  costAt(id: string, level: number, opts?: { discount?: number }): { key: string; amount: number }[]
  /** 满级可择的路 */
  branchesOf(id: string): readonly SkillBranchDef[]
  /**
   * 此刻**可以选**的分支:排除掉前置没满足的那些。
   *
   * `chosen` 是已经选过的分支 id(**所有技能共用一个集合**,故跨技能的前置也表达得出来)。
   * 前置指向不存在的分支时按"永远选不了"处理 —— 那是内容写错,不该静默当成满足。
   */
  availableBranches(id: string, chosen: readonly string[]): SkillBranchDef[]
  /** 选了某条路之后追加的词条(找不到就空) */
  branchMods(id: string, branchId: string): Mods
  /** 装配汇总:**每部功法一份来源**(供作品侧再过一遍自己的合并规则) */
  sourcesOf(states: readonly SkillState[]): Mods[]
}

export function createSkillSystem(config: SkillConfig): SkillSystem {
  const defs = [...config.skills]
  const byId = new Map<string, SkillDef>()
  for (const d of defs) {
    if (byId.has(d.id)) throw new Error(`技能系统:id 重复 —— ${d.id}`)
    if (!Number.isInteger(d.maxLevel) || d.maxLevel < 1) throw new Error(`技能系统:${d.id} 的 maxLevel 必须是 ≥1 的整数`)
    byId.set(d.id, d)
  }

  const modsAt = (id: string, level: number): Mods => {
    const def = byId.get(id)
    if (!def) return {}
    const lv = Math.max(1, Math.floor(level))
    if (def.modsFn) return { ...def.modsFn(lv) }
    const out: Mods = {}
    for (const k in def.baseMods) {
      const v = def.baseMods[k]
      if (typeof v === 'number') out[k] = v
    }
    for (const k in def.perLevelMods) {
      const per = def.perLevelMods[k]
      if (typeof per !== 'number') continue
      out[k] = (out[k] ?? 0) + per * Math.max(0, lv - 1)
    }
    return out
  }

  const costAt = (id: string, level: number, opts: { discount?: number } = {}): { key: string; amount: number }[] => {
    const def = byId.get(id)
    if (!def) return []
    const lv = Math.max(1, Math.floor(level))
    if (lv >= def.maxLevel) return []
    const discount = Math.min(1, Math.max(0, opts.discount ?? 0))
    return (def.costs ?? []).map(spec => {
      const base = spec.base ?? 0
      const growth = spec.growth ?? 1
      const step = spec.levelStep ?? 0
      const factor = spec.discountable === false ? 1 : 1 - discount
      const raw = (spec.amount ? spec.amount(lv) : base * Math.pow(growth, lv) + step * lv) * factor
      return { key: spec.key, amount: Math.max(spec.min ?? 1, Math.ceil(raw)) }
    })
  }

  const branchesOf = (id: string): readonly SkillBranchDef[] => byId.get(id)?.branches ?? []

  const knownBranchIds = new Set(defs.flatMap(d => (d.branches ?? []).map(b => b.id)))

  const availableBranches = (id: string, chosen: readonly string[]): SkillBranchDef[] => {
    const picked = new Set(chosen)
    return branchesOf(id).filter(branch =>
      (branch.requires ?? []).every(req => knownBranchIds.has(req) && picked.has(req))
    )
  }

  const branchMods = (id: string, branchId: string): Mods => {
    const branch = branchesOf(id).find(b => b.id === branchId)
    return branch ? { ...branch.mods } : {}
  }

  const sourcesOf = (states: readonly SkillState[]): Mods[] => {
    const out: Mods[] = []
    for (const st of states) {
      if (!byId.has(st.skillId)) continue
      out.push(modsAt(st.skillId, st.level))
      if (st.branchId !== undefined) {
        const branch = branchMods(st.skillId, st.branchId)
        if (Object.keys(branch).length > 0) out.push(branch)
      }
    }
    return out
  }

  return { defs, def: id => byId.get(id), modsAt, costAt, branchesOf, availableBranches, branchMods, sourcesOf }
}
