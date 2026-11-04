/**
 * 卷首眉批的三项取数 —— 上轮留空的坑,这轮填上。
 *
 * ## 上一轮为什么留空
 *
 * 「有没有未领的赏」「行囊里有没有更合手的一件」「法宝位有没有空」这三项,
 * 当时看起来在 store 表面上没有干净来源。硬凑近似值会与那些页面自己的判定
 * 分岔 —— 而分叉比缺失更坏:缺失只是少说一句,分叉是两处互相矛盾。
 * 故那三项一并按 false 传,规则层对 false 的处理就是「不提这一条」。
 *
 * ## 这一轮找到的三个来源
 *
 *   rewardReady       —— `currentMainQuestProgress()?.done`(与领赏判定同一份)
 *   artifactSeatOpen  —— 持有数 > 上阵数,且上阵数 < 席位上限
 *   betterEquipAvailable —— 行囊里有没穿上的
 *
 * 每一项都有一个**已经存在**的判定,本模块不新造一套:取数而已。
 *
 * ## 为什么单独立一份判据
 *
 * `ui/nextStep` 那侧的判据只管规则(纯函数、不碰 store),它无法证明
 * 「这三项真的接到了真状态上」—— 那份判据里三项传 false 也照样全绿。
 * 故这里对着 useNextStep 的映射函数核:**不许再出现写死的 false**。
 */
import { describe, expect, it } from "vite-plus/test";
import { readSource } from "@/test/readSource";

describe("眉批三项取数 · 不许再有写死的 false", () => {
  it("endgameReached 也接了真来源 —— 道途一旦选定即此生已定", () => {
    const src = readSource("src/ui/useNextStep.ts")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
    const m = /endgameReached:\s*([^,\n]+)/.exec(src);
    expect(m, "endgameReached 在映射里不见了").not.toBeNull();
    expect(m![1]!.trim(), "仍写死成 false").not.toBe("false");
    expect(src, "要读道途").toContain("endgame.daoPath");
  });

  it("rewardReady / artifactSeatOpen / betterEquipAvailable 三项都接了真来源", () => {
    const src = readSource("src/ui/useNextStep.ts")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
    for (const field of ["rewardReady", "artifactSeatOpen", "betterEquipAvailable"]) {
      /*
       * 只看这一项的赋值:取到 `field:` 到该行结束。写死 false 的形态是
       * `field: false,` —— 那就是上一轮留空的坑,这轮不许回来。
       */
      const m = new RegExp(`${field}:\\s*([^,\\n]+)`).exec(src);
      expect(m, `${field} 在映射里不见了`).not.toBeNull();
      const value = m![1]!.trim();
      expect(value, `${field} 又被写死成 ${value} 了 —— 接真来源,或说明为什么取不到`).not.toBe(
        "false",
      );
    }
  });

  it("每一项都走既有的判定,不另造一套", () => {
    const src = readSource("src/ui/useNextStep.ts");
    // 未领的赏:与领赏判定同一份
    expect(src, "未领的赏要读主线任务进度").toContain("currentMainQuestProgress(");
    // 法宝席位:上限来自 data/artifacts 的同一处
    expect(src, "法宝席位上限要读共享函数").toContain("artifactSeatCap(");
  });
});

describe("眉批三项取数 · 不重复造账", () => {
  it("法宝席位上限只有一处定义 —— loadoutService 与眉批同源", () => {
    const loadout = readSource("src/core/loadoutService.ts");
    expect(loadout, "上限要收成一个导出函数").toContain("export function artifactSeatCap");
    const hook = readSource("src/ui/useNextStep.ts");
    expect(hook, "眉批读同一个函数").toContain('from "@/core/loadoutService"');
    // 不许在眉批里重算一份「基础位 + 传承加成」
    expect(hook, "眉批不该自己拼席位上限").not.toContain("artifactSlotBonus(");
    expect(hook, "眉批不该自己拼席位上限").not.toContain("artifactSlotsFor(");
  });
});
