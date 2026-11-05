/**
 * 数据表头计数审计
 *
 * 各 data/*.ts 的头注释常写着「N 条 / N 件 / N 个」,给读代码的人一个规模印象。
 * 但内容一加,这些数字就悄悄过期 —— 刚清过的就有词条 118→110、法宝 20→26、
 * 装备 50→77、天赋 30→33。这类"看着像事实的注释"比没有注释更坏。
 *
 * 这里不重抄一张表,而是**读源码文本、取头注释里声明的数字,再与真实数组长度比对**:
 * 谁改了内容忘了改注释,这里立刻红。
 */
import { describe, expect, it } from "vite-plus/test";
import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { AFFIXES } from "@/data/affixes";
import { ARTIFACTS } from "@/data/artifacts";
import { EQUIPMENT_TEMPLATES } from "@/data/equipment";
import { TALENTS } from "@/data/talents";
import { ENEMIES } from "@/data/enemies";
import { BUILDINGS } from "@/data/buildings";
import { REGIONS } from "@/data/regions";
import { PILLS } from "@/data/pills";
import { ACHIEVEMENTS } from "@/data/achievements";
import { EVENTS } from "@/data/events";
import { CHAINS } from "@/data/chains";
import { TRIGRAMS } from "@/data/yijing";
import { PALACES } from "@/data/ziwei";
import { MANSIONS } from "@/data/xiangxiu";
import { GATES } from "@/data/qimen";
import { GONGFA } from "@/data/gongfa";
import { GONGFA_BRANCHES } from "@/data/gongfaBranches";
import { MAIN_QUESTS } from "@/data/quests";
import { MENTORS } from "@/data/mentors";
import { DAO_PATHS, CELESTIAL_WORLDS, TRIALS } from "@/data/endgame";
import { PACTS } from "@/data/pacts";
import { MUTATORS } from "@/data/mutators";
import { LIFE_THEMES } from "@/data/lifeThemes";
import { SAMSARA_STAGES } from "@/data/samsara";
import { REALMS, WORLDS } from "@/data/realms";
import { DAOLU } from "@/data/daolu";
import { FORTUNE_EVENTS } from "@/data/events";
import { TITLES } from "@/data/titles";
import { PETS } from "@/data/pets";

const SOURCES = import.meta.glob("../data/*.ts", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

/** 文件名(相对 data/)→ 该文件导出的数组,及其头注释里声明的规模 */
const TABLES: { file: string; label: string; length: number }[] = [
  { file: "affixes.ts", label: "词条", length: AFFIXES.length },
  { file: "artifacts.ts", label: "法宝", length: ARTIFACTS.length },
  { file: "equipment.ts", label: "装备模板", length: EQUIPMENT_TEMPLATES.length },
  { file: "talents.ts", label: "天赋", length: TALENTS.length },
  { file: "enemies.ts", label: "敌人", length: ENEMIES.length },
  { file: "buildings.ts", label: "建筑", length: BUILDINGS.length },
  { file: "regions.ts", label: "区域", length: REGIONS.length },
  { file: "pills.ts", label: "丹药", length: PILLS.length },
  { file: "achievements.ts", label: "成就", length: ACHIEVEMENTS.length },
  { file: "events.ts", label: "随机事件(含奇缘阶段)", length: EVENTS.length },
  { file: "chains.ts", label: "奇缘", length: CHAINS.length },
  { file: "yijing.ts", label: "单卦", length: TRIGRAMS.length },
  { file: "ziwei.ts", label: "宫", length: PALACES.length },
  { file: "xiangxiu.ts", label: "星宿", length: MANSIONS.length },
  { file: "qimen.ts", label: "门", length: GATES.length },
];

describe("数据表头计数 · 与真实数组长度一致", () => {
  it("头注释里写的规模,就是数组的实际长度", () => {
    for (const t of TABLES) {
      const raw = SOURCES[`../data/${t.file}`];
      expect(raw, `找不到数据文件 ${t.file}`).toBeTruthy();
      // 头注释:文件前 4 行里第一个「N 条/件/个/座/处/味」
      const head = raw!.split("\n").slice(0, 4).join("\n");
      const m = /(\d+)\s*(条|件|个|座|处|味)/.exec(head);
      expect(m, `${t.file} 的头注释里没有可核对的规模数字(${t.label})`).not.toBeNull();
      expect(Number(m![1]), `${t.file} 头注释写「${m![1]}」,实际 ${t.length} ${t.label}`).toBe(
        t.length,
      );
    }
  });
});

/**
 * 别处代码注释里对「某张表有多少条」的引用,也得跟着表走。
 *
 * 数据文件自己的头注由上面那条守着,文档由下面那条守着 —— 而**代码注释**两头都没管。
 * 实测 `core/engineUnlocks.ts` 的头注释写着「`data/achievements` 的 62 枚」,
 * 而成就是 66 枚:这行字不参与任何计算、没有任何判据会红,
 * 只是让读它的人按错的分母理解「成就对库的接入」这件事。
 *
 * 这类注释有个可机器识别的形状:**反引号包住的 `data/<表名>` + 一个数 + 量词**。
 * 判据只认这个形状 —— 认宽了会把散文里所有数字都当成承诺,那是另一种噪音;
 * 认这个形状,既能抓住真实引用,也不会误伤普通叙述。
 *
 * 新增一处这类引用会被自动纳入;删掉它,这条判据也不会因为没东西可查而变成空转
 * (下面另有一条反空转)。
 */
describe("代码注释 · 引用数据表规模的数字", () => {
  /** 源码文本(排除 data/ 自己的头注与 spec 本身,它们各有判据) */
  const SOURCE_FILES = (() => {
    const out: Record<string, string> = {};
    const walk = (dir: string): void => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (/\.(ts|vue)$/.test(entry.name)) out[full] = readFileSync(full, "utf8");
      }
    };
    walk(resolve(__dirname, ".."));
    return out;
  })();

  /** 表名 → 真实条数;数据文件头注那条判据用的同一份 TABLES */
  const REAL_LENGTH = new Map<string, { n: number; label: string }>();
  for (const t of TABLES) REAL_LENGTH.set(t.file, { n: t.length, label: t.label });

  /** 在注释行里找「`data/xxx` 的 N 量词」 */
  function claimIn(text: string): { file: string; n: number }[] {
    const out: { file: string; n: number }[] = [];
    // 引用写成 `data/achievements`(反引号里不带 .ts)或 `data/achievements.ts`,两种都认
    const re = /`data\/([a-zA-Z]+)(?:\.ts)?`\s*的\s*(\d+)\s*(?:枚|条|件|部|个|种|只)/g;
    for (const m of text.matchAll(re)) out.push({ file: `${m[1]}.ts`, n: Number(m[2]) });
    return out;
  }

  it("注释里写的表规模与真实条数一致", () => {
    const bad: string[] = [];
    let seen = 0;
    for (const [path, text] of Object.entries(SOURCE_FILES)) {
      if (path.includes("/data/") || path.endsWith(".spec.ts")) continue;
      for (const claim of claimIn(text)) {
        const real = REAL_LENGTH.get(claim.file);
        if (!real) {
          bad.push(`${path}:引用了不存在的表 data/${claim.file}`);
          continue;
        }
        seen += 1;
        if (claim.n !== real.n) {
          bad.push(`${path}:注释写 data/${claim.file} 有 ${claim.n},实际 ${real.n} ${real.label}`);
        }
      }
    }
    expect(bad, `这些注释里的规模数已过期:\n  ${bad.join("\n  ")}`).toEqual([]);
    expect(seen, `一处这类引用都没扫到 —— 判据退化成空转了`).toBeGreaterThan(0);
  });
});

/**
 * 玩法文档里的数量也得跟着表走。
 *
 * 数据文件的头注有上一条守着,文档没有 —— 于是它一路飘:功法早已 63 部 141 条分支,
 * 它还写着「46 部 / 107 条」;装备涨到 288 件,它还是「77 模板」;区域的尽头早不是
 * 九幽魔渊(那只是 16 阶),它仍写着「自青云山麓至九幽魔渊」。
 *
 * 判据不从文档出发,而是**从表数出数、再要求文档里那句话长得一样** ——
 * 内容一涨,这句话就对不上,这里先红。散文里的措辞可以改,数字不能自作主张。
 *
 * 数量从 README 搬到 `docs/usage.md`(README 现在只当门面),所以这里读的是那份文档。
 */
describe("玩法文档 · 数字与表一致", () => {
  const readme = readFileSync(resolve(__dirname, "../../docs/usage.md"), "utf8");

  it("特色段里点名的数量,都能在表里数出来", () => {
    const claims: [string, string][] = [
      ["功法部数", `${GONGFA.length} 部功法`],
      ["悟道分支", `${GONGFA_BRANCHES.length} 条分支`],
      ["区域数", `${REGIONS.length} 个区域`],
      ["敌人数", `${ENEMIES.length} 种敌人`],
      ["随机事件", `${EVENTS.length} 个随机事件`],
      ["机缘类数", `${FORTUNE_EVENTS.length} 类机缘`],
      ["装备模板", `${EQUIPMENT_TEMPLATES.length} 种模板`],
      ["词条数", `${AFFIXES.length} 条词条`],
      ["法宝数", `${ARTIFACTS.length} 件法宝`],
      ["灵兽数", `${PETS.length} 只灵兽`],
      ["成就数", `${ACHIEVEMENTS.length} 个成就`],
      ["称号数", `${TITLES.length} 枚称号`],
    ];
    const missing = claims
      .filter(([, text]) => !readme.includes(text))
      .map(([what, text]) => `${what}: README 里找不到「${text}」`);
    expect(missing, missing.join("\n")).toEqual([]);
  });

  it("系统一览表的每一行,数字也与表一致", () => {
    const rows: [string, string][] = [
      ["境界", `| 境界 | ${WORLDS.length} 界域 × ${REALMS.length} 境`],
      ["装备", `= ${EQUIPMENT_TEMPLATES.length} 模板`],
      [
        "功法",
        `| 功法 | ${GONGFA.length} 部（主修 / 辅修 / 秘术），圆满后开启 ${GONGFA_BRANCHES.length} 条悟道分支`,
      ],
      ["炼制", `| 炼制 | ${PILLS.length} 丹药 + ${ARTIFACTS.length} 法宝`],
      ["灵兽", `| 灵兽 | ${PETS.length} 只`],
      ["人缘", `| 人缘 | ${DAOLU.length} 位道侣 + ${MENTORS.length} 位师承`],
      ["轮回", `| 轮回 | ${SAMSARA_STAGES.length} 阶段积累见识，${LIFE_THEMES.length} 种人生主题`],
      [
        "终局",
        `| 终局 | ${DAO_PATHS.length} 道途 + ${CELESTIAL_WORLDS.length} 天界远征 + ${TRIALS.length} 试炼 + ${PACTS.length} 契约 + ${MUTATORS.length} 变数`,
      ],
      [
        "任务",
        `| 任务 | ${MAIN_QUESTS.length} 主线任务 + 每日任务 + ${ACHIEVEMENTS.length} 成就 + ${TITLES.length} 称号`,
      ],
    ];
    const missing = rows
      .filter(([, text]) => !readme.includes(text))
      .map(([what, text]) => `${what}: README 里找不到「${text}」`);
    expect(missing, missing.join("\n")).toEqual([]);
  });
});
