/* oxlint-disable no-console */
/**
 * 资源偏向的五世轮转 —— 真实换界链路审计
 *
 * mortalWorldGen 的验收单只证明「按完整历史生成」能覆盖全池。
 * 玩家实际走的是 mortalWorldService → generateGatedMortal，
 * 而此前只把上一世世界传进历史，并不知道更早几世的偏向。
 * mortalWorldGen 证明五世覆盖全池；这份用例只盯真实接线：
 * 换界必须补齐最近几世未见的偏向，历史还要跨刷新保留。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { createPinia, setActivePinia } from "pinia";
import { useAdventureStore } from "@/stores/adventure";
import { BIAS_POOL } from "./mortalBias";
import { generateMortalWorld } from "./mortalWorldGen";
import { rerollMortalWorld } from "./mortalWorldService";

beforeEach(() => {
  setActivePinia(createPinia());
  vi.spyOn(Date, "now").mockReturnValue(20260904);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("资源偏向 · 真实换界链路", () => {
  it("补上最近四世未见的偏向,清洗后历史仍在", () => {
    const adventure = useAdventureStore();
    const current = { ...generateMortalWorld(20260904), bias: BIAS_POOL[0] };
    const seen = BIAS_POOL.slice(0, -1);
    adventure.$patch({
      mortalWorld: current,
      mortalBiasHistory: seen,
    } as never);

    const next = rerollMortalWorld();
    expect(next, "换界没有生成新世界").not.toBeNull();
    console.log(`\n最近四世:${seen.join("、")} → 换界补上:${next!.bias}`);
    expect(next!.bias, "真实换界没有补齐缺失的资源偏向").toBe(BIAS_POOL.at(-1));
    const history = [...seen, BIAS_POOL.at(-1)!];
    expect(adventure.mortalBiasHistory, "新世界偏向没有接进轮转历史").toEqual(history);

    adventure.sanitize();
    expect(adventure.mortalBiasHistory, "读档清洗把轮转历史洗丢了").toEqual(history);
  });

  it("旧档只有当前世界时补种历史,坏偏向与超长尾巴一并清洗", () => {
    const adventure = useAdventureStore();
    const current = { ...generateMortalWorld(20260904), bias: BIAS_POOL[2] };

    adventure.$patch({
      mortalWorld: current,
      mortalBiasHistory: [],
    } as never);
    adventure.sanitize();
    expect(adventure.mortalBiasHistory, "旧档当前世界的偏向没有进入轮转历史").toEqual([
      BIAS_POOL[2],
    ]);

    adventure.$patch({
      mortalBiasHistory: [
        BIAS_POOL[0],
        "旧存档里的坏词",
        BIAS_POOL[1],
        BIAS_POOL[0],
        BIAS_POOL[1],
        BIAS_POOL[0],
        BIAS_POOL[1],
      ],
    } as never);
    adventure.sanitize();
    expect(adventure.mortalBiasHistory, "坏项没剔除或最近五世没有截断").toEqual([
      BIAS_POOL[0],
      BIAS_POOL[1],
      BIAS_POOL[0],
      BIAS_POOL[1],
      BIAS_POOL[2],
    ]);
  });
});
