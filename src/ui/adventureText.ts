/**
 * 历练会话的战绩文案 —— 界面与收尾播报唯一出处
 *
 * 由来:会话的 wins/losses 一直并存,收尾却只渲染胜场 —— 「胜 2 场」
 * 分不出是两战全胜还是九战两胜,而这恰恰是「这趟值不值得再来」与
 * 「胜+负 ≥3 才算走过一趟」(track("explores") 的门槛)要看的数。
 *
 * 口径:全胜时只说胜场,不摆「负 0 场」;坏数先判 isFinite 再夹到 0
 * (Math.max(0, NaN) 仍是 NaN,直接拼进文案会吐 NaN 场)。
 */
import type { AdventureSession } from "@/types";

/** 会话战绩一行:全胜只报胜场,有负场才并列两本账 */
export function sessionRecordText(s: Pick<AdventureSession, "wins" | "losses">): string {
  const wins = Number.isFinite(s.wins) ? Math.max(0, Math.floor(s.wins)) : 0;
  const losses = Number.isFinite(s.losses) ? Math.max(0, Math.floor(s.losses)) : 0;
  if (losses <= 0) return `胜 ${wins} 场`;
  return `胜 ${wins} 场 · 负 ${losses} 场`;
}

export interface SessionStatRow {
  id: "record" | "events" | "loot" | "wudao";
  label: string;
  value: string;
}

function countText(value: number): string {
  return String(Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0);
}

/**
 * 收尾播报的「此行所得」—— 结算真的给了什么就说些什么。
 *
 * 由来:这一段原先是 `core/exploration` 里一句手拼的模板字面量,报了灵石、修为、
 * 悟道点与拾获件数,却漏了**器灵尘**(自动折算掉的装备换来的,见 DropSummary.dust)。
 * 于是同一份账在"面板上的本次所得"与"结束时的播报"两处说法不同:
 * 玩家看到面板写着 `器灵尘 +340`,结语里一个字都没有。
 *
 * 抽成纯函数是为了可测 —— 手拼字面量只能靠正则截文本,而那正是
 * 「文案里手写数字,改常数就撒谎」。现在判据喂一份账、断言读出的话。
 *
 * 口径与既有那几项一致:**只有真发生了才报**。0 尘不写「器灵尘 0」,
 * 正如悟道点为 0 时不写悟道点 —— 一趟什么都没折算,那句话就是噪音。
 * 顺序由「每趟必给」到「偶发」:灵石 → 修为 → 悟道点 → 拾获 → 器灵尘。
 */
export function sessionHaulText(input: {
  stone: string;
  exp: string;
  wudaoGain: number;
  itemGain: number;
  dustGain: number;
}): string {
  const count = (value: number): number =>
    Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
  const wudao = count(input.wudaoGain);
  const items = count(input.itemGain);
  const dust = count(input.dustGain);
  const parts = [`得灵石 ${input.stone}、修为 ${input.exp}`];
  if (wudao > 0) parts.push(`悟道点 ${wudao}`);
  if (items > 0) parts.push(`拾获 ${items} 件`);
  if (dust > 0) parts.push(`器灵尘 ${dust}`);
  return parts.join("、");
}

/** 征途簿四格:战绩、际遇、拾获、悟道共用这一份坏值兜底。 */
export function sessionStatRows(
  s: Pick<AdventureSession, "wins" | "losses" | "events" | "itemGain" | "wudaoGain"> | null,
): SessionStatRow[] {
  return [
    { id: "record", label: "战绩", value: s ? sessionRecordText(s) : "胜 0 场" },
    { id: "events", label: "际遇", value: s ? countText(s.events) : "0" },
    { id: "loot", label: "拾获", value: s ? countText(s.itemGain) : "0" },
    { id: "wudao", label: "悟道", value: s ? countText(s.wudaoGain) : "0" },
  ];
}
