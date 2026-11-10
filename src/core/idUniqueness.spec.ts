/**
 * 每个内容表的 id 必须唯一 —— 这条一直没有判据直接管。
 *
 * ## 由来
 *
 * 第 46 / 52 / 54 / 72 轮,我先后四次撞了 id:
 *
 * ```text
 * 第 46 轮  pills      p_taixu 撞了既有「太虚丹」
 * 第 52 轮  artifacts  四件法宝 id 撞车
 * 第 54 轮  pills      p_yongchang 撞了「永昌丹」(延寿丹)
 * 第 72 轮  pills      p_taixu 又撞了(同一个 id 撞两次)
 * ```
 *
 * **四次都是靠别的判据的间接症状发现的**:
 * - `contentReachabilityAudit` 报「expected 56 to be 57」——集合大小与数组长度不等
 * - `herbGrades` 报「第 p_taixu 方无成本」——按 id 查到的是另一味丹
 *
 * 这些报告都不指向「id 重复」这个真因。**一条直接查 id 唯一的判据,能让这四次
 * 都在第一秒就说清楚。**
 *
 * ## 为什么不是「用 Map 去重就行」
 *
 * 代码里不少地方用 `new Map(items.map(x => [x.id, x]))` 建索引 —— 那样重复 id
 * **不会报错,只会静默地丢掉后一个**。表头的数量判据(`dataHeaderAudit`)看的是
 * 数组长度,所以「数组 75 味、索引 74 条」这种不一致它看不出来。
 *
 * 唯一能拦住的是直接数:数组长度 vs `Set(id)` 的大小。
 *
 * ## 判据
 *
 * 每张内容表:`new Set(表.map(x => x.id)).size === 表.length`。
 * 报错时列出重复的 id 与各自的条目名(名字也要不一样,否则两个都叫「太虚丹」时
 * 光看 id 还不知道撞的是谁)。
 */
import { describe, expect, it } from "vite-plus/test";
import { ACHIEVEMENTS } from "@/data/achievements";
import { AFFIXES } from "@/data/affixes";
import { ARTIFACTS } from "@/data/artifacts";
import { DAILY_TASKS, MAIN_QUESTS } from "@/data/quests";
import { EQUIPMENT_TEMPLATES } from "@/data/equipment";
import { EVENTS, FORTUNE_EVENTS } from "@/data/events";
import { GONGFA } from "@/data/gongfa";
import { GONGFA_BRANCHES } from "@/data/gongfaBranches";
import { MUTATORS } from "@/data/mutators";
import { PACTS } from "@/data/pacts";
import { PETS } from "@/data/pets";
import { PILLS } from "@/data/pills";
import { REGIONS } from "@/data/regions";
import { SOUL_TYPES } from "@/data/souls";
import { TALENTS } from "@/data/talents";
import { TRIALS } from "@/data/endgame";

interface Identified {
  id: string;
  name?: string;
}

const TABLES: readonly { label: string; rows: readonly Identified[] }[] = [
  { label: "丹药", rows: PILLS },
  { label: "法宝", rows: ARTIFACTS },
  { label: "灵兽", rows: PETS },
  { label: "功法", rows: GONGFA },
  { label: "悟道分支", rows: GONGFA_BRANCHES },
  { label: "装备模板", rows: EQUIPMENT_TEMPLATES },
  { label: "际遇", rows: EVENTS },
  { label: "机缘", rows: FORTUNE_EVENTS },
  { label: "变数", rows: MUTATORS },
  { label: "契约", rows: PACTS },
  { label: "试炼", rows: TRIALS },
  { label: "天赋", rows: TALENTS },
  { label: "词条", rows: AFFIXES },
  { label: "器魂", rows: SOUL_TYPES },
  { label: "地域", rows: REGIONS },
  { label: "成就", rows: ACHIEVEMENTS },
  { label: "主线", rows: MAIN_QUESTS },
  { label: "日常", rows: DAILY_TASKS },
];

describe("内容表 · id 唯一", () => {
  it("每张表的 id 都不重复", () => {
    const offenders: string[] = [];
    for (const { label, rows } of TABLES) {
      const seen = new Map<string, string[]>();
      for (const row of rows) {
        seen.set(row.id, [...(seen.get(row.id) ?? []), row.name ?? "(无名)"]);
      }
      for (const [id, names] of seen) {
        if (names.length > 1) {
          offenders.push(`${label}: id「${id}」被 ${names.length} 条占用 —— ${names.join(" / ")}`);
        }
      }
    }
    expect(
      offenders,
      "这些表的 id 重复了 —— 按 id 建索引的地方会静默丢掉后一条:" + offenders.join("、"),
    ).toEqual([]);
  });

  it("反空转:确实量到了足够多的表与条目", () => {
    expect(TABLES.length, "表清单被清空了").toBeGreaterThanOrEqual(15);
    const total = TABLES.reduce((sum, t) => sum + t.rows.length, 0);
    expect(total, "一张表都没量到").toBeGreaterThan(1000);
  });
});
