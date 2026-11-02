/**
 * 仙路旅途 —— 把「境界表 + 所在界」翻译成一条 21 境的横向刻度
 *
 * 修炼页只显示当前一境,玩家看不到自己从凡到混沌走到哪了、前面还有几境。
 * 这条刻度是**纵向全景**:21 个境点一路排开,已至的点了墨、眼下这境脉动、
 * 未至的虚待;界首处立界门,四界的名字标在各自那一段的下方。
 *
 * 纯函数只做一件事:按当前境判出每境的三态与界首标记 —— UI 拿它渲染,
 * 判定不散落在视图里,里程碑(0/9/14/18 四界首)也好被测试钉住。
 */
import { REALMS, WORLDS, isWorldEntry, MAX_MAJOR } from "@/data/realms";

export type RealmLadderState = "done" | "now" | "future";

export interface RealmLadderPoint {
  /** 境界索引(major),0~20 */
  index: number;
  name: string;
  /** 是否界首(人间/仙界/神界/混沌海的第一境)—— 界门上该立的一档 */
  worldStart: boolean;
  state: RealmLadderState;
}

export interface RealmLadderWorld {
  id: string;
  name: string;
  start: number;
  end: number;
  /** 本段在整条刻度上的中心位置(0~100%,UI 把界名钉在那里)。
      四界段长不一,均布(justify-between)会把仙界/神界标签偏向段首 ——
      界名是段的名,应当落在自己那一段的中央 */
  centerPct: number;
}

/**
 * 21 境刻度 —— 三态口径与 realmDef 一致:越界修正后再判,绝不让越界值
 * 把「已至」成片点亮或把「现在」推到刻度之外。
 */
export function realmLadderPoints(major: number): RealmLadderPoint[] {
  const m = Math.max(0, Math.min(MAX_MAJOR, major));
  return REALMS.map((r, i) => ({
    index: i,
    name: r.name,
    worldStart: isWorldEntry(i),
    state: i < m ? "done" : i === m ? "now" : "future",
  }));
}

/**
 * 「第 N / M 境」—— 全站这枚读数的唯一拼法。
 *
 * 它在四处出现(修行页首屏、修行页章首、人物页、修炼圆盘),从前各写一遍
 * `player.major + 1` 与 `/ ${REALMS.length}`;分母还有个变体用 `points.length`
 * (那是 `REALMS.map(...)` 的长度,今天相等,明天未必)。读数抽出来之后,
 * 分母只认 REALMS.length 一处,「第 21 / 21 境」不会因为谁少加一而错位。
 */
export function realmOrdinalText(major: number): string {
  const total = REALMS.length;
  /*
   * 脏档夹回 1~total:读数是给人看的,不能印出「第 0 / 21 境」。
   * Infinity 单独处理 —— 它表达「远超末境」,落末境比落首境更接近玩家意图;
   * 若与 NaN 一起落回首境,一个练到顶的坏档会显示成「第 1 境」。
   */
  const m =
    major === Number.POSITIVE_INFINITY ? total - 1 : Number.isFinite(major) ? Math.trunc(major) : 0;
  const ordinal = Math.min(total, Math.max(1, m + 1));
  return `第 ${ordinal} / ${total} 境`;
}

/** 四界段位 —— 界名、首尾索引从 data 直接继承,UI 不另抄第二份。
    段心的算式:段中点那把「第几格」折算成刻度百分比 ——
    段 [a,b] 的中点格是 (a+b)/2,格心在 +0.5,故 ((a+b)/2+0.5)/21×100 */
export function realmLadderWorlds(): RealmLadderWorld[] {
  return WORLDS.map((w) => ({
    id: w.id,
    name: w.name,
    start: w.start,
    end: w.end,
    centerPct: (((w.start + w.end) / 2 + 0.5) / REALMS.length) * 100,
  }));
}
