/**
 * 更名判据 —— 《云隐修仙录》→《玄枢录》。
 *
 * 改名这种事最容易"改一半":界面上换了,配置/文档/图标描述里还留着旧名;
 * 更糟的是**顺手把身份也改了** —— 存储前缀一换,老玩家的档就读不出来。
 * 于是这三条一起钉:
 *
 *   一、对外文字里不许再出现旧名(允许清单只有两处**技术身份**,见下);
 *   二、旧前缀下的存档会被搬到新前缀(玩家的进度不因改名丢失);
 *   三、更名前导出的 `.save` 文件仍然导入得进来(旧标识被认)。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  LEGACY_GAME_ID,
  LEGACY_SAVE_PREFIX,
  SAVE_PREFIX,
  migrateLegacyPrefix,
  storageKey,
  validateImportPayload
} from '@/utils/storage'

const ROOT = resolve(__dirname, '../..')

/** 最小的 localStorage 替身:用例环境是 node,没有真 Storage */
function installFakeStorage(): Map<string, string> {
  const disk = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => disk.get(k) ?? null,
    setItem: (k: string, v: string) => void disk.set(k, v),
    removeItem: (k: string) => void disk.delete(k),
    clear: () => disk.clear(),
    key: (i: number) => [...disk.keys()][i] ?? null,
    get length() {
      return disk.size
    }
  })
  return disk
}

let disk: Map<string, string>

beforeEach(() => {
  disk = installFakeStorage()
})

/**
 * 允许保留旧名的位置 —— 只有"技术身份",没有一处展示文案:
 *
 *   · `utils/crypto.ts` 的加密口令:密钥材料,改了老档解不开;
 *   · `android/` 的 applicationId 与 Java 包名:换了等于换一个 App,
 *     老安装不能覆盖升级、WebView 里的本地存档也会另起一份(要换得单独做一次并盯构建);
 *   · 存档迁移相关:旧前缀 / 旧标识常量本身就是"为了认出来"才留的;
 *   · `scripts/*-check.mjs` 里的同一段加密口令:脚本要造出能被游戏解开的夹具。
 */
const ALLOWED = [
  'utils/crypto.ts',
  'utils/storage.ts',
  'utils/savePlaintext.spec.ts',
  'core/rebrand.spec.ts',
  'core/saveMigration.spec.ts',
  'scripts/layout-check.mjs',
  'scripts/ui-smoke.mjs',
  'scripts/offline-check.mjs',
  'android/',
  'capacitor.config.ts',
  'bun.lock',
  'data/equipment.ts' // 「云英护腕」是装备名,与旧标题无关
]

function allowed(rel: string): boolean {
  return ALLOWED.some(a => rel.includes(a))
}

describe('更名 —— 《玄枢录》', () => {
  it('对外文字里不再出现旧标题', () => {
    const targets = [
      'README.md',
      'index.html',
      'package.json',
      'capacitor.config.ts',
      'public/manifest.webmanifest',
      'public/privacy.html',
      'public/sw.js',
      'docs/usage.md',
      'docs/deployment.md',
      'docs/engine.md',
      'docs/design.md'
    ]
    const offenders = targets.filter(f => readFileSync(resolve(ROOT, f), 'utf8').includes('云隐修仙录'))
    expect(offenders, `这些文件还写着旧标题:${offenders.join('、')}`).toEqual([])
  })

  it('界面与数据里也不许留旧标题(允许清单除外)', () => {
    const files = ['src/views/WelcomeView.vue', 'src/views/CreateView.vue', 'src/core/engineWorld.ts']
    const offenders = files.filter(f => !allowed(f) && readFileSync(resolve(ROOT, f), 'utf8').includes('云隐修仙录'))
    expect(offenders).toEqual([])
  })

  it('更名之后,老玩家的分片会被搬到新前缀(且新档优先)', () => {
    localStorage.setItem(`${LEGACY_SAVE_PREFIX}player`, 'old-player')
    localStorage.setItem(`${LEGACY_SAVE_PREFIX}resources`, 'old-resources')
    localStorage.setItem(storageKey('resources'), 'new-resources') // 新档已存在 → 不被覆盖

    const moved = migrateLegacyPrefix()

    expect(moved).toBe(1)
    expect(localStorage.getItem(storageKey('player'))).toBe('old-player')
    expect(localStorage.getItem(storageKey('resources'))).toBe('new-resources')
    expect(localStorage.getItem(`${LEGACY_SAVE_PREFIX}player`)).toBeNull()
    expect(localStorage.getItem(`${LEGACY_SAVE_PREFIX}resources`)).toBeNull()
    expect(SAVE_PREFIX).toBe('xuanshu.')
    expect(disk.size).toBe(2)
  })

  it('更名前导出的存档仍然导入得进来', () => {
    const legacyPayload = {
      game: LEGACY_GAME_ID,
      version: 2,
      exportedAt: Date.now(),
      data: { player: {}, game: {} }
    }
    expect(validateImportPayload(legacyPayload)).toBeNull()
    // 认的是"旧标识",不是"随便什么标识"
    expect(validateImportPayload({ ...legacyPayload, game: '别的游戏' })).toContain('存档')
  })
})
