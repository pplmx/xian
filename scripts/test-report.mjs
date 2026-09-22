/**
 * 分类测试报告 —— 按系统输出 PASS/FAIL,而非只看总数
 * 用法: bun run test:report
 */
import { execSync } from 'node:child_process'
import { readFileSync, rmSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'

const ROOT = resolve(import.meta.dirname, '..')
const ENGINE_DIR = 'packages/engine'

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
    match: ['buildSim', 'buildSearch', 'buildDetect', 'buildAdvisor', 'powerRating', 'statBreakdown', 'equipSet', 'astral', 'artifactLadder', 'artifacts.spec', 'talentLadder', 'gongfaBranch', 'softCapAudit', 'softCapVisibility', 'speedGranularity', 'linggenAffinity', 'linggenRole']
  },
  { name: 'Progression 成长曲线', match: ['realms.spec', 'realmBanking', 'realmNaming', 'classics', 'progressionDoc', 'progressionSim', 'realPacing', 'breakthrough', 'inflationAudit', 'samsaraAudit', 'daoFruitCurve', 'saveCalibration', 'rebirthRoi', 'deepCultivationRoi', 'contentGateAudit', 'shallowRebirthGains', 'narrowingImpact', 'impactSurface', 'compoundingAudit', 'daoFruitRoles', 'fruitOutlets', 'lifeTrialService', 'trialMotivation', 'motivationType', 'mortalWorldGen', 'mortalIdentity', 'mortalGate', 'mortalRouteAccess', 'overviewNecessity', 'contentTakeover', 'bossUnique', 'worldNaming', 'worldSemantics', 'player.rebirth'] },
  { name: 'Economy     资源经济', match: ['economySim', 'expIncome', 'lootSim', 'loot.spec', 'salvage', 'smartKeep', 'petLuck', 'pillValue', 'pillService', 'consumableBuffCap', 'veinEconomyAudit', 'veinVisibility', 'resourceGuidance', 'offlineCap', 'offlineLedger', 'offlineParity', 'offlineScope', 'veinService', 'qiRepair'] },
  {
    name: 'Regression  服务与归因',
    match: ['loadoutService', 'battleAnalysis', 'foeOrigin', 'loreService', 'contentReachability', 'contentDensity', 'mentorService', 'daoluService', 'bondEvents', 'bondTiming', 'bondIntent', 'bondCausality', 'worldMemory', 'phase31LinkAudit', 'suppress', 'game.spec', 'earlyGameService', 'earlyGameBuffs', 'savePlatform', 'saveRoundTrip', 'saveBackup', 'importCorruption', 'saveMigration', 'codexSource', 'achievementHint', 'titleLadder', 'artifactEffects', 'dataHeaderAudit', 'deadExportAudit', 'chainProgression', 'vocabularyCoverage', 'singleSourceAudit', 'effectWiring', 'uiLayering', 'itemText', 'kaiFontCoverage', 'palette.spec', 'colorVar.spec', 'inkIcons.spec', 'fatePreview', 'goBack', 'storeResilience', 'cultivation.spec', 'diag.spec', 'platform.spec', 'rewardReachability', 'dataIntegrity', 'dataTextAudit', 'unlockChainSelfHeal', 'questProgress', 'firstStep', 'rebrand']
  },
  { name: 'Celestial   真仙终局', match: ['celestialSim', 'celestialCaliber', 'endgameService', 'phase21', 'expedition', 'gauntlet', 'soulForge', 'souls.spec', 'rulesetEra', 'qimen'] },
  {
    name: 'Decision    决策质量',
    match: [
      'decisionAudit', 'synergyScan', 'worldGen', 'ruleUniverse', 'playerLab', 'legacy', 'identity', 'samsara',
      'fortune', 'worldEcho', 'regionEvent', 'eventTier', 'eventEngine', 'eventRealmBand', 'weather', 'boundaryTribulation', 'tribulation', 'secretRealm', 'petPersonality', 'goal.spec', 'divination', 'fate.spec', 'astronomy'
    ]
  }
]

const OUT = '.vitest-report.json'

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
let childExitCode = 0
try {
  execSync(`bunx vitest run --reporter=json --outputFile=${OUT}`, { stdio: 'pipe' })
} catch (e) {
  // 有测试失败时 vitest 以非零码退出,报告文件仍会生成;退出码从异常里取
  const status = (typeof e === 'object' && e !== null && 'status' in e) ? Number(e.status) : NaN
  childExitCode = Number.isInteger(status) ? status : 1
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
  // skipped/todo/disabled/pending 一律算失败:一条守卫用例被 .skip,等于把关卡拆了,
  // 它守护的回归从此不再被量。只报"0 败"会让人误以为真的全绿。
  const failed = (file.assertionResults ?? []).filter(a => a.status === 'failed' || a.status === 'skipped' || a.status === 'todo' || a.status === 'disabled' || a.status === 'pending').length
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
console.log(`\n  共 ${totalPassed} 过 / ${totalFailed} 败${uncategorized > 0 ? ` · 另有 ${uncategorized} 个未分类` : ''}`)

// —— 文档里的「例数」声称也要守住 ——
// docs-check.mjs 只数 spec 文件(静态可数);「例」只有跑完测试才知道,故放在这一头:
// 全量例数 = 本次运行全部断言,本作自己那部分 = 去掉公共库(src 之外的 packages/engine)。
// 文档(README / docs)若写着与本次运行不符的例数,当场红 —— 加删用例若不同步改文档,这就是它的闸门。
const DOC_FILES = [{ rel: 'README.md', file: resolve(ROOT, 'README.md'), dir: resolve(ROOT) }].concat(
  readdirSync(join(ROOT, 'docs'), { recursive: true, encoding: 'utf-8' })
    .filter(name => typeof name === 'string' && name.endsWith('.md') && !name.includes('superpowers/plans'))
    .map(name => ({ rel: `docs/${name}`, file: join(ROOT, 'docs', name), dir: join(ROOT, 'docs') }))
)
// vitest JSON 里的文件名是绝对路径(`/…/xian/src/…` / `/…/xian/packages/engine/…`),
// 「本作自己那部分」= 不在公共库目录下的 spec(src 下,与 docs-check 的 hostOnly 同口径)。
const isEngineFile = f => String(f.name ?? '').includes(`/${ENGINE_DIR}/`)
const hostOnlyResults = (report.testResults ?? []).filter(f => !isEngineFile(f))
const realSpecs = (report.testResults ?? []).length
const realHostSpecs = hostOnlyResults.length
const realCases = (report.testResults ?? []).reduce((acc, f) => acc + (f.assertionResults ?? []).length, 0)
const realHostCases = hostOnlyResults.reduce((acc, f) => acc + (f.assertionResults ?? []).length, 0)

const docFailures = []
for (const { rel, file } of DOC_FILES) {
  let text
  try {
    text = readFileSync(file, 'utf-8')
  } catch {
    continue
  }
  // 全量 N 个 spec / M 例
  for (const [, specs, cases] of text.matchAll(/全量 (\d+) 个 spec \/ (\d+) 例/g)) {
    if (Number(specs) !== realSpecs) docFailures.push(`${rel}: 写着「全量 ${specs} 个 spec」,实际 ${realSpecs} 个`)
    if (Number(cases) !== realCases) docFailures.push(`${rel}: 写着「全量 ${specs} 个 spec / ${cases} 例」,实际 ${realCases} 例`)
  }
  // 本作自己那部分 N 个 / M 例(同一行连着写)
  for (const [, specs, cases] of text.matchAll(/本作自己那部分 (\d+) 个 \/ (\d+) 例/g)) {
    if (Number(specs) !== realHostSpecs) docFailures.push(`${rel}: 写着「本作自己那部分 ${specs} 个 spec」,实际 ${realHostSpecs} 个`)
    if (Number(cases) !== realHostCases) docFailures.push(`${rel}: 写着「本作自己那部分 ${specs} 个 / ${cases} 例」,实际 ${realHostCases} 例`)
  }
}
if (docFailures.length > 0) {
  console.log('  ✗ 文档里的测试例数与本次运行对不上（加删用例后忘了同步文档）:')
  for (const f of docFailures) console.log(`      ${f}`)
}
console.log('')

/**
/**
 * 退出码的**原因**要写在最后一行。
 *
 * 起因是一次真实的困惑:报告印着"0 败",脚本却以 1 退出 —— 当时只当成了偶发,连着跑了几次
 * 全绿就搁下了。真正的机制是下面这第二条:**未分类也算失败**(漏登记的用例不计入任何一类,
 * 报告就少算了它)。把原因印出来,"0 败 + 退出 1" 这种组合以后再也不会被误读成 flake。
 */
const docFailure = docFailures.length > 0 ? `文档里的测试例数与本次运行对不上(${docFailures.length} 处)` : ''
const failureReason =
  totalFailed > 0
    ? `有用例失败或跳过(${totalFailed} 个)`
    : childExitCode !== 0
      ? `vitest 自身非零退出(码 ${childExitCode},可能是文件级报错)`
      : uncategorized > 0
        ? `有 ${uncategorized} 个用例没登记分类(报告会少算它们)`
        : docFailure
if (failureReason) console.log(`  退出码 1 的原因:${failureReason}\n`)
// 未分类也算失败:漏登记的用例不计入任何一类,报告便少算了它。
// 只提示不拦截的话,这个数会一路悄悄涨上去(曾积到 225 个才被发现)。
// childExitCode!==0 兜底:JSON 里没有 'failed' 条目的文件级报错也绝不假绿。
// 文档例数不符同样拦截:加删用例而不同步文档,等于把判据写进文档又拆掉。
process.exit(totalFailed > 0 || childExitCode !== 0 || uncategorized > 0 || docFailures.length > 0 ? 1 : 0)
