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
 * 口径与库里那条同源:扫的是**去掉注释与字符串字面量**之后的代码,注释里提一句不算用过。
 * 这条判据的价值在于"新加一个导出"时:既没用、又没写理由,当场红。
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
  seedFromString: { kind: 'own', why: '种子由本作的字符串键走 createRng(已导入)' },
  createProgressionAudit: {
    kind: 'own',
    why: '本作的数值审计(inflationAudit / progressionSim)要连内容一起建模(区域强度、装备成型度档位);引擎那份是通用版(强度与内容强度都由调用方给),两边口径不同,故各留一份'
  },
  runIdle: { kind: 'none', why: '离线结算要按秒摊到多本账(修为/灵气/建筑/钻研/历练),没有"折叠成一步"的循环' },
  createPityCounter: { kind: 'none', why: '本作没有抽卡保底这套玩法' }
}

const HOST_SRC = resolve(import.meta.dirname, '..')

/** 去掉注释与字符串字面量:只留代码位置上的标识符 */
function codeOnly(text: string): string {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '')
    .replace(/'(?:[^'\\]|\\.)*'/g, "''")
    .replace(/"(?:[^"\\]|\\.)*"/g, '""')
    .replace(/`(?:[^`\\]|\\.)*`/g, '``')
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
    const files = walk(HOST_SRC).filter(file => /\.(ts|vue)$/.test(file) && !file.endsWith('engineAdoption.spec.ts'))
    const corpus = files.map(file => codeOnly(readFileSync(file, 'utf-8'))).join('\n')

    const exports = Object.keys(engine).sort()
    const notByName = exports.filter(name => !new RegExp(`\\b${name}\\b`).test(corpus))
    const unexplained = notByName.filter(name => !(name in NOT_BY_NAME))
    const stale = Object.keys(NOT_BY_NAME).filter(name => !exports.includes(name))
    // 表里点名过、但其实按名字用上了 —— 说明理由已经过期,该从表里删掉
    const outdated = Object.keys(NOT_BY_NAME).filter(name => !notByName.includes(name))

    const byKind = (kind: 'facade' | 'own' | 'none'): number =>
      Object.values(NOT_BY_NAME).filter(entry => entry.kind === kind).length
    console.log(
      `  库运行时导出 ${exports.length} 个:按名字用 ${exports.length - notByName.length} 个` +
        ` · 经门面 ${byKind('facade')} 个 · 本作有等价物 ${byKind('own')} 个 · 本作没这玩法 ${byKind('none')} 个`
    )

    expect(unexplained).toEqual([]) // 既没用、又没写理由的 —— 不许存在
    expect(stale).toEqual([]) // 表里写了库已不存在的导出 —— 不许存在
    expect(outdated).toEqual([]) // 理由过期了(其实已经在按名字用)—— 也要清掉
    // 防空转:这条判据至少在"真的扫到了东西"的前提下才有意义
    expect(exports.length).toBeGreaterThan(70)
    expect(files.length).toBeGreaterThan(100)
  })
})
