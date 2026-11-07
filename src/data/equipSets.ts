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
  id: string;
  name: string;
  /** 触发所需件数 */
  required: number;
  /** 机制效果文案 + 战斗钩子标记 */
  effectDesc: string;
  /** 机制钩子 Id(战斗引擎可识别) */
  /**
   * 机制钩子 Id。**每一套必须是独一份的** —— 两个套共用同一个 hook,玩家凑齐它们
   * 拿到的是同一个效果,第二套就只剩名字(判据见 core/equipSet.spec「不同共鸣组
   * 不许共用同一个机制钩子」)。
   *
   * 数值全在玩法层解释(见 core/equipSet 的 ASTRAL_SET_SHIELD 一族常量),
   * 这里只写 hook。
   */
  hook: "ironwall" | "astral" | "sunder" | "thorns" | "primordial";
}

const SET_DEFS: Map<string, EquipSetDef> = new Map([
  [
    "s_tiebi",
    {
      id: "s_tiebi",
      name: "铁壁共鸣",
      required: 2,
      effectDesc: "受到致命伤害时,首次保留 1 点气血",
      hook: "ironwall",
    },
  ],
  [
    "s_xingdou",
    {
      id: "s_xingdou",
      name: "星斗共鸣",
      required: 2,
      effectDesc: "每场战斗开始时获得一层星光护体",
      hook: "astral",
    },
  ],
  // 界域装备共鸣(扩界):高界的套件沿用既有两条机制钩子,不新开体系
  [
    "s_xianjia",
    {
      id: "s_xianjia",
      name: "仙甲共鸣",
      required: 2,
      /*
       * 原先挂 astral,与 8 阶的星斗共鸣**完全同一个机制**(开战 +5% 最大气血盾)——
       * 玩家到 23 阶凑齐一套更难,拿到的却和 8 阶一模一样。
       *
       * 套件是攻伐向的(仙钧剑 / 御虚冠 / 云锦仙袍),故改挂 sunder:
       * 开战即削去对手一层护甲,是「先破防再打」的那一路,与守势的 astral 相对。
       */
      effectDesc: "开战即破敌一层护甲,先破防再论攻",
      hook: "sunder",
    },
  ],
  [
    "s_shenjia",
    {
      id: "s_shenjia",
      name: "神铠共鸣",
      required: 2,
      /*
       * 原先挂 ironwall,与 2 阶的铁壁共鸣**完全同一个机制**(致命伤首次保留 1 点气血),
       * 文案也一字未改。神铠是 28 阶的终局守势,该有比「留 1 点」更硬的守:
       * 改挂 thorns —— 受击时反震一部分伤害,守中带攻。
       */
      effectDesc: "受击时反震一部分伤害,守势亦带锋",
      hook: "thorns",
    },
  ],
  [
    "s_hundunjia",
    {
      id: "s_hundunjia",
      name: "混沌共鸣",
      required: 2,
      /*
       * 原先也挂 astral(第三套共用)。混沌是终局那一档的开天意象,改挂 primordial:
       * 开战即回本境灵气上限的一截 —— 终局连场时省掉的那几息,比一层护盾更值。
       */
      effectDesc: "开战即回一口本源灵气,不必从枯处起手",
      hook: "primordial",
    },
  ],
]);

/** 全部共鸣定义 —— 装配公共库的装备系统时用它把模板挂的 set 对上内容 */
export const EQUIP_SETS: EquipSetDef[] = [...SET_DEFS.values()];

export function equipSetDef(setId: string): EquipSetDef | undefined {
  return SET_DEFS.get(setId);
}
