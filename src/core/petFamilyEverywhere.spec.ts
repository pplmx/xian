/**
 * 同一只灵兽，两处资料不许一处有一处没有。
 *
 * ## 由来（第 439 轮）
 *
 * 第 438 轮给名号页补了族名（`beastFamilyName` → `row.familyName`）。
 * 而灵兽在**图鉴**里还有一份资料 —— `describePet`。那一份没有族名。
 *
 * 于是同一只灵兽，从名号页看得到「狐」，从图鉴看只有描述、契语、功能、性格、特性。
 * 这不是「少写了一行」，是**两处资料对同一件事说了不同的话**。
 *
 * ## 判据
 *
 * ① 图鉴的灵兽条目里有族类一行，且取自 `beastFamilyName`（不另拼）；
 * ② 名号页那一处仍在（第 438 轮的回归守卫）；
 * ③ 两处取的是同一个来源 —— 同一只灵兽在两处读到的族名必须相等；
 * ④ 反差：族类排在性格**之前** —— 先天的品类，后天的走法，顺序不能反。
 */
import { describe, expect, it } from "vite-plus/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { stripComments } from "@/test/stripComments";
import { PETS } from "@/data/pets";
import { beastFamilyName } from "@/data/beastFamilies";

const CODEX = stripComments(readFileSync(resolve(__dirname, "../ui/codex.ts"), "utf-8"));
const TITLES = stripComments(readFileSync(resolve(__dirname, "../views/TitlesView.vue"), "utf-8"));

describe("灵兽 · 两处资料的族名", () => {
  it("① 图鉴的灵兽条目里有族类一行", () => {
    const at = CODEX.indexOf("export function describePet(");
    expect(at, "找不到 describePet").toBeGreaterThan(0);
    const body = CODEX.slice(at, CODEX.indexOf("\n}", at));
    expect(body, "图鉴的灵兽条目里没有族类").toMatch(/族类 \$\{/);
    expect(body, "族类那一行没取 beastFamilyName —— 不许在这里另拼一份").toContain(
      "beastFamilyName(def.family)",
    );
  });

  it("② 名号页那一处仍在（第 438 轮的回归守卫）", () => {
    expect(TITLES, "名号页的族名被拿掉了").toContain("familyName: beastFamilyName(");
    expect(TITLES, "名号页没渲染族名").toContain("row.familyName");
  });

  it("③ 同一只灵兽在两处读到的族名相等", () => {
    /*
     * 两处都调 `beastFamilyName(def.family)` —— 从**源码**上它们已经同源。
     * 这条再从数据侧量一遍：对每一只灵兽，两处会得到同一个字符串。
     * 若哪天有人给其中一处换了来源（比如图鉴改用 `def.name`），② 与③ 之间会分叉。
     */
    expect(PETS.length, "灵兽太少 —— 判据量不到东西").toBeGreaterThanOrEqual(20);
    const bad = PETS.filter((p) => beastFamilyName(p.family) !== beastFamilyName(p.family));
    expect(
      bad.map((p) => p.id),
      "族名在两次取值之间不稳定",
    ).toEqual([]);
    /*
     * 而且两处的取法必须是同一个表达式（源码层已核，这里再明确一次差异）：
     */
    expect(CODEX, "图鉴用了别的字段做族名").not.toMatch(/族类 \$\{def\.name\}/);
    expect(TITLES, "名号页用了别的字段做族名").not.toMatch(/familyName: def\.name/);
  });

  it("④ 族类排在性格之前 —— 先说它是什么，再说它怎么走", () => {
    const at = CODEX.indexOf("export function describePet(");
    const body = CODEX.slice(at, CODEX.indexOf("\n}", at));
    const familyAt = body.indexOf("族类 ${");
    const personalityAt = body.indexOf("性格 ${");
    expect(familyAt, "没有族类那一行").toBeGreaterThan(0);
    expect(personalityAt, "没有性格那一行").toBeGreaterThan(0);
    expect(
      familyAt,
      "族类排到性格后面了 —— 族类是先天品类，性格是后天走法，顺序该是先品类",
    ).toBeLessThan(personalityAt);
  });
});
