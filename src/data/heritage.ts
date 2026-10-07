/**
 * 宿命传承(ISS-302) —— 深修「不可替代性」的跨世遗产。
 *
 * 与 daoFruit / talents 同类 kind='legacy' 的永久项:随神魂不灭,跨世不清零。
 * 一个传承 = 某个可停世境界(金丹..真仙)给深修的独一份「我是谁」,浅修农场永远拿不到。
 *
 * 核心纪律(评审红线,由 heritageForge.spec 的结构断言钉死):
 *   **任何传承不得声明为攻防 / 修速 / 战力倍率**。一旦可折算成量,就塌回
 *   deepCultivationRoi 实测的「267 倍指数补偿」陷阱。故效果全落在
 *   信息 / 选择 / 容错 / 荣誉 轴 —— 有界、平直的**能力位**,不随道果无界增长。
 *
 * 判定与锻造的生命周期在 core/heritageForge.ts;这里只定义"有哪些传承、门槛、效果轴"。
 */
export interface HeritageDef {
  id: string;
  name: string;
  /** 境界门槛 2..9 —— 本世必须达到该境界才解锁对应传承;金丹(major 2)以下浅修永远锻造不出 */
  gateMajor: number;
  /** 必须是有界、平直的能力位,禁止"随世缩放"的百分数效果 */
  effect: "bounded-flat";
  /** 效果轴:信息/选择/容错/荣誉 —— 不允许 avat/攻防/修速 这类量词混进来 */
  axis: "choice" | "fault-tolerant" | "honor";
  /** 玩家向文案(参与红线扫描) */
  desc: string;
  /** 机制侧描述(参与红线扫描 —— 防止把能力位偷偷写成倍率) */
  effectDesc: string;
}

export type HeritageId = string;

/**
 * 推荐基线 8 项(取自 ISS-302 设计文档,可替换,但必须守住
 * 「有界平直 + 非倍率 + 金丹刷不出」三条)。
 */
export const HERITAGE_DEFS: HeritageDef[] = [
  {
    id: "danxin",
    name: "浴火丹心",
    gateMajor: 2,
    effect: "bounded-flat",
    axis: "fault-tolerant",
    desc: "转世开局,本世前三炉炼丹必成",
    effectDesc: "出生后本世前三次开炉必定成功(新手手感,不炼也能不亏)",
  },
  {
    id: "yuanying",
    name: "元婴凝实",
    gateMajor: 3,
    effect: "bounded-flat",
    axis: "honor",
    desc: "转世起始境界保底从筑基起,而非炼气",
    effectDesc: "出生时起始境界下限抬到筑基(尊重,重置从 partial 起步)",
  },
  {
    id: "baihuang",
    name: "化神百炼",
    gateMajor: 4,
    effect: "bounded-flat",
    axis: "choice",
    desc: "解锁一个额外的炼器 / 法宝传承位",
    effectDesc: "额外开放一个炼器/法宝位(平直能力位,非数值加减)",
  },
  {
    id: "tonggan",
    name: "炼虚通感",
    gateMajor: 5,
    effect: "bounded-flat",
    axis: "choice",
    desc: "转世择先天之姿时,多一个可选项",
    effectDesc: "转世的三选一变为四选一(多一份选择,不白给属性)",
  },
  {
    id: "shouzhuo",
    name: "合体守拙",
    gateMajor: 6,
    effect: "bounded-flat",
    axis: "fault-tolerant",
    desc: '炼丹 / 炼器 / 参悟失败时有"保底不毁"一档容错',
    effectDesc: "炼制/参悟失败不炸品一次性的下限钳制(纯容错)",
  },
  {
    id: "daotong",
    name: "大乘道统",
    gateMajor: 7,
    effect: "bounded-flat",
    axis: "honor",
    desc: "转世时已习功法等级全部保留,不再折回起手",
    effectDesc: "转世交割时按原等级带走已习功法(本作默认折回一层)",
  },
  {
    id: "dubu",
    name: "渡劫跬步",
    gateMajor: 8,
    effect: "bounded-flat",
    axis: "fault-tolerant",
    desc: "渡劫失败不掉阶 / 不散修为,一次",
    effectDesc: "突破失败豁免一次降阶或修为损耗(纯容错)",
  },
  {
    id: "daoben",
    name: "真仙道痕",
    gateMajor: 9,
    effect: "bounded-flat",
    axis: "honor",
    desc: "转世睁眼即认得世间所有灵材,不必按境界补认知",
    effectDesc: "出生时认知按最高档全带(所见即所学,平直开放)",
  },
];

const BY_ID = new Map<string, HeritageDef>(HERITAGE_DEFS.map((d) => [d.id, d]));

export function heritageDef(id: string): HeritageDef | undefined {
  return BY_ID.get(id);
}
