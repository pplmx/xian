/**
 * 「本次所得」那一行的三样读数,要用同一把尺子。
 *
 * ## 缺口:同一行里两种格式
 *
 * 面板上那一行写的是:
 *
 *     本次所得 灵石 +120万 修为 +340万 器灵尘 +12345
 *
 * 灵石与修为走 `formatGN`(按中文量级折成「万 / 亿」),而器灵尘上轮新加时
 * 直接把原始数字印了出去。于是同一行里两种格式并排 ——
 * 前两个是折过的,第三个是裸的。
 *
 * ## 不是理论问题:尘真的会到万
 *
 * 一场战斗最多只有一次装备折算(尘 1~256,见 DECOMPOSE_DUST),看着不大。
 * 但「本次所得」是**一场历练会话**的累计,而最长的长线云游是 4 小时:
 * 按战斗间隔算下来是上千场,一场几百尘,累计到五位数是正常量级。
 * 那时灵石写着「+1.2亿」,器灵尘写着「+123456」—— 同一行,读起来是两个世界。
 *
 * ## 做法:与同行的另两样同源
 *
 * 用同一个 `formatGN`,不另写一套缩写规则。器灵尘是 number,
 * 而 `formatGN` 本就接受 `number | GNum`,不需要先包一层。
 */
import { describe, expect, it } from "vite-plus/test";
import { readSource } from "@/test/readSource";
import { formatGN } from "@/utils/format";

describe("本次所得 · 三样读数同一把尺子", () => {
  it("器灵尘与灵石走同一个格式化函数 —— 不印裸数字", () => {
    const panel = readSource("src/components/adventure/CombatPanel.vue");
    // 取 gains 那一段
    const at = panel.indexOf("const gains = computed");
    expect(at, "gains 要还在").toBeGreaterThan(0);
    const block = panel.slice(at, panel.indexOf("});", at) + 3);
    expect(block, "灵石已走 formatGN").toContain("formatGN(s.stoneGain)");
    expect(block, "修为已走 formatGN").toContain("formatGN(s.expGain)");
    /*
     * 器灵尘经 formatGN 出数。格式化落在模板那一处(值为 number,判空用的是原始
     * 值,不能在 computed 里就折成字符串)—— 故判据看模板里那一句。
     */
    expect(panel, "器灵尘也要走 formatGN —— 同一行两种格式并排,读起来是两个世界").toMatch(
      /data-combat-dust[^>]*>\+\{\{\s*formatGN\(gains\.dust\)/,
    );
  });

  it("大数真的会被折 —— 证明换 formatGN 有意义", () => {
    // 五位数:裸印就是 12345,折过才有「万」
    expect(formatGN(12345)).not.toBe("12345");
    expect(formatGN(12345)).toMatch(/万/);
    // 小数仍然读得清
    expect(formatGN(7)).toBe("7");
  });

  it("反空转:确认取到了 gains 那一段", () => {
    const panel = readSource("src/components/adventure/CombatPanel.vue");
    expect(panel.indexOf("const gains = computed")).toBeGreaterThan(0);
    expect(panel).toContain("data-combat-dust");
  });
});
