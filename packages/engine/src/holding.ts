/**
 * 持有(背包)—— "手里有哪些件东西"这一层。
 *
 * ## 为什么单独一层
 *
 * 装备系统管的是"怎么生成、这块属性怎么算",但**玩家手上那一堆**是另一件事:
 * 按 uid 找、背包满了收不进、删一件要顺带从装配里摘掉、替换一件是同 uid 覆盖。
 * 这几件事每个游戏都要写一遍,而且写得都不一样(尤其"什么算占位"这一条)。
 *
 * ## 与题材无关,与结构有关
 *
 * 库不规定你持有的是什么 —— 只要求每件有个 `uid`(身份)。于是同一层能装:
 * 装备、丹药、法宝、卡牌、宠物、图纸……给它 `{ uid }` 就行。
 *
 * 三件事由你定:
 *   `capacity`  背包多大(可以随状态算:洞府等级、行囊扩展)
 *   `counted`   哪些件占背包位 —— 本作的口径是"已装配的不占",别的游戏可能全都占
 *   `slots`     装配槽怎么映射(库只认"槽位 → uid"这张表,不认槽位叫什么)
 */
export type SlotMap = Record<string, string | undefined>

export interface Holding<TItem> {
  items: TItem[]
}

export interface HoldingItem {
  uid: string
}

export interface HoldingConfig<TItem extends HoldingItem> {
  /** 背包容量;给函数就每次现算(洞府升级 / 行囊扩展) */
  capacity?: number | ((holding: Holding<TItem>) => number)
  /** 哪些件占背包位;默认全占 */
  counted?: (item: TItem, holding: Holding<TItem>) => boolean
}

export type AddFailure = 'full' | 'duplicate'

export function createHoldingSystem<TItem extends HoldingItem>(config: HoldingConfig<TItem> = {}) {
  const capacityOf = (holding: Holding<TItem>): number => {
    const cap = config.capacity
    if (typeof cap === 'function') return cap(holding)
    return cap ?? Number.POSITIVE_INFINITY
  }

  const countedOf = (item: TItem, holding: Holding<TItem>): boolean => config.counted?.(item, holding) ?? true

  const create = (items: readonly TItem[] = []): Holding<TItem> => ({ items: [...items] })
  const list = (holding: Holding<TItem>): readonly TItem[] => holding.items
  const find = (holding: Holding<TItem>, uid: string): TItem | undefined => holding.items.find(it => it.uid === uid)
  const has = (holding: Holding<TItem>, uid: string): boolean => find(holding, uid) !== undefined
  const indexOf = (holding: Holding<TItem>): Map<string, TItem> => new Map(holding.items.map(it => [it.uid, it]))

  /** 当前占位数量(按 `counted` 算) */
  const count = (holding: Holding<TItem>): number => holding.items.filter(it => countedOf(it, holding)).length
  const spaceOf = (holding: Holding<TItem>): number => Math.max(0, capacityOf(holding) - count(holding))
  const isFull = (holding: Holding<TItem>): boolean => spaceOf(holding) <= 0

  /**
   * 收一件。
   *
   * 满了就**不收**(返回 `full`,由调用方决定折算成什么 —— 库不该替你决定"满了怎么办");
   * uid 重复也不收(uid 是身份,重复即数据坏了)。
   * `force` 用于装备/法宝这类"先装配、不占背包位"的收法:跳过容量检查。
   */
  const add = (
    holding: Holding<TItem>,
    item: TItem,
    opts: { force?: boolean } = {}
  ): { ok: boolean; holding: Holding<TItem>; reason?: AddFailure } => {
    if (has(holding, item.uid)) return { ok: false, holding, reason: 'duplicate' }
    if (!opts.force && countedOf(item, holding) && isFull(holding)) return { ok: false, holding, reason: 'full' }
    return { ok: true, holding: { items: [...holding.items, item] } }
  }

  const addMany = (
    holding: Holding<TItem>,
    items: readonly TItem[],
    opts: { force?: boolean } = {}
  ): { holding: Holding<TItem>; added: TItem[]; failed: { item: TItem; reason: AddFailure }[] } => {
    let current = holding
    const added: TItem[] = []
    const failed: { item: TItem; reason: AddFailure }[] = []
    for (const item of items) {
      const result = add(current, item, opts)
      if (result.ok) {
        current = result.holding
        added.push(item)
      } else {
        failed.push({ item, reason: result.reason ?? 'full' })
      }
    }
    return { holding: current, added, failed }
  }

  /** 取走一件;返回新的持有与新取走的那件(没有就原样返回) */
  const remove = (holding: Holding<TItem>, uid: string): { holding: Holding<TItem>; removed?: TItem } => {
    const removed = find(holding, uid)
    if (!removed) return { holding }
    return { holding: { items: holding.items.filter(it => it.uid !== uid) }, removed }
  }

  const removeMany = (holding: Holding<TItem>, uids: readonly string[]): { holding: Holding<TItem>; removed: TItem[] } => {
    const gone = new Set(uids)
    const removed = holding.items.filter(it => gone.has(it.uid))
    if (removed.length === 0) return { holding, removed }
    return { holding: { items: holding.items.filter(it => !gone.has(it.uid)) }, removed }
  }

  /** 同 uid 覆盖(强化、重铸、封存都用它:件还是那件,数据变了) */
  const replace = (holding: Holding<TItem>, item: TItem): { holding: Holding<TItem>; found: boolean } => {
    let found = false
    const items = holding.items.map(it => {
      if (it.uid !== item.uid) return it
      found = true
      return item
    })
    return { holding: found ? { items } : holding, found }
  }

  /** 装配:槽位 → uid(纯函数,返回新的那张表) */
  const assign = (slots: SlotMap, slot: string, uid: string): SlotMap => ({ ...slots, [slot]: uid })

  /** 卸下某个槽 */
  const unassignSlot = (slots: SlotMap, slot: string): SlotMap => {
    const next = { ...slots }
    delete next[slot]
    return next
  }

  /**
   * 把某件从**所有**槽位上摘掉(删一件装备时必须做,否则装配表里会留下一个悬空 uid)。
   * 返回新的表与被清掉的槽位名。
   */
  const unassignUid = (slots: SlotMap, uid: string): { slots: SlotMap; cleared: string[] } => {
    const cleared = Object.keys(slots).filter(slot => slots[slot] === uid)
    if (cleared.length === 0) return { slots, cleared }
    const next = { ...slots }
    for (const slot of cleared) delete next[slot]
    return { slots: next, cleared }
  }

  /** 已装配的 uid 集合(背包计数、面板高亮都要它) */
  const assignedUids = (slots: SlotMap): Set<string> => new Set(Object.values(slots).filter((uid): uid is string => typeof uid === 'string'))

  return {
    create,
    list,
    find,
    has,
    indexOf,
    count,
    capacityOf,
    spaceOf,
    isFull,
    add,
    addMany,
    remove,
    removeMany,
    replace,
    assign,
    unassignSlot,
    unassignUid,
    assignedUids
  }
}

export type HoldingSystem<TItem extends HoldingItem> = ReturnType<typeof createHoldingSystem<TItem>>
