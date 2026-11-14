/**
 * Boss 相位触发时的那句话，玩家要看得到。
 *
 * ## 由来（第 211 轮，查相位机制的运行时表现）
 *
 * `core/combat.ts` 里:
 *
 * ```ts
 * if (ph.label) push("info", "e", `【${eSnap.name}】${ph.label}!`);
 * ```
 *
 * 实测（构造一个 5 回合打完的首领战）:
 *
 * ```text
 * 【试炼首领】狂化!
 * ```
 *
 * **机制与文本都是对的。**
 *
 * ## 但它没有判据
 *
 * ```text
 * bossPhaseAudit.spec   6 条，全在查**配置**（覆盖率 / 多样性 / 强度 / 生态 / 指纹）
 * combat.spec           不查这条文本
 * ```
 *
 * 也就是说:有人在 `data/enemies.ts` 里把 `label` 删了、或者把那段 `push` 挪走了，
 * 玩家会**在毫无提示的情况下**被一个突然变强的首领打 —— 而这正是这一仓纪律里
 * 「让看不见的机制可见」要防的。
 *
 * ## 这条判据守什么
 *
 * 用一场真的会跨过相位线的战斗，核那三件事:
 *
 * ① 相位真的触发了（配置里有 `hpThreshold`，战斗里该跨过去）;
 * ② 战报里出现带 `label` 的那一句;
 * ③ 那句里带着敌人名（否则玩家不知道是谁变了）。
 *
 * ## 故障注入
 *
 * 删掉 `combat.ts` 里那句 `if (ph.label) push(…)` → 第二条红（战报里找不到那句话）。
 * 把模板改成 `` `${ph.label}!` ``（去掉敌人名）→ 第三条红。
 */
import { describe, expect, it } from "vite-plus/test";
import { resolveCombat } from "./combat";
import { RandomService } from "@/utils/random";
import { gn } from "@/utils/gnum";
import type { CombatantSnap } from "@/types";

/** 造一个必定跨过 50% 线的首领战（我方稳压，5 回合左右打完） */
function runBossFight(): ReturnType<typeof resolveCombat> {
  const rng = new RandomService(() => 0.5);
  const player: CombatantSnap = {
    name: "挑战者",
    icon: "user",
    isPlayer: true,
    speed: 10,
    attack: gn(500),
    defense: gn(100),
    maxHp: gn(100_000),
    mods: {},
    skills: [],
  };
  const boss: CombatantSnap = {
    name: "试炼首领",
    icon: "skull",
    isPlayer: false,
    speed: 10,
    attack: gn(100),
    defense: gn(10),
    maxHp: gn(2_000),
    mods: {},
    skills: [],
    phases: [{ hpThreshold: 0.5, modChanges: { damageBonus: 0.5 }, label: "狂化" }],
  };
  return resolveCombat(player, boss, rng);
}

describe("Boss 相位 · 触发时玩家要看得到", () => {
  it("判据的前提还在 —— 那场战斗会跨过相位线", () => {
    const r = runBossFight();
    expect(r.win, "构造的战斗没打赢 —— 前提要重做").toBe(true);
    expect(r.rounds, "回合数异常").toBeGreaterThan(1);
  });

  it("战报里出现带 label 的那一句", () => {
    const r = runBossFight();
    const lines = r.log.map((l) => l.text ?? "").filter(Boolean);
    const hit = lines.find((t) => t.includes("狂化"));
    expect(
      hit,
      "相位触发了，而战报里没有那句话 —— 玩家会在毫无提示的情况下被一个突然变强的首领打，" +
        "而这正是「让看不见的机制可见」要防的。战报里只有:" +
        lines.slice(0, 5).join(" / "),
    ).toBeTruthy();
  });

  it("那句里带着敌人名 —— 否则玩家不知道是谁变了", () => {
    const r = runBossFight();
    const hit = r.log.map((l) => l.text ?? "").find((t) => t.includes("狂化")) ?? "";
    expect(hit, `那句话里没有敌人名 —— «${hit}»`).toContain("试炼首领");
    // 而它该用书里那套括号（与其余战报同一副面孔）
    expect(hit, `那句话没套【】 —— «${hit}»`).toContain("【");
  });
});
