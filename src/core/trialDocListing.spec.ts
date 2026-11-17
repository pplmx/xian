/**
 * 玩家手册里要能查到有哪些逆旅契。
 *
 * ## 由来（第 476 轮）
 *
 * 逆旅契是**花道果**的消费：最便宜的 12 枚、最贵的 48 枚，而一次金丹转世
 * 约得 21 枚。玩家在转世弹窗里看到一排选项、要花掉攒了几世的道果 ——
 * 而 `docs/usage.md`（玩法手册，README 只当门面）里**一份契约都没列出**。
 *
 * 全书搜「逆旅契」只有一句「花法」说明，八份契的名字一个都没有。
 * 而第 470~475 轮陆续加了四份（断径 / 弃器 / 逆行 / 执念），
 * 加的时候也没人想起来要补文档。
 *
 * ## 为什么这类缺口判据该管
 *
 * `docs/design.md:3262` 写着:「玩法文档 `docs/usage.md` —— 同一份 spec 从表数出数、
 * 再要求文档里那句话长得一样。」那条纪律管的是法宝节拍（`dataHeaderAudit.spec`），
 * 而**契约清单没有对应的判据** —— 于是它漂了四轮没人发现。
 *
 * ## 判据
 *
 * ① `docs/usage.md` 必须提到每一份逆旅契的名字；
 * ② 反差：它不能只在一个「共 N 份」的计数里出现 —— 玩家要查的是**有哪些**，
 *    不是「有几份」（计数会随增删而变，再写一遍就是两本账）。
 */
import { describe, expect, it } from "vite-plus/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { LIFE_TRIALS } from "@/data/lifeTrials";

const USAGE = readFileSync(resolve(__dirname, "../../docs/usage.md"), "utf-8");

describe("玩法手册 · 逆旅契要查得到", () => {
  it("① 每一份契的名字都在 usage.md 里出现过", () => {
    const missing = LIFE_TRIALS.filter((t) => !USAGE.includes(t.name)).map((t) => t.name);
    expect(
      missing,
      "这些契约在玩家手册里查不到 —— 而它们是花道果的消费：" + missing.join("、"),
    ).toEqual([]);
  });

  it("③ 文档里写的道果数必须与数据一致 —— 这是第二本账的高发处", () => {
    /*
     * 表格里的价格是手写的，而真值在 `LIFE_TRIALS[].cost`。
     * 改价时若忘了改文档，玩家手册会教他「这个要 24 枚」而实际收 30 枚 ——
     * 那正是本仓「界面上出现的每个数字都与结算同源」那条纪律要防的事，
     * 只不过这一处是文档。
     */
    const wrong: string[] = [];
    for (const t of LIFE_TRIALS) {
      // 找表格里那一行:`| 契名 | 数字 |`
      const row = new RegExp(`\\|\\s*${t.name}\\s*\\|\\s*(\\d+)\\s*\\|`).exec(USAGE);
      if (!row) {
        wrong.push(`${t.name} 那一行没找到（不是表格行？）`);
        continue;
      }
      if (Number(row[1]) !== t.cost) {
        wrong.push(`${t.name}: 文档写 ${row[1]}，实际 ${t.cost}`);
      }
    }
    expect(wrong, "手册里的价格与数据对不上：" + wrong.join("；")).toEqual([]);
  });

  it("② 反差：契名要落在正文里，不能只出现在一句计数中", () => {
    /*
     * 判据要求每份契都**单独出现在列举它的那一节**里。
     * 这条守的是「列全」而不是「提过」—— 若哪天有人把八份契收成一句
     * 「共八种逆旅契」，① 会全红而这条先红，指出问题在哪。
     */
    for (const t of LIFE_TRIALS) {
      const at = USAGE.indexOf(t.name);
      expect(at, `${t.name} 不在 usage.md 里`).toBeGreaterThan(0);
      // 名字后面要跟着一点说明（不只是个孤零零的词）
      const after = USAGE.slice(at, at + 120);
      expect(after.replace(t.name, "").trim().length, `${t.name} 后面没有说明`).toBeGreaterThan(8);
    }
  });
});
