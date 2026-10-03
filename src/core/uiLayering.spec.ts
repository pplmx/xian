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
})
