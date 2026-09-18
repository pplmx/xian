/**
 * 设施(建造 / 升级 / 每小时产出)—— "这一座现在几级、还能不能再升、升了每小时多出什么"。
 *
 * 洞府建筑、书房与台灯、工厂与产线、图书馆与实验室……同一套骨架,而它有三处容易写歪:
 *
 *   一 **"能不能升"要能说出为什么**:门槛不止一条(解锁条件 / 自身品类上限 /
 *      被别的东西卡着 —— 本作是"其余建筑受洞府等级所限",洞府自己不受此限),
 *      而**判定的先后即界面的说法**:先报"境界不够"还是先报"已至顶层",玩家看到的
 *      是两句不同的话。故门槛由内容给函数(返回一句人话或 undefined),顺序也由内容定,
 *      库只保证"能升"与"要花什么"出自同一次判定;
 *   二 **等级上限是"取小",而且只封升级**:自身上限与别人给的上限取小(本作
 *      `(洞府等级 + 1) × 5`);它只挡住"再升一级",已有等级不会被改小(降级是另一回事);
 *   三 **每小时产出要留小数**:一秒一秒地算,每次都向下取整会把零头丢光
 *      (本作 1.5 悟道点/小时、2.4 玄铁/小时,取整后永远发不出来)—— 正确做法是
 *      **把零头留在累加器里**,够了整数才发,且"够了"这件事按**键**算。
 *
 * 花费(要花什么)库也不解释:键名与数额都由内容给,付钱是调用方的事(本作的费用里有
 * 大数灵石,故数额类型是泛型)。效果(`mods`)同理,原样带出给作品自己的属性汇总。
 */

export type LevelMap = Record<string, number>

/** 一条花费(键名由内容定:灵石 / 玄铁 / 零花钱……) */
export interface FacilityCost<A = number> {
  key: string
  amount: A
}

export interface FacilityDef<M = unknown, Ctx = unknown, A = number> {
  id: string
  /** 展示名(可省:作品自己有内容表的话,这里只留键) */
  name?: string
  /** 自身品类上限:顶到这一级为止 */
  maxLevel: number
  /**
   * 另外的等级上限(**可选**):本作是 `(洞府等级 + 1) × 5`。
   * 与 `maxLevel` **取小**;只封住升级,不把已有等级改小。
   */
  cap?: (levels: LevelMap, ctx: Ctx) => number
  /** 卡在等级上限时的说法(界面直接用);不配则该档没有额外说明 */
  capReason?: string
  /**
   * 其他门槛:不行就返回**一句给人看的原因**,undefined = 这一关过了。
   * 判定顺序即这里写的顺序(先报哪一句,由内容定)。
   */
  blocked?: (levels: LevelMap, level: number, ctx: Ctx) => string | undefined
  /** 从 `level` 升到 `level + 1` 要花什么(数额类型泛型,本作用大数灵石) */
  costs?: (level: number, ctx: Ctx) => readonly FacilityCost<A>[]
  /** 这一级带来的效果(库不解释,原样带出) */
  mods?: (level: number, ctx: Ctx) => M
  /** 这一级**每小时**产出什么(键与单位由调用方定) */
  perHour?: (level: number, ctx: Ctx) => Record<string, number>
}

export interface UpgradeInfo<A = number> {
  can: boolean
  /** 不能升时给人看的原因(能升时为 '') */
  reason: string
  /** 现在几级 */
  level: number
  /** 升上去是几级 */
  nextLevel: number
  /** 要花什么(不能升时也给出来 —— 界面常常要显示"差在哪") */
  costs: readonly FacilityCost<A>[]
}

export function createFacilitySystem<M = unknown, Ctx = unknown, A = number>(config: {
  facilities: readonly FacilityDef<M, Ctx, A>[]
}) {
  const byId = new Map<string, FacilityDef<M, Ctx, A>>()
  for (const def of config.facilities) byId.set(def.id, def)

  const defOf = (id: string): FacilityDef<M, Ctx, A> | undefined => byId.get(id)

  /** 现在几级(没记过 = 0;坏值一律当 0,不让它渗进 UI) */
  const levelOf = (levels: LevelMap, id: string): number => {
    const raw = levels[id]
    return raw !== undefined && Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 0
  }

  /** 这一级还能升到多高:自身上限与别人给的上限**取小** */
  const capOf = (levels: LevelMap, id: string, ctx: Ctx): number => {
    const def = defOf(id)
    if (!def) return 0
    const other = def.cap?.(levels, ctx)
    return other === undefined ? def.maxLevel : Math.min(def.maxLevel, other)
  }

  /** "能不能升、为什么、下一级是几级、要花什么" —— 四件事出自同一次判定 */
  const upgradeInfo = (levels: LevelMap, id: string, ctx: Ctx): UpgradeInfo<A> => {
    const def = defOf(id)
    const level = levelOf(levels, id)
    if (!def) return { can: false, reason: '', level, nextLevel: level + 1, costs: [] }
    const costs = def.costs?.(level, ctx) ?? []
    const blocked = def.blocked?.(levels, level, ctx)
    if (blocked !== undefined) return { can: false, reason: blocked, level, nextLevel: level + 1, costs }
    if (level >= capOf(levels, id, ctx)) {
      return { can: false, reason: def.capReason ?? '', level, nextLevel: level + 1, costs }
    }
    return { can: true, reason: '', level, nextLevel: level + 1, costs }
  }

  /** 各设施在这一级的每小时产出**合计**(只算真的建起来了的:等级 > 0) */
  const ratesOf = (levels: LevelMap, ctx: Ctx): Record<string, number> => {
    const out: Record<string, number> = {}
    for (const def of config.facilities) {
      const level = levelOf(levels, def.id)
      if (level <= 0 || !def.perHour) continue
      for (const [key, rate] of Object.entries(def.perHour(level, ctx))) {
        out[key] = (out[key] ?? 0) + rate
      }
    }
    return out
  }

  /** 建起来了的设施带来的效果(顺序即声明顺序)—— 喂给作品自己的属性汇总 */
  const modsOf = (levels: LevelMap, ctx: Ctx): M[] => {
    const out: M[] = []
    for (const def of config.facilities) {
      const level = levelOf(levels, def.id)
      if (level > 0 && def.mods) out.push(def.mods(level, ctx))
    }
    return out
  }

  return { facilities: config.facilities, defOf, levelOf, capOf, upgradeInfo, ratesOf, modsOf }
}

/**
 * 按秒推进产出:**零头留在累加器里**,够了整数才发。
 *
 * `rates` 是**每小时**多少(内容表里写的就是每小时,作者不必自己换算),`sec` 是这次过了
 * 多少秒 —— 除以 3600 这一步由库做,免得各处各写一遍(少写一次就差 3600 倍)。
 *
 * 两个容易写错的边界:
 *   · 只按键结算不够:`frac` 里**已经攒着的零头也要看一眼** —— 设施拆了 / 降到 0 级时,
 *     残留的 1.2 份该发出去,不能烂在累加器里;
 *   · 发的只能是整数份:`whole` 从 `frac` 里扣掉,零头继续留。
 */
export function accrue(
  frac: Readonly<Record<string, number>>,
  rates: Readonly<Record<string, number>>,
  sec: number
): { frac: Record<string, number>; whole: Record<string, number> } {
  const nextFrac: Record<string, number> = {}
  const whole: Record<string, number> = {}
  const keys = new Set([...Object.keys(frac), ...Object.keys(rates)])
  for (const key of keys) {
    const carried = Number.isFinite(frac[key]) ? (frac[key] ?? 0) : 0
    const gained = ((rates[key] ?? 0) * sec) / 3600
    const total = carried + gained
    const emit = Math.floor(total)
    nextFrac[key] = total - emit
    if (emit > 0) whole[key] = emit
  }
  return { frac: nextFrac, whole }
}

export type FacilitySystem<M = unknown, Ctx = unknown, A = number> = ReturnType<
  typeof createFacilitySystem<M, Ctx, A>
>
