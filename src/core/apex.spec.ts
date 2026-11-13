/**
 * 终局读数与去处的契约。
 *
 * 这一份守的是「终局不是一堆没有了」:到顶之后仍要说得清**走到了哪里**、
 * **还能做什么**。此前整个仓库只有 `atMaxRealm` 那几处改口在用它 ——
 * 玩家修到大道尽头,界面除了境界数字变了,没有任何一处告诉他这一刻是什么。
 */
import { describe, expect, it } from "vite-plus/test";
import { MAX_MAJOR, realmDef, realmLabel } from "@/data/realms";
import { SUB_LEVELS } from "@/data/constants";
import { DAO_PATHS, TRIALS } from "@/data/endgame";
import { TRIAL_TOTAL, apexPursuits, apexRecord } from "./apex";
import { APEX_MILESTONE, MILESTONE_DEFS, MILESTONE_TOTAL } from "./identity";
import { readSource } from "@/test/readSource";

describe("终局 · 到顶的判据只有一处", () => {
  it("到顶的判据只在 player store 一处 —— apex 不另立第二个", () => {
    /*
     * 判据本身只许有一份。接进来时 `core/apex` 里那个 `isApex` 没有任何调用方
     * (deadExportAudit 当场报红),说明真正的判据一直就在 store 上;
     * 两处各写一遍只会在边界上分叉。
     */
    const store = readSource("src/stores/player.ts");
    expect(store, "player 的判据").toContain(
      "major.value >= MAX_MAJOR && sub.value >= SUB_LEVELS - 1",
    );
    const apex = readSource("src/core/apex.ts");
    expect(apex, "apex 不该再立第二个到顶判据").not.toMatch(/function isApex/);
  });
});

describe("终局 · 终点读数只取既有来源", () => {
  it("境界名走 realmLabel,与界面别处读同一份", () => {
    const rec = apexRecord({
      major: MAX_MAJOR,
      sub: SUB_LEVELS - 1,
      life: 3,
      marks: 7,
      milestonesDone: 4,
    });
    expect(rec.realmLabel).toBe(realmLabel(MAX_MAJOR, SUB_LEVELS - 1));
    expect(rec.realmLabel).toContain(realmDef(MAX_MAJOR).name);
    expect(rec.life).toBe(3);
  });

  it("跨界数读境界表,不写死界域个数", () => {
    const at = (major: number) =>
      apexRecord({ major, sub: 0, life: 1, marks: 0, milestonesDone: 0 }).worldsCrossed;
    // 起点在人间界:只有一界
    expect(at(0)).toBe(1);
    // 走到末境:四界全过
    expect(at(MAX_MAJOR)).toBe(4);
    // 单调不减 —— 走得越远,跨过的界只多不少
    for (let m = 1; m <= MAX_MAJOR; m += 1) expect(at(m)).toBeGreaterThanOrEqual(at(m - 1));
  });

  it("里程碑总数把「大道尽头」那一枚算进去", () => {
    const rec = apexRecord({
      major: MAX_MAJOR,
      sub: SUB_LEVELS - 1,
      life: 1,
      marks: 0,
      milestonesDone: 0,
    });
    expect(rec.milestones.total, "总数要含终局那一枚").toBe(MILESTONE_TOTAL);
    expect(MILESTONE_TOTAL).toBe(MILESTONE_DEFS.length + 1);
  });

  it("画像是否成形由道痕数决定,阈值取 PROFILE_MIN_MARKS", () => {
    const mk = (marks: number) =>
      apexRecord({ major: MAX_MAJOR, sub: 0, life: 1, marks, milestonesDone: 0 }).profileFormed;
    expect(mk(0)).toBe(false);
    expect(mk(4)).toBe(false);
    expect(mk(5)).toBe(true);
  });
});

describe("终局 · 到顶这一刻留一枚印记", () => {
  it("里程碑里有「大道尽头」这一枚,文案报的是末境圆满", () => {
    expect(APEX_MILESTONE.id).toBeTruthy();
    expect(APEX_MILESTONE.name).toBe("大道尽头");
    expect(APEX_MILESTONE.desc).toContain(`${realmDef(MAX_MAJOR).name}·圆满`);
    // 此前 MILESTONE_DEFS 里没有它 —— 一世修到终点,没留下任何记录
    expect(
      MILESTONE_DEFS.some((m) => m.id === APEX_MILESTONE.id),
      "既然此刻才记,就不该再同时写进静态表(会撞 id)",
    ).toBe(false);
  });
});

describe("终局 · 还能做什么", () => {
  const base = {
    daoChosen: null as string | null,
    clearedTrials: 0,
    trialTotal: TRIALS.length,
    soulsEquipped: 0,
    marks: 0,
    canRebirth: true,
  };

  it("一份清单都报得出「去了做什么」—— 不许只有名字", () => {
    const rows = apexPursuits(base);
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) {
      expect(r.hint.length, `${r.name} 只有名字,没说去做什么`).toBeGreaterThan(6);
      expect(r.route.startsWith("/"), `${r.name} 没有去处`).toBe(true);
    }
  });

  it("待办在前、已做完在后", () => {
    const rows = apexPursuits({ ...base, daoChosen: null, marks: 20 });
    const firstDone = rows.findIndex((r) => !r.pending);
    const lastPending = rows.map((r) => r.pending).lastIndexOf(true);
    if (firstDone >= 0 && lastPending >= 0) expect(lastPending).toBeLessThan(firstDone);
  });

  it("道途未择时是待办;择过之后沉为「已定」", () => {
    const pending = apexPursuits({ ...base, daoChosen: null }).find((r) => r.id === "dao")!;
    expect(pending.pending).toBe(true);
    expect(pending.progress).toBe(`${DAO_PATHS.length} 道待择`);

    const chosen = apexPursuits({ ...base, daoChosen: "sword" }).find((r) => r.id === "dao")!;
    expect(chosen.pending).toBe(false);
    expect(chosen.progress).toBe("已定");
  });

  it("转世排在最后 —— 它是「这一世结束」,不是「还能做什么」", () => {
    const rows = apexPursuits(base);
    const rebirth = rows.find((r) => r.id === "rebirth");
    expect(rebirth, "能转世时该给一条").toBeTruthy();
    /*
     * 不抢视觉中心:用户拍板「转世只是一个选项,和天界/器魂并列」。
     * 它必须够到,但不该排在第一。
     */
    expect(rows[0]!.id).not.toBe("rebirth");
  });

  it("不能转世时不给这一条", () => {
    const rows = apexPursuits({ ...base, canRebirth: false });
    expect(rows.some((r) => r.id === "rebirth")).toBe(false);
  });

  it("试炼总数与 TRIALS 同源,界面不另写 8", () => {
    expect(TRIAL_TOTAL).toBe(TRIALS.length);
    const rows = apexPursuits({ ...base, clearedTrials: TRIALS.length });
    const trial = rows.find((r) => r.id === "trial")!;
    expect(trial.progress).toBe(`${TRIALS.length}/${TRIALS.length} 门`);
    expect(trial.pending, "全通了就不再是待办").toBe(false);
  });
});

describe("终局 · 不与既有账本撞车", () => {
  it("apex 不新起一份持久化状态 —— 它只是取景", () => {
    const apex = readSource("src/core/apex.ts");
    // 出现 defineStore / ref( 就是又开了一本账
    expect(apex).not.toContain("defineStore");
    expect(apex).not.toMatch(/^\s*const \w+ = ref\(/m);
  });
});
