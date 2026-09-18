/**
 * 状态 / 时效增益 —— "这一条现在还在不在、还剩多久、再叠一次会怎样"。
 *
 * 丹药增益、事件祝福、负面状态、限时加成……同一套骨架,而它有五处是真踩过坑的:
 *
 *   一 **重复施加要"叠时长",不是"刷新"**:`Math.max(旧到期, now + 时长)` 看着稳妥,
 *      实际是刷新 —— 增益还剩 20 分钟时再服同一味药,那 20 分钟被清零重算,玩家会说
 *      "药白吃了"。默认口径 `'extend'`:`max(旧到期, now) + 时长`,剩余时间足额兑现;
 *   二 **已经过期的旧实例不能把"负剩余"叠进来**:所以 extend 的基准是 `max(旧, now)`,
 *      而不是直接拿旧到期加时长(坏档、离线一晚上回来都会撞上这一条);
 *   三 **生效与清理必须是同一个判据**(`到期时刻 > now`):一处 `>`、一处 `>=`,
 *      就会在"正好到期"的那一帧飘出一条幽灵状态。这里只留一个判据,`active` 与 `prune` 共用;
 *   四 **"清除负面"只认分类**:库里不认识什么是负面,`kind` 由内容给(本作是 `injury`),
 *      `clear(kind)` 按分类剪,并回报剪掉了几条 —— 界面要说话;
 *   五 **快照要带上"下一次变化在什么时候"**:面板重算与倒计时都靠它,不然界面只能
 *      自己再遍历一遍(然后慢慢长出第二套判据)。
 *
 * 效果本身(改了哪些数值)库**不解释**:`mods` 原样带出,交给作品自己的属性汇总。
 * 时间单位也由调用方声明一次:内容表里写的是**秒**(作者直觉),而运行时时钟常常是毫秒
 * (`Date.now()`),`clock: 'ms'` 就是那句声明 —— 省得每处都 ×1000、少写一次就错一千倍。
 */
export interface BuffDef<M = unknown> {
  /** 状态标识(内容表的键) */
  id: string
  /** 一次施加持续多久(**秒**) */
  durationSec: number
  /**
   * 分类:增益 / 减益 / 中性……库不解释含义,只用于 `clear(kind)` 这类筛选
   * (本作是 `pill` / `blessing` / `injury`)
   */
  kind?: string
  /** 效果内容:库不解释,`active()` 原样带出 */
  mods?: M
  /** 叠加后的总时长上限(秒,可选):可叠到顶就封住,不无限涨 */
  maxDurationSec?: number
}

export interface BuffInstance {
  /** 对应哪个定义 */
  id: string
  /** 到期时刻(**与传入的 `now` 同一时钟单位**) */
  endsAt: number
}

/** 同一状态重复施加时的算法 */
export type BuffStacking =
  /** 剩余时长 + 新时长(默认;"药力化开"足额兑现) */
  | 'extend'
  /** 取较长者(旧的 `Math.max(旧, now+时长)` 写法:剩余被吞,等价于刷新) */
  | 'longest'
  /** 一律从现在重新起算(剩余清零) */
  | 'reset'

export interface BuffConfig<M = unknown> {
  /** 定义表 */
  defs: readonly BuffDef<M>[]
  /** 重复施加的算法,默认 `'extend'` */
  stacking?: BuffStacking
  /**
   * 时钟单位:传入的 `now` 与实例的 `endsAt` 用哪个单位(`'sec'` 默认,`'ms'` 对应
   * `Date.now()`)。内容表里的 `durationSec` / `maxDurationSec` 永远是秒。
   */
  clock?: 'sec' | 'ms'
}

export interface BuffView<M = unknown> {
  def: BuffDef<M>
  instance: BuffInstance
  /** 还剩多少秒(已到期为 0)—— 界面倒计时用 */
  remainingSec: number
}

/** 剪掉若干条之后的结果 —— `removed` 是"剪掉了几条",界面与判据都用得上 */
export interface BuffChange {
  instances: BuffInstance[]
  removed: number
}

export interface BuffApply {
  instances: BuffInstance[]
  /** 有没有真的施加(内容改名后旧存档里的 id 找不到定义时是 false,且**不动列表**) */
  applied: boolean
  /** 施加后的到期时刻(未施加为 null) */
  endsAt: number | null
}

export function createBuffSystem<M = unknown>(config: BuffConfig<M>) {
  const byId = new Map<string, BuffDef<M>>()
  for (const def of config.defs) byId.set(def.id, def)
  const stacking: BuffStacking = config.stacking ?? 'extend'
  /** 一秒钟等于几个时钟刻度:整份实现的单位换算只有这一处 */
  const perSec = config.clock === 'ms' ? 1000 : 1

  const defOf = (id: string): BuffDef<M> | undefined => byId.get(id)

  /** 生效的唯一判据:到期时刻**严格大于** now(正好到期算过期) */
  const isActive = (instance: BuffInstance, now: number): boolean => instance.endsAt > now

  /** 到期时刻 = 已经攒够的那一部分,封顶封在 now + 上限 */
  const capOf = (def: BuffDef<M>, endsAt: number, now: number): number =>
    def.maxDurationSec === undefined ? endsAt : Math.min(endsAt, now + def.maxDurationSec * perSec)

  const apply = (instances: readonly BuffInstance[], id: string, now: number): BuffApply => {
    const def = defOf(id)
    if (!def) return { instances: [...instances], applied: false, endsAt: null }
    const duration = def.durationSec * perSec
    const at = instances.findIndex(i => i.id === id)
    const existing = at >= 0 ? instances[at]! : null
    const base = existing === null ? now : Math.max(existing.endsAt, now)
    const raw =
      stacking === 'reset' ? now + duration : stacking === 'longest' ? Math.max(base, now + duration) : base + duration
    const endsAt = capOf(def, raw, now)
    const next = existing === null ? [...instances, { id, endsAt }] : instances.map((i, n) => (n === at ? { id, endsAt } : i))
    return { instances: next, applied: true, endsAt }
  }

  const prune = (instances: readonly BuffInstance[], now: number): BuffChange => {
    const next = instances.filter(i => isActive(i, now))
    return { instances: next, removed: instances.length - next.length }
  }

  /** 按分类清除(本作:"清除负面" = `clear(list, 'injury')`)—— 没有定义的实例视为无分类,不动 */
  const clear = (instances: readonly BuffInstance[], kind: string): BuffChange => {
    const next = instances.filter(i => defOf(i.id)?.kind !== kind)
    return { instances: next, removed: instances.length - next.length }
  }

  /** 此刻真正生效的状态(顺序沿用实例顺序)—— 无定义的残留直接跳过,坏档不该让界面炸 */
  const active = (instances: readonly BuffInstance[], now: number): BuffView<M>[] => {
    const out: BuffView<M>[] = []
    for (const instance of instances) {
      const def = defOf(instance.id)
      if (def && isActive(instance, now)) {
        out.push({ def, instance, remainingSec: (instance.endsAt - now) / perSec })
      }
    }
    return out
  }

  /** 这一条**此刻**还算不算数(与 active 同一判据:到期那一刻就已经不算了) */
  const has = (instances: readonly BuffInstance[], id: string, now: number): boolean =>
    instances.some(i => i.id === id && isActive(i, now))

  /** 还剩多少秒(没有这一条 / 已到期 → 0) */
  const remainingSec = (instances: readonly BuffInstance[], id: string, now: number): number => {
    const instance = instances.find(i => i.id === id)
    return instance && isActive(instance, now) ? (instance.endsAt - now) / perSec : 0
  }

  /** 下一次状态变化发生在什么时候(全空或全过期 → null):面板重算与倒计时共用 */
  const nextExpiry = (instances: readonly BuffInstance[], now: number): { id: string; at: number; afterSec: number } | null => {
    let soon: BuffInstance | null = null
    for (const instance of instances) {
      if (!defOf(instance.id) || !isActive(instance, now)) continue
      if (soon === null || instance.endsAt < soon.endsAt) soon = instance
    }
    return soon === null ? null : { id: soon.id, at: soon.endsAt, afterSec: (soon.endsAt - now) / perSec }
  }

  return { defs: config.defs, stacking, perSec, defOf, apply, prune, clear, active, has, remainingSec, nextExpiry }
}

export type BuffSystem<M = unknown> = ReturnType<typeof createBuffSystem<M>>
