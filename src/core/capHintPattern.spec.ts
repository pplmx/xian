/**
 * 凡是说「到顶了」的提示，都要说清下一步 —— 把上一轮的人工检查变成自动的。
 *
 * ## 由来（第 530 轮）
 *
 * 第 528 轮找到终局那句「这一世的修行到此为止」，第 529 轮顺着同一条线索又找到三处:
 *
 * ```text
 *   当前境界的功法已尽数参悟   → 补给「境界再进一层,便又有新的可参」
 *   已达强化上限（两处）        → 补给「炼器台再升几级…」
 *   道果不足                  → 补给「尚差 N 枚」
 * ```
 *
 * **三处都是我一条一条 grep 出来的** —— 而全仓有 218 处 `notify`。
 * 人工扫一遍只能扫到「碰巧想到的词」。
 *
 * ## 判据怎么判
 *
 * 一个提示只要出现「到顶 / 已满 / 已尽 / 已臻 / 无余地」这类**封闭语义**，
 * 它就必须同时满足二选一:
 *
 * ```text
 *   ① 给出下一步（升境 / 升级 / 尚差 / 另择 / 来世 …）
 *   ② 或者它确实是终局（真上限），并在注释里写明为什么
 * ```
 *
 * 「确实是终局」这一支靠一张**登记表**——与 `mechanismVisibility` 的
 * `INTERNAL_ONLY` 同形:登记这件事本身就是一次「我确认过它真的没下一步」的判断。
 *
 * ## 判据
 *
 * ① 每条封闭语义的提示，要么给出下一步，要么在登记表里;
 * ② 登记表里每一条都得写清理由（空理由当没登记）;
 * ③ 反差：不含封闭语义的提示不受管 —— 它们本来就不需要「下一步」。
 */
import { describe, expect, it } from "vite-plus/test";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

/** 封闭语义：读到它，玩家会以为「到此为止」 */
const CLOSED = ["到顶", "已满", "已尽", "已臻", "无余地", "已达上限", "已无"] as const;

/** 给出下一步的说法 —— 命中任一即算「说清了」 */
const NEXT_STEP = [
  "升",
  "下一境",
  "再进",
  "尚差",
  "另择",
  "来世",
  "炼器台",
  "便可",
  "方能",
  "先",
] as const;

/**
 * 登记表：确实是终局、真的没有下一步的那些。
 *
 * 每条都写清「为什么它没有下一步」——空理由当没登记。
 */
const TRUE_CAP: Record<string, string> = {
  此法宝已臻圆满: "`artifactUpCost` 返回 null 就是真上限（法宝祭炼到顶没有第二条路）",
  此物已无重铸余地:
    "`reforgeCost` 返回 null 仅当「有词条且全封存」—— 那时确实没有可重铸的词条；" +
    "0 词条的凡品不走这一支（注释里写明了）",
};

const CORE = resolve(__dirname);

describe("提示口径 · 「到顶了」之后有没有下一步", () => {
  it("① 每条封闭语义的提示，要么给出下一步，要么在登记表里", () => {
    const offenders: string[] = [];
    for (const f of readdirSync(CORE).filter((x) => x.endsWith(".ts") && !x.endsWith(".spec.ts"))) {
      const src = readFileSync(resolve(CORE, f), "utf8");
      for (const m of src.matchAll(/notify\(\s*(`|")([^`"]*?)\1/g)) {
        const text = m[2]!;
        if (!CLOSED.some((c) => text.includes(c))) continue;
        if (NEXT_STEP.some((n) => text.includes(n))) continue;
        if (text in TRUE_CAP) continue;
        offenders.push(`${f}: «${text}»`);
      }
    }
    expect(
      offenders,
      "这些提示说「到顶了」却没说下一步 —— 要么补一句，要么登记进 TRUE_CAP 并写清理由：" +
        offenders.join("；"),
    ).toEqual([]);
  });

  it("② 登记表里每一条都得写清理由", () => {
    for (const [text, why] of Object.entries(TRUE_CAP)) {
      expect(why.trim().length, `「${text}」登记了却没有理由 —— 那等于没登记`).toBeGreaterThan(10);
    }
  });

  it("③ 反差：不含封闭语义的提示不受管", () => {
    /*
     * 「丹药不足」「正在历练途中」这类本来就不需要「下一步」——
     * 前者缺什么说得很清楚，后者下一步就是「走完这一趟」。
     * 这条断言确认判据没有把范围扩大到所有提示。
     */
    const plain = ["丹药不足", "功法残页不足", "此身已殁"];
    for (const p of plain) {
      expect(
        CLOSED.some((c) => p.includes(c)),
        `「${p}」被误判成封闭语义`,
      ).toBe(false);
    }
  });
});
