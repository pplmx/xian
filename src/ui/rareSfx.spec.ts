/**
 * 玉振的声音 —— 稀有品阶的三层音。
 *
 * 判据六组:
 *   一 三层分级:rank < 6 → rare、6-7 → rareHigh、8 → rareTop;
 *   二 界与视觉层同源:与 qualityTier 的稀有段是同一个 rank ≥ 6;
 *   三 无印走 rare —— 转世/突破/里程碑那些不被惊动;
 *   四 坏值走 rare,不因为 NaN 掉进更弱或更强的一层;
 *   五 真接线:提示条按这条判据选音,且 audio 里三声互不相同;
 *   六 三声都在「管钟」这一族里 —— 不复用 breakthrough 的刮奏。
 */
import { describe, expect, it } from "vite-plus/test";
import { readSource } from "@/test/readSource";
import { QUALITIES } from "@/data/qualities";
import { rareSfxOf } from "./rareSfx";

describe("玉振的声音 · 三层分级", () => {
  it("低于稀有段 → 原来那一响", () => {
    for (const rank of [0, 1, 2, 3, 4, 5]) {
      expect(rareSfxOf(rank), `rank ${rank} 不该升层`).toBe("rare");
    }
  });

  it("天与仙 → rareHigh", () => {
    expect(rareSfxOf(6)).toBe("rareHigh");
    expect(rareSfxOf(7)).toBe("rareHigh");
  });

  it("神 → rareTop", () => {
    expect(rareSfxOf(8)).toBe("rareTop");
  });
});

describe("玉振的声音 · 与视觉层同一条界", () => {
  it("稀有段的分界正是 rank ≥ 6 —— 与 qualityTier 的 isRareQuality 同一个数", () => {
    const rareRanks = QUALITIES.filter((q) => q.rank >= 6).map((q) => q.rank);
    expect(rareRanks).toEqual([6, 7, 8]);
    for (const q of QUALITIES) {
      const tier = rareSfxOf(q.rank);
      const shouldBeDefault = q.rank < 6;
      expect(tier === "rare", `${q.name} 的分层与稀有段分界不一致`).toBe(shouldBeDefault);
    }
  });

  it("三层用到的档位覆盖全库且不缺档", () => {
    const tiers = new Set(QUALITIES.map((q) => rareSfxOf(q.rank)));
    // 低阶这么多档,必然有 rare;而 6/7/8 都在库里,故三层齐
    expect(tiers.has("rare")).toBe(true);
    expect(tiers.has("rareHigh")).toBe(true);
    expect(tiers.has("rareTop")).toBe(true);
  });
});

describe("玉振的声音 · 坏值不升层", () => {
  it("undefined / NaN / Infinity 都走 rare", () => {
    expect(rareSfxOf(undefined)).toBe("rare");
    expect(rareSfxOf(Number.NaN)).toBe("rare");
    expect(rareSfxOf(Number.POSITIVE_INFINITY), "无穷大不该被当成神品").toBe("rare");
  });
});

describe("玉振的声音 · 真接线", () => {
  it("提示条按这条判据选音 —— 声与光同一份判定", () => {
    /*
     * 提示条不单独算一次音:它从 flashPlan 里取 `sfx`(见 ui/flashTier)。
     * 同一个 `seal` 同时决定「闪多久、什么色」与「响哪一声」——
     * 分开算就会出现「光按神品闪、声按灵品响」这种分叉。
     */
    const host = readSource("src/components/common/ToastHost.vue");
    expect(host, "那一响要取自同一份 plan").toContain("playSfx(flashPlan.value.sfx)");
    expect(host, "不许另算一次").not.toMatch(/playSfx\(\s*rareSfxOf/);
    const flash = readSource("src/ui/flashTier.ts");
    expect(flash, "plan 里要带这一声").toContain("sfx: rareSfxOf(rank)");
  });

  it("audio 里三声都在,且互不相同", () => {
    const audio = readSource("src/core/audio.ts");
    for (const name of ["rare", "rareHigh", "rareTop"]) {
      expect(audio, `audio 里缺 ${name} 这一声`).toContain(`case "${name}"`);
    }
    // 三层各自的音高不同 —— 否则「分层」只是三个同名的 case
    const notes = ["D5", "F5", "A5"];
    for (const n of notes) {
      expect(audio, `三层该用不同的音高,缺 ${n}`).toContain(`"${n}"`);
    }
  });

  it("三声都用管钟这一族,不复用 breakthrough 的刮奏", () => {
    const audio = readSource("src/core/audio.ts");
    const block = audio.slice(audio.indexOf('case "rare":'), audio.indexOf('case "win":'));
    expect(block, "稀有品阶始终留在管钟这一族").toContain("bellSampler");
    expect(block, "不该在这三声里刮奏 —— 那是大境界突破的语义").not.toContain("gliss(");
  });
});
