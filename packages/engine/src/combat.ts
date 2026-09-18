/**
 * 战斗解算 —— 副本系统的下半场:一场遭遇要能分出胜负,掉落与通关才有意义。
 *
 * 这是一套**够用的回合制骨架**,不是唯一的战斗规则:
 * 先手看速度、命中闪避按概率、暴击按暴击率与暴击伤害、吸血/减伤/回复各自生效、
 * 敌人技能按触发率插入。数值全部来自属性系统,故换皮(改属性名)不需要改这里。
 *
 * 设计上刻意"一次算完再回放":结算先跑完,日志只是记录。
 * 这样离线收益、批量模拟与界面播放共用同一份结果,不会出现两次算不一样的情况。
 */
import type { Mods } from './attributes.js'
import type { Numeric } from './numeric.js'
import { numberNumeric } from './numeric.js'
import type { Rng } from './rng.js'
import type { EnemySkillDef } from './dungeons.js'

/**
 * 战斗读哪几个键 —— **键名由作品定**。
 *
 * 默认是 `attack / defense / hp / maxHp / speed`,这是引擎的接口词;
 * 而一款游戏的"攻防血"叫火力/装甲/结构值,还是专注力/耐心/精力,都无所谓 ——
 * 把它们指过来即可,战斗逻辑一行不用改。
 */
export interface CombatKeys {
  /** 攻击键;默认 'attack' */
  attack?: string
  /** 防御键;默认 'defense' */
  defense?: string
  /** 当前生命键;默认 'hp' */
  hp?: string
  /** 生命上限键;默认 'maxHp' */
  maxHp?: string
  /** 先手键;默认 'speed' */
  speed?: string
}

export interface Combatant<T> {
  id: string
  name: string
  /** 本值表:键名由作品定,靠 `BattleConfig.keys` 告诉引擎哪个是攻/防/血/先手 */
  stats: Record<string, T>
  /** 词条(百分比/独立加成)—— 键名沿用引擎约定(见属性系统) */
  mods: Mods
  skills?: EnemySkillDef[]
}

export interface BattleConfig {
  /** 本值键名(默认 attack / defense / hp / maxHp / speed) */
  keys?: CombatKeys
  /**
   * 护盾池(**可选**,不配就没有"护盾"这回事)。
   *
   * 护盾先于生命挨打、总量有上限;溢出的治疗可以按比例转成护盾。
   * 这三条是从一款真实作品的战斗里抽出来的骨架 —— 与题材无关:
   * "护体灵光""能量护罩""体力缓冲"都是同一件事。
   */
  shield?: BattleShieldConfig
  /**
   * 反击与追击(**可选**,不配就不会有人反击)。
   *
   * 两者都读词条(默认 `counterRate`/`counterDamage`、`comboRate`/`comboDamage`):
   * 概率触发,打一记打折的出手,且这记**不会**再触发反击与追击(否则会链到天上)。
   */
  followups?: BattleFollowupConfig
  /**
   * 技能效果标签的**默认解释**(**可选**)。
   *
   * 库不认识 `multi / stun / drain / shield / bleed / pierce`(见 `EnemySkillDef.effect`),
   * 但可以给你一套"通行语义":多段追打、震慑跳过出手、吸取回血、给自己加盾、放血真伤、穿甲无视护盾。
   * 不配 → 标签仍然只是标签(与既有行为逐位一致);配了 → 这些标签按下面的参数执行。
   * 想完全自己解释,用 `skillEffectFn`(它优先于这里)。
   */
  skillEffects?: BattleSkillEffectsConfig | true
  /**
   * 每回合结束的回调(**可选**)。
   *
   * 给"要按回合推进的东西"一个落点:流血 / 中毒 / 灼烧、增益层数递减、冷却、
   * 首领的阶段阈值检查……引擎不解释它们,只保证**每个回合结束调一次**,并把
   * 出手/落账/加盾/治疗/定身这套原语交到你手里。
   * 跨回合记东西用 `ctx.state`(本场共用的小抽屉,引擎不解释)。
   */
  tickFn?: <T>(ctx: BattleHookContext<T>, rng: Rng) => void
  /**
   * 事件反应(**可选**)—— 引擎每记完一条事件就交给你看一眼。
   *
   * 这是"**内容驱动**"那三样的落点,库只给接口形状、不给规则:
   *
   *   流派组合技:看到 `kind === 'crit'` 且自己的流派对得上 → 追加一记 `strike`
   *   法宝触发  :看到 `kind === 'shield'`(护盾被打破)或挨打 → `heal` / `gainShield`
   *   首领阶段  :在 `tickFn` 里比对 `hp/maxHp` 的阈值,越过就改自己的词条与技能表
   *
   * 防递归:钩子自己引发的出手(`strike`/`log`)不会再次触发本钩子 ——
   * 否则"会心追加一记、那一记又全会心"会一路打下去。
   */
  onEvent?: <T>(ctx: BattleHookContext<T>, event: BattleEvent, rng: Rng) => void
  /**
   * 自己解释技能的 `effect`(**可选**)。
   *
   * 库**不认识** stun / drain / pierce / multi / bleed 这些标签 —— 它只把标签原样交过来,
   * 由你决定"定身"在这款游戏里到底意味着什么(也许你的题材里是"分心""伤口""没电了")。
   *
   *   返回 `true`  —— 这次出手你已经处理完(引擎不再按默认公式打这一下);
   *   返回别的(含什么都不返回)—— 引擎按默认出手(与不配这个钩子时逐位一致)。
   *
   * 给了它,**这一次出手的规则完全归你**:引擎不会在你之外再叠加任何东西。
   * 想基于默认改动(多打几下、伤害减半)就用 `ctx.strike(mult)`;
   * 想完全另算(穿甲/真伤)就用 `ctx.damage(mult)` + `ctx.applyDamage(target, 数额)`。
   */
  skillEffectFn?: <T>(ctx: SkillEffectContext<T>, rng: Rng) => boolean | void
  /**
   * 自己接管伤害公式(**可选**)。
   *
   * 默认是 `攻击² /(攻击+防御)` 再乘上浮动、增伤、减伤,并有"每击至少 × minDamageRatio"的地板。
   * 不同题材要的形状差别很大:减法型(攻−防)、除算型(攻/防)、查表型、带破甲与穿甲的混合型……
   * 给这个函数就完全接管 —— **地板与全部修正都归你**(引擎不再叠加任何东西),
   * 拿到的是已经判过闪避与暴击之后的一次出手(暴击倍率已并入 `mult`)。
   */
  damageFn?: <T>(ctx: DamageContext<T>, rng: Rng) => number
  /** 回合上限,默认 30(打不完算守方胜) */
  maxRounds?: number
  /** 暴击基础倍率,默认 1.5 */
  critMultiplier?: number
  /** 伤害浮动,默认 ±8% */
  variance?: number
  /** 每击最低伤害占攻击的比例,默认 5% */
  minDamageRatio?: number
  /** 每回合结束回复比例(双方各有 mods.regenPerRound 时按各自算) */
  regenBase?: number
}

export interface BattleShieldConfig {
  /** 护盾上限 = 最大生命 × 该比例,默认 0.5 */
  capRatio?: number
  /** 开局护盾的 mods 键(值为最大生命的比例),默认 'shieldOnStart' */
  startKey?: string
  /** 溢疗成盾的 mods 键(溢出治疗 × 该值 → 护盾),默认 'overhealShield' */
  overhealKey?: string
}

export interface BattleFollowupConfig {
  /** 反击概率的 mods 键,默认 'counterRate' */
  counterRateKey?: string
  /** 反击强度的 mods 键,默认 'counterDamage' */
  counterDamageKey?: string
  /** 反击基础倍率,默认 0.5 */
  counterBase?: number
  /** 追击概率的 mods 键,默认 'comboRate' */
  comboRateKey?: string
  /** 追击强度的 mods 键,默认 'comboDamage' */
  comboDamageKey?: string
  /** 追击基础倍率,默认 0.6 */
  comboBase?: number
}

export interface BattleSkillEffectsConfig {
  /** 多段:追打段数,默认 2 */
  multiHits?: number
  /** 多段:每段倍率(相对技能倍率),默认 0.45 */
  multiMult?: number
  /** 震慑:触发概率,默认 0.5 */
  stunChance?: number
  /** 吸取:回复自身最大生命的比例,默认 0.06 */
  drainRatio?: number
  /** 加盾:给自己加上最大生命的比例,默认 0.1 */
  shieldRatio?: number
  /** 放血:按攻击的比例直接造成伤害,默认 0.3 */
  bleedRatio?: number
  /** 哪些标签算"穿甲"(无视护盾),默认 ['pierce'] */
  pierceTags?: readonly string[]
}

/** 一次出手能带的东西 —— 默认出手、技能、反击、追击、钩子里的追加出手都走同一个函数 */
export interface StrikeOptions {
  skill?: EnemySkillDef
  /** 倍率;默认取技能倍率或 1 */
  mult?: number
  /** 事件类型;默认技能算 skill,其余算 hit */
  kind?: BattleEventKind
  /** 事件文本前缀(如「反击」「追击」);默认技能名 */
  label?: string
  /** 无视护盾(穿甲/真伤) */
  bypassShield?: boolean
  /** 这一记不会再引发反击 */
  noCounter?: boolean
  /** 这一记不会再引发追击 */
  noFollowups?: boolean
}

export interface DamageContext<T> {
  attacker: Combatant<T>
  defender: Combatant<T>
  /** 攻击方本值(已按 keys 取好) */
  attack: number
  /** 防守方本值(已按 keys 取好) */
  defense: number
  /** 本次倍率:技能倍率 × 暴击倍率(普通出手时即暴击倍率) */
  mult: number
  /** 默认公式会用到的浮动幅度、增伤与减伤(自定义时可按需复用) */
  variance: number
  damageBonus: number
  damageReduction: number
}

/**
 * 技能效果的解释上下文 —— 引擎把自己内部用的那些原语摊开给你,而不是让你另起一套。
 *
 * 每个原语都对应引擎自己走的那条路,所以"你写的"与"引擎给的"不会两套口径:
 * `strike` 就是默认那一次出手(命中/暴击/吸血/日志全同源),`damage` 就是默认伤害公式的结果。
 */
export interface SkillEffectContext<T> {
  round: number
  /** 出手方(引擎内部的副本,直接改它不会污染调用方传进来的对象) */
  attacker: Combatant<T>
  /** 挨打方(同上) */
  defender: Combatant<T>
  /** 触发的那条技能定义(读 `skill.effect` 认标签、读 `skill.desc` 也行) */
  skill: EnemySkillDef
  /** 技能自带倍率(默认出手用的就是它) */
  mult: number
  /** 已按 `keys` 解析好的本值键名 */
  keys: Required<CombatKeys>
  /** 取本值(原样 T) */
  statOf: (c: Combatant<T>, key: string) => T
  /** 改本值:如"定身"把先手压到 0、"抽蓝"扣一项资源 */
  setStat: (c: Combatant<T>, key: string, value: T) => void
  /** 取本值(转成 number,便于比较与算数) */
  num: (c: Combatant<T>, key: string) => number
  /** 按默认规则打这一下(可换倍率);返回实际造成的伤害 */
  strike: (mult?: number) => number
  /** 只算伤害不落账(默认公式或 `damageFn` 的结果),给"穿甲/真伤"这类自己扣血的写法用 */
  damage: (mult?: number) => number
  /** 落账:扣目标当前生命并记一条日志;返回实际扣掉的值 */
  applyDamage: (target: Combatant<T>, amount: number) => number
  /** 目标当前的护盾余量(没配 `shield` 时恒为 0) */
  shieldOf: (target: Combatant<T>) => number
  /** 给目标加护盾(未配 `shield` 时什么都不做);返回实际加上去的量 */
  gainShield: (target: Combatant<T>, amount: number) => number
  /** 治疗:返回真正补上的生命与(溢疗成盾时)转化出的护盾 */
  heal: (target: Combatant<T>, amount: number) => { applied: number; shielded: number }
  /** 让目标的下一次出手被跳过(定身/眩晕);重复调用不叠加 */
  skipNextTurn: (target: Combatant<T>) => void
  /** 记一条自己的日志(展示文本归你) */
  log: (kind: BattleEventKind, text: string, damage?: number, actor?: string) => void
  /** 本场共用的小抽屉:跨回合记状态(层数/冷却)用,引擎不解释它 */
  state: Record<string, unknown>
}

/**
 * 回合钩子与事件反应拿到的上下文 —— 与技能效果解释器同一套原语,区别是**不绑出手双方**。
 *
 * 技能钩子天然知道"谁打谁"(它就是在这一次出手里被叫起来的);而回合钩子与事件反应
 * 是旁观者:它可能想让自己这边追加一记、也可能想给对面挂个流血,所以出手双方由调用方指定。
 */
export interface BattleHookContext<T> {
  /** 当前回合数(开局护盾那一步是第 0 回合) */
  round: number
  /** 玩家一侧(引擎内部的副本,直接改它不会污染调用方传进来的对象) */
  player: Combatant<T>
  /** 敌人一侧(同上) */
  enemy: Combatant<T>
  /** 已按 `keys` 解析好的本值键名 */
  keys: Required<CombatKeys>
  statOf: (c: Combatant<T>, key: string) => T
  setStat: (c: Combatant<T>, key: string, value: T) => void
  num: (c: Combatant<T>, key: string) => number
  /** 护盾余量(没配 `shield` 时恒为 0) */
  shieldOf: (c: Combatant<T>) => number
  /** 加护盾(未配 `shield` 时什么都不做);返回实际加上去的量 */
  gainShield: (c: Combatant<T>, amount: number) => number
  /** 治疗;溢出部分按配置转为护盾 */
  heal: (c: Combatant<T>, amount: number) => { applied: number; shielded: number }
  /** 落账:先扣护盾再扣生命;返回扣掉的生命 */
  applyDamage: (target: Combatant<T>, amount: number, opts?: { bypassShield?: boolean }) => number
  /** 按默认规则打一记(倍率/标签/穿甲可指定);返回扣掉的生命 */
  strike: (attacker: Combatant<T>, defender: Combatant<T>, opts?: StrikeOptions) => number
  /** 只算伤害不落账 */
  damage: (attacker: Combatant<T>, defender: Combatant<T>, mult?: number) => number
  /** 让目标的下一次出手被跳过 */
  skipNextTurn: (target: Combatant<T>) => void
  /** 记一条自己的日志(展示文本归你) */
  log: (kind: BattleEventKind, text: string, damage?: number, actor?: string) => void
  /** 本场共用的小抽屉:层数 / 冷却 / 阶段放这儿 */
  state: Record<string, unknown>
  /** 这一场是否已经分出胜负(钩子里据此提前收手) */
  over: () => boolean
}

export type BattleEventKind =
  | 'hit'
  | 'crit'
  | 'dodge'
  | 'skill'
  | 'counter'
  | 'combo'
  | 'shield'
  | 'lifesteal'
  | 'regen'
  | 'skip'
  | 'end'

export interface BattleEvent {
  round: number
  /** 出手方名字 */
  actor: string
  kind: BattleEventKind
  damage: number
  text: string
}

export interface BattleResult<T> {
  win: boolean
  rounds: number
  playerHp: T
  enemyHp: T
  /** 收场时的护盾余量(没配 `shield` 时恒为 0) */
  playerShield: number
  enemyShield: number
  events: BattleEvent[]
}

function mod(mods: Mods, key: string): number {
  const v = mods[key]
  return typeof v === 'number' ? v : 0
}

export function createCombatEngine<T = number>(config: BattleConfig = {}, numeric: Numeric<T> = numberNumeric as unknown as Numeric<T>) {
  const maxRounds = config.maxRounds ?? 30
  const critMultiplier = config.critMultiplier ?? 1.5
  const variance = config.variance ?? 0.08
  const minDamageRatio = config.minDamageRatio ?? 0.05
  const regenBase = config.regenBase ?? 0
  const keys = {
    attack: config.keys?.attack ?? 'attack',
    defense: config.keys?.defense ?? 'defense',
    hp: config.keys?.hp ?? 'hp',
    maxHp: config.keys?.maxHp ?? 'maxHp',
    speed: config.keys?.speed ?? 'speed'
  }
  const stat = (c: Combatant<T>, key: string): T => c.stats[key] ?? numeric.zero
  const statNum = (c: Combatant<T>, key: string): number => numeric.toNumber(stat(c, key))
  const setStat = (c: Combatant<T>, key: string, value: T): void => {
    c.stats[key] = value
  }

  const rawDamage = (attacker: Combatant<T>, defender: Combatant<T>, mult: number, rng: Rng): number => {
    const atk = statNum(attacker, keys.attack)
    const def = statNum(defender, keys.defense)
    const damageBonus = mod(attacker.mods, 'damageBonus')
    const damageReduction = Math.min(0.9, Math.max(0, mod(defender.mods, 'damageReduction')))
    if (config.damageFn) {
      // 自己接管:地板与全部修正都归调用方,引擎不再叠加
      return config.damageFn({ attacker, defender, attack: atk, defense: def, mult, variance, damageBonus, damageReduction }, rng)
    }
    const base = atk <= 0 ? 0 : (atk * atk) / (atk + def)
    const jitter = 1 + rng.float(-variance, variance)
    const dmg = base * mult * jitter * (1 + damageBonus) * (1 - damageReduction)
    return Math.max(atk * minDamageRatio, dmg)
  }

  const alive = (c: Combatant<T>): boolean => numeric.cmp(stat(c, keys.hp), numeric.zero) > 0

  /** 拷一份再打:调用方的对象不被就地改;本值表也要拷,否则两边共用同一张表 */
  const build = (a: Combatant<T>, b: Combatant<T>): [Combatant<T>, Combatant<T>] => [
    { ...a, stats: { ...a.stats } },
    { ...b, stats: { ...b.stats } }
  ]

  return {
    /** 解算整场战斗(不改动传进来的对象;结果里的 hp 在返回值与日志里) */
    resolve(player: Combatant<T>, enemy: Combatant<T>, rng: Rng): BattleResult<T> {
      const [p, e] = build(player, enemy)
      const events: BattleEvent[] = []
      /** 被"跳过下一次出手"的目标(技能效果解释器自己往里加) */
      const skipping = new Set<Combatant<T>>()
      /** 本场共用的小抽屉:钩子跨回合记状态用,引擎不解释 */
      const state: Record<string, unknown> = {}

      /*
       * 护盾池:按参战者各存一份,只活在这一场里。
       *
       * 没配 `config.shield` 时下面所有护盾原语都是空操作 —— 于是"没有护盾这件事"
       * 与加这个功能之前逐位一致(判据里有一条专门盯着它)。
       */
      const shields = new Map<Combatant<T>, number>()
      const shieldCap = config.shield?.capRatio ?? 0.5
      const startKey = config.shield?.startKey ?? 'shieldOnStart'
      const overhealKey = config.shield?.overhealKey ?? 'overhealShield'
      const counterRateKey = config.followups?.counterRateKey ?? 'counterRate'
      const counterDamageKey = config.followups?.counterDamageKey ?? 'counterDamage'
      const comboRateKey = config.followups?.comboRateKey ?? 'comboRate'
      const comboDamageKey = config.followups?.comboDamageKey ?? 'comboDamage'
      const effectCfg = config.skillEffects === true ? {} : (config.skillEffects ?? null)
      // 标签的解释权只在"开了这套解释"时交给引擎;没开就一个都不认(包括 pierce)
      const pierceTags = effectCfg ? new Set(effectCfg.pierceTags ?? ['pierce']) : new Set<string>()

      const shieldOf = (c: Combatant<T>): number => shields.get(c) ?? 0

      /** 加护盾:受上限夹取;返回实际加上去的量 */
      const gainShield = (c: Combatant<T>, amount: number): number => {
        if (!config.shield || !(amount > 0)) return 0
        const cap = Math.max(0, statNum(c, keys.maxHp) * shieldCap)
        const before = shieldOf(c)
        const after = Math.min(cap, before + amount)
        shields.set(c, after)
        return after - before
      }

      /** 治疗:先补生命,溢出的部分按 `overhealShield` 转成护盾(要配了 shield 才算) */
      const heal = (c: Combatant<T>, amount: number): { applied: number; shielded: number } => {
        if (!(amount > 0)) return { applied: 0, shielded: 0 }
        const missing = Math.max(0, statNum(c, keys.maxHp) - statNum(c, keys.hp))
        const applied = Math.min(missing, amount)
        if (applied > 0) setStat(c, keys.hp, numeric.add(stat(c, keys.hp), numeric.from(applied)))
        const overflow = amount - applied
        const conv = config.shield ? Math.max(0, mod(c.mods, overhealKey)) : 0
        const shielded = conv > 0 && overflow > 0 ? gainShield(c, overflow * conv) : 0
        return { applied, shielded }
      }

      /** 落账:先扣护盾、再扣生命;返回各自吃掉多少 */
      const damageDealt = (
        target: Combatant<T>,
        amount: number,
        opts: { bypassShield?: boolean } = {}
      ): { absorbed: number; lost: number } => {
        let remain = amount
        let absorbed = 0
        if (config.shield && !opts.bypassShield && shieldOf(target) > 0) {
          absorbed = Math.min(shieldOf(target), remain)
          shields.set(target, shieldOf(target) - absorbed)
          remain -= absorbed
        }
        const lost = Math.min(remain, statNum(target, keys.hp))
        if (lost > 0) {
          setStat(target, keys.hp, numeric.max(numeric.zero, numeric.sub(stat(target, keys.hp), numeric.from(lost))))
        }
        return { absorbed, lost }
      }

      const applyDamage = (target: Combatant<T>, amount: number, opts: { bypassShield?: boolean } = {}): number =>
        damageDealt(target, amount, opts).lost

      /**
       * 记一条事件,并(仅在"不是钩子自己引发的"时候)交给 `onEvent` 看一眼。
       *
       * `hookDepth` 就是防递归的那道门:钩子里再出手/再记日志时深度不为 0,
       * 于是不会再把钩子叫起来 —— 否则"会心追加一记"会自己喂自己。
       */
      let hookDepth = 0
      /** 回合钩子 / 事件反应共用的上下文(不绑出手双方:谁打谁由钩子自己指定) */
      const hookContext = (atRound: number): BattleHookContext<T> => ({
        round: atRound,
        player: p,
        enemy: e,
        keys,
        statOf: stat,
        setStat,
        num: statNum,
        shieldOf,
        gainShield,
        heal,
        applyDamage,
        strike: (attacker: Combatant<T>, defender: Combatant<T>, opts: StrikeOptions = {}): number =>
          strike(attacker, defender, atRound, opts),
        damage: (attacker: Combatant<T>, defender: Combatant<T>, mult?: number): number =>
          rawDamage(attacker, defender, mult ?? 1, rng),
        skipNextTurn: (target: Combatant<T>): void => {
          skipping.add(target)
        },
        log: (kind: BattleEventKind, text: string, damage = 0, actor?: string): void => {
          emit(atRound, actor ?? p.name, kind, text, damage)
        },
        state,
        over: (): boolean => !alive(p) || !alive(e)
      })

      const emit = (round: number, actor: string, kind: BattleEventKind, text: string, damage = 0): void => {
        const event: BattleEvent = { round, actor, kind, damage, text }
        events.push(event)
        if (!config.onEvent || hookDepth > 0) return
        hookDepth += 1
        try {
          config.onEvent(hookContext(round), event, rng)
        } finally {
          hookDepth -= 1
        }
      }

      const strike = (attacker: Combatant<T>, defender: Combatant<T>, round: number, opts: StrikeOptions = {}): number => {
        const skill = opts.skill
        const mult = opts.mult ?? skill?.mult ?? 1
        const kind: BattleEventKind = opts.kind ?? (skill ? 'skill' : 'hit')
        const label = opts.label ?? (skill ? `【${skill.name}】` : '')
        const missChance = Math.max(0, Math.min(0.95, mod(defender.mods, 'dodgeRate') - mod(attacker.mods, 'accuracy')))
        if (rng.chance(missChance)) {
          emit(round, attacker.name, 'dodge', `${attacker.name} 出手,${defender.name} 闪开了`)
          return 0
        }
        const critRate = Math.max(0, Math.min(1, mod(attacker.mods, 'critRate')))
        const isCrit = kind === 'hit' && rng.chance(critRate)
        const critMult = isCrit ? critMultiplier + mod(attacker.mods, 'critDamage') : 1
        const damage = rawDamage(attacker, defender, mult * critMult, rng)
        const { absorbed, lost } = damageDealt(defender, damage, { bypassShield: opts.bypassShield })
        const shieldNote = absorbed > 0 ? `(护盾挡下 ${Math.round(absorbed)})` : ''
        emit(
          round,
          attacker.name,
          isCrit ? 'crit' : kind,
          `${attacker.name} ${label}${isCrit ? '重击' : '命中'} ${defender.name},造成 ${Math.round(lost)} 伤害${shieldNote}`,
          lost
        )

        // 吸血
        const lifesteal = Math.max(0, mod(attacker.mods, 'lifesteal'))
        if (lifesteal > 0 && lost > 0) {
          const { applied } = heal(attacker, lost * lifesteal)
          if (applied > 0) emit(round, attacker.name, 'lifesteal', `${attacker.name} 汲取 ${Math.round(applied)} 生命`)
        }

        /*
         * 反击与追击 —— 都只打一记,且这一记自己不再引发反击/追击。
         *
         * 顺序与那款真实作品一致:先反击(挨打方的反应),再追击(出手方的顺势)。
         * 两者都读词条,没配 `followups` 就整段跳过。
         */
        if (config.followups && !opts.noCounter && alive(defender)) {
          const rate = Math.max(0, Math.min(1, mod(defender.mods, counterRateKey)))
          if (rng.chance(rate)) {
            strike(defender, attacker, round, {
              mult: (config.followups.counterBase ?? 0.5) * (1 + mod(defender.mods, counterDamageKey)),
              kind: 'counter',
              label: '反击',
              noCounter: true,
              noFollowups: true
            })
          }
        }
        if (config.followups && !opts.noFollowups && alive(attacker) && alive(defender)) {
          const rate = Math.max(0, Math.min(1, mod(attacker.mods, comboRateKey)))
          if (rng.chance(rate)) {
            strike(attacker, defender, round, {
              mult: (config.followups.comboBase ?? 0.6) * (1 + mod(attacker.mods, comboDamageKey)),
              kind: 'combo',
              label: '追击',
              noCounter: true,
              noFollowups: true
            })
          }
        }
        return lost
      }

      /**
       * 技能标签的默认解释(只在配了 `skillEffects` 时执行)。
       *
       * 语义取自那款真实作品:multi 两段追打、stun 震慑到下一回合、drain 吸取回血、
       * shield 给自己加盾、bleed 按攻击放血;pierce 在出手时就走"无视护盾"。
       */
      const applySkillEffects = (attacker: Combatant<T>, defender: Combatant<T>, round: number, skill: EnemySkillDef): void => {
        const tag = skill.effect
        if (!tag || !effectCfg || !alive(defender)) return
        if (tag === 'multi') {
          const hits = Math.max(0, Math.floor(effectCfg.multiHits ?? 2))
          for (let i = 0; i < hits && alive(defender) && alive(attacker); i += 1) {
            strike(attacker, defender, round, {
              skill,
              mult: skill.mult * (effectCfg.multiMult ?? 0.45),
              noFollowups: true
            })
          }
          return
        }
        if (tag === 'stun') {
          if (rng.chance(Math.max(0, Math.min(1, effectCfg.stunChance ?? 0.5)))) {
            skipping.add(defender)
            emit(round, attacker.name, 'skill', `${defender.name} 被震慑,一时动弹不得`)
          }
          return
        }
        if (tag === 'drain') {
          const { applied } = heal(attacker, statNum(attacker, keys.maxHp) * (effectCfg.drainRatio ?? 0.06))
          if (applied > 0) emit(round, attacker.name, 'lifesteal', `${attacker.name} 吸取了 ${Math.round(applied)} 生命`)
          return
        }
        if (tag === 'shield') {
          const gained = gainShield(attacker, statNum(attacker, keys.maxHp) * (effectCfg.shieldRatio ?? 0.1))
          if (gained > 0) emit(round, attacker.name, 'shield', `${attacker.name} 凝起一层护盾(吸收 ${Math.round(gained)})`)
          return
        }
        if (tag === 'bleed') {
          const attackerName = attacker.name
          const lost = applyDamage(defender, statNum(attacker, keys.attack) * (effectCfg.bleedRatio ?? 0.3))
          if (lost > 0) emit(round, attackerName, 'skill', `${defender.name} 血流不止,又损 ${Math.round(lost)} 生命`, lost)
        }
      }

      /** 技能效果解释器:把引擎内部的出手/伤害/落账原语摊开给调用方,而不是让他另起一套 */
      const runEffect = (attacker: Combatant<T>, defender: Combatant<T>, round: number, skill: EnemySkillDef): boolean => {
        const fn = config.skillEffectFn
        if (!fn) return false
        const handled = fn(
          {
            round,
            attacker,
            defender,
            skill,
            mult: skill.mult,
            keys,
            statOf: stat,
            setStat,
            num: statNum,
            strike: (mult?: number): number => strike(attacker, defender, round, { skill, mult: mult ?? skill.mult }),
            damage: (mult?: number): number => rawDamage(attacker, defender, mult ?? skill.mult, rng),
            applyDamage: (target: Combatant<T>, amount: number): number => {
              const dealt = applyDamage(target, amount)
              if (dealt > 0) {
                emit(round, attacker.name, 'skill', `${attacker.name} 【${skill.name}】命中 ${target.name},造成 ${Math.round(dealt)} 伤害`, dealt)
              }
              return dealt
            },
            shieldOf,
            gainShield,
            heal,
            skipNextTurn: (target: Combatant<T>): void => {
              skipping.add(target)
            },
            log: (kind: BattleEventKind, text: string, damage = 0, actor?: string): void => {
              emit(round, actor ?? attacker.name, kind, text, damage)
            },
            state
          },
          rng
        )
        return handled === true
      }

      const pSpeed = statNum(p, keys.speed) * (1 + mod(p.mods, 'speed'))
      const eSpeed = statNum(e, keys.speed) * (1 + mod(e.mods, 'speed'))
      const playerFirst = pSpeed >= eSpeed

      // 开战护盾:读双方各自的 `shieldOnStart`(配了 shield 才算)
      if (config.shield) {
        for (const c of [p, e]) {
          const pct = Math.max(0, mod(c.mods, startKey))
          if (pct > 0) {
            const gained = gainShield(c, statNum(c, keys.maxHp) * pct)
            if (gained > 0) emit(0, c.name, 'shield', `${c.name} 开局凝起一层护盾(吸收 ${Math.round(gained)})`)
          }
        }
      }

      let round = 0
      while (round < maxRounds && alive(p) && alive(e)) {
        round += 1
        const order: [Combatant<T>, Combatant<T>][] = playerFirst
          ? [
              [p, e],
              [e, p]
            ]
          : [
              [e, p],
              [p, e]
            ]
        for (const [attacker, defender] of order) {
          if (!alive(p) || !alive(e)) break
          if (skipping.delete(attacker)) {
            events.push({ round, actor: attacker.name, kind: 'skip', damage: 0, text: `${attacker.name} 这一回合没有出手` })
            continue
          }
          const skills = attacker.skills ?? []
          const usable = skills.filter(s => rng.chance(s.rate))
          const skill = usable.length > 0 ? rng.pick(usable) : undefined
          // 有技能且调用方给了效果解释器:由他决定这一次出手怎么算;他说"没处理"才走默认
          if (skill && runEffect(attacker, defender, round, skill)) continue
          strike(attacker, defender, round, {
            skill,
            // 穿甲标签在出手时就生效:这一记无视护盾
            bypassShield: skill?.effect !== undefined && pierceTags.has(skill.effect)
          })
          if (skill) applySkillEffects(attacker, defender, round, skill)
        }
        for (const c of [p, e]) {
          if (!alive(c)) continue
          const regen = regenBase + mod(c.mods, 'regenPerRound')
          if (regen <= 0) continue
          // 传原始量让 heal 自己处理"补不满的部分":配了溢疗成盾时,多余的那部分会变成护盾
          const healed = heal(c, statNum(c, keys.maxHp) * regen)
          if (healed.applied > 0) {
            emit(round, c.name, 'regen', `${c.name} 回复 ${Math.round(healed.applied)} 生命`)
          }
          if (healed.shielded > 0) {
            emit(round, c.name, 'shield', `${c.name} 溢出的生机化为护盾(吸收 ${Math.round(healed.shielded)})`)
          }
        }

        /*
         * 每回合结束:把"要按回合推进的东西"交给作品。
         *
         * 引擎在这里只做两件事:给你一套原语、保证每回合叫一次;流血怎么掉、
         * 增益怎么减、首领阶段在哪条阈值上翻面,全归你(所以这里也叫"内容驱动")。
         */
        if (config.tickFn) {
          hookDepth += 1
          try {
            config.tickFn(hookContext(round), rng)
          } finally {
            hookDepth -= 1
          }
        }
      }
      const win = alive(p) && !alive(e)
      events.push({
        round,
        actor: win ? p.name : e.name,
        kind: 'end',
        damage: 0,
        text: win ? `${p.name} 胜` : alive(e) ? `${e.name} 胜` : '两败俱伤'
      })
      return {
        win,
        rounds: round,
        playerHp: stat(p, keys.hp),
        enemyHp: stat(e, keys.hp),
        playerShield: shieldOf(p),
        enemyShield: shieldOf(e),
        events
      }
    }
  }
}

export type CombatEngine<T = number> = ReturnType<typeof createCombatEngine<T>>
