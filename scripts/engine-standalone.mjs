/**
 * 「这个库能不能单独成 repo」的机械判据。
 *
 * 把 packages/engine **整份复制到临时目录**,只带上依赖(用仓库现有的 node_modules
 * 软链过去,免得联网),然后在那个目录里跑:
 *
 *   ① tsc -p tsconfig.build.json    —— 能不能独立编译出 dist
 *   ② vitest run                    —— 自己的用例能不能独立跑(不借宿主仓库的配置)
 *   ③ 源码里不许出现宿主引用         —— `@/`、`../../` 越界、对宿主 src 的 import
 *
 * 为什么值得单列一条:只要还有一处"顺手用了宿主的别名或配置",搬出去就会散架 ——
 * 而那种依赖在同一个仓库里永远看不出来。
 *
 * 用法:`bun run check:engine:standalone`
 */
import { execFileSync } from 'node:child_process'
import { cpSync, existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, symlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import assert from 'node:assert/strict'

const ROOT = resolve(import.meta.dirname, '..')
const PKG = resolve(ROOT, 'packages/engine')
const work = mkdtempSync(join(tmpdir(), 'wanxiang-standalone-'))
const target = join(work, 'engine')

function walk(dir) {
  const out = []
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) out.push(...walk(full))
    else out.push(full)
  }
  return out
}

try {
  console.log('① 整份复制到临时目录(不带构建产物与依赖)')
  cpSync(PKG, target, {
    recursive: true,
    filter: src => !src.includes(`${join('packages/engine', 'node_modules')}`) && !src.includes(`${join('packages/engine', 'dist')}`)
  })
  // 依赖借仓库现有的:CI 里本来就有;真搬走后换成 `bun install` 一行
  symlinkSync(resolve(ROOT, 'node_modules'), join(target, 'node_modules'), 'dir')

  console.log('② 源码里不许出现宿主引用(别名、越界相对路径)')
  const files = walk(join(target, 'src')).filter(f => f.endsWith('.ts'))
  const offenders = []
  for (const file of files) {
    const text = readFileSync(file, 'utf8')
    if (/from '@\//.test(text) || /from '\.\.\/\.\.\/\.\./.test(text)) offenders.push(file.replace(target + '/', ''))
  }
  assert.deepEqual(offenders, [], `这些文件引用了宿主仓库的东西:${offenders.join(', ')}`)
  console.log(`   ${files.length} 个源文件干净`)

  console.log('③ 在临时目录里独立编译')
  const bin = (name) => join(target, 'node_modules/.bin', name)
  assert.ok(existsSync(bin('tsc')), 'tsc 不在依赖里 —— 包自己声明了 devDependencies 吗?')
  execFileSync(bin('tsc'), ['-p', 'tsconfig.build.json'], { cwd: target, stdio: 'inherit' })
  assert.ok(existsSync(join(target, 'dist/index.js')) && existsSync(join(target, 'dist/index.d.ts')), '编译没产出 dist/index')

  console.log('④ 在临时目录里独立跑库自己的用例')
  execFileSync(bin('vitest'), ['run', '--reporter=dot'], { cwd: target, stdio: 'inherit' })

  console.log('⑤ 独立 import 一次产物')
  const probe = `
    const engine = await import(${JSON.stringify(join(target, 'dist/index.js'))})
    const { DEMO } = await import(${JSON.stringify(join(target, 'dist/presets/demo.js'))})
    const game = engine.defineGame(DEMO)
    if (game.realms.label(0, 0) !== '见习船员 I 阶') throw new Error('换皮世界没装起来')
    console.log('   换皮世界装配通过:' + game.attributes.name('attack'))
  `
  execFileSync(process.execPath, ['--input-type=module', '-e', probe], { cwd: target, stdio: 'inherit' })

  console.log('⑥ README 里的例子在搬走之后也跑得通')
  // README 承诺 `bun run examples` 能跑 —— 那就真跑。示例烂了比文档写错更糟:它会教坏抄的人。
  for (const example of ['examples/quickstart.ts', 'examples/minimal.ts']) {
    assert.ok(existsSync(join(target, example)), `README 提到的示例不存在:${example}`)
    execFileSync('bun', [example], { cwd: target, stdio: 'ignore' })
  }

  console.log(`独立成库自检通过(${files.length} 个源文件 · 独立编译 · 独立用例 · 独立装配 · 示例可跑)`)
} finally {
  rmSync(work, { recursive: true, force: true })
}
