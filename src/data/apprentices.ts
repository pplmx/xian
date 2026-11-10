/**
 * 收徒 —— 后台游历的 idle 层:你收的弟子会离线跑腿,采药、采矿、历练、寻宝、修习,
 * 按墙钟走工,归来带回资材。玩家不动手,东西也在长 —— 与挂机修炼互补、不抢轮次。
 *
 * 静态原型与任务调参在这里;派发/结算/产出在 core/apprenticeService。
 */
import type { QualityId } from "@/types";

/** 收徒一次要花的灵石层级基数(stoneByTier 的档位参数) —— 结算与价签同源 */
export const APPRENTICE_RECRUIT_TIER_AMOUNT = 30;

/** 弟子跑腿的任务门类 */
export type ApprenticeSpec = "herb" | "ore" | "adventure" | "seek" | "study";

export interface ApprenticeTaskDef {
  spec: ApprenticeSpec;
  /** 门类名 */
  name: string;
  icon: string;
  /** 一趟耗时(秒,真实时间;离线照算) */
  seconds: number;
  desc: string;
}

export const APPRENTICE_TASKS: ApprenticeTaskDef[] = [
  { spec: "herb", name: "采灵药", icon: "leaf", seconds: 1800, desc: "上山采灵草,带回洞府药圃" },
  { spec: "ore", name: "开矿脉", icon: "mountain", seconds: 1800, desc: "凿一处小矿,送来玄铁" },
  {
    spec: "adventure",
    name: "历练",
    icon: "swords",
    seconds: 2700,
    desc: "下山历练,挣灵石、磨阅历",
  },
  { spec: "seek", name: "寻机缘", icon: "gem", seconds: 3600, desc: "四处寻访,或得丹药" },
  { spec: "study", name: "参悟", icon: "book", seconds: 5400, desc: "静坐参悟,为道基添悟道点" },
];

export function taskDef(spec: ApprenticeSpec): ApprenticeTaskDef {
  return APPRENTICE_TASKS.find((t) => t.spec === spec)!;
}

export interface ApprenticeArchetype {
  id: string;
  name: string;
  quality: QualityId;
  /** 天赋门类 —— 该门产出 ×TALENT_BONUS */
  talent: ApprenticeSpec;
  desc: string;
}

function a(
  id: string,
  name: string,
  quality: QualityId,
  talent: ApprenticeSpec,
  desc: string,
): ApprenticeArchetype {
  return { id, name, quality, talent, desc };
}

/**
 * 弟子原型 —— **每个门类至少两名,且品质错开**。
 *
 * ## 为什么要铺到每个门类两名
 *
 * 招募是**随机抽**(`rng.pick`),而池子会排除已收的原型。初版只有六个原型:
 * 采药/开矿/历练/寻宝各一名、参悟两名 —— 于是玩家接到第二个采药弟子是**不可能的**,
 * 五个门类里四个永远只有一种选择。品质也几乎不分化:凡品两个、下品两个、
 * 中品与上品各一个,抽到什么都由「还差哪个门类」决定,与运气无关。
 *
 * 现在每个门类两名、品质拉开(凡/下/中/上/极都有),抽取才有两件独立的事:
 * 抽到**哪个门类**,以及抽到**什么品质**。前者决定你把弟子往哪派,后者决定划不划算。
 *
 * ## 品质分布的用意
 *
 * 采药与开矿是早期主力(洞府生产),故各留一名凡品保底 —— 开局不至于无人可用;
 * 历练/寻宝/参悟的门槛高一些,低品质不给。极品的两个(药仙遗徒 / 铸剑师)
 * 都是「越老越值钱」的门类,抽到是惊喜而不是常规。
 */
export const APPRENTICES: ApprenticeArchetype[] = [
  // 采药 —— 早期主力,凡品保底 + 上品一个赌运
  a("ap_luanniao", "采药童子", "mortal", "herb", "山野出身,识得满山灵草"),
  a("ap_yaotong", "药圃小童", "excellent", "herb", "自小在药圃里长大,闻味便知年份"),
  // 开矿 —— 同上
  a("ap_kuangtou", "开矿壮汉", "mortal", "ore", "身强力壮,一镐一个准"),
  a("ap_tiejiang", "老炼器匠", "spirit", "ore", "打了一辈子铁,听声便知矿脉深浅"),
  // 历练 —— 要能打,凡品不收
  a("ap_youxia", "游侠少年", "fine", "adventure", "仗剑下山,专爱历练"),
  a("ap_jianxiu", "散修剑客", "excellent", "adventure", "无门无派,一身本事全在刀口上磨出来"),
  // 寻宝 —— 靠眼力,品质不宜太低
  a("ap_lingtong", "寻宝灵童", "fine", "seek", "天生一副寻宝的鼻子"),
  a("ap_kanxing", "堪舆老丈", "spirit", "seek", "看得懂地气,荒山里也能摸出宝光"),
  // 参悟 —— 门槛最高的一门
  a("ap_daotong", "悟道道童", "excellent", "study", "心静如水,善参玄理"),
  a("ap_guyin", "古音居士", "spirit", "study", "听琴辨道,一句偈能参上三年"),
  // 两个极品:抽到是惊喜,不设保底
  a("ap_yaoxian", "药仙遗徒", "heaven", "herb", "药王谷旧人之后,识得三百年以上的药性"),
  a("ap_zhujian", "铸魂锻师", "profound", "ore", "铸过一柄有魂的剑,此后寻常金铁皆不入眼"),
];

const BY_ID = new Map(APPRENTICES.map((x) => [x.id, x]));

export function apprenticeDef(id: string): ApprenticeArchetype | undefined {
  return BY_ID.get(id);
}

/** 开局白送的入门弟子 */
export const STARTER_APPRENTICE = "ap_lingtong";

/** 弟子等级上限 */
export const APPRENTICE_MAX_LEVEL = 20;
/** 天赋门类产出加成 */
export const APPRENTICE_TALENT_BONUS = 1.25;

/**
 * 品质产出加成 —— 按品质档位递增,与天赋那 1.25 相乘。
 *
 * ## 为什么要有这一项
 *
 * `ApprenticeArchetype.quality` 一直只用来**染色**(界面按品质给名字上色),
 * 产出公式只看 `talent === spec` 那 1.25 倍。于是玩家收到「凡品采药童子」
 * 与「灵品寻宝灵童」时,除名字颜色外没有任何差别 —— 品质这个字段
 * 在玩法上等于不存在,而它在全仓别处(`QualityDef.mult`)都是个真数值。
 *
 * ## 为什么不用 `QualityDef.mult`
 *
 * 那套倍率是给**装备**用的(凡品 1.0 → 神品 9.5),拿来乘弟子产出会把
 * 挂机收益放大到与境界脱钩。弟子是「后台慢慢长」的一层,倍率要温和。
 * 现有原型落在凡~灵四档(1.0 / 1.1 / 1.2 / 1.3),
 * 与天赋那 1.25 叠起来最高 1.63 —— 明显但不至于让低品质弟子变成废牌。
 *
 * ## 九档必须**配满**,不许留 Partial
 *
 * 初版只配了原型用到的四档(mortal / fine / excellent / spirit)加一个 heaven,
 * 类型写的是 `Partial<Record<QualityId, number>>` —— 于是 profound / earth /
 * immortal / divine 四档查不到值,回落到 `?? 1`,**与凡品相同而比灵品还低**。
 * 现在弟子原型只用到四档,这个错不显形;但只要将来加一个地品或仙品原型,
 * 它就会「品质更高、产出更低」。类型改成完整 `Record<QualityId, number>`,
 * 少配一档编译期就红。
 *
 * 顶档定在 2.2 而不是 `QualityDef.mult` 的 9.5:弟子是挂机层,
 * 天品以上的原型真要加进来时,靠这个上限也能把收益按住在合理范围。
 */
export const APPRENTICE_QUALITY_BONUS: Record<QualityId, number> = {
  mortal: 1.0,
  fine: 1.1,
  excellent: 1.2,
  spirit: 1.3,
  profound: 1.45,
  earth: 1.6,
  heaven: 1.75,
  immortal: 1.95,
  divine: 2.2,
};

/** 一名弟子的产出倍率 = 天赋匹配加成 × 品质加成。两处都读同一份常量,不另立数值源 */
export function apprenticeYieldMult(archId: string, spec: ApprenticeSpec): number {
  const def = apprenticeDef(archId);
  if (!def) return 1;
  const talent = def.talent === spec ? APPRENTICE_TALENT_BONUS : 1;
  // 完整 Record,无需兜底 —— 兜底会让「漏配一档」重新变成静默错误
  const quality = APPRENTICE_QUALITY_BONUS[def.quality];
  return talent * quality;
}

/** 弟子槽位随境界增长:1 起,每 4 境 +1,顶到 5 */
export function apprenticeSlots(major: number): number {
  return Math.min(5, 1 + Math.floor(Math.max(0, major) / 4));
}

/**
 * 「各尽其长」一键派发的目标水位(见 core/apprenticeService.dispatchAllToNeed)。
 *
 * 每格是"库存到这条线才算够":缺得越多 score 越高,一键派发优先把闲置弟子
 * 派去最缺的门。containers 是常识水位 —— 不是精确平衡判定,是"别让某样东西
 * 一直空着也没人管"的懒开局。
 */
export const DISPATCH_NEED_TARGET: Record<"herb" | "ore" | "wudao" | "dust", number> = {
  herb: 30,
  ore: 20,
  wudao: 10,
  dust: 10,
};
/** 历练(灵石自理)的保底分:灵石需求几乎恒有,若永远低于材料短缺分就永不历练;给一个固定底分防偏心 */
export const DISPATCH_ADVENTURE_FIXED_SCORE = 2;

/** 羁绊位阶(弟子的称谓)—— 纯命名/flavor,不给产出或时长加成;按累计完工趟数阈值 */
export interface BondTitle {
  min: number;
  name: string;
}
export const BOND_TITLES: BondTitle[] = [
  { min: 0, name: "道童" },
  { min: 10, name: "道仆" },
  { min: 30, name: "道徒" },
  { min: 60, name: "记名弟子" },
  { min: 100, name: "真传" },
];
/** 由累计完工趟数取羁绊称谓 */
export function bondTitle(bond: number): string {
  let name = BOND_TITLES[0]!.name;
  for (const t of BOND_TITLES) {
    if (bond >= t.min) name = t.name;
  }
  return name;
}
/** 跨世之缘只对「真传(最高羁绊位阶)」开放,凝成的一丝缘封顶到其阈值 —— 不越界 */
export const BOND_TRUECODE_MIN = BOND_TITLES[BOND_TITLES.length - 1]!.min;
