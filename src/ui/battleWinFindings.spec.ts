/**
 * 战斗分析 · 赢了也要说「为什么赢」
 *
 * ## 缺口:胜利那一支不做归因
 *
 * `core/battleAnalysis.analyzeBattle` 在**战败**时归因做得很细:被抢先是不是主因、
 * 承伤池怎么被打穿、下一步该往哪条路借力。而**胜利**时它直接返回:
 *
 * ```ts
 *   return { headline: `此战 N 回合而胜…`, findings: [], directions: [], dataRows };
 * ```
 *
 * 界面那一侧却早就铺好了 `findings` 与 `directions` 的渲染路径(见
 * `BattleIntelPanel` 的 `v-if="analysis.findings.length"`)—— 于是胜利时那一段
 * 永远是空的,玩家只看到一句「此战 3 回合而胜,战后气血 100%」。
 *
 * ## 为什么赢了更该说
 *
 * 胜利是**可复用的经验**:这一场靠什么赢下来的,下一场换个地界还能不能这么打。
 * 战败时玩家自己会去翻分析(他要找原因);胜利时他没这个动机,而这恰恰是最该
 * 学到东西的一刻。同一个面板,败了有归因、赢了没有,读起来像「赢了没什么好说的」。
 *
 * ## 只报**这一场真的成立**的事
 *
 * 胜利归因绝不能夸成「你很稳」—— 那只是形容词。每一条都必须由 `result` 里
 * 现成的读数支撑(回合数、战后气血、有没有被抢先、承伤占比…),写到具体数字或
 * 具体事实。读不出支撑的条目干脆不写,宁可少一条也不编。
 *
 * ## 与战败归因共用同一套形状
 *
 * `findings` 是 `{ text }`,界面已按它渲染;故胜利这一支只填 text,
 * 不新增字段、不改界面 —— 改动落在数据层一处。
 */
import { describe, expect, it } from "vite-plus/test";
import { analyzeBattle } from "@/core/battleAnalysis";
import type { CombatResult, CombatSideStats } from "@/types";
import { gn } from "@/utils/gnum";

/** 造一份最小的战斗结果 —— 走出**真实的 CombatResult 形状**,不自己发明字段 */
const result = (over: Partial<CombatResult> = {}): CombatResult => ({
  win: true,
  rounds: 3,
  playerHpPct: 1,
  log: [],
  ...over,
});

/** 一侧的战斗遥测 —— 字段按 `CombatSideStats` 补齐,缺一个都会让归因读到 undefined */
const side = (over: Partial<CombatSideStats> = {}): CombatSideStats => ({
  dealt: gn(900),
  taken: gn(100),
  pierceTaken: gn(0),
  biggestHitTaken: gn(40),
  healed: gn(0),
  shieldAbsorbed: gn(0),
  dodges: 0,
  missedHits: 0,
  hitsLanded: 10,
  counters: 0,
  combos: 0,
  crits: 3,
  skillCasts: 4,
  artifactProcs: 0,
  stunnedTurns: 0,
  ...over,
});

/** 一份「赢得干脆」的战斗统计 */
const strongStats = {
  player: side(),
  enemy: side({ dealt: gn(100), taken: gn(900), crits: 0 }),
};

describe("战斗分析 · 胜利归因", () => {
  it("胜利时给出 findings —— 不再是空数组", () => {
    const a = analyzeBattle(result({ stats: strongStats }), null);
    expect(a).not.toBeNull();
    expect(a!.findings.length, "赢了也该说清靠什么赢的").toBeGreaterThan(0);
  });

  it("每一条都带 text,且不含未填的占位符", () => {
    const a = analyzeBattle(result({ stats: strongStats }), null);
    for (const f of a!.findings) {
      expect(typeof f.text, "findings 的形状是 { text },界面已按它渲染").toBe("string");
      expect(f.text.trim().length).toBeGreaterThan(0);
      expect(f.text, `这一条漏了占位符:«${f.text}»`).not.toMatch(/NaN|undefined|Infinity/);
    }
  });

  it("归因必有据:短战与久战说法不同", () => {
    const quick = analyzeBattle(result({ rounds: 2, stats: strongStats }), null)!;
    const long = analyzeBattle(result({ rounds: 18, stats: strongStats }), null)!;
    const q = quick.findings.map((f) => f.text).join(" | ");
    const l = long.findings.map((f) => f.text).join(" | ");
    expect(q, "2 回合结束与 18 回合结束不该是同一句话").not.toBe(l);
  });

  it("被抢先时胜利也要提 —— 那是这一场真正的翻盘点", () => {
    const slow = analyzeBattle(
      result({
        rounds: 5,
        playerHpPct: 0.4,
        stats: {
          player: side({ taken: gn(500), crits: 0 }),
          enemy: side({ dealt: gn(500), taken: gn(900), crits: 0 }),
        },
        firstMove: { playerFirst: false, playerSpeed: 10, enemySpeed: 14 },
      } as never),
      null,
    )!;
    const joined = slow.findings.map((f) => f.text).join(" | ");
    expect(joined, "被抢先还能赢,那是翻盘点,必须说出来").toMatch(/抢先/);
  });

  it("惨胜与完胜说得出区别 —— 战后气血是这一场最硬的读数", () => {
    const narrow = analyzeBattle(
      result({ rounds: 9, playerHpPct: 0.06, stats: strongStats }),
      null,
    )!;
    const clean = analyzeBattle(result({ rounds: 9, playerHpPct: 1, stats: strongStats }), null)!;
    expect(narrow.findings.map((f) => f.text).join(" | ")).not.toBe(
      clean.findings.map((f) => f.text).join(" | "),
    );
  });

  it("没有 stats 时仍不崩,findings 为空而不是乱编", () => {
    const a = analyzeBattle(result({ stats: undefined }), null);
    /*
     * `stats` 缺席时 analyzeBattle 本来就返回 null(战报头那一行判的也是它)。
     * 这里守的是「不许为了让胜利有归因就去编」—— 没有读数就没有归因。
     */
    expect(a).toBeNull();
  });

  it("战败那一支不许被改动 —— 它本来就有归因", () => {
    const lose = analyzeBattle(
      result({
        win: false,
        rounds: 7,
        playerHpPct: 0,
        stats: {
          player: side({ dealt: gn(300), taken: gn(1200), crits: 0 }),
          enemy: side({ dealt: gn(1200), taken: gn(300), crits: 2 }),
        },
      }),
      null,
    )!;
    expect(lose.findings.length, "战败归因本来就该有").toBeGreaterThan(0);
    expect(lose.headline).toContain("败于");
  });
});
