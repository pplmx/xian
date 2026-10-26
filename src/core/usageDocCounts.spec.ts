/**
 * 玩法文档里的数字，必须与数据源对得上。
 *
 * 由来:`docs/usage.md` 是玩家看到的系统清单(README 链过去),里面写满了「66 部功法」
 * 「44 个区域」这类结构数。它们没有任何判据盯着 —— 实测已经漂了一处:灵脉在数据里
 * 是 7 条,文档写「4 条灵脉投资分红」,从四脉扩到七脉时没人回头改这一行。
 * 这类错误与「代码里写死一个会被常数改动的手写数字」同源:文案会自己变成假话。
 *
 * 判据:每条声明都带一个正则 + 一个真值。文档里那处必须找到、且找到的每个数都等于真值;
 * 找不到也算失败 —— 免得改文案时悄悄把这条判据放空(绿得毫无信息)。
 * 真值一律从 `@/data` 取,不在本文件里手抄第二份。
 */
import { describe, expect, it } from "vite-plus/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { GONGFA } from "@/data/gongfa";
import { GONGFA_BRANCHES } from "@/data/gongfaBranches";
import { REGIONS } from "@/data/regions";
import { ENEMIES } from "@/data/enemies";
import { EVENTS } from "@/data/events";
import { PILLS } from "@/data/pills";
import { ARTIFACTS } from "@/data/artifacts";
import { PETS } from "@/data/pets";
import { MENTORS } from "@/data/mentors";
import { ACHIEVEMENTS } from "@/data/achievements";
import { MAIN_QUESTS } from "@/data/quests";
import { TITLES } from "@/data/titles";
import { LIFE_THEMES } from "@/data/lifeThemes";
import { TRIBULATIONS } from "@/data/tribulations";
import { TALENTS } from "@/data/talents";
import { SKILLS } from "@/data/crafting";
import { AFFIXES } from "@/data/affixes";
import { PACTS } from "@/data/pacts";
import { MUTATORS } from "@/data/mutators";
import { DAOLU } from "@/data/daolu";
import { EQUIPMENT_TEMPLATES, EQUIP_SLOT_NAMES } from "@/data/equipment";
import { QUALITIES } from "@/data/qualities";
import { DAO_PATHS, TRIALS, CELESTIAL_WORLDS } from "@/data/endgame";
import { BUILDINGS } from "@/data/buildings";
import { VEINS } from "@/data/veins";
import { MANSIONS } from "@/data/xiangxiu";
import { PALACES } from "@/data/ziwei";
import { HEXAGRAMS } from "@/data/yijing";
import { REALMS, WORLDS } from "@/data/realms";
import { ELEMENTS } from "@/data/linggen";
import { SOUL_GRADES, SOUL_SLOTS, SOUL_TYPES } from "@/data/souls";
import { SAMSARA_STAGES } from "@/data/samsara";

const DOC = readFileSync(resolve(__dirname, "../../docs/usage.md"), "utf8");

type Claim = { label: string; actual: number; patterns: RegExp[] };

const CLAIMS: Claim[] = [
  { label: "界域", actual: WORLDS.length, patterns: [/(\d+) 界域/g] },
  { label: "境界", actual: REALMS.length, patterns: [/(\d+) 境 ×/g] },
  { label: "天劫", actual: TRIBULATIONS.length, patterns: [/(\d+) 类天劫/g] },
  { label: "灵根", actual: Object.keys(ELEMENTS).length, patterns: [/(\d+) 种灵根/g] },
  { label: "天赋", actual: TALENTS.length, patterns: [/(\d+) 种天赋/g] },
  { label: "功法", actual: GONGFA.length, patterns: [/(\d+) 部功法/g] },
  {
    label: "悟道分支",
    actual: GONGFA_BRANCHES.length,
    patterns: [/(\d+) 条分支/g, /(\d+) 条悟道分支/g],
  },
  { label: "区域", actual: REGIONS.length, patterns: [/(\d+) 个区域/g] },
  { label: "敌人", actual: ENEMIES.length, patterns: [/(\d+) 种敌人/g, /(\d+) 敌人/g] },
  { label: "随机事件", actual: EVENTS.length, patterns: [/(\d+) 个随机事件/g, /(\d+) 事件/g] },
  {
    label: "装备槽位",
    actual: Object.keys(EQUIP_SLOT_NAMES).length,
    patterns: [/(\d+) 个装备槽位/g, /(\d+) 槽位 · /g],
  },
  {
    label: "装备模板",
    actual: EQUIPMENT_TEMPLATES.length,
    patterns: [/(\d+) 种模板/g, /(\d+) 模板\(/g],
  },
  { label: "词条", actual: AFFIXES.length, patterns: [/(\d+) 条词条/g] },
  { label: "品质", actual: QUALITIES.length, patterns: [/(\d+) 级品质/g] },
  { label: "丹药", actual: PILLS.length, patterns: [/(\d+) 种丹药/g, /(\d+) 丹药 \+/g] },
  { label: "法宝", actual: ARTIFACTS.length, patterns: [/(\d+) 件法宝/g] },
  { label: "灵兽", actual: PETS.length, patterns: [/(\d+) 只灵兽/g] },
  { label: "道侣", actual: DAOLU.length, patterns: [/(\d+) 位道侣/g] },
  { label: "师尊", actual: MENTORS.length, patterns: [/(\d+) 位师尊/g, /(\d+) 位师承/g] },
  { label: "人生主题", actual: LIFE_THEMES.length, patterns: [/(\d+) 种人生主题/g] },
  { label: "道途", actual: DAO_PATHS.length, patterns: [/(\d+) 条道途/g] },
  {
    label: "天界远征",
    actual: CELESTIAL_WORLDS.length,
    patterns: [/(\d+) 重天界远征/g, /(\d+) 天界远征/g],
  },
  { label: "试炼", actual: TRIALS.length, patterns: [/(\d+) 种试炼/g, /(\d+) 试炼 \+/g] },
  { label: "契约", actual: PACTS.length, patterns: [/(\d+) 种契约/g, /(\d+) 契约 \+/g] },
  { label: "变数", actual: MUTATORS.length, patterns: [/(\d+) 类变数/g, /(\d+) 变数 \+/g] },
  { label: "成就", actual: ACHIEVEMENTS.length, patterns: [/(\d+) 个成就/g, /(\d+) 成就 \+/g] },
  {
    label: "主线任务",
    actual: MAIN_QUESTS.length,
    patterns: [/(\d+) 个主线任务/g, /(\d+) 主线任务/g],
  },
  { label: "称号", actual: TITLES.length, patterns: [/(\d+) 枚称号/g, /(\d+) 称号 \+/g] },
  { label: "技艺", actual: SKILLS.length, patterns: [/(\d+) 门技艺/g] },
  { label: "洞府建筑", actual: BUILDINGS.length, patterns: [/(\d+) 建筑/g] },
  { label: "灵脉", actual: VEINS.length, patterns: [/(\d+) 条灵脉/g] },
  { label: "星宿", actual: MANSIONS.length, patterns: [/(\d+) 宿/g] },
  { label: "紫微宫", actual: PALACES.length, patterns: [/(\d+) 宫 \d+ 主星/g] },
  { label: "重卦", actual: HEXAGRAMS.length, patterns: [/(\d+) 重卦/g] },
  {
    label: "轮回阶段",
    actual: SAMSARA_STAGES.length,
    patterns: [/(\d+) 个阶段/g, /(\d+) 阶段积累/g],
  },
  // 器魂:「6 类 × 6 阶器魂占 3 个槽位」—— 三个数各验一次
  { label: "器魂类别", actual: SOUL_TYPES.length, patterns: [/(\d+) 类 × \d+ 阶器魂/g] },
  { label: "器魂阶数", actual: SOUL_GRADES.length, patterns: [/\d+ 类 × (\d+) 阶器魂/g] },
  { label: "器魂槽位", actual: SOUL_SLOTS, patterns: [/(\d+) 个槽位/g] },
];

/** 逐条核账:返回所有「找不到」与「对不上」;空数组才算过 */
function auditUsageDoc(text: string): string[] {
  const bad: string[] = [];
  for (const claim of CLAIMS) {
    for (const pattern of claim.patterns) {
      const found = [...text.matchAll(pattern)].map((m) => Number(m[1]));
      if (found.length === 0) {
        bad.push(`${claim.label}:文档里找不到 ${pattern.source}`);
        continue;
      }
      for (const n of found) {
        if (n !== claim.actual) bad.push(`${claim.label}:文档写 ${n},数据是 ${claim.actual}`);
      }
    }
  }
  return bad;
}

describe("玩法文档 · 结构数字与数据源对账", () => {
  it("usage.md 里每一处结构数都等于真实条数", () => {
    expect(auditUsageDoc(DOC), "文案与数据源不一致 —— 改文档,别改判据").toEqual([]);
  });

  it("判据自证:把灵脉改回 4 条会被当场抓住", () => {
    // 这条正是本轮实测到的漂移(四脉扩到七脉时漏改)。若自证为空,说明判据放空了。
    const bad = auditUsageDoc(DOC.replace("7 条灵脉", "4 条灵脉"));
    expect(
      bad.some((m) => m.includes("灵脉")),
      `自证没抓住灵脉:${bad.join(" | ")}`,
    ).toBe(true);
  });
});
