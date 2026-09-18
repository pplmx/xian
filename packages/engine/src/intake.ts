/**
 * 入库漏斗 —— "一件东西来了,收不下怎么办"。
 *
 * 掉落、事件奖励、任务发放、邮箱领取……凡是"外来的东西要进玩家那里"的地方,
 * 顺序都是同一套,而且每一处都踩过坑:
 *
 *   一 **先见证,再谈收不收**:本作的图鉴收录挂在"装备入账的唯一漏斗"上 ——
 *      若在裁决之后再记,"化尘掉的那件"就不算见过,而玩家明明看见过它。
 *      见证与收纳是两件事,前者的时机不该被后者决定;
 *   二 **先问裁决**:有些东西是自动回收/自动分解掉的(玩家设过规则),
 *      命中规则的根本不进包,直接折算 —— 而规则的总闸关着时一律照收;
 *   三 **满了先尝试腾位**:只有当"新来的这件值得留"时才挤掉包内最该走的那件;
 *      腾位是**有代价**的:被挤掉的也要折算,且**腾位失败不追回**(已经折算了就是折算了);
 *   四 **收不下就折算**:同一件东西在不同去路(被拒 / 被挤掉 / 收不下)的折算口径
 *      应当是同一条账 —— 分开写就会分叉;
 *   五 **逐行说明**:回执里带人话(新增了什么、为什么没进包、挤掉了什么),
 *      界面与战报直接拿去显示,不必各自再拼一遍。
 *
 * 库不认识的:什么东西算"值得留"、挤掉谁、折算成什么 —— 全是作品给的函数;
 * 库给的是上面这五条**顺序与边界**。
 */
import type { Holding, HoldingSystem } from './holding.js'

export interface IntakeConfig<TItem extends { uid: string }, TYield = unknown> {
  /** 收纳系统(容量与"什么占位"的规则都在它那里) */
  holding: Pick<HoldingSystem<TItem>, 'add' | 'isFull' | 'remove'>
  /**
   * 收不收(不配 = 都收)。命中"不收"的直接走折算 —— 但**见证已经发生**。
   * `force` 会跳过这一问(新手馈赠之类不受自动规则约束)。
   */
  accept?: (item: TItem, holding: Holding<TItem>) => boolean
  /**
   * 满了的时候,从现有件里挑一件让它走(不配 = 不腾位,直接折算新来的那件)。
   * 只有"新来的这件值得留"时才该返回东西 —— 不值得留就让它自己走。
   */
  evictable?: (items: readonly TItem[], incoming: TItem) => TItem | undefined
  /** 折算(必给):把一件东西变成别的东西(化尘、换币、寄回),返回一行人话 */
  fallback: (item: TItem) => { line: string; yield?: TYield }
  /** 见证:无论收不收都先记一笔(本作是图鉴见闻) */
  witness?: (item: TItem) => void
}

export interface IntakeResult<TItem, TYield> {
  /** 最终收下了吗 */
  admitted: boolean
  /** 没收下的话,是因为"裁决不收"还是"真的放不下"(两条文案不一样) */
  reason?: 'rejected' | 'full'
  /** 腾位时被挤掉的旧件 */
  evicted?: TItem
  /** 走过的折算(被拒的、被挤掉的、收不下的) */
  yields: { item: TItem; line: string; yield?: TYield }[]
  /** 逐行说明(界面直接用) */
  lines: string[]
}

export function createIntake<TItem extends { uid: string }, TYield = unknown>(config: IntakeConfig<TItem, TYield>) {
  const admit = (
    holding: Holding<TItem>,
    item: TItem,
    opts: { force?: boolean } = {}
  ): { holding: Holding<TItem> } & IntakeResult<TItem, TYield> => {
    const yields: IntakeResult<TItem, TYield>['yields'] = []
    const lines: string[] = []
    const runFallback = (target: TItem): void => {
      const outcome = config.fallback(target)
      yields.push({ item: target, line: outcome.line, yield: outcome.yield })
      lines.push(outcome.line)
    }

    // 一 先见证:收不收都算"见过"
    config.witness?.(item)

    // 二 先问裁决(force 跳过)
    if (!opts.force && config.accept && !config.accept(item, holding)) {
      runFallback(item)
      return { holding, admitted: false, reason: 'rejected', yields, lines }
    }

    const added = config.holding.add(holding, item)
    if (added.ok) return { holding: added.holding, admitted: true, yields, lines }

    // 三 满了:看能不能腾位(只有值得留的新件才该腾)
    const victim = config.evictable?.(holding.items, item)
    if (victim) {
      const taken = config.holding.remove(holding, victim.uid)
      runFallback(victim)
      const retry = config.holding.add(taken.holding, item)
      if (retry.ok) {
        return { holding: retry.holding, admitted: true, evicted: victim, yields, lines }
      }
      // 腾位后仍放不下(理论上不该发生):旧件已折算,**不追回**;新件按"收不下"这条路走
      runFallback(item)
      return { holding: taken.holding, admitted: false, reason: 'full', evicted: victim, yields, lines }
    }

    // 四 收不下:折算
    runFallback(item)
    return { holding, admitted: false, reason: 'full', yields, lines }
  }

  return { admit }
}

export type IntakeSystem<TItem extends { uid: string }, TYield = unknown> = ReturnType<typeof createIntake<TItem, TYield>>
