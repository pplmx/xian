/**
 * Host ↔ standalone sync gate — `packages/engine` and wanxiang-engine `main`
 * must be the same tree.
 *
 * Forgetting `git subtree push` is silent: this repo stays green, the
 * standalone repo still serves last week's code. Comparing trees makes that
 * fail here, with the push command printed.
 *
 * Wired into `bun run check:engine`. Override the remote with
 * ENGINE_SYNC_REMOTE / ENGINE_SYNC_REF if you are not using the public repo.
 */
import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'
import assert from 'node:assert/strict'

const ROOT = resolve(import.meta.dirname, '..')
const REMOTE = process.env.ENGINE_SYNC_REMOTE ?? 'https://github.com/pplmx/wanxiang-engine.git'
const REF = process.env.ENGINE_SYNC_REF ?? 'main'

function git(args, opts = {}) {
  const out = execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', ...opts })
  return typeof out === 'string' ? out.trim() : ''
}

console.log('⑧ 独立仓与 packages/engine 同树')

try {
  git(['fetch', '--depth=1', REMOTE, REF], { stdio: 'inherit' })
} catch (err) {
  throw new Error(
    `拉不到独立仓 ${REMOTE} (${REF})。` +
      '离线开发可暂设 ENGINE_SYNC_REMOTE 指向你已经 fetch 过的 remote 名。',
    { cause: err }
  )
}

const local = git(['rev-parse', 'HEAD:packages/engine'])
const remote = git(['rev-parse', 'FETCH_HEAD^{tree}'])
assert.equal(
  local,
  remote,
  `本仓 packages/engine 与独立仓 ${REF} 不是同一棵树\n` +
    `  本仓:   ${local}\n` +
    `  独立仓: ${remote}\n` +
    '推过去:\n' +
    '  git subtree push --prefix=packages/engine engine main'
)
console.log(`   同树 ${local.slice(0, 12)}(独立仓 ${REF})`)
