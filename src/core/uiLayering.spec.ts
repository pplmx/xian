/* eslint-disable no-console -- 分层审计的产出是给人看的清单 */
/**
 * 界面分层审计 —— 浮层只该有一个出处,弹窗只该有一套契约
 *
 * 由来:两个事件弹窗(悟道顿悟 / 洞府巡游)是自己铺的 `fixed inset-0`。
 * 单看截图看不出问题,代价却有三样:**没有 role=dialog / aria-modal**(读屏不知道
 * 有弹窗开了)、**没有焦点管理**(打开后焦点还在背后的按钮上,Tab 会一路跑出去)、
 * 样式自成一套(font-bold / text-sm / rounded,与本作的水墨设计系统两回事)。
 *
 * 而排版自检那两条尺子(控件要有可访问名、不小于 28px)与弹窗焦点契约都挂在
 * BaseModal 上 —— 自己铺浮层就等于同时退出这三套保障,还不会有人发现。
 *
 * 故这里把「浮层只有一个出处」钉成红线,判据是源码级的:
 *   一 全屏浮层只该出现在 BaseModal 里(自己铺 `fixed inset-0` 又带按钮 = 退出契约);
 *   二 每个弹窗都要有可辨识的名字(title 或 aria-label),读屏才念得出是哪一扇;
 *   三 每个弹窗都要关得掉(@close 有人接,或明写 :closable="false" 说明为何不给关)。
 *
 * 故障注入:把 EnlightenmentModal 改回自己铺浮层 → 第一条红;
 * 把某个 title 删掉 → 第二条红;把 @close 删掉 → 第三条红。
 */
import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'

const SRC = resolve(__dirname, '..')

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) walk(full, out)
    else if (/\.vue$/.test(entry)) out.push(full)
  }
  return out
}

const FILES = walk(SRC)
  .filter(f => f.includes(`${join('src', 'components')}`) || f.includes(`${join('src', 'views')}`))
  .map(f => ({
    path: relative(SRC, f).replace(/\\/g, '/'),
    // 注释里会提到这些写法(比如「曾经是自己铺的一层 fixed inset-0」),判据只看真代码
    src: readFileSync(f, 'utf8')
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '')
  }))

const BASE_MODAL = 'components/common/BaseModal.vue'

describe('界面分层 · 浮层只有一个出处', () => {
  it('自己铺满屏又带可点控件的浮层,必须走 BaseModal', () => {
    const offenders = FILES.filter(f => f.path !== BASE_MODAL)
      .filter(f => /fixed inset-0/.test(f.src) && /<button/.test(f.src))
      .map(f => f.path)
    console.log(`\n全屏浮层出处:${BASE_MODAL}${offenders.length ? ` + 越界的 ${offenders.length} 个` : ''}`)
    expect(
      offenders,
      '这些文件自己铺了全屏浮层 —— 会一并退出 dialog 语义、焦点陷阱与控件尺子;改用 BaseModal,或说明为何它必须自己铺'
    ).toEqual([])
  })

  it('每个弹窗都有可辨识的名字 —— 读屏要念得出是哪一扇', () => {
    const nameless: string[] = []
    for (const f of FILES) {
      // 逐个取 <BaseModal ...> 开标签
      for (const m of f.src.matchAll(/<BaseModal\b[^>]*>/g)) {
        const tag = m[0]
        const title = /(?<![:\w-])title="([^"]*)"/.exec(tag)?.[1]
        const boundTitle = /:title="([^"]*)"/.exec(tag)?.[1]
        const aria = /aria-label="([^"]*)"/.exec(tag)?.[1]
        if (title !== undefined && title.trim() !== '') continue
        if (boundTitle !== undefined && boundTitle.trim() !== '' && !/^\s*(['"])\1?\s*$/.test(boundTitle)) continue
        if (aria !== undefined && aria.trim() !== '') continue
        nameless.push(`${f.path} → ${tag.slice(0, 60)}`)
      }
    }
    expect(nameless, '这些弹窗没有名字 —— role=dialog 读出来是光秃秃一句「对话框」').toEqual([])
  })

  it('每个弹窗都关得掉 —— 关闭键挂上去必须有人接', () => {
    const stuck: string[] = []
    for (const f of FILES) {
      for (const m of f.src.matchAll(/<BaseModal\b[^>]*>/g)) {
        const tag = m[0]
        if (/@close=/.test(tag)) continue
        if (/:closable="false"/.test(tag)) continue
        stuck.push(`${f.path} → ${tag.slice(0, 60)}`)
      }
    }
    expect(stuck, '这些弹窗既没有 @close 也没写明 :closable="false" —— 关闭键与 Esc 都会静默失效').toEqual([])
  })

  it('视图里不许裸 back() —— 冷启动时它会把人送出游戏', () => {
    // 判据:站内没有上一页时(书签 / deep link / PWA 冷启动恢复路由),
    // history.state.back 为 null,裸 back() 会退到 about:blank,界面整个消失。
    // 统一走 router/goBack.ts 的 goBack(router, 父页)。
    const offenders = FILES.filter(f => /\.back\(\)/.test(f.src))
      .map(f => f.path)
    expect(offenders, '这些视图直接调了 back() —— 改用 @/router/goBack 的 goBack(router, 父页)').toEqual([])
  })

  it('装备卡与连战场次按钮有稳定可访问名', () => {
    const card = FILES.find(f => f.path === 'components/equipment/EquipmentCard.vue')
    expect(card?.src, '装备卡要把截断名之外的佩/锁/共鸣写进 aria-label').toContain('aria-label')
    expect(card?.src).toContain('佩戴中')
    const gauntlet = FILES.find(f => f.path === 'components/celestial/GauntletPanel.vue')
    expect(gauntlet?.src, '连战场次按钮不能只念一个数字').toContain('aria-label')
    expect(gauntlet?.src).toMatch(/第 \$\{i \+ 1\} 场/)
  })

  it('问卦剩余与顿悟/巡游窗口在暂停时不空耗墙上时钟', () => {
    const codex = FILES.find(f => f.path === 'views/RealmCodexView.vue')
    expect(codex?.src).toContain('useNow')
    expect(codex?.src).toMatch(/expiresAt - now\.value/)
    const cave = FILES.find(f => f.path === 'components/dongfu/CaveEventModal.vue')
    expect(cave?.src).toContain('gameNow')
    const enlighten = FILES.find(f => f.path === 'components/cultivation/EnlightenmentModal.vue')
    expect(enlighten?.src).toContain('gameNow')
  })

  it('顿悟/巡游临散前转朱砂 —— 限时增益不许静默自散', () => {
    // 两扇引擎弹窗都有倒计时,但临散前若还是金色,读长文案的玩家会白丢这份
    // 增益(巡游关掉当天就没了)。阈值单源(URGENT_COUNTDOWN_SEC),颜色就是「快选」;
    // 阈值双写或改回金身,下面这条都红。
    const cave = FILES.find(f => f.path === 'components/dongfu/CaveEventModal.vue')
    expect(cave?.src).toContain(`remaining <= URGENT_COUNTDOWN_SEC ? 'text-cinnabar'`)
    const enlighten = FILES.find(f => f.path === 'components/cultivation/EnlightenmentModal.vue')
    expect(enlighten?.src).toContain(`remaining <= URGENT_COUNTDOWN_SEC ? 'text-cinnabar'`)
    const constants = readFileSync(resolve(__dirname, '../data/constants.ts'), 'utf-8')
    expect(constants).toMatch(/URGENT_COUNTDOWN_SEC = 10/)
  })

  it('历练页复聚/已守跟 useNow 走,倒计时不会定格', () => {
    const adv = FILES.find(f => f.path === 'views/AdventureView.vue')
    expect(adv?.src).toContain('useNow')
    expect(adv?.src).toMatch(/hoursUntilRevive\([^)]*now\.value/)
  })

  it('「新」角标清账只发生在离开、且门掉没看过的分支 —— 别退回挂载即抹', () => {
    // 两处「新」角标(背包/图鉴)共享同一清账纪律:挂载清会把首帧刚渲染的「新」
    // 立刻抹掉;图鉴默认页签是成就,只看成就就离开也不该推进界(评审 MEDIUM-1)。
    // 违反的两种回退(无条件挂载清 / 图鉴碑掉 sawCollectionTab 门)下面都红。
    const bag = FILES.find(f => f.path === 'views/InventoryView.vue')
    expect(bag?.src).toMatch(/onUnmounted\(\(\).*markInventorySeen\(\)/)
    expect(bag?.src).not.toMatch(/onMounted\(\(\).*markInventorySeen/)
    const codex = FILES.find(f => f.path === 'views/CollectionView.vue')
    expect(codex?.src).toContain('sawCollectionTab')
    expect(codex?.src).toMatch(/if \(sawCollectionTab\.value\) quests\.markCollectionSeen\(\)/)
    expect(codex?.src).not.toMatch(/onMounted\(\(\).*markCollectionSeen/)
    // 页签上也得露:默认在成就页不切进去看不见有货,「收藏」页签挂新得点(呼吸提醒)
    expect(codex?.src).toContain(`dot: t.id === 'collection'`)
    // 底部导航的背包点:任何页都看得见「有新货」,挂在 inventory.newItemCount 上(删则全局退回看不见)。
    // 量价分档:恰好一件 = 原来的小点(轻晃不吵),≥2 件才升级成计数徽标「N」、9+ 封顶 ——
    // 别退回「只有有没有量」的老点、也别把「1」也做成满格徽标(越吵越没人看)。
    const nav = FILES.find(f => f.path === 'components/common/BottomNavigation.vue')
    expect(nav?.src).toContain('bagNewCount')
    expect(nav?.src).toContain("tab.name === 'inventory'")
    expect(nav?.src).toContain('bagNewCount >= 2')
    expect(nav?.src).toContain("bagNewCount > 9 ? '9+'")
    expect(nav?.src).toContain('bagNewCount === 1')
    // 两枚「新」徽章(装备卡 / 图鉴 chip)都有入场动画:新件到手、再开包那一瞬齐齐弹起,
    // 一眼扫到哪些是新入的。animate-new-pop 走独立 scale 属性、不碰 transform
    // (装备卡徽章靠 -translate-x-1/2 居中,凡动 transform 都会横跳)—— 帧与映射删了下面都红。
    const card = FILES.find(f => f.path === 'components/equipment/EquipmentCard.vue')
    expect(card?.src, '装备卡「新」徽章要有入场动画(animate-new-pop)').toContain('animate-new-pop')
    expect(codex?.src, '图鉴 chip 的「新」徽章要有入场动画(animate-new-pop)').toContain('animate-new-pop')
    const css = readFileSync(resolve(__dirname, '../style.css'), 'utf-8')
    expect(css, 'new-pop 的帧定义被删了 —— 徽章会退回瞬显').toMatch(/@keyframes new-pop[\s\S]{0,200}scale:\s*0\.5/)
    const tw = readFileSync(resolve(__dirname, '../../tailwind.config.js'), 'utf-8')
    expect(tw).toContain(`'new-pop': 'new-pop`)
  })

  it('开炉幕「把握」的语义色是真类 —— 七成以上放心开炉不许落回继承色', () => {
    // 把握度是全开炉决策里最关键的风险读数:「≥70% 放心开炉」的绿与「<30% 在赌」的红
    // 若落进不存在的色类(text-jade-ink / text-crimson-ink),整条语义色就静默消失。
    // 死类名全仓唯一出处就在这里 —— 改回真类(jade / gold-ink / cinnabar),改半截就红。
    const inv = FILES.find(f => f.path === 'views/InventoryView.vue')
    expect(inv?.src).not.toMatch(/text-(?:jade|crimson)-ink/)
    expect(inv?.src).toMatch(/rate >= 0\.7[\s\S]{0,40}?text-jade[\s\S]{0,60}?rate >= 0\.3[\s\S]{0,40}?text-gold-ink[\s\S]{0,40}?text-cinnabar/)
  })

  it('界面不重造 modsText —— 词条文案的独一份事实源在 ui/statNames', () => {
    // SoulsView 曾为「滤掉 0 值词条」自造一份本地 modsText,与库分叉成两套口径
    // (器魂低品键会带 0 → 库版印「+0%」、本地版不印)。单源 = 过滤收进库(见
    // statNames.spec),界面只 import。谁再在视图里起手 function modsText(,下面红。
    const souls = FILES.find(f => f.path === 'views/SoulsView.vue')
    expect(souls?.src).not.toMatch(/function modsText\(/)
    expect(souls?.src).toMatch(/import[\s\S]{0,300}?modsText[\s\S]{0,80}?from ['"]@\/ui\/statNames/)
  })

  it('在身之卦的倒计时走 formatCountdown 定宽 —— 秒表不许手拼「X 分 Y 秒」', () => {
    // 这是全库最后一个还手写"尚余 {m} 分 {sec} 秒"的倒计时:秒级心跳下位数不定
    // (5分3秒→5分30秒→9秒),行内每秒都跳。其余倒计时(状态胶囊/突破准备/闭关)
    // 早就统一进 formatCountdown + .countdown-slot 定宽槽,这里不许再退回去。
    const codex = FILES.find(f => f.path === 'views/RealmCodexView.vue')
    expect(codex?.src).toContain('formatCountdown(sec)')
    expect(codex?.src).toContain('countdown-slot')
    expect(codex?.src).not.toMatch(/尚余 \$\{m\} 分/)
  })

  it('逆旅契灰卡有理由 —— 已签报「此生已签」、道果不足报「尚差 N」', () => {
    // 契签不下只有两个理由:本世已签过(整组灰)/道果不足。别退回只有灰没有话:
    // 已签时应说「此生已签」,缺果子时按差数报「尚差 N 道果」(聚气丹/建筑同款)。
    const charv = FILES.find(f => f.path === 'views/CharacterView.vue')
    expect(charv?.src).toContain('此生已签')
    expect(charv?.src).toMatch(/尚差 \$\{t\.cost - player\.reincarnation\.daoFruit\} 道果/)
    expect(charv?.src).not.toMatch(/t\.cost \} 道果/)
  })

  it('已习得功法列表有空态 —— 开局一白板也是要填的话', () => {
    // 习得列表若只有 v-for 没有空态,开局没参悟过任何功法时,这只带边框的
    // max-h-64 容器就是一块空白(有的游戏开场就是一块能滚动的黑板)。空态给
    // 一句「尚无一部习得之法」把下一步(参悟)递到手边。
    const cult = FILES.find(f => f.path === 'views/CultivationView.vue')
    expect(cult?.src).toMatch(/v-if="learnedList\.length"/)
    expect(cult?.src).toMatch(/v-else[\s\S]{0,120}尚无一部习得之法/)
  })

  it('灵草坊买十用十株的门槛 + 付不起摆短差 —— 灯灰必须说出差多少', () => {
    // 买10 曾拿单株价当门槛(够 1 株就亮),点了才弹「灵石不足」;付不起了也只
    // 沉到底不报差,与同文件法宝炼化的「尚差」句式不一致。两者一起钉死:
    // 十株有其自己的 affordability 判定与短差,买10 不许再退回单株价放行。
    const inv = FILES.find(f => f.path === 'views/InventoryView.vue')
    expect(inv?.src).toContain('affordable10')
    expect(inv?.src).toContain(':disabled="!row.affordable10"')
    expect(inv?.src).toContain('formatGN(row.short)')
    expect(inv?.src).toContain('formatGN(row.short10)')
    expect(inv?.src).not.toMatch(/:disabled="!row\.affordable"[\s\S]{0,40}buyTen/)
  })

  it('部位候选行报「战 ±N」 —— 换装这件值不值,列表层就该看见,别等点开详情', () => {
    // 换装是最重复的决策:候选行此前只报品质/阶/词条数,跟身上那件差多少要逐个
    // 点开详情才对。行级差值必须vs 当前佩戴件(powerOf 线性差,与人物页战力同口径),
    // 佩戴中的底行自己不报差(它即基线)、空槽不报差(无对比对象)。
    const inv = FILES.find(f => f.path === 'views/InventoryView.vue')
    expect(inv?.src).toContain('powerOf(row.item) - powerOf(occupant)')
    expect(inv?.src).toContain('战 +${formatGN(Math.round(delta))}')
    expect(inv?.src).toContain('row.delta !== null')
    expect(inv?.src).toContain('powerOf(occupant)')
  })

  it('秘境付不起置灰+报差 —— 别只沉到底、点了才 toast', () => {
    // 秘境入口曾用 opacity-60 假装灰(仍可点、点了才 toast 原因),不入「付不起置灰+列差」
    // 的族规。钉死:付不起真禁用(disabled:opacity-40),行内代价换口「尚差 N 石/道源」。
    const sr = FILES.find(f => f.path === 'components/adventure/SecretRealmCard.vue')
    expect(sr?.src).toContain(':disabled="!canPay(r)"')
    expect(sr?.src).toContain("'disabled:opacity-40': !canPay(r)")
    expect(sr?.src).toContain('payText(r)')
    expect(sr?.src).toMatch(/尚差 \$\{formatGN/)
    expect(sr?.src).not.toMatch(/'opacity-60': !canPay/)
  })

  it('百分比显示统走 formatPercent —— 不许再手写 Math.round(x*100)%', () => {
    // 全库曾散着 ~24 处手写 `Math.round(x*100)%` 的百分比显示(契合/胜率/携血/词条/
    // 熟练/道躯加成…),与 formatPercent 各写一份迟早分叉。统一后可见输出逐位等价
    // (parity 探针含负数/半值/极小值 0 差异),还白得 NaN/Infinity→'--' 与极小值归 0。
    // 允许存在的唯一一处 `Math.round(..*100)`:retreatPct 是数值型 compute(模板两处
    // 引用同一个数,不是显示点) —— 除此之外再有手写百分比显示,下面红。
    const offenders = FILES.filter(({ src }) => /Math\.round\([\s\S]{0,60}\* *100\)/.test(src)).map(f => f.path)
    expect(offenders, `手写百分比残留:${offenders.join(',')}`).toEqual(['views/CultivationView.vue'])
    const cult = FILES.find(f => f.path === 'views/CultivationView.vue')
    expect(cult?.src).toMatch(/const retreatPct = Math\.round\(/)
  })

  it('战斗双方都动 —— 攻击方横踏、受击方震颤,不许退回「只挨打那半边有反应」', () => {
    // 出手与受击是同一因果环的两半:浮伤与震颤都挂在受击方,「谁在出手」此前完全静态。
    // 这半边(攻击方 strike)朝敌阵横踏一步(方向见 style.css 的 --strike-y),与受击方
    // 震颤成对 —— 删绑、把横踏挪到受击方、或卸掉帧定义,下面都红。
    const fight = FILES.find(f => f.path === 'components/adventure/CombatPanel.vue')
    expect(fight?.src, '攻击方要有横踏绑点(strikeCls),不许只有受击方震颤').toContain('strikeCls.e')
    expect(fight?.src).toContain('strikeCls.p')
    expect(fight?.src, '横踏必须挂在出手方(entry.side)上 —— 挪到受击方就重复震颤了').toMatch(/triggerStrike\(entry\.side\)/)
    const css = readFileSync(resolve(__dirname, '../style.css'), 'utf-8')
    expect(css, 'strike 的帧定义被删了 —— 攻击方退回完全静态').toMatch(/@keyframes strike[\s\S]{0,160}translateY\(var\(--strike-y\)\)/)
    expect(css).toMatch(/\.strike-e[\s\S]{0,40}--strike-y:\s*5px/)
    expect(css).toMatch(/\.strike-p[\s\S]{0,40}--strike-y:\s*-5px/)
  })

  it('换敌有入场 —— 新敌上台带一声轻起,不许退回硬切', () => {
    // 每场战罢敌角整个换人,却没有任何「换了」的信号;按 battle.at 键控重挂,
    // 让入场动画在换敌那一瞬重放(enemy-enter 轻版:淡入+上浮)。删键控或删帧,下面红。
    const fight = FILES.find(f => f.path === 'components/adventure/CombatPanel.vue')
    expect(fight?.src).toContain(':key="battle?.at"')
    expect(fight?.src).toContain('enemy-enter')
    const css = readFileSync(resolve(__dirname, '../style.css'), 'utf-8')
    expect(css, 'enemy-enter 的帧定义被删了 —— 换敌退回硬切').toMatch(/@keyframes enemy-enter[\s\S]{0,120}translateY\(5px\)/)
    expect(css).toMatch(/\.enemy-enter[\s\S]{0,60}animation:\s*enemy-enter/)
  })

  it('首领战有仪式感 —— 此地之主登场有显形,不许退回「只多个小标记」', () => {
    // 首领战每 10 胜一轮,是历练的周期性高潮,却只比小怪多一圈红框。
    // 三件套钉死:图标挂朱砂呼吸光环(animate-glow-pulse)、名字转朱砂(boss 名
    // 不再与小怪同色)、登场宣告(boss-reveal 居中淡入定住再散,随 battle.at
    // 键控重挂每场重放) —— 拆掉其中任何一件,下面红。
    const fight = FILES.find(f => f.path === 'components/adventure/CombatPanel.vue')
    expect(fight?.src, '首领图标要有朱砂光环(animate-glow-pulse),与小怪图标分开').toMatch(
      /battle\?\.isBoss \? .{0,90}animate-glow-pulse/
    )
    expect(fight?.src, '首领名要转朱砂 —— 名字是这一场的主角').toMatch(/data-foe-name[\s\S]{0,120}battle\?\.isBoss \? 'text-cinnabar'/)
    expect(fight?.src, '登场宣告(boss-reveal)被拆了').toMatch(/v-if="battle\?\.isBoss"[\s\S]{0,160}boss-reveal/)
    const css = readFileSync(resolve(__dirname, '../style.css'), 'utf-8')
    expect(css, 'boss-reveal 的帧定义被删了 —— 首领登场退回硬切').toMatch(/@keyframes boss-reveal[\s\S]{0,140}opacity: 1/)
    expect(css).toMatch(/\.boss-reveal[\s\S]{0,60}animation:\s*boss-reveal/)
  })

  it('每一界有自己的光 —— 世界氛围只换雾/山/越界光晕,不许掺进文字层', () => {
    // 「换了个世界」的体感在氛围层:角雾换色相、远山换染色、越界那瞬的光晕。
    // 三类全在低透明度层,永不触碰承载文字的层;谁把世界色写进字号/bg-paper,下面红。
    const appSrc = readFileSync(resolve(__dirname, '../App.vue'), 'utf-8')
    expect(appSrc, '外壳要标定 data-world,主题才分得出这是哪一界').toContain(':data-world="player.world.id"')
    expect(appSrc, '越界宣告组件要挂在壳上').toContain('<WorldTransitionVeil')
    const home = FILES.find(f => f.path === 'views/HomeView.vue')
    expect(home?.src, '远山要读世界的山色变量(--world-mountain)').toContain('var(--world-mountain)')
    const css = readFileSync(resolve(__dirname, '../style.css'), 'utf-8')
    // 三界都要有雾色覆盖 —— 缺了后两界就是「只做了仙界」的半成品
    expect(css).toMatch(/data-world='immortal'\][\s\S]{0,60}\.mist/)
    expect(css).toMatch(/data-world='god'\][\s\S]{0,60}\.mist/)
    expect(css).toMatch(/data-world='chaos'\][\s\S]{0,60}\.mist/)
    expect(css, '越界光晕要读世界色(veil-glow)').toMatch(/--world-glow-rgb/)
    const rite = readFileSync(resolve(__dirname, '../components/common/WorldTransitionVeil.vue'), 'utf-8')
    expect(rite, '越界判据只许走 announceWorldEntry 纯函数').toContain('announceWorldEntry')
    expect(rite, '宣告遮罩不许拦操作(pointer-events-none)').toContain('pointer-events-none')
    // 章节标题杆是全页高频的装饰 cue:每界各一色,别退回「只剩人间朱砂」
    const section = readFileSync(resolve(__dirname, '../components/common/SectionTitle.vue'), 'utf-8')
    expect(section, '标题杆要读世界色(--world-bar),不许写死朱砂').toContain('var(--world-bar)')
    expect(css).toMatch(/data-world='immortal'\][\s\S]{0,80}--world-bar/)
    expect(css).toMatch(/data-world='god'\][\s\S]{0,80}--world-bar/)
    expect(css).toMatch(/data-world='chaos'\][\s\S]{0,80}--world-bar/)
    // 世界身份落地到最常看的两处:修炼页「此刻的界」+ 界域志的「色卡地图」
    const cult = FILES.find(f => f.path === 'views/CultivationView.vue')
    expect(cult?.src, '修炼页世界名要读世界信标色(world-label)').toContain('world-label')
    const codex = FILES.find(f => f.path === 'views/RealmCodexView.vue')
    expect(codex?.src, '界域志每一个世界段要带自己的 data-world(色卡靠它分界)').toContain(':data-world="row.world.id"')
    expect(codex?.src, '界域志世界名要挂 world-seal(每界自己的色)').toContain('world-seal')
    expect(codex?.src, '「此刻在此」的格子要随所处世界亮起(codex-current)').toContain('codex-current')
    expect(css, 'world-label 要跟 --world-accent 走,不另写一套').toMatch(/\.world-label[\s\S]{0,40}var\(--world-accent\)/)
    expect(css).toMatch(/\.codex-current[\s\S]{0,80}var\(--color-qing\)/)
  })

  it('今日日课全毕有关闭感 —— 「今天做完了」不许再哑掉', () => {
    // 三条日课都结清后只有各自一个「已成」,没有「今天没漏事」的一句话 ——
    // 放置玩家的"可以放手挂机"该有一声。判据与发赏同源(每行 done),不许另起一套。
    const home = FILES.find(f => f.path === 'views/HomeView.vue')
    expect(home?.src).toContain('dailyAllDone')
    expect(home?.src).toContain('今日已毕')
    expect(home?.src, '判据必须读日课行的 done(= 已结算),不自己数进度').toMatch(/every\(r => r\.done\)/)
  })

  it('图鉴一目尽收有完成感 —— 集齐的那一册要自己说话', () => {
    // 分目进度只有「12/20」的淡暗计数,集齐也没有任何表示 —— 收集的圆满
    // 是该册自己说的话。判据 = 全体条目 stage>=1(空目不算),全收后「去哪儿找」
    // 让位给石绿「尽收」行。
    const col = FILES.find(f => f.path === 'views/CollectionView.vue')
    expect(col?.src).toContain('catComplete')
    expect(col?.src).toContain('尽收')
    expect(col?.src, '判据必须读 entry.stage(收录/认知),不另起一套').toMatch(/every\(e => e\.stage >= 1\)/)
  })

  it('名号尽收有完成感 —— 三十顶全齐的圆满,不许只沉在计数里', () => {
    // 名号页此前只显「14/30 · 佩一枚」的计数,三十顶全齐也没有任何表示 ——
    // 收集的终点(境界阶梯 + 成就赏走完)该有一声,与图鉴「尽收」同族。
    // 判据必须读同一个 ownedCount(与标题计数同源),不许另起一套数法。
    const tit = FILES.find(f => f.path === 'views/TitlesView.vue')
    expect(tit?.src).toContain('titlesAllOwned')
    expect(tit?.src, '名号尽收要与计数同源,不许另算一遍').toMatch(
      /titlesAllOwned = computed\([\s\S]{0,80}ownedCount\.value === TITLES\.length/
    )
    expect(tit?.src, '全收后的那句「尽收」要直说(名号尽收),不许只有计数').toContain('名号尽收')
  })

  it('洞府营造尽善有完成感 —— 七座俱至顶的圆满,不许只沉在各自卡面', () => {
    // 各卡到了顶只会各自说「已至顶档」,整座洞府全满却没有一句话 —— 家业
    // 经营到头的圆满该有一声(与图鉴尽收/名号尽收同族)。判据读 store 的
    // allBuildingsMaxed(与卡面 N/M 的 capOfBuilding 同源),不许视图另数一遍。
    const dv = FILES.find(f => f.path === 'views/DongfuView.vue')
    expect(dv?.src, '视图必须读 store 的全满 boolean,不许自己数一遍').toContain('dongfu.allBuildingsMaxed')
    expect(dv?.src, '那句「营造尽善」要直说,不许退回只有各自卡面').toContain('营造尽善')
    const dongfuStore = readFileSync(resolve(__dirname, '../stores/dongfu.ts'), 'utf8')
    expect(dongfuStore, 'store 端映射必须走引擎的判据,不许另起一套').toMatch(
      /allBuildingsMaxed = computed\([\s\S]{0,40}allDongfuMaxed\(levels\.value\)\)/
    )
    const engine = readFileSync(resolve(__dirname, '../core/engineFacilities.ts'), 'utf8')
    expect(engine, '判据必须逐座比 capOfBuilding 的同一个 cap(BUILDINGS 全表)').toMatch(
      /BUILDINGS\.every\(b => \(levels\[b\.id\] \?\? 0\) >= capOfBuilding\(b\.id, levels\)\)/
    )
  })

  it('洞府页自报已营几座 —— 座数只许 store 数一遍,两页同读', () => {
    // 已营座数此前只在首页入口右侧现算,洞府页自己反倒没有(「家业总览」的主角位
    // 缺一角)。收进 store 的 builtCount,洞府营造题头与首页入口同读 —— 退回任何
    // 一处自己 filter 一遍,下面红。
    const dv = FILES.find(f => f.path === 'views/DongfuView.vue')
    expect(dv?.src, '营造题头要挂上已营座数').toContain('dongfu.builtCount')
    const home = FILES.find(f => f.path === 'views/HomeView.vue')
    expect(home?.src, '首页入口也读 store,不许自己数一遍').toMatch(/已营 \{\{ dongfu\.builtCount \}\}/)
    const dongfuStore = readFileSync(resolve(__dirname, '../stores/dongfu.ts'), 'utf8')
    expect(dongfuStore, 'store 端有唯一一份 builtCount').toMatch(
      /builtCount = computed\(\(\) => BUILDINGS\.filter\(b => \(levels\.value\[b\.id\] \?\? 0\) > 0\)\.length\)/
    )
  })

  it('首页状态行不许退回最弱档 —— 主角位「此刻状态」不该比次要天时还哑', () => {
    // 主页 hero 的「现在在干嘛」(修炼/闭关/历练…)此前整行 text-ink-faint,紧邻
    // 下方的次要天时反而 font-kai 披金 —— 层级倒挂。提一档 ink-soft 并配楷体,
    // 寿元告急那一路仍走朱砂;退回 faint 或拆掉 kai,下面红。
    const home = FILES.find(f => f.path === 'views/HomeView.vue')
    expect(home?.src, '状态行要配楷体与对位主角比肩').toMatch(/class="font-kai text-\[11px\]"/)
    expect(home?.src, '非告急那一路不许退回最弱档(ink-faint)').toMatch(/text-cinnabar' : 'text-ink-soft'/)
  })

  it('修炼页主值行不许退回最弱档 —— 修为/灵气是这页最常盯的数', () => {
    // 修为与灵气的当前值此前与「+x/秒 ▸来路」同档 faint,数值本身反而被弱化;
    // 主值行整个提到 ink-soft(不动字号,200% 折行判据不受影响)。少一行就说明
    // 有人把某个主值行悄悄降回 faint。
    const cult = FILES.find(f => f.path === 'views/CultivationView.vue')
    const rows = (cult?.src.match(/data-value-row class="[^"]*text-ink-soft/g) ?? [])
    expect(rows.length, '修为/灵气/耗灵气主值行都要在 ink-soft 或更上').toBeGreaterThanOrEqual(3)
  })

  it('全面墨感 · 触感与主位 —— 按压滑移、匾额框墨、首屏主钮辉光、法球落地影', () => {
    // 全面美化批:btn-seal/ghost/chip 早已 0.12s 滑移,唯 card-ink 交互卡硬跳;
    // 境界名加世界色横杆(匾额)、欢迎页主钮起朱砂柔辉、首页法球加远山同色落地影。
    // 四件各退一件,下面红 —— 不许拆回「卡一按就跳、主角字光秃秃」。
    const style = readFileSync(resolve(__dirname, '../style.css'), 'utf8')
    expect(style, 'card-ink 要带按压滑移').toMatch(/\.card-ink \{[\s\S]{0,400}transition: transform 0\.12s ease;/)
    const cult = FILES.find(f => f.path === 'views/CultivationView.vue')
    expect(cult?.src, '境界名要用世界色横杆框墨').toMatch(/bg-\[var\(--world-bar\)\]/m)
    const wel = FILES.find(f => f.path === 'views/WelcomeView.vue')
    expect(wel?.src, '首屏主钮要有柔辉').toMatch(/btn-seal animate-glow-pulse/)
    const home = FILES.find(f => f.path === 'views/HomeView.vue')
    expect(home?.src, '法球要有同世界色的落地影').toMatch(/bg-\[var\(--world-mountain\)\]/)
  })

  it('闭关开始有这一闪 —— 闭关是这张卡自己的事,不许只换文字', () => {
    // 闭关开始只有 toast + 倒计时补上,卡片本身毫无反应(对照 BuildingCard 升级
    // 有 card-flash)。「这件事发生在我这张卡上」的 idiom 对闭关同样成立 ——
    // 拆掉 card-flash、或把触发改成别的时机,下面红。
    const cult = FILES.find(f => f.path === 'views/CultivationView.vue')
    expect(cult?.src, '闭关卡要挂 card-flash').toMatch(/retreatFlash \? 'card-flash'/)
    expect(cult?.src, '闪的触发是 retreating 由假转真那一瞬(5 分钟到时不再闪)').toMatch(/nv && !ov\) retreatFlash\.value = true/)
  })

  it('境遇结算收益行要逐行晕开 —— 与离线卷轴同款节奏,不许瞬时同现', () => {
    // 结果句已经 animate-ink-pop,紧随的收益列表却裸 `space-y-1.5` 瞬时同现;
    // 同一语义(收益清点)离线卷轴有 stagger-in,这里没有就是不一致。拆掉,红。
    const ev = FILES.find(f => f.path === 'components/adventure/EventDialog.vue')
    expect(ev?.src, '收益列表必须走 stagger-in').toMatch(/ul v-if="result\.lines\.length" class="stagger-in /)
  })

  it('器魂顶栏标题锁居中 —— 不许随道源位数左右游移', () => {
    // 左侧「← 天界」固定、右侧道源数字随位数伸缩,justify-between 下标题永远
    // 不居中且游移;用 1fr_auto_1fr 网格让两侧均分、标题落点锁死。
    const souls = FILES.find(f => f.path === 'views/SoulsView.vue')
    expect(souls?.src, '顶栏必须用两侧均分网格').toContain('grid-cols-[1fr_auto_1fr]')
    expect(souls?.src, '右侧信息块贴右,标题守着正中').toContain('justify-self-end')
  })

  it('洞府离线存续当前档要实底点亮 —— 不许退回淡染的哑当前态', () => {
    // 离线上限阶梯「现在第几档」曾只有 6% 底 + 50% 边框,是全库最哑的当前态
    // 指示器(对照 InkTabs 实心墨块 / 行程点实底呼吸)。当前档改实底 paper 字。
    const dv = FILES.find(f => f.path === 'views/DongfuView.vue')
    expect(dv?.src, '当前档必须实底 + paper 字 + 楷体').toMatch(/bg-cinnabar text-paper font-kai/)
  })

  it('图鉴详情要有视觉锚 —— 带 icon 的收录物,详情不许丢章', () => {
    // 灵兽册这类带 icon 的条目,收集 chip 上有枚小章,点开详情却整块丢成纯文字;
    // 详情的头部就该亮出这一枚(与丹房/材料详情同构,有 icon 才渲染)。
    const col = FILES.find(f => f.path === 'views/CollectionView.vue')
    expect(col?.src, '详情那扇要亮出 icon 色章(有才渲染)').toMatch(/v-if="detail\.entry\.icon"[\s\S]{0,80}grid h-12 w-12/)
  })

  it('战斗进出有过渡 —— 进战与收兵不许硬切', () => {
    // 历练页在「战斗面板 / 区域列表」之间切换,是这页最大的一次同页置换,从前
    // 整屏闪变;两分支要包进同一扇 page-fade 过渡,列表分支还得有单一根(div)——
    // Transition 不给 fragment 上动画。
    const adv = FILES.find(f => f.path === 'views/AdventureView.vue')
    expect(adv?.src, '两分支要包进同一扇 page-fade 过渡').toContain('<Transition name="page-fade" mode="out-in">')
    expect(adv?.src, '主战面板那一支把 v-if 收在组件上').toContain('CombatPanel v-if="adventure.sessionActive"')
    expect(adv?.src, '区域列表那一支必须有单一根 div(single root 才吃得到过渡)').toContain('v-else class="space-y-4"')
  })

  it('战斗分析的方向要能在手机上看理由 —— 不许只藏 hover title', () => {
    // 「可借力的方向」只会出现在败局分析里,「为什么看好这个方向」此前只挂在
    // 非交互 span 的 :title 上,触屏上点了没反应 = 死提示。方向名改可点、理由
    // 内联展开(与适配理由/天赋芯片同族);退回 span + title,下面红。
    const cp = FILES.find(f => f.path === 'components/adventure/CombatPanel.vue')
    expect(cp?.src, '方向名要是带展开语义的可点按钮').toContain(':aria-expanded="directionTap === d.styleName"')
    expect(cp?.src, '理由要在展开里直出,不许只挂 :title').toMatch(
      /v-if="directionTap === d\.styleName"[\s\S]{0,80}\{\{ d\.reason \}\}/
    )
  })

  it('适配星级的理由也点得开 —— 同方向族,不许退回 hover 死提示', () => {
    // 敌名行那颗「★★★」的适配星级同样把原因只挂 :title —— 手机无 hover 就是死提示。
    // 星级改可点、原因在名字行下直出;退回 span + title,下面红。
    const cp = FILES.find(f => f.path === 'components/adventure/CombatPanel.vue')
    expect(cp?.src, '星级要带上展开语义').toContain(':aria-expanded="adaptTap === foeAdaptation.stars"')
    expect(cp?.src, '理由要在名字行下直出,不许只挂 :title').toMatch(/foeAdaptation\.value\.reasons\.join/)
  })

  it('大境突破有分级 —— 一境一次是天劫,不许和每层小推进同一张脸', () => {
    // 突破幕此前小境/大境共用同一枚朱砂「破」印 —— 天劫既渡的里程碑式突破
    // (筑基→金丹等一境一次)和普通层推进毫无区分。金色「大境」章(gold=里程碑赏)
    // 钉在印下,小破不显示;拆了 v-if、或改成与小破同色,下面红。
    const dlg = FILES.find(f => f.path === 'components/cultivation/BreakthroughResultDialog.vue')
    expect(dlg?.src, '大境成功要有金章区分,不许只靠朱砂破印').toContain(`view.success && view.isMajor`)
    expect(dlg?.src, '大境章要是金色(gold-ink),与朱砂破印同列而更高').toContain('text-gold-ink')
    expect(dlg?.src, '大境章要直说「大境」').toContain('大 境')
  })

  it('闪避有侧让 —— 躲开 ≠ 被打中,不许让闪避也走震颤', () => {
    // 战斗里闪避此前只落在日志的一行淡字:攻击方横踏照走,受击方纹丝不动,
    // 「这一击被躲过了」没有画面。而若随手让闪避也走 hit-shake,就成了
    // 「打中了但没伤害」的假反馈。故盯死:闪避(dodge)必须触发受击方 flicker
    // 侧让、且不得走震颤那半边(triggerShake)。
    const fight = FILES.find(f => f.path === 'components/adventure/CombatPanel.vue')
    expect(fight?.src, '闪避要有侧让绑点(flickerCls)').toContain('flickerCls.e')
    expect(fight?.src).toContain('flickerCls.p')
    expect(fight?.src, 'dodge 行必须触发侧让').toMatch(/entry\.t === 'dodge'[\s\S]{0,120}triggerFlicker/)
    expect(fight?.src, '闪避不得走震颤(躲开≠被打中)').not.toMatch(/entry\.t === 'dodge'[\s\S]{0,80}triggerShake/)
    expect(fight?.src, '闪避时攻击方仍该横踏(出手确实出手了)').toMatch(/entry\.t === 'dodge'[\s\S]{0,80}triggerStrike/)
    const css = readFileSync(resolve(__dirname, '../style.css'), 'utf-8')
    expect(css, 'flicker 的帧定义被删了 —— 闪避退回一动不动的淡字').toMatch(/@keyframes flicker/)
  })

  it('护盾成形有屏壁 —— 筑盾是个动作,不许只沉在日志一行', () => {
    // 战斗四向反馈已齐(攻击横踏/受击震颤/闪避侧让/胜方定音),唯独**护盾开启**
    // 只落在日志一行淡字 —— 防御姿态的呈现本该是一道金色屏壁。判定:
    // shield 行必须触发 triggerShield(护盾方亮 shield-rise),且不得误走横踏
    // (shield 无出手方)或震颤(那是对「打中了」的反馈)。
    const fight = FILES.find(f => f.path === 'components/adventure/CombatPanel.vue')
    expect(fight?.src, '护盾成形要有绑点(shieldCls)').toContain('shieldCls.e')
    expect(fight?.src).toContain('shieldCls.p')
    expect(fight?.src, 'shield 行必须触发护盾成形').toMatch(/entry\.t === 'shield'[\s\S]{0,120}triggerShield/)
    expect(fight?.src, '护盾无出手方,不得跟着横踏').not.toMatch(/entry\.t === 'shield'[\s\S]{0,80}triggerStrike/)
    const css = readFileSync(resolve(__dirname, '../style.css'), 'utf-8')
    expect(css, 'shield-rise 的帧定义被删了 —— 护盾退回一行淡字').toMatch(/@keyframes shield-rise/)
  })

  it('胜方有定音 —— 败方散墨,赢家也得有这一声', () => {
    // 战斗因果环:受击震颤/出手横踏/败亡散墨(灰化)都有了,唯独胜方没有任何
    // 「这一场我赢了」的视觉句点。光圈绕头像荡一圈收拢(victory-seal,
    // 石绿=胜/完成,与败方灰化成对) —— 只挂在敌败(defeated==='e')那侧,
    // 自己输了不庆祝对手。拆了绑、挪了侧、或删了帧,下面红。
    const fight = FILES.find(f => f.path === 'components/adventure/CombatPanel.vue')
    expect(fight?.src, '胜方要有定音(foe-victorious),不许只让败方灰化').toContain(`defeated === 'e' ? 'foe-victorious'`)
    const css = readFileSync(resolve(__dirname, '../style.css'), 'utf-8')
    expect(css, 'victory-seal 的帧定义被删了 —— 胜方退回无声').toMatch(/@keyframes victory-seal/)
    expect(css).toMatch(/\.foe-victorious[\s\S]{0,60}animation:\s*victory-seal/)
  })

  it('炼器技艺露在铁砧前 —— 在哪儿长,就在哪儿看得见', () => {
    // 锻打/铭纹的经验正是在装备强化/重铸界面长的,此前却只在炼丹弹窗的全局
    // 技艺表里看得到 —— 炼器的地方看不见自己在长,等于没长。钉死:装备详情
    // 弹窗必须有锻打/铭纹两项的技艺进度,判据与技艺表同源(skillStageName/
    // skillStageProgress),不许退回「去丹房翻」。
    const dlg = FILES.find(f => f.path === 'components/equipment/EquipmentDetailDialog.vue')
    expect(dlg?.src, '装备详情要有炼器技艺进度(forgeSkills)').toContain('forgeSkills')
    expect(dlg?.src, '必须含锻打与铭纹两项(set of smithing/inscribe)').toContain("'smithing', 'inscribe'")
    expect(dlg?.src, '判据必须与技艺表同源(skillStageProgress),不另起一套').toContain('skillStageProgress')
    expect(dlg?.src, '技艺要有进度条可读').toContain('<ProgressBar')
  })

  it('功法进修付不起置灰+列差 —— 缺哪样、差多少,按钮上直说', () => {
    // 「进修」曾永不置灰,资源不足只弹一句笼统 toast「悟道点或残页不足」,
    // 不报缺哪样也不说差多少 —— 与全仓“付不起置灰+列差”族规脱节。修法与
    // 聚气丹/建筑/法宝同款:按钮 disabled + 行内「尚差 N 悟道 · M 残页」。
    const gongfa = FILES.find(f => f.path === 'components/cultivation/GongfaDialog.vue')
    expect(gongfa?.src, '进修按钮必须有 disabled(upAffordable)').toContain(':disabled="!upAffordable"')
    expect(gongfa?.src, '付不起要换口「尚差」,不许只弹笼统 toast').toContain('尚差 {{ upShort }}')
    expect(gongfa?.src, '双缺要报差数(upShort),不沉到底').toContain('upShort')
    const svc = readFileSync(resolve(__dirname, '../core/gongfaService.ts'), 'utf-8')
    expect(svc, '不足分支仍该留着(防御性兜底),但不许是唯一反馈').toContain('悟道点或残页不足')
  })

  it('天道变数已满要置灰 —— 至多三条,不许静默点不动', () => {
    // 挑战书选满第三枚后再点第四枚,此前 toggleDraftMutator 静默 return:
    // 疯狂点选的人以为没点到,又是重复点。上限既然有(CHALLENGE_MAX_MUTATORS),
    // 未选中的芯片在满员时就该置灰禁用 + title 说明 —— 别让「按了没反应」发生。
    const cel = FILES.find(f => f.path === 'views/CelestialView.vue')
    expect(cel?.src, '变数满员要有置灰判据(draftFull)').toContain('draftFull')
    expect(cel?.src, '满员时未选芯片必须 disabled').toContain(':disabled="!draft.mutatorIds.includes(m.id) && draftFull"')
    expect(cel?.src, '置灰要有 opacity 分隔,不许与正常态同灰').toContain('opacity-45')
    expect(cel?.src, 'title 要直说「已选满」').toContain('已选满')
  })

  it('天道熔炉付不起置灰+列差 —— 三样燃料不许只有一句笼统 toast', () => {
    // 熔炉三个消费按钮曾口径不一:「熔尽本包」disabled 亮 0 道源,而「灵石→道源」
    // 与「道源→道果」永远可点、点了才 toast「灵石不足/道源不足 N」。
    // 与其余消费点同族:付不起置灰 + 内联「尚差 N 石/道源」,不许只有点了才响。
    const cel = FILES.find(f => f.path === 'views/CelestialView.vue')
    expect(cel?.src, '灵石行付不起要置灰(stoneShort)').toContain(':disabled="stoneShort > 0"')
    expect(cel?.src, '灵石行要换口「尚差 N 石」').toContain('尚差 {{ formatGN(stoneShort) }} 石')
    expect(cel?.src, '道果行付不起要置灰(daoShort)').toContain(':disabled="daoShort > 0"')
    expect(cel?.src, '道果行要换口「尚差 N 道源」').toContain('尚差 {{ daoShort }} 道源')
    expect(cel?.src, '判据必须现算,不许再永远可点').toContain('endgame.daoSource')
    // 数值语义(回归审查 HIGH):灵石持平与花费都是 GNum,短额若只减尾数(.m - .m)
    // 会丢掉指数 —— 6.1 万价、30 万持有曾被错置灰且报「尚差 3 石」三位数错。
    // 必须走 GNum 指数感知减法(subClamp 与 spendStone 同账 + toNum 落普通数)。
    expect(cel?.src, '尚差必须走 GNum 指数感知减法').toContain('toNum(subClamp(furnaceStoneCost(), resources.spiritStone))')
    expect(cel?.src, '不许用尾数直接相减当短额(会丢指数)').not.toMatch(/furnaceStoneCost\(\)\.m - resources\.spiritStone\.m/)
  })

  it('今日天道有占位 —— 未择道途,也要说出它去哪了', () => {
    // 「今日天道」区块 v-if="daily",而 daily 依赖 endgame.daoPath —— 刚登真仙
    // 未择道途时整块消失,玩家切到试炼页找不到今日天道,会以为 bug。类目下
    // 「天道变数/试炼」都常驻,唯独这块没空态。补一句「择定道途后在此展开」。
    const cel = FILES.find(f => f.path === 'views/CelestialView.vue')
    expect(cel?.src, '今日天道未择道途要有占位(v-else)').toMatch(/<section v-else>/)
    expect(cel?.src, '占位要直说「随道途而定」').toContain('今日天道随道途而定')
    expect(cel?.src, '占位要指明去道途页择定').toContain('择定')
  })

  it('灵根鉴定结果说给读屏 —— 全屏定格不许对屏幕阅读器无声', () => {
    // 创角「灵根鉴定」全屏定格是核心结果播报,却对读屏完全无声(动画期间
    // pointer-events:none、无 aria-live)—— 视障玩家看完一屏动画仍不知道
    // 测出哪条根。定格那一瞬(animating=false)必须用 aria-live=polite 念真名。
    const reveal = FILES.find(f => f.path === 'components/common/SpiritRootReveal.vue')
    expect(reveal?.src, '鉴定结果必须挂 aria-live 播报区').toContain('aria-live="polite"')
    expect(reveal?.src, '播报区必须在定稿件时出现(animating=false)').toMatch(/v-if="!animating"/)
    expect(reveal?.src, '要念出「灵根鉴定完毕」的真名').toContain('灵根鉴定完毕')
    expect(reveal?.src, '读屏专用区必须视觉隐藏(sr-only)').toContain('sr-only')
  })

  it('世界越界有一声 —— 换一片天,不许静默揭幕', () => {
    // 越界是全流程最重大事件(入仙界/神界/混沌海),视觉有 2.8s 揭幕遮罩,
    // 从此却没有声音 —— 该响就响,不能让最高潮静静流过。判据:揭示触发
    // 时必须 playSfx('worldRise')(与判据 announceWorldEntry 同一触发点),音效
    // 引擎里 worldRise 要有自己的庄严谱(深钟+大跨度上行),不许退回 breakthrough。
    const veil = readFileSync(resolve(__dirname, '../components/common/WorldTransitionVeil.vue'), 'utf-8')
    expect(veil, '越界宣告必须有配乐唤醒').toContain(`playSfx('worldRise')`)
    const audio = readFileSync(resolve(__dirname, '../core/audio.ts'), 'utf-8')
    expect(audio, 'worldRise 要进 SfxName 联合').toContain(`| 'worldRise'`)
    expect(audio, 'worldRise 要有自己的谱,不许退回其他音效').toMatch(/case 'worldRise':/)
  })

  it('道痕满卷有提示 —— 最古之痕将覆去,不许玩家蒙在鼓里', () => {
    // 道痕 60 则封顶后,新痕从头部挤入、最古一痕被静默覆去,玩家根本不知道自己
    // 最早的履历会无声消失。封顶 = 要留意(琥珀族,同突破已封顶/遇事勿扰),
    // 判据必须读 store 的 marksFull(与 addMark 的封顶同源),不许视图另数一遍。
    const cel = FILES.find(f => f.path === 'views/CelestialView.vue')
    expect(cel?.src, '天界道痕区要挂满卷提示').toContain('endgame.marksFull')
    expect(cel?.src, '满卷要是要留意的琥珀,不是普通淡字').toMatch(/endgame\.marksFull[\s\S]{0,80}text-amber-ink/)
    expect(cel?.src, '判据必须读 store 的 marksFull,不许视图自己 <count 比较').not.toContain('marks.length >= MAX_MARKS')
    expect(cel?.src, '覆去的话要直说(最古覆去),不许只报个数字').toContain('覆去')
    const store = readFileSync(resolve(__dirname, '../stores/endgame.ts'), 'utf-8')
    expect(store, 'marksFull 必须与 addMark 同源(同一 MAX_MARKS)').toMatch(/marksFull = computed\([\s\S]{0,80}MAX_MARKS/)
    expect(store, 'MAX_MARKS 被改成私有会让提示失去同源判据').toContain('export const MAX_MARKS')
  })

  it('归来卷轴配一枚印 —— 石绿「归」印,不走朱砂(那是里程碑的色)', () => {
    // 突破幕有朱砂「破」印 + 全屏墨浪/墨点/金环,归来卷轴此前只有一行淡字 ——
    // 表彰不该偏废:归总是「此行已结」的完成态,该有自己的印。语义色族规不变:
    // 朱砂=里程碑(突破/首领),石绿=完成/结清(今日已毕/尽收/归来) —— 谁把
    // 归来印换成朱砂,或者把印拆回一行字,下面红。
    const dlg = FILES.find(f => f.path === 'components/offline/OfflineRewardDialog.vue')
    expect(dlg?.src, '归来卷轴要有石绿「归」印(animate-seal-breathe + border-jade)').toContain('animate-seal-breathe')
    expect(dlg?.src).toContain('border-jade')
    expect(dlg?.src, '归 来不能退回一行淡字 —— 完成态要有印身').toContain('h-16 w-16')
    expect(dlg?.src).not.toContain('border-cinnabar')
    const css = readFileSync(resolve(__dirname, '../style.css'), 'utf-8')
    expect(css, 'seal-breathe 的帧定义被删了 —— 归来印退回瞬显').toMatch(/@keyframes seal-breathe/)
    const tw = readFileSync(resolve(__dirname, '../../tailwind.config.js'), 'utf-8')
    expect(tw, 'seal-breathe 的映射被拆了 —— 归来印失去呼吸').toContain(`'seal-breathe': 'seal-breathe`)
  })

  it('提示条全库开口 —— toast 承载动作结果,不许对读屏全哑', () => {
    // toast 几乎通报了每一笔获得与每一处不足,ToastHost 却没有 live region ——
    // 视觉玩家有滑入的音画,读屏玩家点完只听个静默。挂在容器上:TransitionGroup
    // + :key=id 保证新 toast 只新增一个节点,念出的是新条;旧条移除不发声。
    const host = FILES.find(f => f.path === 'components/common/ToastHost.vue')
    expect(host?.src, 'toast 容器要挂 aria-live=polite').toContain('aria-live="polite"')
  })

  it('在身之卦散卦要自报 —— 整块消失不许对读屏无声', () => {
    // 散卦是后台随心跳自散的:整块 v-if=currentReading 安静消失、按钮随之复活,
    // 没有 toast 可依 —— 不念一句,读屏玩家就只知道它没了。以「有无」布尔为
    // 观察对象(每秒心跳都在换新对象,watch 身份只会每秒误触发),只在真→假那
    // 一瞬开口。成卦有 toast(live 区落地即念),不重报。
    const codex = FILES.find(f => f.path === 'views/RealmCodexView.vue')
    expect(codex?.src, '散卦要用有无布尔翻转触发,不许 watch 每秒心跳换的对象').toMatch(/watch\(hasReading/)
    expect(codex?.src, '播报区要 aria-live=polite + sr-only').toContain('aria-live="polite"')
    expect(codex?.src, '散卦要念「卦力已散」').toContain('卦力已散')
    expect(codex?.src, '成卦 toast 要附带存续时长(卦是自散的,先得知道活多久)').toContain('分自散')
  })

  it('逆天改命重掷要念出新牌 —— 灵根鉴定的中间态不许哑', () => {
    // 定格有 SpiritRootReveal 的播报,途中「逆天改命」重掷却只换画面不出声 ——
    // 同一个交互族的一半开了口、一半还哑着。rollSeq 只在成功重掷自增,以它为
    // 观察对象:每次重掷念一遍新牌。
    const create = FILES.find(f => f.path === 'views/CreateView.vue')
    expect(create?.src, '重掷结果要挂 aria-live=polite 播报区').toContain('aria-live="polite"')
    expect(create?.src, '播报区要视觉隐藏(用 Tailwind 全局 sr-only)').toContain('sr-only')
    expect(create?.src, '观察对象要是只增不减的 rollSeq').toMatch(/watch\(rollSeq/)
    expect(create?.src, '播报句要念出「重掷得」(新牌开场白)').toContain('重掷得')
  })

  it('问卦付不起就置灰+列差 —— 缺哪样、直说,不许点了才弹', () => {
    // 此前按只在「卦在身」时限灰:悟道点不足时照常可点,点下去才弹 warn toast。
    // 与进修/熔炉同款纪律:付不起的按钮当场置灰、内联写出差额(防御臂仍在 core)。
    const codex = FILES.find(f => f.path === 'views/RealmCodexView.vue')
    expect(codex?.src, '按钮要绑合成的 disabled(卦在身或不足都灰)').toMatch(/:disabled="askDisabled"/)
    expect(codex?.src, '置灰文案要与判据同源(同一个 askShort 算出来)').toMatch(/askShort = computed\(/)
    expect(codex?.src, '置灰时按钮要直说差几枚悟道').toContain('尚差')
  })

  it('遇事勿扰只拦弹窗,不吞稀有档宣布 —— 机缘/奇缘的名号要给', () => {
    // 勿扰路径此前 autoResolveEvent 后直接 return:机缘/奇缘被自动结清却全程无声
    // (正常路径对这两档各有「千载难逢/缘分再续」toast)。抽 announceEventTier 共用:
    // 勿扰照样 autoResolve(不给阻塞弹窗),但两档的名号照念 —— 千分之几的稀有度
    // 不吭声 = 体感归零。helper 从 core/eventTier 取档,不另写一份判据。
    const explore = readFileSync(resolve(__dirname, '../core/exploration.ts'), 'utf-8')
    expect(explore, '要抽出共用的 announceEventTier helper').toContain('function announceEventTier')
    expect(explore.match(/announceEventTier\(ev\)/g)?.length ?? 0, '勿扰与正常两条路径都要念档名(helper 至少两处调用)').toBeGreaterThanOrEqual(2)
    expect(explore, '勿扰仍走 autoResolveEvent(不弹阻塞弹窗)').toContain('autoResolveEvent(ev.id, region.tier)')
    expect(explore, 'helper 要从 eventTier 取档,不另写判据').toContain('eventTierDef(eventTierOf(ev.id))')
  })

  it('显式主题首帧定格 —— 暗色玩家冷启动不许闪一帧亮白', () => {
    // boot 内联色块此前只见系统偏好:亲手选了「夜间」而系统是亮色的玩家,冷启动
    // 首帧仍闪亮白(存档分片加密首帧读不到;主题偏好非敏感,单独落一枚不加密小键)。
    // 机制三端缺一即红:theme.ts 写/删键 + index.html 内联脚本绘制前读键定
    // data-theme + boot 样式按 data-theme 给显式暗/亮。
    const theme = readFileSync(resolve(__dirname, '../core/theme.ts'), 'utf-8')
    expect(theme, 'applyTheme 要把显式选择写成首帧小键').toContain('setItem(BOOT_THEME_KEY, theme)')
    expect(theme, 'auto 不写(首帧按系统偏好走)').toContain('removeItem(BOOT_THEME_KEY)')
    const html = readFileSync(resolve(__dirname, '../../index.html'), 'utf-8')
    expect(html, '首帧要在绘制前读小键定 data-theme').toContain('document.documentElement.dataset.theme = _bt')
    expect(html, 'boot 样式要按 data-theme 给显式暗/亮').toContain("html[data-theme='dark'] #app")
  })

  it('道号与名号各归其位 —— 玩家的道名只叫道号,称号系统才叫名号', () => {
    // 一词多义互串过:玩家道名(DaoHao 常量/创角「道 号」)被转世弹窗叫「名号」、
    // 构筑名也叫「名号」,而「名号」本是称号系统(TitlesView 三十顶)的正名。
    // 统一:道名一律「道号」,称号页保留「名号」,构筑名用「名字」。
    const reinc = readFileSync(resolve(__dirname, '../components/character/ReincarnationDialog.vue'), 'utf-8')
    expect(reinc, '道名要叫「道号」').toContain('新一世的道号')
    expect(reinc, '不许把道名叫成「名号」').not.toContain('新一世的名号')
    expect(reinc, '转世天赋要统一叫「先天之姿」(核心规范名)').toContain('另有先天之姿自开')
    expect(reinc, '不许冒出孤例「天资」').not.toContain('另有天资自开')
    const build = readFileSync(resolve(__dirname, '../views/BuildView.vue'), 'utf-8')
    expect(build, '构筑名不用「名号」消歧').not.toContain('起个名号')
    const cult = readFileSync(resolve(__dirname, '../views/CultivationView.vue'), 'utf-8')
    expect(cult, '聚气丹按钮两态要同念「石」(380 缩放纪律)').not.toContain('灵石 +{{')
  })

  it('资源叫法全库一贯 —— 散文全称、紧凑按钮/尚差简称,不许同面板混排', () => {
    // 资源名术语族收口:读数散文/名称位=全称(灵石/悟道点/器灵尘/玄铁/功法残页),
    // 紧凑按钮与「尚差」行=已注释简称(石/铁)。曾裂：灵草坊价目灵石+尚差灵石
    // (破全球「尚差 X 石」)、进修按钮悟道 vs 顶部悟道点、建筑卡 50 铁 vs 玄铁 N 块、
    // 装备重铸 尘×N vs 强化 器灵尘×N(同 toast 前后脚)。
    const inv = FILES.find(f => f.path === 'views/InventoryView.vue')
    expect(inv?.src, '灵草坊尚差要跟全球「尚差 N 石」口风').toMatch(/尚差 \{\{ formatGN\(row\.short\) \}\} 石/)
    expect(inv?.src, '灵草坊价目行要全称「灵石」').toContain('单价 {{ formatGN(row.price) }} 灵石')
    const gongfa = FILES.find(f => f.path === 'components/cultivation/GongfaDialog.vue')
    expect(gongfa?.src, '进修按钮与横幅都要全称「悟道点」').toContain('悟道点 · {{ upCost.page }} 残页')
    const equip = FILES.find(f => f.path === 'components/equipment/EquipmentDetailDialog.vue')
    expect(equip?.src, '重铸行要用全称「器灵尘」').toContain('器灵尘×{{ reforgeCostVal.dust }}')
    expect(equip?.src, '不许重铸再退回裸「尘×」').toContain('花 器灵尘×')
    const service = readFileSync(resolve(__dirname, '../core/buildingService.ts'), 'utf-8')
    expect(service, '建筑尚差两臂同用简称「铁」').toContain('} 铁`')
    expect(service, '不许尚差里又冒回「玄铁 N 块」').not.toMatch(/玄铁 `|玄铁 \$\{/)
    const cel = FILES.find(f => f.path === 'views/CelestialView.vue')
    expect(cel?.src, '真仙导览散文要用全称「功法残页」').toContain('功法残页、灵石')
    // 散文 toast 里的读数同样全称 —— 连胜赏赐与历练回执都曾写「悟道 N」,
    // 与 d7783ee 收口的「混排零容忍」同类(同 toast 里灵石=N、悟道=N 直接展示裂痕)
    const early = readFileSync(resolve(__dirname, '../core/earlyGameService.ts'), 'utf-8')
    expect(early, '连胜赏赐散文 toast 要全称「悟道点」').toContain('· 悟道点 ${reward.wudao}')
    expect(early, '连胜 toast 不许再写裸「悟道 N」').not.toContain('悟道 ${reward.wudao}')
    const explore = readFileSync(resolve(__dirname, '../core/exploration.ts'), 'utf-8')
    expect(explore, '历练回执散文要全称「悟道点」').toContain('、悟道点 ${s.wudaoGain}')
    expect(explore, '历练回执不许写裸「、悟道 N」').not.toContain('、悟道 ${s.wudaoGain}')
  })

  it('按下要有回声 —— chip-ink 基类自带按压反馈,裸按钮不许全无声', () => {
    // 全库最常见的微动作按钮是 chip-ink(服丹/闭关/灵脉/设置 chips),此前只有
    // btn-seal/btn-ghost 两个基类自带 :active —— chips 按下零反馈。补基类规则
    // (轻缩+淡染,disabled 不触发),再扫一圈裸按钮逐一补 active:opacity/scale。
    const css = readFileSync(resolve(__dirname, '../style.css'), 'utf-8')
    expect(css, 'chip-ink 基类要有 :active 按压反馈(限 button —— 装饰性 chip 是 span,不该有按压态)').toMatch(/button\.chip-ink:active:not\(:disabled\)/)
    expect(css, 'chip-ink 要带 transition(弹簧感,与 btn-ghost 同款)').toMatch(/\.chip-ink \{[\s\S]{0,300}transition:/)
    const char = FILES.find(f => f.path === 'views/CharacterView.vue')
    expect(char?.src, '卡状可点元素(试炼卡)也要带按压反馈').toContain('active:scale-99')
  })

  it('踏入仙途要有到首页的读屏起手句 —— 鉴定播报不随路由跳转断档', () => {
    // 灵根鉴定定格播报(aria-live polite)定格后 400ms 就随 router.push('/') 卸载,
    // 读屏可能当场切断;而首页此前全无 aria-live。CreateView 跳转前把起手句交给
    // ui store(worldEnter),首页挂载时用自家 aria-live 补念,读完即清 ——
    // 只在创角→首页这一趟念,日常回首页不重复。
    const create = FILES.find(f => f.path === 'views/CreateView.vue')
    expect(create?.src, '跳转前要把起手句交给 ui store').toContain('ui.worldEnter =')
    const home = FILES.find(f => f.path === 'views/HomeView.vue')
    expect(home?.src, '首页要挂 aria-live 播报区').toContain('aria-live="polite"')
    expect(home?.src, '首页要读 ui store 的 worldEnter').toContain('ui.worldEnter')
    const ui = readFileSync(resolve(__dirname, '../stores/ui.ts'), 'utf-8')
    expect(ui, 'ui store 要有一枚一次性交接旗').toContain('worldEnter')
  })

  it('人物子页返回控件齐 —— 兄弟页有「← 人物」,这四个不许裸奔', () => {
    // /titles /collection /build /legacy 都是 CharacterView 的子目标,与 Dongfu/
    // RealmCodex/Souls 同类 —— 后三者都有返回行,这四个首行即 SectionTitle 无返回
    // (底栏五格兜底但不高亮它们)。按兄弟页同款补「← 人物」,不许再裸。
    for (const f of ['TitlesView', 'CollectionView', 'BuildView', 'LegacyView']) {
      const src = FILES.find(x => x.path === `views/${f}.vue`)?.src ?? ''
      expect(src, `${f} 要有回人物的返回行`).toContain('to="/character"')
      expect(src, `${f} 返回行要写「← 人物」`).toContain('← 人物')
    }
  })

  it('同物一名回潮就红 —— 名号/气血/灵根念白的用户面命名不许分叉', () => {
    // 跨屏审计抓到的四处「同一物两处念法」,统一起见一律以画面旧有者为准:
    // ① 可佩戴荣誉:荣誉页/人物页都叫「名号」,奖励 toast 与达成赏不许再叫「称号」;
    // ② 最大生命值:人物页/战斗叫「气血」,装备详情与图鉴不许再叫「生命」(上限亦然);
    // ③ 灵根念白:gradeName 已以「灵根」结尾,重掷播报句尾不许再缀一个「灵根」。
    // 故障注入:任一改回别名(称号/生命/句尾灵根) → 红。
    const progress = readFileSync(resolve(__dirname, '../core/progress.ts'), 'utf-8')
    expect(progress, '成就赏与 toast 要写字面「名号」').toContain('名号「')
    expect(progress, '赏赐 toast 要念「获得名号」').toContain('获得名号「')
    const char = FILES.find(f => f.path === 'views/CharacterView.vue')
    expect(char?.src, '人物页无称号时的占位要写「未佩名号」').toContain('未佩名号')
    const itemText = readFileSync(resolve(__dirname, '../ui/itemText.ts'), 'utf-8')
    expect(itemText, '装备/图鉴的属性平铺 maxHp 要写「气血」').toContain("maxHp: '气血'")
    const statNames = readFileSync(resolve(__dirname, '../ui/statNames.ts'), 'utf-8')
    expect(statNames, '气血上限与气血同一族 —— maxHpPct 不许单独留在「生命上限」').toContain("maxHpPct: '气血上限'")
    const equip = FILES.find(f => f.path === 'components/equipment/EquipmentDetailDialog.vue')
    expect(equip?.src, '装备详情的三围平铺要随全票叫「气血」').toContain("push('气血', r.flats.maxHp")
    const cult = FILES.find(f => f.path === 'views/CultivationView.vue')
    expect(cult?.src, '破境益的散文脚注也要说「名号」,不许留「装备·称号」混排').toContain('装备·名号·天时')
    expect(cult?.src, '劫势单波那行也要说「最大气血」,气血一族不许残留「最大生命」').not.toContain('最大生命')
    expect(cult?.src, '修炼速度一族全票认 canonical(STAT_NAMES),修行速度/修为速率不许回来').not.toMatch(/修行速度|修为速率/)
    const create = FILES.find(f => f.path === 'views/CreateView.vue')
    expect(create?.src, '重掷念白要读 gradeName,不许句尾再缀「灵根」').toMatch(/重掷得「\$\{p\.gradeName\}」,/)
    expect(create?.src, '「天灵根」灵根的口吃念法不许回来').not.toMatch(/」灵根,/)
  })

  it('减少动效要连延迟一起清零 —— 只压时长,入场还会一档一档往外跳', () => {
    // 全局 reduce-motion 规则把 animation-duration 压到 0.01ms,却不碰
    // animation-delay:stagger-in 每档挂 0.02–0.36s、WarpPortal/SpiritRootReveal
    // 还有整串 0.05–1s 的延迟 —— 时长压到零延迟还在,内容照旧分步闪现,
    // 「减少动效」减了个寂寞。系统偏好与「减少动效」设置项两条规则
    // 都必须把 delay 一并清零:动效省略 = 时长 + 延迟双双归零。
    // 故障注入:删掉任一规则的 animation-delay → 红。
    const css = readFileSync(resolve(__dirname, '../style.css'), 'utf-8')
    expect(css, '清零对象要真实存在 —— 先有分步入场的多档延迟,才谈得上把它清零').toMatch(/\.stagger-in[\s\S]{0,400}animation-delay:/)
    const delayKills = css.match(/animation-delay:\s*0s\s*!important;/g) ?? []
    expect(delayKills, '系统偏好与「减少动效」设置项各要一处 delay 清零').toHaveLength(2)
    const durKills = css.match(/animation-duration:\s*0\.01ms\s*!important;/g) ?? []
    expect(durKills, 'reduce-motion 仍要压时长 —— 只清 delay 不清时长,就是还留着动画、只是没了次序').toHaveLength(2)
  })
})
