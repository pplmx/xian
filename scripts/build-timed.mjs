/* eslint-disable no-console -- 自检脚本的产出就是给人看的报告 */
/**
 * 构建时长上限 —— 把「构建多久」也变成一条会红的判据
 *
 * 用法:
 *   bun scripts/build-timed.mjs              # 量现代构建(日常与 CI 门用这一条)
 *   bun scripts/build-timed.mjs --release    # 量发布构建(带 legacy 兜底那条)
 *
 * 为什么要有这一条
 * ----------------
 * 「构建慢」这种事没有门就会悄悄长回去:legacy 后处理曾经占掉 32s 里的 26s(82%、
 * 106 次调用),而没有任何东西拦它。现在 legacy 只在发布路径上打(XIAN_LEGACY=1),
 * 日常构建本机 16s —— 但只要有人把那套接回日常构建,时长当场翻倍,而别的判据全都还是
 * 绿的(产物一样能跑、用例一样过)。
 *
 * 口径:CI 机器比本机慢(核多但单核弱、还没有热缓存),故上限按**本机读数的四到五倍**
 * 定,只拦「成倍长回去」这一类,不追求贴着跑。本机读数写在 docs/development.md 的
 * 「首屏与构建时长」一节;要改上限请连同那里的表一起改。
 */
import { spawn } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const RELEASE = process.argv.includes('--release')
const SCRIPT = RELEASE ? 'build:release' : 'build'

/** 上限(秒)—— 见文件头「口径」 */
const BUDGET = Number(process.env.BUILD_BUDGET_S ?? (RELEASE ? 240 : 90))

console.log(`构建计时(${RELEASE ? '发布路径:带 legacy 兜底' : '现代目标'} · 上限 ${BUDGET}s)`)
const started = Date.now()
const code = await new Promise(resolveCode => {
  const child = spawn('bun', ['run', SCRIPT], { cwd: ROOT, stdio: 'inherit' })
  child.on('close', resolveCode)
})
const seconds = Math.round((Date.now() - started) / 100) / 10

if (code !== 0) {
  console.log(`✗ 构建失败(退出码 ${code}),用时 ${seconds}s`)
  process.exitCode = code ?? 1
} else if (seconds > BUDGET) {
  console.log(`✗ 构建用了 ${seconds}s,超过上限 ${BUDGET}s —— 多半是有东西又回到了每次构建里(比如 legacy)`)
  process.exitCode = 1
} else {
  console.log(`✓ 构建 ${seconds}s(上限 ${BUDGET}s)`)
}
