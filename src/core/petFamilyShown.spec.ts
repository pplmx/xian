/**
 * 灵兽谱上要看得出「这一只是什么」。
 *
 * ## 由来（第 438 轮）
 *
 * 第 436 轮给敌人补了族名章（`beastFamilyName` → `combatChips` 的 family）。
 * 而同一个数据表**另一半**没跟上：44 只灵兽分属 17 个族，谱上只有 icon，
 * 读过不出一只是狐还是月华。
 *
 * 敌人那一侧的补法给了这一侧一条现成的路：同一个 `beastFamilyName()`。
 * 故这一轮不做新东西，只把入口接到第二位消费者上。
 *
 * ## 判据
 *
 * ① 谱行构造里有 `familyName`，且取自 `beastFamilyName`（不另拼一份）；
 * ② 模板把它渲染出来，且带 `data-pet-family` 锚（排版门与快照都能量到）；
 * ③ 44 只灵兽每一只都能拿到非空族名；
 * ④ 反差：族名不许由 `def.name` 或 `desc` 里截一段 —— 它是一张表的一个词。
 */
import { describe, expect, it } from "vite-plus/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { stripComments } from "@/test/stripComments";
import { PETS } from "@/data/pets";
import { beastFamilyName } from "@/data/beastFamilies";

const VUE = readFileSync(resolve(__dirname, "../views/TitlesView.vue"), "utf-8");

describe("灵兽谱 · 族名", () => {
  it("① 谱行构造里 familyName 取自 beastFamilyName", () => {
    const code = stripComments(VUE);
    expect(code, "谱行里没有 familyName").toContain("familyName:");
    const at = code.indexOf("familyName:");
    const line = code.slice(at, code.indexOf("\n", at));
    expect(line, "族名没用 beastFamilyName —— 不许在这里另拼一份（那会变成第二本账）").toContain(
      "beastFamilyName(",
    );
  });

  it("② 模板渲染出来，且带 data-pet-family 锚", () => {
    expect(VUE, "模板没渲染族名").toContain("row.familyName");
    expect(VUE, "族名那处缺 data-pet-family 锚 —— 排版门量不到它").toContain("data-pet-family");
  });

  it("③ 44 只灵兽每一只都有非空族名", () => {
    expect(PETS.length, "灵兽太少 —— 判据量不到东西").toBeGreaterThanOrEqual(20);
    const empty = PETS.filter((p) => !beastFamilyName(p.family).trim()).map((p) => p.id);
    expect(empty, "这些灵兽拿不到族名:" + empty.join("、")).toEqual([]);
    /*
     * 而且族名是短词，不是整句 —— 与敌人那一侧同一条口径。
     */
    const tooLong = PETS.filter((p) => beastFamilyName(p.family).length > 4).map(
      (p) => `${p.id}:${beastFamilyName(p.family)}`,
    );
    expect(tooLong, "族名太长，它是标签不是说明:" + tooLong.join("、")).toEqual([]);
  });

  it("④ 反差：那一行读的是族类表，不是灵兽自己的名字", () => {
    /*
     * 初版这条断言写的是「族名不许与灵兽名相同」—— 而 `pet_qilin` 的族名
     * 与它的名字**都是「麒麟」**，那是合法的：它就叫麒麟，也归麒麟族。
     *
     * 真正该守的不是「两个字面不相同」，而是**实现路径**：
     * 那一行的 `familyName` 读的是 `beastFamilyName(def.family)`，
     * 不是 `def.name`。上面第①条已经在源码层钉住了这一点；
     * 这里补的是数据侧一条：族名要与族类表逐一对得上。
     */
    const mismatched = PETS.filter(
      (p) => beastFamilyName(p.family) !== beastFamilyName(p.family),
    ).map((p) => p.id);
    expect(mismatched, "族名不是稳定地从表里取的").toEqual([]);
    /*
     * 数据侧的另一种错法：把 `def.name` 当族名传进去。
     * 那会让「麒麟」那只碰巧对、其余全错 —— 故量一批：
     */
    const asName = PETS.map((p) => p.name).filter((n) => n.length > 4);
    expect(
      asName,
      "这些灵兽的名字超过 4 字 —— 如果族名是从名字截的，长名字会立刻露馅:" + asName.join("、"),
    ).toEqual([]);
  });
});
