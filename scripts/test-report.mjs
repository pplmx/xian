/**
 * 分类测试报告 —— 按系统输出 PASS/FAIL,而非只看总数
 * 用法: bun run test:report
 */
import { execSync } from 'node:child_process'
import { readFileSync, rmSync } from 'node:fs'

/**
 * 分类映射。匹配是路径子串,按数组顺序取第一个命中的分类,故有两条约束:
 * ① 串要够长以免误伤(用 'game.spec' 而非 'game',否则 endgameService 会被截胡);
 * ② 同一文件只应命中一类。新增 spec 后务必在此登记 —— 未登记的用例不进任何
 *    分类,报告就少算了它,等于这份报告在撒谎。
 */
const CATEGORIES = [
  {
    name: 'Engine      公共库内核',
    match: ['packages/engine', 'engineAdoption', 'engineParity', 'engineResourceParity', 'engineHoldingParity', 'engineReforgeParity', 'engineTriageParity', 'engineCombatAblation', 'engineCycleParity', 'engineChoiceParity', 'engineCodexParity', 'engineMemoryParity', 'engineEconomyParity', 'engineIntakeParity', 'engineSettlementParity', 'engineDropsParity', 'engineBuffsParity', 'engineBuffAblation', 'engineFacilitiesParity', 'engineVeinParity', 'engineDailyParity', 'engineLifeParity', 'engineChainParity', 'enginePityParity', 'engineUnlockParity', 'engineCraftParity', 'engineProgressionAudit']
  },
  {
    name: 'Unit        数值纯函数',
    match: ['gnum', 'format', 'timeUnits', 'savePlaintext', 'formulas', 'linggenGen', 'equipGen', 'crypto', 'quests', 'codex', 'craftability', 'reforge', 'theme', 'savePersistence', 'dongfu.spec', 'ui.spec']
  },
  {
    name: 'Combat      战斗规则',
    match: ['combat.spec', 'battleFactor', 'highTierSmoke', 'ironwall', 'bossAudit', 'bossPhaseAudit', 'exploration.spec', 'regionRevival']
  },
  {
    name: 'Balance     流派与生态',
    match: ['buildSim', 'buildSearch', 'buildDetect', 'buildAdvisor', 'powerRating', 'statBreakdown', 'equipSet', 'astral', 'artifactLadder', 'talentLadder', 'gongfaBranch', 'softCapAudit', 'softCapVisibility', 'speedGranularity', 'linggenAffinity', 'linggenRole']
  },
  { name: 'Progression 成长曲线', match: ['realms.spec', 'realmBanking', 'realmNaming', 'classics', 'progressionDoc', 'progressionSim', 'realPacing', 'breakthrough', 'inflationAudit', 'samsaraAudit', 'daoFruitCurve', 'saveCalibration', 'rebirthRoi', 'deepCultivationRoi', 'contentGateAudit', 'shallowRebirthGains', 'narrowingImpact', 'impactSurface', 'compoundingAudit', 'daoFruitRoles', 'fruitOutlets', 'lifeTrialService', 'trialMotivation', 'motivationType', 'mortalWorldGen', 'mortalIdentity', 'mortalGate', 'mortalRouteAccess', 'overviewNecessity', 'contentTakeover', 'bossUnique', 'worldNaming', 'worldSemantics', 'player.rebirth'] },
  { name: 'Economy     资源经济', match: ['economySim', 'expIncome', 'lootSim', 'loot.spec', 'salvage', 'smartKeep', 'petLuck', 'pillValue', 'pillService', 'consumableBuffCap', 'veinEconomyAudit', 'veinVisibility', 'resourceGuidance', 'offlineCap', 'offlineLedger', 'offlineParity', 'offlineScope', 'veinService', 'qiRepair'] },
  {
    name: 'Regression  服务与归因',
    match: ['loadoutService', 'battleAnalysis', 'foeOrigin', 'loreService', 'contentReachability', 'contentDensity', 'mentorService', 'daoluService', 'bondEvents', 'bondTiming', 'bondIntent', 'bondCausality', 'worldMemory', 'phase31LinkAudit', 'suppress', 'game.spec', 'earlyGameService', 'earlyGameBuffs', 'savePlatform', 'saveRoundTrip', 'saveBackup', 'importCorruption', 'saveMigration', 'codexSource', 'achievementHint', 'titleLadder', 'artifactEffects', 'dataHeaderAudit', 'deadExportAudit', 'chainProgression', 'vocabularyCoverage', 'singleSourceAudit', 'effectWiring', 'uiLayering', 'itemText', 'kaiFontCoverage', 'palette.spec', 'colorVar.spec', 'fatePreview', 'goBack', 'storeResilience', 'cultivation.spec', 'diag.spec', 'platform.spec', 'rewardReachability', 'dataIntegrity', 'dataTextAudit', 'unlockChainSelfHeal', 'questProgress', 'firstStep', 'rebrand']
  },
  { name: 'Celestial   真仙终局', match: ['celestialSim', 'celestialCaliber', 'endgameService', 'phase21', 'expedition', 'soulForge', 'souls.spec', 'rulesetEra', 'qimen'] },
  {
    name: 'Decision    决策质量',
    match: [
      'decisionAudit', 'synergyScan', 'worldGen', 'ruleUniverse', 'playerLab', 'legacy', 'identity', 'samsara',
      'fortune', 'worldEcho', 'regionEvent', 'eventTier', 'eventEngine', 'eventRealmBand', 'weather', 'boundaryTribulation', 'tribulation', 'secretRealm', 'petPersonality', 'goal.spec', 'divination', 'fate.spec', 'astronomy'
    ]
  }
]

const OUT = '.vitest-report.json'

try {
  execSync(`bunx vitest run --reporter=json --outputFile=${OUT}`, { stdio: 'pipe' })
} catch {
  // 有测试失败时 vitest 以非零码退出,报告文件仍会生成
}

let report
try {
  report = JSON.parse(readFileSync(OUT, 'utf8'))
} catch {
  console.error('未能读取测试报告,请先确认 bunx vitest run 可正常执行')
  process.exit(1)
}
rmSync(OUT, { force: true })

const rows = CATEGORIES.map(c => ({ ...c, passed: 0, failed: 0 }))
let uncategorized = 0
/** 未登记的文件名与用例数 —— 光报个数没用,得让人一眼看到该往哪儿加 */
const orphans = []

for (const file of report.testResults ?? []) {
  const path = String(file.name ?? '')
  const row = rows.find(c => c.match.some(m => path.includes(m)))
  const passed = (file.assertionResults ?? []).filter(a => a.status === 'passed').length
  const failed = (file.assertionResults ?? []).filter(a => a.status === 'failed').length
  if (row) {
    row.passed += passed
    row.failed += failed
  } else {
    uncategorized += passed + failed
    orphans.push({ path: path.replace(/^.*\/(src|packages)\//, '$1/'), count: passed + failed })
  }
}

console.log('\n—— 《玄枢录》分类测试报告 ——\n')
let totalPassed = 0
let totalFailed = 0
for (const row of rows) {
  totalPassed += row.passed
  totalFailed += row.failed
  const status = row.failed > 0 ? 'FAIL' : 'PASS'
  const mark = row.failed > 0 ? '✗' : '✓'
  console.log(`  ${mark} ${row.name.padEnd(22, ' ')} ${status}  (${row.passed} 过${row.failed ? ` / ${row.failed} 败` : ''})`)
}
if (uncategorized > 0) {
  console.log(`  ✗ 未分类用例 ${uncategorized} 个 —— 请在 scripts/test-report.mjs 的 CATEGORIES 中补充映射:`)
  for (const o of orphans.sort((a, b) => b.count - a.count)) console.log(`      ${String(o.count).padStart(4)}  ${o.path}`)
}
console.log(`\n  共 ${totalPassed} 过 / ${totalFailed} 败${uncategorized > 0 ? ` · 另有 ${uncategorized} 个未分类` : ''}\n`)
/**
 * 退出码的**原因**要写在最后一行。
 *
 * 起因是一次真实的困惑:报告印着"0 败",脚本却以 1 退出 —— 当时只当成了偶发,连着跑了几次
 * 全绿就搁下了。真正的机制是下面这第二条:**未分类也算失败**(漏登记的用例不计入任何一类,
 * 报告就少算了它)。把原因印出来,"0 败 + 退出 1" 这种组合以后再也不会被误读成 flake。
 */
const failureReason =
  totalFailed > 0 ? `有用例失败(${totalFailed} 个)` : uncategorized > 0 ? `有 ${uncategorized} 个用例没登记分类(报告会少算它们)` : ''
if (failureReason) console.log(`  退出码 1 的原因:${failureReason}\n`)
// 未分类也算失败:漏登记的用例不计入任何一类,报告便少算了它。
// 只提示不拦截的话,这个数会一路悄悄涨上去(曾积到 225 个才被发现)。
process.exit(totalFailed > 0 || uncategorized > 0 ? 1 : 0)
