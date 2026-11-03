/**
 * 未走之道 —— 择定之后仍看得见其余几条,且看得见它们当时给什么。
 *
 * 判据四组:
 *   一 只列没走的:自己那条不重复出现(同一屏不说两遍);
 *   二 顺序与原表一致:与择道时看到的顺序相同,不重排;
 *   三 每条都带它当时会给什么 —— 只有名字等于「知道有个别的名字」;
 *   四 真接线:功法弹窗读它,且写成「未行」而不是可点按钮。
 */
import { describe, expect, it } from "vite-plus/test";
import { readSource } from "@/test/readSource";
import { branchesFor } from "@/data/gongfaBranches";
import { unwalkedBranches } from "./unwalkedBranch";

const BRANCHES = branchesFor("m_taixuan");

describe("未走之道 · 只列没走的", () => {
  it("择定一条之后,列表里没有自己那条", () => {
    const picked = BRANCHES[0]!;
    const rest = unwalkedBranches(BRANCHES, picked.id);
    expect(rest.some((b) => b.id === picked.id)).toBe(false);
    expect(rest).toHaveLength(BRANCHES.length - 1);
  });

  it("还没择道时返回空表 —— 那时该看的是可选项主列表", () => {
    expect(unwalkedBranches(BRANCHES, null)).toEqual([]);
    expect(unwalkedBranches(BRANCHES, undefined)).toEqual([]);
  });

  it("认不得的分支 id 也不把全部当成「没走」—— 空 id 视同未择", () => {
    expect(unwalkedBranches(BRANCHES, "")).toEqual([]);
  });
});

describe("未走之道 · 顺序与内容", () => {
  it("顺序与原表一致:与择道那一刻看到的顺序相同", () => {
    const picked = BRANCHES[1]!;
    const rest = unwalkedBranches(BRANCHES, picked.id);
    const expected = BRANCHES.filter((b) => b.id !== picked.id).map((b) => b.id);
    expect(rest.map((b) => b.id)).toEqual(expected);
  });

  it("每条都带「它当时会给什么」—— 只有名字等于没说什么", () => {
    const rest = unwalkedBranches(BRANCHES, BRANCHES[0]!.id);
    for (const row of rest) {
      const def = BRANCHES.find((b) => b.id === row.id)!;
      expect(row.name).toBe(def.name);
      expect(row.effect, `${row.name} 没带效果说明`).toBe(def.desc);
      expect(row.effect.length, `${row.name} 的效果说明是空的`).toBeGreaterThan(0);
    }
  });

  it("一部只有一条分支的功法:择定后列表为空,不冒出空行", () => {
    const single = BRANCHES.slice(0, 1);
    expect(unwalkedBranches(single, single[0]!.id)).toEqual([]);
  });
});

describe("未走之道 · 真接线", () => {
  it("功法弹窗读它,并给真浏览器留落点", () => {
    const dialog = readSource("src/components/cultivation/GongfaDialog.vue");
    expect(dialog, "择定之后要列出没走的那几条").toContain("unwalkedBranches(");
    expect(dialog, "要有稳定落点供真浏览器复核").toContain("data-gongfa-unwalked");
  });

  it("写成「未行」而不是可点按钮 —— 它们已经不可选了", () => {
    const dialog = readSource("src/components/cultivation/GongfaDialog.vue");
    /*
     * 按**标签**取那一段,不按字符偏移切片:切固定长度会吃进下一段,
     * 于是「后面那段有个 @click」被误判成「未行之道可点」。
     * 从落点所在的 `<p` 起、到它自己的 `</p>` 为止,量的才是这一段。
     */
    const start = dialog.lastIndexOf("<p", dialog.indexOf("data-gongfa-unwalked"));
    const end = dialog.indexOf("</p>", dialog.indexOf("data-gongfa-unwalked"));
    expect(start, "落点要真的写在模板里").toBeGreaterThan(0);
    expect(end, "那一段要有闭合标签").toBeGreaterThan(start);
    const block = dialog.slice(start, end);
    expect(block, "未行之道不该是可点的").not.toContain("@click");
    expect(block, "要写明「未行」").toContain("未行");
    expect(block, "要带每条当时会给什么").toContain("w.effect");
  });
});
