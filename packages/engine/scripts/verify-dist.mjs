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
import { existsSync, mkdtempSync, mkdirSync, readdirSync, renameSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'

const DIST = resolve(import.meta.dirname, '..', 'dist')
for (const entry of ['index.js', 'index.d.ts', 'presets/demo.js', 'presets/xiuxian.js']) {
  assert.ok(existsSync(resolve(DIST, entry)), `产物缺文件:dist/${entry} —— 先跑 bun run build`)
}

const engine = await import(resolve(DIST, 'index.js'))
const { DEMO } = await import(resolve(DIST, 'presets/demo.js'))
const { XIUXIAN } = await import(resolve(DIST, 'presets/xiuxian.js'))

// 装配 + 走一圈:光能 import 不够,导出得真的能用
const game = engine.defineGame(DEMO)
assert.equal(game.realms.label(0, 0), '见习船员 I 阶')
assert.equal(game.attributes.name('attack'), '火力')
const loot = game.equipment.generate(engine.createRng('verify'), { tier: 1 })
assert.ok(game.equipment.resolve(loot).template, '掉出来的装备应当能解析')
assert.equal(engine.defineGame(XIUXIAN).realms.realms.length, 21)

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

const consumerProbe = `
  const assert = (await import('node:assert/strict')).default
  const engine = await import('wanxiang-engine')
  const { DEMO } = await import('wanxiang-engine/presets/demo')
  const game = engine.defineGame(DEMO)
  assert.equal(game.realms.label(0, 0), '见习船员 I 阶')
  assert.equal(typeof engine.defineGame, 'function')
  console.log('   按包名 import 通过(含子路径内容包)')
`
execFileSync('node', ['--input-type=module', '-e', consumerProbe], { cwd: app, stdio: 'inherit' })
console.log(`发布包自检通过(${tgz} 装进临时项目后可用)`)
