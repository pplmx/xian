/**
 * 经济闭环审计(Phase 19)
 * 用真实公式与真实掉落生成,估算各境界时期「每小时生产 vs 每小时消耗」,
 * 找出瓶颈资源 / 死资源 / 纯 UI 噪音。
 *
 * 审计模型假设(集中声明,便于质疑与修正):
 * - 全程挂机历练,战斗间隔与胜率取典型值;
 * - 建筑等级随大境界成长(lv ≈ 2 + 2×境界,受各自上限约束);
 * - 消耗按「该时期内的总沉没成本 / 该时期时长」摊销。
 *
 * Phase 40 补全两处(见 ISS-209):
 * - **修为也进表**。它此前不在六条资源流里,而它恰是最大的一条收入 ——
 *   口径随 Phase 39 统一:一切即时修为 = 修速 × 一段等效闭关时长,故这一行
 *   量的是「等效闭关秒/小时」,收入 = 挂机 + 历练两条线(core/expIncome 同一把尺子),
 *   消耗 = 通关本境的修为需求。比值全程恒定,不随境界漂移 —— 这正是要守的性质。
 * - **界外十二境一并体检**(0~20 境,不再只跑人间界 0~8)。区域层级取自
 *   data/regions 的 maxTierForMajor —— 从前这里自写 `min(20, 2m+2)`,把界外
 *   十二境全压死在层级 20,收入那一半先错了 1.9^12。
 *
 * 读界外的表须知:那一段的**出口**多半不在建筑上(建筑早已封顶),而在天道熔炉
 * (玄铁/残页/器灵尘 → 道源)。本模型尚未把熔炉出口计入,故界外读到的高闲置
 * 是「没有出口模型」的读数,不等于「这些资源真的没用」—— 见 ISS-210。
 */
import { toNum } from "@/utils/gnum";
import { mulberry32, RandomService } from "@/utils/random";
import { BUILDINGS } from "@/data/buildings";
import { PILLS } from "@/data/pills";
import { qualityDef } from "@/data/qualities";
import {
  ARTIFACT_MAX_LEVEL,
  ARTIFACT_SLOT_UNLOCK_MAJOR,
  ARTIFACT_UP_WUDAO_BASE,
} from "@/data/artifacts";
import { MAX_MAJOR } from "@/data/realms";
import { WORLD_BREAK_MAJOR } from "@/data/realms";
import { REGIONS, maxTierForMajor } from "@/data/regions";
import { createEconomyReadings } from "wanxiang-engine";
import {
  DAO_SOURCE_PER_FRUIT,
  FURNACE_RATES,
  FURNACE_STONE_DAO_SOURCE,
  FURNACE_STONE_TIER_AMOUNT,
} from "@/data/endgame";
import {
  COMPREHEND_PAGE_COST,
  DECOMPOSE_DUST,
  EQUIP_DROP_CHANCE,
  FIELD_HERB_PER_HOUR,
  FIELD_ORE_PER_HOUR,
  PAGE_DROP_CHANCE,
} from "@/data/constants";
import {
  buildingCost,
  gongfaUpCost,
  qiCap,
  baseQiRegen,
  stoneByTier,
  upgradeCost,
} from "./formulas";
import { libraryWudaoPerHour } from "./engineFacilities";
import { generateEquipment } from "./equipGen";
import { secondsForMajor } from "./progressionSim";
import { eventsPerHour, tripExpSecsPerHour, winsPerHour } from "./expIncome";
import { eventWudaoPerEncounter } from "./eventEngine";
import { SECS_PER_HOUR } from "@/data/constants";

// ---- 挂机行为假设 ----
const UPGRADES_PER_HOUR = 3;
const CRAFTS_PER_HOUR = 2;
const GONGFA_UPS_PER_ERA = 6;
/**
 * 一期练满几件法宝。
 *
 * ## 第一版取 6，把前期读数打坏了 —— 错在没有按"几件能到手"算
 *
 * 我照功法进修的「每期六次」抄了个 6，于是 m0 的悟道点支出从 3 涨到 **3961**
 * （ratio 0.006），而 `economySim.spec` 那条「悟道点收入含际遇这条主源」当场红。
 * 红得对:前期的玩家**一件法宝都没有**。
 *
 * 真实可达性:
 *
 * ```text
 *   ARTIFACT_SLOT_UNLOCK_MAJOR = 3   法宝从第 3 境（元婴）才开
 *   ARTIFACT_MAX_SLOTS = 2           开出来也只有 2 个位子
 * ```
 *
 * 故按 2 件算，且**只在解锁之后**。这不是"拍小一点让它别红"，是让模型对上
 * 玩家真能同时练几件。
 */
const ARTIFACT_UPS_PER_ERA = 2;
const REAL_TIME_FACTOR = 2; // 真实体感 ≈ 纯修炼估算 ×2
/** 沉没成本摊销的最小时长:早期时期极短,玩家实际用数小时慢慢补齐建筑 */
const MIN_AMORTIZE_HOURS = 2;

export type AuditResource =
  | "stone"
  | "herb"
  | "ore"
  | "page"
  | "dust"
  | "wudao"
  | "exp"
  | "daoSource";

export interface ResourceFlow {
  resource: AuditResource;
  incomePerHour: number;
  sinkPerHour: number;
  ratio: number;
  verdict: "瓶颈" | "健康" | "过剩" | "闲置";
  /**
   * 这条读数的口径附注 —— 只在"模型没把握"时出现。
   *
   * 审计的红线是"不许把没模型的地方算成健康,也不许算成事故":有出口没进账本时,
   * 与其让 ratio 报一个吓人的数,不如明说缺的是哪一条。
   *
   * ## 曾经挂在这里的那一条，现在摘掉了
   *
   * 界外悟道点原本挂着「界外出口待补法宝炼化（功法进修已计入）」—— 那句话是准的:
   * 功法进修一直算着，而法宝炼化没算。而量出来它**大一个量级**（一件法宝练满
   * 160~398 点 vs 一期进修 24 点），于是 m19/m20 被误判成「瓶颈」。
   * 第 363 轮把它计进 `wudaoSinkEra`，牌子随之摘掉。
   *
   * 记账:一个"这里还缺东西"的牌子，补上之后必须摘 —— 否则下一个人会照着它再查一遍
   * （这一处已经因为同一个理由改过一次，见上句的来历）。
   */
  note?: string;
}

export interface EraAudit {
  major: number;
  tier: number;
  eraHours: number;
  flows: ResourceFlow[];
  /**
   * 界外专有:凝一枚道果需要多少小时的材料产出(道果价 ÷ 熔炉潜力)。
   *
   * 这是终局的进度杠杆 —— 应当**不随层级漂移**;漂移即有人把某一段价格冻死了。
   */
  daoCostHours?: number;
}

function buildingLevel(major: number, maxLevel: number): number {
  return Math.min(maxLevel, 2 + 2 * major);
}

/**
 * 经济读数走库的经济层(见 packages/engine 的 economy):比值怎么算、分档阈值、
 * "没把握就写 note"的口径都在那儿;本作只给判词的说法(瓶颈 / 健康 / 过剩 / 闲置)。
 */
const ECONOMY_READINGS = createEconomyReadings({
  labels: { tight: "瓶颈", healthy: "健康", surplus: "过剩", idle: "闲置" },
});

/** 该层级掉落装备的平均分解灵尘(真实生成取样) */
export function avgDustPerDrop(tier: number, samples = 200): number {
  const rng = new RandomService(mulberry32(tier * 131));
  let total = 0;

  for (let i = 0; i < samples; i += 1) {
    const inst = generateEquipment(tier, rng);
    total += DECOMPOSE_DUST[qualityDef(inst.quality).rank] ?? 1;
  }
  return total / samples;
}

/**
 * 该境界一趟际遇的悟道点期望 —— 对**每处可达地界各算一遍再取均值**。
 *
 * 为什么不是把标签并起来算一次:标签并集会让只属于某处地界的高额事件
 * (如 `ev_turtle` 每趟 7 点,只在它那处出现)漏进**每一处**的池子,
 * 于是高境界读出一个虚高的收入 —— 实测第 9 境并集 0.910 vs 真跑 0.618,
 * 高估 47%;按地界平均则是 0.621,与真跑吻合。
 *
 * 为什么不是"挑最深那处当代表":玩家并不会只站在最深处,按地界平均
 * 才与"这一境会遇到的际遇"对得上。
 */
export function reachableEventWudao(major: number): number {
  const reachable = REGIONS.filter((r) => r.minRealm <= major);
  if (reachable.length === 0) return 0;
  const total = reachable.reduce((sum, r) => sum + eventWudaoPerEncounter(major, r.eventTags), 0);
  return total / reachable.length;
}

/** 单个境界时期的资源流审计 */
/**
 * 把一件法宝从 0 练到 `ARTIFACT_MAX_LEVEL` 要多少悟道点 —— 与 `core/forge` 的
 * `artifactUpCost` 同一个公式（等级指数 1.6、品质加成 0.3/rank）。
 *
 * 为什么在这里重写一遍而不是调 `artifactUpCost`:那个函数要读**存档**
 * （`useInventoryStore()` 里有没有这件法宝），而审计是纯计算、不该建 Pinia。
 * 判据 `artifactWudaoSink.spec` 用 `ARTIFACT_UP_WUDAO_BASE` 与
 * `qualityDef(...).rank` 反查，两边系数写歪就会红。
 */
function artifactUpgradeWudaoToMax(qualityRank: number): number {
  let sum = 0;
  for (let lv = 0; lv < ARTIFACT_MAX_LEVEL; lv += 1) {
    sum += Math.ceil(ARTIFACT_UP_WUDAO_BASE * Math.pow(1.6, lv) * (1 + qualityRank * 0.3));
  }
  return sum;
}

export function auditEra(major: number): EraAudit {
  const tier = maxTierForMajor(major);
  const eraHours = (secondsForMajor(major, 0) / SECS_PER_HOUR) * REAL_TIME_FACTOR || 0.1;
  const amortizeHours = Math.max(eraHours, MIN_AMORTIZE_HOURS);
  /**
   * 遭遇速率取自 core/expIncome —— 那是"一次遭遇值多少"的唯一口径所在地,
   * 这里再写一遍就会出现两个「全时历练 = ×N」的说法(本审计第一版正是如此:
   * 一处按全胜算、一处按 0.85 胜率算,同一句话读出 1.64 与 1.51 两个数)。
   */
  const winsThisHour = winsPerHour();
  const dropsPerHour = winsThisHour * EQUIP_DROP_CHANCE;

  const fieldLv = buildingLevel(major, 15);
  const libLv = buildingLevel(major, 12);

  // ---- 生产 ----
  const stoneIncome = winsThisHour * toNum(stoneByTier(tier, 10));
  /*
   * 掉落收入这三行写的是**寻常游历(收益 ×1)**的口径 —— 与 `core/loot` 的
   * `dropEntriesFor` 同源:灵草五成掉 1~3(均值 2)、玄铁 35% 掉 1~2(均值 1.5)、
   * 残页 12% 掉 1~2(均值 1.5)。
   *
   * 境界曲线审计比的是「同一境界下收入与消耗的比值」,用的必须是一个**定档**口径;
   * 取 ×1 就是取最保守的那一档。第 390 轮让 herb/ore 也吃 `rewardMult` 之后,
   * 这三行仍对 —— 它们本就只在倍率 1 上成立(玩家切到涉险档会赚更多,
   * 而那条账在出行窗里按档位现算,不在这张审计表里)。
   */
  const herbIncome = winsThisHour * 0.5 * 2 + fieldLv * FIELD_HERB_PER_HOUR;
  const oreIncome = winsThisHour * 0.35 * 1.5 + fieldLv * FIELD_ORE_PER_HOUR;
  const pageIncome = winsThisHour * PAGE_DROP_CHANCE * 1.5;
  const dustIncome = dropsPerHour * avgDustPerDrop(tier);
  /**
   * 悟道点收入 = 藏经阁 + 际遇。
   *
   * 从前只算藏经阁,于是审计读出「0~1 境缺口 20 倍」并据此立了一个 issue ——
   * 那是假的:悟道点没有战斗或灵田产线,际遇才是它的主源(实测 20~31/h,
   * 藏经阁 4~18/h)。漏掉主源 = 把收入低估 5~6 倍,缺口自然被放大。
   *
   * 际遇额度取该境界可达地界的均值(见 reachableEventWudao);际遇里的悟道
   * 不看层级,故这一项基本随境界带变化,而不随层级涨。
   */
  const eventWudao = reachableEventWudao(major) * eventsPerHour();
  const wudaoIncome = libraryWudaoPerHour(libLv) + eventWudao;
  /**
   * 修为收入 = 挂机(底:1.0× 修速 = 3600 等效秒/小时)+ 历练(战斗胜场与际遇),
   * 两条线都随修速缩放,故这一行的比值在任何境界都该是同一个数 —— 判据据此断。
   * 速率与时长都取自 core/expIncome(同一把尺子)。
   */
  // 镇压红利(镇守道韵)未入本表数值:同源挂机曲线(core/suppress,每区 +8%/小时、封顶 +40%),
  // 任何境界都是挂机的固定加成,不改「比值恒平」的结论 —— 自报口径,不装健康。
  const expIncome = SECS_PER_HOUR + tripExpSecsPerHour();

  // ---- 消耗(时期总量摊销到每小时) ----
  let stoneSinkEra = 0;
  let oreSinkEra = 0;
  for (const b of BUILDINGS) {
    const from = buildingLevel(major, b.maxLevel);
    const to = buildingLevel(major + 1, b.maxLevel);
    for (let lv = from; lv < to; lv += 1) {
      stoneSinkEra += toNum(buildingCost(b.costBase, lv));
      oreSinkEra += b.costOre * (lv + 1);
    }
  }
  /*
   * 悟道点的两个出口。
   *
   * 功法进修一直在模型里；**法宝炼化此前没算**，而它大一个量级:
   *
   * ```text
   *   一件法宝练到 ARTIFACT_MAX_LEVEL(9 重)
   *     凡品(rank0)  ≈ 160 悟道点
   *     天品(rank5)  ≈ 398 悟道点
   *   一期功法进修(6 次) ≈ 24 悟道点
   * ```
   *
   * 不算它的后果不是"少算一点":m19/m20 的悟道点因此被判成「瓶颈」(0.56~0.58)，
   * 而真相是"最大的那个出口没进账本"。审计里那条 `note` 已经明说了这件事
   * （「界外出口待补法宝炼化」）—— 本轮把它补上，并把牌子摘掉。
   *
   * 系数取自 `ARTIFACT_UP_WUDAO_BASE` 与 `artifactUpCost` 同一个公式；
   * 一期练满几件取 `ARTIFACT_UPS_PER_ERA`（与功法进修同一条"每期六次"的口径）。
   */
  /*
   * 法宝第 ARTIFACT_SLOT_UNLOCK_MAJOR 境才开；在此之前这一项是 0。
   * 开了之后也不是当拍就有两件练满 —— 刚开那一境玩家手上通常只有一件刚捡到的。
   *
   * 故按「解锁后已过几境」分摊件数（上限 ARTIFACT_UPS_PER_ERA）:
   * 解锁当境 1 件，之后 2 件。第一版在解锁当境直接按 2 件算，
   * 把 m3 的 ratio 从 0.77 压到 0.125，`economySim.spec` 那条「前期差二十倍」的红当场亮了。
   */
  const artifactUpsThisEra =
    major < ARTIFACT_SLOT_UNLOCK_MAJOR
      ? 0
      : Math.min(ARTIFACT_UPS_PER_ERA, major - ARTIFACT_SLOT_UNLOCK_MAJOR + 1);
  const artifactWudaoSinkEra = artifactUpsThisEra * artifactUpgradeWudaoToMax(major);
  // 功法进修
  const wudaoSinkEra = GONGFA_UPS_PER_ERA * gongfaUpCost(2, 3 + major) + artifactWudaoSinkEra + 8;
  const pageSinkEra = COMPREHEND_PAGE_COST + GONGFA_UPS_PER_ERA * (3 + major);
  // 炼丹(取该时期可炼配方的平均成本)
  const recipes = PILLS.filter((p) => p.recipe && p.minRealm <= major);
  const avgHerbCost = recipes.length
    ? recipes.reduce((s, p) => s + p.recipe!.herb, 0) / recipes.length
    : 0;
  const avgPillStone = recipes.length
    ? recipes.reduce(
        (s, p) => s + toNum(stoneByTier(maxTierForMajor(p.minRealm), p.recipe!.stoneBase / 10)),
        0,
      ) / recipes.length
    : 0;
  // 装备强化
  const up = upgradeCost(3, tier, 3, 0);
  const dustSinkHour = UPGRADES_PER_HOUR * up.dust;
  const stoneSinkHour =
    UPGRADES_PER_HOUR * toNum(up.stone) +
    CRAFTS_PER_HOUR * avgPillStone +
    stoneSinkEra / amortizeHours;
  const herbSinkHour = CRAFTS_PER_HOUR * avgHerbCost;
  /**
   * 修为消耗 = 通关本境所需的等效闭关秒 ÷ 本境时长。
   *
   * 这里**不套 MIN_AMORTIZE_HOURS**:那道下限是给建筑的(「玩家用数小时慢慢补齐」),
   * 而修为需求本来就摊在本境这一段时长里,早期一境只有十几分钟也照摊。
   */
  const expSinkHour = secondsForMajor(major, 0) / eraHours;

  /**
   * 界外的出口:天道熔炉。
   *
   * 人间界的四样材料都有别的去处(建筑、炼丹、参悟、强化),界外没有 ——
   * 建筑早封顶、玄铁的消耗项归零,于是审计在这里读出 ∞ 与「闲置十万倍」。
   * 那不是"材料没用",是**模型缺了出口**:终局的玄铁/残页/灵草/器灵尘(以及灵石)
   * 都投进天道熔炉换道源,道源再凝道果(终局唯一的数值出口)。
   *
   * 这里的建模口径(与终局玩法同源,数字全部取自 data/endgame):
   *   潜力 = Σ 各材料产出 ÷ 该材料的熔铸率 + 灵石产出 ÷ 灵石熔铸价 × 每次道源数
   *   需求 = 每境凝一枚道果(DAO_SOURCE_PER_FRUIT / 本境时长)
   *
   * 但**别把这个比值当健康判据** —— 它主要是"这一境有多长"的函数(一境越长,
   * 摊出来的需求越小)。真正有意义的是速率与价格那条:**凝一枚道果要多少小时的材料产出**
   * (见 daoCostHours),它才是终局的进度杠杆,而且必须**不随层级漂移** ——
   * 漂移就说明有人把某一段的价格又冻死了(ISS-214 的旧病)。
   */
  const furnace = ((): { potential: number; demand: number } | null => {
    if (major < WORLD_BREAK_MAJOR) return null;
    const byResource: Partial<Record<AuditResource, number>> = {
      ore: oreIncome,
      page: pageIncome,
      herb: herbIncome,
      dust: dustIncome,
    };
    let potential = 0;
    for (const rate of FURNACE_RATES) {
      const income = byResource[rate.resource as AuditResource];
      if (income) potential += income / rate.per;
    }
    /**
     * 灵石熔铸:一份灵石换 FURNACE_STONE_DAO_SOURCE 缕道源。
     *
     * 价格按**这一境的层级**折算 —— 与 endgameService.furnaceStoneCost 同一口径。
     * 从前两边都写死第 20 层:灵石收入按 1.9^层级 涨,价格却不动,
     * 于是到混沌海一条石脉就能换来满地道果(ISS-214)。
     */
    const stonePerDao = toNum(stoneByTier(tier, FURNACE_STONE_TIER_AMOUNT));
    if (stonePerDao > 0) potential += (stoneIncome / stonePerDao) * FURNACE_STONE_DAO_SOURCE;
    return { potential, demand: DAO_SOURCE_PER_FRUIT / Math.max(eraHours, 1) };
  })();

  /**
   * 界外的材料按「有什么投什么」分摊熔炉需求:每样材料的有效出口
   * = 自己的道源潜力 × (需求 / 总潜力)。故四者与道源流的比值是同一个数 ——
   * 它说的正是「材料总量是终局需求的几倍」。
   */
  const furnaceShare =
    furnace && furnace.potential > 0 ? Math.min(1, furnace.demand / furnace.potential) : 0;

  /**
   * 凝一枚道果要多少小时的材料产出 = 道果价(道源) ÷ 熔炉潜力(道源/小时)。
   * 这是终局的进度杠杆:它是常数,说明"材料 → 道果"的换算在整条长尾上同一个价。
   */
  const daoCostHours =
    furnace && furnace.potential > 0 ? DAO_SOURCE_PER_FRUIT / furnace.potential : 0;

  const make = (
    resource: AuditResource,
    income: number,
    sink: number,
    note?: string,
  ): ResourceFlow => {
    const [reading] = ECONOMY_READINGS.read([{ key: resource, income, sink, note }]);
    return {
      resource,
      incomePerHour: income,
      sinkPerHour: sink,
      ratio: reading!.ratio,
      verdict: reading!.verdict as ResourceFlow["verdict"],
      note,
    };
  };

  /** 界外:这几样材料的出口改认熔炉(人间界照旧走各自的去处) */
  const withFurnace = (resource: AuditResource, income: number, baseSink: number): ResourceFlow => {
    if (!furnace) return make(resource, income, baseSink);
    const rate = FURNACE_RATES.find((r) => r.resource === resource)!;
    return make(resource, income, (income / rate.per) * furnaceShare);
  };

  /**
   * 灵草(ISS-306):不再有「灵草→灵石」出口 —— 那个方向被产品否了(草比石贵)。
   * 过剩/闲置的灵草不是死资源,是**储备**:分级保值,只进不出,石头再多也换不来
   * 新手村那株草的分量。参照界外悟道那条惯例(出口未入模型就自报口径,不装健康),
   * 给闲置/过剩的草一行明说,免得审计读数被当成无人理睬的死资源。
   */
  const herbFlow = withFurnace("herb", herbIncome, herbSinkHour);
  if (herbFlow.verdict === "闲置" || herbFlow.verdict === "过剩") {
    herbFlow.note = "灵草即储备(分级保值,不设草→石出口)";
  }

  return {
    major,
    tier,
    eraHours,
    ...(furnace ? { daoCostHours } : {}),
    flows: [
      make("stone", stoneIncome, stoneSinkHour),
      herbFlow,
      withFurnace("ore", oreIncome, oreSinkEra / amortizeHours),
      withFurnace("page", pageIncome, pageSinkEra / amortizeHours),
      withFurnace("dust", dustIncome, dustSinkHour),
      make("wudao", wudaoIncome, wudaoSinkEra / amortizeHours, undefined),
      make("exp", expIncome, expSinkHour),
      ...(furnace ? [make("daoSource", furnace.potential, furnace.demand)] : []),
    ],
  };
}

export function fullEconomyAudit(): EraAudit[] {
  const out: EraAudit[] = [];
  for (let m = 0; m <= MAX_MAJOR; m += 1) out.push(auditEra(m));
  return out;
}

/** 灵气结构体检:回满时长(秒) */
export function qiFillSeconds(major: number): number {
  return qiCap(major, 0) / baseQiRegen(major);
}
