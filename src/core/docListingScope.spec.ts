/**
 * 「手册里该列全什么」—— 划一条线，免得后来者把四类内容也搬进去。
 *
 * ## 由来（第 478 轮）
 *
 * 第 476/477 轮连着补了两份清单进 `docs/usage.md`（八份逆旅契、十七个命题），
 * 因为它们在手册里**一份都查不到**。
 *
 * 顺着同一个形状继续查，四类内容也几乎全不在手册里:
 *
 * ```text
 *   灵兽 44 条 → 查不到 44
 *   法宝 49 条 → 查不到 48
 *   丹药 75 条 → 查不到 75
 *   称号 29 条 → 查不到 28
 * ```
 *
 * 而**这四类不该补**:
 *
 * ```text
 *   契约 / 命题   没有别的出口 —— 游戏里没有一页能查「八份契约各要多少道果」
 *   灵兽 / 法宝 / 丹药 / 称号   各有图鉴页（usage.md 第 64 行：「九册逐条解锁」）
 * ```
 *
 * 文档的职责是「怎么玩、数值怎么算」，不是把图鉴抄一遍 —— 抄了就是第二本账，
 * 而且内容一增删就要回来改（这正是第 476 轮那条价格判据要防的事）。
 *
 * ## 判据
 *
 * ① 四类内容**不许**被搬进 usage.md 的正文（抽查几个名字，要求它们不出现）；
 * ② 反差：契约与命题**必须**在（那两份清单是本手册独有的出口）——
 *    这一条与 `trialDocListing.spec` / `themeDocListing.spec` 互为呼应，
 *    放在这里是为了让「该列 / 不该列」的界线在同一个文件里看得见。
 */
import { describe, expect, it } from "vite-plus/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PETS } from "@/data/pets";
import { ARTIFACTS } from "@/data/artifacts";
import { PILLS } from "@/data/pills";
import { TITLES } from "@/data/titles";
import { LIFE_TRIALS } from "@/data/lifeTrials";
import { LIFE_THEMES } from "@/data/lifeThemes";

const USAGE = readFileSync(resolve(__dirname, "../../docs/usage.md"), "utf-8");

describe("玩法手册的边界 · 该列什么，不该列什么", () => {
  it("① 有图鉴页的四类内容，不许抄进手册", () => {
    /*
     * 抽查前几条:若哪天有人把「四十只灵兽」整表搬进来，这一条会红。
     * 不抽全部（那样等于要求「一个名字都不许提」，而正文里举例提到某只灵兽是正常的）。
     */
    const sampled: Array<[string, string]> = [
      ["灵兽", PETS[0]!.name],
      ["法宝", ARTIFACTS[0]!.name],
      ["丹药", PILLS[0]!.name],
      ["称号", TITLES[0]!.name],
    ];
    const copied = sampled.filter(([, n]) => USAGE.includes(n)).map(([k, n]) => `${k}「${n}」`);
    expect(copied, "这些内容各有图鉴页，抄进手册就是第二本账：" + copied.join("、")).toEqual([]);
  });

  it("② 反差：契约与命题必须在 —— 它们没有别的出口", () => {
    const trials = LIFE_TRIALS.filter((t) => !USAGE.includes(t.name));
    expect(
      trials.map((t) => t.name),
      "契约没有别的出口，手册是它唯一能被查到的地方",
    ).toEqual([]);
    const themes = LIFE_THEMES.filter((t) => !USAGE.includes(t.name));
    expect(
      themes.map((t) => t.name),
      "命题同样没有别的出口",
    ).toEqual([]);
  });

  it("③ 手册要指向图鉴 —— 不搬内容，但要让玩家知道去哪儿查", () => {
    expect(USAGE, "手册没有指向图鉴 —— 玩家不知道该去哪查那四类内容").toMatch(/图鉴/);
  });
});
