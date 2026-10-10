import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { createPinia, setActivePinia } from "pinia";
import { usePlayerStore } from "@/stores/player";
import { useResourcesStore } from "@/stores/resources";
import { useEndgameStore, MAX_MARKS } from "@/stores/endgame";
import type { DaoMark } from "@/types";
import { FURNACE_RATES, DAO_SOURCE_PER_FRUIT } from "@/data/endgame";
import { gn } from "@/utils/gnum";
import {
  chooseDaoPath,
  condenseDaoFruit,
  currentDaoRules,
  endgameUnlocked,
  furnaceConvert,
  rewriteMark,
  REWRITE_ENTRY_COST,
} from "./endgameService";
import { resolveWorld, startWorldExpedition } from "./expedition";
import { attemptBreakthrough } from "./breakthrough";

/**
 * 飞升也要渡天劫(大关皆劫)。
 *
 * 这条用例验的是**跨界叙事与跨世节点**,不是渡劫平衡 —— 故把准备度钉到"该有的
 * 样子"(抗性封顶 + 三维折算满),让十二道雷真的走完。真实玩家达到同一量级靠的是
 * 功法分支(劫印/渡厄)、天赋雷体、灵兽、护腕、称号与丹药,见 tribulationDecision
 * 的 statGuardOf 与 tribulationSpace.spec 的逐境普查。
 */
vi.mock("@/core/tribulationDecision", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/core/tribulationDecision")>();
  return { ...real, currentStatGuard: () => ({ resist: 0.8, guard: 1 }) };
});

function ascend(): void {
  const player = usePlayerStore();
  // (0,0) → (9,x):每个大境界需 10 次推进(九层 + 跨境)
  for (let i = 0; i < 95; i += 1) player.advanceRealm();
}

describe("真仙终局服务", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("未至真仙不得踏天", () => {
    expect(endgameUnlocked()).toBe(false);
    expect(chooseDaoPath("sword")).toBe(false);
    // 旧线性入口 challengeWorld 已删(Phase 21 起由路线远征取代),这里改为钉现役入口的同一道闸
    expect(startWorldExpedition("chiyan", null)).toBeNull();
  });

  it("道途一生一诺,规则随身", () => {
    ascend();
    expect(chooseDaoPath("slaughter")).toBe(true);
    expect(chooseDaoPath("sword")).toBe(false); // 已定,不可另择
    const rules = currentDaoRules();
    expect(rules?.playerAtkMult).toBe(1.25);
    expect(rules?.maxRounds).toBe(35);
  });

  it("天道熔炉:闲置资源熔作道源,余数保留", () => {
    ascend();
    const resources = useResourcesStore();
    const endgame = useEndgameStore();
    resources.addSmall("ore", 130);
    const rate = FURNACE_RATES.find((r) => r.resource === "ore")!;
    const gained = furnaceConvert(rate); // 130/25 = 5 缕
    expect(gained).toBe(5);
    expect(endgame.daoSource).toBe(5);
    expect(resources.ore).toBe(5); // 余数保留
  });

  it("熔炉·灵草跨档蚀:按汇总真扣,不够则不熔", () => {
    ascend();
    const resources = useResourcesStore();
    const endgame = useEndgameStore();
    const rate = FURNACE_RATES.find((r) => r.resource === "herb")!;
    // 回归:灵草按五档存、`herb` 只读汇总 —— 旧代码按汇总计价却只扣当前境界那档,
    // 当前档 0 株、别的档堆着也能白拿道源。现在跨档真扣,不够就不熔。
    resources.grantHerbs(60, 1); // 低档 60 株,当前境界档 0
    expect(resources.herb).toBe(60);
    const gained = furnaceConvert(rate);
    expect(gained).toBe(1);
    expect(endgame.daoSource).toBe(1);
    expect(resources.herb).toBe(0); // 跨档真扣了,不是白给
    // 不足 60 则既不熔也不扣
    resources.grantHerbs(30, 1);
    expect(furnaceConvert(rate)).toBe(0);
    expect(resources.herb).toBe(30);
    expect(endgame.daoSource).toBe(1);
  });

  it("重写世界之痕:扣 10 道源真打一场,不再付了费空手而归", () => {
    ascend();
    const endgame = useEndgameStore();
    chooseDaoPath("sword");
    endgame.addDaoSource(REWRITE_ENTRY_COST * 2);
    // 世界探险之痕:targetId 是世界(非试炼)→ markTarget 给 world、无 trial。
    const mark: DaoMark = {
      life: 1,
      daoPathId: "sword",
      targetId: "chiyan",
      targetName: "赤炎天",
      cleared: true,
      rounds: 30,
      buildName: "罡盾流",
      powerText: "1万",
      at: Date.now(),
      replay: {
        mods: {},
        attack: gn(1000),
        defense: gn(600),
        maxHp: gn(20000),
        speed: 2,
        skills: [],
        artifacts: [],
        pactId: null,
      },
    };
    const before = endgame.daoSource;
    const result = rewriteMark(mark);
    // 旧代码在付完 10 道源、因 world 无 trial 提前 return null —— 又扣费又空手。
    // 如今世界痕走 world 分支真打,返回战报,且确确实实花掉入场费。
    expect(result).not.toBeNull();
    expect(endgame.daoSource).toBe(before - REWRITE_ENTRY_COST);
  });

  it("道源凝道果:走既有软上限体系", () => {
    ascend();
    const endgame = useEndgameStore();
    const player = usePlayerStore();
    endgame.addDaoSource(DAO_SOURCE_PER_FRUIT);
    expect(condenseDaoFruit()).toBe(true);
    expect(player.reincarnation.daoFruit).toBe(1);
    expect(condenseDaoFruit()).toBe(false); // 道源不足
  });

  it("入界即扣道源、开出一场入界战(结算与留痕由路线远征自己管)", () => {
    ascend();
    const endgame = useEndgameStore();
    chooseDaoPath("slaughter");
    endgame.addDaoSource(20);
    const world = resolveWorld("chiyan")!;
    const before = endgame.daoSource;
    const result = startWorldExpedition("chiyan", null);
    expect(result).not.toBeNull();
    expect(result!.row.foeName.length).toBeGreaterThan(0);
    // 入界战有胜有败:胜则 run 在途,败则当场落痕并清空 run —— 两条路都算"进过界"
    expect(endgame.worldRun?.worldId ?? endgame.marks.at(-1)?.targetId).toBe("chiyan");
    expect(endgame.daoSource).toBe(before - world.entryCost);
  });

  it("未择道途不可远征", () => {
    ascend();
    const endgame = useEndgameStore();
    endgame.addDaoSource(50);
    expect(startWorldExpedition("chiyan", null)).toBeNull();
    expect(endgame.daoSource).toBe(50); // 未扣费
  });

  /**
   * 扩界后真仙不再是大道的尽头 —— 它只是仙界的门槛。
   * 这条守住「继续攀登」与「天界常开」两件事:门槛改锚后,上面还有境界可走,
   * 而终局内容在整个仙界/神界/混沌海期间始终可用(不因境界升高而关闭)。
   */
  it("真仙之上仍可继续攀登,且天界始终开启", () => {
    const player = usePlayerStore();
    ascend(); // 至真仙(仙界门槛)
    expect(player.realm.name).toBe("真仙");
    expect(player.worldName).toBe("仙界");
    expect(endgameUnlocked()).toBe(true);

    // 从真仙沿真实突破继续推进(每大境界九层 + 跨境,共十步)
    let guard = 0;
    while (!player.atMaxRealm && guard < 500) {
      player.advanceRealm();
      guard += 1;
    }
    expect(player.atMaxRealm).toBe(true);
    expect(player.realm.name).toBe("混沌道祖");
    expect(player.worldName).toBe("混沌海");
    expect(endgameUnlocked()).toBe(true); // 越往高处走,天界只会更开,不会关
  });

  /**
   * 飞升是扩界新增的三次「换一片天」之一(另两次是入神、归返混沌)。
   * 从前真仙是唯一的「无劫门槛」(旧设计当它是飞升之赏),只按成功率判定;
   * 现在大关皆劫 —— 飞升同样要渡(见本文件顶部的 mock 说明),
   * 这条守住跨界叙事与跨世节点真的落到存档里。
   */
  it("飞升真仙:记下跨世节点 first_immortal,并给出界域叙事", () => {
    const player = usePlayerStore();
    const resources = useResourcesStore();
    const endgame = useEndgameStore();
    player.major = 8; // 渡劫圆满,下一步即飞升
    player.sub = 9;

    let view = null as ReturnType<typeof attemptBreakthrough>;
    for (let i = 0; i < 200 && !view?.success; i += 1) {
      player.exp = player.expReq;
      resources.setQi(player.qiCapValue, player.qiCapValue);
      view = attemptBreakthrough();
    }

    expect(view?.success).toBe(true);
    expect(player.major).toBe(9);
    expect(player.realm.name).toBe("真仙");
    expect(endgame.milestones.some((m) => m.id === "first_immortal")).toBe(true);
    expect(view?.message).toContain("仙界");
    // 大关进阶时附上该境出处(可解释性):真仙取道教仙阶
    expect(view?.message).toContain("道教仙阶");
  });

  describe("道痕卷宗 · 60 则封顶", () => {
    function mkMark(id: string): DaoMark {
      return {
        life: 1,
        daoPathId: null,
        targetId: id,
        targetName: `痕${id}`,
        cleared: true,
        rounds: 10,
        buildName: "心迹",
        powerText: "",
        at: 0,
      };
    }

    it("新痕从头部挤入;满 60 则后最古一痕被覆去(且 marksFull 如实报满)", () => {
      const endgame = useEndgameStore();
      expect(endgame.marksFull).toBe(false);
      for (let i = 0; i < MAX_MARKS; i += 1) endgame.addMark(mkMark(String(i)));
      expect(endgame.marks.length).toBe(MAX_MARKS);
      expect(endgame.marks[0]?.targetId).toBe("59"); // 最晚的在最前
      expect(endgame.marksFull).toBe(true);

      // 再添一则:总数不涨,最早的那则(0)被覆去
      endgame.addMark(mkMark("60"));
      expect(endgame.marks.length).toBe(MAX_MARKS);
      expect(endgame.marks[0]?.targetId).toBe("60");
      expect(endgame.marks.some((m) => m.targetId === "0")).toBe(false);
      expect(endgame.marksFull).toBe(true); // 满卷常驻(此后一直是满的)
    });
  });
});
