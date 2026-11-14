/**
 * 道果的消费出口必须被 `FRUIT_CONSUMERS` 覆盖 —— 那份清单说「没有出口」，而它有两个。
 *
 * ## 由来（第 307 轮）
 *
 * `daoFruitRoles.ts` 的文件头写着:
 *
 * > 关键事实:**道果没有任何消费出口** —— 它不解锁天界、不进命题、
 * > 不换任何东西、也不参与阶位。它只是一个单调递增的数字。
 *
 * 而 `daoFruitRoles.spec` 有一条同名判据:
 *
 * ```ts
 * const spends = FRUIT_CONSUMERS.filter((c) => /消耗|扣除|spend|cost/i.test(c.evidence));
 * expect(spends).toHaveLength(0);
 * ```
 *
 * **这句「关键事实」现在是假的。** 道果有两个消费出口:
 *
 * ```text
 * core/lifeTrialService.ts   历世试炼签约   player.spendDaoFruit(def.cost)
 * core/worldReroll.ts        换世重掷       「扣款只走 player.spendDaoFruit」
 * ```
 *
 * ## 为什么那条判据没红
 *
 * 它**只在 `FRUIT_CONSUMERS` 这份手写清单内部筛**。清单漏了这两个出口，
 * 于是「清单里没有消费」成立 —— **判据守的是清单，不是产品**。
 *
 * 这正是「清单型判据会漏掉未来新增」的教科书案例:新写一个花道果的功能，
 * 只要忘了往清单里加一行，那条判据不但不红，还继续宣称「没有出口」。
 *
 * ## 判据（反向:扫全仓找出口，再要求清单覆盖）
 *
 * ① 全仓扫 `spendDaoFruit(` 的**调用点**（非注释、非定义），至少找到一个;
 * ② 每一处调用所在文件，都必须在 `FRUIT_CONSUMERS` 里有一条出口记录;
 * ③ 那条「没有消费出口」的旧判据必须已经改写（否则它仍在撒谎）;
 * ④ 防空转:扫描器认得出样例字符串。
 */
import { describe, expect, it } from "vite-plus/test";
import { readSource, walkFiles, isSourceFile } from "@/test/readSource";
import { stripComments } from "@/test/stripComments";
import { FRUIT_CONSUMERS } from "./daoFruitRoles";

/** 调用 `spendDaoFruit(` 而不是定义它、也不是在注释里提到它。 */
const CALL = /\bspendDaoFruit\s*\(/;

/** 扫全仓，返回「谁调了 spendDaoFruit」。 */
function spendCallSites(): { file: string; line: number }[] {
  const out: { file: string; line: number }[] = [];
  for (const rel of walkFiles("src", isSourceFile)) {
    if (rel.endsWith(".spec.ts")) continue;
    // 对账表自己在 evidence 里会提到 spendDaoFruit，它不是调用方
    if (rel.endsWith("core/daoFruitRoles.ts")) continue;
    const raw = readSource(rel);
    const code = stripComments(raw);
    const lines = code.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const ln = lines[i]!;
      // 定义处（`spendDaoFruit(cost) {` 或 `spendDaoFruit = (`）不算调用
      if (/function\s+spendDaoFruit|spendDaoFruit\s*[=:]\s*(\(|function)/.test(ln)) continue;
      if (CALL.test(ln)) out.push({ file: rel, line: i + 1 });
    }
  }
  return out;
}

describe("道果 · 消费出口必须被清单覆盖", () => {
  it("扫得到调用点（防空转）", () => {
    const sites = spendCallSites();
    expect(sites.length, "一个 spendDaoFruit 调用都扫不到 —— 正则或路径怕是写窄了").toBeGreaterThan(
      0,
    );
  });

  it("每一处调用所在文件，清单里都有对应的出口记录", () => {
    const sites = spendCallSites();
    // site 形如 "core/lifeTrialService.signLifeTrial"，而文件是 "src/core/lifeTrialService.ts"
    const covered = FRUIT_CONSUMERS.filter((c) => c.role === "outlet").map(
      (c) =>
        c.site
          .replace(/^src\//, "")
          .replace(/\.ts$/, "")
          .split(".")[0]!,
    );
    const missing = [...new Set(sites.map((s) => s.file))].filter((f) => {
      const key = f.replace(/^src\//, "").replace(/\.(ts|vue)$/, "");
      return !covered.includes(key);
    });
    expect(
      missing,
      "这些文件在花道果，而 FRUIT_CONSUMERS 里没有它们的出口记录 —— " +
        "清单说「没有出口」，这句话就成了假的:" +
        missing.join(" / "),
    ).toEqual([]);
  });

  it("那条「没有消费出口」的旧判据已经改口", () => {
    /*
     * 只看 `it(...)` 的**标题**，不看全文 —— 文件里那段订正注释会引用旧句
     * （「这条原先写的是『道果没有任何消费出口』」），全文搜会误伤。
     */
    const spec = readSource("src/core/daoFruitRoles.spec.ts");
    const titles = [...spec.matchAll(/\bit\(\s*["'`]([^"'`]+)/g)].map((m) => m[1]!);
    expect(titles.length, "一条 it 标题都没抓到 —— 正则写窄了").toBeGreaterThan(3);
    const offenders = titles.filter((t) => t.includes("道果没有任何消费出口"));
    expect(
      offenders,
      "daoFruitRoles.spec 仍在断言「道果没有任何消费出口」—— 而现在它有两个:" +
        offenders.join(" / "),
    ).toEqual([]);
  });
});
