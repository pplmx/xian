/* eslint-disable no-console -- 这个脚本的产物就是它打印出来的自检结果 */
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
import { existsSync, mkdtempSync, mkdirSync, readdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'

const ENGINE = resolve(import.meta.dirname, '..')
const DIST = resolve(ENGINE, 'dist')
for (const entry of ['index.js', 'index.d.ts', 'presets/demo.js', 'presets/xiuxian.js', 'presets/daily.js']) {
  assert.ok(existsSync(resolve(DIST, entry)), `产物缺文件:dist/${entry} —— 先跑 bun run build`)
}

const engine = await import(resolve(DIST, 'index.js'))
const { DEMO } = await import(resolve(DIST, 'presets/demo.js'))
const { XIUXIAN } = await import(resolve(DIST, 'presets/xiuxian.js'))
const { DAILY } = await import(resolve(DIST, 'presets/daily.js'))

/**
 * 组装指南自检 —— 文档里的每个 `create*` 与每个示例文件都必须真实存在。
 *
 * 为什么值得一条判据:指南是"照着抄"的东西,而文档最典型的腐烂方式就是**指向一个已经不存在的
 * 模块**(拆了、改名了、还没写),抄的人会先怀疑自己。这里把"提到的都得有"变成机器判据。
 */
{
  const doc = readFileSync(resolve(ENGINE, 'docs/assembly.md'), 'utf-8')
  const factories = new Set([...doc.matchAll(/`(create[A-Z]\w*)`/g)].map(m => m[1]))
  assert.ok(factories.size >= 8, '组装指南里应当指向足够多的模块(至少 8 个 create*)')
  for (const name of factories) {
    assert.ok(name in engine, `组装指南提到 ${name},但公开入口没有这个导出`)
  }
  const plainApis = new Set(
    [...doc.matchAll(/`(evalGoal|goalProgress|planIdle|runIdle|drawFrom|drawMany|snapshotOf|deltaSince|accrue|defineGame|defineSaveFormat|asRecord|composeCraftRate|softChance)`/g)].map(
      m => m[1]
    )
  )
  for (const name of plainApis) {
    assert.ok(name in engine, `组装指南提到 ${name},但公开入口没有这个导出`)
  }
  for (const [, example] of doc.matchAll(/(examples\/[\w.-]+\.ts)/g)) {
    assert.ok(existsSync(resolve(ENGINE, example)), `组装指南提到的示例不存在:${example}`)
  }
  for (const [, spec] of doc.matchAll(/`(\w+\.spec\.ts)`/g)) {
    // 用例可能在子目录里(如 presets/presets.spec.ts):按文件名整棵树找
    const found = readdirSync(resolve(ENGINE, 'src'), { recursive: true, encoding: 'utf-8' }).some(
      entry => typeof entry === 'string' && entry.endsWith(spec)
    )
    assert.ok(found, `组装指南提到的用例不存在:${spec}`)
  }
  console.log(`组装指南自检通过(${factories.size} 个工厂 + ${plainApis.size} 个工具 + 示例与用例路径)`)

  /**
   * 定制表自检 —— 「想改什么,改哪里」里,凡是**公开导出**的名字,都得有用例提到过。
   *
   * 为什么值得一条判据:那张表是使用者最先读的东西,也最容易"说得比做得多" —— 承诺"这个可以
   * 接管",但库里没有任何判据钉住它。这里不判断覆盖得好不好(那要看人),只拦最硬的一种:
   * **说了能改、却没有任何用例碰过**。
   *
   * 表原先住在 README,后来整节搬进 `docs/usage.md`(README 只留摘要与指针)—— 搬到哪儿,这条
   * 判据就跟到哪儿:文档可以挪,承诺不许丢。
   */
  const usage = readFileSync(resolve(ENGINE, 'docs/usage.md'), 'utf-8')
  const specDir = resolve(ENGINE, 'src')
  const specText = readdirSync(specDir, { recursive: true, encoding: 'utf-8' })
    .filter(entry => typeof entry === 'string' && entry.endsWith('.spec.ts'))
    .map(entry => readFileSync(resolve(specDir, entry), 'utf-8'))
    .join('\n')
  const tableStart = usage.indexOf('## 定制:想改什么,改哪里')
  assert.ok(tableStart >= 0, 'docs/usage.md 里找不到「定制:想改什么,改哪里」这一节')
  const tableEnd = usage.indexOf('\n## ', tableStart + 5)
  const table = usage.slice(tableStart, tableEnd)
  /**
   * 取每个反引号片段里最后一个标识符片段:`equipment.affixCountFn` → `affixCountFn`,
   * `'max'` 这类字面量会被跳过(不以字母开头)。
   */
  const promised = [
    ...new Set(
      [...table.matchAll(/`([^`]+)`/g)]
        .map(m => m[1].split('.').pop().trim())
        .filter(name => /^[A-Za-z_]\w*$/.test(name))
    )
  ]
  // 防空转:标题被改掉、正则失配时,这份自检会"通过"得毫无意义
  assert.ok(promised.length >= 40, `定制表只读出 ${promised.length} 个名字 —— 标题或表格结构变了?`)
  const unpinned = promised.filter(name => !specText.includes(name))
  assert.deepEqual(unpinned, [], `定制表承诺可改、却没有任何用例提到:${unpinned.join('、')}`)
  console.log(`定制表自检通过(${promised.length} 个名字,逐个都有用例提到)`)

  /**
   * 定制表旋钮自检 —— 表里写出来的**旋钮路径**必须真的在源码里存在。
   *
   * 上面那条管"表里的名字有用例提到",管不了另一种腐烂:表里写着 `realms.exp.costFn`,
   * 而源码里根本没有这个名字(改过名、还没实现、或者抄错了一层)。这张表就是"承诺"本身 ——
   * 承诺一个不存在的开关,读者会照着写,然后对着编译错误怀疑自己。
   *
   * 取值口径:反引号片段去掉尾巴上的调用糖 `(...)`,再取最后一个标识符段 ——
   * `realms.breakthrough.rateFn(major, layer)` → `rateFn`;`'max'` 这类字面量不以字母开头,跳过。
   * 只查"存在"(不查类型与签名,那是使用者侧 `tsc` 与用例的事)。
   */
  const srcText = readdirSync(resolve(ENGINE, 'src'), { recursive: true, encoding: 'utf-8' })
    .filter(entry => typeof entry === 'string' && entry.endsWith('.ts') && !entry.endsWith('.spec.ts'))
    .map(entry => readFileSync(resolve(specDir, entry), 'utf-8'))
    .join('\n')
  const knobs = [
    ...new Set(
      [...table.matchAll(/`([^`\n]+)`/g)]
        .map(m => m[1].trim().replace(/\([^()]*\)\s*$/, '').split('.').pop().trim())
        .filter(name => /^[A-Za-z_]\w*$/.test(name))
    )
  ]
  // 防空转:与上面那条同源,读不出东西就说明表格结构变了
  assert.ok(knobs.length >= promised.length, `定制表旋钮只读出 ${knobs.length} 个 —— 表格结构变了?`)
  const phantom = knobs.filter(name => !new RegExp(`\\b${name}\\b`).test(srcText))
  assert.deepEqual(phantom, [], `定制表承诺的旋钮在源码里找不到:${phantom.join('、')}`)
  console.log(`定制表旋钮自检通过(${knobs.length} 个旋钮在源码里都存在)`)

  /**
   * 报错口径自检 —— 源码里的**每一条 `throw` 都得有人真的触发过**。
   *
   * 为什么值得一条判据:审计时发现 23 处抛错里 15 处没有任何用例触发过。两个后果都不是小事:
   * **报错可能早就不会走到了**(参数改名、校验挪位置之后那句 throw 成了死代码,使用者写错配置
   * 不再被拦住,而是拿到一个 NaN 或者半装好的世界),以及**文案会悄悄漂移** ——
   * 文案本身就是给人看的,内容作者看到的第一句话往往就是它。
   *
   * 取值口径:模板串按 `${…}` 切开,取**最长的那一段字面量**(去掉首尾空白与破折号),
   * 要求长度 ≥ 4 —— 因为有些报错以插值开头(`属性系统:${key} 的 …`),只取前缀会退化成
   * "属性系统"这四个字,谁都能满足。最长段才是这句话里最认得出的部分。
   */
  const throwMessages = new Set()
  const throwFiles = readdirSync(resolve(ENGINE, 'src'), { recursive: true, encoding: 'utf-8' }).filter(
    entry => typeof entry === 'string' && entry.endsWith('.ts')
  )
  for (const rel of throwFiles) {
    if (rel.endsWith('.spec.ts')) continue
    const text = readFileSync(resolve(ENGINE, 'src', rel), 'utf-8')
    for (const m of text.matchAll(/throw new Error\((?:`([^`]*)`|'([^']*)'|"([^"]*)")\)/g)) {
      const raw = m[1] ?? m[2] ?? m[3] ?? ''
      const longest = raw
        .replace(/\\n/g, ' ')
        .split(/\$\{[^}]*\}/)
        .map(part => part.replace(/^[\s:、,——-]+|[\s:、,——-]+$/g, ''))
        .sort((a, b) => b.length - a.length)[0]
      if (longest !== undefined && longest.length >= 4) throwMessages.add(longest)
    }
  }
  assert.ok(throwMessages.size >= 20, `只从源码里读出 ${throwMessages.size} 条报错 —— throw 的写法变了?`)
  // 匹配留一点余地:模板串切开之后,有些段会带一个多余的虚词(如"的 appliesTo 指向…"),
  // 所以"整段命中"或"去掉首字命中"都算 —— 判据要拦的是"没人触发过",不是"措辞一字不差"
  const untriggered = [...throwMessages].filter(
    message => !specText.includes(message) && !specText.includes(message.slice(1))
  )
  assert.deepEqual(untriggered, [], `这些报错没有任何用例触发过(可能早就走不到,或者文案已经漂了):${untriggered.join('、')}`)
  console.log(`报错口径自检通过(${throwMessages.size} 条报错都有人真的触发过)`)

  /**
   * 版本引用自检 —— 文档里指向的那个 tag,必须就是 `package.json` 里的版本。
   *
   * 为什么值得一条判据:使用者拿到库的第一件事就是**照抄安装那一行**
   * (`bun add github:pplmx/wanxiang-engine#v0.1.18`)。发版时改了 `package.json` 却漏改文档,
   * 那句命令要么指向一个不存在的 tag,要么把他按在一个旧版本上 —— 而这两件事都不会有任何报错。
   * 版本号在库里出现在四个地方(README 的安装块 / README 的版本块 / development.md 的安装块 /
   * development.md 的 npm pack 例),人工同步迟早会漏,这里一次全查。
   *
   * CHANGELOG 不算:那里出现的历史版本号是**应该**不一样的。
   */
  const version = JSON.parse(readFileSync(resolve(ENGINE, 'package.json'), 'utf-8')).version
  const versionDocs = ['README.md', ...readdirSync(resolve(ENGINE, 'docs')).map(name => `docs/${name}`)].filter(
    rel => !rel.endsWith('CHANGELOG.md')
  )
  const versionRefs = []
  for (const rel of versionDocs) {
    const text = readFileSync(resolve(ENGINE, rel), 'utf-8')
    for (const m of text.matchAll(/#v(\d+\.\d+\.\d+)/g)) versionRefs.push([rel, m[1]])
    for (const m of text.matchAll(/wanxiang-engine-(\d+\.\d+\.\d+)\.tgz/g)) versionRefs.push([rel, m[1]])
    for (const m of text.matchAll(/当前版本 \*\*(\d+\.\d+\.\d+)\*\*/g)) versionRefs.push([rel, m[1]])
    // release 附件的下载路径也在引用版本号(装了才发现对不上就晚了)
    for (const m of text.matchAll(/releases\/download\/v(\d+\.\d+\.\d+)\//g)) versionRefs.push([rel, m[1]])
  }
  assert.ok(versionRefs.length >= 4, `只找到 ${versionRefs.length} 处版本引用 —— 文档改了写法?`)
  const stale = versionRefs.filter(([, v]) => v !== version).map(([rel, v]) => `${rel} 写的是 ${v}`)
  assert.deepEqual(stale, [], `这些文档里的版本与 package.json(${version})不一致:${stale.join('、')}`)
  console.log(`版本引用自检通过(${versionRefs.length} 处引用都是 ${version})`)

  /**
   * 文档链接自检 —— 文档里指向仓库的**绝对链接**必须真的存在。
   *
   * 为什么值得一条判据:文档里那些"可跑的证据"(示例与用例)都在仓库里、**不随包发布**,
   * 所以它们一律写成指回仓库的绝对链接 —— 这样包的读者也点得开。代价是:改文件名、挪目录之后,
   * 这些链接会静默变成 404,而 Markdown 里没有任何东西会因此变红。这里就把"链接指向的路径
   * 在仓库里存在"变成判据(blob → 文件,tree → 目录)。
   */
  const linkDocs = ['README.md', ...readdirSync(resolve(ENGINE, 'docs')).map(name => `docs/${name}`)]
  const base = 'https://github.com/pplmx/wanxiang-engine'
  let linkCount = 0
  const deadLinks = []
  for (const rel of linkDocs) {
    const text = readFileSync(resolve(ENGINE, rel), 'utf-8')
    // 目标在 `)`、空白或 `>`(被 <…> 包起来的自动链接)处结束
    for (const m of text.matchAll(new RegExp(`${base}/(blob|tree)/main/([^)\\s>]+)`, 'g'))) {
      const [, kind, target] = m
      linkCount += 1
      const path = target.replace(/[#?].*$/, '')
      const full = resolve(ENGINE, path)
      const ok = kind === 'blob' ? existsSync(full) && statSync(full).isFile() : existsSync(full)
      if (!ok) deadLinks.push(`${rel} → ${path}`)
    }
  }
  assert.ok(linkCount >= 20, `只找到 ${linkCount} 条仓库链接 —— 链接写法变了?`)
  assert.deepEqual(deadLinks, [], `这些文档链接指向仓库里不存在的地方:${deadLinks.join('、')}`)
  console.log(`文档链接自检通过(${linkCount} 条指回仓库的链接都指向真实文件)`)

  /**
   * 目录树自检 —— README 里那棵树是使用者的地图,它必须**和仓库逐项对得上**。
   *
   * 两边都拦:新加一个模块却忘了写进树(地图少一块,读者以为库里没有这层),
   * 或者改了名/删了文件却没改树(地图指向不存在的路,照着找的人先怀疑自己)。
   * 树上的文档清单同理 —— `docs/` 下每份文档都得在地图上。
   */
  const readme = readFileSync(resolve(ENGINE, 'README.md'), 'utf-8')
  const treeBlock = readme.match(/```\n(packages\/engine\/[\s\S]*?)```/)
  assert.ok(treeBlock, 'README 里找不到 packages/engine/ 的目录树代码块')
  const tree = treeBlock[1]
  const listedModules = [...tree.matchAll(/^ {4}([A-Za-z]\w*)\.ts\b/gm)].map(m => m[1])
  const actualModules = readdirSync(resolve(ENGINE, 'src'))
    .filter(name => name.endsWith('.ts') && !name.endsWith('.spec.ts'))
    .map(name => name.replace(/\.ts$/, ''))
  assert.deepEqual(
    [...listedModules].sort(),
    [...actualModules].sort(),
    'README 的目录树与 src/ 下的模块文件对不上(少列了模块,或列了不存在的文件)'
  )
  const listedDocs = [...tree.matchAll(/(\w+)\.md/g)].map(m => m[1])
  const actualDocs = readdirSync(resolve(ENGINE, 'docs')).map(name => name.replace(/\.md$/, ''))
  for (const doc of actualDocs) {
    assert.ok(listedDocs.includes(doc), `README 的目录树里没有列 docs/${doc}.md`)
  }
  /**
   * README 自己写的**数量**也要对上:正文里那句"`src/` 下 N 个模块文件(另有 M 份内容包)"
   * 是读者建立规模感的第一句话,而它不在那棵代码块里,上面的树比不到它 —— 实测它已经漂过一次
   * (写着 36、实际 38)。所以顺手一起查:数字改成手写的那一天起,就得有人盯着。
   */
  const countClaim = readme.match(/\`src\/\` 下 (\d+) 个模块文件[^(]*\(另有 (\d+) 份内容包\)/)
  assert.ok(countClaim, 'README 里找不到"src/ 下 N 个模块文件(另有 M 份内容包)"这句 —— 措辞改了?')
  assert.equal(Number(countClaim[1]), actualModules.length, `README 说 ${countClaim[1]} 个模块文件,实际 ${actualModules.length} 个`)
  const actualPresets = readdirSync(resolve(ENGINE, 'src/presets')).filter(
    name => name.endsWith('.ts') && !name.endsWith('.spec.ts')
  ).length
  assert.equal(Number(countClaim[2]), actualPresets, `README 说 ${countClaim[2]} 份内容包,实际 ${actualPresets} 份`)
  console.log(`目录树自检通过(${listedModules.length} 个模块文件 + ${actualDocs.length} 份文档都在图上,正文的数量也对得上)`)

  /**
   * 用例数自检 —— README 里那行"N 个用例 / M 个文件",文件数不许写错。
   *
   * 用例数每次加用例都会变,人工同步迟早会漏;但**文件数**是静态可数的,盯住它就能拦住
   * 最常见的那种漂移(加了新 spec 文件但没改 README)。用例数仍靠人写,写的时候顺手跑一次
   * `bun run test` 核对 —— 这条自检只保证"分母没写错"。
   */
  const specFiles = readdirSync(resolve(ENGINE, 'src'), { recursive: true, encoding: 'utf-8' }).filter(
    entry => typeof entry === 'string' && entry.endsWith('.spec.ts')
  ).length
  const countRow = readme.match(/(\d+) 个用例 \/ (\d+) 个文件/)
  assert.ok(countRow, 'README 的判据表里找不到"用例 / 文件"那一行')
  assert.equal(Number(countRow[2]), specFiles, `README 写的用例文件数与实际不符(实际 ${specFiles} 个)`)
  console.log(`用例数自检通过(README 写的 ${countRow[2]} 个用例文件与实际一致)`)

  /**
   * 调参参考自检 —— `docs/tuning.md` 必须**收全**每一份消融实验。
   *
   * 消融实验的价值在于"量出来的数字有人看得到";新加一份却忘了收进参考表,就等于白量。
   * 这条自检反向掐住它:凡是 `src/*.sim.spec.ts`,参考表里必须点名一份(顺带保证点到的文件存在)。
   */
  const tuning = readFileSync(resolve(ENGINE, 'docs/tuning.md'), 'utf-8')
  const simSpecs = readdirSync(resolve(ENGINE, 'src'))
    .filter(name => name.endsWith('.sim.spec.ts'))
    .sort()
  assert.ok(simSpecs.length >= 4, `消融实验只有 ${simSpecs.length} 份 —— 目录或命名变了?`)
  const missing = simSpecs.filter(name => !tuning.includes(name))
  assert.deepEqual(missing, [], `这些消融实验还没收进 docs/tuning.md:${missing.join('、')}`)
  for (const [, spec] of tuning.matchAll(/`(src\/\w+\.sim\.spec\.ts)`/g)) {
    assert.ok(simSpecs.includes(spec.replace('src/', '')), `调参参考指向了不存在的用例:${spec}`)
  }
  /**
   * 一页索引自检 —— 文首那张"你要调的那件事在哪一节"的表,必须**一节课一行**。
   *
   * 参考表长到二十多节之后,"收全了"还不够用:得让人在半分钟内找到自己那一行。
   * 所以这一条盯两件事:①索引行数 = 消融份数(不许有节漏进索引);
   * ②每个小节的标题都在索引里被点名(标题改了、索引没改,也会红)。
   */
  const indexStart = tuning.indexOf('## 一页索引')
  assert.ok(indexStart >= 0, 'docs/tuning.md 里找不到「一页索引」那一节')
  const indexEnd = tuning.indexOf('\n## ', indexStart + 5)
  const indexBlock = tuning.slice(indexStart, indexEnd < 0 ? undefined : indexEnd)
  const indexRows = [...indexBlock.matchAll(/^\| (?!---)/gm)].length - 1 // 去掉表头那一行
  assert.equal(indexRows, simSpecs.length, `一页索引有 ${indexRows} 行,但消融有 ${simSpecs.length} 份 —— 有节没进索引?`)
  const sectionTitles = [...tuning.matchAll(/^## (?!一页索引|怎么自己复现)(.+)$/gm)].map(line =>
    line[1].replace(/\s*\(`[^`]+`\)\s*$/, '').trim()
  )
  const missingFromIndex = sectionTitles.filter(title => !indexBlock.includes(title))
  assert.deepEqual(missingFromIndex, [], `这些小节没进一页索引:${missingFromIndex.join('、')}`)
  console.log(`调参参考自检通过(${simSpecs.length} 份消融都在 docs/tuning.md,且一页索引逐节点名)`)

  /**
   * 相对导入自检 —— 源码里的相对导入必须带 `.js` 扩展名。
   *
   * 为什么这条值得单独立判据:它只在**产物**里现形,而且只对一类使用者现形 ——
   * `moduleResolution: node16 / nodenext` 的人。TS 会把源码的导入原样搬进 `.d.ts`,
   * 少一个 `.js`,`skipLibCheck: false` 的消费者就一编译就红(TS2835),
   * 而发版这边一切正常(库自己的构建与用例都过得去)。
   * 这次就是这么发现的:`companions.ts` 里一句 `from './attributes'` 漏了扩展名。
   */
  const srcFiles = readdirSync(resolve(ENGINE, 'src'), { recursive: true, encoding: 'utf-8' }).filter(
    entry => typeof entry === 'string' && entry.endsWith('.ts')
  )
  const badSpecs = []
  for (const file of srcFiles) {
    const text = readFileSync(resolve(ENGINE, 'src', file), 'utf-8')
    for (const [, spec] of text.matchAll(/from\s+'(\.[^']*)'/g)) {
      if (!spec.endsWith('.js')) badSpecs.push(`${file} → ${spec}`)
    }
  }
  assert.deepEqual(badSpecs, [], `这些相对导入少了 .js 扩展名(消费者用 node16 解析时会红):${badSpecs.join('、')}`)
  console.log(`相对导入自检通过(${srcFiles.length} 个源文件里的相对导入都带 .js)`)

  /**
   * 公开面行为判据自检 —— **每个运行时导出都得有人真用过**。
   *
   * 公开面清单(`publicApi.spec.ts`)只回答"名字还在不在",回答不了"这个名字背后的行为有没有人试过":
   * 改名会红,但边界写错不会。这次审计就是冲着这个缝来的 —— 75 个导出里有 9 个
   * (`clamp` / `formatAmount` / `numberNumeric` / `mulberry32` / `seedFromString` / `randomRng` /
   * `DEFAULT_ATTRIBUTES` / `DEFAULT_LAYER_NAMES` / `progressText`)从没被任何用例或示例碰过,
   * 只在名字清单里露过面。现在它们各有一条判据(`src/publicBehavior.spec.ts`),
   * 而这条自检负责让"下回再冒出一个"的当场红。
   *
   * 扫的是**去掉注释**之后的用例与示例正文(排除只罗列名字的 `publicApi.spec.ts`),
   * 所以"在注释里提了一句"不算用过。
   */
  /**
   * 去掉注释、import 行与字符串字面量:只留**代码位置上的标识符**。
   *
   * 为什么要做到这么细:一条 `import { clamp } from './numeric.js'`、一句测试标题里提到名字、
   * 或者文档字符串里写过它 —— 这三种都不等于"有人真用过",而它们都能骗过朴素的包含判断。
   * 去掉之后仍能匹配到,才是真的在调用/引用。
   */
  const stripComments = text =>
    text
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/[^\n]*/g, '')
      .replace(/^\s*import[\s\S]*?from\s*'[^']*'/gm, '')
      .replace(/^\s*import\s*'[^']*'/gm, '')
      .replace(/'(?:[^'\\]|\\.)*'/g, "''")
      .replace(/"(?:[^"\\]|\\.)*"/g, '""')
      .replace(/`(?:[^`\\]|\\.)*`/g, '``')
  const usageText = [
    ...readdirSync(resolve(ENGINE, 'src'))
      .filter(name => name.endsWith('.spec.ts') && name !== 'publicApi.spec.ts')
      .map(name => stripComments(readFileSync(resolve(ENGINE, 'src', name), 'utf-8'))),
    ...readdirSync(resolve(ENGINE, 'examples'))
      .filter(name => name.endsWith('.ts'))
      .map(name => stripComments(readFileSync(resolve(ENGINE, 'examples', name), 'utf-8')))
  ].join('\n')
  const exportNames = Object.keys(engine)
  const unusedExports = exportNames.filter(name => !new RegExp(`\\b${name}\\b`).test(usageText))
  assert.deepEqual(
    unusedExports,
    [],
    `这些导出没有任何行为性用例或示例用过(只出现在 publicApi.spec 的名字清单里):${unusedExports.join('、')}`
  )
  console.log(`公开面行为判据自检通过(${exportNames.length} 个导出都有人真用过)`)

  /**
   * 公开面数量自检 —— README 里那两个数(运行时导出 / 公开类型)必须是真的。
   *
   * 为什么值得一条判据:"N 个运行时导出 + M 个公开类型一字不差"是 README 里最有说服力、
   * 也最容易腐烂的一句 —— 实测它漂过:CHANGELOG 的版本口径那行还写着 75 / 203,
   * 而 README 写 77 / 211(那时实际已是 78 / 212)。数量是**读者建立信任的第一眼**,
   * 差一个就说明有东西改了没人管。
   *
   * 两个数都当场数出来:运行时导出 = `Object.keys(公开入口)`;
   * 公开类型 = `publicApi.spec.ts` 里那份 `import type { … } from './index.js'` 清单的条目数 ——
   * 那份清单的职责就是"每个模块的公开类型都从公开入口取得到",它的条目数就是公开类型的条目数。
   */
  const faceReadme = readFileSync(resolve(ENGINE, 'README.md'), 'utf-8')
  const runtimeCount = Object.keys(engine).length
  const apiSource = readFileSync(resolve(ENGINE, 'src/publicApi.spec.ts'), 'utf-8')
  const typeBlock = apiSource.match(/import type \{([\s\S]*?)\} from '\.\/index\.js'/)
  assert.ok(typeBlock, "publicApi.spec.ts 里找不到 import type { … } from './index.js' 那一块 —— 写法变了?")
  const typeCount = typeBlock[1].split(',').filter(entry => entry.trim().length > 0).length
  const faceClaim = faceReadme.match(/(\d+) 个运行时导出 \+ (\d+) 个公开类型/)
  assert.ok(faceClaim, 'README 里找不到"N 个运行时导出 + M 个公开类型"那句 —— 措辞改了?')
  assert.equal(Number(faceClaim[1]), runtimeCount, `README 说 ${faceClaim[1]} 个运行时导出,实际 ${runtimeCount} 个`)
  assert.equal(Number(faceClaim[2]), typeCount, `README 说 ${faceClaim[2]} 个公开类型,实际清单里 ${typeCount} 条`)
  console.log(`公开面数量自检通过(${runtimeCount} 个运行时导出 + ${typeCount} 个公开类型,与 README 写的一致)`)

  /**
   * 模块速查覆盖自检 —— 每个模块文件都得在 `docs/usage.md` 的模块表里找得到。
   *
   * 这份表是使用者"要找某一层时"的入口:新加一个模块却忘了写进去,等于这层不存在
   * (只在地图的目录树里露脸,没有"它回答什么问题"那一行)。锚点用**中文主题或代表入口**
   * 写成一张显式的表 —— 因为好些模块是通过 `game.*` 用的,不是靠 `create*` 名字找。
   */
  const MODULE_ANCHORS = {
    'realms.ts': 'game.realms',
    'attributes.ts': 'game.attributes',
    'rng.ts': 'mulberry32',
    'equipment.ts': 'game.equipment',
    'holding.ts': 'createHoldingSystem',
    'dungeons.ts': 'game.dungeons',
    'combat.ts': 'game.combat',
    'skills.ts': 'createSkillSystem',
    'crafting.ts': 'composeCraftRate',
    'recipes.ts': 'createRecipeRunner',
    'goals.ts': 'evalGoal',
    'deck.ts': 'drawFrom',
    'companions.ts': 'createCompanionSystem',
    'idle.ts': 'planIdle',
    'progression.ts': 'createProgressionAudit',
    'save.ts': 'defineSaveFormat',
    'saveShape.ts': 'asRecord',
    'numeric.ts': 'Numeric<T>',
    'config.ts': 'defineGame',
    'resources.ts': 'createResourceSystem',
    'triage.ts': 'createTriage',
    'cycles.ts': 'createCycleSystem',
    'choices.ts': 'createChoiceSystem',
    'codex.ts': 'createCodex',
    'memory.ts': 'createStageMemory',
    'economy.ts': 'createEconomyReadings',
    'intake.ts': 'createIntake',
    'settlement.ts': 'createSettlement',
    'drops.ts': 'createDropTable',
    'buffs.ts': 'createBuffSystem',
    'facilities.ts': 'createFacilitySystem',
    'points.ts': 'createPointPool',
    'tasks.ts': 'createTaskBoard',
    'counters.ts': 'snapshotOf',
    'chain.ts': 'createChain',
    'pity.ts': 'createPityCounter',
    'unlocks.ts': 'createUnlockRegistry',
    'presets/': '内容包'
  }
  const moduleFiles = readdirSync(resolve(ENGINE, 'src'), { recursive: true, encoding: 'utf-8' }).filter(
    entry => typeof entry === 'string' && (entry.endsWith('.ts') || entry.endsWith('/')) && !entry.endsWith('.spec.ts')
  )
  const uncovered = Object.entries(MODULE_ANCHORS).filter(([, anchor]) => !usage.includes(anchor)).map(([file]) => file)
  assert.deepEqual(uncovered, [], `这些模块没有出现在 docs/usage.md 的模块表里:${uncovered.join('、')}`)
  assert.ok(uncovered.length === 0 && Object.keys(MODULE_ANCHORS).length >= 36, '模块锚点表少写了一项?')
  // 反向:锚点表里的模块文件必须真实存在(改了名/删了文件时要跟着改)
  for (const file of Object.keys(MODULE_ANCHORS)) {
    const exists = moduleFiles.some(entry => entry === file || entry.startsWith(file))
    assert.ok(exists, `模块锚点表里写了不存在的模块:${file}`)
  }
  console.log(`模块速查覆盖自检通过(${Object.keys(MODULE_ANCHORS).length} 个模块都在 docs/usage.md 里)`)

  /**
   * 示例覆盖自检 —— **每个模块都得有一份示例走到**。
   *
   * 这条判据是"示例该写到什么程度"的收口:示例承诺的是"每个模块至少有一条能跑的路径",
   * 而不是"75 个导出逐个都有一行示例"(导出层面的行为由各模块自己的用例与
   * `publicBehavior.spec.ts` 钉住, 见 `docs/development.md`)。
   *
   * 为什么还是要立这条:审计时发现 `realms` 与 `numeric` 两个模块**零示例** ——
   * 一个是等级体系的正门、一个是换大数实现的口子,而上面两道判据(名字清单、用例)
   * 都发现不了"整个模块没人用过"。内容包(`presets/`)另算出处:示例里 import 过,
   * 或 README / 模块速查的装配片段里写着(三份内容包本来就有一份不进示例 ——
   * "不引用任何内容包"的那份示例正是要证明这件事)。
   */
  const exampleCode = readdirSync(resolve(ENGINE, 'examples'))
    .filter(name => name.endsWith('.ts'))
    .map(name => stripComments(readFileSync(resolve(ENGINE, 'examples', name), 'utf-8')))
    .join('\n')
  const presetDocs = [readFileSync(resolve(ENGINE, 'README.md'), 'utf-8'), usage].join('\n')
  /** 一个模块导出的名字(够用即可:函数/常量/类/类型 + `export { … }` 两种写法都算) */
  const exportNamesOf = rel => {
    const text = readFileSync(resolve(ENGINE, rel), 'utf-8')
    const names = new Set()
    for (const m of text.matchAll(/^export\s+(?:async\s+)?(?:function|class|const|let|var|interface|type|enum)\s+([A-Za-z0-9_$]+)/gm)) {
      names.add(m[1])
    }
    for (const m of text.matchAll(/^export\s*\{([^}]*)\}/gm)) {
      for (const part of m[1].split(',')) {
        const name = part.split(/\s+as\s+/).pop().trim()
        if (name) names.add(name)
      }
    }
    return [...names]
  }
  const usedIn = (names, text) => names.some(name => new RegExp(`\\b${name}\\b`).test(text))
  const sourceModules = readdirSync(resolve(ENGINE, 'src'))
    .filter(name => name.endsWith('.ts') && !name.endsWith('.spec.ts') && name !== 'index.ts')
    .map(name => `src/${name}`)
  const presetModules = readdirSync(resolve(ENGINE, 'src/presets'))
    .filter(name => name.endsWith('.ts') && !name.endsWith('.spec.ts'))
    .map(name => `src/presets/${name}`)
  const noExample = sourceModules.filter(rel => !usedIn(exportNamesOf(rel), exampleCode))
  assert.deepEqual(noExample, [], `这些模块在 examples/ 里一个导出都没用到(整个模块没有能跑的路径):${noExample.join('、')}`)
  const orphanPresets = presetModules.filter(rel => !usedIn(exportNamesOf(rel), exampleCode + presetDocs))
  assert.deepEqual(orphanPresets, [], `这些内容包既没进示例、也没进 README / docs/usage.md 的装配片段:${orphanPresets.join('、')}`)
  console.log(`示例覆盖自检通过(${sourceModules.length} 个模块都有示例走到 + ${presetModules.length} 份内容包有出处)`)
}

// 装配 + 走一圈:光能 import 不够,导出得真的能用
const game = engine.defineGame(DEMO)
assert.equal(game.realms.label(0, 0), '见习船员 I 阶')
assert.equal(game.attributes.name('attack'), '火力')
const loot = game.equipment.generate(engine.createRng('verify'), { tier: 1 })
assert.ok(game.equipment.resolve(loot).template, '掉出来的装备应当能解析')
assert.equal(engine.defineGame(XIUXIAN).realms.realms.length, 21)

// 第三个题材(与战斗/修仙都无关的那份)也要能装起来走一圈 —— 通用性不是"两份预设恰好像",
// 而是"没有任何战斗世界观的题材,同一套内核照样跑完升级 → 掉装备 → 遭遇 → 通关结算"。
{
  const game = engine.defineGame(DAILY)
  assert.equal(game.realms.label(0, 0), '启蒙班·第一周')
  assert.equal(game.attributes.name('attack'), '专注力')
  const rng = engine.createRng('书桌')
  const state = game.realms.addExp({ major: 0, layer: 0, exp: 0 }, Number(game.realms.expCost(0, 0)))
  assert.equal(game.realms.progress(state).ready, true)
  const loot = game.equipment.generate(rng, { tier: 1 })
  const resolved = game.equipment.resolve(loot)
  assert.ok(resolved.template, '掉出来的文具应当能解析')
  const loadout = game.equipment.equip({ equipped: {} }, loot)
  const equipped = game.equipment.resolveLoadout(loadout, new Map([[loot.uid, loot]]))
  const stats = game.attributes.compute({
    base: game.realms.baseStats(0, 0),
    flat: equipped.flats,
    modSources: [equipped.mods, resolved.mods]
  })
  const region = game.dungeons.firstRegion()
  assert.equal(region.name, '图书馆')
  const encounter = game.dungeons.nextEncounter(region.id, engine.emptyProgress(), rng)
  const foe = game.dungeons.snapshot(encounter.enemyId)
  const battle = game.combat.resolve(
    {
      id: 'me',
      name: '我',
      stats: {
        hp: stats.final.maxHp ?? 0,
        maxHp: stats.final.maxHp ?? 0,
        attack: stats.final.attack ?? 0,
        defense: stats.final.defense ?? 0,
        speed: 1
      },
      mods: stats.mods
    },
    { id: foe.id, name: foe.name, stats: foe.stats, mods: foe.mods, skills: foe.skills },
    rng
  )
  assert.ok(battle.events.length > 0, '这一场得有过程')
  const outcome = game.dungeons.onVictory(region.id, { ...encounter, kind: 'boss' }, engine.emptyProgress(), rng)
  assert.equal(outcome.firstClear, true)
  assert.ok(outcome.rewards.length > 0, '通关要给点东西(哪怕是"理解"与零花钱)')
}

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

// 发布包里该有什么:产物 + 说明 + 变更记录 + 文档。少一样,使用者就只拿到半个包。
const installed = resolve(nm, 'wanxiang-engine')
for (const required of [
  'dist/index.js',
  'dist/index.d.ts',
  'dist/presets/daily.js',
  'package.json',
  'README.md',
  'CHANGELOG.md',
  'LICENSE',
  'docs/usage.md',
  'docs/assembly.md',
  'docs/tuning.md',
  'docs/parity.md',
  'docs/development.md'
]) {
  assert.ok(existsSync(resolve(installed, required)), `发布包里少了 ${required}`)
}
assert.ok(!existsSync(resolve(installed, 'src')), '发布包里混进了源码目录 —— 对外只该发 dist 与说明')

const consumerProbe = `
  const assert = (await import('node:assert/strict')).default
  const engine = await import('wanxiang-engine')
  const { DEMO } = await import('wanxiang-engine/presets/demo')
  const { DAILY } = await import('wanxiang-engine/presets/daily')
  const game = engine.defineGame(DEMO)
  assert.equal(game.realms.label(0, 0), '见习船员 I 阶')
  assert.equal(engine.defineGame(DAILY).realms.label(8, 5), '高三·期末')
  assert.equal(typeof engine.defineGame, 'function')
  console.log('   按包名 import 通过(含两份子路径内容包)')

  /**
   * 从零装一个世界 —— **不碰任何内容包**,只用包名导出的东西装配一份新题材。
   *
   * 这一段的用意:前面两项验的是"包里带的东西能用",这一段验的是"**别人自己写一份也能用**"。
   * 内容包是样例,真正要证明的是"槽位/品质/词条/区域/敌人都是内容,写一份就有一款游戏"。
   */
  const SLOTS = [
    { id: 'weapon', name: '靴子', order: 1 },
    { id: 'body', name: '邮包', order: 2 }
  ]
  const mine = engine.defineGame({
    name: '边境邮差(发布包冷启动)',
    attributes: { defs: engine.attributeDefs({ rename: { attack: '脚力', defense: '耐力', maxHp: '体力' } }) },
    realms: {
      worlds: [{ id: 'plain', name: '平原路', realms: ['送信学徒', '熟路邮差'] }],
      layerNames: ['第一段', '第二段'],
      labelFormat: '{realm}·{layer}',
      exp: { base: 25, realmGrowth: 5, layerGrowth: 1.3, worldStepMult: 1.9 },
      combat: { base: { attack: 11, defense: 6, maxHp: 110 }, realmGrowth: 3.2, layerGrowth: 1.12 },
      breakthrough: { layerBase: 0.94, layerDecay: 0.04, majorBase: 0.72, majorDecay: 0.07, min: 0.2, max: 0.98 }
    },
    equipment: {
      slots: SLOTS,
      qualities: [{ id: 'cloth', name: '粗布', rank: 0, mult: 1, affixes: [0, 1], fromTier: 1, toTier: 8, weight: 300 }],
      templates: engine.generateTemplates({
        slots: SLOTS,
        baseBySlot: { weapon: { attack: 5 }, body: { defense: 4, maxHp: 16 } },
        tiers: [['旧布鞋', '帆布邮包'], ['量脚皮靴', '防水邮包']]
      }),
      affixes: [{ id: 'swift', name: '疾行', key: 'attackPct', min: 3, max: 8, weight: 100, desc: '脚力提升 {v}%' }],
      power: { tierGrowth: 2, baseFactor: 0.6, qualityExponent: 1.6 },
      affixValueScale: 100
    },
    dungeons: {
      regions: [{ id: 'plainroad', name: '平原官道', tier: 1, minRealm: 0, enemies: ['mud'], boss: 'flooded' }],
      enemies: [
        { id: 'mud', name: '烂泥路', tier: 1, hpMult: 1, atkMult: 1, defMult: 1, speed: 1 },
        { id: 'flooded', name: '冲垮的桥', tier: 1, hpMult: 3, atkMult: 1.25, defMult: 1.2, speed: 1, boss: true }
      ],
      bossProgress: 2,
      bossRhythm: 'once',
      enemyPower: { baseHp: 110, baseAttack: 11, baseDefense: 6, tierGrowth: 2.05 },
      victoryRewards: [{ id: 'money', name: '报酬', base: 6, tierGrowth: 1.6 }]
    }
  })

  assert.equal(mine.attributes.name('attack'), '脚力')
  assert.equal(mine.realms.label(0, 0), '送信学徒·第一段')
  assert.equal(mine.equipment.slots.length, 2)
  const rng = engine.createRng('边境邮差')
  let state = { major: 0, layer: 0, exp: 0 }
  state = mine.realms.addExp(state, Number(mine.realms.expCost(0, 0)))
  const item = mine.equipment.generate(rng, { tier: 1 })
  assert.ok(mine.equipment.resolve(item).template, '自己写的模板应当能解析')
  let progress = engine.emptyProgress()
  let cleared = false
  for (let i = 0; i < 4 && !cleared; i += 1) {
    const encounter = mine.dungeons.nextEncounter('plainroad', progress, rng)
    const outcome = mine.dungeons.onVictory('plainroad', encounter, progress, rng)
    progress = outcome.progress
    cleared = cleared || outcome.firstClear
  }
  assert.equal(cleared, true, '自己写的区域应当能通关')
  assert.ok(progress.cleared.includes('plainroad'))
  console.log('   从零装配通过(不引用任何内容包:自己写槽位/品质/词条/区域/敌人,跑通修炼 → 掉装 → 通关)')
 `
execFileSync('node', ['--input-type=module', '-e', consumerProbe], { cwd: app, stdio: 'inherit' })

/**
 * 定制表探针 —— **文档承诺的每一类旋钮,使用者真能拧动吗**。
 *
 * `docs/usage.md` 那张定制表(近一百项)一直在承诺"这个可以改、那个可以接管",但它此前只有两条
 * 弱保障:①表里的名字在源码里存在(「定制表旋钮自检」),②库自己的用例覆盖到。两条都活在仓库里,
 * **验不到"使用者拿着包、照着表改"这条路**。这里补上:在临时项目里按定制表**逐类拧一遍** ——
 * 曲线钩子、生成钩子、周期与抉择、账本上限、世界记忆、投资点、设施、体检、清理规则、存档迁移、
 * 以及换数值层(`Numeric<bigint>`)—— 每拧一处就断言结果真的按内容走了。
 *
 * 与"从零装配"那段的分工:那段证明"内容能换",这段证明"**机制能被接管**"。
 */
const customizationProbe = `
  const assert = (await import('node:assert/strict')).default
  const engine = await import('wanxiang-engine')
  const { createProgressionAudit, createRealmSystem, createAttributeSystem, createEquipmentSystem,
          createDungeonSystem, createResourceSystem, createCycleSystem, createChoiceSystem,
          createStageMemory, createPointPool, createFacilitySystem, createTriage, compareBy,
          createEconomyReadings, defineSaveFormat, runMigrations, decodeSave, encodeSave,
          attributeDefs, numberNumeric, createRng, accrue } = engine

  // ① 等级:需求曲线 / 面板曲线 / 成功率三处全接管,逐境层数也能不一样
  const handTuned = []
  const realms = createRealmSystem({
    worlds: [
      { id: 'a', name: '一号院', realms: [{ name: '蒙学', layers: ['上', '下'] }, '经义'] },
      { id: 'b', name: '二号院', realms: ['策问'] }
    ],
    labelFormat: '{world}/{realm}/{layer}',
    exp: { realmGrowth: 1, costFn: (major, layer) => 10 + major * 100 + layer * 7 },
    combat: { realmGrowth: 1, statsFn: (major, layer) => ({ attack: 10 + major * 5 + layer, guard: 3 }) },
    breakthrough: { min: 0.1, max: 0.9, rateFn: () => Number.NaN, majorRequiresTrial: true }
  })
  const costs = realms.realms.map(r => realms.expCost(r.major, 0))
  assert.deepEqual(costs, [10, 110, 210])            // costFn 原样用,不插值不缩放
  assert.equal(realms.baseStats(1, 0).attack, 15)    // statsFn 同理
  assert.equal(realms.breakthroughRate(0, 0), 0.1)   // NaN 被夹到 min(不再是"永远失败")
  assert.equal(realms.label(0, 0), '一号院/蒙学/上')
  assert.deepEqual([...realms.layersOf(0)], ['上', '下'])   // 逐境层数不同
  assert.equal(realms.layersOf(1).length, 10)               // 没写 layers 的那一境仍用全局层名(默认十层)
  assert.equal(realms.isWorldStep(1, 9), true)              // 走完"经义·圆满"(界末那一境)就换界

  // ② 属性:换合并算法(只取最强)+ 关掉递减
  // counterRate 在默认表里标了 diminishing,正好拿它比三种合并口径
  const sources = [{ counterRate: 0.1 }, { counterRate: 0.3 }]
  const ranked = createAttributeSystem({ defs: attributeDefs({}), core: ['attack'] })
  assert.ok(Math.abs(ranked.mergeMods(sources).counterRate - 0.375) < 1e-9)   // 默认阶梯:按贡献降序打折
  const maxed = createAttributeSystem({ defs: attributeDefs({}), core: ['attack'], diminish: { mode: 'max' } })
  assert.equal(maxed.mergeMods(sources).counterRate.toFixed(6), '0.300000')   // 只取最强那一份
  const folded = createAttributeSystem({ defs: attributeDefs({}), core: ['attack'], diminish: { fold: values => values.reduce((a, b) => a + b, 0) } })
  assert.equal(folded.mergeMods(sources).counterRate.toFixed(6), '0.400000')  // fold 自己接管

  // ③ 装备:层级系数给表、强化曲线自己接管、词条条数与权重都能接管;洗练能封存
  let uid = 0
  const gear = createEquipmentSystem({
    slots: [{ id: 'weapon', name: '兵器' }],
    qualities: [{ id: 'q', name: '凡', rank: 0, mult: 1, affixes: [0, 1], weight: 100 }],
    templates: [{ id: 't1', name: '短棍', slot: 'weapon', tier: 1, base: { attack: 4 } }],
    affixes: [{ id: 'a', name: '锐', key: 'attackPct', min: 1, max: 2, weight: 1, desc: 'x' },
              { id: 'b', name: '坚', key: 'guardPct', min: 1, max: 2, weight: 99, desc: 'y' }],
    power: { baseFactor: 1, qualityExponent: 1, tierFactors: [1, 9, 27], levelBonusFn: level => level * 0.1 },
    affixValueScale: 100,
    affixCountFn: () => 2,
    affixWeightFn: affix => (affix.id === 'a' ? 1000 : 1)
  }, numberNumeric, () => 'u' + (++uid))
  const item = gear.generate(createRng('定制'), { tier: 3 })
  assert.equal(item.tier, 3)
  assert.equal(item.affixes.length, 2)
  assert.equal(item.affixes[0].id, 'a')             // 权重接管:rare 那条被压成 1
  assert.equal(Number(gear.resolve({ ...item, level: 0 }).flats.attack), 4 * 27)      // tierFactors 查表
  assert.ok(Math.abs(Number(gear.resolve({ ...item, level: 3 }).flats.attack) - 4 * 27 * 1.3) < 1e-9)  // levelBonusFn 接管强化曲线
  const rerolled = gear.rerollAffixes(item.affixes, { rng: createRng('洗'), quality: { id: 'q', name: '凡', rank: 0, mult: 1, affixes: [0, 1], weight: 100 }, tier: 3, keep: ['a'] })
  assert.ok(rerolled.some(a => a.id === 'a'))       // 封存的那条还在

  // ④ 副本:遭遇与奖励全接管,前置用 any,层级缩放给函数
  let handPicked = 0
  const dungeons = createDungeonSystem({
    regions: [
      { id: 'x', name: '甲道', tier: 1, minRealm: 0, enemies: ['e1'], boss: 'b1' },
      { id: 'y', name: '乙道', tier: 1, minRealm: 0, enemies: ['e1'], boss: 'b1', requireCleared: 'x' },
      { id: 'z', name: '丙道', tier: 2, minRealm: 0, enemies: ['e1'], boss: 'b1', requireCleared: ['x', 'y'], requireMode: 'any' }
    ],
    enemies: [{ id: 'e1', name: '小怪', tier: 1, hpMult: 1, atkMult: 1, defMult: 1, speed: 1 },
              { id: 'b1', name: '头目', tier: 1, hpMult: 2, atkMult: 1, defMult: 1, speed: 1, boss: true }],
    bossProgress: 1, bossRhythm: 'cycle',
    enemyPower: { baseHp: 10, baseAttack: 2, baseDefense: 1, tierGrowth: 2, scaleFn: tier => tier * 10 },
    encounterFn: () => { handPicked += 1; return { kind: 'normal', enemyId: 'e1' } },
    rewardFn: ({ tier }) => [{ id: 'coin', name: '钱', amount: tier * 3 }]
  })
  assert.equal(dungeons.snapshot('e1').stats.hp, 100)                    // scaleFn 接管层级缩放
  assert.equal(dungeons.isUnlocked('z', { cleared: ['x'], bossWins: {}, runs: {} }, 0), true)  // any:通一条就开
  const encounter = dungeons.nextEncounter('x', { cleared: [], bossWins: {}, runs: {} }, createRng('遭遇'))
  assert.equal(handPicked, 1)
  const victory = dungeons.onVictory('x', encounter, { cleared: [], bossWins: {}, runs: {} }, createRng('胜'))
  assert.deepEqual(victory.rewards.map(r => r.amount), [3])              // rewardFn 接管奖励

  // ⑤ 账本:上限随别的东西变 / 下限 / 取整 / 来源审计
  const ledger = createResourceSystem({
    resources: [
      { key: 'dust', name: '尘', integer: true, cap: 1 },
      { key: 'coin', name: '钱', integer: true, floor: 0 }
    ],
    // capFn 在**配置这一层**(不在资源条目上);一给就以它为准
    capFn: (key, l) => (key === 'coin' ? Number(l.dust ?? 0) * 10 : undefined)
  })
  let wallet = ledger.create({ coin: 0, dust: 1 })
  wallet = ledger.grant(wallet, [{ key: 'coin', amount: 12, source: '干活' }]).ledger
  assert.equal(ledger.numberOf(wallet, 'coin'), 10)    // 动态上限:尘 ×10(capFn 接管)
  assert.equal(ledger.numberOf(wallet, 'dust'), 1)     // 静态上限:写 1 就是 1
  const audit = ledger.audit(ledger.grant(wallet, [{ key: 'coin', amount: 1, source: '干活' }]).entries)
  assert.equal(Number(audit.bySource['干活'].net), 0)  // 满了之后加不进去(来源审计如实记 0)

  // ⑥ 周期:池子与抽取规则都接管;抉择:效果与超时兜底由内容解释
  const cycles = createCycleSystem({
    periodSec: 3600,
    pools: { morning: [{ id: 'sun', weight: 1 }], night: [{ id: 'moon', weight: 1 }] },
    seedOf: (index, ctx) => index * 7 + (ctx.salt ?? 0)      // 种子公式可接管
  })
  assert.equal(cycles.entryAt(0, { pool: 'morning' }).id, 'sun')
  assert.equal(cycles.at(3600, { pool: 'night' }).entry.id, 'moon')
  assert.equal(cycles.seedAt(3, { pool: 'morning', salt: 1 }), 22)     // 3 × 7 + 1
  assert.equal(cycles.indexAt(3600 * 2), 2)
  const choices = createChoiceSystem({ interpret: effect => ({ key: effect.key, amount: effect.amount * 2 }) })
  const receipt = choices.resolve(
    { id: 'c1', name: '押注', outcomes: [{ weight: 1, effects: [{ key: 'coin', amount: 5 }] }] },
    {},
    createRng('抉择')
  )
  assert.deepEqual(receipt.lines[0], { key: 'coin', amount: 10 })      // interpret 接管了口径(5 → 10)

  // ⑦ 世界记忆 / 投资点 / 设施 / 体检 / 清理
  const memory = createStageMemory({ stages: [{ id: 'low', name: '生' }, { id: 'high', name: '熟', at: { count: 10 }, mult: 1.2 }], decayAfterHours: 48 })
  assert.equal(memory.stateOf({ count: 10 }).id, 'high')
  assert.equal(memory.stateOf({ count: 10, idleHours: 48 }).id, 'low')
  const pool = createPointPool({ branches: [{ id: 'b1', name: '甲', mainCap: 2, sideCap: 1 }], total: 3, mainCap: 2, sideCap: 1 })
  const invested = pool.invest({ points: {}, main: undefined }, 'b1', {})
  assert.equal(invested.can, true)
  assert.equal(invested.state.points.b1, 1)                            // 首投自动认主
  assert.equal(invested.state.main, 'b1')
  assert.equal(pool.capOf({ points: {}, main: 'b1' }, 'b1'), 2)        // 主位上限由内容给
  assert.equal(pool.investInfo({ points: { b1: 2 }, main: 'b1' }, 'b1', {}).can, false)  // 顶到主位上限
  const facilities = createFacilitySystem({
    facilities: [{ id: 'f1', name: '窑', maxLevel: 3, costs: level => [{ key: 'coin', amount: level * 10 }],
                   blocked: (_levels, level) => (level >= 3 ? '到头了' : undefined) }]
  })
  const info = facilities.upgradeInfo({ f1: 1 }, 'f1', {})
  assert.equal(info.can, true)
  assert.deepEqual(info.costs, [{ key: 'coin', amount: 10 }])          // 费用曲线由内容给
  assert.equal(facilities.upgradeInfo({ f1: 3 }, 'f1', {}).reason, '到头了')
  // 注意签名:frac 与 rates 都是「键 → 数」的字典(rates 的单位=每小时)
  const accrued = accrue({}, { brick: 3 }, 1800)
  assert.equal(accrued.whole.brick, 1)                                 // 半小时 1.5 份 → 发 1 留 0.5
  assert.equal(accrued.frac.brick, 0.5)
  const readings = createEconomyReadings({ labels: { tight: '紧' } })
  assert.equal(readings.read([{ key: 'coin', income: 1, sink: 10 }])[0].verdict, '紧')
  const triage = createTriage({
    // 规则表态:返回 true/false,或 { keep, reason };返回 undefined = 这条不管
    rules: [{ id: 'r1', decide: it => compareBy((a, b) => a.tier - b.tier)(it, { tier: 5 }) >= 0 }],
    fallback: { keep: true, reason: '兜底' }
  })
  assert.deepEqual(triage.decide({ tier: 1, uid: 'x' }), { keep: false, rule: 'r1', reason: 'r1' })
  assert.deepEqual(triage.decide({ tier: 9, uid: 'y' }), { keep: true, rule: 'r1', reason: 'r1' })
  assert.deepEqual(
    createTriage({ rules: [{ id: 'r2', decide: () => undefined }], fallback: { keep: true, reason: '兜底' } }).decide({ uid: 'z' }),
    { keep: true, rule: 'fallback', reason: '兜底' }
  )

  // ⑧ 体检:强度与内容强度都由调用方给
  const auditReport = createProgressionAudit({ realms, power: (m, l) => 10 + m * 5 + l, contentPower: () => 1, crushRatio: 3 })
  const expectedSteps = realms.realms.reduce((n, r) => n + realms.layersOf(r.major).length, 0)
  assert.equal(auditReport.steps.length, expectedSteps)   // 逐境层数不同时,格子数按各境自己的层数算
  assert.ok(auditReport.summary().firstCrush)

  // ⑨ 存档:迁移链 + 形状修复
  const format = defineSaveFormat({ currentVersion: 3, migrations: { 1: d => ({ ...d, v2: true }), 2: d => ({ ...d, v3: true }) } })
  const migrated = runMigrations({ base: 1 }, 1, format)
  assert.deepEqual(migrated, { base: 1, v2: true, v3: true })
  const round = decodeSave(encodeSave({ keep: 1 }, format, 1), format)
  assert.equal(round.ok, true)

  // ⑩ 换数值层:同一份公式喂 bigint 适配器(接口十五个成员,自己实现即可)
  const bigintNumeric = {
    zero: 0n, one: 1n, from: n => BigInt(Math.round(n)), of: v => (typeof v === 'bigint' ? v : BigInt(Math.round(v))),
    add: (a, b) => a + b, sub: (a, b) => a - b, mul: (a, b) => a * b, mulN: (a, k) => a * BigInt(Math.round(k)),
    div: (a, b) => (b === 0n ? 0n : a / b), pow: (a, k) => a ** BigInt(Math.round(k)),
    powN: (base, k) => BigInt(Math.round(base)) ** BigInt(Math.round(k)),
    cmp: (a, b) => (a < b ? -1 : a > b ? 1 : 0), max: (a, b) => (a > b ? a : b),
    toNumber: a => Number(a), format: a => String(a)
  }
  const bigRealms = createRealmSystem({
    worlds: [{ id: 'w', name: '大世界', realms: ['一', '二'] }],
    layerNames: ['1'],
    exp: { base: 3, realmGrowth: 3, layerGrowth: 3 },
    combat: { base: { attack: 1 }, realmGrowth: 3, layerGrowth: 3 },
    breakthrough: { layerBase: 0.5, layerDecay: 0, majorBase: 0.5, majorDecay: 0, min: 0.1, max: 0.9 }
  }, bigintNumeric)
  assert.equal(typeof bigRealms.expCost(1, 0), 'bigint')
  assert.equal(bigRealms.expCost(1, 0), 9n)   // 3 × 3^1,精确到个位

  console.log('   定制表探针通过(曲线/生成/周期/抉择/账本/记忆/投资点/设施/体检/清理/存档/数值层,十二类旋钮都拧得动)')
`
execFileSync('node', ['--input-type=module', '-e', customizationProbe], { cwd: app, stdio: 'inherit' })

/**
 * 类型消费者自检 —— 使用者那边 `tsc --strict` 能不能过。
 *
 * 为什么还要这一步:运行时 import 成功只证明"装上能跑",而 TypeScript 使用者的第一道坎是
 * `types` / `exports.types` 指向的文件能不能被解析、`.d.ts` 是不是自洽(泛型默认值、再导出、
 * 子路径类型)。这些错了,包能跑但一编译就红 —— 而且只在**使用者**那边红,发版的人看不见。
 * 所以这里真造一个 `.mts` 消费者,用严格模式 + 两种 moduleResolution 各编一遍。
 */
const tsc = resolve(ENGINE, 'node_modules/typescript/bin/tsc')
if (existsSync(tsc)) {
  writeFileSync(
    resolve(app, 'probe.mts'),
    `
import { createRng, defineGame, planIdle, createDropTable, type IdlePlan, type Rng } from 'wanxiang-engine'
import type {
  AttributeSystemConfig,
  DungeonConfig,
  EquipmentConfig,
  GameConfig,
  Numeric,
  RealmSystemConfig,
  ResourceSystemConfig,
  TriageConfig
} from 'wanxiang-engine'
import { DEMO } from 'wanxiang-engine/presets/demo'
import { DAILY } from 'wanxiang-engine/presets/daily'
import { XIUXIAN } from 'wanxiang-engine/presets/xiuxian'

const rng: Rng = createRng('类型探针')
const plan: IdlePlan = planIdle(8 * 3600_000, { stepMs: 3600_000, capMs: 6 * 3600_000 })
const table = createDropTable([{ key: 'page', chance: 0.12, count: [1, 2] }])
const hits: number = table.roll(rng, { chanceMult: 2 }).reduce((sum, hit) => sum + hit.count, 0)
const games = [DEMO, DAILY, XIUXIAN].map(config => defineGame(config))

/**
 * 定制面的**类型**探针 —— 上面那些钩子在**包里**(dist 的 .d.ts)是不是也照样能用。
 *
 * 运行时能用、类型面缺胳膊少腿,是"文档说可以接管"最隐蔽的翻车方式:JS 用户拿它没辙,
 * TS 用户会看见一堆隐式 any 或找不到类型。这里把定制表里最常用的那些钩子**逐条按类型写一遍** ——
 * 写错了 tsc --strict 当场红。(注:这些探针正文是模板字符串的一部分 —— 里面**不要用反引号**)
 */
const realms: RealmSystemConfig = {
  worlds: [{ id: 'w', name: '界', realms: [{ name: '一段', layers: ['上', '下'] }, '二段'] }],
  layerNames: ['一', '二'],
  labelFormat: '{world}/{realm}/{layer}',
  exp: { realmGrowth: 1, costFn: (major: number, layer: number) => major * 10 + layer },
  combat: { realmGrowth: 1, statsFn: (major: number, layer: number) => ({ attack: major + layer }) },
  breakthrough: { min: 0.1, max: 0.9, rateFn: (major: number) => 0.5 + major * 0.01, majorRequiresTrial: true }
}
const gear: EquipmentConfig<number> = {
  slots: [{ id: 's', name: '槽' }],
  qualities: [{ id: 'q', name: '凡', rank: 0, mult: 1, affixes: [0, 1], weight: 1 }],
  templates: [{ id: 't', name: '物', slot: 's', tier: 1, base: { attack: 1 } }],
  affixes: [{ id: 'a', name: '词', key: 'attackPct', min: 1, max: 2, weight: 1, desc: 'x' }],
  power: {
    baseFactor: 1,
    qualityExponent: 1,
    tierFactors: [1, 2],
    levelBonusFn: (level: number) => level * 0.1
  },
  affixValueScale: 100,
  affixCountFn: (quality, tier, r) => r.int(0, Math.min(2, quality.rank + tier)),
  affixWeightFn: (affix, quality) => (affix.min <= quality.rank ? 1 : 0)
}
const dungeons: DungeonConfig<number> = {
  regions: [{ id: 'r', name: '区', tier: 1, minRealm: 0, enemies: ['e'], boss: 'e' }],
  enemies: [{ id: 'e', name: '敌', tier: 1, hpMult: 1, atkMult: 1, defMult: 1, speed: 1 }],
  enemyPower: { baseHp: 10, baseAttack: 1, baseDefense: 1, tierGrowth: 2, scaleFn: (tier: number) => tier },
  encounterFn: ctx => (ctx.bossDue ? { kind: 'boss' } : { kind: 'normal', enemyId: ctx.pool[0] }),
  rewardFn: ctx => ctx.defaultRewards.map(r => ({ id: r.id, amount: 1 }))
}
const resources: ResourceSystemConfig = {
  resources: [{ key: 'coin', name: '钱', integer: true, cap: 10, floor: 0 }],
  capFn: (key, ledger) => (key === 'coin' ? Number(ledger.coin ?? 0) * 2 : undefined)
}
const attributes: AttributeSystemConfig = {
  defs: [{ key: 'attack', name: '攻', kind: 'flat' }],
  core: ['attack'],
  diminish: { fold: values => values.reduce((a, b) => a + b, 0) }
}
const triage: TriageConfig<{ uid: string }> = {
  rules: [{ id: 'keep-all', decide: () => ({ keep: true, reason: '都留' }) }],
  skip: item => item.uid === 'locked',
  fallback: { keep: false, reason: '不要' }
}
const config: GameConfig<number> = { name: '类型题材', attributes, realms, equipment: gear, dungeons }
const bigintNumeric: Numeric<bigint> = {
  zero: 0n,
  one: 1n,
  from: n => BigInt(Math.round(n)),
  of: v => (typeof v === 'bigint' ? v : BigInt(Math.round(v))),
  add: (a, b) => a + b,
  sub: (a, b) => a - b,
  mul: (a, b) => a * b,
  mulN: (a, k) => a * BigInt(Math.round(k)),
  div: (a, b) => (b === 0n ? 0n : a / b),
  pow: (a, k) => a ** BigInt(Math.round(k)),
  powN: (base, k) => BigInt(Math.round(base)) ** BigInt(Math.round(k)),
  cmp: (a, b) => (a < b ? -1 : a > b ? 1 : 0),
  max: (a, b) => (a > b ? a : b),
  toNumber: a => Number(a),
  format: a => String(a)
}
export const probe = { plan, hits, worlds: games.map(g => g.realms.realms.length) }
export const custom = { config, resources, triage, bigintNumeric }
`
  )
  for (const [label, moduleResolution] of [
    ['bundler', 'bundler'],
    ['node16', 'node16']
  ]) {
    execFileSync(
      'node',
      [
        tsc,
        '--noEmit',
        '--strict',
        '--target',
        'es2022',
        '--module',
        moduleResolution === 'node16' ? 'node16' : 'esnext',
        '--moduleResolution',
        moduleResolution,
        '--skipLibCheck',
        'false',
        resolve(app, 'probe.mts')
      ],
      { cwd: app, stdio: 'inherit' }
    )
    console.log(`   使用者的 tsc --strict 通过(moduleResolution: ${label})`)
  }

  /**
   * 文档片段自检 —— 文档里那些"自称完整"的代码块,必须能对着**发布包**编译过。
   *
   * 文档腐烂最常见的方式不是写错字,而是**片段停在两个版本前**:库改了名字、调了签名,
   * 示例还照旧 —— 而读者是照着抄的人。约定:块前面一行写 `<!-- compile-check -->`
   * (可以带一句说明),自检就把它抽出来当 `.mts` 编一遍。没标的不查 ——
   * 很多片段本来就是节选(中间写着省略号),硬查只会逼着文档写废话。
   */
  const docSources = ['README.md', ...readdirSync(resolve(ENGINE, 'docs')).map(name => `docs/${name}`)]
  let checkedBlocks = 0
  for (const rel of docSources) {
    const text = readFileSync(resolve(ENGINE, rel), 'utf-8')
    const marked = [...text.matchAll(/<!-- compile-check[^>]*-->\s*\n```(?:ts|typescript)\n([\s\S]*?)^```$/gm)]
    for (const [index, block] of marked.entries()) {
      const file = resolve(app, `doc-${rel.replace(/\W+/g, '-')}-${index}.mts`)
      writeFileSync(file, block[1])
      execFileSync(
        'node',
        [tsc, '--noEmit', '--strict', '--target', 'es2022', '--module', 'esnext', '--moduleResolution', 'bundler', '--skipLibCheck', 'false', file],
        { cwd: app, stdio: 'inherit' }
      )
      checkedBlocks += 1
    }
  }
  assert.ok(checkedBlocks >= 1, '文档里一个 compile-check 片段都没有?约定被删了?')
  console.log(`   文档片段编译通过(${checkedBlocks} 段标了 compile-check 的代码块都对着发布包编过)`)
} else {
  console.log('   (跳过类型消费者自检:本地没有 typescript —— 先 bun install)')
}

console.log(`发布包自检通过(${tgz} 装进临时项目后可用 · 含使用者侧的 tsc 严格模式)`)

/**
 * 自检清单自检 —— **README 里说有几道自检,这里就得真有那几道**。
 *
 * 为什么值得一条判据:"我们有一堆自检"是最容易变成空话的一句话 —— 加自检时忘了往 README 里
 * 补,读者就以为只有几条;删自检时忘了划掉,读者就以为还有人在盯着。两边都靠这份文件里
 * 那些「… 自检通过(…)」的日志行与 README 那段清单对账:名字集合必须一致(顺序不管),数量不到十道也红
 * (说明正则或清单结构变了,这条判据自己先失灵)。
 */
{
  const selfSource = readFileSync(new URL(import.meta.url), 'utf-8')
  const declared = new Set([...selfSource.matchAll(/([\u4e00-\u9fa5A-Za-z][\u4e00-\u9fa5A-Za-z]*)\s*自检通过[（(]/g)].map(m => m[1]))
  const readmeText = readFileSync(resolve(ENGINE, 'README.md'), 'utf-8')
  // 只取那一行(清单必须写在一行里 —— 换行了这条判据就读不出来了,那时它自己会红)
  const listedLine = readmeText.match(/真正跑起来的是\*\*[^*]*\*\*:([^\n]+)/)
  assert.ok(listedLine, 'README 里找不到"真正跑起来的是**…常驻自检**:…"那一行')
  const listed = new Set([...listedLine[1].matchAll(/`([^`]+)`/g)].map(m => m[1]))
  assert.ok(declared.size >= 10, `只从 scripts/verify-dist.mjs 里读出 ${declared.size} 道自检 —— 写法变了?`)
  const missing = [...declared].filter(name => !listed.has(name))
  const extra = [...listed].filter(name => !declared.has(name))
  assert.deepEqual(missing, [], `这些自检没写进 README 的清单:${missing.join('、')}`)
  assert.deepEqual(extra, [], `README 的清单里写了不存在的自检:${extra.join('、')}`)
  console.log(`自检清单自检通过(README 的 ${listed.size} 道与实跑的 ${declared.size} 道一一对得上)`)
}
