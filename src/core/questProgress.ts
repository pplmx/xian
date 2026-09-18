/**
 * 任务进度文案 —— 「这条路我走到哪了」
 *
 * 起因:首页把主线任务的**名字与说明**摆着,却不给进度。每日任务有 3/10,
 * 主线只有一句「击败 10 个敌人」—— 而主线正是新手第一天唯一的路线图:
 * 没有进度,玩家只能猜自己走了多远,也看不出这一趟历练有没有算数。
 *
 * 两条纪律:
 *   一 **达成与否读 progress.evalCond**,与真正发赏的判定同一份 ——
 *      不许出现"界面说成了、领赏时不算"或反之;
 *   二 文案只做翻译,不另立标准:counter 说「已 X/Y」,realm 说「已至 / 尚在」,
 *      custom 的 realm_a_b 与 evalCond 用同一套比较(境界 > 或 = 且层数 ≥)。
 */
import type { AchvCond, QuestDef } from '@/types'
import { goalEnv, toGoalCond } from './progress'
import { goalProgress } from '@engine/index'
import { realmDef, realmLabel } from '@/data/realms'
import { usePlayerStore } from '@/stores/player'
import { useQuestsStore } from '@/stores/quests'

export interface QuestProgressView {
  /** 一句话读数:「已 3/10」「已至 炼气·二层,需 炼气·三层」 */
  text: string
  done: boolean
  /** 可量化的那类给个 0~1 的比例(界面画条用);未量为 null */
  ratio: number | null
}

/** 条件 → 进度文案。认不出的条件返回 null(界面就不显示,不硬编一个) */
export function questProgressOf(cond: AchvCond): QuestProgressView | null {
  const player = usePlayerStore()
  const quests = useQuestsStore()
  const goal = toGoalCond(cond)
  if (goal === null) return null
  // 判定与进度由公共库给(见 packages/engine 的 goals):界面读数与领赏判定同一份
  const progress = goalProgress(goal, goalEnv())
  if (progress === null) return null
  const done = progress.done

  switch (cond.type) {
    case 'counter': {
      const cur = quests.counter(cond.key)
      return {
        text: done ? `已成(${cond.value}/${cond.value})` : `已 ${Math.min(cur, cond.value)}/${cond.value}`,
        done,
        ratio: progress.ratio
      }
    }
    case 'realm': {
      const target = realmDef(cond.major)
      return {
        text: done ? `已至 ${target.name}` : `尚在 ${player.realm.name}·需至 ${target.name}`,
        done,
        ratio: null
      }
    }
    case 'custom': {
      const m = /^realm_(\d+)_(\d+)$/.exec(cond.key)
      if (!m) return null // 状态型键(寿元 / 灵石)不是"进度",不在这里装成一条
      const major = Number(m[1])
      const sub = Number(m[2])
      const target = realmLabel(major, sub)
      return {
        text: done ? `已至 ${target}` : `已至 ${player.realmName}·需至 ${target}`,
        done,
        ratio: null
      }
    }
    default:
      return null
  }
}

/** 当前主线的进度(首页用) */
export function currentMainQuestProgress(): QuestProgressView | null {
  const quests = useQuestsStore()
  const def: QuestDef | undefined = quests.currentMainQuest
  return def ? questProgressOf(def.cond) : null
}
