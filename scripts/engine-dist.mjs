/**
 * 公共库产物自检 —— 「发得出去、别人装得上、装上真能跑」。
 *
 * 用例跑的是 src,这里跑的是 **dist**:先按 package.json 的发布口径编译,
 * 再从产物里 import(不经过仓库别名、不经过 src),用 demo 内容包走完整一圈。
 *
 * 为什么单独一条:用例全绿而产物是空壳/漏文件/导出对不上,是"公共库"最常见的翻车方式,
 * 而它恰好不会被任何 src 用例发现 —— 别人 npm 装下来才发现,那时已经晚了。
 *
 * 用法:`bun run check:engine`
 */
import { execFileSync } from 'node:child_process'
import { existsSync, openSync, readFileSync, readdirSync, mkdtempSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import assert from 'node:assert/strict'

const ROOT = resolve(import.meta.dirname, '..')
const PKG_DIR = resolve(ROOT, 'packages/engine')
const DIST = resolve(PKG_DIR, 'dist')

console.log('① 编译产物(tsc -p packages/engine/tsconfig.build.json)')
execFileSync('bunx', ['tsc', '-p', 'packages/engine/tsconfig.build.json'], { cwd: ROOT, stdio: 'inherit' })

console.log('② 校验 package.json 声明的入口都存在')
const pkg = JSON.parse(readFileSync(resolve(PKG_DIR, 'package.json'), 'utf8'))
const entries = [
  pkg.main,
  pkg.module,
  pkg.types,
  pkg.exports['.'].types,
  pkg.exports['.'].import,
  pkg.exports['./presets/xiuxian'].import,
  pkg.exports['./presets/demo'].import
]
for (const entry of entries) {
  assert.ok(entry, 'package.json 里少了一个入口声明')
  assert.ok(existsSync(resolve(PKG_DIR, entry)), `声明了却不存在:${entry}`)
}
console.log(`   ${entries.length} 个入口齐全`)

console.log('③ 从产物 import(不走仓库别名、不走 src;**用 node**,见下)')
/*
 * 这一步刻意用 node 而不是 bun:打包器与 bun 会宽容地解析无扩展名的相对导入,
 * 而 Node 的 ESM 解析器要求 `./x.js`。这个差别骗过过一次 —— dist 在 bun 里好好的,
 * 别人 `npm i` 之后 import 直接 ERR_MODULE_NOT_FOUND。故产物自检必须在 node 里跑。
 */
const nodeProbe = `
  const engine = await import(${JSON.stringify(resolve(DIST, 'index.js'))})
  const { DEMO } = await import(${JSON.stringify(resolve(DIST, 'presets/demo.js'))})
  const { XIUXIAN } = await import(${JSON.stringify(resolve(DIST, 'presets/xiuxian.js'))})
  const game = engine.defineGame(DEMO)
  if (game.realms.label(0, 0) !== '见习船员 I 阶') throw new Error('换皮世界没装起来')
  if (engine.defineGame(XIUXIAN).realms.realms.length !== 21) throw new Error('仙侠包没装起来')
  console.log('   node 侧 import 通过(导出 ' + Object.keys(engine).length + ' 个)')
`
execFileSync('node', ['--input-type=module', '-e', nodeProbe], { cwd: ROOT, stdio: 'inherit' })
const engine = await import(resolve(DIST, 'index.js'))
const { DEMO } = await import(resolve(DIST, 'presets/demo.js'))
const { XIUXIAN } = await import(resolve(DIST, 'presets/xiuxian.js'))

// 只写名字与内容就能装配出一个世界 —— 这是这个库存在的理由
const game = engine.defineGame(DEMO)
const rng = engine.createRng('dist-smoke')
assert.equal(game.realms.label(0, 0), '见习船员 I 阶')
assert.equal(game.attributes.name('attack'), '火力')
assert.ok(game.equipment.slots.length >= 4 && game.dungeons.regions.length >= 3)

// 修炼 → 进阶
let state = { major: 0, layer: 0, exp: 0 }
state = game.realms.addExp(state, Number(game.realms.expCost(0, 0)))
let step = game.realms.attemptBreakthrough(state, { rng, bonusRate: 1 })
for (let i = 0; i < 50 && !step.ok; i += 1) step = game.realms.attemptBreakthrough(state, { rng, bonusRate: 1 })
assert.equal(step.ok, true, '进阶应当成功(加成拉满)')

// 掉装 → 装配 → 结算
const loot = game.equipment.generate(rng, { tier: 1 })
const item = game.equipment.resolve(loot)
assert.ok(item.template, '掉出来的装备应当能在模板表里找到')
const loadout = game.equipment.equip({ equipped: {} }, loot)
const equipped = game.equipment.resolveLoadout(loadout, new Map([[loot.uid, loot]]))
const stats = game.attributes.compute({
  base: game.realms.baseStats(step.state.major, step.state.layer),
  flat: equipped.flats,
  modSources: [equipped.mods, item.mods]
})
assert.ok(Number(stats.final.maxHp) > 0, '结算后的生命上限应当为正')

// 打副本 → 通关拿奖励
const region = game.dungeons.firstRegion()
const encounter = game.dungeons.nextEncounter(region.id, engine.emptyProgress(), rng)
const foe = game.dungeons.snapshot(encounter.enemyId)
const battle = game.combat.resolve(
  {
    id: 'player',
    name: '玩家',
    stats: {
      hp: stats.final.maxHp,
      maxHp: stats.final.maxHp,
      attack: stats.final.attack,
      defense: stats.final.defense,
      speed: 1
    },
    mods: stats.mods
  },
  { id: foe.id, name: foe.name, stats: foe.stats, mods: foe.mods, skills: foe.skills },
  rng
)
assert.ok(Number.isFinite(Number(battle.playerHp)), '战斗结果应当是有限数')
const outcome = game.dungeons.onVictory(region.id, { ...encounter, kind: 'boss' }, engine.emptyProgress(), rng)
assert.equal(outcome.firstClear, true)
assert.ok(outcome.progress.cleared.includes(region.id))

// 交叉校验真的会挡人:引用不存在的敌人应当抛错并指名道姓
const broken = { ...DEMO, dungeons: { ...DEMO.dungeons, regions: [{ ...DEMO.dungeons.regions[0], enemies: ['不存在的敌人'] }] } }
assert.throws(() => engine.defineGame(broken), /DUNGEON_REGION_ENEMY/, '坏配置应当被交叉校验挡住')

// 仙侠包也要能从产物里装配起来
const xian = engine.defineGame(XIUXIAN)
assert.equal(xian.realms.realms.length, 21)

console.log('④ 换皮世界跑通:修炼 → 进阶 → 掉装 → 装配 → 副本 → 通关奖励')

console.log('⑤ 校验发布包内容(npm pack --dry-run,离线可跑)')
// npm 默认把缓存写在 ~/.npm;沙箱/CI 里那可能是只读的,故显式指向临时目录
const npmCache = mkdtempSync(resolve(tmpdir(), 'wanxiang-pack-'))
// 输出落到文件而不是管道:npm 在部分环境(mise 安装的 node / 非 TTY)下
// 往管道写 --json 会静默给出空串,而重定向到文件是稳的
const packJson = resolve(npmCache, 'pack.json')
execFileSync('npm', ['pack', '--dry-run', '--json'], {
  cwd: PKG_DIR,
  env: { ...process.env, npm_config_cache: npmCache },
  stdio: ['ignore', openSync(packJson, 'w'), 'inherit']
})
const pack = JSON.parse(readFileSync(packJson, 'utf8'))[0]
const shipped = pack.files.map(f => f.path)
for (const required of ['dist/index.js', 'dist/index.d.ts', 'dist/presets/demo.js', 'README.md', 'LICENSE', 'package.json']) {
  assert.ok(shipped.includes(required), `发布包里少了 ${required}(实际:${shipped.slice(0, 8).join(', ')}…)`)
}
assert.ok(
  !shipped.some(p => p.startsWith('src/')),
  '发布包里混进了源码目录 —— 对外只该发 dist 与说明'
)
console.log(`   ${shipped.length} 个文件 · 打包 ${(pack.size / 1024).toFixed(1)} KB / 展开 ${((pack.unpackedSize ?? 0) / 1024).toFixed(1)} KB`)

console.log('⑥ 宿主只经公开入口引用库(不许别名复活、不许深层路径)')
const APP_SRC = resolve(ROOT, 'src')
const appFiles = []
const walk = dir => {
  for (const name of readdirSync(dir)) {
    const full = resolve(dir, name)
    if (statSync(full).isDirectory()) walk(full)
    else if (full.endsWith('.ts') || full.endsWith('.vue')) appFiles.push(full)
  }
}
walk(APP_SRC)
const aliasUsers = []
const deepUsers = []
let byName = 0
for (const file of appFiles) {
  const text = readFileSync(file, 'utf8')
  if (/from '@engine/.test(text)) aliasUsers.push(file.replace(ROOT + '/', ''))
  if (/from 'wanxiang-engine\//.test(text)) deepUsers.push(file.replace(ROOT + '/', ''))
  byName += (text.match(/from 'wanxiang-engine'/g) ?? []).length
}
assert.deepEqual(aliasUsers, [], `这些文件还在用仓库内部别名 @engine:${aliasUsers.join('、')}`)
assert.deepEqual(deepUsers, [], `这些文件绕过了公开入口(深层导入):${deepUsers.join('、')}`)
assert.ok(byName > 0, '宿主一处都没引用库?那这份自检在验什么')
console.log(`   ${byName} 处引用全部走公开入口 'wanxiang-engine'`)

console.log(`产物自检通过:${entries.length} 个入口 + 两份内容包 + 交叉校验 + 发布包内容 + 宿主引用方式`)
