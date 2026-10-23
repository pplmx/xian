/* oxlint-disable no-console */
import { describe, expect, it, beforeEach, afterEach, vi } from "vite-plus/test";
import { setActivePinia, createPinia } from "pinia";
import { usePlayerStore } from "@/stores/player";
import { useResourcesStore } from "@/stores/resources";
import { useDongfuStore } from "@/stores/dongfu";
import { settleSuppressedRegions } from "./suppress";
import { toNum } from "@/utils/gnum";

/** 测量的固定时刻:兴衰倍率与设备运气都读时钟,两次测量必须钉在同一点 */
const T0 = 1_700_000_000_000;

describe("玩家反馈: 镇压后在线产出(真实场景)", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    // 全块统一假时钟:兴衰倍率与设备运气都读 Date.now(),而在用例内
    // 反复 useFakeTimers/useRealTimers 切换时,模块级缓存的时钟基准会残留,
    // 第二次测量会拿到与第一次不同的基准(实测 180 → 204),量到的差异
    // 就成了时钟的差异而不是被测行为
    vi.useFakeTimers({ now: T0 });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("真实场景: 玩家镇压多个不同层级区域, 在线产出总量", () => {
    const player = usePlayerStore();
    const resources = useResourcesStore();

    // 玩家镇压区域:tier1(青云)、tier10(剑冢)、tier20(鸿蒙)
    player.suppressedRegions = ["qingyun", "jianzhong", "hongmeng"];

    const before = { ...resources.spiritStone };
    settleSuppressedRegions(3600); // 在线 1 小时

    const gained =
      resources.spiritStone.m * Math.pow(10, resources.spiritStone.e) -
      before.m * Math.pow(10, before.e);
    console.log(`\n镇压 3 区域(不同层级)在线 1 小时:`);
    console.log(`  灵石: +${gained.toFixed(2)}`);

    const byTier = player.suppressedRegions.map((r) => [
      r,
      r === "qingyun" ? "T1" : r === "jianzhong" ? "T10" : "T20",
    ]);
    console.log(`  区域: ${JSON.stringify(byTier)}`);

    expect(gained).toBeGreaterThan(0);
  });

  it("真实场景: 镇压后在线 10 分钟的最小产出", () => {
    const player = usePlayerStore();
    const resources = useResourcesStore();
    player.suppressedRegions = ["qingyun"];

    const before = { ...resources.spiritStone };
    settleSuppressedRegions(600); // 在线 10 分钟

    const gained =
      resources.spiritStone.m * Math.pow(10, resources.spiritStone.e) -
      before.m * Math.pow(10, before.e);
    console.log(`\n镇压 1 区域在线 10 分钟: 灵石 +${gained.toFixed(2)}`);
    expect(gained).toBeGreaterThan(0);
  });

  /**
   * 这条原先只打印一行「镇压 + 灵脉 30 点在线 1 小时:灵石 +N」就结束 ——
   * 用例名问的是「灵脉投资是否影响镇压产出」,而**答案没写下来**。
   *
   * 答案分两半,查代码加实测才定下来:
   *   · 灵石:只看「区域阶位 × 时长 × 兴衰倍率」,与灵脉无关;
   *   · 修为(镇守道韵):吃 `player.cultPerSec`,而灵脉经 `finalStats` 改它
   *     —— 实测 gather 0→70 时 cultPerSec 1.495→1.859、一小时的修为 0.1196→0.1487。
   * 故本条只锁灵石那一半。修为那一半的变化是**有意为之**(灵脉本就该加快修行),
   * 一并冻住反而会挡住设计意图。
   *
   * 灵石「不受影响」是契约不是巧合:哪天有人把全局 mods 接进镇压结算,
   * 灵石就会悄悄跟着涨,而旧写法不会响。
   */
  it("灵脉投资不影响镇压产出 —— 镇压只看阶位 × 时长 × 兴衰", () => {
    type Veins = Record<string, number>;
    const BARE: Veins = {
      gather: 0,
      craft: 0,
      alchemy: 0,
      insight: 0,
      guard: 0,
      xuanhuang: 0,
      yize: 0,
    };
    const FULL: Veins = {
      gather: 70,
      craft: 30,
      alchemy: 30,
      insight: 30,
      guard: 30,
      xuanhuang: 30,
      yize: 30,
    };

    /**
     * 在**全新的一份状态、同一个时钟**上跑一小时镇压,返回灵石产出。
     *
     * 两处干扰都必须钉死,否则量到的差异不是灵脉造成的:
     * ① 状态:两次测量要各自 setActivePinia —— 在同一份状态上连跑两段,
     *    第二段会继承第一段写下的 regionStats,兴衰倍率随之改变
     * ② 时钟:兴衰的 `lastActivityAt` 与设备运气都读 `Date.now()`,
     *    两次调用相隔几毫秒就够让档位跨边。故整块用假时钟钉在同一时刻。
     */
    function stoneForOneHour(veins: Veins): number {
      setActivePinia(createPinia());
      const p = usePlayerStore();
      const dongfu = useDongfuStore();
      p.suppressedRegions = ["qingyun"];
      // 镇压起点也钉住:设备运气与兴衰时长都读它
      p.suppressedSince = { qingyun: T0 } as typeof p.suppressedSince;
      dongfu.veinPoints = { ...veins } as typeof dongfu.veinPoints;

      /**
       * 读数取**结算回执** `total.stone`,不用「前后余额差」。
       *
       * 余额差会受初始余额的精度状态影响:GNum 是 m×10^e 的浮点对,
       * 新开一份状态时余额是 0,一次入账后差值与回执一致;但若这份状态被
       * 前面的用例动过(或首次入账的 e 档不同),同一笔 180 会读成 204。
       * 实测:回执恒 180,余额差在 180/204 之间跳,且与 gather 无关 ——
       * 那种抖动一旦进了断言,用例会变成随机红。回执是结算自己记的账,与余额精度无关。
       */
      const out = settleSuppressedRegions(3600);
      return out ? toNum(out.stone) : 0;
    }

    const bare = stoneForOneHour(BARE);
    const withVeins = stoneForOneHour(FULL);

    console.log(`\n镇压青云山麓 1 小时:裸投 ${bare.toFixed(2)} · 灵脉投满 ${withVeins.toFixed(2)}`);
    expect(bare, "产出不该为 0 —— 否则下面那条相等断言是在比两个零").toBeGreaterThan(0);
    expect(withVeins, "灵脉不该改动镇压产出 —— 它只管修行侧的四条脉").toBeCloseTo(bare, 6);
  });
});
