/* oxlint-disable no-console -- 分层审计的产出是给人看的清单 */
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
import { describe, expect, it } from "vite-plus/test";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const SRC = resolve(__dirname, "..");

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (entry.endsWith(".vue")) out.push(full);
  }
  return out;
}

/** 按后缀收文件 —— 界面判据的扫描面不止 components/views,外壳、脚本常量、样式表都要看得见 */
function walkByExt(dir: string, ext: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walkByExt(full, ext, out);
    else if (entry.endsWith(ext)) out.push(full);
  }
  return out;
}

const FILES = walk(SRC)
  .filter(
    (f) => f.includes(`${join("src", "components")}`) || f.includes(`${join("src", "views")}`),
  )
  .map((f) => ({
    path: relative(SRC, f).replace(/\\/g, "/"),
    // 注释里会提到这些写法(比如「曾经是自己铺的一层 fixed inset-0」),判据只看真代码
    src: readFileSync(f, "utf8")
      .replace(/<!--[\s\S]*?-->/g, "")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, ""),
  }));

const BASE_MODAL = "components/common/BaseModal.vue";

describe("界面分层 · 浮层只有一个出处", () => {
  it("自己铺满屏又带可点控件的浮层,必须走 BaseModal", () => {
    const offenders = FILES.filter((f) => f.path !== BASE_MODAL)
      .filter((f) => /fixed inset-0/.test(f.src) && /<button/.test(f.src))
      .map((f) => f.path);
    console.log(
      `\n全屏浮层出处:${BASE_MODAL}${offenders.length ? ` + 越界的 ${offenders.length} 个` : ""}`,
    );
    expect(
      offenders,
      "这些文件自己铺了全屏浮层 —— 会一并退出 dialog 语义、焦点陷阱与控件尺子;改用 BaseModal,或说明为何它必须自己铺",
    ).toEqual([]);
  });

  it("每个弹窗都有可辨识的名字 —— 读屏要念得出是哪一扇", () => {
    const nameless: string[] = [];
    for (const f of FILES) {
      // 逐个取 <BaseModal ...> 开标签
      for (const m of f.src.matchAll(/<BaseModal\b[^>]*>/g)) {
        const tag = m[0];
        const title = /(?<![:\w-])title="([^"]*)"/.exec(tag)?.[1];
        const boundTitle = /:title="([^"]*)"/.exec(tag)?.[1];
        const aria = /aria-label="([^"]*)"/.exec(tag)?.[1];
        if (title !== undefined && title.trim() !== "") continue;
        if (
          boundTitle !== undefined &&
          boundTitle.trim() !== "" &&
          !/^\s*(['"])\1?\s*$/.test(boundTitle)
        )
          continue;
        if (aria !== undefined && aria.trim() !== "") continue;
        nameless.push(`${f.path} → ${tag.slice(0, 60)}`);
      }
    }
    expect(nameless, "这些弹窗没有名字 —— role=dialog 读出来是光秃秃一句「对话框」").toEqual([]);
  });

  it("每个弹窗都关得掉 —— 关闭键挂上去必须有人接", () => {
    const stuck: string[] = [];
    for (const f of FILES) {
      for (const m of f.src.matchAll(/<BaseModal\b[^>]*>/g)) {
        const tag = m[0];
        if (/@close=/.test(tag)) continue;
        if (/:closable="false"/.test(tag)) continue;
        stuck.push(`${f.path} → ${tag.slice(0, 60)}`);
      }
    }
    expect(
      stuck,
      '这些弹窗既没有 @close 也没写明 :closable="false" —— 关闭键与 Esc 都会静默失效',
    ).toEqual([]);
  });

  it("视图里不许裸 back() —— 冷启动时它会把人送出游戏", () => {
    // 判据:站内没有上一页时(书签 / deep link / PWA 冷启动恢复路由),
    // history.state.back 为 null,裸 back() 会退到 about:blank,界面整个消失。
    // 统一走 router/goBack.ts 的 goBack(router, 父页)。
    const offenders = FILES.filter((f) => /\.back\(\)/.test(f.src)).map((f) => f.path);
    expect(
      offenders,
      "这些视图直接调了 back() —— 改用 @/router/goBack 的 goBack(router, 父页)",
    ).toEqual([]);
  });

  it("装备卡与连战场次按钮有稳定可访问名", () => {
    const card = FILES.find((f) => f.path === "components/equipment/EquipmentCard.vue");
    expect(card?.src, "装备卡要把截断名之外的佩/锁/共鸣写进 aria-label").toContain("aria-label");
    expect(card?.src).toContain("佩戴中");
    const gauntlet = FILES.find((f) => f.path === "components/celestial/GauntletPanel.vue");
    expect(gauntlet?.src, "连战场次按钮不能只念一个数字").toContain("aria-label");
    expect(gauntlet?.src).toMatch(/第 \$\{i \+ 1\} 场/);
    // 终局战报的每一行既要文字也要伤害数字 —— 主历练 CombatPanel 早把 entry.dmg
    // 渲染出来,同一份 CombatLogEntry 在 GauntletPanel 上却只打了 text、把 dmg 丢在
    // 一边:玩家看不到「这下打了多少」。两边必须同一副面孔(crit 还要朱砂标)。
    expect(gauntlet?.src, "终局战报该把伤害数打出来").toContain('v-if="entry.dmg"');
    expect(gauntlet?.src, "暴击的伤害数要朱砂标出").toContain(
      "entry.t === 'crit' ? 'text-cinnabar'",
    );
  });

  it("问卦剩余与顿悟/巡游窗口在暂停时不空耗墙上时钟", () => {
    const codex = FILES.find((f) => f.path === "views/RealmCodexView.vue");
    // 问卦倒计时走暂停感知时钟(gameNow):暂停时 activeDivination 因 gameNow() 冻结不散
    // (exploration.spec 钉死「暂停中卦力不得因墙上时钟散掉」),倒计时若用墙上钟会在暂停里
    // 一路归零、恢复后又跳回 —— 与结算同源,故与顿悟/巡游同纪律,不允许 useNow。
    expect(codex?.src).toContain("gameNow");
    expect(codex?.src).toMatch(/expiresAt - now\.value/);
    const cave = FILES.find((f) => f.path === "components/dongfu/CaveEventModal.vue");
    expect(cave?.src).toContain("gameNow");
    const enlighten = FILES.find((f) => f.path === "components/cultivation/EnlightenmentModal.vue");
    expect(enlighten?.src).toContain("gameNow");
  });

  it("顿悟/巡游临散前转朱砂 —— 限时增益不许静默自散", () => {
    // 两扇引擎弹窗都有倒计时,但临散前若还是金色,读长文案的玩家会白丢这份
    // 增益(巡游关掉当天就没了)。阈值单源(URGENT_COUNTDOWN_SEC),颜色就是「快选」;
    // 阈值双写或改回金身,下面这条都红。
    const cave = FILES.find((f) => f.path === "components/dongfu/CaveEventModal.vue");
    expect(cave?.src).toContain(`remaining <= URGENT_COUNTDOWN_SEC ? 'text-cinnabar'`);
    const enlighten = FILES.find((f) => f.path === "components/cultivation/EnlightenmentModal.vue");
    expect(enlighten?.src).toContain(`remaining <= URGENT_COUNTDOWN_SEC ? 'text-cinnabar'`);
    const constants = readFileSync(resolve(__dirname, "../data/constants.ts"), "utf-8");
    expect(constants).toMatch(/URGENT_COUNTDOWN_SEC = 10/);
  });

  it("历练页复聚/已守跟 useNow 走,倒计时不会定格", () => {
    const adv = FILES.find((f) => f.path === "views/AdventureView.vue");
    expect(adv?.src).toContain("useNow");
    expect(adv?.src).toMatch(/hoursUntilRevive\([^)]*now\.value/);
  });

  it("「新」角标清账只发生在离开、且门掉没看过的分支 —— 别退回挂载即抹", () => {
    // 两处「新」角标(背包/图鉴)共享同一清账纪律:挂载清会把首帧刚渲染的「新」
    // 立刻抹掉;图鉴默认页签是成就,只看成就就离开也不该推进界(评审 MEDIUM-1)。
    // 违反的两种回退(无条件挂载清 / 图鉴碑掉 sawCollectionTab 门)下面都红。
    const bag = FILES.find((f) => f.path === "views/InventoryView.vue");
    expect(bag?.src).toMatch(/onUnmounted\(\(\).*markInventorySeen\(\)/);
    expect(bag?.src).not.toMatch(/onMounted\(\(\).*markInventorySeen/);
    const codex = FILES.find((f) => f.path === "views/CollectionView.vue");
    expect(codex?.src).toContain("sawCollectionTab");
    expect(codex?.src).toMatch(/if \(sawCollectionTab\.value\) quests\.markCollectionSeen\(\)/);
    expect(codex?.src).not.toMatch(/onMounted\(\(\).*markCollectionSeen/);
    // 页签上也得露:默认在成就页不切进去看不见有货,「收藏」页签挂新得点(呼吸提醒)
    expect(codex?.src).toContain(`dot: t.id === "collection"`);
    // 底部导航的背包点:任何页都看得见「有新货」,挂在 inventory.newItemCount 上(删则全局退回看不见)。
    // 量价分档:恰好一件 = 原来的小点(轻晃不吵),≥2 件才升级成计数徽标「N」、9+ 封顶 ——
    // 别退回「只有有没有量」的老点、也别把「1」也做成满格徽标(越吵越没人看)。
    const nav = FILES.find((f) => f.path === "components/common/BottomNavigation.vue");
    expect(nav?.src).toContain("bagNewCount");
    expect(nav?.src).toContain("tab.name === 'inventory'");
    expect(nav?.src).toContain("bagNewCount >= 2");
    expect(nav?.src).toContain('bagNewCount > 9 ? "9+"');
    expect(nav?.src).toContain("bagNewCount === 1");
    /*
     * 修炼点的「可破境」圆点。
     *
     * 破境是这一作最要紧的一次点击,而在此之前只有站在修炼页才看得见 ——
     * 玩家在洞府/历练/背包里待着时,修为早够了、灵气也回满了,底栏一言不发。
     * 判据盯三件事:它读的是**同一个** breakthroughInfo()(不许底栏另算一套
     * 「大概够了吧」)、挂在修炼点上、并且是玉色圆点而不是背包那枚朱砂计数徽标
     * (它说的是「有事在等你」,不是一个数)。
     */
    expect(nav?.src, "底栏要读同一个 breakthroughInfo()").toContain("breakthroughInfo()");
    expect(nav?.src, "可破境圆点挂在修炼点").toContain(
      "tab.name === 'cultivation' && canBreakthrough",
    );
    expect(nav?.src, "可破境用玉色圆点(与背包的朱砂计数徽标区分)").toContain("bg-jade");
    // 两枚「新」徽章(装备卡 / 图鉴 chip)都有入场动画:新件到手、再开包那一瞬齐齐弹起,
    // 一眼扫到哪些是新入的。animate-new-pop 走独立 scale 属性、不碰 transform
    // (装备卡徽章靠 -translate-x-1/2 居中,凡动 transform 都会横跳)—— 帧与映射删了下面都红。
    const card = FILES.find((f) => f.path === "components/equipment/EquipmentCard.vue");
    expect(card?.src, "装备卡「新」徽章要有入场动画(animate-new-pop)").toContain("animate-new-pop");
    expect(codex?.src, "图鉴 chip 的「新」徽章要有入场动画(animate-new-pop)").toContain(
      "animate-new-pop",
    );
    const css = readFileSync(resolve(__dirname, "../style.css"), "utf-8");
    expect(css, "new-pop 的帧定义被删了 —— 徽章会退回瞬显").toMatch(
      /@keyframes new-pop[\s\S]{0,200}scale:\s*0\.5/,
    );
    const tw = readFileSync(resolve(__dirname, "../../tailwind.config.js"), "utf-8");
    expect(tw).toContain(`"new-pop": "new-pop`);
  });

  it("开炉幕「把握」的语义色是真类 —— 七成以上放心开炉不许落回继承色", () => {
    // 把握度是全开炉决策里最关键的风险读数:「≥70% 放心开炉」的绿与「<30% 在赌」的红
    // 若落进不存在的色类(text-jade-ink / text-crimson-ink),整条语义色就静默消失。
    // 死类名全仓唯一出处就在这里 —— 改回真类(jade / gold-ink / cinnabar),改半截就红。
    // 拆分后 rateClass 函数体在 composables/useBrewing.ts(.ts 不入 FILES,直读源码),
    // 死类名排查要盖住页面与新弹窗两份模板。
    const inv = FILES.find((f) => f.path === "views/InventoryView.vue");
    const dialog = FILES.find((f) => f.path === "components/inventory/BrewingDialog.vue");
    const brew = readFileSync(join(SRC, "composables/useBrewing.ts"), "utf-8");
    expect(inv?.src).not.toMatch(/text-(?:jade|crimson)-ink/);
    expect(dialog?.src).not.toMatch(/text-(?:jade|crimson)-ink/);
    expect(brew).toMatch(
      /rate >= 0\.7[\s\S]{0,40}?text-jade[\s\S]{0,60}?rate >= 0\.3[\s\S]{0,40}?text-gold-ink[\s\S]{0,40}?text-cinnabar/,
    );
  });

  it("界面不重造 modsText —— 词条文案的独一份事实源在 data/statNames", () => {
    // SoulsView 曾为「滤掉 0 值词条」自造一份本地 modsText,与库分叉成两套口径
    // (器魂低品键会带 0 → 库版印「+0%」、本地版不印)。单源 = 过滤收进库(见
    // statNames.spec),界面只 import。谁再在视图里起手 function modsText(,下面红。
    const souls = FILES.find((f) => f.path === "views/SoulsView.vue");
    expect(souls?.src).not.toMatch(/function modsText\(/);
    expect(souls?.src).toMatch(
      /import[\s\S]{0,300}?modsText[\s\S]{0,80}?from ['"]@\/data\/statNames/,
    );
  });

  it("在身之卦的倒计时走 formatCountdown 定宽 —— 秒表不许手拼「X 分 Y 秒」", () => {
    // 这是全库最后一个还手写"尚余 {m} 分 {sec} 秒"的倒计时:秒级心跳下位数不定
    // (5分3秒→5分30秒→9秒),行内每秒都跳。其余倒计时(状态胶囊/突破准备/闭关)
    // 早就统一进 formatCountdown + .countdown-slot 定宽槽,这里不许再退回去。
    const codex = FILES.find((f) => f.path === "views/RealmCodexView.vue");
    expect(codex?.src).toContain("formatCountdown(sec)");
    expect(codex?.src).toContain("countdown-slot");
    expect(codex?.src).not.toMatch(/尚余 \$\{m\} 分/);
  });

  it("逆旅契灰卡有理由 —— 已签报「此生已签」、道果不足报「尚差 N」", () => {
    // 契签不下只有两个理由:本世已签过(整组灰)/道果不足。别退回只有灰没有话:
    // 已签时应说「此生已签」,缺果子时按差数报「尚差 N 道果」(聚气丹/建筑同款)。
    // 拆分后轮回/逆旅契两浮层归 RebirthDialog,判据随本体改指子面板
    const charv = FILES.find((f) => f.path === "components/character/RebirthDialog.vue");
    expect(charv?.src).toContain("此生已签");
    expect(charv?.src).toMatch(/尚差 \$\{t\.cost - player\.reincarnation\.daoFruit\} 道果/);
    expect(charv?.src).not.toMatch(/t\.cost \} 道果/);
  });

  it("已习得功法按门分签,空门与开局都有话 —— 不留一块白板", () => {
    // 列表按主修/辅修/秘术分签。一门皆空时不能只剩滚动容器;
    // 一部都没有时仍把参悟递到手边,有别的门时只说这一门还空。
    // 拆分后功法区归 GongfaSection,判据随本体改指子面板
    const cult = FILES.find((f) => f.path === "components/cultivation/GongfaSection.vue");
    expect(cult?.src).toContain('role="tablist"');
    expect(cult?.src).toContain("尚无一部习得之法");
    expect(cult?.src).toContain("此门尚无习得");
    expect(cult?.src).toContain("在辅修席");
  });

  it("功法门类签不得退回实心印面 —— 选中是 6% 朱砂底上的墨字", () => {
    // 门类签刻意避开 kyunyin 那种「整块实心印面 + 奶油字」:同色底最多 6%,
    // 文字不叠透明度。选中=6% 朱砂淡底 + 墨字,未选中=淡墨不铺底。
    // 若有人把分类签改回 .btn-seal 实心印面,下面的守卫红 —— 不许悄悄退化。
    // 拆分后功法区归 GongfaSection,判据随本体改指子面板
    const cult = FILES.find((f) => f.path === "components/cultivation/GongfaSection.vue");
    // 选中签:6% 朱砂淡底 + 墨字(不是奶油字印面)
    expect(cult?.src).toContain("bg-cinnabar/6 text-ink");
    // 未选中:淡墨,不铺 6% 底
    expect(cult?.src).toContain("text-ink-faint");
    // 分类签上不能用 .btn-seal 那种奶油字实心印面(它在 role="tab" 附近出现即退化)
    expect(cult?.src).not.toMatch(/role="tab"[\s\S]{0,400}?btn-seal/);
  });

  it("灵草坊买十用十株的门槛 + 付不起摆短差 —— 灯灰必须说出差多少", () => {
    // 买10 曾拿单株价当门槛(够 1 株就亮),点了才弹「灵石不足」;付不起了也只
    // 沉到底不报差,与法宝炼化的「尚差」句式不一致。两者一起钉死:
    // 十株有其自己的 affordability 判定与短差,买10 不许再退回单株价放行。
    // 灵草坊弹窗拆出后判据随本体走(components/inventory/HerbShopDialog.vue)。
    const shop = FILES.find((f) => f.path === "components/inventory/HerbShopDialog.vue");
    expect(shop?.src).toContain("affordable10");
    expect(shop?.src).toContain(':disabled="!row.affordable10"');
    expect(shop?.src).toContain("formatGN(row.short)");
    expect(shop?.src).toContain("formatGN(row.short10)");
    expect(shop?.src).not.toMatch(/:disabled="!row\.affordable"[\s\S]{0,40}buyTen/);
  });

  it("炼丹/材料读数的灵草必须逐品列出 —— 不许退回单标量的合计", () => {
    // 灵草分五品(凡→道)后,方子按品阶耗(cost.herbGrade)、灵草坊各品各标价,
    // 可修行页那两处总读数仍报 Σ 五品的合计 —— 一眼看不出持有哪一品、够不够
    // 这一品的方子。改逐品列表(与灵草坊 held 同源,走 herbOf,不拼第二套分档)。
    // 开炉弹窗拆出后炼丹头在 BrewingDialog;灵草坊拆出后账在 composables/useHerbShop.ts
    // (.ts 不入 FILES,直读源码) —— 各读各的。
    const inv = FILES.find((f) => f.path === "views/InventoryView.vue");
    const brew = FILES.find((f) => f.path === "components/inventory/BrewingDialog.vue");
    const shop = readFileSync(join(SRC, "composables/useHerbShop.ts"), "utf-8");
    expect(brew?.src, "炼丹头必须逐品列出(不得再回资源的合计)").toMatch(
      /v-for="g in HERB_GRADES"[\s\S]{0,120}?herbGradeHeld\(g\)/,
    );
    expect(shop, "灵草坊同样逐品列出(不得再回资源的合计)").toMatch(
      /HERB_GRADES\.map[\s\S]{0,200}?herbOf\(g\)/,
    );
    expect(inv?.src, "材料详情同样逐品列出").toMatch(
      /currentMaterial\.key === RESOURCE_LABELS\.herb/,
    );
    // 开炉炼丹卡副题:不许再报合计「灵草 ${resources.herb}」,改报当前境界那一品的量
    expect(inv?.src, "炼丹卡副题报当前境之品,不报五品合计").not.toMatch(
      /灵草 \$\{resources\.herb\}/,
    );
  });

  it("部位候选行报「战 ±N」 —— 换装这件值不值,列表层就该看见,别等点开详情", () => {
    // 换装是最重复的决策:候选行此前只报品质/阶/词条数,跟身上那件差多少要逐个
    // 点开详情才对。行级差值必须vs 当前佩戴件(powerOf 线性差,与人物页战力同口径),
    // 佩戴中的底行自己不报差(它即基线)、空槽不报差(无对比对象)。
    // 弹窗拆出后判据随本体走(components/inventory/SlotCandidatesDialog.vue)。
    const picker = FILES.find((f) => f.path === "components/inventory/SlotCandidatesDialog.vue");
    expect(picker?.src).toContain("powerOf(row.item) - powerOf(occupant)");
    expect(picker?.src).toContain("战 +${formatGN(Math.round(delta))}");
    expect(picker?.src).toContain("row.delta !== null");
    expect(picker?.src).toContain("powerOf(occupant)");
  });

  it("秘境付不起置灰+报差 —— 别只沉到底、点了才 toast", () => {
    // 秘境入口曾用 opacity-60 假装灰(仍可点、点了才 toast 原因),不入「付不起置灰+列差」
    // 的族规。钉死:付不起真禁用,禁用态**压色不压字**(底色与边框让位,字一个不降),
    // 行内代价换口「尚差 N 石/道源」。
    // 「压色不压字」落地后置灰不再靠元素级透明度:那会把「尚差 N」这行字一起压到读不出。
    const sr = FILES.find((f) => f.path === "components/adventure/SecretRealmCard.vue");
    expect(sr?.src).toContain(':disabled="!canPay(r)"');
    expect(sr?.src, "禁用态压色不压字:改挂淡边框").toContain("'border border-ink/10': !canPay(r)");
    expect(sr?.src, "付不起不许再靠 opacity 假装灰").not.toMatch(/opacity-\d+['"]?: !canPay/);
    expect(sr?.src).toContain("payText(r)");
    expect(sr?.src).toMatch(/尚差 \$\{formatGN/);
  });

  it("百分比显示统走 formatPercent —— 不许再手写 Math.round(x*100)%", () => {
    // 全库曾散着 ~24 处手写 `Math.round(x*100)%` 的百分比显示(契合/胜率/携血/词条/
    // 熟练/道躯加成…),与 formatPercent 各写一份迟早分叉。统一后可见输出逐位等价
    // (parity 探针含负数/半值/极小值 0 差异),还白得 NaN/Infinity→'--' 与极小值归 0。
    // 允许存在的唯一一处 `Math.round(..*100)`:retreatPct 是数值型 compute(模板两处
    // 引用同一个数,不是显示点) —— 除此之外再有手写百分比显示,下面红。
    // 拆分后闭关卡归 RetreatCard,retreatPct 随本体走,判据路径同步改指。
    const offenders = FILES.filter(({ src }) => /Math\.round\([\s\S]{0,60}\* *100\)/.test(src)).map(
      (f) => f.path,
    );
    expect(offenders, `手写百分比残留:${offenders.join(",")}`).toEqual([
      "components/cultivation/RetreatCard.vue",
    ]);
    const retreatCard = FILES.find((f) => f.path === "components/cultivation/RetreatCard.vue");
    expect(retreatCard?.src).toMatch(/const retreatPct = Math\.round\(/);
  });

  it("战斗双方都动 —— 攻击方横踏、受击方震颤,不许退回「只挨打那半边有反应」", () => {
    // 出手与受击是同一因果环的两半:浮伤与震颤都挂在受击方,「谁在出手」此前完全静态。
    // 这半边(攻击方 strike)朝敌阵横踏一步(方向见 style.css 的 --strike-y),与受击方
    // 震颤成对 —— 删绑、把横踏挪到受击方、或卸掉帧定义,下面都红。
    const fight = FILES.find((f) => f.path === "components/adventure/CombatPanel.vue");
    expect(fight?.src, "攻击方要有横踏绑点(strikeCls),不许只有受击方震颤").toContain("strikeCls.e");
    expect(fight?.src).toContain("strikeCls.p");
    expect(fight?.src, "横踏必须挂在出手方(entry.side)上 —— 挪到受击方就重复震颤了").toMatch(
      /triggerStrike\(entry\.side\)/,
    );
    const css = readFileSync(resolve(__dirname, "../style.css"), "utf-8");
    expect(css, "strike 的帧定义被删了 —— 攻击方退回完全静态").toMatch(
      /@keyframes strike[\s\S]{0,160}translateY\(var\(--strike-y\)\)/,
    );
    expect(css).toMatch(/\.strike-e[\s\S]{0,40}--strike-y:\s*5px/);
    expect(css).toMatch(/\.strike-p[\s\S]{0,40}--strike-y:\s*-5px/);
  });

  it("换敌有入场 —— 新敌上台带一声轻起,不许退回硬切", () => {
    // 每场战罢敌角整个换人,却没有任何「换了」的信号;按 battle.at 键控重挂,
    // 让入场动画在换敌那一瞬重放(enemy-enter 轻版:淡入+上浮)。删键控或删帧,下面红。
    const fight = FILES.find((f) => f.path === "components/adventure/CombatPanel.vue");
    expect(fight?.src).toContain(':key="battle?.at"');
    expect(fight?.src).toContain("enemy-enter");
    const css = readFileSync(resolve(__dirname, "../style.css"), "utf-8");
    expect(css, "enemy-enter 的帧定义被删了 —— 换敌退回硬切").toMatch(
      /@keyframes enemy-enter[\s\S]{0,120}translateY\(5px\)/,
    );
    expect(css).toMatch(/\.enemy-enter[\s\S]{0,60}animation:\s*enemy-enter/);
  });

  it("首领战有仪式感 —— 此地之主登场有显形,不许退回「只多个小标记」", () => {
    // 首领战每 10 胜一轮,是历练的周期性高潮,却只比小怪多一圈红框。
    // 三件套钉死:图标挂朱砂呼吸光环(animate-glow-pulse)、名字转朱砂(boss 名
    // 不再与小怪同色)、登场宣告(boss-reveal 居中淡入定住再散,随 battle.at
    // 键控重挂每场重放) —— 拆掉其中任何一件,下面红。
    const fight = FILES.find((f) => f.path === "components/adventure/CombatPanel.vue");
    expect(fight?.src, "首领图标要有朱砂光环(animate-glow-pulse),与小怪图标分开").toMatch(
      /battle\?\.isBoss[\s\S]{0,120}animate-glow-pulse/,
    );
    expect(fight?.src, "首领名要转朱砂 —— 名字是这一场的主角").toMatch(
      /data-foe-name[\s\S]{0,120}battle\?\.isBoss \? 'text-cinnabar'/,
    );
    expect(fight?.src, "登场宣告(boss-reveal)被拆了").toMatch(
      /v-if="battle\?\.isBoss"[\s\S]{0,160}boss-reveal/,
    );
    const css = readFileSync(resolve(__dirname, "../style.css"), "utf-8");
    expect(css, "boss-reveal 的帧定义被删了 —— 首领登场退回硬切").toMatch(
      /@keyframes boss-reveal[\s\S]{0,140}opacity: 1/,
    );
    expect(css).toMatch(/\.boss-reveal[\s\S]{0,60}animation:\s*boss-reveal/);
  });

  it("每一界有自己的光 —— 世界氛围只换雾/山/越界光晕,不许掺进文字层", () => {
    // 「换了个世界」的体感在氛围层:角雾换色相、远山换染色、越界那瞬的光晕。
    // 三类全在低透明度层,永不触碰承载文字的层;谁把世界色写进字号/bg-paper,下面红。
    const appSrc = readFileSync(resolve(__dirname, "../App.vue"), "utf-8");
    expect(appSrc, "外壳要标定 data-world,主题才分得出这是哪一界").toContain(
      ':data-world="player.world.id"',
    );
    expect(appSrc, "越界宣告组件要挂在壳上").toContain("<WorldTransitionVeil");
    const home = FILES.find((f) => f.path === "views/HomeView.vue");
    expect(home?.src, "远山要读世界的山色变量(--world-mountain)").toContain(
      "var(--world-mountain)",
    );
    const css = readFileSync(resolve(__dirname, "../style.css"), "utf-8");
    // 三界都要有雾色覆盖 —— 缺了后两界就是「只做了仙界」的半成品
    expect(css).toMatch(/data-world="immortal"\][\s\S]{0,60}\.mist/);
    expect(css).toMatch(/data-world="god"\][\s\S]{0,60}\.mist/);
    expect(css).toMatch(/data-world="chaos"\][\s\S]{0,60}\.mist/);
    expect(css, "越界光晕要读世界色(veil-glow)").toMatch(/--world-glow-rgb/);
    const rite = readFileSync(
      resolve(__dirname, "../components/common/WorldTransitionVeil.vue"),
      "utf-8",
    );
    expect(rite, "越界判据只许走 announceWorldEntry 纯函数").toContain("announceWorldEntry");
    expect(rite, "宣告遮罩不许拦操作(pointer-events-none)").toContain("pointer-events-none");
    // 章节标题杆是全页高频的装饰 cue:每界各一色,别退回「只剩人间朱砂」
    const section = readFileSync(
      resolve(__dirname, "../components/common/SectionTitle.vue"),
      "utf-8",
    );
    expect(section, "标题杆要读世界色(--world-bar),不许写死朱砂").toContain("var(--world-bar)");
    expect(css).toMatch(/data-world="immortal"\][\s\S]{0,80}--world-bar/);
    expect(css).toMatch(/data-world="god"\][\s\S]{0,80}--world-bar/);
    expect(css).toMatch(/data-world="chaos"\][\s\S]{0,80}--world-bar/);
    // 世界身份落地到最常看的两处:修炼页「此刻的界」+ 界域志的「色卡地图」
    const cult = FILES.find((f) => f.path === "views/CultivationView.vue");
    expect(cult?.src, "修炼页世界名要读世界信标色(world-label)").toContain("world-label");
    const codex = FILES.find((f) => f.path === "views/RealmCodexView.vue");
    expect(codex?.src, "界域志每一个世界段要带自己的 data-world(色卡靠它分界)").toContain(
      ':data-world="row.world.id"',
    );
    expect(codex?.src, "界域志世界名要挂 world-seal(每界自己的色)").toContain("world-seal");
    expect(codex?.src, "「此刻在此」的格子要随所处世界亮起(codex-current)").toContain(
      "codex-current",
    );
    expect(css, "world-label 要跟 --world-accent 走,不另写一套").toMatch(
      /\.world-label[\s\S]{0,40}var\(--world-accent\)/,
    );
    expect(css).toMatch(/\.codex-current[\s\S]{0,80}var\(--color-qing\)/);
  });

  it("今日日课全毕有关闭感 —— 「今天做完了」不许再哑掉", () => {
    // 三条日课都结清后只有各自一个「已成」,没有「今天没漏事」的一句话 ——
    // 放置玩家的"可以放手挂机"该有一声。判据与发赏同源(每行 done),不许另起一套。
    const home = FILES.find((f) => f.path === "views/HomeView.vue");
    expect(home?.src).toContain("dailyAllDone");
    expect(home?.src).toContain("今日已毕");
    expect(home?.src, "判据必须读日课行的 done(= 已结算),不自己数进度").toMatch(
      /every\(\(r\) => r\.done\)/,
    );
  });

  it("图鉴一目尽收有完成感 —— 集齐的那一册要自己说话", () => {
    // 分目进度只有「12/20」的淡暗计数,集齐也没有任何表示 —— 收集的圆满
    // 是该册自己说的话。判据 = 全体条目 stage>=1(空目不算),全收后「去哪儿找」
    // 让位给石绿「尽收」行。
    const col = FILES.find((f) => f.path === "views/CollectionView.vue");
    expect(col?.src).toContain("catComplete");
    expect(col?.src).toContain("尽收");
    expect(col?.src, "判据必须读 entry.stage(收录/认知),不另起一套").toMatch(
      /every\(\(e\) => e\.stage >= 1\)/,
    );
  });

  it("名号尽收有完成感 —— 三十顶全齐的圆满,不许只沉在计数里", () => {
    // 名号页此前只显「14/30 · 佩一枚」的计数,三十顶全齐也没有任何表示 ——
    // 收集的终点(境界阶梯 + 成就赏走完)该有一声,与图鉴「尽收」同族。
    // 判据必须读同一个 ownedCount(与标题计数同源),不许另起一套数法。
    const tit = FILES.find((f) => f.path === "views/TitlesView.vue");
    expect(tit?.src).toContain("titlesAllOwned");
    expect(tit?.src, "名号尽收要与计数同源,不许另算一遍").toMatch(
      /titlesAllOwned = computed\([\s\S]{0,80}ownedCount\.value === TITLES\.length/,
    );
    expect(tit?.src, "全收后的那句「尽收」要直说(名号尽收),不许只有计数").toContain("名号尽收");
  });

  it("洞府营造尽善有完成感 —— 七座俱至顶的圆满,不许只沉在各自卡面", () => {
    // 各卡到了顶只会各自说「已至顶档」,整座洞府全满却没有一句话 —— 家业
    // 经营到头的圆满该有一声(与图鉴尽收/名号尽收同族)。判据读 store 的
    // allBuildingsMaxed(与卡面 N/M 的 capOfBuilding 同源),不许视图另数一遍。
    const dv = FILES.find((f) => f.path === "views/DongfuView.vue");
    expect(dv?.src, "视图必须读 store 的全满 boolean,不许自己数一遍").toContain(
      "dongfu.allBuildingsMaxed",
    );
    expect(dv?.src, "那句「营造尽善」要直说,不许退回只有各自卡面").toContain("营造尽善");
    const dongfuStore = readFileSync(resolve(__dirname, "../stores/dongfu.ts"), "utf8");
    expect(dongfuStore, "store 端映射必须走引擎的判据,不许另起一套").toMatch(
      /allBuildingsMaxed = computed\([\s\S]{0,40}allDongfuMaxed\(levels\.value\)\)/,
    );
    const engine = readFileSync(resolve(__dirname, "../core/engineFacilities.ts"), "utf8");
    expect(engine, "判据必须逐座比 capOfBuilding 的同一个 cap(BUILDINGS 全表)").toMatch(
      /BUILDINGS\.every\(\(b\) => \(levels\[b\.id\] \?\? 0\) >= capOfBuilding\(b\.id, levels\)\)/,
    );
  });

  it("洞府页自报已营几座 —— 座数只许 store 数一遍,两页同读", () => {
    // 已营座数此前只在首页入口右侧现算,洞府页自己反倒没有(「家业总览」的主角位
    // 缺一角)。收进 store 的 builtCount,洞府营造题头与首页入口同读 —— 退回任何
    // 一处自己 filter 一遍,下面红。
    const dv = FILES.find((f) => f.path === "views/DongfuView.vue");
    expect(dv?.src, "营造题头要挂上已营座数").toContain("dongfu.builtCount");
    const home = FILES.find((f) => f.path === "views/HomeView.vue");
    expect(home?.src, "首页入口也读 store,不许自己数一遍").toMatch(
      /已营 \{\{ dongfu\.builtCount \}\}/,
    );
    const dongfuStore = readFileSync(resolve(__dirname, "../stores/dongfu.ts"), "utf8");
    expect(dongfuStore, "store 端有唯一一份 builtCount").toMatch(
      /builtCount = computed\(\s*\(\) => BUILDINGS\.filter\(\(b\) => \(levels\.value\[b\.id\] \?\? 0\) > 0\)\.length,/,
    );
  });

  it("首页状态行不许退回最弱档 —— 主角位「此刻状态」不该比次要天时还哑", () => {
    // 主页 hero 的「现在在干嘛」(修炼/闭关/历练…)此前整行 text-ink-faint,紧邻
    // 下方的次要天时反而 font-kai 披金 —— 层级倒挂。提一档 ink-soft 并配楷体,
    // 寿元告急那一路仍走朱砂;退回 faint 或拆掉 kai,下面红。
    const home = FILES.find((f) => f.path === "views/HomeView.vue");
    expect(home?.src, "状态行要配楷体与对位主角比肩").toMatch(/class="font-kai text-\[11px\]"/);
    expect(home?.src, "非告急那一路不许退回最弱档(ink-faint)").toMatch(
      /text-cinnabar' : 'text-ink-soft'/,
    );
  });

  it("修炼页主值行不许退回最弱档 —— 修为/灵气是这页最常盯的数", () => {
    // 修为与灵气的当前值此前与「+x/秒 ▸来路」同档 faint,数值本身反而被弱化;
    // 主值行整个提到 ink-soft(不动字号,200% 折行判据不受影响)。少一行就说明
    // 有人把某个主值行悄悄降回 faint。
    // 拆分轮盲区收口:第三行(耗灵气)随破境卡本体迁入 BreakthroughCard ——
    // 只查宿主 = 假绿(同资源叫法条全域化先例),查宿主 + 破境卡两处之和。
    const domain = ["views/CultivationView.vue", "components/cultivation/BreakthroughCard.vue"]
      .map((p) => FILES.find((f) => f.path === p)?.src ?? "")
      .join("\n");
    const rows = domain.match(/data-value-row[\s\S]{0,90}text-ink-soft/g) ?? [];
    expect(rows.length, "修为/灵气/耗灵气主值行都要在 ink-soft 或更上").toBeGreaterThanOrEqual(3);
  });

  it("全面墨感 · 触感与主位 —— 按压滑移、匾额框墨、首屏主钮辉光、法球落地影", () => {
    // 全面美化批:btn-seal/ghost/chip 早已 0.12s 滑移,唯 card-ink 交互卡硬跳;
    // 境界名加世界色横杆(匾额)、欢迎页主钮起朱砂柔辉、首页法球加远山同色落地影。
    // 四件各退一件,下面红 —— 不许拆回「卡一按就跳、主角字光秃秃」。
    const style = readFileSync(resolve(__dirname, "../style.css"), "utf8");
    expect(style, "card-ink 要带按压滑移").toMatch(
      /\.card-ink \{[\s\S]{0,400}transition: transform 0\.12s ease;/,
    );
    const cult = FILES.find((f) => f.path === "views/CultivationView.vue");
    expect(cult?.src, "境界名要用世界色横杆框墨").toMatch(/bg-\[var\(--world-bar\)\]/m);
    const wel = FILES.find((f) => f.path === "views/WelcomeView.vue");
    expect(wel?.src, "首屏主钮要有柔辉").toMatch(/btn-seal animate-glow-pulse/);
    const home = FILES.find((f) => f.path === "views/HomeView.vue");
    expect(home?.src, "法球要有同世界色的落地影").toMatch(/bg-\[var\(--world-mountain\)\]/);
  });

  it("全库弹窗标题统一笔杆 —— 页面每节有世界色 brush-bar,弹窗标题不许孤悬", () => {
    // 页面章节头(SectionTitle)都有一根世界色笔杆当家;BaseModal 是全库复用的浮层
    // 原语,标题此前是悬空一行楷体。弹窗标题必须带同一根杆 —— 一处改动罩住全库
    // 每个弹窗;拆掉杆(或挪到别处),下面红。
    const modal = FILES.find((f) => f.path === "components/common/BaseModal.vue");
    expect(modal?.src, "弹窗标题要挂世界色 brush-bar").toMatch(
      /<span[\s\S]{0,40}v-if="props\.title"[\s\S]{0,80}class="brush-bar h-3 w-0\.75 rounded bg-\[var\(--world-bar\)\]"/,
    );
  });

  it("主题化的末里 —— 文字选中与点按高亮不许留浏览器默认", () => {
    // 全站纸墨成画,唯独两处还露着浏览器默认:长文里选中文字闪系统蓝、
    // 点按先弹灰盒再播按压反馈。选中改半透明朱砂(rgb 随主题转亮,两套主题
    // 都不打架),点按高亮压 transparent(全站交互元素自带 active 按压,
    // 系统那一下反而冲出画外)。退回去,下面红。
    const style = readFileSync(resolve(__dirname, "../style.css"), "utf8");
    expect(style, "选中文字要朱砂浸染").toMatch(
      /::selection \{\n  background: rgb\(var\(--color-cinnabar-rgb\) \/ 0\.22\);/,
    );
    expect(style, "点按高亮不许弹系统灰盒").toMatch(/-webkit-tap-highlight-color: transparent;/);
  });

  it("闭关开始有这一闪 —— 闭关是这张卡自己的事,不许只换文字", () => {
    // 闭关开始只有 toast + 倒计时补上,卡片本身毫无反应(对照 BuildingCard 升级
    // 有 card-flash)。「这件事发生在我这张卡上」的 idiom 对闭关同样成立 ——
    // 拆掉 card-flash、或把触发改成别的时机,下面红。
    // 拆分后闭关卡归 RetreatCard,判据随本体改指子面板
    const retreatCard = FILES.find((f) => f.path === "components/cultivation/RetreatCard.vue");
    expect(retreatCard?.src, "闭关卡要挂 card-flash").toMatch(/retreatFlash \? 'card-flash'/);
    expect(retreatCard?.src, "闪的触发是 retreating 由假转真那一瞬(5 分钟到时不再闪)").toMatch(
      /nv && !ov\) retreatFlash\.value = true/,
    );
  });

  it("境遇结算收益行要逐行晕开 —— 与离线卷轴同款节奏,不许瞬时同现", () => {
    // 结果句已经 animate-ink-pop,紧随的收益列表却裸 `space-y-1.5` 瞬时同现;
    // 同一语义(收益清点)离线卷轴有 stagger-in,这里没有就是不一致。拆掉,红。
    const ev = FILES.find((f) => f.path === "components/adventure/EventDialog.vue");
    expect(ev?.src, "收益列表必须走 stagger-in").toMatch(
      /ul v-if="result\.lines\.length" class="stagger-in /,
    );
  });

  it("器魂顶栏标题锁居中 —— 不许随道源位数左右游移", () => {
    // 左侧「← 天界」固定、右侧道源数字随位数伸缩,justify-between 下标题永远
    // 不居中且游移;用 1fr_auto_1fr 网格让两侧均分、标题落点锁死。
    const souls = FILES.find((f) => f.path === "views/SoulsView.vue");
    expect(souls?.src, "顶栏必须用两侧均分网格").toContain("grid-cols-[1fr_auto_1fr]");
    expect(souls?.src, "右侧信息块贴右,标题守着正中").toContain("justify-self-end");
  });

  it("弟子顶栏标题锁居中 —— 右侧收徒按钮几档换长,不许随其左右游移", () => {
    // 收徒按钮文案在「收徒 · 尚差 X 石 / 收徒 NNN 石 / 已收满 N/M」之间换长,
    // justify-between 下居中的「门庭有徒」会随右缘宽窄游移 —— 与器魂同款问题,
    // 用同一张两侧均分网格把标题落点锁死。
    const appr = FILES.find((f) => f.path === "views/ApprenticeView.vue");
    expect(appr?.src, "顶栏必须用两侧均分网格").toContain("grid-cols-[1fr_auto_1fr]");
    expect(appr?.src, "右侧收徒按钮贴右").toContain("justify-self-end");
  });

  it("毁器/交器代价的数字不许被弹列换行裁掉 —— 决策信息只在宽屏看得出就不算完整", () => {
    // 两处「按下前必须看清数字」的文案曾被 truncate(nowrap+ellipsis):
    //  · 器魂凝炼台的「已淬养」警示 —— 320 宽下标题列只剩 167px,而整句要 310px,
    //    尘/灵石两枚投入数被省略号藏在截断线之后,玩家按「凝炼」前看不到代价;
    //  · 坊市悬赏的「贡一柄 ≥N 阶兵刃」—— N(要交几阶)被裁掉,无从挑件。
    // truncate 不产生溢出,排版自检量不到;它们只在本 spec 里被钉住:这两行一律不许 nowrap。
    const souls = FILES.find((f) => f.path === "views/SoulsView.vue");
    const sClass = souls?.src.match(
      /<p[\s\S]{0,200}?v-if="row\.invested && row\.investedCost"[\s\S]{0,120}?class="([^"]*)"/,
    )?.[1];
    expect(sClass, "已淬养警示须可换行(投入尘/灵石不许被省略号裁)").toMatch(/\bleading-relaxed\b/);
    if (sClass) expect(sClass, "已淬养警示不许 nowrap 裁掉投入数").not.toMatch(/\btruncate\b/);
    const market = FILES.find((f) => f.path === "views/MarketView.vue");
    const mClass = market?.src.match(
      /<p[\s\S]{0,120}?class="([^"]*)"[\s\S]{0,80}?贡一柄 ≥\{\{ o\.tier \}\}/,
    )?.[1];
    expect(mClass, "贡器门槛行须可换行(≥N 阶不许被省略号裁)").toMatch(/\bleading-relaxed\b/);
    if (mClass) expect(mClass, "贡器门槛行不许 nowrap 裁掉门槛数").not.toMatch(/\btruncate\b/);
  });

  it("洞府离线存续当前档要实底点亮 —— 不许退回淡染的哑当前态", () => {
    // 离线上限阶梯「现在第几档」曾只有 6% 底 + 50% 边框,是全库最哑的当前态
    // 指示器(对照 InkTabs 实心墨块 / 行程点实底呼吸)。当前档改实底 paper 字。
    const dv = FILES.find((f) => f.path === "views/DongfuView.vue");
    expect(dv?.src, "当前档必须实底 + paper 字 + 楷体").toMatch(/bg-cinnabar text-paper font-kai/);
  });

  it("图鉴详情要有视觉锚 —— 带 icon 的收录物,详情不许丢章", () => {
    // 灵兽册这类带 icon 的条目,收集 chip 上有枚小章,点开详情却整块丢成纯文字;
    // 详情的头部就该亮出这一枚(与丹房/材料详情同构,有 icon 才渲染)。
    const col = FILES.find((f) => f.path === "views/CollectionView.vue");
    expect(col?.src, "详情那扇要亮出 icon 色章(有才渲染)").toMatch(
      /v-if="detail\.entry\.icon"[\s\S]{0,80}grid h-12 w-12/,
    );
  });

  it("战斗进出有过渡 —— 进战与收兵不许硬切", () => {
    // 历练页在「战斗面板 / 区域列表」之间切换,是这页最大的一次同页置换,从前
    // 整屏闪变;两分支要包进同一扇 page-fade 过渡,列表分支还得有单一根(div)——
    // Transition 不给 fragment 上动画。
    const adv = FILES.find((f) => f.path === "views/AdventureView.vue");
    expect(adv?.src, "两分支要包进同一扇 page-fade 过渡").toContain(
      '<Transition name="page-fade" mode="out-in">',
    );
    expect(adv?.src, "主战面板那一支把 v-if 收在组件上").toContain(
      'CombatPanel v-if="adventure.sessionActive"',
    );
    expect(adv?.src, "区域列表那一支必须有单一根 div(single root 才吃得到过渡)").toContain(
      'v-else class="space-y-4"',
    );
  });

  it("镇压进度统一说「胜场」 —— totalFights 只装胜场,界面不许把它写成「战」", () => {
    // updateRegionStats 就位于在线 result.win 分支内(一败即中止这趟历练,败场
    // 根本走不到区域账),离线也只记胜场 —— 这个数从来就是「胜场」。字段名沿用
    // 旧名(改名要迁存档),但用户面文案一律「胜」:退回「7/20 战」读着像胜败
    // 都算,曾经正是这歧义诱导过一次把离线败场塞进区域账的坏修复。
    const adv = FILES.find((f) => f.path === "views/AdventureView.vue");
    expect(adv?.src, "地界行要写「N/N 胜」").toContain(
      "{{ row.progress.wins }}/{{ row.progress.needWins }} 胜",
    );
    expect(adv?.src, "总纲要写「胜 N 场」").toContain(
      "镇压门槛:胜 {{ SUPPRESS_THRESHOLDS.minWins }} 场",
    );
    expect(adv?.src, "旧写法「N/N 战」不许回来").not.toContain("row.progress.fights");
    const sup = readFileSync(resolve(__dirname, "../core/suppress.ts"), "utf-8");
    expect(sup, "阈值要叫 minWins").toContain("minWins");
    expect(sup, "旧名 minFights 不许回来").not.toContain("minFights");
    expect(sup, "字段为何沿用旧名要写清(totalFights 只装胜场)").toContain("只装胜场");
  });

  it("战斗分析的方向要能在手机上看理由 —— 不许只藏 hover title", () => {
    // 「可借力的方向」只会出现在败局分析里,「为什么看好这个方向」此前只挂在
    // 非交互 span 的 :title 上,触屏上点了没反应 = 死提示。方向名改可点、理由
    // 内联展开(与适配理由/天赋芯片同族);退回 span + title,下面红。
    // 分析面板自 CombatPanel 拆出(拆分第六刀),钉随本体改指 BattleIntelPanel
    const cp = FILES.find((f) => f.path === "components/adventure/BattleIntelPanel.vue");
    expect(cp?.src, "方向名要是带展开语义的可点按钮").toContain(
      ':aria-expanded="directionTap === d.styleName"',
    );
    expect(cp?.src, "理由要在展开里直出,不许只挂 :title").toMatch(
      /v-if="directionTap === d\.styleName"[\s\S]{0,80}\{\{ d\.reason \}\}/,
    );
  });

  it("适配星级的理由也点得开 —— 同方向族,不许退回 hover 死提示", () => {
    // 敌名行那颗「★★★」的适配星级同样把原因只挂 :title —— 手机无 hover 就是死提示。
    // 星级改可点、原因在名字行下直出;退回 span + title,下面红。
    const cp = FILES.find((f) => f.path === "components/adventure/CombatPanel.vue");
    expect(cp?.src, "星级要带上展开语义").toContain(
      ':aria-expanded="adaptTap === foeAdaptation.stars"',
    );
    expect(cp?.src, "理由要在名字行下直出,不许只挂 :title").toMatch(
      /foeAdaptation\.value\.reasons\.join/,
    );
  });

  it("展开/收纳的控制要把状态报给读屏 —— 已登记的这几处 disclosure 都要 aria-expanded", () => {
    // 折叠/展开的按钮若只换文本箭头、不把展开态报给读屏,屏幕阅读器分不清
    // 现在到底收没收。方向名/星级(上面两条)早已钉;修为来路、卦/宿全览、
    // 战斗所知/分析、转世交割清单,一并在这一条钉死,不许再退回。
    //
    // 这是**手抄清单**,不是「全库自动找 disclosure」—— 它只保证下面登记的这几处
    // 没退回去。新加可展开控件要自己登进来,否则这条守卫看都没看过它一眼。
    const checks: [string, string][] = [
      ["views/CultivationView.vue", ':aria-expanded="showCultBreakdown"'],
      ["views/RealmCodexView.vue", ':aria-expanded="showAllHex"'],
      ["views/RealmCodexView.vue", ':aria-expanded="showAllMansions"'],
      // 战斗情报面板(战后统计/所知/分析)自 CombatPanel 拆出,登记随本体走
      ["components/adventure/BattleIntelPanel.vue", ':aria-expanded="showLore"'],
      ["components/adventure/BattleIntelPanel.vue", ':aria-expanded="showAnalysis"'],
      // 转世交割清单里点开的那一条(heritageTap)—— 只换措辞不报状态,读屏分不清
      ["components/character/ReincarnationDialog.vue", ':aria-expanded="heritageTap === r.id"'],
      // 门庭派活的两步钮:第一下展开任务说明、再点同枚才派出 —— 新登的 disclosure
      ["views/ApprenticeView.vue", ":aria-expanded=\"taskTap === a.uid + ':' + t.spec\""],
    ];
    for (const [path, needle] of checks) {
      const f = FILES.find((x) => x.path === path);
      expect(f?.src, `${path} 的展开控制要带上 aria-expanded,不许退回裸 button`).toContain(needle);
    }
  });

  it("减少动效要拦历练回放 —— 与天界战报同一待遇,JS 逐条播也要让路", () => {
    // 主历练 CombatPanel 的回放是 setInterval 逐行投入(JS 驱动),style.css 的
    // .reduce-motion 只压 CSS 动画,盖不住它 —— 关动效的人每次历练开打仍被迫
    // 逐条看。天界 GauntletPanel 早已判 settings.reduceMotion 直给结果,历练
    // 这份漏了。不许退回「只压 CSS、JS 回放照播」的两套待遇。
    const cp = FILES.find((f) => f.path === "components/adventure/CombatPanel.vue");
    expect(cp?.src, "历练回放要判 reduceMotion").toContain("settings.reduceMotion");
    expect(cp?.src, "关动效时要直给结果(进 instant 即全量呈现)").toMatch(
      /settings\.reduceMotion && !instant/,
    );
  });

  it("页签条是整套 tab 模式 —— role=tablist + roving tabindex + 方向键漫游", () => {
    // InkTabs 供 5 个页共用,此前只贴了 role=tab / aria-selected,缺外壳 tablist、
    // 每次只留一个在 Tab 序、以及方向键漫游 —— 半套 tab 模式对读屏是残缺的。
    const tabs = FILES.find((f) => f.path === "components/common/InkTabs.vue");
    expect(tabs?.src, "外壳要有 role=tablist,不许裸 div 装着 tab").toContain('role="tablist"');
    expect(tabs?.src, "每次只留一个页签在 Tab 序(roving tabindex)").toContain(
      ':tabindex="model === t.id ? 0 : -1"',
    );
    expect(tabs?.src, "方向键要在页签间漫游").toContain("ArrowRight");
    expect(tabs?.src, "焦点要跟着选中一起走").toContain("target.focus()");
  });

  it("修行功法页签补全套 tab→panel 关联 —— 每个 tab 要 aria-controls 指向对应 panel", () => {
    // 主修/辅修/秘术三签是 功法页 里自成一壳的 tablist+tabpanel(GongfaSection 内联
    // 实现,不像 InkTabs 那样壳与面板分离)。此前只有 role=tab/aria-selected,读屏无法把
    // 一个 tab 与它控制的 panel 对应起来 —— 补上 id/aria-controls(tab 侧)与
    // id/aria-labelledby(panel 侧),正是 WAI-ARIA 的 tab 模式。
    // 拆分后功法区归 GongfaSection,判据随本体改指子面板
    const cult = FILES.find((f) => f.path === "components/cultivation/GongfaSection.vue");
    expect(cult?.src, "功法 tab 要带自己的 id 与 aria-controls").toContain(
      ':aria-controls="`gongfa-cat-panel-${g.type}`"',
    );
    expect(cult?.src, "功法 tab 要有稳定 id 供 panel 反指").toContain(
      ':id="`gongfa-cat-tab-${g.type}`"',
    );
    expect(cult?.src, "功法 panel 要带对应 id 与 aria-labelledby 反指当前 tab").toContain(
      ':aria-labelledby="`gongfa-cat-tab-${gongfaCat}`"',
    );
  });

  it("可点选的装备词条格要报选中态 —— aria-pressed,不许只靠描边变色", () => {
    // 自动重铸的「洗到这些词条出现就停」多选格:选中态此前只靠朱砂描边+字色,
    // 读屏根本听不出哪几个被选中,等于无法操作自动重铸。与 InventoryView 的
    // smartKeep(minQuality 用 aria-pressed 同款)应同一条口径。
    const eq = FILES.find((f) => f.path === "components/equipment/EquipReforgePanel.vue");
    expect(eq?.src, "词条格选中态要报给读屏").toContain(':aria-pressed="isAutoTarget(af.id)"');
  });

  it("装备详情的两处折叠要报展开态 —— autoOpen/transferOpen 挂 aria-expanded", () => {
    // 「自动重铸 / 词条转移」是点开才出现的折叠面板,此前只靠文案「收起/⋯」暗示,
    // 读屏不知道展开没展开。与 CombatPanel 的 showLore/showAnalysis 的
    // aria-expanded 同一条口径(揭开的 disclosure 一定要把状态报出来)。
    const eq = FILES.find((f) => f.path === "components/equipment/EquipReforgePanel.vue");
    expect(eq?.src, "自动重铸折叠要报展开态").toContain(':aria-expanded="autoOpen"');
    expect(eq?.src, "词条转移折叠要报展开态").toContain(':aria-expanded="transferOpen"');
  });

  it("构筑五维评级的气泡点开要报展开态 —— dimKey 挂 aria-expanded + 面板给 id", () => {
    // 五维评级的每一维可点开看词条明细,点开状态此前只靠下钻块是否可见传意,
    // 读屏不知道哪一维开着。补 aria-expanded(报当前维开/合)与 aria-controls
    // → id(把按钮和它控制的明细块拴起来)。
    const build = FILES.find((f) => f.path === "views/BuildView.vue");
    expect(build?.src, "评级维展开态报给读屏").toContain(':aria-expanded="dimKey === l.key"');
    expect(build?.src, "评级维的明细块要带配对 id").toContain(':id="`build-dim-panel-${l.key}`"');
  });

  it("大境突破有分级 —— 一境一次是天劫,不许和每层小推进同一张脸", () => {
    // 突破幕此前小境/大境共用同一枚朱砂「破」印 —— 天劫既渡的里程碑式突破
    // (筑基→金丹等一境一次)和普通层推进毫无区分。金色「大境」章(gold=里程碑赏)
    // 钉在印下,小破不显示;拆了 v-if、或改成与小破同色,下面红。
    const dlg = FILES.find((f) => f.path === "components/cultivation/BreakthroughResultDialog.vue");
    expect(dlg?.src, "大境成功要有金章区分,不许只靠朱砂破印").toContain(
      `view.success && view.isMajor`,
    );
    expect(dlg?.src, "大境章要是金色(gold-ink),与朱砂破印同列而更高").toContain("text-gold-ink");
    expect(dlg?.src, "大境章要直说「大境」").toContain("大 境");
  });

  it("闪避有侧让 —— 躲开 ≠ 被打中,不许让闪避也走震颤", () => {
    // 战斗里闪避此前只落在日志的一行淡字:攻击方横踏照走,受击方纹丝不动,
    // 「这一击被躲过了」没有画面。而若随手让闪避也走 hit-shake,就成了
    // 「打中了但没伤害」的假反馈。故盯死:闪避(dodge)必须触发受击方 flicker
    // 侧让、且不得走震颤那半边(triggerShake)。
    const fight = FILES.find((f) => f.path === "components/adventure/CombatPanel.vue");
    expect(fight?.src, "闪避要有侧让绑点(flickerCls)").toContain("flickerCls.e");
    expect(fight?.src).toContain("flickerCls.p");
    expect(fight?.src, "dodge 行必须触发侧让").toMatch(
      /entry\.t === "dodge"[\s\S]{0,120}triggerFlicker/,
    );
    expect(fight?.src, "闪避不得走震颤(躲开≠被打中)").not.toMatch(
      /entry\.t === "dodge"[\s\S]{0,80}triggerShake/,
    );
    expect(fight?.src, "闪避时攻击方仍该横踏(出手确实出手了)").toMatch(
      /entry\.t === "dodge"[\s\S]{0,80}triggerStrike/,
    );
    const css = readFileSync(resolve(__dirname, "../style.css"), "utf-8");
    expect(css, "flicker 的帧定义被删了 —— 闪避退回一动不动的淡字").toMatch(/@keyframes flicker/);
  });

  it("护盾成形有屏壁 —— 筑盾是个动作,不许只沉在日志一行", () => {
    // 战斗四向反馈已齐(攻击横踏/受击震颤/闪避侧让/胜方定音),唯独**护盾开启**
    // 只落在日志一行淡字 —— 防御姿态的呈现本该是一道金色屏壁。判定:
    // shield 行必须触发 triggerShield(护盾方亮 shield-rise),且不得误走横踏
    // (shield 无出手方)或震颤(那是对「打中了」的反馈)。
    const fight = FILES.find((f) => f.path === "components/adventure/CombatPanel.vue");
    expect(fight?.src, "护盾成形要有绑点(shieldCls)").toContain("shieldCls.e");
    expect(fight?.src).toContain("shieldCls.p");
    expect(fight?.src, "shield 行必须触发护盾成形").toMatch(
      /entry\.t === "shield"[\s\S]{0,120}triggerShield/,
    );
    expect(fight?.src, "护盾无出手方,不得跟着横踏").not.toMatch(
      /entry\.t === "shield"[\s\S]{0,80}triggerStrike/,
    );
    const css = readFileSync(resolve(__dirname, "../style.css"), "utf-8");
    expect(css, "shield-rise 的帧定义被删了 —— 护盾退回一行淡字").toMatch(/@keyframes shield-rise/);
  });

  it("胜方有定音 —— 败方散墨,赢家也得有这一声", () => {
    // 战斗因果环:受击震颤/出手横踏/败亡散墨(灰化)都有了,唯独胜方没有任何
    // 「这一场我赢了」的视觉句点。光圈绕头像荡一圈收拢(victory-seal,
    // 石绿=胜/完成,与败方灰化成对) —— 只挂在敌败(defeated==='e')那侧,
    // 自己输了不庆祝对手。拆了绑、挪了侧、或删了帧,下面红。
    const fight = FILES.find((f) => f.path === "components/adventure/CombatPanel.vue");
    expect(fight?.src, "胜方要有定音(foe-victorious),不许只让败方灰化").toContain(
      `defeated === 'e' ? 'foe-victorious'`,
    );
    const css = readFileSync(resolve(__dirname, "../style.css"), "utf-8");
    expect(css, "victory-seal 的帧定义被删了 —— 胜方退回无声").toMatch(/@keyframes victory-seal/);
    expect(css).toMatch(/\.foe-victorious[\s\S]{0,60}animation:\s*victory-seal/);
  });

  it("炼器技艺露在铁砧前 —— 在哪儿长,就在哪儿看得见", () => {
    // 锻打/铭纹的经验正是在装备强化/重铸界面长的,此前却只在炼丹弹窗的全局
    // 技艺表里看得到 —— 炼器的地方看不见自己在长,等于没长。钉死:装备详情
    // 弹窗必须有锻打/铭纹两项的技艺进度,判据与技艺表同源(skillStageName/
    // skillStageProgress),不许退回「去丹房翻」。
    const dlg = FILES.find((f) => f.path === "components/equipment/EquipmentDetailDialog.vue");
    expect(dlg?.src, "装备详情要有炼器技艺进度(forgeSkills)").toContain("forgeSkills");
    expect(dlg?.src, "必须含锻打与铭纹两项(set of smithing/inscribe)").toContain(
      '"smithing", "inscribe"',
    );
    expect(dlg?.src, "判据必须与技艺表同源(skillStageProgress),不另起一套").toContain(
      "skillStageProgress",
    );
    expect(dlg?.src, "技艺要有进度条可读").toContain("<ProgressBar");
  });

  it("功法进修付不起置灰+列差 —— 缺哪样、差多少,按钮上直说", () => {
    // 「进修」曾永不置灰,资源不足只弹一句笼统 toast「悟道点或残页不足」,
    // 不报缺哪样也不说差多少 —— 与全仓“付不起置灰+列差”族规脱节。修法与
    // 聚气丹/建筑/法宝同款:按钮 disabled + 行内「尚差 N 悟道 · M 残页」。
    const gongfa = FILES.find((f) => f.path === "components/cultivation/GongfaDialog.vue");
    expect(gongfa?.src, "进修按钮必须有 disabled(upAffordable)").toContain(
      ':disabled="!upAffordable"',
    );
    expect(gongfa?.src, "付不起要换口「尚差」,不许只弹笼统 toast").toContain("尚差 {{ upShort }}");
    expect(gongfa?.src, "双缺要报差数(upShort),不沉到底").toContain("upShort");
    const svc = readFileSync(resolve(__dirname, "../core/gongfaService.ts"), "utf-8");
    expect(svc, "不足分支仍该留着(防御性兜底),但不许是唯一反馈").toContain("悟道点或残页不足");
  });

  it("天道变数已满要置灰 —— 至多三条,不许静默点不动", () => {
    // 挑战书选满第三枚后再点第四枚,此前 toggleDraftMutator 静默 return:
    // 疯狂点选的人以为没点到,又是重复点。上限既然有(CHALLENGE_MAX_MUTATORS),
    // 未选中的芯片在满员时就该置灰禁用 + title 说明 —— 别让「按了没反应」发生。
    // 试炼域(挑战书)拆出后判据随本体走 components/celestial/TrialPanel.vue
    const cel = FILES.find((f) => f.path === "components/celestial/TrialPanel.vue");
    expect(cel?.src, "变数满员要有置灰判据(draftFull)").toContain("draftFull");
    expect(cel?.src, "满员时未选芯片必须 disabled").toContain(
      ':disabled="!draft.mutatorIds.includes(m.id) && draftFull"',
    );
    expect(cel?.src, "置灰要有 opacity 分隔,不许与正常态同灰").toContain("opacity-45");
    expect(cel?.src, "title 要直说「已选满」").toContain("已选满");
  });

  it("天道熔炉付不起置灰+列差 —— 三样燃料不许只有一句笼统 toast", () => {
    // 熔炉三个消费按钮曾口径不一:「熔尽本包」disabled 亮 0 道源,而「灵石→道源」
    // 与「道源→道果」永远可点、点了才 toast「灵石不足/道源不足 N」。
    // 与其余消费点同族:付不起置灰 + 内联「尚差 N 石/道源」,不许只有点了才响。
    // 熔炉弹窗拆出后判据随本体走(components/celestial/FurnaceDialog.vue)。
    const cel = FILES.find((f) => f.path === "components/celestial/FurnaceDialog.vue");
    expect(cel?.src, "灵石行付不起要置灰(stoneShort)").toContain(':disabled="stoneShort > 0"');
    expect(cel?.src, "灵石行要换口「尚差 N 石」").toContain("尚差 {{ formatGN(stoneShort) }} 石");
    expect(cel?.src, "道果行付不起要置灰(daoShort)").toContain(':disabled="daoShort > 0"');
    expect(cel?.src, "道果行要换口「尚差 N 道源」").toContain("尚差 {{ daoShort }} 道源");
    expect(cel?.src, "判据必须现算,不许再永远可点").toContain("endgame.daoSource");
    // 数值语义(回归审查 HIGH):灵石持平与花费都是 GNum,短额若只减尾数(.m - .m)
    // 会丢掉指数 —— 6.1 万价、30 万持有曾被错置灰且报「尚差 3 石」三位数错。
    // 必须走 GNum 指数感知减法(subClamp 与 spendStone 同账 + toNum 落普通数)。
    expect(cel?.src, "尚差必须走 GNum 指数感知减法").toContain(
      "toNum(subClamp(furnaceStoneCost(), resources.spiritStone))",
    );
    expect(cel?.src, "不许用尾数直接相减当短额(会丢指数)").not.toMatch(
      /furnaceStoneCost\(\)\.m - resources\.spiritStone\.m/,
    );
  });

  it("词条转移也列短差 —— 灵石/器灵尘不足不许只剩定性词", () => {
    // 同族规(强化/重铸/封存都「尚差 N」,见 EquipmentDetailDialog):词条转移此前
    // 只报「灵石不足/器灵尘不足」,付不起看不到差多少。补齐并钉死:短差必须走
    // GNum 指数感知减法(与重铸同款),不许退回裸定性词。
    const xfer = FILES.find((f) => f.path === "components/equipment/AffixTransferPanel.vue");
    expect(xfer?.src, "转移付不起要列器灵尘差").toContain(
      "器灵尘×{{ Math.max(0, plan.cost.dust - resources.dust) }}",
    );
    expect(xfer?.src, "转移付不起要列灵石差(GNum 感知)").toContain(
      "toNum(plan.cost.stone) - toNum(resources.spiritStone)",
    );
    expect(xfer?.src, "不许退回裸「灵石不足」").not.toContain("灵石不足");
    expect(xfer?.src, "不许退回裸「器灵尘不足」").not.toContain("器灵尘不足");
  });

  it("坊市售料不足列差额 —— 与悬赏「需 N X,缺 M」同源", () => {
    // 买卖一族里买货、悬赏每单都列缺,唯独「售灵草/售玄铁」不足时只置灰不报差。
    // 补齐并钉死:不足时按钮换口「尚差 N 灵草/玄铁」,与货架/悬赏同一纪律。
    const market = FILES.find((f) => f.path === "views/MarketView.vue");
    expect(market?.src, "售灵草不足要列差").toContain("尚差 ${herbSellShort} 灵草");
    expect(market?.src, "售玄铁不足要列差").toContain("尚差 ${oreSellShort} 玄铁");
  });

  it("寄卖列全件背包 + 即时售丹有声 —— 别把第 13 件藏起来、售丹不许哑卖", () => {
    // ① 寄卖是背包装备唯一出手口,却只渲染前 12 件(bagItems.slice(0,12))——
    //    背包容量 120,第 13 件往后连按钮都没有、也不说明,晚期玩家那件刚
    //    洗出来的货永远寄不出去。整行本就 overflow-x-auto 可横滑,列全即可。
    // ② 售丹按钮写「(N)」读起来像卖一整类,实际一按只出一颗且零反馈;
    //    改成「现持 N」点明数量,并给每颗成功/失败的 toast,不许闷声。
    const market = FILES.find((f) => f.path === "views/MarketView.vue");
    expect(market?.src, "寄卖要列全背包,不许 slice 截断").not.toContain(
      "inventory.bagItems.slice(0, 12)",
    );
    expect(market?.src, "寄卖要遍历整包 bagItems").toContain('v-for="it in inventory.bagItems"');
    expect(market?.src, "售丹数量要写「现持」点明,不许裸 (N)").toContain("(现持 ");
    expect(market?.src, "售丹每颗要有成功反馈 toast").toMatch(/已售 1 颗.*得 .*石/);
  });

  it("货架购兵刃行囊满要置灰 —— 与「付不起置灰」同族,别点了才被退", () => {
    // 店员误买装备在行囊满时被退回(store.buy 的 bagfull 门),但按钮只因 sold/
    // 没灵石置灰 —— 行囊满时还可点,点了才弹「行囊已满,灵石已退回」,白点一下。
    // 与「付不起置灰+就地列因」同族:装备槽行囊满就该置灰并改口「行囊已满」。
    const market = FILES.find((f) => f.path === "views/MarketView.vue");
    expect(market?.src, "装备买入行囊满要置灰(bagFull)").toContain(
      "slot.kind === 'equipment' && inventory.bagFull",
    );
    expect(market?.src, "置灰时要就地改口「行囊已满」").toContain('"行囊已满"');
  });

  it("炼丹灵石不足列「尚差 N 石」 —— 与灵草臂同族,不许只报需求值", () => {
    // 灵草臂已「持 x/y」,灵石臂却只「需 X」;同样付不起,玩家看不出差多少。
    // 统一换口「尚差 N 石」,与灵草坊「尚差 N 石」同款(GNum 感知减法)。
    // 「尚差」的拼串在方子行构造器里,拆分后住在 composables/useBrewing.ts
    // (FILES 只收 components/ 与 views/ 的 .vue,故直读源码,与 pillBatch 同一口径)。
    const brew = readFileSync(join(SRC, "composables/useBrewing.ts"), "utf-8");
    expect(brew, "炼丹灵石不足要列尚差").toContain(
      "灵石不足,尚差 ${formatGN(Math.max(0, toNum(cost.stone) - toNum(resources.spiritStone)))} 石",
    );
  });

  it("白费/未达门槛要置灰 —— 丹药顶满、兵解未达境,不许点了才 toast", () => {
    // ① 丹药详情「服 用」顶满仍可点,按下就真·白吃一颗(修炼快捷卡对同一
    //    buffOverflowOf 判据置灰「已顶」,两视图原先相反);② 兵解转世未达金丹仍
    //    可点、点了才 toast 拦。同族规:不可行就置灰 + 就地列因,别让点下去才知道。
    const inv = FILES.find((f) => f.path === "views/InventoryView.vue");
    expect(inv?.src, "丹药顶满要置灰(判据 currentPillOverflow)").toContain(
      ":disabled=\"currentPillOverflow === 'full'\"",
    );
    expect(inv?.src, "丹药顶满拦因要就地摊(白费)").toContain("药力已顶满——这一颗将白费");
    // 拆分后轮回弹窗归 RebirthDialog,兵解置灰判据随本体改指子面板
    const char = FILES.find((f) => f.path === "components/character/RebirthDialog.vue");
    expect(char?.src, "兵解未达境要置灰(canRebirth)").toContain(':disabled="!canRebirth"');
    expect(char?.src, "兵解置灰要列门槛境名,不许只有定性").toContain("境方可自行兵解");
  });

  it("悬赏贡器不许显占位 0 灵石 · 辅修席满要置灰", () => {
    // ① 贡器单的 reward 是占位 gnZero,逐单真价在交货时按所交品质现算(equipBountyReward)。
    //    价签若一视同仁 formatGN(o.reward) 就亮「0 灵石」——对不上任何结算的假数。
    //    只在贡器单亮「≥X 石」底线(同源下限),不许退回占位 0。② 功法辅修席满时「放入
    //    辅修席」不许再可点等 toast 拦,须置灰就地列因(与同一弹窗进修「尚差」同族)。
    const market = FILES.find((f) => f.path === "views/MarketView.vue");
    expect(market?.src, "贡器单要单独报下限(equip)").toContain('o.kind === "equip"');
    expect(market?.src, "贡器具现下限走 equipBountyReward(tier,0)").toContain(
      "equipBountyReward(o.tier, 0).stone",
    );
    const gongfa = FILES.find((f) => f.path === "components/cultivation/GongfaDialog.vue");
    expect(gongfa?.src, "辅修席满要置灰(subFull)").toContain(':disabled="subFull"');
    expect(gongfa?.src, "席满拦因要显在按钮上,不许只有定性").toContain("辅修席满");
  });

  it("突破不成的修为代价要摊 —— 只报耗灵气是还了半边账", () => {
    // 突破按钮前只摊「耗灵气 N」,失败的真实代价(损修为 ×BT_FAIL_EXP_LOSS)一字不露,
    // 玩家不知道破境还有修为折损。代价要读常量(改常数不撒谎),并点出返还/跬步对冲。
    // 代价行自 CultivationView 拆出随本体迁入 BreakthroughCard —— 钉随走(拆分第五轮 · 一)。
    const cult = FILES.find((f) => f.path === "components/cultivation/BreakthroughCard.vue");
    expect(cult?.src, "突破不成要摊损修为,读 BT_FAIL_EXP_LOSS 常量").toContain(
      "formatPercent(BT_FAIL_EXP_LOSS)",
    );
    expect(cult?.src, "代价要对冲说清(返还/跬步)").toContain("跬步传承可全免");
  });

  it("炉台保底必成要亮 —— 浴火丹心前 3 炉结算 100%,界面不许还报裸把握", () => {
    // engineCraft.rate 在 danxin 保底窗口内返回 1(必成);炉台原先只报 craftability 的裸把握,
    // 持传承时会看到一个其实必成的炉报「把握 60%」—— 结算与界面两本账。行构造器读同源余量,
    // 窗口期把把握换成「必成」并报剩几炉;总数读 craftGuaranteeCrafts,不许手写 3。
    // (弹窗拆出后这套展示在 components/inventory/BrewingDialog.vue)
    const brew = FILES.find((f) => f.path === "components/inventory/BrewingDialog.vue");
    expect(brew?.src, "保底余量与结算同源(craftGuaranteeCrafts)").toContain(
      "craftGuaranteeCrafts(",
    );
    expect(brew?.src, "窗口期展望必成而非裸把握").toContain('r.guaranteeLeft > 0 ? "必成"');
    expect(brew?.src, "总数不许手写 3").toContain(
      "craftGuaranteeCrafts(player.reincarnation.heritage)",
    );
  });

  it("炸炉返草要摊在炉前 —— 失败那面不许只看把握", () => {
    // 炉台只亮成功率与双成,失败该返几成草只活在结算与失败 toast;做决定的人看不到
    // 输的那面。返草要读 salvageRatio(同源,含稳炉护料),不许界面另写一份数。
    // 拆分后比率算在 composables/useBrewing.ts(FILES 只收 .vue,直读源码)、
    // 「炸炉返草 ~」的成本行展示在 BrewingDialog 模板 —— 两处各自盯。
    const brew = readFileSync(join(SRC, "composables/useBrewing.ts"), "utf-8");
    const dialog = FILES.find((f) => f.path === "components/inventory/BrewingDialog.vue");
    expect(brew, "返草要读 salvageRatio(同源)").toContain("salvageRatio(");
    expect(dialog?.src, "返草要显在炉台成本行").toContain("炸炉返草 ~");
  });

  it("转世一句不撒谎 —— 法宝归尘、功法回一层,不许写保留/折半", () => {
    // 弹窗顶部一句话曾写「保留道果/天赋/法宝,功法折半」,而同一弹窗的 HERITAGE
    // 去留一览(samsaraAudit)写着法宝 reset(归尘)、功法 partial(回一层)—— 同屏两本账。
    // 一句话要与结算同源:保留随魂之物,功法回一层,法宝归尘。不许退回旧假账。
    // 拆分后轮回弹窗归 RebirthDialog,判据随本体改指子面板
    const char = FILES.find((f) => f.path === "components/character/RebirthDialog.vue");
    expect(char?.src, "功法是回一层非折半").toContain("功法回一层");
    expect(char?.src, "法宝是归尘非保留").toContain("法宝归尘");
    expect(char?.src, "不许再手写旧假账(保留法宝/折半)").not.toMatch(/天赋 \/ 法宝|功法折半/);
  });

  it("弟子历练的灵石奖励要露 —— 尘与石都拼上,不许链式早退吞掉石头", () => {
    // 历练(baseSpoils)同时产灵石(随境界折算的大头)与器尘,但 reapText/taskYield 原先都
    // 是单个 early-return 链,器尘排在前 → 灵石永远不显示。奖励要拼全(parts.join),不退回「只报一种」。
    const appr = FILES.find((f) => f.path === "views/ApprenticeView.vue");
    expect(appr?.src, "要拼器尘").toContain("parts.push(`器灵尘");
    expect(appr?.src, "要拼灵石").toContain("parts.push(`灵石 ");
    expect(appr?.src, "不许单值早退").toContain("parts.join(");
  });

  it("astral 共鸣的护盾数值不许手写 —— data 只留机制,值读 ASTRAL_SET_SHIELD", () => {
    // data/equipSets 的 effectDesc 曾把「护盾+5%」手打进三套 astral,而唯一真值是
    // ASTRAL_SET_SHIELD(供 playerSnap 开战盾用)—— 改数就撒谎,且装备页「+5%」与
    // 人物页盾值对不上。data 回归「只写 hook」的注释本意;显示处读常量拼值。
    const data = readFileSync(resolve(__dirname, "../data/equipSets.ts"), "utf-8");
    expect(data, "data 的 effectDesc 不许手写护盾百分比").not.toMatch(/护盾\s*\+[0-9.]+%/);
    const equip = FILES.find((f) => f.path === "components/equipment/EquipmentDetailDialog.vue");
    expect(equip?.src, "显示要读 ASTRAL_SET_SHIELD,不许另打一份").toContain(
      "formatPercent(ASTRAL_SET_SHIELD)",
    );
  });

  it("闭关该收多少要摊开且不手抄 —— 按现倍率折算,不许定性「×2.5」", () => {
    // 闭关决意原先只给「修炼 +150%」的定性;在已有速度增益时按「每秒×2.5」预估会虚高。
    // 要按现倍率折算 base 再算(factor×现倍率+buff),并把「闭关后每秒 / 多收」摊成数。
    // 拆分后闭关卡归 RetreatCard,判据随本体改指子面板
    const retreatCard = FILES.find((f) => f.path === "components/cultivation/RetreatCard.vue");
    expect(retreatCard?.src, "要摊闭关后每秒").toContain("闭关后每秒");
    expect(retreatCard?.src, "按现倍率折算,不手写常数").toContain("mult + r");
  });

  it("读屏可访问名与付不起的原因 —— 占位输入给 aria-label,修到顶置灰时列差", () => {
    // P1:三处纯占位输入框(构筑名/装备标记/挑战书命名)原先只靠 placeholder 当名字,
    // 读屏成不了名;各补 aria-label 作可访问名,不靠会丢失的占位提示。
    const build = readFileSync(resolve(__dirname, "../views/BuildView.vue"), "utf-8");
    expect(build, "构筑命名输入要有可访问名").toMatch(
      /input[\s\S]*?aria-label="给这套构筑起个名字"/,
    );
    // 备注子面板拆出后判据随本体走(components/equipment/EquipNotePanel.vue)
    const equip = readFileSync(
      resolve(__dirname, "../components/equipment/EquipNotePanel.vue"),
      "utf-8",
    );
    expect(equip, "装备标记输入要有可访问名").toMatch(
      /input[\s\S]*?aria-label="为这件装备加个标记/,
    );
    const celestial = readFileSync(
      resolve(__dirname, "../components/celestial/TrialPanel.vue"),
      "utf-8",
    );
    expect(celestial, "挑战书命名输入要有可访问名").toMatch(
      /input[\s\S]*?aria-label="为此挑战书命名/,
    );
    // P4:修到顶置灰时,只亮「修到顶」没把差多少摊出来(读屏只听到 disabled)。要像
    // 同框「进 修」那样列「尚差 upShort」,并给 aria-label。
    const gf = readFileSync(
      resolve(__dirname, "../components/cultivation/GongfaDialog.vue"),
      "utf-8",
    );
    expect(gf, "修到顶要有带差量的 aria-label").toMatch(/aria-label=.*修到顶/);
    expect(gf, "修到顶置灰时可见列出差量").toContain("尚差 {{ upShort }}");
  });

  it("机制数改常量要同源 —— 熔炉道源/收徒价/秘境悟道/变数上限/行程层数不手抄", () => {
    // 「改常数就撒谎」的又一挂:界面把真实结算的机制数手写成了字面量,而别处早有
    // 常量/结算来源。每处都要读同一个来源,不许手抄,免得常量一改界面就分叉。
    // (天界拆分后各机制数随本体走:FURNACE_STONE_DAO_SOURCE→FurnaceDialog,
    //   CHALLENGE_MAX_MUTATORS/EXPEDITION_*→仍暂在主文件,随后续拆分块改道)
    const furnace = readFileSync(
      resolve(__dirname, "../components/celestial/FurnaceDialog.vue"),
      "utf-8",
    );
    expect(furnace, "熔炉产出侧读 FURNACE_STONE_DAO_SOURCE").toContain(
      "{{ FURNACE_STONE_DAO_SOURCE }} 道源",
    );
    // 试炼域拆出后变数上限判据随本体走 TrialPanel;远征域拆出后层数/界主判据随本体走 ExpeditionPanel
    const trial = readFileSync(
      resolve(__dirname, "../components/celestial/TrialPanel.vue"),
      "utf-8",
    );
    expect(trial, "变数至上条数读 CHALLENGE_MAX_MUTATORS").toContain(
      "cnNumber(CHALLENGE_MAX_MUTATORS)",
    );
    // 远征域拆出后层数/界主判据随本体走 ExpeditionPanel
    const exped = readFileSync(
      resolve(__dirname, "../components/celestial/ExpeditionPanel.vue"),
      "utf-8",
    );
    expect(exped, "行程层数临界不写死 2 / 3").toContain("layer >= EXPEDITION_ROUTE_LAYERS");
    expect(exped, "界主层判据读 EXPEDITION_GUARDIAN_LAYER").toContain(
      "=== EXPEDITION_GUARDIAN_LAYER",
    );
    const av = readFileSync(resolve(__dirname, "../views/ApprenticeView.vue"), "utf-8");
    expect(av, "收徒价签读常量,不许手写 30").toContain("APPRENTICE_RECRUIT_TIER_AMOUNT");
    expect(readFileSync(resolve(__dirname, "../stores/apprentice.ts"), "utf-8")).toContain(
      "APPRENTICE_RECRUIT_TIER_AMOUNT",
    );
    expect(readFileSync(resolve(__dirname, "../core/secretRealm.ts"), "utf-8")).toContain(
      "SECRET_FINAL_WUDAO",
    );
    expect(
      readFileSync(resolve(__dirname, "../components/adventure/SecretRealmCard.vue"), "utf-8"),
    ).toContain("SECRET_FINAL_WUDAO");
  });

  it("周易换挡表从 CHANGING_TIERS 派生;星象「乘/加」措辞不骗人", () => {
    // 动爻→卦力×时长 的换挡表曾只在 core CHANGING_TIERS 里、界域志只给定性;
    // 该露未露。判据:界域志要照实机常数派生(changingRange 读 CHANGING_TIERS),不手写分钟。
    // 另一处:星象际遇是加性(exploreEventChance 把 luck 加进括号内),不许说「乘在……上」。
    const c = readFileSync(resolve(__dirname, "../views/RealmCodexView.vue"), "utf-8");
    expect(c, "换挡表要读 CHANGING_TIERS").toContain("CHANGING_TIERS");
    expect(c, "档位人话从相邻 min 推,不手写区间").toContain("changingRange(CHANGING_TIERS,");
    expect(c, "际遇加成是加性的,不许写「乘在……上」").not.toMatch(/乘在际遇概率/);
  });

  it("灵气积余备注不手写倍数 —— 与「容量的 N 倍」同源,改常数不撒谎", () => {
    // 同文件兄弟行已用 QI_BANK_MULT;唯独 qiDetailNote 把「10」字面量钉死,
    // 常量一改详情页就撒谎。判据要求它像那行一样读常量,不许手写任一数字倍数。
    const cult = FILES.find((f) => f.path === "views/CultivationView.vue");
    expect(cult?.src, "积余备注要读 QI_BANK_MULT").toContain("容量的 ${QI_BANK_MULT} 倍)");
    expect(cult?.src, "不许手写「= 容量的 10 倍」这类字面量").not.toMatch(/= 容量的 \d+ 倍/);
  });

  it("人物明细亮出递减规则 —— 同词条多源,不许只活在注释", () => {
    // Phase 19.5 的关键设计(多来源边际递减、混合构筑更值)此前只活在公司注释与引擎
    // 文档里:明细每一份虽是打完折的真值,玩家对着两三个来源看不出「第三个被砍半」。
    // 点开多源明细时,把递减权重序从 DIMINISH_WEIGHTS 本体读出来,不许手抄 "50%/25%"。
    const char = FILES.find((f) => f.path === "views/CharacterView.vue");
    expect(char?.src, "递减说明要读 DIMINISH_WEIGHTS 本体").toContain("DIMINISH_WEIGHTS");
    expect(char?.src, "递减排重序从权重逐个换算且统走 formatPercent").toContain(
      "formatPercent(w, 0)",
    );
    expect(char?.src, "递减注记要真挂在明细面板里").toContain('v-if="diminishNote"');
    expect(char?.src, "方向要直说(混合比单条堆砌更值)").toContain("混合构筑比单条堆砌更值");
  });

  it("词条转移拦因要说清 —— 品质不够报缺哪档,落位不可报为什么", () => {
    // 候选「品质不够」太笼统 —— 玩家看不出该把目标件升到哪一档;落位「不可」也不
    // 说原因。两处都换口具体理由,与「决策信息完整」同族。
    const xfer = FILES.find((f) => f.path === "components/equipment/AffixTransferPanel.vue");
    expect(xfer?.src, "品质不够要直说缺哪一档").toContain("需 ≥ ${minQualityName()}");
    expect(xfer?.src, "落位不可要报具体原因(读 transferBlockText)").toContain(
      "transferBlockText(l.check.block, affixId!)",
    );
    expect(xfer?.src, "不许退回裸「品质不够」定性词").not.toContain('"品质不够"');
  });

  it("护盾上限进构筑面板 —— 有盾系词条时才亮,读常量不手抄 50%", () => {
    // 护盾至多覆盖最大气血 50% 此前只活在 combat 常量,玩家堆盾前完全不知道这道顶。
    // 面它摆进有盾系词条时的人物卡(与「进阶成功率只作用于小进阶」同一族边界注),
    // 只在真相关时出现、不占常驻字数;百分比从 SHIELD_CAP_RATIO 本体读,不手写 "50%"。
    const char = FILES.find((f) => f.path === "views/CharacterView.vue");
    expect(char?.src, "护盾上限说明要读 SHIELD_CAP_RATIO 本体").toContain("SHIELD_CAP_RATIO");
    expect(char?.src, "只在有盾系词条时亮(v-if=hasShieldMods)").toContain('v-if="hasShieldMods"');
    expect(char?.src, "上限说明要点破「顶不破这道上限」").toContain("顶不破这道上限");
  });

  it("收徒归来要有一声 —— 资材不清进入账,界面要报「XX 归来,带回…」", () => {
    // 弟子完工此前被一拍 disable 的 collectFinished 静默收割:资材悄悄入账、弟子无声
    // 变回闲置,玩家盯着归期看却不报。「已归,待领」那格还因同一拍清 task 而永远亮不了。
    const appr = FILES.find((f) => f.path === "views/ApprenticeView.vue");
    expect(appr?.src, "归来要消费 collectFinished 的尾账").toContain(
      "announceReaps(appr.collectFinished",
    );
    expect(appr?.src, "通报要念出弟子名与带回之物").toContain("」归来,带回 ");
    expect(appr?.src, "自动收割下「已归,待领」是永远亮不了的死控件,不许留").not.toContain(
      "已归,待领",
    );
    const store = readFileSync(resolve(__dirname, "../stores/apprentice.ts"), "utf-8");
    expect(store, "尾账要带弟子名").toContain("name: apprenticeDef(appr.archId)?.name");
  });

  it("「各尽其长」按钮与回执要照实说门 —— 并列退回本职时不许喊「最缺的门」", () => {
    // 一键派发把全部闲置弟子派走,是玩家能做的几件「一锤子」事之一;可按钮原话
    // 「派闲置弟子去最缺的门」与回执「已派往最缺的门」在**并列**时是假的 ——
    // needTargetDoor 无单门胜出会退回各自专职,两句文案却没换口。判定与文案必须
    // 同源(needTargetDoor / taskDef),并列、单门两种话术都钉在这里,不许只报一种。
    const appr = FILES.find((f) => f.path === "views/ApprenticeView.vue");
    expect(appr?.src, "派发文案要读 needTargetDoor(单门/并列的唯一判据)").toContain(
      "needTargetDoor",
    );
    expect(appr?.src, "回执要说清派去了哪一门或各就本职(与判定同源)").toContain(
      "taskDef(target).name",
    );
    expect(appr?.src, "「最缺的门」的旧空话不许回来").not.toContain("已派往最缺的门");
    expect(appr?.src, "按钮与回执都要消掉并列时的那句假承诺").not.toContain("派闲置弟子去最缺的门");
  });

  it("引气疗伤付不起列短差与回够时长 —— 同文件突破钮已内化的口径此处不许漏", () => {
    // 疗伤钮是最老的「只说不许不报差」式样:灰钮只报「需 X」,不差多少、不回够多久。
    // 同文件突破钮 btQiBlock 已补齐短差+ETA,此处照同一口径收口。
    const cult = FILES.find((f) => f.path === "views/CultivationView.vue");
    expect(cult?.src, "疗伤灰钮要现算短差").toMatch(/const repairBlock = computed\(/);
    expect(cult?.src, "短差句要与突破钮同款(尚差 X,按当前回复约 Y)").toContain(
      "尚差 {{ repairBlock.short }} 灵气,按当前回复{{ repairBlock.eta }}",
    );
  });

  it("出秘境要二步确认 —— 付过门票的独一份内容,误触不该直接清空", () => {
    // 整趟秘境是付过门票、层数战利「出则散」的独一份内容,此前点「出秘境」一拍即清,
    // 误触即血亏 —— 与删快照同族,进确认态再动手。
    const sr = FILES.find((f) => f.path === "components/adventure/SecretRealmCard.vue");
    expect(sr?.src, "出秘境要先进确认态").toContain("confirmAbandon = true");
    expect(sr?.src, "确认态要点破「弃境」").toContain("确认弃境");
    expect(sr?.src, "确认态要有取消兜底").toContain("confirmAbandon = false");
  });

  it("灵脉全域满要自报 —— 单脉未满却被总量卡死,不许只印费用", () => {
    // 单脉未满、钱够、却被 7 座总容量卡死时,此前按钮置灰却印着费用,像还能投。
    const vein = FILES.find((f) => f.path === "components/dongfu/VeinInvestCard.vue");
    expect(vein?.src, "全域满要换口「总容量已满」").toContain("总容量已满");
    const capAt = vein?.src.indexOf("总容量已满") ?? -1;
    const shortAt = vein?.src.indexOf("尚差") ?? -1;
    expect(
      capAt >= 0 && shortAt > capAt,
      "全域满是硬约束,要排在「尚差石」前头(别让人看错拦因)",
    ).toBe(true);
  });

  it("连投批量读 VEIN_BATCH —— 不许手写「+5」当常量改了只顾一头", () => {
    // 按钮、读屏名、批量调用三处同源:批量指改 VEIN_BATCH 一处生效,
    // 而不是「+5」「连投 5 点」「investVeinBatch(id, 5)」各写一遍、改常量就撒谎
    // (与连炼×5 / 建筑连升同一种有界批量,药那侧已有 pillBatch.spec 单源钉住)。
    const vein = FILES.find((f) => f.path === "components/dongfu/VeinInvestCard.vue");
    expect(vein?.src, "连投按钮要读常量 VEIN_BATCH").toMatch(/\+{{\s*VEIN_BATCH\s*}}/);
    expect(vein?.src, "连投读屏名要与批量数同源").toContain("连投 ${VEIN_BATCH} 点");
    expect(vein?.src, "批量调用要传 VEIN_BATCH 而非字面量").toContain(
      "investVeinBatch(veinId, VEIN_BATCH)",
    );
    const constants = readFileSync(resolve(__dirname, "../data/constants.ts"), "utf-8");
    expect(constants, "VEIN_BATCH 要真在常数表里(否则读了个寂寞)").toContain(
      "export const VEIN_BATCH = 5;",
    );
  });

  it("仙路刻度的境数读 points —— aria-label 不许手写「21 境」当常量改了只顾一头", () => {
    // 刻度格复用 REALMS 渲染,唯一会把「有几境」写死的是读屏 aria-label「仙路 21 境」:
    // 将来增删境界,刻度会跟着变,这句读名却停在 21 —— 又是「写常量即撒谎」。
    // 境数必须取自 points(即 REALMS.length),不许留数字字面量。
    const lad = FILES.find((f) => f.path === "components/cultivation/RealmLadder.vue");
    expect(lad?.src, "仙路 aria-label 的境数要读 points.length").toContain(
      "仙路 ${points.length} 境",
    );
    expect(lad?.src, "不许退回手写「仙路 21 境」").not.toContain('aria-label="仙路 21 境"');
  });

  it("建筑连升的读屏名读 BUILD_BATCH —— 不许写着「连升×{{BUILD_BATCH}}」、读屏却停「5 级」", () => {
    // 建筑卡的连升按钮文本与批量调用都读 BUILD_BATCH,唯一漏的是读屏
    // aria-label「连升 5 级」—— 批量指变了,按钮与调用跟着变,读名却停在 5,
    // 又是「写常量即撒谎」(与灵脉连投 / 仙路境数同族)。
    const b = FILES.find((f) => f.path === "components/dongfu/BuildingCard.vue");
    expect(b?.src, "建筑连升读屏名要插批量常量").toContain("`连升 ${BUILD_BATCH} 级`");
    expect(b?.src, "不许退回手写「连升 5 级」").not.toContain('aria-label="连升 5 级"');
  });

  it("灵气充盈的阈值比率读常量 —— 不许手写「容量一半」当比例改了只顾一头", () => {
    // 阈值数字本就随 QI_RICH_THRESHOLD_RATIO(结算同源)现算,可括号里的形容
    // 「容量一半」是手写的:比例一旦从 0.5 改走,数字跟着变、这句形容却停在一半,
    // 又是不许手写会被常数改动的字(「改常数就撒谎」)。
    const cult = FILES.find((f) => f.path === "views/CultivationView.vue");
    expect(cult?.src, "阈值比率要用 formatPercent 现算").toContain(
      "formatPercent(QI_RICH_THRESHOLD_RATIO)",
    );
    expect(cult?.src, "不许退回手写「容量一半」").not.toContain("容量一半");
  });

  it("首页天时倒计时走定宽口径 —— 不许退回复活 formatDuration 让每秒跳字", () => {
    // 天时剩余是主页上唯一每秒在变的活值:最后 1 小时逐秒走字(formatDuration 变宽,
    // 「9分59秒」→「10分0秒」字数还会缩),必须走 formatCountdown 逐位补零 + countdown-slot
    // 定宽槽,整行才不随倒数左右跳(与状态胶囊同一条抖动纪律,见 style.css 的注释)。
    const home = FILES.find((f) => f.path === "views/HomeView.vue");
    expect(home?.src).toContain("formatCountdown(weatherRemainingSec())");
    expect(home?.src).toContain("countdown-slot");
    expect(home?.src, "不许退回会变宽的 formatDuration").not.toContain(
      "formatDuration(weatherRemainingSec())",
    );
  });

  it("首页天气行窄屏不许挤竖排或撞修炼球 —— 须可换行且天时名不折", () => {
    // 320 窄屏上左侧栏只剩 110px:天时名(whitespace-nowrap)+ 定宽倒计时塞一行必然互挤 ——
    // 名被压成竖排(25px×54px,layout-check vertical-texts 报过),倒计时还会越界撞到右侧
    // 修炼球(overlap=true)。修法:整行 flex-wrap 让倒计时装不下就换行,天时名 shrink-0
    // 不折 —— 既消竖排又不撞球。退化成只 nowrap 不 wrap 的写法,倒计时照样盖到球上。
    const home = FILES.find((f) => f.path === "views/HomeView.vue");
    const row = home?.src.match(/mt-3 flex flex-wrap items-center[\s\S]{0,400}/)?.[0] ?? "";
    expect(row).toContain("flex flex-wrap");
    // 只钉「不折」这件事(whitespace-nowrap + shrink-0 + 楷体),字号不进判据 ——
    // 字阶归「主巡页 · 字阶同一套」管,一条判据只管一件事,改字号不该打红布局判据。
    expect(row).toMatch(/shrink-0 whitespace-nowrap font-kai text-\[\d+px\] tracking-widest/);
    expect(row).toContain("countdown-slot");
  });

  it("破坏性二次确认话术统一 —— 确认前缀 + 再想想,不许各说各话", () => {
    /*
     * 确认模式分级(2026-10 交互统一轮定稿),按「误触代价可逆吗」分两档:
     *
     * 【T1 不可逆失去整件/整份独有进度】→ 两步武装确认:
     *   确认词一律「确认+动词」(确认删除/确认分解/确认弃境/确认凝炼/确认散去/
     *   确认熔尽/确认重写/确认中道而返/确认择道),取消词一律「再想想」。
     *   弹窗级确认(重置/导入/定道途/兵解)取消词同为「再想想」,确认钮可用
     *   叙事题词(道心已决/道心已定/踏入轮回)—— 整弹窗就是第一眼,不靠按钮名防误触。
     * 【T2 消费但可自愈/可再得/交易本意】(重铸/强化/服丹/闭关/买卖交付/派遣)→
     *   一键直达 + 就地护栏(付不起置灰列差/顶满置灰/代价内联);重铸一键是
     *   用户拍板(dataTextAudit 另有判据钉死),不许退回两步。
     * 【T3 可逆】(换装/卸下佩件/卸下器魂/勾选)→ 一键零确认。
     *
     * 家族成员(此判据逐个钉死话术):删构筑/分解单件/弃秘境/凝炼/散魂/
     * 熔尽本包/忆战重写/中道而返/择道。取消词统一前它们各说各话
     * (取消/取 消/算了/再想想)。
     */
    const family: Array<[string, string, string]> = [
      // [文件, 确认词, 武装态字段(防一键回潮的锚)]
      ["views/BuildView.vue", "确认删除", "confirmDelete"],
      ["components/equipment/EquipDecomposePanel.vue", "确认分解", "decomposeArm"],
      ["components/adventure/SecretRealmCard.vue", "确认弃境", "confirmAbandon"],
      ["views/SoulsView.vue", "确认凝炼", "pendingRefineUid"],
      ["views/SoulsView.vue", "确认散去", "pendingDissolveUid"],
      ["components/celestial/FurnaceDialog.vue", "确认熔尽", "furnaceConfirm"],
      ["components/celestial/MarksPanel.vue", "确认重写", "rewriteConfirm"],
      ["components/celestial/ExpeditionPanel.vue", "确认中道而返", "abandonArmed"],
      ["components/cultivation/GongfaDialog.vue", "确认择道", "branchConfirm"],
    ];
    const problems: string[] = [];
    for (const [path, word, arm] of family) {
      const f = FILES.find((x) => x.path === path);
      if (!f) {
        problems.push(`${path}: 文件不见了`);
        continue;
      }
      if (!f.src.includes(word)) problems.push(`${path}: 确认词须是「${word}」`);
      if (!f.src.includes(arm)) problems.push(`${path}: 武装态「${arm}」不见了(一键回潮?)`);
      // 取消词全库一律「再想想」—— 分解另禁「算了」回潮
      if (!f.src.includes("再想想")) problems.push(`${path}: 取消词须是「再想想」`);
    }
    const eq = FILES.find((f) => f.path === "components/equipment/EquipDecomposePanel.vue");
    expect(eq?.src, "分解取消不许再写「算了」").not.toContain("算了");
    expect(problems, `话术或武装态各说各话:${problems.join(" | ")}`).toEqual([]);
  });

  it("导入存档与重置同一条确认纪律 —— 备份会整体替换当前进度,不许直接落库", () => {
    // 导入备份会把本机全部进度替换掉、不可逆,却曾与重置不对称:重置有整整一个
    // 确认弹窗,导入却在选中文件后直接 importSaveText + reloadGame,一句话带过。
    // 现在导入也会先进确认态(读到文本挂起、引擎暂停),确认才替换(与重置/删构筑/分解同族)。
    const s = FILES.find((f) => f.path === "views/SettingsView.vue");
    expect(s?.src, "选中文件后要先开确认态,不许直接落库").toContain("importConfirm.value = true");
    expect(s?.src, "确认弹窗要点破「整体替换」").toContain("整体替换");
    expect(s?.src, "确认成功走专门的 confirmImport,不在 onFilePicked 里顺带落库").toContain(
      "function confirmImport",
    );
    expect(s?.src, "至少要有取消兜底").toContain("closeImport");
    expect(s?.src, "导入确认期间引擎要暂停(与重置同款,防 persist 回写)").toContain(
      "engine.pause()",
    );
  });

  it("强色文字不叠透明度 —— 要淡是换 token,不许元素级 opacity", () => {
    // design.md「文字不叠透明度」:品阶名(整色)与 buff 叠数(继承强色)此前用元素级
    // opacity-80 淡化 —— 正好绕过 palette.spec 只扫「/80」斜杠语法的口子,浏览器照样
    // 混色、对比度算不出。要低强调该换一档整色 token,不是让 opacity 偷偷混。
    // 拆分后装备详情域 = 宿主 + 六个子面板,反断言要查全域,不许只查宿主(假绿)
    const eqFiles = FILES.filter((f) => f.path.startsWith("components/equipment/"))
      .map((f) => f.src)
      .join("\n");
    const cult = FILES.find((f) => f.path === "views/CultivationView.vue");
    expect(eqFiles, "品阶名不许叠 opacity 淡化").not.toMatch(/text-\[9px\] opacity-80/);
    expect(cult?.src, "buff 叠数不许叠 opacity 淡化").not.toMatch(/text-\[9px\] opacity-80/);
  });

  it("资源显示名单源 —— 手抄各副本删净,统一读 data/resourceNames", () => {
    // 灵石/悟道点/灵草/玄铁/功法残页/器灵尘 此前在 engineResources、suppress、eventEngine、
    // InventoryView、endgame 至少 5 处手抄(一处含悟道点、一处不含)—— 改一处其余不跟。
    const el = readFileSync(resolve(__dirname, "../core/engineResources.ts"), "utf-8");
    const sup = readFileSync(resolve(__dirname, "../core/suppress.ts"), "utf-8");
    const ev = readFileSync(resolve(__dirname, "../core/eventEngine.ts"), "utf-8");
    const inv = readFileSync(resolve(__dirname, "../views/InventoryView.vue"), "utf-8");
    const eg = readFileSync(resolve(__dirname, "../data/endgame.ts"), "utf-8");
    expect(el, "账本名要读 RESOURCE_LABELS").toContain("RESOURCE_LABELS.");
    expect(el, "账本名不再手写「灵石/悟道点」").not.toMatch(/name: "灵石"|name: "悟道点"/);
    expect(sup, "suppress 删除手抄 RESOURCE_NAMES").not.toContain("const RESOURCE_NAMES");
    expect(ev, "eventEngine 删除手抄 MATERIAL_NAMES").not.toContain("const MATERIAL_NAMES");
    expect(inv, "背包材料行读单源").toContain("name: RESOURCE_LABELS.herb");
    expect(eg, "熔炉价目不再手写「玄铁/功法残页」").not.toMatch(/name: "玄铁"|name: "功法残页"/);
  });

  it("流派名单源 —— 空态名单与模拟矩阵都由 BUILD_STYLES 派生", () => {
    // 六大流派短名此前在 BuildView 空态与 buildSim 矩阵各抄一份,新增/改名一侧另一侧不跟。
    const bd = readFileSync(resolve(__dirname, "../core/buildDetect.ts"), "utf-8");
    expect(bd, "短名要从 BUILD_STYLES 派生").toContain("BUILD_STYLES.map");
    const bv = FILES.find((f) => f.path === "views/BuildView.vue");
    expect(bv?.src, "空态名单改读 STYLE_SHORT_NAMES").toContain("STYLE_SHORT_NAMES.join");
    const bs = readFileSync(resolve(__dirname, "../core/buildSim.ts"), "utf-8");
    expect(bs, "模拟矩阵不再手抄流派名").not.toMatch(/name: "背水流"/);
    expect(bs, "模拟矩阵改名要经 styleName 查 BUILD_STYLES").toContain('styleName("beishui")');
  });

  it("今日天道有占位 —— 未择道途,也要说出它去哪了", () => {
    // 「今日天道」区块 v-if="daily",而 daily 依赖 endgame.daoPath —— 刚登真仙
    // 未择道途时整块消失,玩家切到试炼页找不到今日天道,会以为 bug。类目下
    // 「天道变数/试炼」都常驻,唯独这块没空态。补一句「择定道途后在此展开」。
    // 试炼域拆出后判据随本体走 components/celestial/TrialPanel.vue
    const cel = FILES.find((f) => f.path === "components/celestial/TrialPanel.vue");
    expect(cel?.src, "今日天道未择道途要有占位(v-else)").toMatch(/<section v-else>/);
    expect(cel?.src, "占位要直说「随道途而定」").toContain("今日天道随道途而定");
    expect(cel?.src, "占位要指明去道途页择定").toContain("择定");
  });

  it("灵根鉴定结果说给读屏 —— 全屏定格不许对屏幕阅读器无声", () => {
    // 创角「灵根鉴定」全屏定格是核心结果播报,却对读屏完全无声(动画期间
    // pointer-events:none、无 aria-live)—— 视障玩家看完一屏动画仍不知道
    // 测出哪条根。定格那一瞬(animating=false)必须用 aria-live=polite 念真名。
    const reveal = FILES.find((f) => f.path === "components/common/SpiritRootReveal.vue");
    expect(reveal?.src, "鉴定结果必须挂 aria-live 播报区").toContain('aria-live="polite"');
    expect(reveal?.src, "播报区必须在定稿件时出现(animating=false)").toMatch(/v-if="!animating"/);
    expect(reveal?.src, "要念出「灵根鉴定完毕」的真名").toContain("灵根鉴定完毕");
    expect(reveal?.src, "读屏专用区必须视觉隐藏(sr-only)").toContain("sr-only");
  });

  it("世界越界有一声 —— 换一片天,不许静默揭幕", () => {
    // 越界是全流程最重大事件(入仙界/神界/混沌海),视觉有 2.8s 揭幕遮罩,
    // 从此却没有声音 —— 该响就响,不能让最高潮静静流过。判据:揭示触发
    // 时必须 playSfx('worldRise')(与判据 announceWorldEntry 同一触发点),音效
    // 引擎里 worldRise 要有自己的庄严谱(深钟+大跨度上行),不许退回 breakthrough。
    const veil = readFileSync(
      resolve(__dirname, "../components/common/WorldTransitionVeil.vue"),
      "utf-8",
    );
    expect(veil, "越界宣告必须有配乐唤醒").toContain(`playSfx("worldRise")`);
    const audio = readFileSync(resolve(__dirname, "../core/audio.ts"), "utf-8");
    expect(audio, "worldRise 要进 SfxName 联合").toContain(`| "worldRise"`);
    expect(audio, "worldRise 要有自己的谱,不许退回其他音效").toMatch(/case "worldRise":/);
  });

  it("道痕满卷有提示 —— 最古之痕将覆去,不许玩家蒙在鼓里", () => {
    // 道痕 60 则封顶后,新痕从头部挤入、最古一痕被静默覆去,玩家根本不知道自己
    // 最早的履历会无声消失。封顶 = 要留意(琥珀族,同突破已封顶/遇事勿扰),
    // 判据必须读 store 的 marksFull(与 addMark 的封顶同源),不许视图另数一遍。
    // 道痕 tab 拆出后判据随本体走(components/celestial/MarksPanel.vue)。
    const cel = FILES.find((f) => f.path === "components/celestial/MarksPanel.vue");
    expect(cel?.src, "天界道痕区要挂满卷提示").toContain("endgame.marksFull");
    expect(cel?.src, "满卷要是要留意的琥珀,不是普通淡字").toMatch(
      /endgame\.marksFull[\s\S]{0,80}text-amber-ink/,
    );
    expect(cel?.src, "判据必须读 store 的 marksFull,不许视图自己 <count 比较").not.toContain(
      "marks.length >= MAX_MARKS",
    );
    expect(cel?.src, "覆去的话要直说(最古覆去),不许只报个数字").toContain("覆去");
    const store = readFileSync(resolve(__dirname, "../stores/endgame.ts"), "utf-8");
    expect(store, "marksFull 必须与 addMark 同源(同一 MAX_MARKS)").toMatch(
      /marksFull = computed\([\s\S]{0,80}MAX_MARKS/,
    );
    expect(store, "MAX_MARKS 被改成私有会让提示失去同源判据").toContain("export const MAX_MARKS");
  });

  it("归来卷轴配一枚印 —— 石绿「归」印,不走朱砂(那是里程碑的色)", () => {
    // 突破幕有朱砂「破」印 + 全屏墨浪/墨点/金环,归来卷轴此前只有一行淡字 ——
    // 表彰不该偏废:归总是「此行已结」的完成态,该有自己的印。语义色族规不变:
    // 朱砂=里程碑(突破/首领),石绿=完成/结清(今日已毕/尽收/归来) —— 谁把
    // 归来印换成朱砂,或者把印拆回一行字,下面红。
    const dlg = FILES.find((f) => f.path === "components/offline/OfflineRewardDialog.vue");
    expect(dlg?.src, "归来卷轴要有石绿「归」印(animate-seal-breathe + border-jade)").toContain(
      "animate-seal-breathe",
    );
    expect(dlg?.src).toContain("border-jade");
    expect(dlg?.src, "归 来不能退回一行淡字 —— 完成态要有印身").toContain("h-16 w-16");
    expect(dlg?.src).not.toContain("border-cinnabar");
    const css = readFileSync(resolve(__dirname, "../style.css"), "utf-8");
    expect(css, "seal-breathe 的帧定义被删了 —— 归来印退回瞬显").toMatch(/@keyframes seal-breathe/);
    const tw = readFileSync(resolve(__dirname, "../../tailwind.config.js"), "utf-8");
    expect(tw, "seal-breathe 的映射被拆了 —— 归来印失去呼吸").toContain(
      `"seal-breathe": "seal-breathe`,
    );
  });

  it("离线卷轴收益列同列同缩写 —— 灵气/灵草/玄铁/悟道点/器灵尘也要 formatNum", () => {
    // 修为/灵石已走 formatGN,灵气等大数资源却裸整数 —— 同列的 tabular 对齐被
    // 一串 10~20 位裸数字撑破(顶栏都缩写 qi,离线卷轴却给原数)。同一列、同一把尺:
    // 大资源全部 formatNum 缩写,小值它也会原数显示,不吞精度。
    const dlg = FILES.find((f) => f.path === "components/offline/OfflineRewardDialog.vue");
    expect(dlg?.src, "灵气要缩写").toContain("+${formatNum(s.qi)}");
    expect(dlg?.src, "灵草要缩写").toContain("+${formatNum(s.herb)}");
    expect(dlg?.src, "玄铁要缩写").toContain("+${formatNum(s.ore)}");
    expect(dlg?.src, "悟道点要缩写").toContain("+${formatNum(s.wudao)}");
    expect(dlg?.src, "器灵尘要缩写").toContain("+${formatNum(s.recycledDust)}");
  });

  it("提示条全库开口 —— toast 承载动作结果,不许对读屏全哑", () => {
    // toast 几乎通报了每一笔获得与每一处不足,ToastHost 却没有 live region ——
    // 视觉玩家有滑入的音画,读屏玩家点完只听个静默。挂在容器上:TransitionGroup
    // + :key=id 保证新 toast 只新增一个节点,念出的是新条;旧条移除不发声。
    const host = FILES.find((f) => f.path === "components/common/ToastHost.vue");
    expect(host?.src, "toast 容器要挂 aria-live=polite").toContain('aria-live="polite"');
  });

  it("同日多 toast 各有其声 —— 稀有转世不被末尾 info 顶掉音画", () => {
    // 转世落地是同一帧连 push:rare(睁眼)·rare(宿慧)·info(识得灵材)。
    // 若 toast 音效只盯「最后一条」,Vue 批处理后只对末条 info 发声 —— 转世那下
    // 金光与稀有音效被静态吃掉(玩家守着屏幕重活一世,却只见一条普通提示)。
    // 改盯「新增了哪些」:id 单调递增,凡超过已播最大 id 的新条各有其类型声。
    const host = FILES.find((f) => f.path === "components/common/ToastHost.vue");
    const w = host?.src.match(/let lastAnnouncedId[\s\S]{0,320}/)?.[0] ?? "";
    expect(host?.src, "要记录已播过的最大 toast id").toContain("let lastAnnouncedId");
    expect(w, "要遍历所有超过已播 id 的新 toast,不许只取末条").toMatch(
      /for \(const t of ui\.toasts\)/,
    );
    expect(w, "新条里稀有级要逐条触发金光").toMatch(/t\.kind === "rare"/);
  });

  it("在身之卦散卦要自报 —— 整块消失不许对读屏无声", () => {
    // 散卦是后台随心跳自散的:整块 v-if=currentReading 安静消失、按钮随之复活,
    // 没有 toast 可依 —— 不念一句,读屏玩家就只知道它没了。以「有无」布尔为
    // 观察对象(每秒心跳都在换新对象,watch 身份只会每秒误触发),只在真→假那
    // 一瞬开口。成卦有 toast(live 区落地即念),不重报。
    const codex = FILES.find((f) => f.path === "views/RealmCodexView.vue");
    expect(codex?.src, "散卦要用有无布尔翻转触发,不许 watch 每秒心跳换的对象").toMatch(
      /watch\(hasReading/,
    );
    expect(codex?.src, "播报区要 aria-live=polite + sr-only").toContain('aria-live="polite"');
    expect(codex?.src, "散卦要念「卦力已散」").toContain("卦力已散");
    expect(codex?.src, "成卦 toast 要附带存续时长(卦是自散的,先得知道活多久)").toContain("分自散");
  });

  it("逆天改命重掷要念出新牌 —— 灵根鉴定的中间态不许哑", () => {
    // 定格有 SpiritRootReveal 的播报,途中「逆天改命」重掷却只换画面不出声 ——
    // 同一个交互族的一半开了口、一半还哑着。rollSeq 只在成功重掷自增,以它为
    // 观察对象:每次重掷念一遍新牌。
    const create = FILES.find((f) => f.path === "views/CreateView.vue");
    expect(create?.src, "重掷结果要挂 aria-live=polite 播报区").toContain('aria-live="polite"');
    expect(create?.src, "播报区要视觉隐藏(用 Tailwind 全局 sr-only)").toContain("sr-only");
    expect(create?.src, "观察对象要是只增不减的 rollSeq").toMatch(/watch\(rollSeq/);
    expect(create?.src, "播报句要念出「重掷得」(新牌开场白)").toContain("重掷得");
  });

  it("问卦付不起就置灰+列差 —— 缺哪样、直说,不许点了才弹", () => {
    // 此前按只在「卦在身」时限灰:悟道点不足时照常可点,点下去才弹 warn toast。
    // 与进修/熔炉同款纪律:付不起的按钮当场置灰、内联写出差额(防御臂仍在 core)。
    const codex = FILES.find((f) => f.path === "views/RealmCodexView.vue");
    expect(codex?.src, "按钮要绑合成的 disabled(卦在身或不足都灰)").toMatch(
      /:disabled="askDisabled"/,
    );
    expect(codex?.src, "置灰文案要与判据同源(同一个 askShort 算出来)").toMatch(
      /askShort = computed\(/,
    );
    expect(codex?.src, "置灰时按钮要直说差几枚悟道").toContain("尚差");
  });

  it("遇事勿扰只拦弹窗,不吞稀有档宣布 —— 机缘/奇缘的名号要给", () => {
    // 勿扰路径此前 autoResolveEvent 后直接 return:机缘/奇缘被自动结清却全程无声
    // (正常路径对这两档各有「千载难逢/缘分再续」toast)。抽 announceEventTier 共用:
    // 勿扰照样 autoResolve(不给阻塞弹窗),但两档的名号照念 —— 千分之几的稀有度
    // 不吭声 = 体感归零。helper 从 core/eventTier 取档,不另写一份判据。
    const explore = readFileSync(resolve(__dirname, "../core/exploration.ts"), "utf-8");
    expect(explore, "要抽出共用的 announceEventTier helper").toContain(
      "function announceEventTier",
    );
    expect(
      explore.match(/announceEventTier\(ev\)/g)?.length ?? 0,
      "勿扰与正常两条路径都要念档名(helper 至少两处调用)",
    ).toBeGreaterThanOrEqual(2);
    expect(explore, "勿扰仍走 autoResolveEvent(不弹阻塞弹窗)").toContain(
      "autoResolveEvent(ev.id, region.tier)",
    );
    expect(explore, "helper 要从 eventTier 取档,不另写判据").toContain(
      "eventTierDef(eventTierOf(ev.id))",
    );
  });

  it("显式主题首帧定格 —— 暗色玩家冷启动不许闪一帧亮白", () => {
    // boot 内联色块此前只见系统偏好:亲手选了「夜间」而系统是亮色的玩家,冷启动
    // 首帧仍闪亮白(存档分片加密首帧读不到;主题偏好非敏感,单独落一枚不加密小键)。
    // 机制三端缺一即红:theme.ts 写/删键 + index.html 内联脚本绘制前读键定
    // data-theme + boot 样式按 data-theme 给显式暗/亮。
    const theme = readFileSync(resolve(__dirname, "../core/theme.ts"), "utf-8");
    expect(theme, "applyTheme 要把显式选择写成首帧小键").toContain(
      "setItem(BOOT_THEME_KEY, theme)",
    );
    expect(theme, "auto 不写(首帧按系统偏好走)").toContain("removeItem(BOOT_THEME_KEY)");
    const html = readFileSync(resolve(__dirname, "../../index.html"), "utf-8");
    expect(html, "首帧要在绘制前读小键定 data-theme").toContain(
      "document.documentElement.dataset.theme = _bt",
    );
    expect(html, "boot 样式要按 data-theme 给显式暗/亮").toContain('html[data-theme="dark"] #app');
  });

  it("道号与名号各归其位 —— 玩家的道名只叫道号,称号系统才叫名号", () => {
    // 一词多义互串过:玩家道名(DaoHao 常量/创角「道 号」)被转世弹窗叫「名号」、
    // 构筑名也叫「名号」,而「名号」本是称号系统(TitlesView 三十顶)的正名。
    // 统一:道名一律「道号」,称号页保留「名号」,构筑名用「名字」。
    const reinc = readFileSync(
      resolve(__dirname, "../components/character/ReincarnationDialog.vue"),
      "utf-8",
    );
    expect(reinc, "道名要叫「道号」").toContain("新一世的道号");
    expect(reinc, "不许把道名叫成「名号」").not.toContain("新一世的名号");
    expect(reinc, "转世天赋要统一叫「先天之姿」(核心规范名)").toContain("另有先天之姿自开");
    expect(reinc, "不许冒出孤例「天资」").not.toContain("另有天资自开");
    const build = readFileSync(resolve(__dirname, "../views/BuildView.vue"), "utf-8");
    expect(build, "构筑名不用「名号」消歧").not.toContain("起个名号");
    const cult = readFileSync(resolve(__dirname, "../views/CultivationView.vue"), "utf-8");
    expect(cult, "聚气丹按钮两态要同念「石」(380 缩放纪律)").not.toContain("灵石 +{{");
  });

  it("资源叫法全库一贯 —— 散文全称、紧凑按钮/尚差简称,不许同面板混排", () => {
    // 资源名术语族收口:读数散文/名称位=全称(灵石/悟道点/器灵尘/玄铁/功法残页),
    // 紧凑按钮与「尚差」行=已注释简称(石/铁)。曾裂：灵草坊价目灵石+尚差灵石
    // (破全球「尚差 X 石」)、进修按钮悟道 vs 顶部悟道点、建筑卡 50 铁 vs 玄铁 N 块、
    // 装备重铸 尘×N vs 强化 器灵尘×N(同 toast 前后脚)。
    // 灵草坊弹窗拆出后判据随本体走(components/inventory/HerbShopDialog.vue)。
    const shop = FILES.find((f) => f.path === "components/inventory/HerbShopDialog.vue");
    expect(shop?.src, "灵草坊尚差要跟全球「尚差 N 石」口风").toMatch(
      /尚差 \{\{ formatGN\(row\.short\) \}\} 石/,
    );
    expect(shop?.src, "灵草坊价目行要全称「灵石」").toContain(
      "单价 {{ formatGN(row.price) }} 灵石",
    );
    const gongfa = FILES.find((f) => f.path === "components/cultivation/GongfaDialog.vue");
    expect(gongfa?.src, "进修按钮与横幅都要全称「悟道点」").toContain(
      "悟道点 · {{ upCost.page }} 残页",
    );
    const equip = FILES.find((f) => f.path === "components/equipment/EquipReforgePanel.vue");
    expect(equip?.src, "重铸行要用全称「器灵尘」").toContain("器灵尘×{{ reforgeCostVal.dust }}");
    expect(equip?.src, "不许重铸再退回裸「尘×」").toContain("花 器灵尘×");
    const service = readFileSync(resolve(__dirname, "../core/buildingService.ts"), "utf-8");
    expect(service, "建筑尚差两臂同用简称「铁」").toContain("} 铁`");
    expect(service, "不许尚差里又冒回「玄铁 N 块」").not.toMatch(/玄铁 `|玄铁 \$\{/);
    const cel = FILES.find((f) => f.path === "components/celestial/TutorialDialog.vue");
    expect(cel?.src, "真仙导览散文要用全称「功法残页」").toContain("功法残页、灵石");
    // 散文 toast 里的读数同样全称 —— 连胜赏赐与历练回执都曾写「悟道 N」,
    // 与 d7783ee 收口的「混排零容忍」同类(同 toast 里灵石=N、悟道=N 直接展示裂痕)
    const early = readFileSync(resolve(__dirname, "../core/earlyGameService.ts"), "utf-8");
    expect(early, "连胜赏赐散文 toast 要全称「悟道点」").toContain("· 悟道点 ${reward.wudao}");
    expect(early, "连胜 toast 不许再写裸「悟道 N」").not.toContain("悟道 ${reward.wudao}");
    const explore = readFileSync(resolve(__dirname, "../core/exploration.ts"), "utf-8");
    expect(explore, "历练回执散文要全称「悟道点」").toContain("、悟道点 ${s.wudaoGain}");
    expect(explore, "历练回执不许写裸「、悟道 N」").not.toContain("、悟道 ${s.wudaoGain}");
  });

  it("五路天机一视同仁 —— 立约/试炼/变数/今题不受远征在途拦,只有真远征受", () => {
    // 远征(worldRun)是唯一真正「在途」的活动:启程两键按 run !== null 置灰
    // 「远征在途」。立约(天道挑战书)本是象试炼/变数/今题一样的即时单场——
    // undertakeChallenge 只跑一场抛报告,不碰 worldRun,却独独挂了 run 锁,
    // 与另三路同形按钮完全相反:远征正跑时立约被静默置灰、而试炼/变数/今题
    // 依旧可点,玩家看不出凭什么。四路都是即时单场,统一都不受远征在途拦。
    // 远征域拆出后:守 run 的两键随本体走 ExpeditionPanel
    const exped = FILES.find((f) => f.path === "components/celestial/ExpeditionPanel.vue");
    expect(exped?.src, "启程/破界两键仍要守 run(它们是真远征)").toMatch(/:disabled="run !== null/);
    // 立约钮随试炼域在 TrialPanel,负断言随本体走
    const cel = FILES.find((f) => f.path === "components/celestial/TrialPanel.vue");
    expect(cel?.src, "立约不许再挂 run 锁 —— 与试炼/变数/今题同族即时单场").not.toMatch(
      /!\s*challengeVerdict\?\.ok \|\| run !== null/,
    );
  });

  it("按下要有回声 —— chip-ink 基类自带按压反馈,裸按钮不许全无声", () => {
    // 全库最常见的微动作按钮是 chip-ink(服丹/闭关/灵脉/设置 chips),此前只有
    // btn-seal/btn-ghost 两个基类自带 :active —— chips 按下零反馈。补基类规则
    // (轻缩+淡染,disabled 不触发),再扫一圈裸按钮逐一补 active:opacity/scale。
    const css = readFileSync(resolve(__dirname, "../style.css"), "utf-8");
    expect(
      css,
      "chip-ink 基类要有 :active 按压反馈(限 button —— 装饰性 chip 是 span,不该有按压态)",
    ).toMatch(/button\.chip-ink:active:not\(:disabled\)/);
    expect(css, "chip-ink 要带 transition(弹簧感,与 btn-ghost 同款)").toMatch(
      /\.chip-ink \{[\s\S]{0,300}transition:/,
    );
    // 拆分后逆旅契试炼卡归 RebirthDialog,判据随本体改指子面板
    const char = FILES.find((f) => f.path === "components/character/RebirthDialog.vue");
    expect(char?.src, "卡状可点元素(试炼卡)也要带按压反馈").toContain("active:scale-99");
  });

  it("踏入仙途要有到首页的读屏起手句 —— 鉴定播报不随路由跳转断档", () => {
    // 灵根鉴定定格播报(aria-live polite)定格后 400ms 就随 router.push('/') 卸载,
    // 读屏可能当场切断;而首页此前全无 aria-live。CreateView 跳转前把起手句交给
    // ui store(worldEnter),首页挂载时用自家 aria-live 补念,读完即清 ——
    // 只在创角→首页这一趟念,日常回首页不重复。
    const create = FILES.find((f) => f.path === "views/CreateView.vue");
    expect(create?.src, "跳转前要把起手句交给 ui store").toContain("ui.worldEnter =");
    const home = FILES.find((f) => f.path === "views/HomeView.vue");
    expect(home?.src, "首页要挂 aria-live 播报区").toContain('aria-live="polite"');
    expect(home?.src, "首页要读 ui store 的 worldEnter").toContain("ui.worldEnter");
    const ui = readFileSync(resolve(__dirname, "../stores/ui.ts"), "utf-8");
    expect(ui, "ui store 要有一枚一次性交接旗").toContain("worldEnter");
  });

  it("人物子页返回控件齐 —— 兄弟页有「← 人物」,这四个不许裸奔", () => {
    // /titles /collection /build /legacy 都是 CharacterView 的子目标,与 Dongfu/
    // RealmCodex/Souls 同类 —— 后三者都有返回行,这四个首行即 SectionTitle 无返回
    // (底栏五格兜底但不高亮它们)。按兄弟页同款补「← 人物」,不许再裸。
    for (const f of ["TitlesView", "CollectionView", "BuildView", "LegacyView"]) {
      const src = FILES.find((x) => x.path === `views/${f}.vue`)?.src ?? "";
      expect(src, `${f} 要有回人物的返回行`).toContain('to="/character"');
      expect(src, `${f} 返回行要写「← 人物」`).toContain("← 人物");
    }
  });

  it("同物一名回潮就红 —— 名号/气血/灵根念白的用户面命名不许分叉", () => {
    // 跨屏审计抓到的四处「同一物两处念法」,统一起见一律以画面旧有者为准:
    // ① 可佩戴荣誉:荣誉页/人物页都叫「名号」,奖励 toast 与达成赏不许再叫「称号」;
    // ② 最大生命值:人物页/战斗叫「气血」,装备详情与图鉴不许再叫「生命」(上限亦然);
    // ③ 灵根念白:gradeName 已以「灵根」结尾,重掷播报句尾不许再缀一个「灵根」。
    // 故障注入:任一改回别名(称号/生命/句尾灵根) → 红。
    const progress = readFileSync(resolve(__dirname, "../core/progress.ts"), "utf-8");
    expect(progress, "成就赏与 toast 要写字面「名号」").toContain("名号「");
    expect(progress, "赏赐 toast 要念「获得名号」").toContain("获得名号「");
    const char = FILES.find((f) => f.path === "views/CharacterView.vue");
    expect(char?.src, "人物页无称号时的占位要写「未佩名号」").toContain("未佩名号");
    const itemText = readFileSync(resolve(__dirname, "../ui/itemText.ts"), "utf-8");
    expect(itemText, "装备/图鉴的属性平铺 maxHp 要写「气血」").toContain('maxHp: "气血"');
    const statNames = readFileSync(resolve(__dirname, "../data/statNames.ts"), "utf-8");
    expect(statNames, "气血上限与气血同一族 —— maxHpPct 不许单独留在「生命上限」").toContain(
      'maxHpPct: "气血上限"',
    );
    const equip = FILES.find((f) => f.path === "components/equipment/EquipmentDetailDialog.vue");
    expect(equip?.src, "装备详情的三围平铺要随全票叫「气血」").toContain(
      'push("气血", r.flats.maxHp',
    );
    const cult = FILES.find((f) => f.path === "views/CultivationView.vue");
    // 拆分后劫势详情归 TribulationPanel、破境卡归 BreakthroughCard —— 气血/速度/名号
    // 叫法守卫要查全域(宿主+两块子卡),不许只查宿主(假绿,同资源叫法条全域化先例)
    const trib = FILES.find((f) => f.path === "components/cultivation/TribulationPanel.vue");
    const btc = FILES.find((f) => f.path === "components/cultivation/BreakthroughCard.vue");
    const cultDomain = [cult?.src, trib?.src, btc?.src].join("\n");
    expect(btc?.src, "破境益的散文脚注也要说「名号」,不许留「装备·称号」混排").toContain(
      "装备·名号·天时",
    );
    expect(cultDomain, "劫势单波那行也要说「最大气血」,气血一族不许残留「最大生命」").not.toContain(
      "最大生命",
    );
    expect(
      cultDomain,
      "修炼速度一族全票认 canonical(STAT_NAMES),修行速度/修为速率不许回来",
    ).not.toMatch(/修行速度|修为速率/);
    const create = FILES.find((f) => f.path === "views/CreateView.vue");
    expect(create?.src, "重掷念白要读 gradeName,不许句尾再缀「灵根」").toMatch(
      /重掷得「\$\{p\.gradeName\}」,/,
    );
    expect(create?.src, "「天灵根」灵根的口吃念法不许回来").not.toMatch(/」灵根,/);
  });

  it("减少动效要连延迟一起清零 —— 只压时长,入场还会一档一档往外跳", () => {
    // 全局 reduce-motion 规则把 animation-duration 压到 0.01ms,却不碰
    // animation-delay:stagger-in 每档挂 0.02–0.36s、WarpPortal/SpiritRootReveal
    // 还有整串 0.05–1s 的延迟 —— 时长压到零延迟还在,内容照旧分步闪现,
    // 「减少动效」减了个寂寞。系统偏好与「减少动效」设置项两条规则
    // 都必须把 delay 一并清零:动效省略 = 时长 + 延迟双双归零。
    // 故障注入:删掉任一规则的 animation-delay → 红。
    const css = readFileSync(resolve(__dirname, "../style.css"), "utf-8");
    expect(css, "清零对象要真实存在 —— 先有分步入场的多档延迟,才谈得上把它清零").toMatch(
      /\.stagger-in[\s\S]{0,400}animation-delay:/,
    );
    const delayKills = css.match(/animation-delay:\s*0s\s*!important;/g) ?? [];
    expect(delayKills, "系统偏好与「减少动效」设置项各要一处 delay 清零").toHaveLength(2);
    const durKills = css.match(/animation-duration:\s*0\.01ms\s*!important;/g) ?? [];
    expect(
      durKills,
      "reduce-motion 仍要压时长 —— 只清 delay 不清时长,就是还留着动画、只是没了次序",
    ).toHaveLength(2);
  });

  it("地界志的境律不冒充生效 —— 命数作世界名,不许说成笼罩本世", () => {
    // 世界生成的 rule(MUTATORS 里一条,如「生机凋敝」= 治疗效率 -75%)此刻并未
    // 接管历练:历练走 explorationRules 只并大道/命途规则,world.rules 仅在模拟
    // spec 里用过。旧文案「此世笼罩:生机凋敝」读起来像本世正受这条弱化压制,
    // 实为界面撒谎。改成「此世命数」作气象之名,并明说其律尚未显化于历练。
    const mw = FILES.find((f) => f.path === "views/MortalWorldView.vue");
    expect(mw?.src, "境律要作「命数」之名,不许说成笼罩").toContain("此世命数:");
    expect(mw?.src, "不许退回「此世笼罩」的生效口吻").not.toContain("此世笼罩:");
    expect(mw?.src, "要明说「其律尚未显化于历练」,免得玩家以为真被降能").toContain(
      "其律尚未显化于历练",
    );
  });
});

describe("界面分层 · 触屏的滚动与悬停只说真话", () => {
  /*
   * 这两条都是**桌面测不出来、手机上一用就现形**的毛病,故钉成源码级红线:
   *
   * ① 二级滚动区:内层列表(max-h-*)滑到底,触摸滚动的手势会顺着滚动链继续
   *    传给外层主滚动区 —— 玩家看到的是「这段列表划不动,整块页面跟着走」。
   *    桌面上没有触摸滚动,只能靠鼠标滚轮,链条从不出问题,所以一直没被发现。
   *    overscroll-behavior: contain 把内层的滚动链掐断,收口在 .scroll-pane 一处。
   *    判据:凡会成为滚动容器的,都得同时挂 scroll-pane。会成为滚动容器的写法不止
   *    一种,故这一条扫**整份源码**(模板 + 脚本 + 样式),而不是只扫 class 属性
   *    字面量 —— 从前只认 `class="…"` 里的 `overflow-[xy]-auto`,于是下面五种
   *    写法全在判据眼皮外面仍然绿,判据说得比做得多:
   *      A `:class='…overflow-y-auto'`(单引号)
   *      B `:class="常量"` + `<script>` 里写 `const 常量 = "…overflow-y-auto"`
   *      C `overflow-auto`(不带轴)
   *      D `<style>` 里的 `overflow-y: auto` 声明
   *      E 外壳 `src/App.vue` 里的内层滚动容器(从前 FILES 只收 components/ 与 views/)
   *    故障注入:摘掉任一处 scroll-pane → 红;把滚动容器换成上面任一种写法 → 也红。
   *
   * ② 裸 hover::触屏点一下之后 hover 态不散,一直黏在那儿(坊市「售丹/售料/寄卖」
   *    那排最明显,点完还亮着,像「已选中」)。这些态只该给真悬停设备 —— 用
   *    hoverable:(tailwind.config 里那条 @media (hover:hover) and (pointer:fine)
   *    变体)把 hover: 包起来,触屏上它根本不生成。
   *    判据:不许出现未经 hoverable: 守卫的裸 hover:,也不许出现会黏住的纯 CSS
   *    :hover 规则。从前只扫 components/ 与 views/ 的 .vue,于是三种写法一样看不见:
   *      F 类名常量写在 `.ts` 里,组件只写 `:class="常量"`
   *      G 外壳 `src/App.vue` 上直接挂 `hover:…`
   *      H `src/style.css` 里手写 `.x:hover { … }`(绕过 hoverable: 变体)
   *    故扫描面扩到:全部 .vue(含 App.vue)、src 下 .ts 的字符串字面量、
   *    style.css 的 :hover 规则(@media (hover: hover) 块内合法,不算)。
   *    故障注入:把任一处 hoverable:hover: 改回 hover: → 红;换成 F/G/H → 也红。
   */

  /** 注释抹成等长空白:偏移与行号都不动,报 offender 时能直接指到源码那一行 */
  function blankComments(text: string): string {
    return text
      .replace(/<!--[\s\S]*?-->/g, (m) => m.replace(/[^\n]/g, " "))
      .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
      .replace(/^\s*\/\/.*$/gm, (m) => m.replace(/[^\n]/g, " "));
  }

  const lineAt = (src: string, idx: number): number => src.slice(0, idx).split("\n").length;

  /** 该处所在的整条标签:`路径:行号 + <div class=…` 够人一眼找到地方了 */
  function tagAt(src: string, idx: number): string {
    const lt = src.lastIndexOf("<", idx);
    if (lt < 0) return "";
    const gt = src.indexOf(">", idx);
    return src
      .slice(lt, gt < 0 ? idx + 1 : gt + 1)
      .replace(/\s+/g, " ")
      .slice(0, 90);
  }

  /** class / :class 属性值的字符区间 —— 「这条容器挂没挂 scroll-pane」只能在同一个属性里看 */
  function classValueSpans(src: string): { start: number; text: string }[] {
    const spans: { start: number; text: string }[] = [];
    for (const m of src.matchAll(/(?<![\w-])(:?class)\s*=\s*(["'])([\s\S]*?)\2/g)) {
      const value = m[3] ?? "";
      spans.push({ start: m.index + m[0].length - 1 - value.length, text: value });
    }
    return spans;
  }

  /** <style> 块的字符区间:只有落在里面的才算 CSS 声明(模板里的类名不算) */
  function styleSpans(src: string): { start: number; end: number }[] {
    const spans: { start: number; end: number }[] = [];
    for (const m of src.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)) {
      const start = m.index + m[0].indexOf(">") + 1;
      spans.push({ start, end: start + (m[1] ?? "").length });
    }
    return spans;
  }

  /**
   * CSS 声明所处的选择器(就近一个 `{` 往前读到上一个 `}` / `{`)。
   * `floor` 是所在样式块的起点 —— 不夹这一刀,选择器会一路爬回 <script> 里去,
   * 报出来的是「)), ); </script> <style scoped> .qa-probe-d」这种看不懂的东西。
   */
  function cssSelectorAt(css: string, idx: number, floor = 0): string {
    const open = css.lastIndexOf("{", idx);
    if (open < floor) return "";
    const prev = Math.max(css.lastIndexOf("}", open), css.lastIndexOf("{", open - 1), floor - 1);
    return css
      .slice(prev + 1, open)
      .trim()
      .replace(/\s+/g, " ")
      .slice(0, 60);
  }

  /**
   * 写 :hover 的那条规则头(`.x:hover`)—— 选择器在自身 `{` 之前,所以这一头要往后找 `{`。
   * 用 cssSelectorAt 会指到上一条规则上,报出来的名字驴唇不对马嘴。
   */
  function cssRuleHeadAt(css: string, idx: number): string {
    const open = css.indexOf("{", idx);
    if (open < 0) return "";
    const prev = Math.max(
      css.lastIndexOf("}", idx),
      css.lastIndexOf("{", idx),
      css.lastIndexOf(";", idx),
    );
    return css
      .slice(prev + 1, open)
      .trim()
      .replace(/\s+/g, " ")
      .slice(0, 60);
  }

  /** 悬停扫描面之一:全部 .vue —— 含外壳 App.vue(它从前不在 FILES 里) */
  const SCAN_VUE = walkByExt(SRC, ".vue").map((f) => ({
    path: relative(SRC, f).replace(/\\/g, "/"),
    css: false,
    src: blankComments(readFileSync(f, "utf8")),
  }));

  /** 悬停/滚动扫描面之二:样式表(纯 CSS 的 :hover 与 overflow 声明都在这儿) */
  const SCAN_CSS = walkByExt(SRC, ".css").map((f) => ({
    path: relative(SRC, f).replace(/\\/g, "/"),
    css: true,
    src: blankComments(readFileSync(f, "utf8")),
  }));

  /**
   * 滚动收口的例外。**按处**豁免:`near` 给定时,只有所在标签含该串的那一处才免。
   * 不做整份文件豁免 —— 否则「App.vue 里再塞一个内层滚动列表」会跟着一起免掉,
   * 而 App.vue 恰恰是最容易被塞东西的那一层。
   */
  const SCROLL_WHITELIST: Record<string, { reason: string; near?: string[] }> = {
    "App.vue": {
      reason:
        'App.vue 的 <main ref="scrollHost"> 是主滚动宿主(整套界面的唯一外层),在根上收口没有意义 —— 掐它等于掐掉外层本身;此豁免只覆盖这一处',
      near: ['ref="scrollHost"'],
    },
  };

  const HOVER_WHITELIST: Record<string, string> = {
    // 目前无例外;若确有只能裸 hover: 的地方(如整体被 pointer:coarse 挡掉),
    // 在此写明「路径 → 理由」。
  };

  it("二级滚动容器都要挂 scroll-pane —— 别把滑到底的手势甩给外层", () => {
    // 会成为滚动容器的两种写法:tailwind 类名(含不带轴的 overflow-auto)与 CSS 声明
    const CLASS_FORM = /(?<![\w-])overflow-(?:[xy]-)?auto(?![\w-])/g;
    const CSS_FORM = /(?<![\w-])overflow(?:-[xy])?\s*:\s*auto(?![\w-])/g;

    const offenders: string[] = [];
    const panned: string[] = [];
    const exempt: string[] = [];

    for (const f of [...SCAN_VUE, ...SCAN_CSS]) {
      const src = f.src;
      // .css 整份都是 CSS;.vue 只有 <style> 块内才算声明
      const spans: { start: number; text: string }[] = f.css ? [] : classValueSpans(src);
      const styles: { start: number; end: number }[] = f.css
        ? [{ start: 0, end: src.length }]
        : styleSpans(src);
      const rule = SCROLL_WHITELIST[f.path];

      const judge = (idx: number, hit: string): void => {
        const tag = tagAt(src, idx);
        const where = `${f.path}:${lineAt(src, idx)}`;
        if (rule && (!rule.near?.length || rule.near.some((n) => tag.includes(n)))) {
          exempt.push(where);
          return;
        }
        // ① 类名:同一个 class 属性里出现 scroll-pane 才算收口
        const span = spans.find((s) => idx >= s.start && idx < s.start + s.text.length);
        if (span) {
          if (/\bscroll-pane\b/.test(span.text)) panned.push(where);
          else offenders.push(`${where}  ${tag}  →  ${hit}(同一个 class 里找不到 scroll-pane)`);
          return;
        }
        // ② CSS 声明:选择器本身得是 .scroll-pane
        const style = styles.find((s) => idx >= s.start && idx < s.end);
        if (style) {
          const selector = cssSelectorAt(src, idx, style.start);
          if (/\.scroll-pane\b/.test(selector)) panned.push(where);
          else offenders.push(`${where}  ${selector || "(style 块)"}  { ${hit} }`);
          return;
        }
        // ③ 其余:类名写在脚本常量 / 动态表达式里,看它周边有没有一道 scroll-pane 跟着
        const near = src.slice(Math.max(0, idx - 240), idx + 240);
        if (/\bscroll-pane\b/.test(near)) panned.push(where);
        else offenders.push(`${where}  ${tag || "(脚本里的字符串)"}  →  ${hit}`);
      };

      for (const m of src.matchAll(CLASS_FORM)) judge(m.index, m[0]);
      for (const m of src.matchAll(CSS_FORM)) judge(m.index, m[0]);
    }

    console.log(
      `\n二级滚动区收口(scroll-pane):${panned.length} 处${
        offenders.length ? `,漏了 ${offenders.length} 处` : ""
      }${exempt.length ? `(外壳主滚动宿主 ${exempt.length} 处按白名单豁免)` : ""}`,
    );
    expect(
      SCAN_VUE.length,
      "扫描面里连外壳算上应有 50+ 个 .vue —— 少成这样就说明文件压根没扫到",
    ).toBeGreaterThanOrEqual(50);
    expect(
      panned.length,
      "收口后二级滚动区不该只剩个位数 —— 数量对不上说明判据没真扫到容器",
    ).toBeGreaterThanOrEqual(13);
    expect(
      offenders,
      "这些滚动容器没挂 scroll-pane —— 内层滑到底会把整块外层一起拖走;补上类名,或写明为何它不该收口",
    ).toEqual([]);
  });

  /**
   * 纯 CSS 的 :hover 在触屏上一样黏,而且完全绕过 tailwind 的 hoverable: 变体 ——
   * `@media (hover: hover)` 块里的合法(只在真悬停设备生效),先整块抹成空白再找。
   */
  function blankHoverMediaBlocks(css: string): string {
    let text = css;
    for (let round = 0; round < 50; round += 1) {
      const m = /@media[^{;]*\(\s*hover\s*:\s*hover\s*\)[^{;]*\{/i.exec(text);
      if (!m) break;
      const open = m.index + m[0].length - 1;
      let depth = 0;
      let end = -1;
      for (let i = open; i < text.length; i += 1) {
        if (text[i] === "{") depth += 1;
        else if (text[i] === "}") {
          depth -= 1;
          if (depth === 0) {
            end = i;
            break;
          }
        }
      }
      if (end < 0) break;
      const blank = text.slice(m.index, end + 1).replace(/[^\n]/g, " ");
      text = text.slice(0, m.index) + blank + text.slice(end + 1);
    }
    return text;
  }

  it("hover: 只给真悬停设备 —— 触屏点一下别把 hover 态黏住", () => {
    const offenders: string[] = [];
    let scanned = 0;

    const judgeHover = (path: string, src: string, idx: number, withTag = true): void => {
      scanned += 1;
      // 紧邻的九个字符若正是 "hoverable:" ,这个 hover: 已被真悬停设备守卫
      if (src.slice(idx - "hoverable:".length, idx) === "hoverable:") return;
      const tag = withTag ? tagAt(src, idx) : "";
      offenders.push(
        `${path}:${lineAt(src, idx)}  ${src
          .slice(Math.max(0, idx - 28), idx + 10)
          .replace(/\s+/g, " ")
          .trim()}${tag ? `  〔${tag}〕` : ""}`,
      );
    };

    // ① 全部 .vue:组件、视图,以及外壳 App.vue(<main> 上挂 hover: 一样会黏)
    for (const f of SCAN_VUE) {
      if (HOVER_WHITELIST[f.path]) continue;
      for (const m of f.src.matchAll(/hover:/g)) judgeHover(f.path, f.src, m.index);
    }

    // ② src 下 .ts 的字符串字面量:类名常量常驻在那儿,组件只写 :class="常量"。
    //    .spec.ts 不收 —— 审计用例本身要引用被禁写法的原文(这份文件里就有),
    //    它不上屏,也不该算进产品代码的悬停面。
    for (const file of walkByExt(SRC, ".ts").filter((p) => !p.endsWith(".spec.ts"))) {
      const path = relative(SRC, file).replace(/\\/g, "/");
      if (HOVER_WHITELIST[path]) continue;
      const src = blankComments(readFileSync(file, "utf8"));
      for (const lit of src.matchAll(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`/g)) {
        for (const m of lit[0].matchAll(/hover:/g)) {
          // .ts 里没有标签可指,别拿泛型 `<T>` 当标签糊人脸上
          judgeHover(path, src, lit.index + m.index, false);
        }
      }
    }

    // ③ 样式表里手写的 :hover —— 连 hoverable: 变体的挡板都绕过了
    for (const f of SCAN_CSS) {
      if (HOVER_WHITELIST[f.path]) continue;
      const css = blankHoverMediaBlocks(f.src);
      for (const m of css.matchAll(/:hover/g)) {
        scanned += 1;
        offenders.push(
          `${f.path}:${lineAt(css, m.index)}  ${cssRuleHeadAt(css, m.index)} —— 纯 CSS 的 :hover 触屏上照样黏`,
        );
      }
    }

    console.log(
      `\nhover: 收口(hoverable:):扫到 ${scanned} 处悬停声明,${
        offenders.length ? `漏了 ${offenders.length} 处` : "全部合规"
      }`,
    );
    expect(
      scanned,
      "全库悬停声明只剩这么几处 —— 要么判据没真扫到,要么悬停反馈被整体删了(9 处 hoverable:hover: 是下限)",
    ).toBeGreaterThanOrEqual(9);
    expect(
      offenders,
      "这些裸 hover: 触屏上会黏住 —— 改用 hoverable:hover:(真悬停设备才生效),或写明为何它该保留",
    ).toEqual([]);
  });
});

describe("修炼页 · 字号收六档", () => {
  /*
   * 修炼页深化定下的字阶:匾额 30,印记/大读数 16·15,卡名与条目名 14,
   * 正文与数据行 11,脚注 10 —— 中间不许再长出 13/12/9 这类"只差一丁点"的私档:
   * 相邻两档差 1px 时,读者分不出谁大谁小,层次就塌了。
   * 三弹窗(状态 / 顿悟 / 突破结果)同族:庆功题字 16,名字 14,正文 11,小签 10。
   */
  const SIZES = /text-\[(\d+)px\]/g;
  const usedSizes = (src: string): number[] =>
    [...src.matchAll(SIZES)].map((m) => Number(m[1] ?? 0));

  it("修炼域只用六档:30 / 16 / 15 / 14 / 11 / 10 —— 宿主与全域子面板一体", () => {
    // 拆分轮备案的盲区收口:这条判据此前只扫宿主 CultivationView,GongfaSection/
    // TribulationPanel/RetreatCard/RealmLadder 与 GongfaDialog 都不在扫描面里 ——
    // 盲区 = 后续往子面板塞私档字号判据看不见(同资源叫法条的反断言全域化先例:
    // 反断言只查宿主 = 假绿)。实测收口时抓到两处:GongfaDialog 长着 12/13 私档
    // (且它一直没进下面的弹窗同族名单),RealmLadder 有一枚 9px(低于可读下限)。
    const PAGE_TIERS = [30, 16, 15, 14, 11, 10];
    const domain = [
      "views/CultivationView.vue",
      ...FILES.filter((f) => f.path.startsWith("components/cultivation/")).map((f) => f.path),
    ];
    let total = 0;
    for (const path of domain) {
      const sizes = usedSizes(FILES.find((f) => f.path === path)?.src ?? "");
      total += sizes.length;
      const off = [...new Set(sizes)].filter((n) => !PAGE_TIERS.includes(n));
      expect(off, `${path} 冒出了六档以外的字号:${off.join(", ")}`).toEqual([]);
    }
    // 防"空转":域里真在写字号,不是把字全删了换一张绿
    expect(total).toBeGreaterThanOrEqual(20);
  });

  it("弹窗同族刻度:16 / 14 / 11 / 10", () => {
    const DIALOG_TIERS = [16, 14, 11, 10];
    for (const path of [
      "components/cultivation/BuffDialog.vue",
      "components/cultivation/EnlightenmentModal.vue",
      "components/cultivation/BreakthroughResultDialog.vue",
      // 功法详情弹窗自 CultivationView 拆出时带着 12/13 私档搬来,全域化实测收口归档 —— 同入此列
      "components/cultivation/GongfaDialog.vue",
      // 天界拆出的两枚弹窗同入此列(字号原样随模板搬来,不另立私档)
      "components/celestial/FurnaceDialog.vue",
      "components/celestial/TutorialDialog.vue",
    ]) {
      const dlg = FILES.find((f) => f.path === path);
      const off = [...new Set(usedSizes(dlg?.src ?? ""))].filter((n) => !DIALOG_TIERS.includes(n));
      expect(off, `${path} 冒出了同族刻度以外的字号:${off.join(", ")}`).toEqual([]);
    }
  });

  it("判据自证:认得出越档的坏样本", () => {
    const bad = usedSizes('<p class="text-[13px]">x</p><p class="text-[9px]">y</p>');
    expect(bad.filter((n) => ![30, 16, 15, 14, 11, 10].includes(n))).toEqual([13, 9]);
  });
});

describe("主巡页 · 字阶同一套", () => {
  /*
   * 修炼页定下的字阶不该只在它自己身上成立 —— 人物页与它是同一档信息密度
   * (卡名 + 读数 + 明细 + 脚注),却曾各自长着 9/12/13 三个私档:
   * 12 与 13 并排时读者分不出主次,9px 在手机上已低于可读下限。
   *
   * 故把「页面级字阶」立成全库判据:主巡页只许用 18/15/14/11/10
   * (修炼页另有 30 的匾额与 16 的庆功字,它是特例,单列在上面那条)。
   * 新页面进场时要么沿用这套,要么在这条判据里明写它为何是特例。
   */
  const SIZES = /text-\[(\d+)px\]/g;
  const PAGE_TIERS = [18, 15, 14, 11, 10];
  const pages = [
    "views/CharacterView.vue",
    "views/CultivationView.vue",
    "views/HomeView.vue",
    "views/DongfuView.vue",
    "views/InventoryView.vue",
    "views/RealmCodexView.vue",
    "views/CelestialView.vue",
    "views/SoulsView.vue",
    "views/AdventureView.vue",
    "views/BuildView.vue",
    "views/CollectionView.vue",
    "views/LegacyView.vue",
    "views/TitlesView.vue",
    "views/MarketView.vue",
    "views/ApprenticeView.vue",
    "views/MortalWorldView.vue",
    // 天界拆出的面板:字号原样随模板搬来,入列逐文件验,不许在组件里长私档
    "components/celestial/MarksPanel.vue",
    "components/celestial/ExpeditionPanel.vue",
    "components/celestial/TrialPanel.vue",
    "views/SettingsView.vue",
    "views/CreateView.vue",
    "views/WelcomeView.vue",
  ];

  /*
   * 每页的「非行文」字号放行位 —— 一律是印章单字、字符图标或唯一主读数,
   * 度量的是字面框而不是行文节奏,故不进字阶。每一条都写明它是什么:
   * 不写清理由的放行,等于给下一处私档开后门。
   */
  const NON_TEXT_ALLOW: Record<string, { sizes: number[]; why: string }> = {
    "views/CultivationView.vue": { sizes: [30, 16], why: "30 匾额 · 16 庆功字" },
    "views/HomeView.vue": { sizes: [17], why: "☯ 与印面字符" },
    "views/InventoryView.vue": { sizes: [19], why: "格里的数量角标" },
    "views/RealmCodexView.vue": { sizes: [16], why: "在身之卦那格的卦名" },
    "views/CelestialView.vue": { sizes: [22, 20, 19, 17, 16], why: "匾额 · 印章单字 · 道源主读数" },
    "views/SoulsView.vue": { sizes: [24, 22, 19], why: "器魂匾额 · 神魂印章单字" },
    "views/BuildView.vue": { sizes: [22, 16], why: "流派印面 · 评级大字" },
    "views/MortalWorldView.vue": { sizes: [19], why: "凡尘印面" },
    /*
     * 首屏两页的题字与印面是「这一作的门面」,它们的尺寸不属于页面字阶 ——
     * 字阶管的是「读」的层次,而 40~56 的题字与印章是「认」的图形。
     */
    "views/CreateView.vue": {
      sizes: [42, 26, 18, 16],
      why: "题字 · 灵根圆环里的字 · 修行倍率主读数 · 「踏入仙途」主钮",
    },
    "views/WelcomeView.vue": { sizes: [46, 40, 17], why: "印面「道」· 题字 · 主钮" },
  };

  for (const path of pages) {
    it(`${path} 不冒出页面字阶以外的私档`, () => {
      const view = FILES.find((f) => f.path === path);
      const src = view?.src ?? "";
      const extra = NON_TEXT_ALLOW[path];
      const allow = extra ? [...PAGE_TIERS, ...extra.sizes] : PAGE_TIERS;
      const off = [...new Set([...src.matchAll(SIZES)].map((m) => Number(m[1] ?? 0)))].filter(
        (n) => !allow.includes(n),
      );
      expect(
        off,
        `${path} 冒出了页面字阶以外的字号:${off.join(", ")}${
          extra ? `(本页已放行:${extra.why})` : ""
        }`,
      ).toEqual([]);
      // 防空转:这页真在写字号,不是被整页清空换了一张绿
      expect([...src.matchAll(SIZES)].length).toBeGreaterThanOrEqual(5);
    });
  }

  it("判据自证:人物页曾有的 9 / 12 / 13 会被拦下", () => {
    const bad = [9, 12, 13, 18];
    expect(bad.filter((n) => !PAGE_TIERS.includes(n))).toEqual([9, 12, 13]);
  });
});

describe("可点元素 · 焦点环不许被过渡吃掉", () => {
  /*
   * 由来:`transition-all` 会把 outline 也算进过渡。键盘 Tab 落到某个按钮上的那一瞬,
   * outline 正从 none 往 2px 过渡 —— 自检在那一刻量到的是 0 宽,于是报「看不见焦点」。
   *
   * 这个毛病此前被当成「偶发不稳定」放过两回(同一批顿悟选项按钮),而它其实是
   * 真实缺陷:键盘用户按下 Tab 的头一百毫秒里,确实什么都看不见。
   * 修法是把它收窄成 transition-[transform,background-color] —— 按压动画不变,
   * 焦点轮廓立刻出现。
   */
  it("可点元素不许用 transition-all(它会连焦点轮廓一起过渡)", () => {
    const bad: string[] = [];
    for (const f of FILES) {
      if (f.src.includes("transition-all")) bad.push(f.path);
    }
    expect(
      bad,
      `这些文件用了 transition-all —— 改用 transition-[transform,background-color] 或 transition-colors:${bad.join(", ")}`,
    ).toEqual([]);
  });

  it("判据自证:transition-all 会被认出来", () => {
    expect('class="transition-all active:scale-98"'.includes("transition-all")).toBe(true);
    expect("transition-[transform,background-color]".includes("transition-all")).toBe(false);
  });
});

describe("排版角色 —— 有名字的才叫系统", () => {
  /*
   * 配色有一整套 token 与五条判据;排版此前只有一句「竖版阅读节奏」。
   * 于是同一个角色被手写了上百遍:正文 `text-[11px] leading-relaxed text-ink-*`
   * 逐字重复 97 次,卡名四种字距并存。
   *
   * 这些不是随手写的 —— 它们是真实角色,只是没有名字。没有名字的角色
   * 每写一张新卡就要凭印象抄一遍,抄歪了也没人发现(字号档位那轮
   * 9/12/13 私档正是这么长出来的)。
   *
   * 判据守两件事:
   *   一 角色类在 style.css 里确实定义着(不许删了定义只留引用);
   *   二 正文那三连组合不许再手写回来 —— 用 .t-body。
   */
  const STYLE = readFileSync(resolve(__dirname, "../style.css"), "utf-8");

  it("五个排版角色都在 style.css 里有定义", () => {
    for (const role of ["t-card", "t-entry", "t-item", "t-body", "t-note"]) {
      expect(STYLE, `缺排版角色 .${role}`).toMatch(new RegExp(`\\.${role} \\{`));
    }
  });

  it("角色只管字号/字距/行高/字重,不管颜色以外的装饰", () => {
    // .t-body / .t-note 是纯度量:带颜色就等于把「正文」与某个墨档绑死,
    // 而正文有两档墨(faint / soft),由调用处按语境挑。
    const bodyBlock = /\.t-body \{([\s\S]*?)\}/.exec(STYLE)?.[1] ?? "";
    expect(bodyBlock, ".t-body 不该写死颜色").not.toMatch(/color:/);
    expect(bodyBlock, ".t-body 该是 11px").toMatch(/font-size: 11px/);
  });

  it("正文三连不许手写回来 —— 用 .t-body", () => {
    const offenders: string[] = [];
    for (const f of FILES) {
      // 同一 class 里同时出现这三样的,就是「正文」那个角色
      for (const m of f.src.matchAll(/class="([^"]*)"/g)) {
        const toks = (m[1] ?? "").split(/\s+/);
        if (
          toks.includes("text-[11px]") &&
          toks.includes("leading-relaxed") &&
          (toks.includes("text-ink-faint") || toks.includes("text-ink-soft"))
        ) {
          offenders.push(f.path);
          break;
        }
      }
    }
    expect(
      offenders,
      `这些文件把正文写回了三连 —— 改用 .t-body + 墨档:${offenders.join(", ")}`,
    ).toEqual([]);
  });
});

describe("人物页 · 可点行要说出自己是可点的", () => {
  /*
   * 道躯那张卡里有十来行小字(修炼速度 +110.5% / 暴击率 +16% ……),每行都能点开
   * 看「这个数从哪来」。可它此前**一点可点的样子都没有**:没有箭头、没有选中态,
   * 底下只挂一句「点一行看它从哪来」当唯一的线索 —— 而那句话在展开之后还赖着不走。
   *
   * 判据守三件事,每一件都是这次真改掉的东西:
   *   一 可点行带展开指示(›,选中时转 90° 并转朱砂);
   *   二 选中行有底色(否则展开一块正文,看不出点的是哪一行);
   *   三 那行提示只在**没展开**时出现(展开了,下面那块牌子本身就是答案)。
   */
  const char = (): string => FILES.find((f) => f.path === "views/CharacterView.vue")?.src ?? "";

  it("mod 行带展开指示,且有选中态", () => {
    const src = char();
    expect(src, "mod 行要找得到 aria-expanded(读屏也要知道它展开没)").toContain(
      ':aria-expanded="breakdownKey === row.key"',
    );
    expect(src, "选中行要染底").toContain("'bg-ink/5'");
    expect(src, "展开指示要随选中态转 90°").toContain("rotate-90");
  });

  it("「点一行看它从哪来」不该在展开后还挂着", () => {
    const src = char();
    // 提示那一行的 v-if 必须与 breakdownRows 挂钩;只写 modRows.length 就会永远显示
    const hint = /<p[^>]*v-if="([^"]*)"[^>]*>\s*点一行看它从哪来/.exec(src)?.[1] ?? "";
    expect(hint, "提示行的 v-if 要挂 !breakdownRows.length").toContain("!breakdownRows.length");
  });
});

describe("入口卡 —— 一件,不是九件", () => {
  /*
   * 人物页那九张「往里走」的卡(流派/画像/名号/师承/道侣/藏珍/修仙录/界域志/轮回)
   * 原本逐字重复同一套骨架,全库另有十几处同类写法。重复本身不可怕,
   * 可怕的是**漂移**:手抄九遍之后,某一张的 py 变 2.5、某枚图标变 15px、
   * 某张副行忘了 truncate —— 而这三样没一个会被当成 bug 报出来。
   *
   * 现在它们都走 common/NavCard.vue。这条判据只盯一件事:
   * 人物页三大入口区里不许再出现手写的入口卡骨架。
   */
  const char = (): string => FILES.find((f) => f.path === "views/CharacterView.vue")?.src ?? "";

  it("人物页的入口都走 NavCard", () => {
    const src = char();
    expect(src, "人物页要引入 NavCard").toContain('from "@/components/common/NavCard.vue"');
    // 手写骨架的特征组合:card-ink + items-center + gap-3 + px-4 py-3
    const handWritten = [
      ...src.matchAll(/class="[^"]*card-ink[^"]*items-center[^"]*gap-3[^"]*"/g),
    ].map((m) => m[0]);
    expect(
      handWritten,
      `人物页还有手写的入口卡骨架 —— 改用 <NavCard>:${handWritten.join(" | ")}`,
    ).toEqual([]);
  });

  it("NavCard 自己带齐三件:题头图 / 卡名 / 动作词", () => {
    const nav = readFileSync(resolve(__dirname, "../components/common/NavCard.vue"), "utf-8");
    // 三件的字号必须落在页面字阶上,不许各写各的
    expect(nav, "题头图 16px").toContain(':size="16"');
    expect(nav, "卡名 14px 楷体").toContain("text-[14px]");
    expect(nav, "动作词 11px").toContain("text-[11px]");
    expect(nav, "动作词要自动缀箭头").toContain("{{ action }} →");
    // 按压反馈:判据另一条要求卡状元素带 scale-99
    expect(nav, "入口卡要带按压反馈").toContain("active:scale-99");
    // 副行是注解:默认单行截断,两行要显式开
    expect(nav, "副行该 truncate").toContain("truncate");
  });
});

describe("滚动区 —— 还有下文时要说出来", () => {
  /*
   * 轮回弹窗的「转世去留一览」有三十七条,在 max-h-64 里只露出十几行。
   * 列表在最后一行被齐齐切断时,读起来就是「到此为止」—— 玩家不会去试「万一还能滚」。
   * 手机上一堆浏览器默认隐藏滚动条,所以不能指望那条滑块替你说这件事。
   *
   * 修法是 .scroll-fade:底边淡出一层。判据守两件事:
   *   一 类在 style.css 里定义着(不许删定义只留引用);
   *   二 淡出层不接鼠标/触摸(pointer-events: none),否则它会挡住最后一行。
   */
  const STYLE = readFileSync(resolve(__dirname, "../style.css"), "utf-8");

  it("scroll-fade 有定义,且不挡点击", () => {
    expect(STYLE, "缺 .scroll-fade 定义").toMatch(/\.scroll-fade \{/);
    expect(STYLE, "缺 ::after 淡出层").toMatch(/\.scroll-fade::after \{/);
    const block = /\.scroll-fade::after \{([\s\S]*?)\}/.exec(STYLE)?.[1] ?? "";
    expect(block, "淡出层必须 pointer-events: none —— 否则最后一行点不到").toMatch(
      /pointer-events:\s*none/,
    );
  });

  it("长列表自带滚动区,不靠整块面板滚", () => {
    // 面板滚的话,列表尾会被页脚按钮齐齐切掉(这正是这条判据的由来)
    // 拆分后去留一览归 RebirthDialog,判据随本体改指子面板
    const char = FILES.find((f) => f.path === "components/character/RebirthDialog.vue")?.src ?? "";
    expect(char, "去留一览要有自己的 max-h + overflow-y-auto").toMatch(/max-h-64 overflow-y-auto/);
    expect(char, "外圈要套 scroll-fade").toContain("scroll-fade");
  });
});
