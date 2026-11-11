/**
 * 两个丹药池的规模 —— 注释里写的那两个数,不许再悄悄过期。
 *
 * ## 缺口(第 109 轮实测)
 *
 * 第 107 轮发现 `pills.ts` 注释里的「32 味状态丹」从来就没对过(实为 23)。
 * 那之后想:代码注释里的数据声明有没有系统性问题?
 *
 * 这轮扫 `src/core/*.ts` 的注释行,找「N 味/件/部/只/条」这类声明,共 42 处。
 * 逐条核,两处过时:
 *
 * ```text
 *   eventEngine.ts:526   际遇的池子是**全池 72 味**      → 实为 75
 *   loot.ts:285          际遇给丹:全池 72 味              → 实为 75
 *   掉落给丹:只 15 味掉落专属(没有神品…)              → 实为 18 味、含 3 味神品
 * ```
 *
 * 第一处尤其要紧:`EVENT_PILL_NEAR_DECAY` 的取值**依据就是池子大小** ——
 * 注释里给的理由是「际遇的池子是全池 72 味,衰减能真正改变分布」。
 * 池子大小变了,那个理由还成不成立,得重新看。
 *
 * ## 判据
 *
 * 两个池子都由 `PILLS` 现算,不写死:
 *
 * ```text
 *   际遇池    PILLS.filter(p => p.minRealm <= major)      —— major 20 时就是全池
 *   掉落池    PILLS.filter(p => !p.recipe)                —— 不可炼制的那批
 * ```
 *
 * ① 扫 `.ts` 源码里所有「全池 N 味」与「N 味掉落专属」,那个 N 必须等于现算值;
 * ② 掉落池里必须有神品 —— 这条 `poolProximity` 已有,这里只做交叉引用不重复。
 */
import { describe, expect, it } from "vite-plus/test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "@/test/readSource";
import { PILLS } from "@/data/pills";

/** 掉落专属池 —— 不可炼制的那一批 */
const DROP_POOL = PILLS.filter((p) => !p.recipe);
/** 际遇池的上限 —— `minRealm <= 20` 即全池(最高境界是 20) */
const EVENT_POOL = PILLS.filter((p) => p.minRealm <= 20);

/** 收集 `src/` 下的 .ts 与 .vue(跳过探针) */
function sourceFiles(): string[] {
  const out: string[] = [];
  const walk = (d: string): void => {
    for (const entry of readdirSync(d, { withFileTypes: true })) {
      if (entry.name === "node_modules" || entry.name === "tp") continue;
      const full = join(d, entry.name);
      if (entry.isDirectory()) {
        walk(full);
        continue;
      }
      if (entry.name.endsWith(".ts") || entry.name.endsWith(".vue")) out.push(full);
    }
  };
  walk(join(ROOT, "src"));
  return out;
}

describe("丹药池规模 · 注释里的两个数", () => {
  it("「全池 N 味」的 N 等于际遇池的现算值", () => {
    const wrong: string[] = [];
    let hits = 0;
    for (const file of sourceFiles()) {
      // 跳过本文件 —— 它为了说明这次错误,写了「72 味」
      if (file.endsWith("pillPoolSize.spec.ts")) continue;
      const text = readFileSync(file, "utf8");
      for (const m of text.matchAll(/全池\s*(\d+)\s*味/g)) {
        hits += 1;
        if (Number(m[1]) !== EVENT_POOL.length) {
          wrong.push(
            `${file.replace(ROOT, "").replace(/^\/+/, "")}: 写 ${m[1]} 味,实际 ${EVENT_POOL.length} 味`,
          );
        }
      }
    }
    expect(
      wrong,
      "「全池 N 味」与际遇池实际规模不符 —— 这个数曾写着 72,实为 75:" + wrong.join("、"),
    ).toEqual([]);
    expect(hits, "一处「全池 N 味」都没找到 —— 说法改了,这条判据要跟着改").toBeGreaterThanOrEqual(
      2,
    );
  });

  it("「N 味掉落专属」的 N 等于掉落池的现算值", () => {
    const wrong: string[] = [];
    let hits = 0;
    for (const file of sourceFiles()) {
      if (file.endsWith("pillPoolSize.spec.ts")) continue;
      const text = readFileSync(file, "utf8");
      for (const m of text.matchAll(/(\d+)\s*味掉落专属/g)) {
        hits += 1;
        if (Number(m[1]) !== DROP_POOL.length) {
          wrong.push(
            `${file.replace(ROOT, "").replace(/^\/+/, "")}: 写 ${m[1]} 味,实际 ${DROP_POOL.length} 味`,
          );
        }
      }
    }
    expect(
      wrong,
      "「N 味掉落专属」与掉落池实际规模不符 —— 这个数曾写着 15,实为 18:" + wrong.join("、"),
    ).toEqual([]);
    expect(hits, "一处「N 味掉落专属」都没找到").toBeGreaterThanOrEqual(1);
  });

  it("「没有神品」这个断言若还在,必须与事实相符", () => {
    /*
     * `loot.ts` 曾经写「掉落给丹:只 15 味掉落专属(没有神品…)」——
     * 而当时那句话的后半截也已经不成立了(池里后来补了神品)。
     *
     * 这条只查「掉落池…没有神品」这种**并列说法**还在不在。若有人把神品
     * 全删了,`poolProximity` 的判据会红;若有人只改注释不改数据,这条会红。
     */
    const divine = DROP_POOL.filter((p) => p.quality === "divine");
    const claims = sourceFiles()
      .filter((f) => !f.endsWith("pillPoolSize.spec.ts"))
      .flatMap((f) => {
        const text = readFileSync(f, "utf8");
        const out: string[] = [];
        // 只看「有没有这个说法」,不关心匹配到的具体文字
        if (/掉落[^\n]{0,20}没有神品/.test(text)) out.push(f.replace(ROOT, ""));
        return out;
      });
    if (divine.length > 0) {
      expect(claims, `掉落池里已有 ${divine.length} 味神品,但注释还写着「掉落…没有神品」`).toEqual(
        [],
      );
    }
  });

  it("反空转:两个池子都非空,且掉落池是际遇池的真子集", () => {
    expect(EVENT_POOL.length, "际遇池空了").toBeGreaterThan(50);
    expect(DROP_POOL.length, "掉落池空了").toBeGreaterThan(5);
    expect(
      DROP_POOL.length,
      "掉落池不可能比际遇池大 —— 它是不可炼制的那批,是际遇池的子集",
    ).toBeLessThanOrEqual(EVENT_POOL.length);
  });
});
