/**
 * 兵解往生 —— 三程之前那一帖,仍是纯文字。
 *
 * ## 现状
 *
 * 上一轮给「往生三程」补了画:路签下面定高的一条,画这一世止步的那一界。
 * 但三程的**入口**是「兵解往生」这一帖(`RebirthDialog`)—— 玩家在人物页点
 * 「轮回 · 观想」先到这里,核对门槛、随魂 / 折损 / 归尘三账与逆旅契,
 * 再按「兵解转世」才进三程。
 *
 * 那一帖 1300 行模板里同样一个 `<svg>` 都没有。
 *
 * ## 为什么这一处要跟三程同一副长相
 *
 * 它们是同一件事的两段:这一帖说「此世收官」,三程说「辞世 / 回照 / 择生」。
 * 画的是同一样东西 —— 这一世止步在哪一界(`worldOf(player.major)`)。
 * 若入口有画、正文没有,或者两处画的是两种东西,读起来就是两份底稿。
 *
 * ## 判据守什么
 *
 *   一 这一帖也有画;
 *   二 与三程**取景同源**(`player.world.id`),不另立一套身份;
 *   三 落法也同一条:定高的一条,不铺满整册(这一帖比三程短,但它同样会滚动)。
 */
import { describe, expect, it } from "vite-plus/test";
import { readSource } from "@/test/readSource";

const DLG = "src/components/character/RebirthDialog.vue";
const REINC = "src/components/character/ReincarnationDialog.vue";

describe("兵解往生 · 与往生三程同一片天地", () => {
  it("这一帖也有画", () => {
    expect(readSource(DLG), "兵解往生仍是纯文字 —— 三程有画,入口没有").toContain("<InkScene");
  });

  it("取景与三程同源 —— 都读这一世所在的界", () => {
    const dlg = readSource(DLG);
    const reinc = readSource(REINC);
    const util = (s: string) => s.match(/<InkScene[\s\S]*?\/>/)?.[0] ?? "";
    const here = util(dlg);
    const there = util(reinc);
    expect(here, "定位不到 InkScene —— 判据会空转").not.toBe("");
    expect(there, "定位不到三程那一处 —— 判据会空转").not.toBe("");
    /*
     * 两处都是「这一世止步在哪一界」,故取景必须出自同一个身份。
     * 若其中一处改读别的(比如改读门槛那一境、或写死某一界),两屏就会画成两片天。
     */
    const worldOf = (tag: string) => tag.match(/:world-id="([^"]+)"/)?.[1] ?? "";
    expect(worldOf(here), "这一帖的取景要读这一世所在的界").toBe("player.world.id");
    expect(worldOf(there), "两处取景必须同源").toBe(worldOf(here));
  });

  it("落法与三程同一条:定高的一条,不铺满整册", () => {
    const dlg = readSource(DLG);
    const tag = dlg.match(/<InkScene[\s\S]*?\/>/)?.[0] ?? "";
    expect(tag, "定位不到 InkScene —— 判据会空转").not.toBe("");
    expect(tag, "画要是定高的一条").toContain('variant="strip"');
    const sceneRule = dlg.match(/\.rebirth-scene\s*\{[\s\S]*?\n\}/)?.[0] ?? "";
    expect(sceneRule, "定位不到 .rebirth-scene —— 判据会空转").not.toBe("");
    expect(sceneRule, "这一条要有自己的高度").toMatch(/--ink-scene-h:/);
    expect(sceneRule, "画不许铺满整册").not.toMatch(/position:\s*absolute/);
  });
});
