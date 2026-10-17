/**
 * Phase 28 前期玩法数据 —— 悟道顿悟/突破准备/历练路线/洞府巡游
 *
 * 顿悟与巡游的 `desc` / `effect` 只写**风味**,一个数字都不许带:
 * 数值(词条百分比、时长、奖励量)一律由 ui/earlyGameText 从 buffId / reward /
 * penalty 现算 —— 手抄的副本早晚会与结算真值分家(AGENTS「界面上出现的每个数字
 * 都与结算同源」)。
 */
import type { EnlightenmentOption, BreakthroughPrepOption } from "@/types";

/**
 * 悟道顿悟选项池(修炼时随机触发,三选一)
 *
 * 时长不在这里另记一份:它只存在于 buffs.ts 那味 buff 的 durationSec 里
 * (同一件事只有一个真相源,改时长不会出现「说 5 分钟、实则 10 分钟」)。
 */
export const ENLIGHTENMENT_OPTIONS: EnlightenmentOption[] = [
  // 修炼加速
  {
    type: "cultivation",
    label: "静心凝神",
    desc: "收心入定,识海如镜",
    buffId: "enlighten_cult",
  },
  {
    type: "cultivation",
    label: "道心通明",
    desc: "灵台无尘,一念通透",
    buffId: "enlighten_cult_strong",
  },
  // 战斗增强
  {
    type: "combat",
    label: "锤炼筋骨",
    desc: "引灵气淬炼周身",
    buffId: "enlighten_dmg",
  },
  {
    type: "combat",
    label: "凝气护体",
    desc: "气机外绕,护住周身门户",
    buffId: "enlighten_def",
  },
  // 突破相关
  {
    type: "breakthrough",
    label: "悟透瓶颈",
    desc: "前人走到的那道坎忽然看得清;大关天劫仍须自渡",
    buffId: "enlighten_bt",
  },
  // 灵气相关
  {
    type: "qi",
    label: "吐纳有序",
    desc: "一呼一吸,皆落在该落的节拍上",
    buffId: "enlighten_qi",
  },
  // 悟道点 —— 悟道产出没有速率词条可挂,走即时奖励(数值同样读 reward,不写文案)
  {
    type: "insight",
    label: "灵机一动",
    desc: "灵光忽至,不假外求",
    reward: { type: "wudao", value: 5 },
  },
];

/**
 * 突破准备选项 —— 没有 `desc`。
 *
 * 这里曾有一句「耗时3分钟,进阶成功率 +8%」,把 bonusRate / duration / cost.stone
 * 又手抄了一遍。它**没有任何渲染点**(CultivationView 的按钮全走 label / duration /
 * bonusRate / prepPillCost 结构体字段),所以它当时不是"正在撒谎",而是**埋着的谎**:
 * 谁哪天把它捡起来当说明文字用,读到的就是改常数之前那一天的数。
 *
 * 死字段不该改成风味句留着 —— 留着就得维护,还可能被误用。故整个删掉,
 * 数值只认结构体(`bonusRate` / `duration` / `cost`),文案由视图从这三样现算。
 * 判据见 src/core/dataTextAudit.spec.ts(该字段不许长回来)。
 */
export const BREAKTHROUGH_PREP_OPTIONS: BreakthroughPrepOption[] = [
  { id: "direct", label: "直接突破", bonusRate: 0, duration: 0 },
  { id: "meditate", label: "静坐调息", bonusRate: 0.08, duration: 180 },
  { id: "pill", label: "服用聚气丹", cost: { stone: 80 }, bonusRate: 0.05, duration: 0 },
];

/** 洞府巡游事件池(location → 事件列表);effect 同样是风味,数值见 ui/earlyGameText */
export const CAVE_EVENT_POOL = {
  field: [
    {
      id: "field_1",
      title: "灵田异象",
      desc: "灵田中灵气波动异常",
      options: [
        {
          label: "疏导灵气",
          effect: "顺其势而引之,不与它争",
          reward: { type: "exp" as const, value: 50 },
        },
        {
          label: "强行吸收",
          effect: "一手探入乱流,尽数扯进经脉",
          reward: { type: "exp" as const, value: 120 },
          penalty: { type: "cultivationSpeed" as const, value: -0.15, duration: 300 },
        },
        {
          label: "观察记录",
          effect: "记下这笔波动,留待参详",
          reward: { type: "wudao" as const, value: 3 },
        },
      ],
    },
  ],
  furnace: [
    {
      id: "furnace_1",
      title: "丹炉余温",
      desc: "丹炉中残留灵药气息",
      options: [
        {
          label: "提炼残渣",
          effect: "刮下炉壁结着的残膏",
          reward: { type: "stone" as const, value: 30 },
        },
        {
          label: "吸纳药气",
          effect: "就着余温吞纳药息",
          reward: { type: "buff" as const, value: "cave_furnace_cult" },
        },
        {
          label: "清理炉体",
          effect: "拂去积垢,复其本色",
          reward: { type: "wudao" as const, value: 2 },
        },
      ],
    },
  ],
  library: [
    {
      id: "library_1",
      title: "藏经阁尘封古籍",
      desc: "书架深处有卷残破古籍",
      options: [
        {
          label: "研读",
          effect: "逐字咀嚼那卷残篇",
          reward: { type: "wudao" as const, value: 5 },
        },
        {
          label: "抄录",
          effect: "整卷誊下,存于识海",
          reward: { type: "wudao" as const, value: 12 },
        },
        { label: "略过", effect: "合上书,不去动它", reward: { type: "stone" as const, value: 0 } },
      ],
    },
  ],
  array: [
    {
      id: "array_1",
      title: "聚灵阵灵气逸散",
      desc: "聚灵阵中灵气不稳",
      options: [
        {
          label: "修复阵法",
          effect: "循纹补缺,令其归位",
          reward: { type: "buff" as const, value: "cave_array_qicap" },
        },
        {
          label: "导出灵气",
          effect: "开一处泄口,把逸散的收进丹田",
          reward: { type: "exp" as const, value: 80 },
        },
        {
          label: "任其自然",
          effect: "不加干涉,看它自散",
          reward: { type: "stone" as const, value: 0 },
        },
      ],
    },
  ],
  garden: [
    {
      id: "garden_1",
      title: "灵兽园异动",
      desc: "灵兽园中传来奇异鸣叫",
      options: [
        {
          label: "查看",
          effect: "循声拨开草丛",
          reward: { type: "herb" as const, value: 3 },
        },
        {
          label: "安抚灵兽",
          effect: "以神念抚其躁意",
          reward: { type: "buff" as const, value: "cave_garden_pet" },
        },
        {
          label: "离开",
          effect: "不惊动它,转身出门",
          reward: { type: "stone" as const, value: 0 },
        },
      ],
    },
  ],
};

/** 连胜奖励阈值与奖励 */
export const WIN_STREAK_REWARDS = [
  { streak: 3, stone: 20, wudao: 1 },
  { streak: 5, stone: 40, wudao: 2 },
  { streak: 10, stone: 100, wudao: 5 },
];

/**
 * Phase 29 前期机制生命周期衰减
 *
 * 不是"全体降频",而是按事件的打断价值分级:
 * - 顿悟:高价值、高打断 → 保留弹窗,但后期降低频率
 * - 闭关:高价值、低打断 → 保留,后期仍可自由选择
 * - 巡游:低价值、高打断 → 后期降为通知,不再弹窗
 * - 连胜:低价值、高频   → 只在关键节点弹
 *
 * 数值表示"该机制在不同阶段的主动存在感"(0 = 完全退出,1 = 全频)
 */
export const EARLY_EVENT_DECAY = {
  /** 修炼顿悟:前期高,金丹后大幅降低,真仙后退出 */
  enlightenment: {
    lianqi: 1.0,
    zhuji: 0.7,
    jindan: 0.35,
    yuanying: 0.1,
    later: 0,
  },
  /** 短时闭关:到中期仍是自由选择,不做强制衰减 */
  shortRetreat: {
    lianqi: 1.0,
    zhuji: 0.9,
    jindan: 0.8,
    yuanying: 0.7,
    later: 0.6,
  },
  /** 洞府巡游:前期提活跃,后期让位给更重要的系统 */
  cavePatrol: {
    lianqi: 1.0,
    zhuji: 0.6,
    jindan: 0.25,
    yuanying: 0,
    later: 0,
  },
  /** 连胜奖励:保留至元婴,但奖励渐弱 */
  streakBonus: {
    lianqi: 1.0,
    zhuji: 0.85,
    jindan: 0.6,
    yuanying: 0.4,
    later: 0.2,
  },
} as const;

/**
 * 根据境界获取某机制的衰减系数
 * 境界 0=炼气, 1=筑基, 2=金丹, 3=元婴, 4=化神, 5+=后期
 */
export function earlyEventDecay(mechanism: keyof typeof EARLY_EVENT_DECAY, major: number): number {
  const stage = EARLY_EVENT_DECAY[mechanism];
  if (major <= 0) return stage.lianqi;
  if (major === 1) return stage.zhuji;
  if (major === 2) return stage.jindan;
  if (major === 3) return stage.yuanying;
  return stage.later;
}
