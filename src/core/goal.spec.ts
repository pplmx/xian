/**
 * 修行目标(Phase 29)接线契约 —— goal.ts 此前从未被展示,先把纯函数行为钉死。
 */
import { describe, it, expect, beforeEach, vi } from "vite-plus/test";
import { setActivePinia, createPinia } from "pinia";
import { usePlayerStore } from "@/stores/player";
import { useAdventureStore } from "@/stores/adventure";
import { useResourcesStore } from "@/stores/resources";
import { useInventoryStore } from "@/stores/inventory";
import { gn, toNum, gnZero } from "@/utils/gnum";
import { generateCurrentGoal } from "./goal";
import { MAX_MAJOR, realmLabel, WORLD_BREAK_MAJOR } from "@/data/realms";
import { useEndgameStore } from "@/stores/endgame";
import { REGIONS } from "@/data/regions";
import { CELESTIAL_WORLDS } from "@/data/endgame";
import { SUB_LEVELS } from "@/data/constants";
import { expRequirement } from "./formulas";

const { setBuild } = vi.hoisted(() => ({ setBuild: { value: null as unknown } }));
vi.mock("./buildDetect", () => ({ detectBuild: () => setBuild.value }));

describe("修行目标(Phase 29)", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    setBuild.value = null;
  });

  it("死后无目标", () => {
    const player = usePlayerStore();
    player.initCharacter("目标", { roots: [] } as never);
    player.markDead();
    expect(generateCurrentGoal(player)).toBeNull();
  });

  it("修为 85% 以上 → 突破目标,给 hint", () => {
    const player = usePlayerStore();
    player.initCharacter("目标", { roots: [] } as never);
    player.exp = gn(Math.floor(toNum(player.expReq) * 0.9));
    const goal = generateCurrentGoal(player)!;
    expect(goal.type).toBe("breakthrough");
    expect(goal.text).toContain("突破");
    expect(goal.hint).toBeTruthy();
    expect(goal.destination).toEqual({ to: "/cultivation", label: "去修炼" });
  });

  it("修为 50%~85% → 突破目标,无 hint(未临近,不给多余建议)", () => {
    const player = usePlayerStore();
    player.initCharacter("目标", { roots: [] } as never);
    player.exp = gn(Math.floor(toNum(player.expReq) * 0.6));
    const goal = generateCurrentGoal(player)!;
    expect(goal.type).toBe("breakthrough");
    expect(goal.hint).toBeUndefined();
    expect(goal.destination).toEqual({ to: "/cultivation", label: "去修炼" });
  });

  it("无临近突破且已有 Build → build 目标,进度按这一路的核心词条数算", () => {
    const player = usePlayerStore();
    player.initCharacter("目标", { roots: [] } as never);
    setBuild.value = {
      style: { name: "天龙" },
      coreValues: [{ key: "critChance" }, { key: "critDamage" }],
      coreTotal: 4,
    };
    const goal = generateCurrentGoal(player)!;
    expect(goal.type).toBe("build");
    expect(goal.text).toContain("天龙");
    expect(goal.progress).toBe(0.5);
    expect(goal.hint, "分母要跟着这一路的核心词条数说").toContain("2/4");
    expect(goal.destination).toEqual({ to: "/build", label: "去构筑" });
  });

  /**
   * 回归:首页道途卡曾写死「已凑出 N/4 个核心词条」,而流派核心词条只有 2~3 条 ——
   * 背水流凑齐两条也只报 2/4,进度条永远走不到头。分母必须来自 detectBuild。
   */
  it("核心词条少的流派也能走到 100%:分母取该流派自己的词条数", () => {
    const player = usePlayerStore();
    player.initCharacter("目标", { roots: [] } as never);
    setBuild.value = {
      style: { name: "背水流" },
      coreValues: [{ key: "lowHpDamage" }, { key: "lowHpReduction" }],
      coreTotal: 2,
    };
    const goal = generateCurrentGoal(player)!;
    expect(goal.hint).toContain("2/2");
    expect(goal.progress, "凑齐这一路的全部核心词条就是 100%").toBe(1);
  });

  it("近突破优先于 build(breakthrough 检查在最前)", () => {
    const player = usePlayerStore();
    player.initCharacter("目标", { roots: [] } as never);
    setBuild.value = { style: { name: "玄武" }, coreValues: [{ key: "x" }], coreTotal: 1 };
    player.exp = gn(Math.floor(toNum(player.expReq) * 0.95));
    const goal = generateCurrentGoal(player)!;
    expect(goal.type).toBe("breakthrough");
  });

  it("无临近突破、无 build → explore 目标(未涉足且可入的地界)", () => {
    const player = usePlayerStore();
    player.initCharacter("目标", { roots: [] } as never);
    player.exp = gnZero();
    // 默认 unlocked=['qingyun']、cleared=[] → 还有可深入的地界
    const goal = generateCurrentGoal(player)!;
    expect(goal.type).toBe("explore");
    expect(goal.text).toContain("深入");
    expect(goal.destination).toEqual({ to: "/adventure", label: "去历练" });
  });

  it("复聚的旧地界不占「深入」的位置(它按表序排在前面,不许把前沿顶掉)", () => {
    const player = usePlayerStore();
    player.initCharacter("目标", { roots: [] } as never);
    player.exp = gnZero();
    const adventure = useAdventureStore();
    adventure.unlocked = ["qingyun", "luoxia", "heifeng"];
    adventure.cleared = ["qingyun"];
    // 落霞谷「妖气复聚」(旧主归来),而黑风林才是真正的未涉足之地
    adventure.revived = ["luoxia"];
    const goal = generateCurrentGoal(player)!;
    expect(goal.type).toBe("explore");
    expect(goal.text).toContain("黑风林");
    expect(goal.text).not.toContain("落霞谷");
  });

  it("已遍历的图清净空、库存与装备皆足 → 真兜底返回 null(不硬塞建议)", () => {
    const player = usePlayerStore();
    player.initCharacter("目标", { roots: [] } as never);
    player.exp = gnZero();
    // 把所有已解锁地界都通关,历练目标消失
    useAdventureStore().cleared = [...useAdventureStore().unlocked];
    // 材料/装备也都不缺 → 没有可挤的建议就闭嘴
    useResourcesStore().grantHerbs(12);
    for (const slot of [
      "weapon",
      "head",
      "body",
      "wrist",
      "belt",
      "boots",
      "necklace",
      "ring",
      "talisman",
    ] as const) {
      useInventoryStore().equip(`u-${slot}`, slot);
    }
    expect(generateCurrentGoal(player)).toBeNull();
  });

  it("通关过地界但灵草见底(herb<10) → material 目标,指向最高层级已通关地界", () => {
    const player = usePlayerStore();
    player.initCharacter("目标", { roots: [] } as never);
    player.exp = gnZero();
    const adventure = useAdventureStore();
    adventure.unlocked = ["qingyun", "luoxia"];
    adventure.cleared = ["qingyun", "luoxia"]; // 无未通关地界 → explore 不触发
    useResourcesStore().grantHerbs(3);
    const goal = generateCurrentGoal(player)!;
    expect(goal.type).toBe("material");
    expect(goal.text).toContain("采");
    expect(goal.text).toContain("落霞谷"); // tier 2 > tier 1,指最高的
    expect(goal.progress).toBe(0.3);
    expect(goal.hint).toBeTruthy();
    expect(goal.destination).toEqual({ to: "/adventure", label: "去历练" });
  });

  it("灵草充足(herb>=10) → material 不触发", () => {
    const player = usePlayerStore();
    player.initCharacter("目标", { roots: [] } as never);
    player.exp = gnZero();
    const adventure = useAdventureStore();
    adventure.unlocked = ["qingyun"];
    adventure.cleared = ["qingyun"];
    for (const slot of [
      "weapon",
      "head",
      "body",
      "wrist",
      "belt",
      "boots",
      "necklace",
      "ring",
      "talisman",
    ] as const) {
      useInventoryStore().equip(`u-${slot}`, slot);
    }
    useResourcesStore().grantHerbs(12);
    expect(generateCurrentGoal(player)).toBeNull();
  });

  it("通关过地界、灵草足、装备槽有空位 → equipment 目标,指向第一个空槽且带进度", () => {
    const player = usePlayerStore();
    player.initCharacter("目标", { roots: [] } as never);
    player.exp = gnZero();
    const adventure = useAdventureStore();
    adventure.unlocked = ["qingyun"];
    adventure.cleared = ["qingyun"];
    // weapon、head 已填 → 优先级里第一个空槽是 body(衣袍)
    useInventoryStore().equip("u-weapon", "weapon");
    useInventoryStore().equip("u-head", "head");
    useResourcesStore().grantHerbs(12);
    const goal = generateCurrentGoal(player)!;
    expect(goal.type).toBe("equipment");
    expect(goal.text).toContain("寻一件");
    expect(goal.text).toContain("衣袍");
    expect(goal.progress).toBeCloseTo(2 / 9);
    expect(goal.hint).toBeTruthy();
    expect(goal.destination).toEqual({ to: "/inventory?tab=equip", label: "去行囊" });
  });

  it("从未通关过地界(cleared 为空) → 即便灵草与装备皆缺也不硬塞(宁缺毋滥)", () => {
    const player = usePlayerStore();
    player.initCharacter("目标", { roots: [] } as never);
    player.exp = gnZero();
    const adventure = useAdventureStore();
    adventure.unlocked = [];
    adventure.cleared = [];
    useResourcesStore().spendHerbs(1, useResourcesStore().herbOf(1)); // 灵草见底
    expect(generateCurrentGoal(player)).toBeNull();
  });
});

/*
 * 到顶之后不该再有「突破」目标。
 *
 * 原先 `Math.min(sub + 1, SUB_LEVELS - 1)` 把「下一层」钳成**当前这一层**:
 * 末境圆满的玩家看到「尝试突破「混沌道祖·圆满」」—— 让他去突破一个自己正待着的
 * 境界。而末境攒满修为是常态(越到后面越容易满),所以这不是罕见边界,
 * 是终局玩家每天都会看到的那一句。
 */
describe("修行目标 · 已至大道尽头", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    setBuild.value = null;
  });

  it("末境圆满 + 修为已满:不再给突破目标,也不报当前这一境为「下一境」", async () => {
    const player = usePlayerStore();
    player.major = MAX_MAJOR;
    player.sub = SUB_LEVELS - 1;
    player.exp = expRequirement(MAX_MAJOR, SUB_LEVELS - 1);
    expect(player.atMaxRealm, "前提:确实到顶了").toBe(true);

    const goal = generateCurrentGoal(player as never);
    expect(goal, "到顶仍要有目标 —— 只是不该是突破").not.toBeNull();
    expect(goal?.type, "到顶之后还给突破目标").not.toBe("breakthrough");
    expect(goal?.text ?? "", "不该让玩家去突破自己正待着的境界").not.toContain(
      realmLabel(MAX_MAJOR, SUB_LEVELS - 1),
    );
  });

  it("末境倒数第二层:突破目标照常,指向「圆满」", () => {
    const player = usePlayerStore();
    player.major = MAX_MAJOR;
    player.sub = SUB_LEVELS - 2;
    player.exp = expRequirement(MAX_MAJOR, SUB_LEVELS - 2);
    const goal = generateCurrentGoal(player as never);
    expect(goal?.type, "还没到顶,该照常给突破").toBe("breakthrough");
    expect(goal?.text).toContain(realmLabel(MAX_MAJOR, SUB_LEVELS - 1));
  });
});

/**
 * 终局三支 —— 六支全不命中时，界面不该对玩家说「你没有下一步」。
 *
 * ## 由来（第 428 轮）
 *
 * `generateCurrentGoal` 有六支：突破 / 构筑 / 推地界 / 采料 / 补装备。
 * 而一位走到真仙以上、地界推完、装备齐、材料足的玩家**六支全不命中**，
 * 返回 `null` —— 首页那张卡 `v-else-if="currentGoal"` 整块不渲染。
 *
 * 实测复现过：
 *
 * ```text
 *   adv.cleared = 全部区域 · herb 充足 · 九个装备槽全填 · major 12
 *   → 目标: null（首页那张卡整块不显示）
 * ```
 *
 * 而那个阶段的人**确实有下一步**，还是这一作最重的几样：道途、远征、
 * 每日天道、秘境。只是它们都挂在真仙之后，而 `goal` 此前一条都不认识。
 *
 * ## 判据
 *
 * ① 六支全不命中、境界在真仙以上时，`generateCurrentGoal` 不许返回 null；
 * ② 三支的先后是「道途 → 有可打的远征 → 泛指」—— 顺序有据（没有道途，远征开不了）；
 * ③ 道源那句读的是 `entryCost`，不另算一笔（与远征页同源）；
 * ④ 反差：真仙**以下**的同类状态仍然返回 null —— 那时「没有下一步」是真话。
 */
describe("终局目标 · 六支全空时仍有下一步", () => {
  /** 把玩家摆到「六支全不命中」的状态 */
  function saturate(): void {
    const adv = useAdventureStore();
    const res = useResourcesStore();
    const inv = useInventoryStore() as unknown as { equipped: Record<string, string | null> };
    adv.unlocked = REGIONS.map((r) => r.id);
    adv.cleared = REGIONS.map((r) => r.id);
    res.addSmall("herb", 99999);
    /*
     * 九个装备槽全填 —— 槽位名取自 `goal.ts` 的 GEAR_SLOTS（它是私有的，
     * 故这里按同一份清单写）。若哪天槽位增减，这条会因「装备槽有空位」而红，
     * 提醒回来对一遍。
     */
    for (const s of [
      "weapon",
      "head",
      "body",
      "wrist",
      "belt",
      "boots",
      "necklace",
      "ring",
      "talisman",
    ]) {
      inv.equipped[s] = "fake-uid";
    }
  }

  it("真仙以上、六支全空 → 不返回 null，且先指道途", () => {
    setActivePinia(createPinia());
    const player = usePlayerStore();
    saturate();
    player.major = WORLD_BREAK_MAJOR + 3;
    player.sub = 9;
    const goal = generateCurrentGoal(player, { daoPath: null, daoSource: 0 });
    expect(
      goal,
      "六支全空时返回了 null —— 首页那张卡整块不显示，界面对终局玩家说的唯一一句话是「你没有下一步」",
    ).not.toBeNull();
    expect(goal!.type, "没有道途时该先指道途 —— 没有它，远征与每日天道都开不了").toBe("path");
    expect(goal!.destination?.to, "道途那一步在天界页").toBe("/celestial");
  });

  it("有道途但道源不够 → 指天道与秘境，而不是 null", () => {
    setActivePinia(createPinia());
    const player = usePlayerStore();
    const endgame = useEndgameStore();
    saturate();
    player.major = WORLD_BREAK_MAJOR + 3;
    player.sub = 9;
    endgame.chooseDao("sword");
    const goal = generateCurrentGoal(player, { daoPath: "sword", daoSource: 0 });
    expect(goal, "有道途、道源不足时返回了 null").not.toBeNull();
    expect(goal!.type, "道源不够时不该指远征 —— 那一步会被守卫拦下").toBe("endgame");
  });

  it("道源够 → 报门槛，不报一个假选择", () => {
    setActivePinia(createPinia());
    const player = usePlayerStore();
    const endgame = useEndgameStore();
    saturate();
    player.major = WORLD_BREAK_MAJOR + 3;
    player.sub = 9;
    endgame.chooseDao("sword");
    endgame.addDaoSource(1000);
    const goal = generateCurrentGoal(player, { daoPath: "sword", daoSource: 1000 });
    expect(goal!.type, "道源充足时该指远征").toBe("expedition");
    /*
     * ## 为什么这里断言的是「门槛」而不是「几个界」
     *
     * 初版那句话是 `${affordable} 界已备道源`。而实测五个世界的 `entryCost`
     * **全都是 20** —— N 只可能是 0 或 5，中间那 1~4 永远不会出现。
     * 一句「5 界已备」其实在说「你有 20 道源」，读起来却像「五选五」。
     *
     * 故改成报门槛。判据也跟着钉门槛：那个数必须等于 entryCost 的最小值，
     * 且**从数据取**（不写死 20）。
     */
    const cheapest = Math.min(...CELESTIAL_WORLDS.map((w) => w.entryCost));
    expect(goal!.text, `该报门槛「每界 ${cheapest} 起」`).toContain(`每界 ${cheapest} 起`);
    /*
     * 反差：不许再出现「N 界已备」—— 那个数是假的（只会是 0 或 5）。
     */
    expect(goal!.text, "又写回了「N 界已备」—— 五个界的代价相同时，那个数是假选择").not.toMatch(
      /\d+ 界已备/,
    );
  });

  it("反差：真仙以下的同类状态，仍然返回 null —— 那时「没有下一步」是真话", () => {
    /*
     * 这一族的老习惯：新增的分支在它的前提不成立时不该改变输出。
     * 一个元婴期、地界推完、装备齐、材料足的玩家，确实没有「终局」那几样东西。
     */
    setActivePinia(createPinia());
    const player = usePlayerStore();
    saturate();
    player.major = WORLD_BREAK_MAJOR - 5;
    player.sub = 9;
    expect(
      generateCurrentGoal(player, { daoPath: "sword", daoSource: 1000 }),
      "境界还没到真仙，却给出了终局目标 —— 那几样此时根本不存在",
    ).toBeNull();
  });
});
