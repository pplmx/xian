/**
 * 分流裁决 —— "这一件留还是不留"这件事的骨架。
 *
 * 自动回收 / 自动分解 / 自动出售这类功能,每家游戏都要写,而且翻车的方式惊人地一致:
 *
 *   一 **规则顺序说不清**:"保留线"与"一键清理"两条政策各管一半,玩家只记得自己设过的那个,
 *      于是保留线之上的东西被另一条规则扔掉(真实事故:玩家在收纳里把线设在灵品,
 *      而另一个弹窗勾过玄品 —— 玄品在保留线之上,照旧被扔);
 *   二 **看不见**:开关一排,玩家不知道关掉某一项会扔多少件。
 *
 * 这个模块只给两样东西:**有序规则链**(第一条表态的说了算,谁也没表态才用兜底),
 * 与**按同一条链算出来的读数**(留下几件、扔几件、每条规则各判掉多少)。
 * 至于"哪些件不参与裁决""每条规则的判据是什么" —— 那都是内容,归作品。
 *
 * 纪律与别处一样:裁决与读数**共用同一个 `decide`**,界面上的数字不会与实际行为分叉。
 */

/** 一条规则的表态:留 / 不留 / 不表态(undefined,交给下一条) */
export type TriageOutcome = boolean | { keep: boolean; reason?: string } | undefined

export interface TriageRule<T> {
  /** 规则名(读数按它分组,也是"谁负责"的凭据) */
  id: string
  /** 人话说明(界面直接可用) */
  label?: string
  /** 表态:返回 true/false 或 `{ keep, reason }`;返回 undefined 表示这条不管 */
  decide: (item: T) => TriageOutcome
}

export interface TriageVerdict {
  keep: boolean
  /** 由谁裁决:规则 id,或 `skip`(豁免)/ `fallback`(谁都没表态) */
  rule: string
  /** 凭什么(界面可读的一句话) */
  reason: string
}

export interface TriageConfig<T> {
  rules: readonly TriageRule<T>[]
  /** 豁免:命中它的件不参与裁决(本作是"上锁的件",别的游戏可能是"正在装备的") */
  skip?: (item: T) => boolean
  /** 所有规则都不表态时的兜底;默认"不留" */
  fallback?: { keep: boolean; reason?: string }
}

export interface TriageImpact {
  /** 参与裁决的件数(豁免的不算) */
  candidates: number
  keep: number
  junk: number
  /** 判定原因 → 件数,按"谁先命中谁负责"计,与裁决顺序一致 */
  byReason: { reason: string; count: number }[]
}

export function createTriage<T>(config: TriageConfig<T>) {
  const fallback = config.fallback ?? { keep: false, reason: '无一条规则认领' }

  const decide = (item: T): TriageVerdict => {
    if (config.skip?.(item)) return { keep: true, rule: 'skip', reason: '不参与自动裁决' }
    for (const rule of config.rules) {
      const outcome = rule.decide(item)
      if (outcome === undefined) continue
      if (typeof outcome === 'boolean') {
        return { keep: outcome, rule: rule.id, reason: rule.label ?? rule.id }
      }
      return { keep: outcome.keep, rule: rule.id, reason: outcome.reason ?? rule.label ?? rule.id }
    }
    return { keep: fallback.keep, rule: 'fallback', reason: fallback.reason ?? 'fallback' }
  }

  const partition = (items: readonly T[]): { keep: T[]; junk: T[]; verdicts: { item: T; verdict: TriageVerdict }[] } => {
    const keep: T[] = []
    const junk: T[] = []
    const verdicts: { item: T; verdict: TriageVerdict }[] = []
    for (const item of items) {
      const verdict = decide(item)
      verdicts.push({ item, verdict })
      if (verdict.keep) keep.push(item)
      else junk.push(item)
    }
    return { keep, junk, verdicts }
  }

  /** 体检读数:调开关时"这一下会扔多少件"看得见 */
  const impact = (items: readonly T[]): TriageImpact => {
    let keep = 0
    let junk = 0
    const counts = new Map<string, number>()
    for (const item of items) {
      if (config.skip?.(item)) continue
      const verdict = decide(item)
      if (verdict.keep) {
        keep += 1
        continue
      }
      junk += 1
      counts.set(verdict.reason, (counts.get(verdict.reason) ?? 0) + 1)
    }
    return {
      candidates: keep + junk,
      keep,
      junk,
      byReason: [...counts.entries()].map(([reason, count]) => ({ reason, count })).sort((a, b) => b.count - a.count)
    }
  }

  return { rules: config.rules, decide, partition, impact }
}

export type TriageSystem<T> = ReturnType<typeof createTriage<T>>

/**
 * 一串比较器依次比 —— "行囊满了先挤掉谁"的骨架。
 *
 * 每一层只回答一个问题(先比成色、再比层级、最后比词条),前一层分出胜负就不再往下比;
 * 全都没分出胜负就返回 0(由调用方决定稳定排序还是另想办法)。
 */
export function compareBy<T>(...comparators: readonly ((a: T, b: T) => number)[]): (a: T, b: T) => number {
  return (a: T, b: T): number => {
    for (const compare of comparators) {
      const result = compare(a, b)
      if (result !== 0) return result
    }
    return 0
  }
}
