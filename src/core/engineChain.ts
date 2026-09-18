/**
 * 主线任务链对库的接入 —— 内容(`data/quests` 的 `MAIN_QUESTS`)与判据仍住在本作,
 * 库只给"顺序任务链"的骨架(见 packages/engine 的 chain)。
 *
 * 这里定三件事:
 *   · **一次结算最多推 5 节**(迁移前的 `while (guard < 5)` 守卫原样保留):条件恒真时
 *     没有守卫的循环会一帧跳完整条链,撞到上限也要能说出来(`capped`);
 *   · 判据由调用方给 —— 本作是 `progress.evalCond`(与界面进度读数同一份),故这一层
 *     不 import progress,免得绕成环;
 *   · 结果换算回本作的内容定义,调用方直接拿去发赏与提示。
 */
import type { ChainAdvance, ChainNode } from 'wanxiang-engine'
import { createChain } from 'wanxiang-engine'
import type { QuestDef } from '@/types'
import { MAIN_QUESTS } from '@/data/quests'

/** 一次结算最多推进几节 —— 守卫,不是配额 */
export const MAIN_CHAIN_MAX_STEPS = 5

const QUEST_BY_ID = new Map(MAIN_QUESTS.map(q => [q.id, q]))

const MAIN_CHAIN = createChain({
  nodes: MAIN_QUESTS.map(q => ({ id: q.id, name: q.name })),
  maxSteps: MAIN_CHAIN_MAX_STEPS,
  // 判据不在这里:advance 的 ctx 就是"这一节达成了吗"
  done: (node: ChainNode, ctx: (node: ChainNode) => boolean) => ctx(node)
})

export interface MainChainAdvance {
  /** 推进后的下标(没推进则原样) */
  index: number
  /** 这一次走过的节点(顺序即链上顺序),已换算回本作的内容定义 */
  advanced: QuestDef[]
  /** 到链尾了吗 */
  atEnd: boolean
  /** 撞上限了吗(还有下一节满足条件,但这一轮按守停下了) */
  capped: boolean
}

/** 推进主线链:能推多远推多远(最多 5 节) */
export function advanceMainChain(index: number, done: (node: ChainNode) => boolean): MainChainAdvance {
  const out: ChainAdvance = MAIN_CHAIN.advance({ index }, done)
  const advanced: QuestDef[] = []
  for (const node of out.advanced) {
    const def = QUEST_BY_ID.get(node.id)
    if (def) advanced.push(def)
  }
  return { index: out.state.index, advanced, atEnd: out.atEnd, capped: out.capped }
}

/** 第几节是哪条任务(界面与判据共用) */
export function mainQuestAt(index: number): QuestDef | undefined {
  return MAIN_QUESTS[index]
}

/** 按 id 找这一节(判据与发赏都按 id 认) */
export function mainQuestDefById(id: string): QuestDef | undefined {
  return QUEST_BY_ID.get(id)
}
