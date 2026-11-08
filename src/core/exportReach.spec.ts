/**
 * 导出的可达性 —— 加 `export` 之前先问「谁要用它」。
 *
 * ## 为什么值得一条判据
 *
 * 一个 `export` 是一份**承诺**:它对其他模块可见,改签名要顾全所有使用者。
 * 而本仓有 69 个导出**只在自己文件里出现过** —— 定义时顺手加了 `export`,
 * 之后从没被别处引用。它们不报错、不影响行为,只让「这个模块对外提供什么」
 * 变得含混:读代码的人分不清哪些是真对外,哪些是手滑。
 *
 * ## 口径(必须写死,否则数字会飘)
 *
 *   · **算全部** `.ts` / `.vue`,**含** `*.spec.ts` —— 测试引用也是引用,
 *     一个只被测试用的导出不该被算作"没人用"。
 *   · 用**倒排表**:先统计每个标识符出现在哪些文件里,再看某个导出名的
 *     文件集合是否**只有它自己的定义文件**。
 *   · 定义行本身算一次出现,故"只在本地用"等价于 `files.size === 1`。
 *
 * 上一条口径是踩出来的:先前三个版本分别数出 69 / 49 / 20,差别全在
 * "算不算 spec 引用"与"用正则逐文件找还是用倒排表"。这个数字必须一次算准,
 * 否则基线写歪了判据会随机红绿 —— 那比没有判据更糟。
 *
 * ## 为什么用基线而不是直接清干净
 *
 * 清 69 处要动 40 多个文件,每一处都得判断"是不是留着给以后用"。收益是代码整洁,
 * 风险是改错一处就少一个对外入口 —— 不成比例。故与 `importCycles`、
 * `layeringAudit` 一样:**存量记账,增量当场拦**。
 */
import { describe, expect, it } from "vite-plus/test";
import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(__dirname, "../..");
const SRC = join(ROOT, "src");

/** src 下全部 .ts / .vue(含 spec —— 测试引用也是引用) */
function allFiles(): string[] {
  const out: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.(ts|vue)$/.test(entry.name)) out.push(full);
    }
  };
  walk(SRC);
  return out.sort();
}

/**
 * 当前「只在本文件出现」的导出 —— **基线,只许减**。
 *
 * 每一条都是「定义了 export 却没人从别处用过」。真要对外时它会被别处引用,
 * 自然从这份名单消失(那时记得把它删掉,见第二条断言)。
 */
const BASELINE = new Set([
  "core/audio.ts:startBgm",
  "core/celestialSim.ts:auditWorld",
  "core/collectionProgress.ts:COLLECTION_INITIAL_OPEN_MAX",
  "core/compare.ts:measureOnWorld",
  "core/contentGateAudit.ts:humanEventGoldShare",
  "core/daoFruitCurve.ts:LIFECYCLE_HORIZON",
  "core/daoluService.ts:currentDaolu",
  "core/daoluService.ts:availableBondEvents",
  "core/economySim.ts:avgDustPerDrop",
  "core/economySim.ts:auditEra",
  "core/engineFacilities.ts:BUILDING_LEVELS_PER_MANSION",
  "core/engineResources.ts:SMALL_LEDGER",
  "core/equipSet.ts:SUNDER_SET_ARMOR_PEN",
  "core/equipSet.ts:THORNS_SET_COUNTER_RATE",
  "core/equipSet.ts:THORNS_SET_COUNTER_DAMAGE",
  "core/equipSet.ts:PRIMORDIAL_SET_SHIELD",
  "core/equipSet.ts:PRIMORDIAL_SET_SHIELD_POWER",
  "core/eventEngine.ts:eventWudaoExpectation",
  "core/expIncome.ts:idleExpSecsPerHour",
  "core/expedition.ts:MUTATION_ESCALATION",
  "core/fingerprints.ts:MECHANIC_FAMILIES",
  "core/fruitOutlets.ts:QUADRANTS",
  "core/gauntlet.ts:CELESTIAL_JUDGE_RATE",
  "core/inflationAudit.ts:qualityQuantileAt",
  "core/inflationAudit.ts:otherSourceMods",
  "core/kaiLateFaces.ts:attachLateKaiFaces",
  "core/loreService.ts:encounterMaterial",
  "core/mortalIdentity.ts:visibleDistanceByDim",
  "core/mortalIdentity.ts:visibleNovelty",
  "core/mortalWorldGen.ts:generateApprovedMortal",
  "core/mortalWorldService.ts:VIEW_W",
  "core/mortalWorldService.ts:VIEW_H",
  "core/pillValue.ts:AUDIT_SUB",
  "core/pillValue.ts:AUDIT_SKILL",
  "core/pillValue.ts:auditCraftRate",
  "core/pillValue.ts:auditYield",
  "core/pillValue.ts:dropShareAt",
  "core/pillValue.ts:dropBattlesOf",
  "core/pillValue.ts:pillValueRow",
  "core/realmPressure.ts:realmPressurePart",
  "core/reincarnation.ts:DAOHAO_CORES",
  "core/reincarnation.ts:DAOHAO_SUFFIXES",
  "core/resourceGuidance.ts:DAO_SOURCE_USAGES",
  "core/resourceGuidance.ts:DAO_FRUIT_USAGES",
  "core/samsaraAudit.ts:talentPowerBonusAt",
  "core/samsaraService.ts:branchCount",
  "core/samsaraService.ts:avengedCount",
  "core/suppress.ts:SUPPRESS_EXP_PER_REGION",
  "core/suppress.ts:SUPPRESS_EXP_MAX",
  "core/suppress.ts:SUPPRESS_EQUIP_LUCK_CAP",
  "core/suppress.ts:SUPPRESS_EQUIP_LUCK_PER_DAY",
  "core/trialMotivation.ts:trialImpact",
  "core/trialMotivation.ts:coveredAxes",
  "core/tribulationDecision.ts:PREP_THRESHOLDS",
  "core/tribulationDecision.ts:burstScore",
  "data/comboArts.ts:COMBO_ARTS",
  "data/lifeTrials.ts:DEFAULT_MAX_ROUNDS",
  "data/samsara.ts:INSIGHT_LEGACY_PER_LIFE",
  "data/timeUnits.ts:TEA_SEC",
  "data/timeUnits.ts:INCENSE_SEC",
  "data/timeUnits.ts:HALF_SHICHEN_SEC",
  "ui/earlyGameText.ts:buffEffectText",
  "ui/qualityPeakStores.ts:currentQualityRank",
  "ui/realmCodexDesk.ts:realmCodexRealmStateLabel",
  "ui/realmCodexDesk.ts:realmCodexRealmStateMark",
  "ui/useNextStep.ts:nextStepPageOf",
  "ui/useNextStep.ts:anyDongfuUpgradeAffordable",
  "ui/useNextStep.ts:anyArtifactSeatOpen",
  "ui/useNextStep.ts:currentNextStepInput",
]);

describe("导出的可达性 · 只在本地用的 export 不许再增", () => {
  /*
   * **排除本文件自己** —— 基线里逐个写着那些名字(`core/audio.ts:startBgm` …),
   * 于是 `startBgm` 会同时出现在 `core/audio.ts` 与这份 spec 里,倒排表算出 size=2,
   * 「只在本文件用」就永远不成立,actual 恒为空集。
   *
   * 这是自指污染:判据的**数据**参与了判据的**输入**。上一轮数出 69 与 20 反复不一的
   * 根本原因也是它 —— 当时我把 spec 一并算进"引用",而那份 spec 里正好抄着这些名字。
   */
  const SELF = join(SRC, "core/exportReach.spec.ts");
  const files = allFiles().filter((f) => f !== SELF);
  const texts = new Map(files.map((f) => [f, readFileSync(f, "utf8")]));

  /** 标识符 → 出现在哪些文件(倒排表,一次扫完) */
  const filesWith = new Map<string, Set<string>>();
  for (const [file, text] of texts) {
    for (const name of new Set(text.match(/[A-Za-z_$][\w$]*/g) ?? [])) {
      let set = filesWith.get(name);
      if (!set) filesWith.set(name, (set = new Set()));
      set.add(file);
    }
  }

  it("扫得到导出 —— 集合不能是空的", () => {
    // 防空转:正则写错(比如只认 `export function`)会让集合空掉,后面永远绿
    let count = 0;
    for (const [file, text] of texts) {
      if (file.endsWith(".spec.ts")) continue;
      count += [...text.matchAll(/^export\s/gm)].length;
    }
    expect(count, "一个 export 都没扫到 —— 正则或路径失效了").toBeGreaterThan(1000);
  });

  it("自用导出与基线一致 —— 新增的立刻红", () => {
    const actual = new Set<string>();
    for (const [file, text] of texts) {
      if (file.endsWith(".spec.ts")) continue;
      const rel = file.slice(SRC.length + 1).replace(/\\/g, "/");
      for (const m of text.matchAll(/^export\s+(?:async\s+)?(?:function|const|class)\s+(\w+)/gm)) {
        const name = m[1]!;
        const set = filesWith.get(name);
        if (set && set.size === 1 && set.has(file)) actual.add(`${rel}:${name}`);
      }
    }
    const added = [...actual].filter((k) => !BASELINE.has(k)).sort();
    const removed = [...BASELINE].filter((k) => !actual.has(k)).sort();
    expect(
      added.slice(0, 12),
      "新加了只在本文件用的 export —— 改回普通声明(去掉 export),或确认它真要对其他模块可见。" +
        "真要对外的话,它会被别处 import,自然不进这份名单",
    ).toEqual([]);
    /*
     * 减了也要报:基线比实际多,说明那个 export 已被别处使用(或改名/删除)而基线没跟 ——
     * 留着它,下次同一个名字再变成"只在本地"时会被当成已知,判据就守不住了。
     */
    expect(
      removed,
      "基线里的条目已不存在 —— 从 BASELINE 删掉它(说明它现在有外部使用者了,是好事)",
    ).toEqual([]);
  });
});
