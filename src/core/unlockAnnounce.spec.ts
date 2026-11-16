/**
 * 破界入天界 —— 游戏里最大的一次解锁，要有一声。
 *
 * ## 缺口（第 422 轮）
 *
 * `firstUnlockAnnouncement` 此前只认两个门槛:
 *
 * ```text
 *   2 境（筑基）  灵脉初醒
 *   3 境（元婴）  凡境秘境之门开启、法宝位添一席
 *   9 境（真仙）  ← 什么都没有
 * ```
 *
 * 而跨过 `WORLD_BREAK_MAJOR`（真仙）这一道,同时开了**四样**东西:
 * 道途、每日天道、历世试炼、远征。也就是说那一句「世界变大了」的通告,
 * 本该出现在游戏最大的那次转折上,却一次也没响过。
 *
 * 玩家那边看到的是:某次普通的逐层突破之后,世界悄悄变大了 ——
 * 提示音与前一境一模一样,只有一个境界名换了字。
 *
 * ## 判据
 *
 * ① 真仙那一档有通告,且说的是真的（四样都点到）;
 * ② 三条门槛各自都会触发,且**只触发一次**（同境内逐层不重复轰炸）;
 * ③ 门槛读 `WORLD_BREAK_MAJOR`,不另写一个 9 —— 与 `endgameUnlocked()` 同一个常量;
 * ④ 反差：三者互不串台 —— 进元婴不该提天界,进真仙不该提法宝席。
 */
import { describe, expect, it } from "vite-plus/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { stripComments } from "@/test/stripComments";
import { firstUnlockAnnouncement } from "./breakthrough";
import { WORLD_BREAK_MAJOR, realmDef } from "@/data/realms";
import { ARTIFACT_SLOT_UNLOCK_MAJOR } from "@/data/artifacts";
import { VEIN_UNLOCK_MAJOR } from "@/data/constants";

describe("首次解锁通告 · 每次世界变大都要有一声", () => {
  it("破界入天界有通告，且四样都说到", () => {
    const line = firstUnlockAnnouncement(WORLD_BREAK_MAJOR - 1, WORLD_BREAK_MAJOR);
    expect(line, "跨入真仙那一步没有任何通告 —— 那是游戏最大的一次解锁").not.toBeNull();
    /*
     * 四样各点一句:道途 / 每日天道 / 历世试炼 / 远征。
     * 不要求逐字一致(文案会改),但四件事各得有一个记号。
     */
    for (const [what, re] of [
      ["道途", /道途/],
      ["每日天道", /每日/],
      ["历世试炼", /试炼/],
      ["远征", /远征/],
    ] as const) {
      expect(line, `通告里没提「${what}」—— 那一样也是这一刻开的`).toMatch(re);
    }
    // 境界名现取，不手写
    expect(line, "通告里的境界名该是 realmDef 现取的真仙").toContain(
      realmDef(WORLD_BREAK_MAJOR).name,
    );
  });

  it("三条门槛各触发一次，同境内逐层不重复轰炸", () => {
    const gates = [
      { at: VEIN_UNLOCK_MAJOR, name: "灵脉" },
      { at: ARTIFACT_SLOT_UNLOCK_MAJOR, name: "法宝席" },
      { at: WORLD_BREAK_MAJOR, name: "天界" },
    ];
    for (const g of gates) {
      expect(
        firstUnlockAnnouncement(g.at - 1, g.at),
        `跨入第 ${g.at} 境（${g.name}门槛）时没有通告`,
      ).not.toBeNull();
      /*
       * 同境内逐层突破（from === to）不许重复。这是通告自带的那条规则:
       * `from < 门槛 && to >= 门槛`，同境时两边的判断有一边必然不成立。
       */
      expect(
        firstUnlockAnnouncement(g.at, g.at),
        `同境内逐层突破时又播了一次「${g.name}」通告 —— 会变成骚扰`,
      ).toBeNull();
      // 已经跨过去的境界，再往后也不重复
      expect(
        firstUnlockAnnouncement(g.at + 1, g.at + 2),
        `已经过了 ${g.name} 门槛，后面还在播`,
      ).toBeNull();
    }
  });

  it("门槛读 WORLD_BREAK_MAJOR，不另写一个 9", () => {
    /*
     * 反差:若有人把 `WORLD_BREAK_MAJOR` 换成字面量 9，这条会红 ——
     * 那时改常量就撒谎:endgameUnlocked 跟着变，而通告还在 9 上。
     */
    const src = readFileSync(resolve(__dirname, "breakthrough.ts"), "utf-8");
    const at = src.indexOf("fromMajor < WORLD_BREAK_MAJOR && toMajor >= WORLD_BREAK_MAJOR");
    expect(at, "找不到那条天界门槛 —— 判据要跟着改名").toBeGreaterThan(0);
    // 全仓的 firstUnlockAnnouncement 里不许出现裸的 9
    /*
     * 只查**代码行**,不查注释 —— 注释里写「跨过 9 境」是正常的说明,
     * 而判据要防的是「算式里写死 9」。故先剥掉注释再比。
     */
    const fnAt = src.indexOf("export function firstUnlockAnnouncement");
    const fnEnd = src.indexOf("\n}", fnAt);
    const code = stripComments(src.slice(fnAt, fnEnd));
    expect(
      /\b9\b/.test(code),
      "不可达算式里出现了裸的 9 —— 门槛该读 WORLD_BREAK_MAJOR，与 endgameUnlocked 同一个常量",
    ).toBe(false);
    /*
     * 另加一条更直接的:天界那一档必须真的用常量名（名字在，读不读得上靠上一条）。
     */
    expect(code, "天界门槛没有读 WORLD_BREAK_MAJOR").toMatch(/WORLD_BREAK_MAJOR/);
  });

  it("反差：三条门槛互不串台", () => {
    /*
     * 进元婴那次不该提天界；进真仙那次不该提法宝席。
     * 否则玩家会在元婴就以为天界开了。
     */
    const atArtifact = firstUnlockAnnouncement(
      ARTIFACT_SLOT_UNLOCK_MAJOR - 1,
      ARTIFACT_SLOT_UNLOCK_MAJOR,
    )!;
    expect(atArtifact, "进元婴时提了天界的事").not.toMatch(/道途|远征|试炼/);
    const atImmortal = firstUnlockAnnouncement(WORLD_BREAK_MAJOR - 1, WORLD_BREAK_MAJOR)!;
    expect(atImmortal, "进真仙时还在提法宝席 —— 那是元婴的事").not.toMatch(/法宝/);
  });
});
