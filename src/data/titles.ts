/**
 * 称号 —— 由成就解锁,可佩戴一枚
 *
 * ## 境界称号是一条**不降的荣誉阶梯**
 *
 * 每一大境界都有一顶(见 core/titleLadder.spec 的第一条:缺了谁就点名)。
 * 既是阶梯,数值就不能回落 —— 但此前它是断的:
 *   元婴大能(境3)0.3 < 金丹老祖(境2)0.4;
 *   万道之祖(境20,证道混沌道祖!)0.4 < 开天神魔(境19)0.6。
 * 玩家换上后一境的称号,却发现它更弱 —— 荣誉就成了笑话。
 *
 * 故按**境界 +0.02 预算一档**重排(修补取保守方向:只抬低于阶梯的,
 * 已经发到玩家手上的称号一律不削弱),每顶保留自己的属性构成 ——
 * 渡劫行者照旧给天劫抗性、破界入神照旧给攻血,身份感不动,只是分量跟着境界走。
 */
import type { TitleDef } from "@/types";

export const TITLES: TitleDef[] = [
  { id: "ti_churu", name: "初入仙途", desc: "踏出修行第一步", mods: { cultivationSpeed: 0.02 } },
  { id: "ti_lianqi", name: "炼气修士", desc: "炼气境修至圆满", mods: { cultivationSpeed: 0.03 } },
  {
    id: "ti_zhuji",
    name: "筑基真人",
    desc: "筑就大道之基",
    mods: { cultivationSpeed: 0.04, maxHpPct: 0.03 },
  },
  {
    id: "ti_jindan",
    name: "金丹老祖",
    desc: "丹成之日,山呼海啸",
    mods: { cultivationSpeed: 0.05, attackPct: 0.04 },
  },
  {
    id: "ti_yuanying",
    name: "元婴大能",
    desc: "元婴一出,谁与争锋",
    mods: { cultivationSpeed: 0.085, breakthroughRate: 0.015 },
  },
  { id: "ti_slayer", name: "百兽辟易", desc: "斩妖除魔数百计", mods: { attackPct: 0.06 } },
  {
    id: "ti_wanfa",
    name: "一剑破万法",
    desc: "击败十位区域之主",
    mods: { attackPct: 0.08, critRate: 0.02 },
  },
  {
    id: "ti_tianjiao",
    name: "天命之人",
    desc: "获得一件天品以上装备",
    mods: { luck: 0.05, dropRate: 0.04 },
  },
  { id: "ti_baolian", name: "百炼成钢", desc: "强化装备百次", mods: { defensePct: 0.06 } },
  { id: "ti_danwang", name: "丹道圣手", desc: "炼丹百炉不辍", mods: { alchemyYield: 0.1 } },
  {
    id: "ti_zhuanshi",
    name: "轮回行者",
    desc: "历经一次轮回",
    mods: { cultivationSpeed: 0.05, expGain: 0.05 },
  },
  { id: "ti_changsheng", name: "万古长生", desc: "寿元逾万载", mods: { lifespanPct: 0.1 } },
  // ---- 境界称号:每一大境界一顶 ----
  // 每个境界都得有一顶可戴的荣誉(与「每境有新功法/新丹方」同一条理由):
  // 只有 0~3 与 9/14/20 有称号时,中间十余境过完连个名字都没留下。
  {
    id: "ti_huashen",
    name: "化神真人",
    desc: "神念离体而不散,可同时照看三件事",
    mods: { cultivationSpeed: 0.055, qiRegen: 0.055 },
  },
  {
    id: "ti_lianxu",
    name: "炼虚道君",
    desc: "把杂念一层层炼干净,剩下的那点才叫神",
    mods: { cultivationSpeed: 0.055, damageReduction: 0.035 },
  },
  {
    id: "ti_heti",
    name: "合体真君",
    desc: "身与道不再分家,抬手便是道的形状",
    mods: { cultivationSpeed: 0.07, maxHpPct: 0.06 },
  },
  {
    id: "ti_dacheng",
    name: "大乘尊者",
    desc: "路已经走完,只等天上那一声",
    mods: { cultivationSpeed: 0.075, attackPct: 0.065 },
  },
  {
    id: "ti_dujie",
    name: "渡劫行者",
    desc: "九道雷都劈过了,还站在这里",
    mods: { cultivationSpeed: 0.08, tribulationResist: 0.065 },
  },
  // ---- 界域里程碑称号(扩界)----
  {
    id: "ti_zhenxian",
    name: "得证仙位",
    desc: "飞升仙界,证得真仙",
    mods: { cultivationSpeed: 0.065, qiRegen: 0.065 },
  },
  {
    id: "ti_xuanxian",
    name: "玄仙真人",
    desc: "仙骨换过一副,凡俗的伤再也留不住",
    mods: { cultivationSpeed: 0.085, luck: 0.055 },
  },
  {
    id: "ti_jinxian",
    name: "金仙道尊",
    desc: "火烧水淹都试过,这具身没留下痕迹",
    mods: { cultivationSpeed: 0.07, damageBonus: 0.06 },
  },
  {
    id: "ti_taiyi",
    name: "太乙上人",
    desc: "百家法门看下来,原是同一处源头",
    mods: { cultivationSpeed: 0.14, breakthroughRate: 0.02 },
  },
  {
    id: "ti_daluo",
    name: "大罗真人",
    desc: "三界之内,已无一处去不得",
    mods: { cultivationSpeed: 0.085, maxHpPct: 0.06 },
  },
  {
    /*
     * 这一顶挂在神人境(境 14)的成就「神光照世」下,而**「神域之主」是神王的身份**
     * (realms.ts 的神王 lore 明写「神域之主为神王」,任务 q_shenwang 也叫这个名)。
     * 此前它叫「神域之主」,于是玩家在名号谱上先以神人境自称神域之主,
     * 翻两格又读到神王自称同一句 —— 同一页上先自称、再被别人自称。
     * 名分归还神王,这一顶按它自己的成就改名。
     */
    id: "ti_shenren",
    name: "破界入神",
    desc: "踏过天门那一日,仙籍上便抹去了名字",
    mods: { attackPct: 0.095, maxHpPct: 0.08 },
  },
  {
    id: "ti_shenjiang",
    name: "天罚神将",
    desc: "执的兵器自己会选主,选定了便不换",
    mods: { cultivationSpeed: 0.09, critRate: 0.025 },
  },
  {
    id: "ti_shenwang",
    name: "神王御宇",
    desc: "一方神域既立,诏令不必落地便已成真",
    mods: { cultivationSpeed: 0.09, defensePct: 0.07 },
  },
  {
    id: "ti_shendi",
    name: "神帝独尊",
    desc: "诸神各据一方,此刻皆抬头看向同处",
    mods: { cultivationSpeed: 0.095, damageReduction: 0.045 },
  },
  {
    id: "ti_hundunling",
    name: "混沌真灵",
    desc: "身有终而灵无始,混沌里那点从没灭过",
    mods: { cultivationSpeed: 0.095, qiRegen: 0.095 },
  },
  {
    id: "ti_hundunshenmo",
    name: "开天神魔",
    desc: "神与魔在身内对峙,谁也吞不下谁",
    mods: { cultivationSpeed: 0.11, attackPct: 0.085 },
  },
  // 全境之极的那一顶就是最重的:玩家走完 21 境,佩戴的该是分量最深的一顶
  {
    id: "ti_daozu",
    name: "万道之祖",
    desc: "道在名前,而名字已不必再说",
    mods: { cultivationSpeed: 0.18, breakthroughRate: 0.04 },
  },
];

const BY_ID = new Map(TITLES.map((x) => [x.id, x]));

export function titleDef(id: string): TitleDef | undefined {
  return BY_ID.get(id);
}
