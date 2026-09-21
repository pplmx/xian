/**
 * 文档自检 —— 文档里写下的**命令、路径与规模数**,必须与仓库里真实的东西一致。
 *
 * 为什么值得一道判据:文档腐烂最常见的方式不是写错字,而是"停在几个版本前" ——
 * 脚本改名了、文件挪走了、用例涨了几百个,而文档还写着旧数。读者照着抄,先怀疑自己。
 * 实测抓到过一次:`README.md` 与 `docs/development.md` 都还写着「199 个 spec / 2044 例」,
 * 而当时已经是 289 / 2647(涨了 25%)。这类数字没人盯着就一定会锈。
 *
 * 查三件事(都只查**能静态数出来**的 —— 用例条数数不出来,故不查,那一条靠跑 test 对):
 *   ① 文档里每个 `bun run x` 都得是 package.json 里真有的脚本;
 *   ② 文档里反引号点名的仓库路径(src/…、scripts/…、docs/….md、electron/…)都得存在,
 *      相对**链接**的目标也得存在(死链在文档里点下去才发现,那时读者已经在怀疑自己了);
 *   ③ 规模数要对得上:「全量 N 个 spec」= 全部 spec 文件数,「本作自己那部分 N 个」= 去掉公共库的。
 *
 * 归档不查:`docs/superpowers/plans/**` 是当时的计划存档,里面的路径是"当时打算建的文件",
 * 拿今天的仓库去校对历史计划,只会逼人改记录(那比留着一份旧计划更坏)。
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join, resolve } from 'node:path'

const ROOT = resolve(import.meta.dirname, '..')
const ENGINE = join(ROOT, 'packages/engine')

const scripts = Object.keys(JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf-8')).scripts)
const docFiles = [
  'README.md',
  ...readdirSync(join(ROOT, 'docs'), { recursive: true, encoding: 'utf-8' })
    .filter(name => typeof name === 'string' && name.endsWith('.md'))
    .map(name => `docs/${name}`)
].filter(rel => !rel.startsWith('docs/superpowers/plans/'))

/** 一个 spec 文件都不算漏:两处都要走同一套"递归数 .spec.ts" */
const countSpecs = dir =>
  readdirSync(dir, { recursive: true, encoding: 'utf-8' }).filter(
    name => typeof name === 'string' && name.endsWith('.spec.ts')
  ).length
const hostOnly = countSpecs(join(ROOT, 'src'))
const engineOnly = countSpecs(join(ENGINE, 'src'))
const totalSpecs = hostOnly + engineOnly

const failures = []
let commands = 0
let paths = 0
let sizeClaims = 0

for (const rel of docFiles) {
  const text = readFileSync(join(ROOT, rel), 'utf-8')

  // ① 命令
  for (const [, name] of text.matchAll(/bun run ([a-zA-Z:_-]+)/g)) {
    // 单字母是文档里的占位写法(`bun run x`),不当命令查 —— 真脚本名不会只有一个字母
    if (name.length < 2) continue
    commands += 1
    if (!scripts.includes(name)) failures.push(`${rel}: \`bun run ${name}\` 在 package.json 里没有这个脚本`)
  }
  for (const [, path] of text.matchAll(/(?:bun|node) (scripts\/[\w./-]+)/g)) {
    commands += 1
    if (!existsSync(join(ROOT, path))) failures.push(`${rel}: \`${path}\` 不存在`)
  }

  // ② 路径
  for (const [, path] of text.matchAll(/`((?:src|scripts|electron|docs)\/[\w./@-]+)`/g)) {
    if (path.includes('*') || path.endsWith('/')) continue
    paths += 1
    if (!existsSync(join(ROOT, path))) failures.push(`${rel}: 反引号里的 \`${path}\` 不存在`)
  }
  for (const [, target] of text.matchAll(/\]\(([^)\s]+)\)/g)) {
    if (/^(https?:|mailto:|#)/.test(target)) continue
    paths += 1
    const clean = target.split('#')[0]
    if (clean === '') continue
    const full = resolve(join(ROOT, rel, '..'), clean)
    if (!existsSync(full)) failures.push(`${rel}: 链接 \`${target}\` 指向的地方不存在`)
  }

  // ③ 规模数
  for (const [, n] of text.matchAll(/全量 (\d+) 个 spec/g)) {
    sizeClaims += 1
    if (Number(n) !== totalSpecs) failures.push(`${rel}: 写着「全量 ${n} 个 spec」,实际 ${totalSpecs} 个`)
  }
  for (const [, n] of text.matchAll(/本作自己那部分 (\d+) 个/g)) {
    sizeClaims += 1
    if (Number(n) !== hostOnly) failures.push(`${rel}: 写着「本作自己那部分 ${n} 个 spec」,实际 ${hostOnly} 个`)
  }
}

// 防空转:文档被挪走、正则失灵时,这条判据会"通过"得毫无意义
if (commands < 10) failures.push(`只从文档里读出 ${commands} 条命令 —— 路径变了,或者写法改了?`)
if (paths < 20) failures.push(`只从文档里读出 ${paths} 条路径 —— 写法变了?`)
if (sizeClaims < 2) failures.push(`只从文档里读出 ${sizeClaims} 处规模数 —— 「全量 N 个 spec」这种写法被改掉了?`)

if (failures.length > 0) {
  console.error('文档自检:以下地方与仓库对不上')
  for (const f of failures) console.error(`  ✗ ${f}`)
  process.exit(1)
}

console.log(
  `文档自检通过(${docFiles.length} 份文档里的 ${commands} 条命令、${paths} 条路径都真实存在;` +
    `规模数对得上:全量 ${totalSpecs} 个 spec / 本作自己那部分 ${hostOnly} 个)`
)
console.log('  用例条数不在这里查(静态数不出来)—— 例数由 `bun run test:report` 对照本次运行实录核对(见 scripts/test-report.mjs)')
