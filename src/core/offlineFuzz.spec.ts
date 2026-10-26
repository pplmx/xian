/**
 * 离线结算 · 随机状态下的不变量。
 *
 * 各条离线用例都是手写的一种状态(忙碌档 / 空档 / 深探档…)。真实档是这些维度的组合:
 * 境界 × 区域 × 出行方式 × 缺席时长 × 洞府等级 × 本世偏向。组合里只要有一条会抛错、
 * 或者算出 NaN / 负数,玩家回来就是一屏空白或白屏 —— 而手写用例碰不到。
 *
 * 这里用固定种子随机走 120 组,断言:结算不抛错、灵石与修为是有限非负数、场次自洽、
 * 灵气不为 NaN/负数;失败时把「境界 / 区域 / 出行 / 时长」一起打出来,便于复现。
 *
 * 不测「具体发了多少」—— 那是各条行为用例的事;这一条只管「怎么组合都不崩、不出脏数」。
 */
import { beforeEach, describe, expect, it } from "vite-plus/test";
import { setActivePinia, createPinia } from "pinia";
import { settleOffline } from "./offline";
import { useGameStore } from "@/stores/game";
import { usePlayerStore } from "@/stores/player";
import { useAdventureStore } from "@/stores/adventure";
import { useResourcesStore } from "@/stores/resources";
import { useDongfuStore } from "@/stores/dongfu";
import { gn, toNum } from "@/utils/gnum";
import { REGIONS } from "@/data/regions";

/** 线性同余:固定种子 → 固定序列(不依赖全局 rng,免得被别的用例改掉) */
function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const MODES = ["normal", "deep", "risky", "prolonged"] as const;
const BIASES = ["草木丰饶", "矿脉深厚", "典籍散佚", "灵石充盈", "药气氤氲"] as const;

describe("离线结算 · 随机状态不变量", () => {
  beforeEach(() => setActivePinia(createPinia()));

  it("120 组随机状态:不抛错、不出 NaN、场次自洽", () => {
    const rand = lcg(20251026);
    const fails: string[] = [];
    let withBattles = 0;
    let withItems = 0;

    for (let i = 0; i < 120; i += 1) {
      setActivePinia(createPinia());
      const game = useGameStore();
      const player = usePlayerStore();
      const adventure = useAdventureStore();
      const resources = useResourcesStore();
      const dongfu = useDongfuStore();
      const hours = 0.5 + rand() * 71.5;
      const major = Math.floor(rand() * 21);
      const region = REGIONS[Math.floor(rand() * REGIONS.length)]!;
      const mode = MODES[Math.floor(rand() * MODES.length)]!;
      const bias = rand() < 0.4 ? undefined : BIASES[Math.floor(rand() * BIASES.length)];

      game.markStarted();
      game.lastActiveAt = Date.now() - hours * 3600_000;
      game.totalPlaySec = 3600;
      player.major = major;
      player.sub = Math.floor(rand() * 3);
      player.exp = gn(0);
      resources.setQi(0, player.qiCapValue);
      resources.spiritStone = gn(0);
      dongfu.setLevel("mansion", Math.floor(rand() * 6));
      dongfu.setLevel("field", Math.floor(rand() * 6));
      adventure.setSession({
        regionId: region.id,
        mode,
        startedAt: Date.now() - hours * 3600_000,
        endsAt: Date.now() + 999 * 3600_000,
        nextBattleAt: 0,
        wins: 0,
        losses: 0,
        events: 0,
        stoneGain: gn(0),
        expGain: gn(0),
        itemGain: 0,
        wudaoGain: 0,
      } as never);
      adventure.setMortalWorld(bias ? ({ bias, chain: [] } as never) : null);

      const where = `major=${major} · ${region.id}/${mode}/${hours.toFixed(1)}h · ${bias ?? "无偏向"}`;
      try {
        const s = settleOffline(Date.now());
        if (!s) {
          fails.push(`#${i} 结算返回 null(${where})`);
          continue;
        }
        const stone = toNum(s.stone);
        const exp = toNum(s.exp);
        if (!Number.isFinite(stone) || stone < 0)
          fails.push(`#${i} 灵石增量异常:${stone}(${where})`);
        if (!Number.isFinite(exp) || exp < 0) fails.push(`#${i} 修为增量异常:${exp}(${where})`);
        if (s.herb < 0 || s.ore < 0 || s.wudao < 0) fails.push(`#${i} 材料增量为负(${where})`);
        if (s.battles < 0 || s.wins < 0 || s.wins > s.battles) {
          fails.push(`#${i} 场次不自洽:${s.wins}/${s.battles}(${where})`);
        }
        if (!Number.isFinite(resources.qi) || resources.qi < 0) {
          fails.push(`#${i} 灵气成了脏数:${resources.qi}(${where})`);
        }
        if (s.battles > 0) withBattles += 1;
        if (s.herb + s.ore > 0) withItems += 1;
      } catch (e) {
        fails.push(`#${i} 抛错:${(e as Error).message}(${where})`);
      }
    }

    expect(fails.slice(0, 8)).toEqual([]);
    // 防空转:随机档必须真的打到仗、捡到东西,否则这条判据只是跑了个空循环
    expect(withBattles, "随机档里一场仗都没打 —— 夹具没造出有效会话?").toBeGreaterThan(20);
    expect(withItems, "随机档里一件材料都没捡到").toBeGreaterThan(10);
  });
});

describe("离线结算 · 结算即盖章(同一段时间只算一次)", () => {
  /*
   * 盖章原本是调用方的责任(engine 结算完紧跟一句 game.stampActive(now))——
   * 那是一条只能靠自觉的契约:谁新增调用点忘了盖章,同一段时间就结算两遍。
   * 现在盖章挪进 settleOffline 自己:连跑两次,第二次拿到的 dt 是 0。
   */
  it("连跑两次:第二次不再发东西(同一段时长只算一次)", () => {
    setActivePinia(createPinia());
    const game = useGameStore();
    const player = usePlayerStore();
    game.started = true;
    game.lastActiveAt = Date.now() - 3 * 3600 * 1000;
    const now = Date.now();
    expect(settleOffline(now), "三小时离该结算出东西").not.toBeNull();
    const expAfterFirst = toNum(player.exp);
    expect(settleOffline(now), "第二次应当什么都不算").toBeNull();
    expect(toNum(player.exp), "第二次不许再发").toBe(expAfterFirst);
    expect(game.lastActiveAt, "盖章落在结算时刻").toBe(now);
  });

  it("引擎仍然盖章也无害 —— 盖章是幂等的", () => {
    setActivePinia(createPinia());
    const game = useGameStore();
    game.started = true;
    game.lastActiveAt = Date.now() - 3 * 3600 * 1000;
    const now = Date.now();
    settleOffline(now);
    game.stampActive(now);
    expect(settleOffline(now)).toBeNull();
  });
});
