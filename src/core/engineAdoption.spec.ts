/* eslint-disable no-console -- 落地读数就是要打印出来给人看的 */
/**
 * 库导出在本作的落地审计 —— "库里的每一层,本作到底有没有真的用上"。
 *
 * 为什么值得一条判据:本作是万象引擎的**第一个定制用户**,这件事不能只靠感觉说。库那边有一条
 * 对称的约束(75 个导出每个都得有判据或示例),这里是另一半:**每个导出一旦出现,本作就得
 * 有个明确态度** —— 按名字用上、经装配门面用上、或者写下"为什么不用",而不是悄悄不接。
 *
 * 实测(写这条时的真实账):库 75 个运行时导出,本作**按名字导入 74 个**(其中 33 个是类型),
 * 剩下 21 个各自有归属 —— 主要两类:①本作经 `defineGame` 装配、从不直接调用那几个工厂
 * (`game.realms` / `game.attributes` / `game.equipment` / `game.dungeons`);
 * ②本作有自己的等价物(展示格式化、平台随机、大数适配、文案)。
 *
 * 口径(两处踩过才定下来的):
 *   ① **只看应用侧代码**(`*.spec.ts` 不算)—— 本作的 parity 用例几乎把每个导出都 import 了一遍,
 *      把它们算进"用过"的话,这条判据就退化成"库给自己写了个用例",量不到"本作到底接没接";
 *   ② "用过"= **真的从库那边拿过来**(`import { … } from 'wanxiang-engine'`,
 *      或转发导出),本地同名函数不算 —— `utils/random.ts` 曾经自己抄了一份 `mulberry32`,
 *      朴素的名字匹配照样把它记成"用上了库的 mulberry32",而库那份从头到尾没被引用过。
 *
 * 这条判据的价值在于"新加一个导出"时:既没用、又没写理由,当场红;
 * 反过来,理由过期了(其实已经真拿过来用)也要清掉。
 */
import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import * as engine from 'wanxiang-engine'

/**
 * 本作**不按名字使用**的导出,以及每一条的归属。三类:
 *   `facade` —— 经 `defineGame` 装配后走 `game.*` 门面,本作从不直接调用工厂;
 *   `own`    —— 本作有自己的等价物(那一层就没必要再接库的实现);
 *   `none`   —— 本作根本没有这个玩法。
 */
const NOT_BY_NAME: Record<string, { kind: 'facade' | 'own' | 'none'; why: string }> = {
  createAttributeSystem: { kind: 'facade', why: '经 defineGame 装配成 game.attributes' },
  createRealmSystem: { kind: 'facade', why: '经 defineGame 装配成 game.realms' },
  createEquipmentSystem: { kind: 'facade', why: '经 defineGame 装配成 game.equipment' },
  createDungeonSystem: { kind: 'facade', why: '经 defineGame 装配成 game.dungeons' },
  DEFAULT_ATTRIBUTES: { kind: 'facade', why: '经 attributeDefs()(已导入)拿到默认表' },
  DEFAULT_LAYER_NAMES: { kind: 'facade', why: '经 game.realms.layerNames 读,不直接引' },
  generateTemplates: { kind: 'facade', why: '内容表由 data/equipment 自己写,不用模板生成器' },
  emptyProgress: { kind: 'facade', why: '本作自己的进度形状由 store 建,不用库的空进度' },
  validateGame: { kind: 'facade', why: 'defineGame 内部会校验;本作另有 dataAudit 那一套' },
  leverFactor: { kind: 'own', why: '炼制只经 composeCraftRate(已导入),不单独取乘区' },
  entryAllowed: { kind: 'own', why: '抽池用 deckPool + drawFrom,不需要单条判定' },
  encodeSave: { kind: 'own', why: '本作的存档由 savePlatform 自己落盘,只借库的迁移链(runMigrations)' },
  decodeSave: { kind: 'own', why: '同上:解码走本作的读档流程' },
  decodeSavePayload: { kind: 'own', why: '同上' },
  formatAmount: { kind: 'own', why: '本作有 utils/format(汉字数词与量词那套)' },
  progressText: { kind: 'own', why: '进度文案由 questProgress 按本作的说法拼' },
  numberNumeric: { kind: 'own', why: '本作用大数(utils/gnum)自己实现 Numeric' },
  randomRng: { kind: 'own', why: '本作有 utils/random(RandomService)' },
  createRng: { kind: 'own', why: '本作的随机源是 RandomService(mulberry32(seed));库的 createRng 只在 parity 用例里对账"两条路同序列"' },
  seedFromString: { kind: 'own', why: '字符串键→种子这条路由本作的随机服务自己接;库那份只在 parity 用例里参与对账' },
  createCombatEngine: { kind: 'own', why: '自动战斗是应用侧那套(core/combat:护盾/反击/追击/战报节奏);库的战斗骨架只在 engineCombatAblation 里对合成键' },
  createProgressionAudit: { kind: 'own', why: '只在 engineProgressionAudit 这条对账用例里用(拿它核本作真表的结构);应用侧的数值审计仍走 inflationAudit 那套' },
  runIdle: { kind: 'none', why: '离线结算要按秒摊到多本账(修为/灵气/建筑/钻研/历练),没有"折叠成一步"的循环' },
  createPityCounter: { kind: 'none', why: '本作没有抽卡保底这套玩法' }
}

const HOST_SRC = resolve(import.meta.dirname, '..')

/**
 * 真正**从库那边拿过来**的名字 —— `import { … } from 'wanxiang-engine'`
 * 或 `export { … } from 'wanxiang-engine'` 里出现的那些。
 *
 * 为什么不能只看"代码里出现过这个名字":本作曾经在 `utils/random.ts` 里**自己抄了一份
 * `mulberry32`**,那条朴素判据照样把它算成"用上了库的 mulberry32" —— 而实际上库那份
 * 从头到尾没被引用过。抽出来的件要是没人真拿,它就会悄悄烂在库里。
 * 所以口径改成:**名字必须从库里来**(转发导出也算),本地同名不算。
 */
function engineBoundNames(files: readonly string[]): { bound: Set<string>; namespace: string[] } {
  const bound = new Set<string>()
  const namespace: string[] = []
  for (const file of files) {
    const text = readFileSync(file, 'utf-8')
    for (const m of text.matchAll(/(?:import|export)\s*(?:type\s*)?\{([^}]*)\}\s*from\s*'wanxiang-engine'/g)) {
      for (const part of m[1]!.split(',')) {
        const name = part.trim().replace(/^type\s+/, '').split(/\s+as\s+/)[0]!.trim()
        if (name) bound.add(name)
      }
    }
    if (/import\s*\*\s*as\s+\w+\s*from\s*'wanxiang-engine'/.test(text)) {
      namespace.push(file.replace(`${HOST_SRC}/`, ''))
    }
  }
  return { bound, namespace }
}

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap(entry => {
    const full = join(dir, entry)
    return statSync(full).isDirectory() ? walk(full) : [full]
  })
}

describe('库导出在本作的落地', () => {
  it('每个导出要么按名字用上,要么在归属表里点名', () => {
    // 本审计自己会写下这些名字,所以把自己排除掉,免得"自己证明自己用过"
    // 只看应用侧代码:用例(含 parity)不算"本作用上了" —— 它们是对账,不是接线
    const files = walk(HOST_SRC).filter(
      file => /\.(ts|vue)$/.test(file) && !file.includes('.spec.') && !file.includes(`__tests__`)
    )
    const allFiles = walk(HOST_SRC).filter(file => /\.(ts|vue)$/.test(file))

    const exports = Object.keys(engine).sort()
    const { bound, namespace } = engineBoundNames(allFiles.filter(f => !f.endsWith('engineAdoption.spec.ts')))
    // 命名空间导入会让"按名字来没来"无从判断 —— 有的话就在这里点名,要求改成具名导入
    expect(namespace).toEqual([])
    // 应用侧真的从库里拿过来的名字(用例里的引用不算)
    const productionBound = engineBoundNames(files).bound
    const notByName = exports.filter(name => !productionBound.has(name))
    // 顺带记一笔:这些导出只在用例里被动过 —— 不算"接上了",但值得知道
    const specOnly = exports.filter(name => !productionBound.has(name) && bound.has(name))
    const unexplained = notByName.filter(name => !(name in NOT_BY_NAME))
    const stale = Object.keys(NOT_BY_NAME).filter(name => !exports.includes(name))
    // 表里点名过、但其实按名字用上了 —— 说明理由已经过期,该从表里删掉
    const outdated = Object.keys(NOT_BY_NAME).filter(name => !notByName.includes(name))

    const byKind = (kind: 'facade' | 'own' | 'none'): number =>
      Object.values(NOT_BY_NAME).filter(entry => entry.kind === kind).length
    console.log(
      `  库运行时导出 ${exports.length} 个:**应用侧**按名字用 ${exports.length - notByName.length} 个` +
        ` · 经门面 ${byKind('facade')} 个 · 本作有等价物 ${byKind('own')} 个 · 本作没这玩法 ${byKind('none')} 个`
    )
    if (specOnly.length > 0) {
      console.log(`  另有 ${specOnly.length} 个只在用例里被动过(算不算接上,由人判断):${specOnly.join(' · ')}`)
    }

    expect(unexplained).toEqual([]) // 既没用、又没写理由的 —— 不许存在
    expect(stale).toEqual([]) // 表里写了库已不存在的导出 —— 不许存在
    expect(outdated).toEqual([]) // 理由过期了(其实已经在按名字用)—— 也要清掉
    // 防空转:这条判据至少在"真的扫到了东西"的前提下才有意义
    expect(exports.length).toBeGreaterThan(70)
    expect(files.length).toBeGreaterThan(100)
  })
})
