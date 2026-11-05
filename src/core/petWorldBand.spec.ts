/**
 * 神品灵兽一律不收进神界带 —— 白泽是那唯一的一处例外。
 *
 * ## 规则是数据文件自己写的
 *
 * `data/events.ts` 在仙品灵兽那批发放事件前写着:
 *
 *   > 境界带纪律:r7 收在 14-17(god),r8 收在 18-20(chaos)。
 *   > 神品**一律不收进** god 带 —— 否则神界就能开出 0.76 预算的镇岳尊。
 *
 * 这条纪律的理由是**预算**:神品被动预算是仙品的一倍多(`petQuality.spec` 钉着
 * 「总预算随品阶不回落」),若神界就能开出神品,那"混沌海才有的东西"这层稀缺
 * 就没了 —— 与法宝那边「早窗的神品仍是这一窗该有的强度」是同一种保护。
 *
 * ## 实测:白泽正好违反
 *
 * 把发放事件按带摊开:
 *
 *   chaos(18-19):10 只,全是神品
 *   god(14-17):  7 只仙品 + **白泽(神品,realm 15)**
 *
 * 白泽的预算是最低的神品(1.64),甚至低于最高的仙品(古岳犀 1.77)——
 * 它大概是规则收紧之前放的,没被回头清理。这不是"合理例外":注释写的是
 * 「一律」,而它之后立的判据一条都没有守这层。
 *
 * ## 判据守什么
 *
 * 一条:举凡 `quality === "divine"` 的灵兽,其**发放事件的境界带**必须落在 chaos。
 * 只认发放事件,不认别的 —— 灵兽在引擎侧只能由事件指名发放
 * (随机池硬性排除 immortal/divine,见 eventEngine 的 pet 分支)。
 */
import { describe, expect, it } from "vite-plus/test";
import { EVENTS } from "@/data/events";
import { PETS } from "@/data/pets";
import { worldOf } from "@/data/realms";

/** 一只灵兽由哪些世界的发放事件点名 */
function grantWorldsOf(petId: string): Set<string> {
  const worlds = new Set<string>();
  for (const ev of EVENTS) {
    const grants = ev.choices.some((ch) =>
      ch.outcomes.some((o) => o.effects.some((e) => e.type === "pet" && e.id === petId)),
    );
    if (!grants) continue;
    // 界域优先按 minRealm 定;没写 minRealm 的按标签兜底
    const byRealm = typeof ev.minRealm === "number" ? worldOf(ev.minRealm).id : undefined;
    const byTag = (["chaos", "god", "immortal"] as const).find((tag) => ev.tags.includes(tag));
    worlds.add(byRealm ?? byTag ?? "mortal");
  }
  return worlds;
}

describe("神品灵兽 · 境界带纪律", () => {
  it("神品只由混沌海带的发放事件点名 —— 不许在神界提前开出", () => {
    const offenders: string[] = [];
    for (const def of PETS) {
      if (def.quality !== "divine") continue;
      const worlds = grantWorldsOf(def.id);
      if (worlds.size === 0) {
        offenders.push(`${def.name}:没有任何事件发放它(图鉴里会是一个永锁的格子)`);
        continue;
      }
      const outside = [...worlds].filter((w) => w !== "chaos");
      if (outside.length > 0) {
        offenders.push(`${def.name}:由 ${outside.join(" / ")} 带的事件发放(应在 chaos)`);
      }
    }
    expect(
      offenders,
      `这些神品在混沌海之前就能开出 —— 神界就能拿到神品,` +
        `「混沌海才有的东西」这层稀缺就没了:\n  ${offenders.join("\n  ")}`,
    ).toEqual([]);
  });

  it("仙品由仙界及以上带发放 —— 不许落回人间界", () => {
    const offenders: string[] = [];
    for (const def of PETS) {
      if (def.quality !== "immortal") continue;
      const worlds = grantWorldsOf(def.id);
      if (worlds.size === 0) {
        offenders.push(`${def.name}:没有发放事件`);
        continue;
      }
      if (worlds.has("mortal")) offenders.push(`${def.name}:人间界就发得出来`);
    }
    expect(offenders, offenders.join("; ")).toEqual([]);
  });

  it("反空转:确实按世界分出了带", () => {
    const chaosDivine = PETS.filter(
      (p) => p.quality === "divine" && grantWorldsOf(p.id).has("chaos"),
    );
    expect(chaosDivine.length, "混沌海连一只神品都没有 —— 判据的前提没了").toBeGreaterThan(0);
  });
});
