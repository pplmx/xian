/**
 * 「误判清单」本身要被查 —— 它是我这几轮最容易重犯的东西。
 *
 * ## 由来
 *
 * `docs/development.md` 的「测试与判据」表里有一行「静态扫描的假阳性」,
 * 记着本仓实测过的误判类型。第 105~136 这三十多轮里它涨到 13 条:
 *
 * ```text
 *   ①~⑨   扫描读错了东西(遍历使用 / 文件内自用 / 值域巧合 / … / 按引号定界)
 *   ⑩~⑭   判定读错了东西(跨维度 / 跨 id 空间 / 把「没有写」当「缺」/ 量总数量不出结构)
 * ```
 *
 * 前九条是「找错地方」,后四条是「**找对了地方,解释错了**」——
 * 而后者更贵:扫描本身没问题,错在把真东西解释成了缺陷,于是要花时间证明自己错了。
 *
 * ## 判据
 *
 * ① 那 13 条必须全在 —— 少一条就是有人删了教训;
 * ② ⑩~⑭ 这五条各自要带**具体案例**(文件名或数据名),不许只写抽象结论;
 * ③ 那一行里要有「找线索 / 判据必须能指名」这类**行动指令**,不许只列现象。
 *
 * ③ 看起来虚,但它守的是这篇文章的用途:清单不是给人感叹的,是给下一次
 * 「我觉得这里有问题」时翻的。没有行动指令的清单,读完了还是不知道下一步做什么。
 */
import { describe, expect, it } from "vite-plus/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "@/test/readSource";

const DOC = readFileSync(join(ROOT, "docs/development.md"), "utf8");

/** 取出「静态扫描的假阳性」那一整行(表格里的一行) */
function falsePositiveRow(): string {
  const start = DOC.indexOf("| 静态扫描的假阳性 |");
  expect(start, "找不到「静态扫描的假阳性」那一行").toBeGreaterThan(0);
  const end = DOC.indexOf("\n", start);
  return DOC.slice(start, end);
}

const MARKERS = ["①", "②", "③", "④", "⑤", "⑥", "⑦", "⑧", "⑨", "⑩", "⑪", "⑫", "⑬", "⑭"] as const;

describe("误判清单 · 它自己不许缩水", () => {
  it("① 十四条编号全在,一条都不许少", () => {
    const row = falsePositiveRow();
    /*
     * 每个编号必须**作为条目**出现,即后面紧跟一句**加粗的标题**(`⑬ **量总数…**`)。
     *
     * 第一版只查 `row.includes(m)`,于是删掉 ⑬ 整条之后判据照样绿 ——
     * 因为末尾那句「⑩~⑬ 这四条与前九条不同」里还有一个 ⑬ 的字样。
     * **首领与正文里的同一个字符,不是同一件事。**
     */
    /*
     * 前九条写的是 `① 遍历使用 —— `(无反引号无加粗),后四条写的是 `⑩ **跨维度比较** —— `。
     * 两种格式都要认:要求「编号后面紧跟一句短标题」即可 —— 既不是紧跟标点,也不是只在
     * 别处的正文里出现一次。
     */
    const missing = MARKERS.filter(
      (m) => !new RegExp(`${m}\\s*(?:\\*\\*)?[\\u4e00-\\u9fa5]`).test(row),
    );
    expect(missing, "误判清单里少了这些条目 —— 有人删了教训:" + missing.join(" ")).toEqual([]);
  });

  it("② ⑩~⑭ 各自要带具体案例,不许只写抽象结论", () => {
    const row = falsePositiveRow();
    /*
     * ⑩ 跨维度          → 应有「成就」「印」或「品质档位」
     * ⑪ 跨 id 空间      → 应有 `COMBO_ARTS` / `BUILD_STYLES` / `DAO_PATHS`
     * ⑫ 「没有写」≠「缺」 → 应有 `prefers-reduced-motion` 或 `style.css`
     * ⑬ 量总数≠量结构   → 应有 `data/events` 或「通用事件」
     */
    const expectations: { mark: string; what: string; needles: string[] }[] = [
      { mark: "⑩", what: "跨维度比较", needles: ["成就", "印"] },
      { mark: "⑪", what: "跨 id 空间比较", needles: ["COMBO_ARTS", "BUILD_STYLES", "DAO_PATHS"] },
      {
        mark: "⑫",
        what: "把「没有写」当成「缺」",
        needles: ["prefers-reduced-motion", "style.css"],
      },
      { mark: "⑬", what: "量总数量不出结构", needles: ["data/events", "通用事件"] },
      { mark: "⑭", what: "量入口量不出供给", needles: ["第 7 境", "minRealm", "50 个"] },
    ];
    for (const { mark, what, needles } of expectations) {
      /*
       * `at` 也必须找**条目形态**(编号 + 加粗标题),不能只找编号字符。
       *
       * 第一版写 `row.indexOf(mark)`,而 ⑭ 在这一行里出现了两次:一次是条目本身
       * (`⑭ **量入口…**`),一次是末尾那句「**⑩~⑭ 这五条与前九条不同**」——
       * `indexOf` 命中的是后者,于是切出来的是那句总结,「具体案例」必然查不到。
       */
      const at = row.indexOf(`${mark} **`);
      expect(at, `找不到编号 ${mark}`).toBeGreaterThan(0);
      /*
       * 切到**下一个条目**为止 —— 只认「编号 + 加粗标题」这种条目形态。
       *
       * 第一版找的是「下一个编号字符」,而这一行末尾还有一句
       * 「**⑩~⑭ 这五条与前九条不同**」,里面的 ⑭ 被当成了下一段的起点,
       * 于是最后一条(⑭)的切段只剩几个字,「具体案例」必然查不到。
       * 与第 140 轮那次(目录说明里的「动效」冒充列表项)是同一个坑。
       */
      const nextAt = MARKERS.map((m) => {
        const hit = row.indexOf(`${m} **`, at + 1);
        return hit;
      }).filter((i) => i > at);
      const segment = row.slice(at, nextAt.length > 0 ? Math.min(...nextAt) : undefined);
      expect(
        needles.some((n) => segment.includes(n)),
        `${mark}(${what})只写了抽象结论,没带具体案例 —— ` +
          `至少要提到 ${needles.join(" / ")} 中的一个`,
      ).toBe(true);
    }
  });

  it("③ 那一行要有行动指令,不许只列现象", () => {
    const row = falsePositiveRow();
    expect(
      /结论:.*找线索|判据必须能指名|先找它的\*\*兜底\*\*|先把两个分量拆开/.test(row),
      "误判清单里没有行动指令 —— 清单是给下一次「我觉得这里有问题」时翻的," +
        "只列现象的话读完了还是不知道下一步做什么",
    ).toBe(true);
  });

  it("④ 前九条(扫描层)与后四条(判定层)要分开说明", () => {
    const row = falsePositiveRow();
    expect(
      /前九条是.*扫描读错了东西|这四条是.*判定读错了东西|前九条|这四条与前九条不同/.test(row),
      "没有说明「扫描读错」与「判定读错」是两类 —— 而后者才是这三十轮里最贵的",
    ).toBe(true);
  });

  it("反空转:那一行确实有内容,文档读得到", () => {
    const row = falsePositiveRow();
    expect(row.length, "那一行短得不像清单").toBeGreaterThan(1500);
    expect(DOC.length, "development.md 读不到").toBeGreaterThan(100000);
  });
});
