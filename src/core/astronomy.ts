/**
 * 星象值日(Phase 34.5)—— 二十八宿轮值,利一方界域
 *
 * 与天时的分工:
 * - 天时:今日天地之气(灵雨/赤阳/雷鸣……),影响**所有**地方的收益;
 * - 值日之宿:今日之星象,只利**一方界域**(四象配四界的游戏约定,见 data/xiangxiu)。
 *
 * 故它给的不是又一个全局加成,而是一个"今日该往哪里去"的提示:
 * 值日宿所属之象,所配界域的际遇更易遇上(见 exploration 的际遇判定)。
 *
 * 确定性:由**游戏总秒数**派生,同一游戏日固定,无现实时间依赖(与天时同法)。
 * 这一层是**纯函数** —— 游戏总秒数由调用方给(引擎 / 离线结算 / 视图都拿得到
 * `game.totalPlaySec`),天文自己不读 store:这样测它不必先搭一套 Pinia。
 */
import { MANSIONS, imageDef, type MansionDef } from "@/data/xiangxiu";
import { regionDef } from "@/data/regions";
import { worldOf } from "@/data/realms";
import type { WorldId } from "@/types";

/** 值日之宿所利界域的际遇加成(乘在际遇概率上) */
export const MANSION_EVENT_LUCK = 0.1;

/** 游戏日 → 值日之宿(28 日一轮) */
export function mansionOfDay(day: number): MansionDef {
  const idx = ((Math.floor(day) % MANSIONS.length) + MANSIONS.length) % MANSIONS.length;
  return MANSIONS[idx]!;
}

/** 今日值日之宿(总秒数由调用方给) */
export function todayMansion(totalPlaySec: number): MansionDef {
  return mansionOfDay(Math.floor(totalPlaySec / 86400));
}

/** 此宿所利之界域(四象配四界的游戏约定) */
export function favoredWorld(mansion: MansionDef): WorldId {
  return imageDef(mansion.image)?.world ?? "mortal";
}

/** 某地界今日是否得星象之利 */
export function isFavoredRegion(regionId: string, totalPlaySec: number): boolean {
  const region = regionDef(regionId);
  if (!region) return false;
  return favoredWorld(todayMansion(totalPlaySec)) === worldOf(region.minRealm).id;
}

/**
 * 星象给此地的际遇加成:值日宿所配界域之地 +10%,他处不加。
 * 值日之宿本身不加全局数值 —— 否则它就成了第二个天时。
 */
export function mansionEventLuck(regionId: string, totalPlaySec: number): number {
  return isFavoredRegion(regionId, totalPlaySec) ? MANSION_EVENT_LUCK : 0;
}

/** 今日星象一句话(展示层直接用,不另写一份) */
export function todayMansionLine(totalPlaySec: number): string {
  const m = todayMansion(totalPlaySec);
  const img = imageDef(m.image);
  return `${m.fullName}直日 · ${img?.name ?? ""}${img?.direction ?? ""}方 · 分野${m.domain} —— 宜${m.good}`;
}
