/**
 * 分类测试报告 —— 按系统输出 PASS/FAIL,而非只看总数
 * 用法: bun run test:report
 */
import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");

/**
 * 分类映射。匹配是路径子串,按数组顺序取第一个命中的分类,故有两条约束:
 * ① 串要够长以免误伤(用 'game.spec' 而非 'game',否则 endgameService 会被截胡);
 * ② 同一文件只应命中一类。新增 spec 后务必在此登记 —— 未登记的用例不进任何
 *    分类,报告就少算了它,等于这份报告在撒谎。
 */
const CATEGORIES = [
  {
    name: "Engine      公共库内核",
    match: [
      "packages/engine",
      "engineAdoption",
      "engineParity",
      "engineResourceParity",
      "engineHoldingParity",
      "engineReforgeParity",
      "engineTriageParity",
      "engineCombatAblation",
      "engineCycleParity",
      "engineChoiceParity",
      "engineCodexParity",
      "engineMemoryParity",
      "engineEconomyParity",
      "engineIntakeParity",
      "engineSettlementParity",
      "engineDropsParity",
      "engineBuffsParity",
      "engineBuffAblation",
      "engineFacilitiesParity",
      "engineVeinParity",
      "engineDailyParity",
      "engineLifeParity",
      "engineChainParity",
      "enginePityParity",
      "engineUnlockParity",
      "engineCraftParity",
      "engineProgressionAudit",
    ],
  },
  {
    name: "Unit        数值纯函数",
    match: [
      "gnum",
      "format",
      "timeUnits",
      "savePlaintext",
      "formulas",
      "linggenGen",
      "equipGen",
      "crypto",
      "quests",
      "codex",
      "craftability",
      "reforge",
      "affixTransfer",
      "useAffixTransfer",
      "theme",
      "audio.spec",
      "savePersistence",
      "enginePause",
      "setMath",
      "dongfu.spec",
      "ui.spec",
    ],
  },
  {
    name: "Combat      战斗规则",
    match: [
      "combat.spec",
      "battleFactor",
      "highTierSmoke",
      "ironwall",
      "bossAudit",
      "bossPhaseAudit",
      "exploration.spec",
      "exploreModes",
      "explorationDnd",
      "regionRevival",
    ],
  },
  {
    name: "Balance     流派与生态",
    match: [
      "buildSim",
      "buildSearch",
      "buildDetect",
      "buildAdvisor",
      "playerMatchup",
      "powerRating",
      "statBreakdown",
      "equipSet",
      "astral",
      "artifactLadder",
      "artifacts.spec",
      "talentLadder",
      "petQuality",
      "gongfaBranch",
      "softCapAudit",
      "softCapVisibility",
      "speedGranularity",
      "linggenAffinity",
      "linggenRole",
    ],
  },
  {
    name: "Progression 成长曲线",
    match: [
      "realms.spec",
      "realmBanking",
      "realmNaming",
      "realmLadder",
      "classics",
      "progressionDoc",
      "progressionSim",
      "realPacing",
      "gongfaService",
      "breakthrough",
      "inflationAudit",
      "samsaraAudit",
      "daoFruitCurve",
      "saveCalibration",
      "rebirthRoi",
      "deepCultivationRoi",
      "contentGateAudit",
      "shallowRebirthGains",
      "narrowingImpact",
      "impactSurface",
      "compoundingAudit",
      "daoFruitRoles",
      "fruitOutlets",
      "lifeTrialService",
      "trialMotivation",
      "motivationType",
      "mortalWorldGen",
      "mortalIdentity",
      "mortalGate",
      "mortalRouteAccess",
      "overviewNecessity",
      "contentTakeover",
      "bossUnique",
      "worldNaming",
      "worldSemantics",
      "worldRite",
      "player.rebirth",
      "heritageForge",
      "heritageEffects",
    ],
  },
  {
    name: "Economy     资源经济",
    match: [
      "economySim",
      "expIncome",
      "lootSim",
      "loot.spec",
      "salvage",
      "smartKeep",
      "petLuck",
      "pillValue",
      "pillValueMonotonic",
      "pillService",
      "pillBatch",
      "useBrewing",
      "consumableBuffCap",
      "buffStackCount",
      "veinEconomyAudit",
      "veinVisibility",
      "resourceGuidance",
      "offlineCap",
      "offlineLedger",
      "offlineModeReward",
      "offlineParity",
      "offlineScope",
      "offlineWinnableLoot",
      "veinService",
      "qiRepair",
      "herbMarket",
      "herbGrades",
      "buildingService.spec",
      "market.spec",
      "marketStock.spec",
      "bounty",
    ],
  },
  {
    name: "Regression  服务与归因",
    match: [
      "loadoutService",
      "loadouts",
      "battleAnalysis",
      "foeOrigin",
      "loreService",
      "soulService",
      "smithingLore",
      "inventoryNote",
      "titleReunlock",
      "contentReachability",
      "contentDensity",
      "mentorService",
      "apprentice",
      "daoluService",
      "bondEvents",
      "bondTiming",
      "bondIntent",
      "bondCausality",
      "worldMemory",
      "phase31LinkAudit",
      "layeringAudit",
      "layoutMeasure",
      "adventureText",
      "scriptDepsAudit",
      "suppress",
      "game.spec",
      "earlyGameService",
      "earlyGameBuffs",
      "useDaoEntry",
      "useServiceWorkerUpdate",
      "utils/saveShape",
      "settings.spec",
      "savePlatform",
      "saveRoundTrip",
      "saveBackup",
      "importCorruption",
      "saveMigration",
      "storage.spec",
      "codexSource",
      "achievementHint",
      "titleLadder",
      "artifactEffects",
      "dataHeaderAudit",
      "deadExportAudit",
      "chainProgression",
      "vocabularyCoverage",
      "singleSourceAudit",
      "buildingCardSource",
      "effectWiring",
      "uiLayering",
      "itemText",
      "eventText",
      "kaiFontCoverage",
      "palette.spec",
      "colorVar.spec",
      "inkIcons.spec",
      "ornament.spec",
      "favicon.spec",
      "useNativeInsets",
      "useGameClock",
      "useGameNow",
      "engineTick",
      "modalStack",
      "singleWriter",
      "useReturnSettle",
      "readOnlySettle",
      "mortalBias",
      "offlineFuzz",
      "reincarnationConfirm",
      "bountyEconomics",
      "usageDocCounts",
      "swPrecache",
      "smokeReading",
      "absenceLedger",
      "tautologyGuard",
      "reportTestDecl",
      "fatePreview",
      "goBack",
      "inventorySeen",
      "storeResilience",
      "cultivation.spec",
      "diag.spec",
      "platform.spec",
      "rewardReachability",
      "dataIntegrity",
      "dataTextAudit",
      "unlockChainSelfHeal",
      "questProgress",
      "firstStep",
      "rebrand",
      "gradleShadow",
      "gateWiring",
      "veinText",
      "statNames.spec",
    ],
  },
  {
    name: "Celestial   真仙终局",
    match: [
      "celestialSim",
      "celestialStarAblation",
      "celestialCaliber",
      "endgameService",
      "phase21",
      "expedition",
      "gauntlet",
      "soulForge",
      "souls.spec",
      "rulesetEra",
      "qimen",
      "gateRuleText",
    ],
  },
  {
    name: "Decision    决策质量",
    match: [
      "decisionAudit",
      "enlightenBalance",
      "synergyScan",
      "worldGen",
      "ruleUniverse",
      "playerLab",
      "legacy",
      "identity",
      "samsara",
      "fortune",
      "worldEcho",
      "regionEvent",
      "eventTier",
      "eventEngine",
      "eventRealmBand",
      "weather",
      "boundaryTribulation",
      "tribulation",
      "secretRealm",
      "petPersonality",
      "goal.spec",
      "divination",
      "fate.spec",
      "astronomy",
      "equipBest",
    ],
  },
];

// 与 vite.config.ts 里 test.outputFile 同路径:verify 里 `vp test run` 先落盘,
// 这里复读同一份,不再把全量 vitest 跑第二遍(见下文 VERIFY_SHARED_VITEST_JSON)。
const OUT = resolve(ROOT, ".vitest", "vitest-report.json");

/**
 * vitest 的退出码是"有没有失败"的唯一权威信号,不能丢。
 * 之前把它吞掉,只靠 JSON 里的 status === 'failed' 重算 —— 那会漏两类情况:
 *   · **被 .skip 的用例**:vitest 报 status='skipped'/'todo'/'disabled',既不算 passed
 *     也不算 failed。开发为了过 CI 随手把挂掉的用例 .skip 一行,回归门就这样被拆除,
 *     报告却印"0 败"、退出 0 —— 这是最危险的一种假绿。
 *   · **文件级报错**(import/describe 阶段炸,assertionResults 为空):同样没有
 *     'failed' 条目,重算法看不到。
 * 故同时盯两路:childExitCode 兜住一切非零退出,JSON 重算兜住 skipped 等旁路状态。
 */
let childExitCode = 0;
let report = null;
// verify 里 `bun run test`(vp test run)已经用 config 的 json reporter 把完整结果
// 写进了 OUT —— 只有 verify 会置 VERIFY_SHARED_VITEST_JSON=1 表示「读这份就行」。
// 复读同一份结果,既保留分类报告 + 文档例数核对,又不再把全量 vitest 跑第二遍。
// 独立跑 test:report(如 CI 的 `bun run check && bun run test:report`)没这个标记,
// 绝不读旧文件,照旧自己跑一次 —— 免得拿上一次运行的旧结果冒充新报告。
if (process.env.VERIFY_SHARED_VITEST_JSON === "1" && existsSync(OUT)) {
  try {
    report = JSON.parse(readFileSync(OUT, "utf8"));
  } catch {
    report = null;
  }
  rmSync(OUT, { force: true });
}
if (!report) {
  try {
    mkdirSync(dirname(OUT), { recursive: true });
    execSync(`bunx vitest run --reporter=json --outputFile=${OUT}`, { stdio: "pipe" });
  } catch (e) {
    // 有测试失败时 vitest 以非零码退出,报告文件仍会生成;退出码从异常里取
    const status = typeof e === "object" && e !== null && "status" in e ? Number(e.status) : NaN;
    childExitCode = Number.isInteger(status) ? status : 1;
  }
  try {
    report = JSON.parse(readFileSync(OUT, "utf8"));
  } catch {
    console.error("未能读取测试报告,请先确认 bunx vitest run 可正常执行");
    process.exit(1);
  }
  rmSync(OUT, { force: true });
}

const rows = CATEGORIES.map((c) => ({ ...c, passed: 0, failed: 0 }));
let uncategorized = 0;
/** 未登记的文件名与用例数 —— 光报个数没用,得让人一眼看到该往哪儿加 */
const orphans = [];

for (const file of report.testResults ?? []) {
  const path = String(file.name ?? "");
  const row = rows.find((c) => c.match.some((m) => path.includes(m)));
  const passed = (file.assertionResults ?? []).filter((a) => a.status === "passed").length;
  // skipped/todo/disabled/pending 一律算失败:一条守卫用例被 .skip,等于把关卡拆了,
  // 它守护的回归从此不再被量。只报"0 败"会让人误以为真的全绿。
  const failed = (file.assertionResults ?? []).filter(
    (a) =>
      a.status === "failed" ||
      a.status === "skipped" ||
      a.status === "todo" ||
      a.status === "disabled" ||
      a.status === "pending",
  ).length;
  if (row) {
    row.passed += passed;
    row.failed += failed;
  } else {
    uncategorized += passed + failed;
    orphans.push({ path: path.replace(/^.*\/(src|packages)\//, "$1/"), count: passed + failed });
  }
}

console.log("\n—— 《玄枢录》分类测试报告 ——\n");
let totalPassed = 0;
let totalFailed = 0;
for (const row of rows) {
  totalPassed += row.passed;
  totalFailed += row.failed;
  const status = row.failed > 0 ? "FAIL" : "PASS";
  const mark = row.failed > 0 ? "✗" : "✓";
  console.log(
    `  ${mark} ${row.name.padEnd(22, " ")} ${status}  (${row.passed} 过${row.failed ? ` / ${row.failed} 败` : ""})`,
  );
}
if (uncategorized > 0) {
  console.log(
    `  ✗ 未分类用例 ${uncategorized} 个 —— 请在 scripts/test-report.mjs 的 CATEGORIES 中补充映射:`,
  );
  for (const o of orphans.sort((a, b) => b.count - a.count))
    console.log(`      ${String(o.count).padStart(4)}  ${o.path}`);
}
console.log(
  `\n  共 ${totalPassed} 过 / ${totalFailed} 败${uncategorized > 0 ? ` · 另有 ${uncategorized} 个未分类` : ""}`,
);

// —— 文档里**不许**写用例条数 ——
//
// 由来:README 与 development.md 曾把「346 个 spec / 3436 例,本作 266 / 2841」这种
// 实录数字写进正文。问题是:spec 文件数静态可数(docs-check 能核对),**用例条数只有
// 跑完才知道** —— 每加删一条用例都要手改两处文档,改漏了 `test:report` 就打红。
// 于是每次动测试都在做一件与测试无关的杂务,而这个数对读文档的人并没有额外价值:
// 想知道当前有多少例,`bun run test:report` 每次都会把真实数打在最上面。
//
// 故改成反向守卫:文档正文里再出现「N 例」这类实录数,当场红。
// 只放行两处 —— 归档(docs/superpowers/plans/** 是当时的计划,不该被逼着改记录)
// 与「不许写例数」这句规则本身的说明文字。
const ARCHIVE = "docs/superpowers/plans/";
const DOC_FILES = [
  { rel: "README.md", file: resolve(ROOT, "README.md"), dir: resolve(ROOT) },
].concat(
  readdirSync(join(ROOT, "docs"), { recursive: true, encoding: "utf-8" })
    .filter((name) => typeof name === "string" && name.endsWith(".md"))
    // readdirSync 的 recursive 会**原样带上平台分隔符**(Windows 上是 `superpowers\plans\x.md`)。
    // 不归一化的话,下面那条 startsWith 在 Windows 上永远判 false —— 归档豁免静默失效,
    // 哪天归档里恰好写着「N 例」,`bun run test:report` 就会在 Windows 上
    // 假红、在 CI 上真绿,两边看起来都"有理由"。
    // 归一化放在**组装出口**这一处(与 docs-check.mjs 同一处置、同一写法):后面所有拿 rel 的
    // 地方(读文件、报错文案、归档判据)都吃这一份口径,不必各自再 replace 一遍。
    .map((name) => name.replace(/\\/g, "/"))
    .filter((rel) => !rel.startsWith(ARCHIVE))
    .map((rel) => ({
      rel: `docs/${rel}`,
      file: join(ROOT, "docs", rel),
      dir: join(ROOT, "docs"),
    })),
);
// 自证:归一化若失效(有人把这行删了、或换了别的读目录方式),归档豁免会**只在 Windows 上**
// 静默失灵 —— CI 在 Linux 上永远绿,没人会去怀疑判据。故让脚本自己先看一眼分隔符。
// 这条不是"文档的问题",是路径口径的问题,故不走 docFailures(那会被当成"文档忘了同步")。
const unnormalized = DOC_FILES.filter((d) => d.rel.includes("\\"));
if (unnormalized.length > 0) {
  console.error(
    `未分类?不,是脚本坏了:DOC_FILES 里混进了反斜杠路径 —— 归档豁免(${ARCHIVE})与所有 ` +
      "startsWith/includes 都按正斜杠写,反斜杠会让它们静默失效。\n" +
      "  修法:在组装 DOC_FILES 时把分隔符归一化成正斜杠,别在判据里两边各写一套。",
  );
  for (const d of unnormalized.slice(0, 5)) console.error(`  ✗ ${d.rel}`);
  process.exit(1);
}

/**
 * 命中「N 例」的地方 —— 但跳过两种情况:
 *   · 行内已经写明这是规则本身的(含「不许写例数」「用例条数不写进文档」);
 *   · 出现在代码块里的示例命令与目录树,是给人照抄的,不是实录。
 * 用行号而不是整段匹配:文档里一行一句,报错能直接指到行。
 */
/**
 * 命中「N 例」的地方 —— 但跳过两种:
 *   · 行内已写明这是规则本身的;
 *   · 目录树里的注释(以 `#` 开头且不含命令的那类),那是结构说明不是实录。
 *
 * **代码块不整体豁免** —— 第一版放了它,理由是「示例命令是给人照抄的」,
 * 结果 README 里那条 `vp test # 全量用例(346 spec / 3436 例…)` 恰好写在代码块里,
 * 于是最重要的那处反而漏检。教训:给豁免开的每一个口子,都要想到它会被用来绕过。
 */
function caseCountHits(text) {
  const hits = [];
  const lines = text.split(/\r?\n/);
  lines.forEach((line, i) => {
    if (/(不许写例数|用例条数不写进文档|不写进文档)/.test(line)) return;
    /*
     * 只认真正的用例数写法。中文里「条」是通用量词,不能当作用例标记 ——
     * 第一版把「四条去路」也吃了,判据误报比漏报更伤(它教人开始怀疑判据本身)。
     */
    const m = /(\d[\d,]*)\s*(例|个用例|条用例|个断言|条断言)/.exec(line);
    if (m) hits.push(`第 ${i + 1} 行: ${line.trim().slice(0, 80)}`);
  });
  return hits;
}

const docFailures = [];
for (const { rel, file } of DOC_FILES) {
  let text;
  try {
    text = readFileSync(file, "utf-8");
  } catch {
    continue;
  }
  for (const hit of caseCountHits(text)) {
    docFailures.push(`${rel} ${hit} —— 文档只记 spec 文件数,用例条数不写进文档`);
  }
}
if (docFailures.length > 0) {
  console.log("  ✗ 文档里又写回了用例条数（它每次都变,不该记在文档里）:");
  for (const f of docFailures) console.log(`      ${f}`);
}
console.log("");

/**
 * 退出码的**原因**要写在最后一行。
 *
 * 起因是一次真实的困惑:报告印着"0 败",脚本却以 1 退出 —— 当时只当成了偶发,连着跑了几次
 * 全绿就搁下了。真正的机制是下面这第二条:**未分类也算失败**(漏登记的用例不计入任何一类,
 * 报告就少算了它)。把原因印出来,"0 败 + 退出 1" 这种组合以后再也不会被误读成 flake。
 */
const docFailure = docFailures.length > 0 ? `文档里又写回了用例条数(${docFailures.length} 处)` : "";
const failureReason =
  totalFailed > 0
    ? `有用例失败或跳过(${totalFailed} 个)`
    : childExitCode !== 0
      ? `vitest 自身非零退出(码 ${childExitCode},可能是文件级报错)`
      : uncategorized > 0
        ? `有 ${uncategorized} 个用例没登记分类(报告会少算它们)`
        : docFailure;
if (failureReason) console.log(`  退出码 1 的原因:${failureReason}\n`);
// 未分类也算失败:漏登记的用例不计入任何一类,报告便少算了它。
// 只提示不拦截的话,这个数会一路悄悄涨上去(曾积到 225 个才被发现)。
// childExitCode!==0 兜底:JSON 里没有 'failed' 条目的文件级报错也绝不假绿。
// 文档例数不符同样拦截:加删用例而不同步文档,等于把判据写进文档又拆掉。
process.exit(
  totalFailed > 0 || childExitCode !== 0 || uncategorized > 0 || docFailures.length > 0 ? 1 : 0,
);
