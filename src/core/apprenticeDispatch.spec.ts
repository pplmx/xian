/**
 * 「各尽其长」一键派发 —— 确定性按库存水位派到最缺的门,或各自专职。
 *
 * 判据 = 回归守卫:调度案只读快照、无随机;缺的那门必然中选,并列退回专职。
 */
import { describe, expect, it } from "vite-plus/test";
import {
  apprenticeDispatchPlan,
  dispatchAllToNeed,
  type DispatchNeedStock,
} from "./apprenticeService";
import { DISPATCH_NEED_TARGET } from "@/data/apprentices";

const empty: DispatchNeedStock = { herb: 0, ore: 0, wudao: 0, dust: 0 };

describe("各尽其长 · 一键派发", () => {
  it("调度案把四门存量、水位与真实分数摊开,唯一最高者就是派发目标", () => {
    const stock: DispatchNeedStock = { herb: 29, ore: 0, wudao: 100, dust: 100 };
    const plan = apprenticeDispatchPlan(stock);

    expect(plan.target).toBe("ore");
    expect(plan.topScore).toBe(20);
    expect(plan.tiedSpecs).toEqual([]);
    expect(plan.rows).toEqual([
      { spec: "herb", resource: "herb", stock: 29, waterline: 30, score: 1 },
      { spec: "ore", resource: "ore", stock: 0, waterline: 20, score: 20 },
      { spec: "study", resource: "wudao", stock: 100, waterline: 10, score: 10 / 101 },
      { spec: "adventure", resource: null, stock: 0, waterline: 0, score: 2 },
    ]);
  });

  it("并列最高时调度案不编造目标,并把同分门逐一报出", () => {
    const tie: DispatchNeedStock = { herb: 14, ore: 9, wudao: 100, dust: 100 };
    const plan = apprenticeDispatchPlan(tie);

    expect(plan.target).toBeNull();
    expect(plan.topScore).toBe(2);
    expect(plan.tiedSpecs).toEqual(["herb", "ore", "adventure"]);
    expect(plan.rows.filter((row) => row.score === plan.topScore).map((row) => row.spec)).toEqual([
      "herb",
      "ore",
      "adventure",
    ]);
  });

  it("器尘满时历练仍保留灵石兜底分,且明确报出这根底不是器尘", () => {
    const stock: DispatchNeedStock = { herb: 100, ore: 100, wudao: 100, dust: 100 };
    const plan = apprenticeDispatchPlan(stock);
    const adventure = plan.rows.find((row) => row.spec === "adventure");

    expect(plan.target).toBe("adventure");
    expect(adventure).toEqual({
      spec: "adventure",
      resource: null,
      stock: 0,
      waterline: 0,
      score: 2,
    });
  });

  it("全空库存:最缺的门是目标水位最高的那一个(score 最高者胜出)", () => {
    // herb 目标水位 30 最高 → score 30/1 独占第一,必然派 herb
    expect(apprenticeDispatchPlan(empty).target).toBe("herb");
  });

  it("水位越高、现存量越低,score 越高;缺料门压过已满的门", () => {
    // ore 水位 20 / 存量 0 → 20;herb 水位 30 / 存量 29 → ~1.0;study 水位 10 / 存量 0 → 10
    const stock: DispatchNeedStock = { herb: 29, ore: 0, wudao: 0, dust: 100 };
    expect(apprenticeDispatchPlan(stock).target).toBe("ore");
  });

  it("历练(adventure)取器尘短缺与灵石兜底分之较高者", () => {
    // dust 水位 10 / 存量 0 → score 10;其余资源满。历练 = max(10, FIXED(2)) = 10 → 独占胜出
    const stock: DispatchNeedStock = { herb: 100, ore: 100, wudao: 100, dust: 0 };
    expect(apprenticeDispatchPlan(stock).target).toBe("adventure");
  });

  it("任意两门并列最高 → 无单门胜出,退回各自专职(talent)", () => {
    // herb 存量 9/30 → score 3;ore 存量 4/20 → score 4;study 存量 3/10 → score 2.5
    // 让 ore 与某一门并列:herb 存量 → score 2 需 herb=14;ore 存量 9 → score 2
    const tie: DispatchNeedStock = { herb: 14, ore: 9, wudao: 100, dust: 100 };
    expect(apprenticeDispatchPlan(tie).target).toBeNull();
    const idle = [
      { uid: "a", talent: "herb" as const },
      { uid: "b", talent: "ore" as const },
    ];
    expect(dispatchAllToNeed(idle, tie)).toEqual([
      { uid: "a", spec: "herb" },
      { uid: "b", spec: "ore" },
    ]);
  });

  it("有单门胜出时,全部闲置弟子都派到那一门", () => {
    const idle = [
      { uid: "a", talent: "study" as const },
      { uid: "b", talent: "seek" as const },
    ];
    expect(dispatchAllToNeed(idle, empty)).toEqual([
      { uid: "a", spec: "herb" },
      { uid: "b", spec: "herb" },
    ]);
  });

  it("没有闲置弟子则空派", () => {
    expect(dispatchAllToNeed([], empty)).toEqual([]);
  });

  it("确定性:同一快照两次调用结果逐位一致", () => {
    const stock: DispatchNeedStock = { herb: 5, ore: 3, wudao: 20, dust: 1 };
    const idle = [
      { uid: "a", talent: "herb" as const },
      { uid: "b", talent: "ore" as const },
      { uid: "c", talent: "study" as const },
    ];
    expect(dispatchAllToNeed(idle, stock)).toEqual(dispatchAllToNeed(idle, stock));
  });

  it("目标水位表非退化:四个水位都为正", () => {
    for (const v of Object.values(DISPATCH_NEED_TARGET)) expect(v).toBeGreaterThan(0);
  });
});
