/**
 * 天时对账 —— "每日天时"交给库的周期层之后,与**迁移前冻结的旧实现**逐日相同。
 *
 * 与 engineParity 同一条纪律。下面 `refTodayWeather` 是从旧 `core/weather.ts`
 * 原样抄下来的那段(种子公式 + 两条抽取规则)。
 *
 * 为什么必须逐日比:天时是**玩家看得见**的东西("今天是仙劫日""还有多久换天时"),
 * 换实现若让某一天的天时变了,玩家会以为游戏在动平衡;而这一层的意义恰恰是
 * "同一个周期永远是同一个结果"。
 *
 * ## 人间界那一段**不再逐日对账**,原因写在下面(2026-11-16)
 *
 * 上面那条纪律守的是"迁移不该动到玩家看见的东西"。而**人间界的抽取规则本身
 * 有一个真缺陷**,与迁移无关:
 *
 * ```ts
 * if (roll < 0.3) return entries[4];                  // 清和
 * const idx = Math.floor(((roll - 0.3) / 0.7) * 4);   // ← 写死的 4
 * return entries[Math.min(3, idx)];                   // ← 写死的上界 3
 * ```
 *
 * 池子从 5 条长到 9 条(罡风 / 凝霜 / 霞光 / 天朗,分四次提交),这段权重没跟着改,
 * 于是**后补的四条永远抽不到** —— 实测 2000 个游戏日只出现 5 种。
 *
 * 故人间界这里改成守**性质**而不是冻结快照:
 *
 *   一 池里每一条都抽得到（冻结快照会把这个缺陷一起冻进去）;
 *   二 同一游戏日内任意时刻给出同一条（"同一个周期永远同一个结果",这才是本条的本意）;
 *   三 清和仍占约三成、其余各条大致均分（权重规则没被改坏）。
 *
 * 界外三池**规则未动**,故继续逐日对账 —— 那一半的迁移等价性仍然完整。
 */
import { beforeEach, describe, expect, it } from "vite-plus/test";
import { resetWorld } from "./parityShared";
import { useGameStore } from "@/stores/game";
import { usePlayerStore } from "@/stores/player";
import { REALMS, worldOf } from "@/data/realms";
import { mulberry32, RandomService } from "@/utils/random";
import {
  WEATHERS,
  WORLD_WEATHERS,
  todayWeather,
  upcomingWeather,
  weatherRemainingSec,
  type WeatherDef,
} from "./weather";

// —— 迁移前冻结的旧口径(原 core/weather.ts 的 todayWeather)——
function refTodayWeather(totalPlaySec: number, major: number): WeatherDef {
  const world = worldOf(major);
  if (world.id !== "mortal") {
    const pool = WORLD_WEATHERS[world.id as Exclude<typeof world.id, "mortal">];
    const day = Math.floor(totalPlaySec / 86400);
    const rng = new RandomService(mulberry32(day * 2654435761 + world.start * 131 + 0x51ed));
    return pool[rng.int(0, pool.length - 1)]!;
  }
  const day = Math.floor(totalPlaySec / 86400);
  const rng = mulberry32(day * 2654435761 + 0x9e3779b9);
  const roll = rng();
  if (roll < 0.3) return WEATHERS[4]!;
  const idx = Math.floor(((roll - 0.3) / 0.7) * 4);
  return WEATHERS[Math.min(3, idx)]!;
}

function setProgress(totalPlaySec: number, major: number): void {
  useGameStore().totalPlaySec = totalPlaySec;
  usePlayerStore().major = major;
}

beforeEach(resetWorld);

describe("天时对账 —— 界外逐日与迁移前相同,人间界守性质", () => {
  it("人间界:同一天内任意时刻给出同一条(周期语义不变)", () => {
    /*
     * 冻结快照那一条已按文件头的理由撤掉（旧规则让四条天时永不可达）。
     * 这里守的是**迁移那条纪律真正想保住的东西**:同一个周期永远是同一个结果 ——
     * 一天之内任意时刻问,答案不能变。
     */
    for (let day = 0; day < 60; day += 1) {
      setProgress(day * 86400 + 1, 0);
      const now = todayWeather(usePlayerStore().major);
      for (const sec of [12_345, 43_200, 86_000]) {
        setProgress(day * 86400 + sec, 0);
        expect(todayWeather(usePlayerStore().major).id, `第 ${day} 天 +${sec}s`).toBe(now.id);
      }
    }
  });

  it("人间界:池里每一条都抽得到（旧规则只出得来 5 条）", () => {
    /*
     * 这一条替代了原先把旧分布冻住的那一条。它同时也是那个缺陷的回归判据 ——
     * 谁再往池子里加一条天时而忘了改权重,这里当场红。
     */
    const seen = new Set<string>();
    for (let day = 0; day < 1500; day += 1) {
      setProgress(day * 86400 + 1, 0);
      seen.add(todayWeather(usePlayerStore().major).id);
    }
    const missing = WEATHERS.filter((w) => !seen.has(w.id)).map((w) => w.name);
    expect(missing, `人间界这些天时抽不到:${missing.join(" / ")}`).toEqual([]);
  });

  it("人间界:清和仍占约三成,其余各条大致均分 —— 权重规则没被改坏", () => {
    /*
     * 修可达性时最容易顺手把权重改成"全等分",那会让清和从三成掉到 1/9 ——
     * 而"留一批无损益的平常日"是这条权重规则的**设计意图**（见 weather.ts 的
     * `CALM_WEATHER_SHARE` 注释）。这里把那个意图钉住。
     */
    const N = 3000;
    const count = new Map<string, number>();
    for (let day = 0; day < N; day += 1) {
      setProgress(day * 86400 + 1, 0);
      const id = todayWeather(usePlayerStore().major).id;
      count.set(id, (count.get(id) ?? 0) + 1);
    }
    const calm = count.get("qinghe") ?? 0;
    expect(calm / N, `清和只占 ${((calm / N) * 100).toFixed(1)}% —— 该是约三成`).toBeGreaterThan(
      0.25,
    );
    expect(calm / N, `清和占 ${((calm / N) * 100).toFixed(1)}% —— 该是约三成`).toBeLessThan(0.35);
    // 其余各条等分那七成:9 条里除清和之外 8 条,每条应约 8.75%
    for (const w of WEATHERS) {
      if (w.id === "qinghe") continue;
      const share = (count.get(w.id) ?? 0) / N;
      expect(share, `${w.name} 只占 ${(share * 100).toFixed(1)}%`).toBeGreaterThan(0.05);
      expect(share, `${w.name} 占 ${(share * 100).toFixed(1)}%`).toBeLessThan(0.13);
    }
  });

  it("界外各处:各界的专属天象池逐日相同", () => {
    // 境界序号就是它在 REALMS 里的下标 —— 用"每个界域的第一个境界"做代表
    for (let major = 0; major < REALMS.length; major += 1) {
      const world = worldOf(major);
      if (world.id === "mortal") continue;
      for (let day = 0; day < 12; day += 1) {
        setProgress(day * 86400 + 5, major);
        expect(todayWeather(usePlayerStore().major).id, `${world.name} 第 ${day} 天`).toBe(
          refTodayWeather(day * 86400 + 5, major).id,
        );
      }
    }
  });

  it("换界域会换池子(不是沿用上一个界域的天时)", () => {
    setProgress(86400 * 3, 0);
    const mortal = todayWeather(usePlayerStore().major).id;
    setProgress(86400 * 3, REALMS.length - 1); // 混沌海
    expect(todayWeather(usePlayerStore().major).id).not.toBe(mortal);
  });

  it("库里多出来的两样:剩余时间与预告(旧实现没有)", () => {
    setProgress(86400 * 2 + 3600, 0);
    expect(weatherRemainingSec()).toBe(86400 - 3600);
    const ahead = upcomingWeather(3, 0);
    expect(ahead.length).toBe(3);
    expect(ahead[0]!.id).toBe(todayWeather(usePlayerStore().major).id); // 预告的第一天就是今天
    // 预告的第二天就是"明天那一拍"的今日 —— 预告与真相用同一个周期序号,不另算
    setProgress(86400 * 3 + 3600, 0);
    expect(ahead[1]!.id, "预告的第二天与真到那天时不一致").toBe(
      todayWeather(usePlayerStore().major).id,
    );
  });
});
