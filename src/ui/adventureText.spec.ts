/**
 * 历练会话战绩文案 —— 胜负两本账的唯一出处(spec 计数与 test:report 分类随之对账)
 *
 * 逐条判据:两本账 / 全胜不摆「负 0」/ 坏数夹到 0 / 收尾与面板同源。
 */
import { describe, expect, it } from "vite-plus/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { sessionRecordText, sessionStatRows } from "./adventureText";

describe("历练战绩文案", () => {
  it("胜+负两本账并列;全胜只报胜场,不摆「负 0 场」", () => {
    expect(sessionRecordText({ wins: 2, losses: 3 })).toBe("胜 2 场 · 负 3 场");
    expect(sessionRecordText({ wins: 9, losses: 1 })).toBe("胜 9 场 · 负 1 场");
    expect(sessionRecordText({ wins: 5, losses: 0 })).toBe("胜 5 场");
  });

  it("坏数夹到 0,不吐 NaN 场(Math.max(0, NaN) 仍是 NaN)", () => {
    expect(sessionRecordText({ wins: Number.NaN, losses: 1 })).toBe("胜 0 场 · 负 1 场");
    expect(sessionRecordText({ wins: 3, losses: Number.NaN })).toBe("胜 3 场");
    expect(sessionRecordText({ wins: -2, losses: -1 })).toBe("胜 0 场");
    expect(sessionRecordText({ wins: 2.9, losses: 1.5 })).toBe("胜 2 场 · 负 1 场");
  });

  it("收尾播报与战斗面板都读同一份文案,不各写一遍", () => {
    const core = readFileSync(resolve(__dirname, "../core/exploration.ts"), "utf8");
    expect(core).toContain("sessionRecordText");
    expect(core, "收尾不再自己手写「胜 N 场」").not.toContain("胜 ${s.wins} 场");
    const panel = readFileSync(
      resolve(__dirname, "../components/adventure/CombatPanel.vue"),
      "utf8",
    );
    expect(panel).toContain("sessionStatRows");
  });

  it("征途簿四格同源:战绩、际遇、拾获、悟道,坏数不落进界面", () => {
    expect(
      sessionStatRows({
        wins: 2,
        losses: 1,
        events: 4,
        itemGain: 3,
        wudaoGain: 9,
      }),
    ).toEqual([
      { id: "record", label: "战绩", value: "胜 2 场 · 负 1 场" },
      { id: "events", label: "际遇", value: "4" },
      { id: "loot", label: "拾获", value: "3" },
      { id: "wudao", label: "悟道", value: "9" },
    ]);
    expect(
      sessionStatRows({
        wins: Number.NaN,
        losses: -1,
        events: Number.NaN,
        itemGain: -3,
        wudaoGain: 2.9,
      }).map((row) => row.value),
    ).toEqual(["胜 0 场", "0", "0", "2"]);

    const panel = readFileSync(
      resolve(__dirname, "../components/adventure/CombatPanel.vue"),
      "utf8",
    );
    expect(panel, "征途簿四格走同一份行数据").toContain(
      'v-for="stat in sessionStats" :key="stat.id"',
    );
    expect(panel, "四格都要有稳定落点").toContain(':data-combat-stat="stat.id"');
  });
});
