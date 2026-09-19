/* eslint-disable no-console -- 自检脚本的产出就是给人看的报告 */
/**
 * 发布产物自检 —— legacy 那一套还出得来吗
 *
 * 用法:
 *   bun run build:release && bun scripts/legacy-artifacts.mjs
 *
 * 为什么要有这一条
 * ----------------
 * legacy 从「每次构建都打」改成「只在发布时打」之后(vite.config.ts 的 XIAN_LEGACY),
 * 日常构建里再也看不到它 —— 万一那个开关坏了、插件升级换了注入方式、或者有人把
 * `build:release` 改回普通构建,**日常的门全是绿的**,直到 Chrome 51 那批老内核的玩家
 * 打开是一片白屏。故发布路径上必须有一条当场核它的证据:
 *
 *   一 产物里真有 `*-legacy-*.js` 与 `polyfills-legacy-*.js`(每页再走一遍 babel 的那一份);
 *   二 index.html 里真有那条 `nomodule` 兜底装载(没有它,老内核连 legacy 都不会去取);
 *   三 现代那一份也还在(两条腿都有,才叫双份产物)。
 *
 * 判据只问「出得来吗」,不问体积 —— 体积由首屏那条判据盯着(scripts/first-paint.mjs)。
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const DIST = join(ROOT, 'dist')
const ASSETS = join(DIST, 'assets')

const files = readdirSync(ASSETS)
const legacyJs = files.filter(f => /-legacy-[A-Za-z0-9_-]+\.js$/.test(f))
const polyfills = files.filter(f => /^polyfills-legacy-.*\.js$/.test(f))
const modernJs = files.filter(f => /\.js$/.test(f) && !/-legacy-/.test(f) && !/^polyfills-legacy/.test(f))
const indexHtml = readFileSync(join(DIST, 'index.html'), 'utf-8')
const hasNoModule = /<script[^>]*nomodule/.test(indexHtml)
const hasSystemLoader = /System\.import|__vite_legacy_guard/.test(indexHtml)
const legacyBytes = legacyJs.reduce((n, f) => n + statSync(join(ASSETS, f)).size, 0)

console.log('发布产物自检(legacy 那一套)')
console.log(`  现代 chunk ${modernJs.length} 个 · legacy chunk ${legacyJs.length} 个(${Math.round(legacyBytes / 1024)}KB)`)
console.log(`  polyfills-legacy:${polyfills.length ? polyfills.join(', ') : '缺'}`)
console.log(`  index.html:nomodule 兜底 ${hasNoModule ? '有' : '无'} · SystemJS 装载 ${hasSystemLoader ? '有' : '无'}`)

const failures = []
if (legacyJs.length === 0) failures.push('一个 *-legacy-*.js 都没有 —— legacy 没打出来(发布路径不许少了它)')
if (polyfills.length === 0) failures.push('没有 polyfills-legacy —— 老内核缺的那批 API 没补')
if (!hasNoModule) failures.push('index.html 里没有 nomodule 兜底装载 —— 老内核根本不会去取 legacy')
if (!hasSystemLoader) failures.push('index.html 里没有 SystemJS 装载逻辑 —— legacy 取了也跑不起来')
if (modernJs.length === 0) failures.push('现代 chunk 一个都没有 —— 产物只有一半')
if (legacyJs.length && legacyJs.length < modernJs.length) {
  // 页面级 chunk 应当一一对应;差得太多说明 legacy 只覆盖了一部分入口
  failures.push(`legacy chunk 只有 ${legacyJs.length} 个,现代有 ${modernJs.length} 个 —— 对不上,有页面没兜底`)
}

if (failures.length) {
  for (const f of failures) console.log(`✗ ${f}`)
  console.log('  提示:发布路径要先 `bun run build:release`(XIAN_LEGACY=1),普通 `bun run build` 是**不打** legacy 的')
  process.exitCode = 1
} else {
  console.log('✓ legacy 与现代化两份产物都在,index.html 的兜底装载也接上了')
}
