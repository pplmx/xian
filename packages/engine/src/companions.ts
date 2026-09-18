/**
 * 伙伴 / 随从 —— 「带谁上路,路就变成什么样」。
 *
 * 伙伴在数值之外还带**行为倾向**:有的更易撞上稀有之物、有的走得更稳、
 * 有的专挑险路、有的谨慎避祸。它们不是"哪件装备更强"的比较,而是**选一种走法** ——
 * 故引擎把它建模成两件分开的东西:
 *
 *   伙伴(companion)  自身的词条(与装备同一种表达)
 *   性格(trait)      一组**行为系数**:历练时长、危险度、掉落运气、战败损失……
 *                    键名由作品自己定,引擎只负责"取谁的性格、叠加在中性值上"
 *
 * 中性值(`neutral`)必须由作品给:倍率类的中性是 1、加法类的中性是 0,
 * 引擎猜不出来 —— 猜错就会出现"没带伙伴反而更快/更穷"这种没人能一眼看出的偏差。
 *
 * 作品常见的用法是"一次只带一只",但引擎不限制数量:`activeMods(ids)` 接受任意个,
 * 要不要限制是玩法层的事。
 */
import type { Mods } from './attributes'

/** 一条性格:一组行为系数 */
export interface TraitDef {
  id: string
  name?: string
  desc?: string
  /** 键 → 系数/增量;**绝对取值**,不是相对中性的增量 */
  mods: Record<string, number>
}

export interface CompanionDef {
  id: string
  name: string
  /** 所属性格;省略即"没有性格"(取中性) */
  traitId?: string
  /** 伙伴自身的词条 */
  mods?: Mods
  /** 分类标签(元素/阵营/稀有度之类),引擎只存不判 */
  tags?: readonly string[]
}

export interface CompanionConfig {
  companions: CompanionDef[]
  traits: TraitDef[]
  /**
   * 中性基线 —— 每一个可能出现在性格表里的键都要有一个中性值。
   * 没有伙伴(或伙伴没性格)时返回它;返回的是拷贝,调用方改不动配置。
   */
  neutral: Record<string, number>
  /**
   * 多只伙伴的性格系数怎么合(默认 `override`):
   *
   *   `override`     —— 后一只有性格就覆盖该键(原来唯一的行为)。
   *                     好处是不会冒出 1.05×1.1 这种没人预期过的数。
   *   `add-relative` —— 各自**相对中性**的那一份相加:
   *                     倍率类 1 + (0.05 + 0.10) = 1.15;加法类 0 + (0.06 + 0.02) = 0.08。
   *                     同一个开关对两类键都成立,故不必为它们各写一套。
   */
  stack?: 'override' | 'add-relative'
}

export interface CompanionSystem {
  readonly defs: readonly CompanionDef[]
  readonly traits: readonly TraitDef[]
  def(id: string): CompanionDef | undefined
  trait(id: string): TraitDef | undefined
  /** 某伙伴的性格系数(与中性基线合并后的**完整**一组);null/未知 → 中性 */
  effectsOf(id: string | null): Record<string, number>
  /** 某伙伴自身的词条(不叠加性格) */
  modsOf(id: string | null): Mods
  /** 伙伴自身词条 + 性格系数合并(可带多只;重复 id 只算一次) */
  activeMods(ids: readonly (string | null)[]): Record<string, number>
}

export function createCompanionSystem(config: CompanionConfig): CompanionSystem {
  const defs = [...config.companions]
  const traits = [...config.traits]
  const byId = new Map<string, CompanionDef>()
  const traitById = new Map<string, TraitDef>()
  for (const c of defs) {
    if (byId.has(c.id)) throw new Error(`伙伴系统:id 重复 —— ${c.id}`)
    byId.set(c.id, c)
  }
  for (const t of traits) {
    if (traitById.has(t.id)) throw new Error(`伙伴系统:性格 id 重复 —— ${t.id}`)
    traitById.set(t.id, t)
  }
  for (const c of defs) {
    if (c.traitId !== undefined && !traitById.has(c.traitId)) {
      throw new Error(`伙伴系统:${c.id} 指向未定义的性格 —— ${c.traitId}`)
    }
  }
  const neutral = { ...config.neutral }
  const stack = config.stack ?? 'override'
  for (const t of traits) {
    for (const key of Object.keys(t.mods)) {
      if (!(key in neutral)) {
        throw new Error(`伙伴系统:性格 ${t.id} 用了没有中性值的键 —— ${key};请把它加进 neutral`)
      }
    }
  }

  const effectsOf = (id: string | null): Record<string, number> => {
    const out: Record<string, number> = { ...neutral }
    const trait = id === null ? undefined : traitById.get(byId.get(id)?.traitId ?? '')
    if (!trait) return out
    for (const [key, value] of Object.entries(trait.mods)) out[key] = value
    return out
  }

  const modsOf = (id: string | null): Mods => {
    if (id === null) return {}
    return { ...(byId.get(id)?.mods ?? {}) }
  }

  const activeMods = (ids: readonly (string | null)[]): Record<string, number> => {
    const out: Record<string, number> = { ...neutral }
    const seen = new Set<string>()
    for (const id of ids) {
      if (id === null || seen.has(id)) continue
      seen.add(id)
      const trait = traitById.get(byId.get(id)?.traitId ?? '')
      if (trait) {
        for (const [key, value] of Object.entries(trait.mods)) {
          out[key] =
            stack === 'add-relative' ? (out[key] ?? neutral[key] ?? 0) + (value - (neutral[key] ?? 0)) : value
        }
      }
      const own = byId.get(id)?.mods
      for (const [key, value] of Object.entries(own ?? {})) {
        if (typeof value !== 'number') continue
        out[key] = (out[key] ?? 0) + value
      }
    }
    return out
  }

  return { defs, traits, def: id => byId.get(id), trait: id => traitById.get(id), effectsOf, modsOf, activeMods }
}
