/**
 * 死导出审计 —— 「导出」也是一种承诺
 *
 * 一个顶层导出活着的判据只有一条:**除声明处之外,src 里还有别人用**。
 * 没有别人的导出,读者会以为它被接上了,于是:
 *
 *   - isSoftCapped 写了半年没人调,软阈值就成了"面板暗改";
 *   - RULESET_CHANGELOG 写好了没人读,玩家问不到"天道变了什么";
 *   - 早先的 CHAIN_EVENT_IDS 列着五个连锁事件的 id,而那五个事件根本不存在
 *     (现已实装为 data/chains.ts,旧的死导出随之删除)。
 *
 * 这三条都是本轮清扫出来的真事,共同点不是"代码写得差",而是
 * **没有任何机制阻止死导出继续躺在那里**。故本文件把这件事变成红线:
 *
 *   每个顶层导出,要么有人接,要么删掉;确有理由先留的,登记在 ALLOWLIST
 *   里写明原因和去处 —— 名单不常驻,一旦有人接上,这里立刻变红提醒销账。
 *
 * 故障注入:任意把 ALLOWLIST 里的一项接上(或删掉某个真导出的来源)都会变红;
 * 往 src 里加一个没人用的 `export const x = 1` 也会变红。
 *
 * 判据用 TypeScript 语法树,不是正则 —— 注释与字符串里的名字不算使用,
 * `obj.foo` 的属性名 / 接口字段名也不算,免得"提过一嘴"冒充"接线"。
 */
import { describe, expect, it } from 'vitest'
import ts from 'typescript'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'

const SRC = resolve(__dirname, '..')

/**
 * 有理由先留、暂不接线的导出。
 *
 * 每一项都必须写清「为什么留」和「什么时候销账」,
 * 写不出这两句的,就是一具应该删掉的尸体。
 */
const ALLOWLIST: Record<string, string> = {
  // 已被别的审计钉住的两端
  studyBlueprint: '炼器图纸骨架:contentReachabilityAudit 已钉"读与给必须一起接",此处不重复扣押'
}

/**
 * 审计/分析模块 —— 它们的导出本就不是给游戏运行时用的,而是给用例读的
 * (模拟、曲线、回归基线、审计表)。这些模块整份豁免"spec-only"红线。
 *
 * 为什么不用自动判据:试过两次都不干净 ——
 *   ① "有导出被运行时用过" ⇒ 审计模块常有一两个导出被界面借用,误报上百;
 *   ② "从 main 沿 import 传递可达" ⇒ 只要审计模块里有一个导出进了界面
 *      (如 samsaraAudit.heritageGroups 被轮回弹窗用),它 import 的整棵分析树
 *      都成了"运行时",照样误报。
 * 于是改为**具名清单**:新增分析模块时在此登记,一眼可审。
 */
const AUDIT_MODULES = new Set([
  'core/buildSearch.ts',
  'core/buildSim.ts',
  'core/celestialSim.ts',
  'core/compoundingAudit.ts',
  'core/daoFruitCurve.ts',
  'core/daoFruitRoles.ts',
  'core/deepCultivationRoi.ts',
  'core/ecosystemHealth.ts',
  'core/fingerprints.ts',
  'core/fruitOutlets.ts',
  'core/impactSurface.ts',
  'core/inflationAudit.ts',
  'core/lootSim.ts',
  'core/mortalGate.ts',
  'core/mortalIdentity.ts',
  'core/mortalWorldGen.ts',
  'core/motivationType.ts',
  'core/narrowingImpact.ts',
  'core/overviewNecessity.ts',
  'core/progressionSim.ts',
  'core/rebirthRoi.ts',
  'core/ruleBudget.ts',
  'core/samsaraAudit.ts',
  'core/shallowRebirthGains.ts',
  'core/trialMotivation.ts'
])

/**
 * 全扫描统一用正斜杠路径(Win 上 join 产出 `\`,会打不中机制表里的正斜杠键)。
 * 文件系统操作仍用各自平台的 join,只有进比较的字符串归一。
 */
const posix = (p: string): string => p.replace(/\\/g, '/')

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) walk(full, out)
    else if (/\.(ts|vue)$/.test(entry) && !entry.endsWith('.d.ts')) out.push(posix(full))
  }
  return out
}

/** .vue 只取 <script> 块;返回可解析的源码 */
function scriptOf(path: string): string {
  const text = readFileSync(path, 'utf8')
  if (!path.endsWith('.vue')) return text
  return /<script[^>]*>([\s\S]*?)<\/script>/.exec(text)?.[1] ?? ''
}

function hasExportModifier(node: ts.Node): boolean {
  return ts.canHaveModifiers(node) && !!ts.getModifiers(node)?.some(m => m.kind === ts.SyntaxKind.ExportKeyword)
}

/** 属性名/字段名/枚举成员不是"使用":`obj.foo`、`{ foo: 1 }`、`interface { foo: T }` 都不算 */
function isNonUseIdentifier(node: ts.Identifier, parent: ts.Node): boolean {
  return (
    /**
     * 光 import 不算接线:真正的接线是有人调用它(未使用的 import 由 eslint 兜)。
     * 例外:别名导入 `import { recordWin as recordStreakWin }` —— 左边的原名是真被引用了,
     * 右边只是本地别名,所以 `propertyName` 那一侧要算使用(本轮就漏判了连胜的记录点)。
     */
    (ts.isImportSpecifier(parent) && parent.propertyName !== node) ||
    ts.isImportClause(parent) ||
    ts.isExportSpecifier(parent) ||
    (ts.isPropertyAccessExpression(parent) && parent.name === node) ||
    (ts.isPropertyAssignment(parent) && parent.name === node) ||
    (ts.isPropertySignature(parent) && parent.name === node) ||
    (ts.isPropertyDeclaration(parent) && parent.name === node) ||
    (ts.isMethodDeclaration(parent) && parent.name === node) ||
    (ts.isMethodSignature(parent) && parent.name === node) ||
    (ts.isEnumMember(parent) && parent.name === node)
  )
}

interface DeadExport {
  name: string
  file: string
}

/** 全量扫描:顶层导出名 → 出现次数(声明处各计一次;spec 与运行时分开计) */
function scanExports(): {
  dead: DeadExport[]
  specOnly: DeadExport[]
  againDead: DeadExport[]
  scanned: number
  exports: number
} {
  const files = walk(SRC)
  const declarations = new Map<string, number>()
  const declFile = new Map<string, string>()
  /** 导出名 → 声明所在的绝对路径(判定"运行时模块"用) */
  const declPath = new Map<string, string>()
  const uses = new Map<string, number>()
  const specUses = new Map<string, number>()
  const bump = (m: Map<string, number>, k: string): void => void m.set(k, (m.get(k) ?? 0) + 1)

  for (const file of files) {
    const text = scriptOf(file)
    if (!text.trim()) continue
    const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
    const visit = (node: ts.Node): void => {
      const name =
        'name' in node && node.name && ts.isIdentifier(node.name as ts.Node) ? (node.name as ts.Identifier).text : null
      if (name && hasExportModifier(node)) {
        bump(declarations, name)
        if (!declFile.has(name)) declFile.set(name, posix(relative(SRC, file)))
        if (!declPath.has(name)) declPath.set(name, file)
      }
      if (ts.isVariableStatement(node) && hasExportModifier(node)) {
        for (const d of node.declarationList.declarations) {
          if (ts.isIdentifier(d.name)) {
            bump(declarations, d.name.text)
            if (!declFile.has(d.name.text)) declFile.set(d.name.text, posix(relative(SRC, file)))
            if (!declPath.has(d.name.text)) declPath.set(d.name.text, file)
          }
        }
      }
      ts.forEachChild(node, visit)
    }
    visit(sf)
    /**
     * .vue 的模板也要算:template 里的 {{ formatDate(...) }} 是真实使用,
     * 只解析 <script> 会把它们误判成"没人用"(本轮把 import 排除出"使用"后就暴露了这一点)。
     */
    if (file.endsWith('.vue')) {
      const template = readFileSync(file, 'utf8').replace(/<script[^>]*>[\s\S]*?<\/script>/g, '')
      /**
       * 只数**表达式里**的词 —— 整篇扫词会把 HTML 标签名当成标识符
       * (`<div>` 会让 gnum.div 看起来"有人在用",本轮就撞上了这一下)。
       */
      const exprs: string[] = []
      for (const m of template.matchAll(/\{\{([\s\S]*?)\}\}/g)) exprs.push(m[1]!)
      for (const m of template.matchAll(/(?::|@|v-)[\w.-]*="([^"]*)"/g)) exprs.push(m[1]!)
      for (const word of exprs.join('\n').match(/[A-Za-z_$][\w$]*/g) ?? []) bump(uses, word)
    }
  }

  for (const file of files) {
    const text = scriptOf(file)
    if (!text.trim()) continue
    const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
    const isSpec = file.endsWith('.spec.ts')
    const visit = (node: ts.Node): void => {
      if (ts.isIdentifier(node) && !(node.parent && isNonUseIdentifier(node, node.parent))) {
        bump(uses, node.text)
        if (isSpec) bump(specUses, node.text)
      }
      ts.forEachChild(node, visit)
    }
    visit(sf)
  }

  const dead: DeadExport[] = []
  const specOnly: DeadExport[] = []
  /**
   * 裸再导出的活死判据与普通导出**不同**,得单独收集。
   *
   * 一个 `export { gn }`(不带 from)并不声明名字,只是把本模块里已有的名字
   * 再许一个出口。它活着的唯一判据是:**有别的文件 import 它时走的是这个模块**。
   * 词离开了 origin 模块(如 '@/utils/gnum')、也不从本模块取,那这个再导出就是
   * 一层没人走的门面 —— 读者看见 `export { gn }` 会以为 gn 是这个模块的脸面,
   * 改了 origin 也没人拦。旧版审计完全看不见它们(ExportDeclaration 既不算声明
   * 也不算使用),腐烂的再导出就这么躲过了红线(本轮清掉的 14 个名字即此类)。
   *
   * 注意 `export { X } from './y'`(带 from 的转发)是另一回事:它是显式的
   * 门面转发,一眼看得出名字本尊住哪,不在本判据之内。
   */
  /** 谁从模块 M import 了哪些(原名)名字:moduleFile → Set(名字) */
  const importedFrom = new Map<string, Set<string>>()
  /**
   * 哪些名字以裸再导出出现在哪些模块里:moduleFile → Set(名字)。
   * 与 importedFrom 对照:再导出但没人从该模块 import —— 死门面。
   */
  const againExportedFrom = new Map<string, Set<string>>()
  /** 再导出名字对应的行号,报错时给精确位置:moduleFile → name → line */
  const againExportLine = new Map<string, Map<string, number>>()

  for (const file of files) {
    const text = scriptOf(file)
    if (!text.trim()) continue
    const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
    for (const stmt of sf.statements) {
      if (!ts.isImportDeclaration(stmt) || !stmt.importClause || !ts.isStringLiteral(stmt.moduleSpecifier)) continue
      const nb = stmt.importClause.namedBindings
      if (!nb || !ts.isNamedImports(nb)) continue
      const target = resolveImport(file, stmt.moduleSpecifier.text)
      if (!target) continue
      if (!importedFrom.has(target)) importedFrom.set(target, new Set())
      for (const el of nb.elements) {
        // 别名 `import { X as Y }` 里 X 才是这个模块真正拿出去的名字
        importedFrom.get(target)!.add(el.propertyName ? el.propertyName.text : el.name.text)
      }
    }
    const visit = (node: ts.Node): void => {
      if (ts.isExportDeclaration(node) && node.exportClause && ts.isNamedExports(node.exportClause) && !node.moduleSpecifier) {
        const line = sf.getLineAndCharacterOfPosition(node.getStart()).line + 1
        for (const el of node.exportClause.elements) {
          const name = el.name.text
          if (!againExportedFrom.has(file)) againExportedFrom.set(file, new Set())
          againExportedFrom.get(file)!.add(name)
          if (!againExportLine.has(file)) againExportLine.set(file, new Map())
          againExportLine.get(file)!.set(name, line)
        }
      }
      ts.forEachChild(node, visit)
    }
    visit(sf)
  }

  const againDead: DeadExport[] = []
  for (const [file, names] of againExportedFrom) {
    const got = importedFrom.get(file) ?? new Set()
    for (const name of names) {
      if (!got.has(name)) againDead.push({ name, file: `${posix(relative(SRC, file))}:${againExportLine.get(file)!.get(name)!}` })
    }
  }

  /**
   * 哪些模块是"运行时模块":从入口(main.ts)出发、沿 import 传递可达的那些。
   *
   * 两条走过的弯路:
   *   ① 用"某个导出被运行时用过"当判据 —— 审计模块常有一两个导出被界面借用,其余全是 spec-only,误报上百;
   *   ② 用"被非 spec 文件 import 过" —— `samsaraAudit` 这类只被 spec 引的模块会把它 import 的
   *      `progressionSim` 也带成"运行时",仍是误报。
   * 传递可达才算数:只从 spec 能被够到的模块,整份都是审计工具,不进这条红线。
   */
  function resolveImport(from: string, spec: string): string | null {
    const base = spec.startsWith('@/')
      ? join(SRC, spec.slice(2))
      : spec.startsWith('.')
        // Win 路径是 `\`,`lastIndexOf('/')` 恒为 -1 会把目录切成坏路径 —— 两种分隔符都找
        ? join(from.slice(0, Math.max(from.lastIndexOf('/'), from.lastIndexOf('\\'))), spec)
        : null
    if (!base) return null
    for (const cand of [base, `${base}.ts`, `${base}.vue`, join(base, 'index.ts')].map(posix)) {
      if (files.includes(cand)) return cand
    }
    return null
  }
  function importsOf(file: string): string[] {
    const sf = ts.createSourceFile(file, scriptOf(file), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
    const out: string[] = []
    for (const stmt of sf.statements) {
      if (ts.isImportDeclaration(stmt) && stmt.moduleSpecifier && ts.isStringLiteral(stmt.moduleSpecifier)) {
        const target = resolveImport(file, stmt.moduleSpecifier.text)
        if (target) out.push(target)
      }
    }
    return out
  }
  const runtimeModules = new Set<string>()
  const entry = posix(join(SRC, 'main.ts'))
  const queue = files.includes(entry) ? [entry] : []
  while (queue.length > 0) {
    const cur = queue.pop()!
    if (runtimeModules.has(cur)) continue
    runtimeModules.add(cur)
    for (const next of importsOf(cur)) if (!runtimeModules.has(next)) queue.push(next)
  }
  for (const [name, count] of declarations) {
    // 声明处自己占一次;≤ 声明次数 ⇒ 除此之外无人提及
    const total = uses.get(name) ?? 0
    const file = declFile.get(name) ?? '?'
    if (total <= count) {
      dead.push({ name, file })
      continue
    }
    // 只在 spec 里被用到(除声明外运行时零引用):若这个模块本身是运行时模块,就是"骨架信号"
    const specOnlyCount = specUses.get(name) ?? 0
    const runtimeUses = total - specOnlyCount
    const declRel = declFile.get(name) ?? ''
    if (runtimeModules.has(declPath.get(name) ?? '') && !AUDIT_MODULES.has(declRel) && runtimeUses <= count && specOnlyCount > 0) {
      specOnly.push({ name, file })
    }
  }
  const byName = (a: DeadExport, b: DeadExport): number => a.name.localeCompare(b.name)
  return {
    dead: dead.sort(byName),
    specOnly: specOnly.sort(byName),
    againDead: againDead.sort((a, b) => a.file.localeCompare(b.file) || a.name.localeCompare(b.name)),
    scanned: files.length,
    exports: declarations.size
  }
}

describe('死导出审计', () => {
  const { dead, specOnly, againDead, scanned, exports } = scanExports()
  const deadNames = dead.map(d => d.name)

  it('扫描确实跑起来了(空库不算通过)', () => {
    expect(scanned).toBeGreaterThan(200)
    expect(exports).toBeGreaterThan(500)
  })

  it('不新增死导出:写下的每个导出都得有人接', () => {
    const unexpected = dead.filter(d => !(d.name in ALLOWLIST))
    expect(
      unexpected.map(d => `${d.file} → ${d.name}`),
      '这些导出在 src 里除声明处外无人引用:接上它,或删掉它;确要保留请在 ALLOWLIST 写明原因'
    ).toEqual([])
  })

  it('豁免不常驻:已被接上的条目必须立即销账', () => {
    const stale = Object.keys(ALLOWLIST).filter(name => !deadNames.includes(name))
    expect(stale, '这些名字已经有人接了(或已删除):请从 ALLOWLIST 里删掉,名单不是博物馆').toEqual([])
  })

  /**
   * 「骨架空转」的判据:运行时模块里,只被 spec 用到的导出 = 声明在前、实现没跟。
   * 这一条要是早点有,短期秘境的骨架(createSecretRealm 只有 spec 在用)就不会躺四十轮,
   * 机缘弹窗、灵兽性格、装备共鸣那几处"活得却看不见"也会当场现形。
   *
   * 例外必须写明理由 —— 注意这些是**运行时模块**里的例外,纯审计模块不进这张表:
   * 一个模块若从没被运行时引用过,它整份都是审计工具,自然全是 spec-only。
   */
  const SPEC_ONLY_ALLOWLIST: Record<string, string> = {
    reliefKinds: '审计汇总:把灵根的劫型解法通道列出来,供渡劫审计与灵根角色审计读',
    winChanceFromRatio: '审计公式:胜率换算只作审计口径,不进战斗结算',
    lt: '数值原语:gNum 比较,供公式单调性用例读',
    gt: '数值原语:gNum 比较,与 lt 成对'
  }

  it('运行时模块里的导出,不能只被 spec 用到 —— 那是骨架空转的样子', () => {
    const unexpected = specOnly.filter(d => !(d.name in SPEC_ONLY_ALLOWLIST))
    expect(
      unexpected.map(d => `${d.file} → ${d.name}`),
      '这些导出只在 spec 里出现:要么接进游戏(像本轮的道侣因果、技艺表),要么删掉;确要保留请写明理由'
    ).toEqual([])
  })

  it('骨架豁免同样不常驻:已接上或已删除的,从名单销账', () => {
    const names = specOnly.map(d => d.name)
    const stale = Object.keys(SPEC_ONLY_ALLOWLIST).filter(n => !names.includes(n))
    expect(stale, '这些已经不再是"只在 spec 里出现"了:请从 SPEC_ONLY_ALLOWLIST 删掉').toEqual([])
  })

  /**
   * 裸再导出(`export { X }`,不带 from)的活死判据:
   * 有人从**本模块** import 到 X 才算活 —— 否则 X 的出口是 origin 模块,
   * 这层再导出是没人走的门面(本轮清掉 14 个,见各文件 diff)。
   *
   * 例外极少见,真要留也需要理由(如"为旧路径保留别名"),写进 AGAIN_ALLOWLIST。
   */
  const AGAIN_ALLOWLIST: Record<string, string> = {}

  it('裸再导出不能是死门面:`export { X }` 必须有人从本模块 import 走', () => {
    const unexpected = againDead.filter(d => !((d.file + ' → ' + d.name) in AGAIN_ALLOWLIST))
    expect(
      unexpected.map(d => `${d.file} → ${d.name}`),
      '这些名字被裸再导出,却没人从本模块 import:要么删掉这层再导出(名字本尊另有出处),要么把 import 改道走本模块'
    ).toEqual([])
  })

  it('裸再导出豁免不常驻:已接上或已删除的,从名单销账', () => {
    const keys = new Set(againDead.map(d => `${d.file} → ${d.name}`))
    const stale = Object.keys(AGAIN_ALLOWLIST).filter(k => !keys.has(k))
    expect(stale, '这些再导出已经有人从本模块 import(或已删除):请从 AGAIN_ALLOWLIST 销账').toEqual([])
  })
})
