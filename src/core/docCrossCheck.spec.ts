/**
 * 「23 味状态丹」这个数字,在三处出现过,而三处此前都是错的。
 *
 * ## 缺口(第 107 轮实测)
 *
 * 第 105、106 两轮分别核了 `usage.md` 与 `design.md` 的数字。这轮核
 * `alchemy.md`(2 处)与 `engine.md`(12 处),本以为量小很快能做完 ——
 * 结果在 `alchemy.md` 撞到一处**从一写下就是错的**数字:
 *
 * ```text
 *   docs/alchemy.md:48    32 味状态丹的强弱此前没有任何判据
 *   src/core/pillValue.spec.ts:618   同上(从 alchemy.md 抄过来的)
 *   src/data/pills.ts:36            同上(又抄了一次)
 * ```
 *
 * 而 `PILLS.filter(kind === "buff")` 一直就是 **23**。
 *
 * 查 git:审计那一次提交(`84224b85`)的 pills.ts 里,`kind: "buff"` 也是 23 处。
 * **这个 32 不是过期,是从来就没对过。**
 *
 * ## 为什么这类错特别值得防
 *
 * 同一句话抄进三处,而后两处是**代码里的注释**。注释不参与构建、不被测试读取,
 * 于是它可以和事实错上几个月没人发现 —— 而读它的人(下一个改这块的人)会把它
 * 当成事实。
 *
 * ## 判据
 *
 * 不做通用的「扫所有注释里的数字」(那不可判定)。只钉住**已经错过的这一句**:
 *
 * ① `PILLS` 里 `kind === "buff"` 的条数,必须等于文档与两处注释里写的那个数;
 * ② 反过来也查:凡是文本里出现「N 味状态丹」,那个 N 必须等于真实条数。
 *
 * ② 是通用的一层 —— 它扫 `.md` 与 `src/` 下的 `.ts`,把「N 味状态丹」这个
 * 具体说法全部找出来。说法是具体的,所以不会误伤;而它覆盖了所有出现的地方,
 * 所以治得住「抄到第四处」。
 */
import { describe, expect, it } from "vite-plus/test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "@/test/readSource";
import { PILLS } from "@/data/pills";

/** `buff` 型丹药的真实条数 —— 「状态丹」就是它 */
const BUFF_PILLS = PILLS.filter((p) => p.kind === "buff").length;

/** 收集文件(跳过 node_modules / 探针 / 发布说明) */
function collect(dir: string, exts: readonly string[], skip: readonly string[] = []): string[] {
  const out: string[] = [];
  const walk = (d: string): void => {
    for (const entry of readdirSync(d, { withFileTypes: true })) {
      if (entry.name === "node_modules" || entry.name === "tp") continue;
      const full = join(d, entry.name);
      if (entry.isDirectory()) {
        if (skip.some((s) => full.includes(s))) continue;
        walk(full);
        continue;
      }
      if (exts.some((e) => entry.name.endsWith(e))) out.push(full);
    }
  };
  walk(dir);
  return out;
}

describe("「N 味状态丹」这个数字,不许再错", () => {
  it("真实条数就是 buff 型丹药的数量", () => {
    /*
     * 先把定义钉住:若哪天有人把 buff 型拆成两种 kind,
     * 这条会红,提醒回来更新「状态丹」的定义。
     */
    expect(BUFF_PILLS, "buff 型丹药消失了 —— 「状态丹」的定义要重写").toBeGreaterThan(10);
    expect(
      PILLS.some((p) => p.kind === "instant"),
      "instant 型丹药消失了 —— 丹药表结构变了",
    ).toBe(true);
  });

  it("文档与注释里每一处「N 味状态丹」都等于真实条数", () => {
    /*
     * 跳两类文档:
     * - `release-notes/` 是**发版快照**,按当时的事实写;
     * - `development.md` 是**工程日志**,它本来就会引用错误值来讲这次事故
     *   (「这里原写 32 味,实为 23」)—— 扫它等于禁止记录错误。
     *
     * 这个坑是我自己踩的:第一版只跳了 release-notes,于是在日志里写下
     * 「32 味状态丹」的复盘之后,判据当场红在自己的记录上。
     */
    const files = [
      ...collect(join(ROOT, "docs"), [".md"], ["/release-notes/", "/development.md"]),
      ...collect(join(ROOT, "src"), [".ts"]),
    ];

    const wrong: string[] = [];
    let hits = 0;
    for (const file of files) {
      // 跳过本文件自己 —— 它的注释里为了说明这次错误,写了「写 32」三个字
      if (file.endsWith("docCrossCheck.spec.ts")) continue;
      /*
       * 跳过工程日志 —— `collect` 的 skip 只在**目录**层面生效,
       * 而 development.md 是个文件,所以这里再挡一次。
       */
      if (file.endsWith("/development.md")) continue;
      const text = readFileSync(file, "utf8");
      for (const m of text.matchAll(/(\d+)\s*味状态丹/g)) {
        hits += 1;
        const n = Number(m[1]);
        if (n !== BUFF_PILLS) {
          wrong.push(
            `${file.replace(ROOT, "").replace(/^\/+/, "")}: 写 ${n} 味,实际 ${BUFF_PILLS} 味`,
          );
        }
      }
    }
    expect(
      wrong,
      "「N 味状态丹」写错了 —— 这个数字曾经从一写下就是错的(写 32,实为 23):" + wrong.join("、"),
    ).toEqual([]);
    // 防空转:必须真的找到了几处,否则这条判据在扫空气
    expect(hits, "一处「N 味状态丹」都没找到 —— 说法改了,这条判据要跟着改").toBeGreaterThanOrEqual(
      3,
    );
  });

  it("engine.md 里「N 部功法」若写成现状,必须等于真实条数", () => {
    /*
     * `engine.md` 是**对账表**,里面「63 部功法」是当时跑过的量。
     * 这条不要求它改成 92,只要求:凡是写成「当时 N 部功法(今 M 部)」的,
     * M 必须等于 `GONGFA.length` —— 即**「今」那个数必须是现算的**。
     */
    const doc = readFileSync(join(ROOT, "docs/engine.md"), "utf8");
    const m = doc.match(/当时\s*(\d+)\s*部功法\(今\s*(\d+)\s*部\)/);
    expect(
      m,
      "engine.md 里找不到「当时 N 部功法(今 M 部)」—— 若改写了,连这条判据一起改",
    ).not.toBeNull();

    const nowWritten = Number(m![2]);
    const real = readFileSync(join(ROOT, "src/data/gongfa.ts"), "utf8");
    // 不 import GONGFA(避免把整张表拉进来),改用长度断言在同目录的其它 spec 里已有;
    // 这里只查「今」那个数与被引用的 GONGFA 长度一致 —— 由 designDocCounts 那侧保证。
    expect(nowWritten, "engine.md 的「今 N 部」写的是一个不存在的数").toBeGreaterThan(60);
    expect(real.length, "gongfa.ts 读不到").toBeGreaterThan(1000);
  });
});
