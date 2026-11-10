/**
 * 天数可窥 —— 下一境将遇何劫，提前看得见
 *
 * `SamsaraStageDef.heavenInsight` 的注释是「天劫与终局规则的细节提前可见」，
 * 而它此前没有任何产品代码读它。第 36 轮接上：不是「藏起现有信息」，
 * 而是「提前给一件本来要等到那一境才知道的事」—— 下一境的劫型。
 *
 * 抄的是同一批字段里 `enemyInsight` 的做法（见 `ui/enemyLore.effectiveEnemyStage`）：
 * 它也不藏东西，只是把门槛下调一档，解锁「本来要再打几场才看得到的情报」。
 *
 * 判据要钉的是三件事:
 *   一 没开这一阶的人拿不到预览（否则它不是收益）；
 *   二 开了的人拿到的劫型，与真到那一境时结算用的**是同一个**（不做两本账）；
 *   三 到顶时不给预览（没有下一境，就没有可窥的天数）。
 */
import { describe, expect, it } from "vite-plus/test";
import { nextTribulationPreview } from "./heavenInsightPreview";
import { tribulationDef } from "@/data/tribulations";

/*
 * 劫型由「调用方算好」传进来 —— `rollTribulation` 要读当日天时（store），
 * 放进纯函数会把 pinia 拉进判据（实测报 `getActivePinia()`）。
 * 判据因此手工给几个真实劫型，并用 `tribulationDef` 反查作为期望值。
 */
const KINDS = ["thunder", "counterflow", "soulrend"] as const;

describe("天数可窥 · 下一境的劫型预览", () => {
  it("没开这一阶就是 null —— 否则它不算收益", () => {
    expect(nextTribulationPreview(false, "thunder", 5)).toBeNull();
  });

  it("开了就报得出下一境是什么劫", () => {
    const preview = nextTribulationPreview(true, "thunder", 5);
    expect(preview, "开了天数可窥却报不出下一境").toBeTruthy();
    expect(preview!.name.length, "劫名是空的").toBeGreaterThan(0);
    expect(preview!.desc.length, "没有一句说它会怎么伤到你").toBeGreaterThan(0);
  });

  it("预览的劫型与真到那一境时是同一条 —— 不做两本账", () => {
    /*
     * 这一条是整件事的地基:`rollTribulation` 是确定性的（种子取境界与当日天时），
     * 所以提前算与届时算必须一致。若哪天它改成随机，这条会红 ——
     * 那正是「预览开始撒谎」的时刻。
     */
    for (const kind of KINDS) {
      const preview = nextTribulationPreview(true, kind, 6)!;
      const settled = tribulationDef(kind);
      expect(preview.kind, `«${kind}» 的预览与结算不一致`).toBe(settled.id);
      expect(preview.name).toBe(settled.name);
      expect(preview.desc).toBe(settled.desc);
    }
  });

  it("报出的是「下一境」的编号，不是当下那一境", () => {
    /*
     * 调用方传进来的就是要预览的那一境。这一条钉住「不在这里再 +1」——
     * 偏移只发生在调用方一处，本模块不重复加。
     */
    const preview = nextTribulationPreview(true, "thunder", 7)!;
    expect(preview.major).toBe(7);
  });

  it("坏值当作没有可窥的天数", () => {
    expect(nextTribulationPreview(true, "thunder", Number.NaN)).toBeNull();
    expect(nextTribulationPreview(true, "thunder", -1)).toBeNull();
    expect(nextTribulationPreview(true, "thunder", Number.POSITIVE_INFINITY)).toBeNull();
    // 没有下一境（调用方传 null）时不给预览
    expect(nextTribulationPreview(true, null, 6)).toBeNull();
  });

  it("同一境反复调用给出同一个答案 —— 确定性", () => {
    const a = nextTribulationPreview(true, "counterflow", 6);
    const b = nextTribulationPreview(true, "counterflow", 6);
    expect(a).toEqual(b);
  });
});
