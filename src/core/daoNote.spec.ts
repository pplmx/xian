/**
 * 道记 —— 择道那一刻的落款要记得住、修得回、说得清。
 *
 * 判据三组:
 *   一 造落款:年岁/境界/层数各自夹回值域,舍掉的路去重且按传入序;
 *   二 修存档:坏值丢掉而不是印出「undefined 岁」,认不得的分支 id 也不留;
 *   三 拼句:一句里有年岁、境界与舍掉的路 —— 且不碰任何结算。
 */
import { describe, expect, it } from "vite-plus/test";
import { readSource } from "@/test/readSource";
import { MAX_MAJOR } from "@/data/realms";
import { createPinia, setActivePinia } from "pinia";
import { beforeEach } from "vite-plus/test";
import { useCultivationStore } from "@/stores/cultivation";
import { type DaoNote, daoNoteLine, makeDaoNote, sanitizeDaoNotes } from "./daoNote";

beforeEach(() => setActivePinia(createPinia()));

const names = {
  ageText: "一百二十岁",
  realmText: "金丹圆满",
  branchName: (id: string) => ({ b1: "杀伐", b2: "守御", b3: "归一" })[id] ?? "",
};

describe("道记 · 造落款", () => {
  it("照实记下年岁、境界、层数与没走的那几条", () => {
    const note = makeDaoNote({ age: 120, major: 2, sub: 9, forgone: ["b2", "b3"] }, MAX_MAJOR);
    expect(note).toEqual({ age: 120, major: 2, sub: 9, forgone: ["b2", "b3"] });
  });

  it("坏值一律夹回值域:负数、小数、NaN 都不该印在题跋上", () => {
    const note = makeDaoNote({ age: -3.7, major: Number.NaN, sub: 99, forgone: ["b1"] }, MAX_MAJOR);
    expect(note.age).toBe(0);
    expect(note.major).toBe(0);
    expect(note.sub).toBe(9);
  });

  it("境界不许超过这一世能到的最高境 —— 坏档写 999 要夹回去", () => {
    const note = makeDaoNote({ age: 1, major: 999, sub: 0, forgone: [] }, MAX_MAJOR);
    expect(note.major).toBe(MAX_MAJOR);
  });

  it("没走的路去重、去空,并按传入顺序保留", () => {
    const note = makeDaoNote(
      { age: 1, major: 1, sub: 1, forgone: ["b3", "b3", "", "b1", "b2"] },
      MAX_MAJOR,
    );
    expect(note.forgone).toEqual(["b3", "b1", "b2"]);
  });

  it("没走的路有上限:再多也不会把一行题跋撑成一段", () => {
    const many = Array.from({ length: 40 }, (_, i) => `x${i}`);
    const note = makeDaoNote({ age: 1, major: 1, sub: 1, forgone: many }, MAX_MAJOR);
    expect(note.forgone.length).toBeLessThanOrEqual(8);
  });
});

describe("道记 · 拼句", () => {
  it("有舍有取时,一句里同时报年岁、境界与舍掉的路", () => {
    const note: DaoNote = { age: 120, major: 2, sub: 9, forgone: ["b2", "b3"] };
    const line = daoNoteLine(note, names);
    expect(line).toContain("一百二十岁");
    expect(line).toContain("金丹圆满");
    expect(line).toContain("『守御』");
    expect(line).toContain("『归一』");
    expect(line, "没走的那条不该被说成走了").not.toContain("『杀伐』");
  });

  it("独门无旁路时改口「别无旁路」,不留半句空话", () => {
    const line = daoNoteLine({ age: 30, major: 1, sub: 9, forgone: [] }, names);
    expect(line).toContain("别无旁路");
    expect(line).not.toContain("舍");
  });

  it("认不得的分支 id 不印成空引号", () => {
    const line = daoNoteLine({ age: 30, major: 1, sub: 9, forgone: ["ghost"] }, names);
    expect(line).not.toContain("『』");
    expect(line).toContain("别无旁路");
  });
});

describe("道记 · 修存档", () => {
  it("坏形状整份丢掉,认得的留下", () => {
    const book = sanitizeDaoNotes(
      {
        m_taixuan: { age: 40, major: 1, sub: 3, forgone: ["b1"] },
        bad1: null,
        bad2: "nope",
        bad3: { age: "x" },
      },
      (id) => id === "b1" || id === "b2",
      MAX_MAJOR,
    );
    expect(Object.keys(book).sort()).toEqual(["bad3", "m_taixuan"]);
    expect(book.m_taixuan).toEqual({ age: 40, major: 1, sub: 3, forgone: ["b1"] });
    // 形在、值坏:落回 0,而不是 NaN
    expect(book.bad3).toEqual({ age: 0, major: 0, sub: 0, forgone: [] });
  });

  it("认不得的分支 id 从舍掉的路里剔除", () => {
    const book = sanitizeDaoNotes(
      { m_taixuan: { age: 40, major: 1, sub: 3, forgone: ["b1", "ghost"] } },
      (id) => id === "b1",
      MAX_MAJOR,
    );
    expect(book.m_taixuan!.forgone).toEqual(["b1"]);
  });

  it("整份是 null / 数组 / 字符串时给空簿,不抛", () => {
    for (const raw of [null, undefined, [], "x", 3]) {
      expect(sanitizeDaoNotes(raw, () => true, MAX_MAJOR)).toEqual({});
    }
  });
});

describe("道记 · 接线", () => {
  it("择道时确实落款:年岁与境界来自调用方,舍掉的是当时其余的每一条", () => {
    const cul = useCultivationStore();
    cul.learn("m_taixuan");
    for (let i = 0; i < 9; i += 1) cul.upgrade("m_taixuan");
    expect(cul.chooseBranch("m_taixuan", "b_taixuan_sha", { age: 120, major: 2, sub: 9 })).toBe(
      true,
    );
    const note = cul.daoNotes.m_taixuan!;
    expect(note.age).toBe(120);
    expect(note.major).toBe(2);
    expect(note.sub).toBe(9);
    expect(note.forgone.sort()).toEqual(["b_taixuan_guiyi", "b_taixuan_shou"]);
  });

  it("不传处境也能择(脚本与用例),只是不留落款", () => {
    const cul = useCultivationStore();
    cul.learn("m_lihuo");
    for (let i = 0; i < 8; i += 1) cul.upgrade("m_lihuo");
    expect(cul.chooseBranch("m_lihuo", "b_lihuo_fen")).toBe(true);
    expect(cul.daoNotes.m_lihuo).toBeUndefined();
  });

  it("道记跟着它的那一支走:分支被修形丢掉时,孤零零的题跋也不留", () => {
    const cul = useCultivationStore();
    cul.learn("m_taixuan");
    for (let i = 0; i < 9; i += 1) cul.upgrade("m_taixuan");
    cul.chooseBranch("m_taixuan", "b_taixuan_sha", { age: 10, major: 1, sub: 1 });
    expect(cul.daoNotes.m_taixuan).toBeDefined();
    // 把分支表写坏成认不得的 id,再走一次修形
    cul.gongfaBranch = { m_taixuan: "b_not_a_branch" } as never;
    cul.sanitize();
    expect(cul.gongfaBranch.m_taixuan).toBeUndefined();
    expect(cul.daoNotes.m_taixuan, "没有分支的题跋是无主的").toBeUndefined();
  });

  it("界面与图鉴共用同一句拼法,都不自己拼一份", () => {
    const dialog = readSource("src/components/cultivation/GongfaDialog.vue");
    const codex = readSource("src/ui/codex.ts");
    expect(dialog, "功法弹窗要读共享的拼句").toContain("daoNoteLine");
    expect(codex, "悟道录要读同一份拼句").toContain("daoNoteLine");
    expect(dialog, "要有稳定落点供真浏览器复核").toContain("data-gongfa-dao-note");
  });
});

describe("道记 · 不进结算", () => {
  it("模块不 import 任何结算 / 属性模块 —— 它只是一段落款", () => {
    const src = readSource("src/core/daoNote.ts");
    expect(src, "道记不该认得属性合并").not.toContain("statsCalc");
    expect(src, "道记不该认得战力").not.toContain("powerRating");
    expect(src, "道记不该产出词条").not.toContain("StatMods");
  });
});
