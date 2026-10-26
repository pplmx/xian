/* oxlint-disable no-console -- 模拟器体检报告的正式输出(bun run test:report 依赖) */
import { describe, expect, it } from "vite-plus/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fullEconomyAudit, qiFillSeconds } from "./economySim";
import { BT_QI_COST_RATIO } from "@/data/constants";
import { MAX_MAJOR, worldOf } from "@/data/realms";
import { maxTierForMajor } from "@/data/regions";
import { layerSeconds } from "./pillValue";
import { libraryWudaoPerHour } from "@/data/buildings";
import { REGIONS } from "@/data/regions";
import { createPinia, setActivePinia } from "pinia";
import { RandomService, mulberry32 } from "@/utils/random";
import { pickEventFor } from "./eventEngine";
import { reachableEventWudao } from "./economySim";
import { usePlayerStore } from "@/stores/player";

/**
 * 审计的判据分两段,理由写在 economySim 的文件头:
 *
 * - **人间界(0~8)**:模型在此校准(建筑还在长、掉落按人间界层级),健康不变量按原样守 ——
 *   灵石不窒息也不失意义、灵草买得起丹、器灵尘自给、无死资源。
 * - **界外十二境(9~20)**:出口是**天道熔炉**(材料/灵石 → 道源 → 道果),现已入模型(ISS-210 结清)。
 *   这一段守「结构」:每样材料都有非零出口、道源流存在且只在界外、层级跟随区域表、修为比值不漂移;
 *   并把「材料换道源的速率远超终局节奏」这条**已知失衡**当成断言钉住(ISS-214)——
 *   它是一处真实的定价问题,不是读数噪声,故不假装健康、也不藏起来。
 */
describe("经济闭环审计(Phase 19 · Phase 40 补界外与修为)", () => {
  const eras = fullEconomyAudit();
  const mortal = eras.filter((e) => worldOf(e.major).id === "mortal");
  const outer = eras.filter((e) => worldOf(e.major).id !== "mortal");

  it("输出全时期流水表:0~20 境,含修为", () => {
    console.log("\n—— 资源生产/消耗审计(每小时,按时期摊销) ——");
    for (const era of eras) {
      const cells = era.flows
        .map(
          (f) => `${f.resource}:${f.verdict}(${f.ratio === Infinity ? "∞" : f.ratio.toFixed(1)})`,
        )
        .join(" ");
      console.log(
        `  第${era.major}境(${worldOf(era.major).name}·t${era.tier}, ${era.eraHours.toFixed(1)}h): ${cells}`,
      );
    }
    expect(eras.length).toBe(MAX_MAJOR + 1);
    expect(mortal.length, "人间界应有 0~8 共九境").toBe(9);
    expect(outer.length, "界外应有 9~20 共十二境").toBe(12);
    for (const era of eras) {
      expect(era.flows.length, `第${era.major}境缺流`).toBe(era.major >= 9 ? 8 : 7);
    }
    // 道源流只在界外出现 —— 人间界还没有熔炉可开
    for (const era of mortal) expect(era.flows.some((f) => f.resource === "daoSource")).toBe(false);
    for (const era of outer) expect(era.flows.some((f) => f.resource === "daoSource")).toBe(true);
  });

  it("修为是一条流,且收支比不随境界漂移(Phase 39 修出的性质)", () => {
    const ratios = eras.map((era) => {
      const exp = era.flows.find((f) => f.resource === "exp");
      expect(exp, `第${era.major}境没有修为流`).toBeDefined();
      return exp!.ratio;
    });
    for (const [i, ratio] of ratios.entries()) {
      // 收入 = 挂机(底)+ 历练(两条线都随修速缩放),消耗 = 通关本境的修为需求。
      // 两侧同尺,故「历练在任何境界都是同一个倍率」——
      // 反过来说:这个数一旦随境界漂移,就是有一侧又按境界另算了一遍(ISS-208 的旧病)。
      expect(ratio, `第${i}境修为收支比`).toBeGreaterThan(1);
      expect(ratio, `第${i}境修为收支比`).toBeLessThan(10);
    }
    expect(Math.max(...ratios) - Math.min(...ratios), "修为收支比随境界漂移了").toBeLessThan(0.01);
  });

  it("区域层级取自区域表:界外十二境是 21~32,不再压死在 20", () => {
    for (const era of eras) {
      expect(era.tier, `第${era.major}境的层级`).toBe(maxTierForMajor(era.major));
    }
    expect(eras[0]!.tier).toBe(2);
    expect(eras.at(-1)!.tier, "混沌道祖的层级应是区域表上限").toBe(32);
  });

  it("界外十二境:每一格的读数都有定义(收入与消耗非负且有限)", () => {
    for (const era of outer) {
      for (const f of era.flows) {
        expect(Number.isFinite(f.incomePerHour), `第${era.major}境 ${f.resource} 收入`).toBe(true);
        expect(Number.isFinite(f.sinkPerHour), `第${era.major}境 ${f.resource} 消耗`).toBe(true);
        expect(f.incomePerHour, `第${era.major}境 ${f.resource} 收入`).toBeGreaterThanOrEqual(0);
        expect(f.sinkPerHour, `第${era.major}境 ${f.resource} 消耗`).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("人间界无死资源:每种资源在每个时期都有非零消耗去向", () => {
    for (const era of mortal) {
      for (const f of era.flows) {
        expect(f.sinkPerHour, `第${era.major}境的 ${f.resource}`).toBeGreaterThan(0);
      }
    }
  });

  it("人间界灵石经济受控:既不窒息也不失去意义", () => {
    for (const era of mortal) {
      const stone = era.flows.find((f) => f.resource === "stone")!;
      expect(stone.ratio, `第${era.major}境灵石收支比`).toBeGreaterThan(0.3);
      expect(stone.ratio, `第${era.major}境灵石收支比`).toBeLessThan(30);
    }
  });

  it("人间界炼丹材料买得起:灵草收入至少覆盖半数炼丹需求", () => {
    for (const era of mortal) {
      const herb = era.flows.find((f) => f.resource === "herb")!;
      expect(herb.ratio, `第${era.major}境灵草`).toBeGreaterThan(0.5);
    }
  });

  it("人间界器灵尘自给:强化消耗可由分解收入覆盖", () => {
    for (const era of mortal) {
      const dust = era.flows.find((f) => f.resource === "dust")!;
      expect(dust.ratio, `第${era.major}境器灵尘`).toBeGreaterThan(0.6);
    }
  });

  it("人间界闲置预警:允许过剩,但「全时期闲置」的资源不允许超过 1 种", () => {
    const idle: string[] = [];
    for (const era of mortal) {
      for (const f of era.flows) {
        if (f.verdict === "闲置")
          idle.push(
            `第${era.major}境:${f.resource}(×${f.ratio === Infinity ? "∞" : f.ratio.toFixed(0)})`,
          );
      }
    }
    console.log(
      idle.length ? `\n  [人间界闲置预警] ${idle.join(" · ")}` : "\n  [人间界闲置预警] 无",
    );
    const chronic = new Map<string, number>();
    for (const era of mortal) {
      for (const f of era.flows) {
        if (f.verdict === "闲置") chronic.set(f.resource, (chronic.get(f.resource) ?? 0) + 1);
      }
    }
    const chronicallyIdle = [...chronic.entries()]
      .filter(([, n]) => n >= mortal.length)
      .map(([r]) => r);
    expect(
      chronicallyIdle.length,
      `长期闲置资源: ${chronicallyIdle.join(",")}`,
    ).toBeLessThanOrEqual(1);
  });

  /**
   * ISS-306 设计闸:灵草→灵石 兑换已整体删除(方向反了 —— 草比石贵)。
   * - 服务层哨兵常真(HERB_EXCHANGE_VETOED),禁止任何人加回草→石出口;
   * - 审计不再把兑换当草出口:0~3 境灵草即使闲置/过剩,也要按「储备」口径自报
   *   (参照界外悟道那条"出口未入模型就明说"的惯例),而不是被当成无人理睬的死资源;
   * - 审计读数不再携带兑换字段。
   */
  it("ISS-306:无任何草→石 兑换;前期闲置灵草是储备而非死资源", () => {
    for (const era of eras.slice(0, 4)) {
      const herb = era.flows.find((f) => f.resource === "herb")!;
      // 炼丹仍然吃草(这不是死资源 —— 它有本职去处)
      expect(herb.sinkPerHour, `第${era.major}境炼丹还需灵草`).toBeGreaterThan(0);
      if (herb.verdict === "闲置" || herb.verdict === "过剩") {
        expect(herb.note, `第${era.major}境灵草闲置/过剩没有自报「储备」口径`).toContain("储备");
      }
    }
    for (const era of eras) {
      expect("herbExchanged" in era, "审计不再产出草→石 兑换读数").toBe(false);
      expect("stoneFromExchange" in era, "审计不再产出兑换补石读数").toBe(false);
    }
  });

  it("界外:每样材料都有非零出口(熔炉),不再出现 ∞ 与死资源", () => {
    for (const era of outer) {
      for (const f of era.flows) {
        expect(f.sinkPerHour, `第${era.major}境 ${f.resource} 没有出口`).toBeGreaterThan(0);
      }
      // 悟道点是唯一例外 —— 它的真出口(功法进修 / 法宝炼化)没进模型,故必须自报口径
      const wudao = era.flows.find((f) => f.resource === "wudao")!;
      expect(wudao.note, `第${era.major}境悟道流的出口没进模型,却不自报口径`).toContain("待补");
    }
  });

  /**
   * 回归:悟道点收入必须含**际遇**这一条。
   *
   * 从前只算藏经阁,于是 0~1 境读出 ratio 0.047,并据此立了 ISS-305
   * 「前期缺口 20 倍」——那是假的:悟道点没有战斗或灵田产线,际遇才是主源
   * (实测 20~31/h,藏经阁 4~18/h)。少算主源会把收入低估 5~6 倍。
   *
   * 判据守两件事:①收入必须高于藏经阁单条(即际遇确实计入了);
   * ②前期不再是 0.05 那种"差二十倍"的读数 —— 那是模型的产物,不是设计的意图。
   */
  it("悟道点收入含际遇这条主源:不再只算藏经阁", () => {
    for (const era of eras.slice(0, 6)) {
      const wudao = era.flows.find((f) => f.resource === "wudao")!;
      const libraryOnly = libraryWudaoPerHour(Math.min(12, 2 + 2 * era.major));
      expect(
        wudao.incomePerHour,
        `第${era.major}境悟道收入应高于藏经阁单条(${libraryOnly}/h),际遇没算进去`,
      ).toBeGreaterThan(libraryOnly);
      expect(wudao.ratio, `第${era.major}境悟道收支比`).toBeGreaterThan(0.2);
    }
  });

  /**
   * 模型必须贴着**真实抽事件**走 —— 这是本轮两次栽跟头的教训。
   *
   * 际遇收入是审计里唯一"另建了一份模型"的量(其余都直接读产线速率),
   * 而模型最容易犯的错就是池子筛得比真跑宽:先前把该境界可达地界的标签
   * 并起来算一次,于是只在某处出现的高额事件(`ev_turtle` 每趟 7 点)漏进
   * 每一处,第 9 境读出 0.910 而真跑只有 0.618 —— 高估 47%。
   *
   * 判据:逐境界用真实 pickEventFor 抽一遍,与 reachableEventWudao 比对。
   * 种子固定,故这是确定性断言;容差 15% 只留给抽样噪声,不留给模型偏差。
   */
  it("际遇悟道模型与真实抽事件吻合(不许宽于真跑)", () => {
    setActivePinia(createPinia());
    const player = usePlayerStore();
    for (const major of [0, 2, 5, 9]) {
      player.major = major;
      const reachable = REGIONS.filter((r) => r.minRealm <= major);
      const rand = new RandomService(mulberry32(20261016 + major));
      let encounters = 0;
      let wudao = 0;
      for (let i = 0; i < 8000; i += 1) {
        const region = reachable[Math.floor(rand.next() * reachable.length)]!;
        const ev = pickEventFor(region, rand);
        if (!ev) continue;
        encounters += 1;
        const choice = ev.choices.find((c) => c.isDefault) ?? ev.choices[0];
        if (!choice) continue;
        const total = choice.outcomes.reduce((s, o) => s + o.weight, 0);
        if (total <= 0) continue;
        for (const outcome of choice.outcomes) {
          for (const effect of outcome.effects) {
            if (effect.type === "material" && effect.id === "wudao") {
              wudao += (outcome.weight / total) * effect.amount;
            }
          }
        }
      }
      const simPerEncounter = wudao / encounters;
      const modelPerEncounter = reachableEventWudao(major);
      const drift = Math.abs(modelPerEncounter - simPerEncounter) / simPerEncounter;
      expect(
        drift,
        `第${major}境际遇悟道模型 ${modelPerEncounter.toFixed(3)} 偏离真跑 ${simPerEncounter.toFixed(3)} 达 ${(drift * 100).toFixed(0)}%`,
      ).toBeLessThan(0.15);
    }
  });

  /**
   * 终局的进度杠杆:**凝一枚道果要多少小时的材料产出**。
   *
   * ISS-214 的旧病是"价格冻死":灵石收入按 1.9^层级 涨,而熔炉的灵石价写死在真仙那一层
   * (tier 20),于是到混沌海(tier 32)道果相对收入便宜了 1.9^12 ≈ 293 倍 ——
   * 一战的灵石就够换一枚以上道果。定价改随层级之后,这个代价落在 **1 小时上下**,
   * 而且整条长尾上只差一个量级以内。
   *
   * 守两条:① 绝对量级(几分钟一枚太贱、一天一枚太贵);② 量级不漂移。
   * 允许的残余梯度来自器灵尘 —— 高品质装备分解出的尘随层级变多,而熔炉的尘价是绝对数,
   * 故深处略便宜(1.68h → 0.90h,约 1.9 倍);那是品质窗口的副作用,不是价格冻死。
   * 「每境凝几枚道果」是玩法节奏,不是审计能替玩家定的。
   */
  it("界外:凝一枚道果的材料代价不随层级漂移(ISS-214 的旧病)", () => {
    const rows = outer.map((era) => ({ major: era.major, hours: era.daoCostHours ?? 0 }));
    console.log("\n  [界外道果价] 凝一枚道果 ≈ 多少小时的材料产出:");
    for (const r of rows) console.log(`    第${r.major}境 ${r.hours.toFixed(2)}h`);
    const min = Math.min(...rows.map((r) => r.hours));
    const max = Math.max(...rows.map((r) => r.hours));
    expect(min, "凝一枚道果便宜到几分钟一枚 —— 终局数值出口会失去意义").toBeGreaterThan(0.1);
    expect(max, "凝一枚道果贵到一天以上 —— 终局会变成摆设").toBeLessThan(24);
    expect(max / min, `道果价随层级漂移了:${min.toFixed(2)}h → ${max.toFixed(2)}h`).toBeLessThan(2);
  });

  /**
   * 灵气是突破的门槛资源(一次耗上限的四成),所以它的体检问题只有一个:
   **它会不会成为卡关的那一环**。判据按界域分段,因为"多久算久"在这里本就不同:
   · 人间界(0~8):突破节奏以分钟计,回满要是拖到半小时以上,玩家就真的在等灵气 ——
     故沿用 30 分钟这条绝对线(Phase 19 定的口径)。
   · 界外(9~20):一层修为以**天**计(真仙一层 124 天),而回满只有小时级,
     灵气不可能成为瓶颈 —— 故这一段守的是**相对**口径:回满 ≤ 本境一层耗时的 1%。
     绝对线在这一段没有意义(第 16 境回满 78 分钟,而那一层要修 700 年)。
   (ISS-212 原本报的是"30 分钟这条线只覆盖 0~9 境"这个覆盖缺口,现按上口径补全。)
   */
  it("灵气结构健康:人间界回满 ≤30 分钟;界外回满 ≪ 本境一层耗时(永不成为瓶颈)", () => {
    expect(BT_QI_COST_RATIO).toBeLessThan(1);
    const rows: string[] = [];
    for (let m = 0; m <= MAX_MAJOR; m += 1) {
      const fill = qiFillSeconds(m);
      expect(Number.isFinite(fill) && fill > 0, `第${m}境灵气回满读数`).toBe(true);
      if (m <= 8) expect(fill, `第${m}境灵气回满`).toBeLessThan(1800);
      else expect(fill / layerSeconds(m), `第${m}境回满占一层的比例`).toBeLessThan(0.01);
      rows.push(`第${m}境 ${fill.toFixed(0)}s`);
    }
    console.log(`\n  [灵气回满时长] ${rows.join(" · ")}`);
  });
});

describe("界外悟道点的口径附注 · 附注必须与模型对得上", () => {
  /*
   * 附注写错比不写更糟:读者会按它去补一遍已经算进去的东西,或者索性不信这一格。
   * 这里把「注里说的」与「代码里算的」钉在一起 —— 要么两边一致,要么当场红。
   */
  const src = readFileSync(resolve(__dirname, "./economySim.ts"), "utf8");

  it("功法进修确实在 wudaoSinkEra 里(附注据此才敢说「已计入」)", () => {
    expect(src).toMatch(/wudaoSinkEra\s*=\s*GONGFA_UPS_PER_ERA\s*\*\s*gongfaUpCost\(/);
  });

  it("注里不再声称功法进修未入模型", () => {
    const notes = [...src.matchAll(/界外出口[^"`]*/g)].map((m) => m[0]);
    expect(notes.length, "找不到界外出口那条附注 —— 判据放空了").toBeGreaterThan(0);
    for (const note of notes) {
      expect(note, `附注与模型不一致:${note}`).not.toContain("功法进修 / 法宝炼化");
      expect(note).not.toMatch(/功法进修[^,)]*未入模型/);
    }
  });

  it("法宝炼化仍未入模型 —— 若哪天入了,这条附注必须一起改", () => {
    expect(src).not.toContain("artifactUpCost");
  });
});
