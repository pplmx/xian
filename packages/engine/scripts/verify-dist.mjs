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
import { existsSync, mkdtempSync, mkdirSync, readdirSync, readFileSync, renameSync } from 'node:fs'
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
`
execFileSync('node', ['--input-type=module', '-e', consumerProbe], { cwd: app, stdio: 'inherit' })
console.log(`发布包自检通过(${tgz} 装进临时项目后可用)`)
