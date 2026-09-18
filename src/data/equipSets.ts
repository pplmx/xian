/**
 * 装备共鸣的内容表 —— 名字、所需件数、机制文案与 hook 标记。
 *
 * 为什么单独成文件:装配公共库(engineWorld)与查询共鸣(core/equipSet)都要读它,
 * 而查询那侧还要用库算"件数够没够"。内容放 data/、规则走库,两边就不会互相 import 成环。
 *
 * 「同组多件触发什么」是**机制**,不是数值:铁壁 = 首次致命伤保留 1 点气血,
 * 星斗 = 开战时星光护体。故这里只写 hook,数值留给玩法层解释。
 */
export interface EquipSetDef {
  id: string
  name: string
  /** 触发所需件数 */
  required: number
  /** 机制效果文案 + 战斗钩子标记 */
  effectDesc: string
  /** 机制钩子 Id(战斗引擎可识别) */
  hook: 'ironwall' | 'astral'
}

const SET_DEFS: Map<string, EquipSetDef> = new Map([
  ['s_tiebi', { id: 's_tiebi', name: '铁壁共鸣', required: 2, effectDesc: '受到致命伤害时,首次保留 1 点气血', hook: 'ironwall' }],
  ['s_xingdou', { id: 's_xingdou', name: '星斗共鸣', required: 2, effectDesc: '每场战斗开始时获得一层星光护体(护盾+5%)', hook: 'astral' }],
  // 界域装备共鸣(扩界):高界的套件沿用既有两条机制钩子,不新开体系
  ['s_xianjia', { id: 's_xianjia', name: '仙甲共鸣', required: 2, effectDesc: '开战时仙光护体(护盾+5%)', hook: 'astral' }],
  ['s_shenjia', { id: 's_shenjia', name: '神铠共鸣', required: 2, effectDesc: '受到致命伤害时,首次保留 1 点气血', hook: 'ironwall' }],
  ['s_hundunjia', { id: 's_hundunjia', name: '混沌共鸣', required: 2, effectDesc: '开战时本源护体(护盾+5%)', hook: 'astral' }]
])

/** 全部共鸣定义 —— 装配公共库的装备系统时用它把模板挂的 set 对上内容 */
export const EQUIP_SETS: EquipSetDef[] = [...SET_DEFS.values()]

export function equipSetDef(setId: string): EquipSetDef | undefined {
  return SET_DEFS.get(setId)
}
