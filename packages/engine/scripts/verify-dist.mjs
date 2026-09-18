/**
 * 产物自检(Node 视角)。
 *
 * 为什么必须是 **node** 而不是 bun/vite:打包器与 bun 会宽容地解析无扩展名的相对导入
 * (`from './numeric'`),而 Node 的 ESM 解析器不会 —— 它要求 `./numeric.js`。
 * 这个差别骗过过一次 CI:dist 在 bun 里跑得好好的,别人 `npm i` 之后 `import` 直接报
 * ERR_MODULE_NOT_FOUND。故这一步用 node 跑,把"别人那边到底能不能 import"钉死。
 *
 * 第二段更进一步:**按使用者的方式来**。前面是按路径 import 本地 dist,那还只是
 * "产物里的文件能被读到";真正会翻车的是发布口径 —— `files` 少收了东西、`exports`
 * 指错、包名解析不到子路径。所以这里真的 `npm pack` 一次,把 tarball 摊进一个临时
 * 项目的 `node_modules/`,再从那个项目里 `import 'wanxiang-engine'`(以及它的内容包
 * 子路径),这才叫"别人装得上、装上真能用"。
 *
 * 用法:`node scripts/verify-dist.mjs`(已挂在 `bun run check` 末尾)
 */
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'

const ENGINE = resolve(import.meta.dirname, '..')
const DIST = resolve(ENGINE, 'dist')
for (const entry of ['index.js', 'index.d.ts', 'presets/demo.js', 'presets/xiuxian.js', 'presets/daily.js']) {
  assert.ok(existsSync(resolve(DIST, entry)), `产物缺文件:dist/${entry} —— 先跑 bun run build`)
}

const engine = await import(resolve(DIST, 'index.js'))
const { DEMO } = await import(resolve(DIST, 'presets/demo.js'))
const { XIUXIAN } = await import(resolve(DIST, 'presets/xiuxian.js'))
const { DAILY } = await import(resolve(DIST, 'presets/daily.js'))

/**
 * 组装指南自检 —— 文档里的每个 `create*` 与每个示例文件都必须真实存在。
 *
 * 为什么值得一条判据:指南是"照着抄"的东西,而文档最典型的腐烂方式就是**指向一个已经不存在的
 * 模块**(拆了、改名了、还没写),抄的人会先怀疑自己。这里把"提到的都得有"变成机器判据。
 */
{
  const doc = readFileSync(resolve(ENGINE, 'docs/assembly.md'), 'utf-8')
  const factories = new Set([...doc.matchAll(/`(create[A-Z]\w*)`/g)].map(m => m[1]))
  assert.ok(factories.size >= 8, '组装指南里应当指向足够多的模块(至少 8 个 create*)')
  for (const name of factories) {
    assert.ok(name in engine, `组装指南提到 ${name},但公开入口没有这个导出`)
  }
  const plainApis = new Set(
    [...doc.matchAll(/`(evalGoal|goalProgress|planIdle|runIdle|drawFrom|drawMany|snapshotOf|deltaSince|accrue|defineGame|defineSaveFormat|asRecord|composeCraftRate|softChance)`/g)].map(
      m => m[1]
    )
  )
  for (const name of plainApis) {
    assert.ok(name in engine, `组装指南提到 ${name},但公开入口没有这个导出`)
  }
  for (const [, example] of doc.matchAll(/(examples\/[\w.-]+\.ts)/g)) {
    assert.ok(existsSync(resolve(ENGINE, example)), `组装指南提到的示例不存在:${example}`)
  }
  for (const [, spec] of doc.matchAll(/`(\w+\.spec\.ts)`/g)) {
    // 用例可能在子目录里(如 presets/presets.spec.ts):按文件名整棵树找
    const found = readdirSync(resolve(ENGINE, 'src'), { recursive: true, encoding: 'utf-8' }).some(
      entry => typeof entry === 'string' && entry.endsWith(spec)
    )
    assert.ok(found, `组装指南提到的用例不存在:${spec}`)
  }
  console.log(`组装指南自检通过(${factories.size} 个工厂 + ${plainApis.size} 个工具 + 示例与用例路径)`)

  /**
   * 定制表自检 —— 「想改什么,改哪里」里,凡是**公开导出**的名字,都得有用例提到过。
   *
   * 为什么值得一条判据:那张表是使用者最先读的东西,也最容易"说得比做得多" —— 承诺"这个可以
   * 接管",但库里没有任何判据钉住它。这里不判断覆盖得好不好(那要看人),只拦最硬的一种:
   * **说了能改、却没有任何用例碰过**。
   *
   * 表原先住在 README,后来整节搬进 `docs/usage.md`(README 只留摘要与指针)—— 搬到哪儿,这条
   * 判据就跟到哪儿:文档可以挪,承诺不许丢。
   */
  const usage = readFileSync(resolve(ENGINE, 'docs/usage.md'), 'utf-8')
  const specDir = resolve(ENGINE, 'src')
  const specText = readdirSync(specDir, { recursive: true, encoding: 'utf-8' })
    .filter(entry => typeof entry === 'string' && entry.endsWith('.spec.ts'))
    .map(entry => readFileSync(resolve(specDir, entry), 'utf-8'))
    .join('\n')
  const tableStart = usage.indexOf('## 定制:想改什么,改哪里')
  assert.ok(tableStart >= 0, 'docs/usage.md 里找不到「定制:想改什么,改哪里」这一节')
  const tableEnd = usage.indexOf('\n## ', tableStart + 5)
  const table = usage.slice(tableStart, tableEnd)
  /**
   * 取每个反引号片段里最后一个标识符片段:`equipment.affixCountFn` → `affixCountFn`,
   * `'max'` 这类字面量会被跳过(不以字母开头)。
   */
  const promised = [
    ...new Set(
      [...table.matchAll(/`([^`]+)`/g)]
        .map(m => m[1].split('.').pop().trim())
        .filter(name => /^[A-Za-z_]\w*$/.test(name))
    )
  ]
  // 防空转:标题被改掉、正则失配时,这份自检会"通过"得毫无意义
  assert.ok(promised.length >= 40, `定制表只读出 ${promised.length} 个名字 —— 标题或表格结构变了?`)
  const unpinned = promised.filter(name => !specText.includes(name))
  assert.deepEqual(unpinned, [], `定制表承诺可改、却没有任何用例提到:${unpinned.join('、')}`)
  console.log(`定制表自检通过(${promised.length} 个名字,逐个都有用例提到)`)

  /**
   * 目录树自检 —— README 里那棵树是使用者的地图,它必须**和仓库逐项对得上**。
   *
   * 两边都拦:新加一个模块却忘了写进树(地图少一块,读者以为库里没有这层),
   * 或者改了名/删了文件却没改树(地图指向不存在的路,照着找的人先怀疑自己)。
   * 树上的文档清单同理 —— `docs/` 下每份文档都得在地图上。
   */
  const readme = readFileSync(resolve(ENGINE, 'README.md'), 'utf-8')
  const treeBlock = readme.match(/```\n(packages\/engine\/[\s\S]*?)```/)
  assert.ok(treeBlock, 'README 里找不到 packages/engine/ 的目录树代码块')
  const tree = treeBlock[1]
  const listedModules = [...tree.matchAll(/^ {4}([A-Za-z]\w*)\.ts\b/gm)].map(m => m[1])
  const actualModules = readdirSync(resolve(ENGINE, 'src'))
    .filter(name => name.endsWith('.ts') && !name.endsWith('.spec.ts'))
    .map(name => name.replace(/\.ts$/, ''))
  assert.deepEqual(
    [...listedModules].sort(),
    [...actualModules].sort(),
    'README 的目录树与 src/ 下的模块文件对不上(少列了模块,或列了不存在的文件)'
  )
  const listedDocs = [...tree.matchAll(/(\w+)\.md/g)].map(m => m[1])
  const actualDocs = readdirSync(resolve(ENGINE, 'docs')).map(name => name.replace(/\.md$/, ''))
  for (const doc of actualDocs) {
    assert.ok(listedDocs.includes(doc), `README 的目录树里没有列 docs/${doc}.md`)
  }
  console.log(`目录树自检通过(${listedModules.length} 个模块文件 + ${actualDocs.length} 份文档都在图上)`)

  /**
   * 用例数自检 —— README 里那行"N 个用例 / M 个文件",文件数不许写错。
   *
   * 用例数每次加用例都会变,人工同步迟早会漏;但**文件数**是静态可数的,盯住它就能拦住
   * 最常见的那种漂移(加了新 spec 文件但没改 README)。用例数仍靠人写,写的时候顺手跑一次
   * `bun run test` 核对 —— 这条自检只保证"分母没写错"。
   */
  const specFiles = readdirSync(resolve(ENGINE, 'src'), { recursive: true, encoding: 'utf-8' }).filter(
    entry => typeof entry === 'string' && entry.endsWith('.spec.ts')
  ).length
  const countRow = readme.match(/(\d+) 个用例 \/ (\d+) 个文件/)
  assert.ok(countRow, 'README 的判据表里找不到"用例 / 文件"那一行')
  assert.equal(Number(countRow[2]), specFiles, `README 写的用例文件数与实际不符(实际 ${specFiles} 个)`)
  console.log(`用例数自检通过(README 写的 ${countRow[2]} 个用例文件与实际一致)`)

  /**
   * 调参参考自检 —— `docs/tuning.md` 必须**收全**每一份消融实验。
   *
   * 消融实验的价值在于"量出来的数字有人看得到";新加一份却忘了收进参考表,就等于白量。
   * 这条自检反向掐住它:凡是 `src/*.sim.spec.ts`,参考表里必须点名一份(顺带保证点到的文件存在)。
   */
  const tuning = readFileSync(resolve(ENGINE, 'docs/tuning.md'), 'utf-8')
  const simSpecs = readdirSync(resolve(ENGINE, 'src'))
    .filter(name => name.endsWith('.sim.spec.ts'))
    .sort()
  assert.ok(simSpecs.length >= 4, `消融实验只有 ${simSpecs.length} 份 —— 目录或命名变了?`)
  const missing = simSpecs.filter(name => !tuning.includes(name))
  assert.deepEqual(missing, [], `这些消融实验还没收进 docs/tuning.md:${missing.join('、')}`)
  for (const [, spec] of tuning.matchAll(/`(src\/\w+\.sim\.spec\.ts)`/g)) {
    assert.ok(simSpecs.includes(spec.replace('src/', '')), `调参参考指向了不存在的用例:${spec}`)
  }
  console.log(`调参参考自检通过(${simSpecs.length} 份消融实验都被收进 docs/tuning.md)`)

  /**
   * 相对导入自检 —— 源码里的相对导入必须带 `.js` 扩展名。
   *
   * 为什么这条值得单独立判据:它只在**产物**里现形,而且只对一类使用者现形 ——
   * `moduleResolution: node16 / nodenext` 的人。TS 会把源码的导入原样搬进 `.d.ts`,
   * 少一个 `.js`,`skipLibCheck: false` 的消费者就一编译就红(TS2835),
   * 而发版这边一切正常(库自己的构建与用例都过得去)。
   * 这次就是这么发现的:`companions.ts` 里一句 `from './attributes'` 漏了扩展名。
   */
  const srcFiles = readdirSync(resolve(ENGINE, 'src'), { recursive: true, encoding: 'utf-8' }).filter(
    entry => typeof entry === 'string' && entry.endsWith('.ts')
  )
  const badSpecs = []
  for (const file of srcFiles) {
    const text = readFileSync(resolve(ENGINE, 'src', file), 'utf-8')
    for (const [, spec] of text.matchAll(/from\s+'(\.[^']*)'/g)) {
      if (!spec.endsWith('.js')) badSpecs.push(`${file} → ${spec}`)
    }
  }
  assert.deepEqual(badSpecs, [], `这些相对导入少了 .js 扩展名(消费者用 node16 解析时会红):${badSpecs.join('、')}`)
  console.log(`相对导入自检通过(${srcFiles.length} 个源文件里的相对导入都带 .js)`)

  /**
   * 公开面行为判据自检 —— **每个运行时导出都得有人真用过**。
   *
   * 公开面清单(`publicApi.spec.ts`)只回答"名字还在不在",回答不了"这个名字背后的行为有没有人试过":
   * 改名会红,但边界写错不会。这次审计就是冲着这个缝来的 —— 75 个导出里有 9 个
   * (`clamp` / `formatAmount` / `numberNumeric` / `mulberry32` / `seedFromString` / `randomRng` /
   * `DEFAULT_ATTRIBUTES` / `DEFAULT_LAYER_NAMES` / `progressText`)从没被任何用例或示例碰过,
   * 只在名字清单里露过面。现在它们各有一条判据(`src/publicBehavior.spec.ts`),
   * 而这条自检负责让"下回再冒出一个"的当场红。
   *
   * 扫的是**去掉注释**之后的用例与示例正文(排除只罗列名字的 `publicApi.spec.ts`),
   * 所以"在注释里提了一句"不算用过。
   */
  /**
   * 去掉注释、import 行与字符串字面量:只留**代码位置上的标识符**。
   *
   * 为什么要做到这么细:一条 `import { clamp } from './numeric.js'`、一句测试标题里提到名字、
   * 或者文档字符串里写过它 —— 这三种都不等于"有人真用过",而它们都能骗过朴素的包含判断。
   * 去掉之后仍能匹配到,才是真的在调用/引用。
   */
  const stripComments = text =>
    text
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/[^\n]*/g, '')
      .replace(/^\s*import[\s\S]*?from\s*'[^']*'/gm, '')
      .replace(/^\s*import\s*'[^']*'/gm, '')
      .replace(/'(?:[^'\\]|\\.)*'/g, "''")
      .replace(/"(?:[^"\\]|\\.)*"/g, '""')
      .replace(/`(?:[^`\\]|\\.)*`/g, '``')
  const usageText = [
    ...readdirSync(resolve(ENGINE, 'src'))
      .filter(name => name.endsWith('.spec.ts') && name !== 'publicApi.spec.ts')
      .map(name => stripComments(readFileSync(resolve(ENGINE, 'src', name), 'utf-8'))),
    ...readdirSync(resolve(ENGINE, 'examples'))
      .filter(name => name.endsWith('.ts'))
      .map(name => stripComments(readFileSync(resolve(ENGINE, 'examples', name), 'utf-8')))
  ].join('\n')
  const exportNames = Object.keys(engine)
  const unusedExports = exportNames.filter(name => !new RegExp(`\\b${name}\\b`).test(usageText))
  assert.deepEqual(
    unusedExports,
    [],
    `这些导出没有任何行为性用例或示例用过(只出现在 publicApi.spec 的名字清单里):${unusedExports.join('、')}`
  )
  console.log(`公开面行为判据自检通过(${exportNames.length} 个导出都有人真用过)`)

  /**
   * 模块速查覆盖自检 —— 每个模块文件都得在 `docs/usage.md` 的模块表里找得到。
   *
   * 这份表是使用者"要找某一层时"的入口:新加一个模块却忘了写进去,等于这层不存在
   * (只在地图的目录树里露脸,没有"它回答什么问题"那一行)。锚点用**中文主题或代表入口**
   * 写成一张显式的表 —— 因为好些模块是通过 `game.*` 用的,不是靠 `create*` 名字找。
   */
  const MODULE_ANCHORS = {
    'realms.ts': 'game.realms',
    'attributes.ts': 'game.attributes',
    'rng.ts': 'mulberry32',
    'equipment.ts': 'game.equipment',
    'holding.ts': 'createHoldingSystem',
    'dungeons.ts': 'game.dungeons',
    'combat.ts': 'game.combat',
    'skills.ts': 'createSkillSystem',
    'crafting.ts': 'composeCraftRate',
    'recipes.ts': 'createRecipeRunner',
    'goals.ts': 'evalGoal',
    'deck.ts': 'drawFrom',
    'companions.ts': 'createCompanionSystem',
    'idle.ts': 'planIdle',
    'save.ts': 'defineSaveFormat',
    'saveShape.ts': 'asRecord',
    'numeric.ts': 'Numeric<T>',
    'config.ts': 'defineGame',
    'resources.ts': 'createResourceSystem',
    'triage.ts': 'createTriage',
    'cycles.ts': 'createCycleSystem',
    'choices.ts': 'createChoiceSystem',
    'codex.ts': 'createCodex',
    'memory.ts': 'createStageMemory',
    'economy.ts': 'createEconomyReadings',
    'intake.ts': 'createIntake',
    'settlement.ts': 'createSettlement',
    'drops.ts': 'createDropTable',
    'buffs.ts': 'createBuffSystem',
    'facilities.ts': 'createFacilitySystem',
    'points.ts': 'createPointPool',
    'tasks.ts': 'createTaskBoard',
    'counters.ts': 'snapshotOf',
    'chain.ts': 'createChain',
    'pity.ts': 'createPityCounter',
    'unlocks.ts': 'createUnlockRegistry',
    'presets/': '内容包'
  }
  const moduleFiles = readdirSync(resolve(ENGINE, 'src'), { recursive: true, encoding: 'utf-8' }).filter(
    entry => typeof entry === 'string' && (entry.endsWith('.ts') || entry.endsWith('/')) && !entry.endsWith('.spec.ts')
  )
  const uncovered = Object.entries(MODULE_ANCHORS).filter(([, anchor]) => !usage.includes(anchor)).map(([file]) => file)
  assert.deepEqual(uncovered, [], `这些模块没有出现在 docs/usage.md 的模块表里:${uncovered.join('、')}`)
  assert.ok(uncovered.length === 0 && Object.keys(MODULE_ANCHORS).length >= 36, '模块锚点表少写了一项?')
  // 反向:锚点表里的模块文件必须真实存在(改了名/删了文件时要跟着改)
  for (const file of Object.keys(MODULE_ANCHORS)) {
    const exists = moduleFiles.some(entry => entry === file || entry.startsWith(file))
    assert.ok(exists, `模块锚点表里写了不存在的模块:${file}`)
  }
  console.log(`模块速查覆盖自检通过(${Object.keys(MODULE_ANCHORS).length} 个模块都在 docs/usage.md 里)`)
}

// 装配 + 走一圈:光能 import 不够,导出得真的能用
const game = engine.defineGame(DEMO)
assert.equal(game.realms.label(0, 0), '见习船员 I 阶')
assert.equal(game.attributes.name('attack'), '火力')
const loot = game.equipment.generate(engine.createRng('verify'), { tier: 1 })
assert.ok(game.equipment.resolve(loot).template, '掉出来的装备应当能解析')
assert.equal(engine.defineGame(XIUXIAN).realms.realms.length, 21)

// 第三个题材(与战斗/修仙都无关的那份)也要能装起来走一圈 —— 通用性不是"两份预设恰好像",
// 而是"没有任何战斗世界观的题材,同一套内核照样跑完升级 → 掉装备 → 遭遇 → 通关结算"。
{
  const game = engine.defineGame(DAILY)
  assert.equal(game.realms.label(0, 0), '启蒙班·第一周')
  assert.equal(game.attributes.name('attack'), '专注力')
  const rng = engine.createRng('书桌')
  const state = game.realms.addExp({ major: 0, layer: 0, exp: 0 }, Number(game.realms.expCost(0, 0)))
  assert.equal(game.realms.progress(state).ready, true)
  const loot = game.equipment.generate(rng, { tier: 1 })
  const resolved = game.equipment.resolve(loot)
  assert.ok(resolved.template, '掉出来的文具应当能解析')
  const loadout = game.equipment.equip({ equipped: {} }, loot)
  const equipped = game.equipment.resolveLoadout(loadout, new Map([[loot.uid, loot]]))
  const stats = game.attributes.compute({
    base: game.realms.baseStats(0, 0),
    flat: equipped.flats,
    modSources: [equipped.mods, resolved.mods]
  })
  const region = game.dungeons.firstRegion()
  assert.equal(region.name, '图书馆')
  const encounter = game.dungeons.nextEncounter(region.id, engine.emptyProgress(), rng)
  const foe = game.dungeons.snapshot(encounter.enemyId)
  const battle = game.combat.resolve(
    {
      id: 'me',
      name: '我',
      stats: {
        hp: stats.final.maxHp ?? 0,
        maxHp: stats.final.maxHp ?? 0,
        attack: stats.final.attack ?? 0,
        defense: stats.final.defense ?? 0,
        speed: 1
      },
      mods: stats.mods
    },
    { id: foe.id, name: foe.name, stats: foe.stats, mods: foe.mods, skills: foe.skills },
    rng
  )
  assert.ok(battle.events.length > 0, '这一场得有过程')
  const outcome = game.dungeons.onVictory(region.id, { ...encounter, kind: 'boss' }, engine.emptyProgress(), rng)
  assert.equal(outcome.firstClear, true)
  assert.ok(outcome.rewards.length > 0, '通关要给点东西(哪怕是"理解"与零花钱)')
}

console.log(`Node 产物自检通过(dist 可被 node ESM 直接 import:${Object.keys(engine).length} 个导出)`)

// —— 使用者那一侧:装发布包,按包名 import ——
// npm 的缓存默认落 ~/.npm(沙箱/CI 里可能只读),故显式指向临时目录
const work = mkdtempSync(resolve(tmpdir(), 'wanxiang-install-'))
const cache = resolve(work, 'npm-cache')
const tarballDir = resolve(work, 'tarball')
mkdirSync(tarballDir, { recursive: true })
// --silent:npm 默认把整份文件清单当 notice 打到 stderr,刷屏;失败时它照样以非零码退出
execFileSync('npm', ['pack', '--silent', '--pack-destination', tarballDir], {
  cwd: resolve(import.meta.dirname, '..'),
  env: { ...process.env, npm_config_cache: cache },
  stdio: ['ignore', 'ignore', 'inherit']
})
const tgz = readdirSync(tarballDir).find(name => name.endsWith('.tgz'))
assert.ok(tgz, 'npm pack 没有产出 tarball')

// tarball 里是 package/ 一层,摊开成 node_modules/wanxiang-engine —— 与使用者装完的样子一致
const app = resolve(work, 'app')
const nm = resolve(app, 'node_modules')
mkdirSync(nm, { recursive: true })
execFileSync('tar', ['-xzf', resolve(tarballDir, tgz), '-C', nm], { stdio: 'inherit' })
renameSync(resolve(nm, 'package'), resolve(nm, 'wanxiang-engine'))

// 发布包里该有什么:产物 + 说明 + 变更记录 + 文档。少一样,使用者就只拿到半个包。
const installed = resolve(nm, 'wanxiang-engine')
for (const required of [
  'dist/index.js',
  'dist/index.d.ts',
  'dist/presets/daily.js',
  'package.json',
  'README.md',
  'CHANGELOG.md',
  'LICENSE',
  'docs/usage.md',
  'docs/assembly.md',
  'docs/tuning.md',
  'docs/parity.md',
  'docs/development.md'
]) {
  assert.ok(existsSync(resolve(installed, required)), `发布包里少了 ${required}`)
}
assert.ok(!existsSync(resolve(installed, 'src')), '发布包里混进了源码目录 —— 对外只该发 dist 与说明')

const consumerProbe = `
  const assert = (await import('node:assert/strict')).default
  const engine = await import('wanxiang-engine')
  const { DEMO } = await import('wanxiang-engine/presets/demo')
  const { DAILY } = await import('wanxiang-engine/presets/daily')
  const game = engine.defineGame(DEMO)
  assert.equal(game.realms.label(0, 0), '见习船员 I 阶')
  assert.equal(engine.defineGame(DAILY).realms.label(8, 5), '高三·期末')
  assert.equal(typeof engine.defineGame, 'function')
  console.log('   按包名 import 通过(含两份子路径内容包)')

  /**
   * 从零装一个世界 —— **不碰任何内容包**,只用包名导出的东西装配一份新题材。
   *
   * 这一段的用意:前面两项验的是"包里带的东西能用",这一段验的是"**别人自己写一份也能用**"。
   * 内容包是样例,真正要证明的是"槽位/品质/词条/区域/敌人都是内容,写一份就有一款游戏"。
   */
  const SLOTS = [
    { id: 'weapon', name: '靴子', order: 1 },
    { id: 'body', name: '邮包', order: 2 }
  ]
  const mine = engine.defineGame({
    name: '边境邮差(发布包冷启动)',
    attributes: { defs: engine.attributeDefs({ rename: { attack: '脚力', defense: '耐力', maxHp: '体力' } }) },
    realms: {
      worlds: [{ id: 'plain', name: '平原路', realms: ['送信学徒', '熟路邮差'] }],
      layerNames: ['第一段', '第二段'],
      labelFormat: '{realm}·{layer}',
      exp: { base: 25, realmGrowth: 5, layerGrowth: 1.3, worldStepMult: 1.9 },
      combat: { base: { attack: 11, defense: 6, maxHp: 110 }, realmGrowth: 3.2, layerGrowth: 1.12 },
      breakthrough: { layerBase: 0.94, layerDecay: 0.04, majorBase: 0.72, majorDecay: 0.07, min: 0.2, max: 0.98 }
    },
    equipment: {
      slots: SLOTS,
      qualities: [{ id: 'cloth', name: '粗布', rank: 0, mult: 1, affixes: [0, 1], fromTier: 1, toTier: 8, weight: 300 }],
      templates: engine.generateTemplates({
        slots: SLOTS,
        baseBySlot: { weapon: { attack: 5 }, body: { defense: 4, maxHp: 16 } },
        tiers: [['旧布鞋', '帆布邮包'], ['量脚皮靴', '防水邮包']]
      }),
      affixes: [{ id: 'swift', name: '疾行', key: 'attackPct', min: 3, max: 8, weight: 100, desc: '脚力提升 {v}%' }],
      power: { tierGrowth: 2, baseFactor: 0.6, qualityExponent: 1.6 },
      affixValueScale: 100
    },
    dungeons: {
      regions: [{ id: 'plainroad', name: '平原官道', tier: 1, minRealm: 0, enemies: ['mud'], boss: 'flooded' }],
      enemies: [
        { id: 'mud', name: '烂泥路', tier: 1, hpMult: 1, atkMult: 1, defMult: 1, speed: 1 },
        { id: 'flooded', name: '冲垮的桥', tier: 1, hpMult: 3, atkMult: 1.25, defMult: 1.2, speed: 1, boss: true }
      ],
      bossProgress: 2,
      bossRhythm: 'once',
      enemyPower: { baseHp: 110, baseAttack: 11, baseDefense: 6, tierGrowth: 2.05 },
      victoryRewards: [{ id: 'money', name: '报酬', base: 6, tierGrowth: 1.6 }]
    }
  })

  assert.equal(mine.attributes.name('attack'), '脚力')
  assert.equal(mine.realms.label(0, 0), '送信学徒·第一段')
  assert.equal(mine.equipment.slots.length, 2)
  const rng = engine.createRng('边境邮差')
  let state = { major: 0, layer: 0, exp: 0 }
  state = mine.realms.addExp(state, Number(mine.realms.expCost(0, 0)))
  const item = mine.equipment.generate(rng, { tier: 1 })
  assert.ok(mine.equipment.resolve(item).template, '自己写的模板应当能解析')
  let progress = engine.emptyProgress()
  let cleared = false
  for (let i = 0; i < 4 && !cleared; i += 1) {
    const encounter = mine.dungeons.nextEncounter('plainroad', progress, rng)
    const outcome = mine.dungeons.onVictory('plainroad', encounter, progress, rng)
    progress = outcome.progress
    cleared = cleared || outcome.firstClear
  }
  assert.equal(cleared, true, '自己写的区域应当能通关')
  assert.ok(progress.cleared.includes('plainroad'))
  console.log('   从零装配通过(不引用任何内容包:自己写槽位/品质/词条/区域/敌人,跑通修炼 → 掉装 → 通关)')
 `
execFileSync('node', ['--input-type=module', '-e', consumerProbe], { cwd: app, stdio: 'inherit' })

/**
 * 类型消费者自检 —— 使用者那边 `tsc --strict` 能不能过。
 *
 * 为什么还要这一步:运行时 import 成功只证明"装上能跑",而 TypeScript 使用者的第一道坎是
 * `types` / `exports.types` 指向的文件能不能被解析、`.d.ts` 是不是自洽(泛型默认值、再导出、
 * 子路径类型)。这些错了,包能跑但一编译就红 —— 而且只在**使用者**那边红,发版的人看不见。
 * 所以这里真造一个 `.mts` 消费者,用严格模式 + 两种 moduleResolution 各编一遍。
 */
const tsc = resolve(ENGINE, 'node_modules/typescript/bin/tsc')
if (existsSync(tsc)) {
  writeFileSync(
    resolve(app, 'probe.mts'),
    `
import { createRng, defineGame, planIdle, createDropTable, type IdlePlan, type Rng } from 'wanxiang-engine'
import { DEMO } from 'wanxiang-engine/presets/demo'
import { DAILY } from 'wanxiang-engine/presets/daily'
import { XIUXIAN } from 'wanxiang-engine/presets/xiuxian'

const rng: Rng = createRng('类型探针')
const plan: IdlePlan = planIdle(8 * 3600_000, { stepMs: 3600_000, capMs: 6 * 3600_000 })
const table = createDropTable([{ key: 'page', chance: 0.12, count: [1, 2] }])
const hits: number = table.roll(rng, { chanceMult: 2 }).reduce((sum, hit) => sum + hit.count, 0)
const games = [DEMO, DAILY, XIUXIAN].map(config => defineGame(config))
export const probe = { plan, hits, worlds: games.map(g => g.realms.realms.length) }
`
  )
  for (const [label, moduleResolution] of [
    ['bundler', 'bundler'],
    ['node16', 'node16']
  ]) {
    execFileSync(
      'node',
      [
        tsc,
        '--noEmit',
        '--strict',
        '--target',
        'es2022',
        '--module',
        moduleResolution === 'node16' ? 'node16' : 'esnext',
        '--moduleResolution',
        moduleResolution,
        '--skipLibCheck',
        'false',
        resolve(app, 'probe.mts')
      ],
      { cwd: app, stdio: 'inherit' }
    )
    console.log(`   使用者的 tsc --strict 通过(moduleResolution: ${label})`)
  }

  /**
   * 文档片段自检 —— 文档里那些"自称完整"的代码块,必须能对着**发布包**编译过。
   *
   * 文档腐烂最常见的方式不是写错字,而是**片段停在两个版本前**:库改了名字、调了签名,
   * 示例还照旧 —— 而读者是照着抄的人。约定:块前面一行写 `<!-- compile-check -->`
   * (可以带一句说明),自检就把它抽出来当 `.mts` 编一遍。没标的不查 ——
   * 很多片段本来就是节选(中间写着省略号),硬查只会逼着文档写废话。
   */
  const docSources = ['README.md', ...readdirSync(resolve(ENGINE, 'docs')).map(name => `docs/${name}`)]
  let checkedBlocks = 0
  for (const rel of docSources) {
    const text = readFileSync(resolve(ENGINE, rel), 'utf-8')
    const marked = [...text.matchAll(/<!-- compile-check[^>]*-->\s*\n```(?:ts|typescript)\n([\s\S]*?)^```$/gm)]
    for (const [index, block] of marked.entries()) {
      const file = resolve(app, `doc-${rel.replace(/\W+/g, '-')}-${index}.mts`)
      writeFileSync(file, block[1])
      execFileSync(
        'node',
        [tsc, '--noEmit', '--strict', '--target', 'es2022', '--module', 'esnext', '--moduleResolution', 'bundler', '--skipLibCheck', 'false', file],
        { cwd: app, stdio: 'inherit' }
      )
      checkedBlocks += 1
    }
  }
  assert.ok(checkedBlocks >= 1, '文档里一个 compile-check 片段都没有?约定被删了?')
  console.log(`   文档片段编译通过(${checkedBlocks} 段标了 compile-check 的代码块都对着发布包编过)`)
} else {
  console.log('   (跳过类型消费者自检:本地没有 typescript —— 先 bun install)')
}

console.log(`发布包自检通过(${tgz} 装进临时项目后可用 · 含使用者侧的 tsc 严格模式)`)
