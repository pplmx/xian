/**
 * 战果面板要把**每一个**统计字段都摆出来。
 *
 * ## 由来（第 213 轮，接「玩家能不能读到」那条线）
 *
 * `CombatSideStats` 上有 16 个字段，`core/combat` 每场都在算。而
 * `battleDataRows` 把它们折成若干行交给面板。
 *
 * 已有的判据只查了**两个标签**:
 *
 * ```ts
 * expect(rows.map((r) => r.label)).toContain("真伤承伤占比");
 * expect(rows.map((r) => r.label)).toContain("护盾吸收");
 * ```
 *
 * 删掉其余任何一行，它都不会红。
 *
 * ## 为什么这件事值得守
 *
 * 那一段代码里记着一次真实的取舍（第 199 行附近）:
 *
 * ```text
 * 闪避与被震慑此前只有**越过阈值**才被提到（胜局归因里 dodges >= 3、
 * 败局告警里 stunnedTurns >= 3）。于是 1~2 次这两个数在任何地方都读不到。
 * 实测震慑并不罕见:六种构筑 × 三个带震慑的敌人 × 四档强度共 360 局,
 * 33% 的对局有震慑，其中 101 场胜局里有 61 场被打断过 ——
 * 也就是说六成胜局里玩家挨了震慑，却一个字都看不到。
 * ```
 *
 * 那个结论花了 360 局模拟才得到。而它现在只由**一行代码**承着 ——
 * 谁顺手把那行删了，那 360 局的结论就白费了，且没有一条判据会拦。
 *
 * ## 这条判据守什么
 *
 * `CombatSideStats` 的**每个字段**都要在面板上有一处被展示（可以两三个字段合一行，
 * 比如「命中 / 落空」「暴击 / 连击 / 反击」）。
 *
 * 判法:字段名 → 它在 `battleDataRows` 里是否被读到。用类型定义作事实源，
 * 于是「新增一个统计字段却忘了展示」也会被抓到。
 *
 * ## 故障注入
 *
 * 删掉 `battleDataRows` 里「闪过 / 被打断」那一行 → 第二条红，点名 dodges / stunnedTurns。
 * 往 `CombatSideStats` 加一个没人展示的字段（`probeField?: number`）→ 第二条红，点名它。
 */
import { describe, expect, it } from "vite-plus/test";
import { readSource } from "@/test/readSource";
import { stripComments } from "@/test/stripComments";
import { battleDataRows } from "./battleAnalysis";
import type { CombatResult } from "@/types";

const TYPES = "src/types/index.ts";
const ANALYSIS = "src/core/battleAnalysis.ts";

/** 从 `CombatSideStats` 的类型定义里取出全部字段名 */
function sideStatFields(): string[] {
  const src = stripComments(readSource(TYPES));
  const at = src.indexOf("interface CombatSideStats");
  expect(at, "找不到 CombatSideStats").toBeGreaterThan(-1);
  const open = src.indexOf("{", at);
  let depth = 0;
  let end = -1;
  for (let i = open; i < src.length; i += 1) {
    if (src[i] === "{") depth += 1;
    else if (src[i] === "}") {
      depth -= 1;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  expect(end, "CombatSideStats 没闭合").toBeGreaterThan(open);
  const body = src.slice(open, end);
  return [...body.matchAll(/^\s{2}(\w+)[?]?:/gm)].map((m) => m[1]!);
}

/** 造一份每项都非零的战斗结果，只为拿到行数据 */
function resultWithFullStats(): CombatResult {
  const side = {
    dealt: 100,
    taken: 100,
    pierceTaken: 10,
    biggestHitTaken: 20,
    healed: 5,
    shieldAbsorbed: 3,
    dodges: 2,
    missedHits: 4,
    hitsLanded: 40,
    counters: 3,
    combos: 2,
    crits: 7,
    skillCasts: 2,
    artifactProcs: 1,
    stunnedTurns: 1,
  };
  return {
    win: true,
    rounds: 5,
    playerHpPct: 1,
    log: [],
    stats: { player: side, enemy: side },
  } as unknown as CombatResult;
}

describe("战果面板 · 每个统计字段都要有去处", () => {
  it("前提:类型上有足够多的字段，面板上有足够多的行", () => {
    const fields = sideStatFields();
    expect(fields.length, "CombatSideStats 的字段太少 —— 判据可能扫错了地方").toBeGreaterThan(10);
    const rows = battleDataRows(resultWithFullStats());
    expect(rows.length, "面板行太少 —— 前提要重做").toBeGreaterThan(6);
  });

  it("每个字段都被读到了", () => {
    const fields = sideStatFields();
    const src = stripComments(readSource(ANALYSIS));
    /*
     * 只看 `battleDataRows` 那个函数的正文 —— 别的函数读到某个字段不算展示。
     */
    const at = src.indexOf("export function battleDataRows");
    expect(at, "找不到 battleDataRows").toBeGreaterThan(-1);
    const end = src.indexOf("\n}", at);
    const body = src.slice(at, end);

    const missing = fields.filter((f) => !new RegExp(`\\b${f}\\b`).test(body));
    expect(
      missing,
      "这些统计字段算出来了，却没有摆到面板上 —— 玩家看不到它们，等于没算。" +
        "（那一段注释里记着:闪避与被震慑曾只有越过阈值才被提到，实测 33% 的对局有震慑、" +
        "六成胜局里玩家挨了震慑却一个字都看不到。这是花 360 局模拟换来的结论，" +
        "而它只由一行代码承着）:" +
        missing.join(" / "),
    ).toEqual([]);
  });

  it("判据自己认得出「没被展示」的字段（地基）", () => {
    const fields = ["dealt", "notShownAnywhere"];
    const body = "{ value: formatGN(p.dealt) }";
    const missing = fields.filter((f) => !new RegExp(`\\b${f}\\b`).test(body));
    expect(missing, "认不出没被展示的字段").toEqual(["notShownAnywhere"]);
  });
});
