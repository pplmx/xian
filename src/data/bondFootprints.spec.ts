/* oxlint-disable no-console */
/**
 * 足迹 —— 她开口之前，玩家看得见什么。
 *
 * ## 这条判据补的是 `bondCausality.spec` 量出来的那个 0
 *
 * 那个 spec 的结论是「四条链的足迹数全为 0」：她的意图由经历催生（34.1 已解决），
 * 但**玩家收到之前没有任何征兆** —— 她忽然说话，而那正是它自己判为 `abrupt` 的那一档。
 *
 * 本轮把它实现成 `data/bondFootprints`：按 ripeness 分三档，各吐一句。
 * 这条判据验的是**它真的覆盖了开口前的整段路**，而不只是「函数有返回值」。
 *
 * ## 判据
 *
 * ① 酝酿一路上（从刚被想起到即将开口）都要有足迹，不能有断点；
 * ② 档位随酝酿单调推进（越接近开口，越急切）—— 反向退档会让玩家以为她放下了；
 * ③ 三句话都由 `pursuit` 派生 —— 改了「所求」，足迹跟着变，不是另写一份；
 * ④ 已了结 / 无意图时不给足迹；
 * ⑤ 已开口过又被忽略、重新攒回来时，不再说「终究没说」—— 她说过了；
 * ⑥ 分档按**各自门槛的百分比**，不按绝对值 —— 否则谨慎与激进在同一 ripeness 上
 *    会被判成同一档，而他们的处境差得远。
 */
import { describe, expect, it } from "vite-plus/test";
import { footprintsOf } from "@/data/bondFootprints";
import { willSpeak } from "@/data/bondIntent";
import type { BondIntent } from "@/data/bondIntent";
import { DAOLU } from "@/data/daolu";
import { TEMPER_RESERVE } from "@/data/bondIntent";

function intentAt(ripeness: number, over: Partial<BondIntent> = {}): BondIntent {
  return {
    daoluId: "shen_qingli",
    wish: "寻找十年前失踪的师尊",
    line: "她忽然停下：「往北那条路……我想去看看。」",
    ripeness,
    sparks: ["shared"],
    raised: 0,
    responses: [],
    settled: false,
    ...over,
  };
}

describe("足迹 · 她开口之前的那些征兆", () => {
  it("酝酿一路上没有断点：从刚被想起到即将开口，每一段都有话说", () => {
    /*
     * 防的是「只在最后一句附近给足迹」—— 那样玩家仍然会经历一大段空窗。
     * 这里逐 0.05 扫一遍，每一格都必须至少有一句。
     */
    const gaps: string[] = [];
    for (const d of DAOLU) {
      for (let r = 0.05; r < 1; r += 0.05) {
        if (footprintsOf(intentAt(r), d.temper).length === 0) {
          gaps.push(`${d.name}@${r.toFixed(2)}`);
        }
      }
    }
    expect(
      gaps,
      `这些酝酿点上一句话都没有 —— 玩家在那一段里仍然什么征兆都看不到：${gaps.slice(0, 8).join("、")}`,
    ).toEqual([]);
  });

  it("档位随酝酿单调推进 —— 反向退档会让玩家以为她放下了", () => {
    const ORDER = ["mentioned", "dwelling", "hesitating"] as const;
    const rank = (t: string): number => ORDER.indexOf(t as (typeof ORDER)[number]);
    const regress: string[] = [];
    for (const d of DAOLU) {
      let peak = -1;
      for (let r = 0.05; r < 1; r += 0.05) {
        const all = footprintsOf(intentAt(r), d.temper);
        const top = all.length > 0 ? rank(all[all.length - 1]!.tier) : -1;
        if (top < peak)
          regress.push(`${d.name}@${r.toFixed(2)} 从 ${ORDER[peak]} 退回 ${ORDER[top]}`);
        peak = Math.max(peak, top);
      }
    }
    expect(regress, `这些位置上档位倒退：${regress.slice(0, 5).join("、")}`).toEqual([]);
  });

  it("三句话都由「所求」派生 —— 改了所求，足迹跟着变", () => {
    /*
     * 防的是「另写一份文案」：若足迹把「师尊」写死在字符串里，
     * 改 DAOLU 的 pursuit 时它不会跟，于是玩家读到的是别人的心事。
     */
    const original = footprintsOf(intentAt(0.9), "cautious");
    const changed = footprintsOf(intentAt(0.9, { wish: "把那柄铁剑养到出鞘" }), "cautious");
    expect(original.length).toBeGreaterThan(0);
    expect(changed.length).toBe(original.length);
    // 至少有一条文本不同 —— 证明它真的读了 wish
    const differs = original.some((o, i) => o.text !== changed[i]!.text);
    expect(differs, "改了「所求」而足迹一个字都没变 —— 说明文案是另写死的").toBe(true);

    // 而十位道侣各写各的：两两之间足迹文本不该完全相同
    const texts = DAOLU.map((d) =>
      footprintsOf(intentAt(0.9, { wish: d.pursuit, daoluId: d.id }), d.temper)
        .map((f) => f.text)
        .join("|"),
    );
    const unique = new Set(texts);
    expect(unique.size, "十位道侣的足迹文本有重复 —— 说明没照着各自的所求派生").toBeGreaterThan(5);
  });

  it("已了结 / 无意图时不给足迹", () => {
    expect(footprintsOf(null, "cautious")).toEqual([]);
    expect(footprintsOf(intentAt(0.9, { settled: true }), "cautious")).toEqual([]);
    expect(footprintsOf(null, "cautious")).toEqual([]);
  });

  it("已开口过又被忽略、重新攒回来时，不再说「终究没说」", () => {
    /*
     * 她说过了。此时再说「有话要说，终究没说」是错的事实——
     * 玩家见过她开口的样子。这一档应停在「一直惦记」。
     */
    /*
     * 用 raised=1、不带 ignore 的样本:ignore 会把门槛抬到 1.4 倍,
     * 那样 ripeness 再高也只是「一直惦记」—— 测不到这一档。
     * 而 raised=1 且没有 ignore 时门槛不变,ripiness 够高就该到第三档 ——
     * 除非那道守卫生效。
     */
    const again = footprintsOf(intentAt(1.2, { raised: 1, responses: [] }), "cautious");
    expect(
      again.some((f) => f.tier === "hesitating"),
      "她已经开过一次口了，不该再说「终究没说」",
    ).toBe(false);
    expect(again.length, "开过口的人仍要有足迹 —— 否则那一段又空了").toBeGreaterThan(0);

    // 对照：同一份 ripeness、从没开过口的同一个人，这一档是有的
    const firstTime = footprintsOf(intentAt(1.2, { responses: [] }), "cautious");
    expect(
      firstTime.some((f) => f.tier === "hesitating"),
      "从没开过口的人，在这个酝酿度上该已经有「终究没说」那一档",
    ).toBe(true);
  });

  it("分档按各自门槛的百分比，不按绝对值", () => {
    /*
     * 谨慎门槛 1.4、激进 0.8（TEMPER_RESERVE）。同一个 ripeness 上，
     * 激进的那个人离开口更近，故她的足迹该更急切。
     *
     * 若分档按绝对值，两人会得到同一份足迹 —— 而她们的处境差得远。
     */
    expect(TEMPER_RESERVE.cautious).toBeGreaterThan(TEMPER_RESERVE.bold);
    const r = 0.7;
    const last = (t: string): string | undefined =>
      footprintsOf(intentAt(r), t as never).at(-1)?.tier;
    const boldTop = last("bold");
    const cautiousTop = last("cautious");
    expect(boldTop, "激进者在这个 ripeness 上该已经走到更急的那一档").toBe("hesitating");
    expect(cautiousTop, "谨慎者在同一个 ripeness 上还不该那么急").not.toBe("hesitating");
  });

  it("她即将开口时，足迹仍在；一开口就交给那句话本身", () => {
    /*
     * 这一条钉的是**交接点**:ripeness 到门槛时 willSpeak 为真,
     * 界面会改印她的话(见 BondDialog 的 v-if)。足迹在同一刻仍然算得出,
     * 但界面不再显示它 —— 两处同时说会互相削弱。
     *
     * 判据只验「交接点两侧都有人说话」,不验界面分支(那条要真浏览器)。
     */
    for (const d of DAOLU) {
      const bar = TEMPER_RESERVE[d.temper];
      const justBefore = footprintsOf(intentAt(bar * 0.98), d.temper);
      expect(justBefore.length, `${d.name}：开口前一格一句话都没有`).toBeGreaterThan(0);
      expect(willSpeak(intentAt(bar), d.temper), `${d.name}：到了门槛该开口了`).toBe(true);
    }
  });
});
