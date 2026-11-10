/**
 * 入门第一境的名字：欢迎页一处叫「引气」，一处叫「炼气」
 *
 * 欢迎页同一屏上有两句话:
 *
 *   你从「引气」一层起,择功法、铸道途、渡天劫
 *   二十一境四界,自「炼气」一路走到混沌道祖
 *
 * 而 data/realms 里第一境的名字是「炼气」（id lianqi）。
 * 同一个境界在同一屏上有两个名字，而玩家第一次读到的那个是错的。
 *
 * 「引气」不算生造词（吐纳导引、引气入体都通），问题在于本作
 * 已经给这一境取了名，界面就不该再发明一个别名 —— 与 statNames
 * 那条「词条文案用 modsText，别自己另拼一份」同一条纪律。
 */
import { describe, expect, it } from "vite-plus/test";
import { readSource } from "@/test/readSource";
import { REALMS } from "@/data/realms";

const realmNames = REALMS.map((r) => r.name);

describe("欢迎页 · 境界名必须来自境界表", () => {
  it("不出现「引气」这种表外别名", () => {
    const src = readSource("src/views/WelcomeView.vue");
    expect(src, "欢迎页把第一境叫成了「引气」—— 境界表里它叫「炼气」").not.toContain("引气");
  });

  it("欢迎页确实提到了境界名 —— 否则判据空转", () => {
    const src = readSource("src/views/WelcomeView.vue");
    expect(
      realmNames.some((n) => src.includes(n)),
      "欢迎页一句境界名都没提到，判据没量到东西",
    ).toBe(true);
  });
});
