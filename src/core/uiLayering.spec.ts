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
import { readStyleCss } from "@/test/readStyleCss";

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

/**
 * 阅读字阶的语义 token → 手机基准像素。
 *
 * 模板已不再写 text-[10px] 这类裸值；判据若只认像素，会在重构后「零命中全绿」。
 * 这里把 token 还原成手机基准档，既保留原有的私档检查，也防止把 text-title 写成
 * 别的字号再靠改名绕过。
 */
const TYPE_TOKEN_PX: Record<string, number> = {
  note: 10,
  body: 11,
  title: 14,
  section: 15,
  heading: 18,
};
const usedTypeSizes = (src: string): number[] => [
  ...[...src.matchAll(/text-\[(\d+)px\]/g)].map((m) => Number(m[1] ?? 0)),
  ...[...src.matchAll(/\btext-(note|body|title|section|heading)\b/g)].map(
    (m) => TYPE_TOKEN_PX[m[1] ?? ""] ?? 0,
  ),
  ...[...src.matchAll(/font-size:\s*var\(--type-(note|body|title|section|heading)\)/g)].map(
    (m) => TYPE_TOKEN_PX[m[1] ?? ""] ?? 0,
  ),
];

/*
 * 「按钮套按钮」扫描器 —— 带名字的标签栈,认两种按钮语义写法。
 *
 * 由来见 docs/design.md 第四十四条:器魂槽位整卡曾是 role=button 的 div,里面嵌着
 * 一枚真「卸下」<button>。CDP 读出的无障碍树真把它画成 button ⊃ button。ARIA 里
 * button 带 **Children Presentational: True**(WAI-ARIA 1.3 角色模型;ACT 规则
 * 307n5z 明令"presentational children 的元件不许有可聚焦内容")—— 读屏本应把里面的
 * 内容压平成一段文字,那枚内层按钮在 VoiceOver / TalkBack 上就可能根本不可达。
 * Chrome 肯把它露出来,不等于别的读屏也肯;而本作是移动端优先的放置游戏。
 *
 * 放过两类合法写法:
 *   一 <label> / <summary> 里放原生控件 —— 那是规范的关联方式,不是控件套控件;
 *   二 role=tab / checkbox / switch 这类**组合控件**里的子件 —— 扫描器的宿主只认
 *     按钮语义(button 标签与 role 含 button),组合控件本身不在射程内。
 * 闭合标签按名字回退到最近的同名开标签:Vue 模板里标签成对,不需要完整解析器。
 */
const VOID_TAGS: Record<string, true> = {
  br: true,
  img: true,
  hr: true,
  input: true,
  meta: true,
  link: true,
  source: true,
  area: true,
  col: true,
  wbr: true,
};
/** 里面的原生控件是"关联"而非"嵌套" */
const TRANSPARENT_TAGS: Record<string, true> = { label: true, summary: true };
const TAG_RE = /<(\/)?([a-zA-Z][\w-]*)((?:"[^"]*"|'[^']*'|[^>"'])*?)(\/)?>/g;

type StackCell = { tag: string; buttonish: boolean; transparent: boolean };

/** 返回"这枚按钮套在哪枚按钮里"的清单;空数组 = 这一页干净 */
function buttonNesting(src: string): string[] {
  const bad: string[] = [];
  const stack: StackCell[] = [];
  const start = src.indexOf("<template");
  if (start < 0) return bad;
  for (const m of src.slice(start).matchAll(TAG_RE)) {
    const closing = m[1] === "/";
    const tag = (m[2] ?? "").toLowerCase();
    const attrs = m[3] ?? "";
    const selfClose = m[4] === "/";
    if (closing) {
      for (let i = stack.length - 1; i >= 0; i--) {
        if (stack[i]!.tag === tag) {
          stack.length = i;
          break;
        }
      }
      continue;
    }
    const roleButton = /:?role\s*=\s*"[^"]*button|:?role\s*=\s*'[^']*button/.test(attrs);
    const buttonish = tag === "button" || roleButton;
    if (buttonish) {
      const host = stack.find((x) => x.buttonish);
      if (host) {
        const label = /aria-label=(?:"([^"]*)"|'([^']*)')/.exec(attrs);
        bad.push(
          `${tag}${roleButton ? "[role=button]" : ""} 套在 ${host.tag} 里` +
            (label?.[1] || label?.[2] ? ` «${label[1] ?? label[2]}»` : ""),
        );
      }
    }
    if (selfClose || VOID_TAGS[tag]) continue;
    if (TRANSPARENT_TAGS[tag]) {
      stack.push({ tag, buttonish: false, transparent: true });
      continue;
    }
    if (stack.some((x) => x.transparent)) continue;
    stack.push({ tag, buttonish, transparent: false });
  }
  return bad;
}

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

  it("安卓返回键与 Esc 共用一座栈 —— 别的弹窗压在上面时先关它", () => {
    /*
     * 由来:返回键从前只看自己那扇确认框。详情弹窗开着按返回 → 叠一层「暂别修行」,
     * 再按一次关掉它、第三次又叠一层 —— 弹窗永远关不掉,也退不出游戏;非根页更糟,
     * 它先把路由推回根页,全局弹窗还留在屏幕上。
     *
     * 真机返回键在无头浏览器里按不出来(Capacitor 只在原生壳里派发),故这里钉源码级
     * 契约:栈必须是共用模块、返回键要先问栈。栈内部的顺序与「不可关的层挡住返回」
     * 由 ui/modalStack.spec 钉。
     */
    const modal = FILES.find((f) => f.path === BASE_MODAL);
    expect(modal?.src, "BaseModal 要注册进共用弹窗栈").toContain("@/ui/modalStack");
    expect(modal?.src, "栈不许再退回 BaseModal 的私有数组").not.toContain("const activeModals");
    expect(modal?.src, "Esc 也走同一个出口").toContain("closeTopModal()");

    const exit = FILES.find((f) => f.path === "components/common/ExitConfirmDialog.vue");
    const src = exit?.src ?? "";
    expect(src, "返回键要问共用栈").toContain("closeTopModal");
    const closeAt = src.indexOf("closeTopModal()");
    const openAt = src.indexOf("open.value = true");
    expect(closeAt, "返回键没接共用栈").toBeGreaterThan(-1);
    expect(openAt, "没找到「开出确认框」那一行").toBeGreaterThan(-1);
    expect(closeAt, "必须先关别人的弹窗,再考虑开自己的确认框").toBeLessThan(openAt);
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
    const navSignals = readFileSync(
      resolve(__dirname, "../composables/useNavigationSignals.ts"),
      "utf-8",
    );
    expect(nav?.src, "底栏与书脊要共用同一份导航提醒").toContain("useNavigationSignals");
    expect(navSignals, "导航提醒要读同一个 breakthroughInfo()").toContain(
      "breakthroughInfo().ready",
    );
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
    const css = readStyleCss();
    expect(css, "new-pop 的帧定义被删了 —— 徽章会退回瞬显").toMatch(
      /@keyframes new-pop[\s\S]{0,200}scale:\s*0\.5/,
    );
    const tw = readFileSync(resolve(__dirname, "../../tailwind.config.js"), "utf-8");
    expect(tw).toContain(`"new-pop": "new-pop`);
  });

  it("背包先报本次新得与会动的槽位 —— 新货不许埋在旧藏之后", () => {
    /*
     * 底栏只在「有新货」时亮;开包后若仍按品阶整包排序,新得可能落到后面的批次,
     * 玩家看到徽标却找不到是哪几件。卷首要能报新得数、切到只看新得,藏品组内
     * 先新后旧;一键换装也要报出真正会动的槽,不能只写一句「换最强」。
     */
    const inv = FILES.find((f) => f.path === "views/InventoryView.vue");
    expect(inv?.src, "藏品排序要走先新后旧的唯一函数").toContain("sortInventoryForAttention(");
    expect(inv?.src, "每行把 isNew 一并交给排序与卡片").toMatch(
      /inventory\.items\.map\(\(item\) => \(\{[\s\S]{0,180}?isNew:\s*inventory\.isNewItem\(item\.uid\)/,
    );
    expect(inv?.src, "卡片的新角标读该行快照,不在模板里重查库存").toContain(':is-new="row.isNew"');
    expect(inv?.src, "新得入口要能切只看新得").toContain("data-inventory-new-toggle");
    expect(inv?.src, "藏品区要暴露当前范围给运行时门").toContain(
      ':data-inventory-scope="itemScope"',
    );
    expect(inv?.src, "卷首要报新得数").toContain(
      ':data-inventory-new-count="inventory.newItemCount"',
    );
    expect(inv?.src, "收纳与分解运行时门要直接读行囊件数").toContain(
      ':data-inventory-bag-count="inventory.bagItems.length"',
    );

    expect(inv?.src, "换装报价要读一键换装的同一份核心清单").toContain("equipUpgrades(inventory)");
    expect(inv?.src, "卷首要报会动几槽").toContain(
      ':data-inventory-upgrade-count="upgradeRows.length"',
    );
    expect(inv?.src, "每个可动槽要能直接打开候选").toContain(
      ':data-inventory-upgrade-slot="row.slot"',
    );
    expect(inv?.src, "槽位卡要标出可换").toContain(
      ':data-equip-upgrade="row.upgrade ? row.upgrade.slot : undefined"',
    );
    expect(inv?.src, "一键按钮要报会动几槽并同源置灰").toMatch(
      /:disabled="upgradeRows\.length === 0"[\s\S]{0,420}?换上 \$\{upgradeRows\.length\} 槽最强/,
    );
    expect(inv?.src, "空槽或无候选时不许谎称九槽已是最强").not.toContain("九槽已是最强");
    expect(inv?.src, "无事可换时要把真实状态说清楚").toContain("已无可换之器");
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

  it("秒级倒计时的每一处都挂了心跳 —— 定宽槽不许配一枚 5 秒的钟", () => {
    // 定宽槽(.countdown-slot)存在的理由是「秒针顺走且行宽不变」:格式对、心跳错,
    // 秒针照样会 5 秒跳 5 格。前一版把闭关/状态/问卦三处从 totalPlaySec(引擎只在
    // ACTIVE_STAMP_MS=5s 才 addPlayTime)换到 useGameNow,却漏了破境卡里的「调息中 ·
    // 03分00秒」—— 那枚槽挂在 btInfo(只随 totalPlaySec 变)上,盯着看就是纹丝不动。
    // 逐文件判据:凡渲染 countdown-slot 的组件,自身必须起一条 ≤1s 的心跳
    // (useNow / useGameNow / useGameClock / gameClock / 手写 setInterval 墙钟域)。
    // 只要心跳源在文件里,秒针才会走;没有的那一版当场红。
    const HEARTBEAT = /useNow\(|useGameNow\(|useGameClock\(|gameClock\(|setInterval\(/;
    const bare = FILES.filter((f) => f.src.includes("countdown-slot"))
      .filter((f) => !HEARTBEAT.test(f.src))
      .map((f) => f.path);
    expect(bare, "这些文件渲染了秒级倒计时,却没有 1s 心跳 —— 槽里的秒针不会走").toEqual([]);
  });

  it("破境卡的调息倒计时读游戏钟,不读 5 秒盖章的 totalPlaySec", () => {
    // 「调息中 · 02分59秒」是这个仓库里唯一一处没接 useGameNow 的分秒倒计时。
    // 它的读数来自 breakthroughInfo → breakthroughPrepState,而那条链只依赖
    // totalPlaySec(5 秒一涨),于是整枚胶囊 5 秒跳一次;同时「加成 +8% 就绪」与
    // 成功率瓦片也会晚 5 秒才翻 —— 两处都是同一枚坏钟。
    // 判据:卡片必须用 useGameNow,且 btInfo 的 computed 里读它(接上心跳,不是只 import)。
    const card = FILES.find((f) => f.path === "components/cultivation/BreakthroughCard.vue");
    expect(card?.src).toContain("useGameNow");
    expect(card?.src).toMatch(/const btInfo = computed\(\(\) => \{\s*void gameNowSec\.value;/);
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

  it("已习功法按门分批回看 —— 不得再把整门书册一次铺进 DOM", () => {
    // 主修终局 28 部,外层的 max-h-72 只裁视觉不裁 DOM。门内清单与换签后的窗口
    // 都要走 core/listRender;续开后的焦点按新露出的第一项落位,不能还停在旧批。
    const cult = FILES.find((f) => f.path === "components/cultivation/GongfaSection.vue");
    expect(cult?.src).toContain("const GONGFA_RENDER_BATCH = 12");
    expect(cult?.src).toContain("const GONGFA_RENDER_WINDOW = GONGFA_RENDER_BATCH * 2");
    expect(cult?.src).toContain('v-for="def in gongfaPage.visible"');
    expect(cult?.src).toContain(':data-gongfa-row="def.id"');
    expect(cult?.src).toContain("data-gongfa-more");
    expect(cult?.src).toContain("data-gongfa-prev");
    expect(cult?.src).toContain("firstNewVisibleIndex");
    expect(cult?.src).not.toMatch(/v-for="def in activeGongfaItems"/);
    expect(cult?.src).toMatch(/watch\([\s\S]{0,220}?gongfaLimit\.value = GONGFA_RENDER_BATCH/);
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

  it("部位候选再长也只铺当前窗 —— 逐批换装、回翻与换选回首批", () => {
    // 大行囊按部位摊开后仍可能把几十条候选一次塞进弹窗;换装后佩戴件又会按排序
    // 跳到顶部,若窗口还停在后面,玩家刚点的选项会从 DOM 里消失并带走焦点。
    // 候选表因此与背包/图鉴/名号共用同一套分批、滑窗、回翻与聚焦规则。
    const picker = FILES.find((f) => f.path === "components/inventory/SlotCandidatesDialog.vue");
    expect(picker?.src, "候选表要复用长列表窗口").toMatch(
      /import\s*\{[\s\S]*?listWindow[\s\S]*?\}\s*from\s*"@\/core\/listRender"/,
    );
    expect(picker?.src, "候选表按 12 件一批、最多留 24 件").toMatch(
      /SLOT_CANDIDATE_RENDER_BATCH\s*=\s*12[\s\S]{0,140}SLOT_CANDIDATE_RENDER_WINDOW\s*=\s*SLOT_CANDIDATE_RENDER_BATCH\s*\*\s*2/,
    );
    expect(picker?.src, "只循环当前窗口,不许再整表铺开").toMatch(
      /v-for="row in candidatePage\.visible"/,
    );
    for (const attr of ["total", "shown", "start"]) {
      expect(picker?.src, `候选表要暴露 ${attr} 读数给运行时门`).toContain(
        `data-slot-candidate-${attr}`,
      );
    }
    expect(picker?.src, "候选行要有稳定指纹").toContain(":data-slot-candidate=");
    expect(picker?.src, "余件要能续开").toContain("data-slot-candidate-more");
    expect(picker?.src, "滑走的批次要能回翻").toContain("data-slot-candidate-prev");
    expect(
      picker?.src.indexOf("data-slot-candidate-more"),
      "候选续开要排在当前批之后:读完再往下走,不必滚回弹窗首行",
    ).toBeGreaterThan(picker?.src.indexOf('v-for="row in candidatePage.visible"') ?? -1);
    expect(picker?.src, "续开焦点要落到新露出的第一件").toMatch(
      /firstNewVisibleIndex\(\s*shownBefore,\s*shownAfter,\s*SLOT_CANDIDATE_RENDER_WINDOW\s*\)/,
    );
    expect(picker?.src, "换部位时窗口要回到首批").toMatch(
      /watch\(\s*\(\)\s*=>\s*props\.slotName[\s\S]{0,180}candidateLimit\.value\s*=\s*SLOT_CANDIDATE_RENDER_BATCH/,
    );
    expect(picker?.src, "换装后要回首批并把焦点送到新佩戴件").toMatch(
      /candidateLimit\.value\s*=\s*SLOT_CANDIDATE_RENDER_BATCH[\s\S]{0,160}focusCandidateById\(uid\)/,
    );
    const inv = FILES.find((f) => f.path === "views/InventoryView.vue");
    expect(inv?.src, "槽位入口要有稳定落点,运行时门才能真点开候选表").toContain(
      ':data-equip-slot="row.slot"',
    );
    const perf = readFileSync(resolve(__dirname, "../../scripts/perf-profile.mjs"), "utf8");
    expect(perf, "运行时门要按稳定的候选行落点核对件数").toContain('"[data-slot-candidate]"');
    expect(perf, "运行时门要逐批点开部位候选,不能只验源码").toContain(
      "button[data-slot-candidate-more]",
    );
    expect(perf, "运行时门要核对回翻与前一批入口").toContain("button[data-slot-candidate-prev]");
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
    const css = readStyleCss();
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
    const css = readStyleCss();
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
    const css = readStyleCss();
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
    const css = readStyleCss();
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
    expect(css, "标题杆要读世界色(--world-bar),不许写死朱砂").toMatch(
      /\.folio-section-mark\s*\{[\s\S]{0,500}var\(--world-bar\)/,
    );
    expect(css).toMatch(/data-world="immortal"\][\s\S]{0,180}--world-bar/);
    expect(css).toMatch(/data-world="god"\][\s\S]{0,180}--world-bar/);
    expect(css).toMatch(/data-world="chaos"\][\s\S]{0,180}--world-bar/);
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

  it("界域志先报此刻,再把四界收成可展开的卷目", () => {
    // 从前界域册从炼气起排,已经飞升的玩家要滚过整个人间界才看见自己。
    // 现在卷首先报当前境与前后境,四界默认只开当前卷;典籍互链跳回来时也要先开目标卷。
    const codex = FILES.find((f) => f.path === "views/RealmCodexView.vue");
    expect(codex?.src, "卷首要标出当前境,运行时判据靠它找首屏").toContain("data-realm-current");
    expect(codex?.src, "当前境与前后境要从 realmCodex 纯函数派生").toContain(
      "realmCodexCurrent(player.major)",
    );
    expect(codex?.src, "四界卷目要从 REALMS / WORLDS 派生").toContain(
      "realmCodexWorldRows(player.major)",
    );
    expect(codex?.src, "卷首复用修炼页的 21 境刻度,不另画一套").toContain("<RealmLadder");
    expect(codex?.src, "世界题头必须是带 aria-expanded 的展开按钮").toContain(
      ':aria-expanded="isWorldOpen(row.world.id)"',
    );
    expect(codex?.src, "展开按钮要指向自己的卷身").toContain(
      ':aria-controls="worldBodyId(row.world.id)"',
    );
    expect(codex?.src, "初次只开当前界").toContain("realmCodexInitialWorld(player.major)");
    expect(codex?.src, "典籍互链跳回境界时要先展开目标世界,否则 scrollIntoView 找不到目标").toMatch(
      /openWorlds\.value\[worldOf\(index\)\.id\] = true/,
    );
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

  it("成就谱先给眼下可追，再把方向收成可展开卷目", () => {
    // 66 个「???」既不给条件也不给距离,玩家无法据此安排下一步。
    // 判据:进度由 achievementProgress 派生;卷首先列最近三枚;名称与条件直接露;
    // 每个方向是带 aria-expanded / aria-controls 的真按钮,默认只开最近的一组。
    const col = FILES.find((f) => f.path === "views/CollectionView.vue");
    expect(col?.src).toContain("achievementProgressRows");
    expect(col?.src).toContain("nearestAchievementRows(achievementRows.value, 3)");
    expect(col?.src).toContain("data-achievement-hero");
    expect(col?.src).toContain("data-achievement-group-toggle");
    expect(col?.src).toContain(':aria-expanded="isGroupOpen(g.direction)"');
    expect(col?.src).toContain(':aria-controls="groupBodyId(gi)"');
    expect(col?.src).toContain("revealAchievement(row)");
    expect(col?.src, "未达成者的名称要直接露出来").toContain("{{ row.def.name }}");
    expect(col?.src, "未达成者的条件要直接露出来").toContain("{{ row.def.desc }}");
    expect(col?.src, "旧的一整墙 ??? 文案已经退场").not.toContain("成时自见");
  });

  it("藏珍谱先报新得或将满，再把九册收成可展开卷目", () => {
    // 九册同时铺开时,首屏可能连续三册全是 ???,玩家既看不到整体进度,
    // 也不知道哪一册值得先翻。判据:卷首读同一份 collectionProgress 汇总,
    // 有新得先列新得、无新得列将满;册目是带 aria 的真按钮,新得册默认展开。
    const col = FILES.find((f) => f.path === "views/CollectionView.vue");
    expect(col?.src).toContain("collectionProgressOverview");
    expect(col?.src).toContain("data-collection-hero");
    expect(col?.src).toContain("data-collection-category-toggle");
    expect(col?.src).toContain(':aria-expanded="isCollectionCategoryOpen(cat.key)"');
    expect(col?.src).toContain(':aria-controls="collectionCategoryBodyId(cat.key)"');
    expect(col?.src).toContain("revealCollectionCategory(row.key)");
    expect(col?.src, "新得册与将满册要分开报").toContain("眼下新得");
    expect(col?.src, "无新得时卷首改报将满之册").toContain("将满之册");
    expect(col?.src, "三册入口压成一眼能扫完的索引").toContain(
      "grid-cols-[repeat(auto-fit,minmax(96px,1fr))]",
    );
    expect(col?.src, "超过三册的新得不能静默消失").toContain("collectionMoreNewCount");
    expect(col?.src).toContain("data-collection-more-new");
    expect(col?.src, "余册提示必须是一键收展入口,不是被动脚注").toContain(
      "toggleRemainingNewCategories",
    );
    expect(col?.src).toContain(':aria-expanded="collectionMoreNewOpen"');
    expect(col?.src, "余册全开时按钮要说能收起,不能写死成已展开").toContain("收起余册");
    expect(col?.src, "卷首已展数要随折叠状态变,不能写死成初始三册").toContain("openedNewCount");
    const layout = readFileSync(resolve(__dirname, "../../scripts/layout-check.mjs"), "utf8");
    expect(layout, "布局门要点到余册入口并核对展开结果").toContain(
      'locator("[data-collection-more-new]").click',
    );
    expect(layout).toContain("余册入口没有真正展开第四册新得");
    expect(col?.src, "册目内容按展开态渲染").toContain('v-if="isCollectionCategoryOpen(cat.key)"');
    expect(col?.src, "展开态必须给测试与读屏一个稳定落点").toContain(
      ':data-collection-category-body="cat.key"',
    );
  });

  it("人物页与藏珍页的图鉴计数同源 —— 九册装配与 stage 汇总只此一份", () => {
    // 人物页入口此前按 quests.collections 的 id 另数一遍,藏珍页按 CodexEntry.stage 汇总。
    // 两边现在碰巧一样,不代表以后一样:装备「已入目」、灵材「已辨识」、悟道「已见」
    // 都是 stage 语义,不能退回到只数收藏 id。九册装配与汇总统一收进 codex/core。
    const char = FILES.find((f) => f.path === "views/CharacterView.vue");
    const col = FILES.find((f) => f.path === "views/CollectionView.vue");
    const codex = readFileSync(resolve(__dirname, "../ui/codex.ts"), "utf8");
    expect(codex, "九册装配要住在图鉴模块").toContain("export function collectionCodex");
    expect(char?.src, "人物页读同一份九册").toContain("collectionCodex()");
    expect(char?.src, "人物页读同一份 stage 汇总").toContain(
      "collectionProgressOverviewFromCodex(",
    );
    expect(char?.src, "人物页不再自己数收藏 id").not.toContain("knownIn(");
    expect(col?.src, "藏珍页读同一份九册").toContain("collectionCodex()");
    expect(col?.src, "藏珍页的新得也从同一份汇总来").toContain(
      "collectionProgressOverviewFromCodex(",
    );
  });

  it("全收集图鉴逐册滑动翻看 —— 前后可达，点击再多也不让 DOM 无限长", () => {
    /*
     * 九册全收是 800+ 枚 chip，首帧全铺实测 1326 DOM。每册先给一批，余下由
     * 「再看 N 件」翻到下一批，可见窗口最多两批；未识的 ??? 仍守原
     * UNKNOWN_CAP。继续前翻会滑掉最早一批，并留「前一批」回看，
     * 所以全清单仍可达而 DOM 有硬顶。
     */
    const col = FILES.find((f) => f.path === "views/CollectionView.vue");
    expect(col?.src).toMatch(/listWindow\(\s*known,/);
    expect(col?.src).toMatch(/nextListLimit\([\s\S]{0,100}COLLECTION_RENDER_BATCH[\s\S]{0,40}\)/);
    expect(col?.src).toContain("COLLECTION_RENDER_WINDOW");
    expect(col?.src).toContain("previousListLimit");
    expect(col?.src).toContain("hiddenKnown");
    expect(col?.src).toContain(':data-collection-more="cat.key"');
    expect(col?.src).toContain(':data-collection-prev="cat.key"');
    expect(col?.src).toContain(
      ':data-promised="Math.min(COLLECTION_RENDER_BATCH, cat.hiddenKnown)"',
    );
    expect(col?.src).toContain(':aria-label="moreKnownLabel(cat)"');
    expect(col?.src).toContain("hiddenUnknown");
    expect(col?.src, "首批之后的「新得」不能被续开入口吞掉").toContain("hiddenNew");
    expect(col?.src, "藏着新得时，续开按钮要报出来").toContain("含新得 ${cat.hiddenNew}");
    expect(col?.src, "新得只数首批之后的那一段，不能把已展示的又数一遍").toMatch(
      /known\s*\.slice\(knownPage\.shown\)\s*\.filter\(\(entry\) => quests\.isEntryNew/,
    );
    expect(col?.src, "??? 仍只铺 UNKNOWN_CAP，不许被续开按钮带走").toContain(
      "unknown.slice(0, UNKNOWN_CAP)",
    );
    expect(col?.src, "窗口起点要让门能验证「确实滑过页」").toContain(
      ':data-collection-start="cat.knownStart"',
    );

    const knownLoop = col?.src.indexOf('v-for="entry in cat.knownVisible"') ?? -1;
    const moreButton = col?.src.indexOf('data-collection-more="cat.key"') ?? -1;
    const unknownLoop = col?.src.indexOf('v-for="entry in cat.unknownVisible"') ?? -1;
    expect(col?.src, "已收批次要先渲染").toContain('v-for="entry in cat.knownVisible"');
    expect(moreButton, "续开按钮要紧接已收批次").toBeGreaterThan(knownLoop);
    expect(unknownLoop, "未识问号要排在续开按钮之后，不能把入口压到问号墙下面").toBeGreaterThan(
      moreButton,
    );
  });

  it("长列表续开的焦点跟着新批走 —— 键盘与读屏不许被拉回旧批首件", () => {
    /*
     * 坊市与图鉴的可见窗能容纳两批。首批「再看」只追加、不滑页，若一律 focus 第一条，
     * 键盘用户点完仍停在旧内容；读屏也听不到刚展开的那一批。统一让核心函数算
     * 新露出的第一件在当前窗口里的索引，三个长列表都接同一把尺。
     */
    const market = FILES.find((f) => f.path === "views/MarketView.vue");
    expect(market?.src, "寄卖续开焦点要落到新批").toMatch(
      /const shownBefore = consignPage\.value\.shown[\s\S]{0,320}firstNewVisibleIndex\(\s*shownBefore,\s*shownAfter,\s*MARKET_RENDER_WINDOW\s*\)/,
    );
    expect(market?.src, "贡器续开焦点也要落到新批").toMatch(
      /const shownBefore = equipCandidatePage\.value\.shown[\s\S]{0,360}firstNewVisibleIndex\(\s*shownBefore,\s*shownAfter,\s*MARKET_RENDER_WINDOW\s*\)/,
    );

    const col = FILES.find((f) => f.path === "views/CollectionView.vue");
    expect(col?.src, "图鉴续开焦点要落到新批").toMatch(
      /const shownBefore = cat\.knownShown[\s\S]{0,420}firstNewVisibleIndex\(\s*shownBefore,\s*shownAfter,\s*COLLECTION_RENDER_WINDOW\s*\)/,
    );

    const inventory = FILES.find((f) => f.path === "views/InventoryView.vue");
    expect(inventory?.src, "背包也接同一把焦点尺").toMatch(
      /const shownBefore = itemPage\.value\.shown[\s\S]{0,320}firstNewVisibleIndex\(\s*shownBefore,\s*shownAfter,\s*INVENTORY_RENDER_WINDOW\s*\)/,
    );
  });

  it("长列表回翻只报真正换回的行数 —— 末页短批不许冒充整批", () => {
    /*
     * 300→288 时可见窗只换回 12 件,旧标签却按 min(32, start) 报「前一批 32 件」。
     * 回翻标签与按钮动作必须共用同一个步长真值，运行时门也要核对实际新露件数。
     */
    const inventory = FILES.find((f) => f.path === "views/InventoryView.vue");
    expect(inventory?.src, "背包回翻标签要读真实步长").toMatch(
      /previousItemsLabel[\s\S]{0,500}previousListStep\(\s*itemPage\.value\.shown,\s*visibleItems\.value\.length,\s*INVENTORY_RENDER_BATCH,?\s*\)/,
    );

    const market = FILES.find((f) => f.path === "views/MarketView.vue");
    expect(market?.src, "贡器回翻标签要读真实步长").toMatch(
      /equipCandidatePrevLabel[\s\S]{0,500}previousListStep\(\s*equipCandidatePage\.value\.shown,\s*equipCandidates\.value\.length,\s*INVENTORY_RENDER_BATCH,?\s*\)/,
    );
    expect(market?.src, "寄卖回翻标签要读真实步长").toMatch(
      /consignPrevLabel[\s\S]{0,500}previousListStep\(\s*consignPage\.value\.shown,\s*inventory\.bagItems\.length,\s*INVENTORY_RENDER_BATCH,?\s*\)/,
    );

    const col = FILES.find((f) => f.path === "views/CollectionView.vue");
    expect(col?.src, "图鉴回翻标签要读真实步长").toMatch(
      /previousKnownLabel\(cat: \{ knownShown: number; knownTotal: number \}\)[\s\S]{0,300}previousListStep\(\s*cat\.knownShown,\s*cat\.knownTotal,\s*COLLECTION_RENDER_BATCH,?\s*\)/,
    );

    const perf = readFileSync(resolve(__dirname, "../../scripts/perf-profile.mjs"), "utf-8");
    const rewindStart = perf.indexOf("async function rewindBatch(");
    const rewindEnd = perf.indexOf("/** 一直点到这一份清单的末页", rewindStart);
    expect(rewindStart, "回翻运行时门要能定位到 —— 定位不到这条就是空转").toBeGreaterThan(-1);
    expect(rewindEnd).toBeGreaterThan(rewindStart);
    const rewind = perf.slice(rewindStart, rewindEnd);
    expect(rewind, "回翻运行时门要核对承诺件数").toContain("newVisible === promised");
    expect(rewind, "门变红时要报出实际与承诺").toMatch(/回翻只新露.*承诺/);
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

  it("名号页先报下一顶 —— 来源、进度与缺口都从发放成就来", () => {
    // 名号表只有名字/描述/词条,来源在成就 reward.titleId 上。
    // 页首若只按拥有状态平铺,玩家看不到「下一顶从哪来、还差多少」。
    const tit = FILES.find((f) => f.path === "views/TitlesView.vue");
    expect(tit?.src, "名号来源要由 core 按 reward.titleId 对齐").toContain(
      "titleProgressRows(TITLES, ACHIEVEMENTS",
    );
    expect(tit?.src, "下一顶要从未拥有者里按进度选").toContain("nearestTitleProgressRows");
    expect(tit?.src).toContain("data-title-guide");
    expect(tit?.src).toContain("下一顶名号");
    expect(tit?.src, "两处都要把来源说穿").toContain("名号获自");
    const core = readFileSync(resolve(__dirname, "titleProgress.ts"), "utf8");
    expect(core, "来源不能另写一张表").toContain("reward?.titleId");
    expect(core, "可量化进度要先于纯条件").toContain(
      "Number(a.progress.target === null) - Number(b.progress.target === null)",
    );
  });

  it("名号与灵兽两册渐进铺开 —— 当前相伴置顶,余册可续开与回翻", () => {
    const tit = FILES.find((f) => f.path === "views/TitlesView.vue");
    expect(tit?.src, "两册都要复用长列表窗口,不许各自整册铺进 DOM").toMatch(
      /import\s*\{[\s\S]*?listWindow[\s\S]*?\}\s*from\s*"@\/core\/listRender"/,
    );
    expect(tit?.src, "名号册按 12 条一批、最多留 24 条").toMatch(
      /TITLE_RENDER_BATCH\s*=\s*12[\s\S]{0,120}TITLE_RENDER_WINDOW\s*=\s*TITLE_RENDER_BATCH\s*\*\s*2/,
    );
    expect(tit?.src, "灵兽册按 12 条一批、最多留 24 条").toMatch(
      /PET_RENDER_BATCH\s*=\s*12[\s\S]{0,120}PET_RENDER_WINDOW\s*=\s*PET_RENDER_BATCH\s*\*\s*2/,
    );
    expect(tit?.src, "名号只循环当前窗,不许再循环整份 titleRows").toMatch(
      /v-for="row in titlePage\.visible"/,
    );
    expect(tit?.src, "灵兽只循环当前窗,不许再循环整份 petRows").toMatch(
      /v-for="row in petPage\.visible"/,
    );
    for (const key of ["title", "pet"]) {
      for (const attr of ["total", "shown", "start"]) {
        expect(tit?.src, `${key} 册要暴露 ${attr} 读数给运行时门`).toContain(`data-${key}-${attr}`);
      }
      expect(tit?.src, `${key} 册要有逐行指纹`).toContain(`:data-${key}-row=`);
      expect(tit?.src, `${key} 册要有续开入口`).toContain(`data-${key}-more`);
      expect(tit?.src, `${key} 册要有回翻入口`).toContain(`data-${key}-prev`);
      expect(
        tit?.src.indexOf(`data-${key}-more`),
        `${key} 册的续开要排在当前批之后:读完再往下走,不必滚回册首`,
      ).toBeGreaterThan(tit?.src.indexOf(`v-for="row in ${key}Page.visible"`) ?? -1);
    }
    // 当前相伴是玩家现在的选择,必须排在已结缘者里的第一行;
    // 原实现先按品阶排,低品阶的相伴灵兽会被更高品阶的旧收藏压到后面。
    expect(tit?.src, "相伴灵兽必须早于品阶排序,不能只当同品阶的次序键").toMatch(
      /Number\(b\.active\)\s*-\s*Number\(a\.active\)[\s\S]{0,160}qualityDef\(b\.def\.quality\)\.rank/,
    );
    // 换佩/换伴会改排序:若窗口仍停在第 N 页,新选项会被排到顶部却不在 DOM 里。
    // 换选后回首批,并把焦点送到新选那一行;卸下则停在首批首行。
    expect(tit?.src, "换名号后要回首批并把焦点送到新佩项").toMatch(
      /titleLimit\.value\s*=\s*TITLE_RENDER_BATCH[\s\S]{0,120}focusListRowById\("data-title-row",\s*id\)/,
    );
    expect(tit?.src, "换灵兽后要回首批并把焦点送到新伴项").toMatch(
      /petLimit\.value\s*=\s*PET_RENDER_BATCH[\s\S]{0,120}focusListRowById\("data-pet-row",\s*id\)/,
    );
    expect(tit?.src, "灵兽行在 195 宽下要上下叠放,不能把名字挤成竖排").toContain(
      "tinylens:flex-col tinylens:items-stretch",
    );
    expect(tit?.src, "灵兽名、品阶与相伴态过窄时要换行").toMatch(
      /class="flex flex-wrap items-center gap-x-2 gap-y-0\.5"/,
    );
    expect(tit?.src, "唤来 / 暂别在触屏上至少 28px 高").toContain("btn-ghost min-h-7");
  });

  it("法宝全册渐进铺开 —— 祭炼与随身改序后焦点不许丢", () => {
    // 45 件法宝每张都是名/描述/被动/神通/代价/双按钮的密卡,整册铺开会把
    // 背包法宝页变成一场 DOM 洪峰。与其它长列表共用同一套分批、滑窗、回翻与聚焦规则。
    const panel = FILES.find((f) => f.path === "components/inventory/ArtifactPanel.vue");
    expect(panel?.src, "法宝册要复用长列表窗口").toMatch(
      /import\s*\{[\s\S]*?listWindow[\s\S]*?\}\s*from\s*"@\/core\/listRender"/,
    );
    expect(panel?.src, "法宝卡按 6 件一批、最多留 12 件").toMatch(
      /ARTIFACT_RENDER_BATCH\s*=\s*6[\s\S]{0,140}ARTIFACT_RENDER_WINDOW\s*=\s*ARTIFACT_RENDER_BATCH\s*\*\s*2/,
    );
    expect(panel?.src, "只循环当前窗口,不许再整册铺开").toMatch(
      /v-for="row in artifactPage\.visible"/,
    );
    for (const attr of ["total", "shown", "start"]) {
      expect(panel?.src, `法宝册要暴露 ${attr} 读数给运行时门`).toContain(`data-artifact-${attr}`);
    }
    expect(panel?.src, "法宝卡要有稳定指纹").toContain(":data-artifact-row=");
    expect(panel?.src, "余件要能续开").toContain("data-artifact-more");
    expect(panel?.src, "滑走的批次要能回翻").toContain("data-artifact-prev");
    expect(panel?.src, "续开焦点要落到新露出的第一件").toMatch(
      /firstNewVisibleIndex\(\s*shownBefore,\s*shownAfter,\s*ARTIFACT_RENDER_WINDOW\s*\)/,
    );
    expect(panel?.src, "随身 / 收回后焦点要跟住同一件").toContain("focusArtifactRowById(defId)");
    expect(panel?.src, "祭炼改序越过窗口后要按卡片新位置所在批次重开窗").toMatch(
      /function focusArtifactRowById[\s\S]{0,900}findIndex[\s\S]{0,400}Math\.ceil\([\s\S]{0,160}artifactLimit\.value\s*=/,
    );
    expect(panel?.src, "祭炼成功也要走同一条焦点账").toMatch(
      /function refineArtifact[\s\S]{0,160}upgradeArtifact\(defId\)[\s\S]{0,160}focusArtifactRowById\(defId\)/,
    );
    const perf = readFileSync(resolve(__dirname, "../../scripts/perf-profile.mjs"), "utf8");
    expect(perf, "运行时门要按法宝卡落点核对件数").toContain('"[data-artifact-row]"');
    expect(perf, "运行时门要逐批翻完整法宝册").toContain("button[data-artifact-more]");
    expect(perf, "运行时门要核对法宝册回翻").toContain("button[data-artifact-prev]");
    const fixture = readFileSync(
      resolve(__dirname, "../../scripts/lib/fullArtifactFixture.ts"),
      "utf8",
    );
    expect(fixture, "全册夹具必须从内容表生成,不许手抄 45 个 id").toContain("ARTIFACTS.map");
    const layout = readFileSync(resolve(__dirname, "../../scripts/layout-check.mjs"), "utf8");
    expect(layout, "195 宽要逐批翻完法宝册并复核祭炼后的焦点").toContain(
      '["法宝全册的分批回看", taskArtifactListOverflow]',
    );
  });

  it("开炉丹方渐进铺开 —— 搜索重置窗口,炼制后焦点留在原方", () => {
    // 54 张丹方每张都摊代价、成品、把握、双成、存货与两枚动作。整册塞进
    // max-h-64 只是视觉上滚动,DOM 仍会一次铺满;长列表规则必须进开炉弹窗。
    const dialog = FILES.find((f) => f.path === "components/inventory/BrewingDialog.vue");
    expect(dialog?.src, "丹方册要复用长列表窗口").toMatch(
      /import\s*\{[\s\S]*?listWindow[\s\S]*?\}\s*from\s*"@\/core\/listRender"/,
    );
    expect(dialog?.src, "丹方按 6 张一批、最多留 12 张").toMatch(
      /RECIPE_RENDER_BATCH\s*=\s*6[\s\S]{0,140}RECIPE_RENDER_WINDOW\s*=\s*RECIPE_RENDER_BATCH\s*\*\s*2/,
    );
    expect(dialog?.src, "只循环当前窗口,不许再整册铺开").toMatch(
      /v-for="r in filteredRecipePage\.visible"/,
    );
    for (const attr of ["total", "shown", "start"]) {
      expect(dialog?.src, `丹方册要暴露 ${attr} 读数给运行时门`).toContain(`data-recipe-${attr}`);
    }
    expect(dialog?.src, "丹方卡要有稳定指纹与可编程焦点").toContain(":data-recipe-row=");
    expect(dialog?.src, "余方要能续开").toContain("data-recipe-more");
    expect(dialog?.src, "滑走的批次要能回翻").toContain("data-recipe-prev");
    expect(dialog?.src, "续开焦点要落到新露出的第一张").toMatch(
      /firstNewVisibleIndex\(\s*shownBefore,\s*shownAfter,\s*RECIPE_RENDER_WINDOW\s*\)/,
    );
    expect(dialog?.src, "搜索词变化只重置窗口,不许抢走搜索框焦点").toMatch(
      /watch\(\s*recipeQuery,\s*\(\)\s*=>\s*\{\s*recipeLimit\.value\s*=\s*RECIPE_RENDER_BATCH;?\s*\}\)/,
    );
    expect(dialog?.src, "炼制与连炼后都要按同一张方的新位置补焦点").toMatch(
      /craftPill:\s*brewOne[\s\S]{0,900}function craftPill\(id: string\): void \{\s*brewOne\(id\);\s*focusRecipeRowById\(id\);/,
    );
    expect(dialog?.src).toMatch(
      /craftBatch:\s*brewBatch[\s\S]{0,900}function craftBatch\(id: string\): void \{\s*brewBatch\(id\);\s*focusRecipeRowById\(id\);/,
    );
    const fixture = readFileSync(
      resolve(__dirname, "../../scripts/lib/fullRecipeFixture.ts"),
      "utf8",
    );
    expect(fixture, "全丹方夹具必须从内容表生成,不许手抄 id").toContain("PILLS");
    const perf = readFileSync(resolve(__dirname, "../../scripts/perf-profile.mjs"), "utf8");
    expect(perf, "运行时门要按丹方卡落点核对件数").toContain('"[data-recipe-row]"');
    expect(perf, "运行时门要逐批翻完整丹方册").toContain("button[data-recipe-more]");
    const layout = readFileSync(resolve(__dirname, "../../scripts/layout-check.mjs"), "utf8");
    expect(layout, "195 宽要逐批翻完丹方并复核搜索与炼制后的焦点").toContain(
      '["开炉丹方的分批回看", taskRecipeListOverflow]',
    );
  });

  it("词条转移候选渐进铺开 —— 大行囊不许整册塞进小滚动框", () => {
    // 转移候选是整包装备的横切面:不限部位的词条能落到所有藏品上。max-h-24
    // 只裁掉眼睛看到的部分,DOM 仍会随行囊长满;候选也要走同一套长列表规则。
    const xfer = FILES.find((f) => f.path === "components/equipment/AffixTransferPanel.vue");
    expect(xfer?.src, "转移候选要复用长列表窗口").toMatch(
      /import\s*\{[\s\S]*?listWindow[\s\S]*?\}\s*from\s*"@\/core\/listRender"/,
    );
    expect(xfer?.src, "候选按 12 件一批、最多留 24 件").toMatch(
      /AFFIX_CANDIDATE_RENDER_BATCH\s*=\s*12[\s\S]{0,160}AFFIX_CANDIDATE_RENDER_WINDOW\s*=\s*AFFIX_CANDIDATE_RENDER_BATCH\s*\*\s*2/,
    );
    expect(xfer?.src, "只循环当前窗口,不许再整包铺开").toMatch(
      /v-for="c in candidatePage\.visible"/,
    );
    for (const attr of ["total", "shown", "start"]) {
      expect(xfer?.src, `候选册要暴露 ${attr} 读数给运行时门`).toContain(
        `data-affix-candidate-${attr}`,
      );
    }
    expect(xfer?.src, "候选行要有稳定指纹与可编程焦点").toContain(":data-affix-candidate=");
    expect(xfer?.src, "候选三段读数不许在窄屏被压成竖排").toContain(
      'class="shrink-0 whitespace-nowrap"',
    );
    expect(xfer?.src, "候选行要给足 28px 触控高度").toContain("flex min-h-[28px]");
    expect(xfer?.src, "余件要能续开").toContain("data-affix-candidate-more");
    expect(xfer?.src, "滑走的批次要能回翻").toContain("data-affix-candidate-prev");
    expect(
      xfer?.src.indexOf("data-affix-candidate-more"),
      "词条转移续开也要排在当前批之后,与其它长列表同向",
    ).toBeGreaterThan(xfer?.src.indexOf('v-for="c in candidatePage.visible"') ?? -1);
    expect(xfer?.src, "续开焦点要落到新露出的第一件").toMatch(
      /firstNewVisibleIndex\(\s*shownBefore,\s*shownAfter,\s*AFFIX_CANDIDATE_RENDER_WINDOW\s*\)/,
    );
    expect(xfer?.src, "换一条源词条就是换一份候选,窗口要回首批").toMatch(
      /watch\(\s*affixId,\s*\(\)\s*=>\s*\{\s*candidateLimit\.value\s*=\s*AFFIX_CANDIDATE_RENDER_BATCH;?\s*\}\)/,
    );
    const fixture = readFileSync(resolve(__dirname, "../../scripts/lib/bigBagFixture.ts"), "utf8");
    expect(fixture, "转移规模夹具从词条表挑无部位限制的源词条").toContain("makeAffixTransferBag");
    expect(fixture, "源词条不许手写 id").toContain("AFFIXES.find");
    const perf = readFileSync(resolve(__dirname, "../../scripts/perf-profile.mjs"), "utf8");
    expect(perf, "运行时门要按候选行落点核对件数").toContain('"[data-affix-candidate]"');
    expect(perf, "运行时门要逐批翻完整候选册").toContain("button[data-affix-candidate-more]");
    expect(perf, "报告要单列词条转移候选的续开结果").toContain("词条转移续开");
    const layout = readFileSync(resolve(__dirname, "../../scripts/layout-check.mjs"), "utf8");
    expect(layout, "195 宽要逐批翻完转移候选并复核焦点").toContain(
      '["词条转移候选的分批回看", taskAffixTransferOverflow]',
    );
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

  it("洞府营造先于家业入口 —— 首屏先给能动手的营造,再给财与人", () => {
    // 洞府页的第一任务是把材料变成建筑等级;家业两案是去别页的入口。
    // 390 首屏里家业双卡曾把首座建筑的升级键整个推到折线以下,故顺序本身要钉住。
    const dv = FILES.find((f) => f.path === "views/DongfuView.vue");
    const buildAt = dv?.src.indexOf('title="营造"') ?? -1;
    const estateAt = dv?.src.indexOf('title="家业 · 财与人"') ?? -1;
    expect(buildAt, "营造题头要定位得到").toBeGreaterThan(-1);
    expect(estateAt, "家业题头要定位得到").toBeGreaterThan(-1);
    expect(buildAt, "营造必须排在家业之前,先露可执行的升级键").toBeLessThan(estateAt);
  });

  it("首页状态行不许退回最弱档 —— 主角位「此刻状态」不该比次要天时还哑", () => {
    // 主页 hero 的「现在在干嘛」(修炼/闭关/历练…)此前整行 text-ink-faint,紧邻
    // 下方的次要天时反而 font-kai 披金 —— 层级倒挂。提一档 ink-soft 并配楷体,
    // 寿元告急那一路仍走朱砂;退回 faint 或拆掉 kai,下面红。
    const home = FILES.find((f) => f.path === "views/HomeView.vue");
    expect(home?.src, "状态行要配楷体与对位主角比肩").toMatch(
      /class="[^"]*font-kai text-body[^"]*"/,
    );
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

  it("全面墨感 · 触感与主位 —— 按压滑移、卷首框墨、首屏主钮辉光、法球落地影", () => {
    // 全面美化批:btn-seal/ghost/chip 早已 0.12s 滑移,唯 card-ink 交互卡硬跳;
    // 境界名加世界色横杆(匾额)、欢迎页主钮起朱砂柔辉、首页法球加远山同色落地影。
    // 四件各退一件,下面红 —— 不许拆回「卡一按就跳、主角字光秃秃」。
    const style = readStyleCss();
    expect(style, "card-ink 要带按压滑移").toMatch(
      /^[ \t]*\.card-ink \{[\s\S]{0,600}transition: transform 0\.12s ease;/m,
    );
    const cult = FILES.find((f) => f.path === "views/CultivationView.vue");
    expect(cult?.src, "境界名要进主册开卷卷首").toMatch(
      /<FolioPageHeader[\s\S]{0,240}\bfeatured\b/,
    );
    expect(style, "卷首要保留世界色左缘").toMatch(
      /^[ \t]*\.folio-masthead \{[\s\S]{0,600}border-left: 2px solid var\(--world-bar\);/m,
    );
    expect(style, "主册开卷版式要能加粗这道卷边").toContain(".folio-masthead--featured");
    const wel = FILES.find((f) => f.path === "views/WelcomeView.vue");
    expect(wel?.src, "首屏主钮要有柔辉").toMatch(/btn-seal animate-glow-pulse/);
    /*
     * 极窄档(195 CSS px)实测:旧欢迎页的 17px 主钮加 0.3em 字距放不下,当场折成
     * 两行(79px 高);三枚底链并排也会被压成 25px 宽的四字竖排。这是玩家看到的
     * **第一屏**,而它没有存档才可见,主巡页的缩放档那一遍永远巡不到。
     */
    expect(wel?.src, "主入口极窄档收字距并锁一行").toMatch(
      /tracking-\[0\.3em\] whitespace-nowrap tinylens:tracking-normal/,
    );
    expect(wel?.src, "三枚底链极窄档换行而不是被压成竖排").toMatch(
      /tinylens:flex-wrap tinylens:justify-center/,
    );
    expect(wel?.src, "底链自身不许再折(短动作词锁一行)").toMatch(
      /-my-1\.5 shrink-0 py-1\.5 whitespace-nowrap active:text-ink-soft/,
    );
    const home = FILES.find((f) => f.path === "views/HomeView.vue");
    expect(home?.src, "法球要有同世界色的落地影").toMatch(/bg-\[var\(--world-mountain\)\]/);
  });

  it("全库弹窗标题统一笔杆 —— 页面每节有世界色书脊,弹窗标题不许孤悬", () => {
    // 页面章节头(SectionTitle)用栏号签里的世界色书脊当家;BaseModal 是全库复用的
    // 浮层原语,标题此前是悬空一行楷体。弹窗标题必须带同一根杆 —— 一处改动罩住
    // 全库每个弹窗;拆掉杆(或挪到别处),下面红。
    const modal = FILES.find((f) => f.path === "components/common/BaseModal.vue");
    expect(modal?.src, "弹窗标题要挂世界色 brush-bar").toMatch(
      /<span[\s\S]{0,40}v-if="props\.title"[\s\S]{0,80}class="brush-bar h-3 w-0\.75 rounded-\[2px\] bg-\[var\(--world-bar\)\]"/,
    );
  });

  it("主题化的末里 —— 文字选中与点按高亮不许留浏览器默认", () => {
    // 全站纸墨成画,唯独两处还露着浏览器默认:长文里选中文字闪系统蓝、
    // 点按先弹灰盒再播按压反馈。选中改半透明朱砂(rgb 随主题转亮,两套主题
    // 都不打架),点按高亮压 transparent(全站交互元素自带 active 按压,
    // 系统那一下反而冲出画外)。退回去,下面红。
    const style = readStyleCss();
    expect(style, "选中文字要朱砂浸染").toMatch(
      /::selection \{\n\s+background: rgb\(var\(--color-cinnabar-rgb\) \/ 0\.22\);/,
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
    expect(
      retreatCard?.src,
      "闭关入口在 195px 下必须换行:chip-ink 的 nowrap 会把主滚动区撑宽并滚偏整页",
    ).toMatch(/class="chip-ink[^"]*!whitespace-normal[^"]*"/);
  });

  it("境遇结算收益行要逐行晕开 —— 与离线卷轴同款节奏,不许瞬时同现", () => {
    // 结果句已经 animate-ink-pop,紧随的收益列表却裸 `space-y-1.5` 瞬时同现;
    // 同一语义(收益清点)离线卷轴有 stagger-in,这里没有就是不一致。拆掉,红。
    const ev = FILES.find((f) => f.path === "components/adventure/EventDialog.vue");
    expect(ev?.src, "收益列表必须走 stagger-in").toMatch(
      /ul v-if="result\.lines\.length" class="stagger-in /,
    );
  });

  it("器魂沿用册页卷首 —— 道源读数收进独立动作槽", () => {
    // 详情页不再各手搓一条「返回 / 标题 / 读数」三栏。统一卷首把道源放进
    // action 槽,标题天然按册页左缘落位,不再随数字位数或返回文案漂移。
    const souls = FILES.find((f) => f.path === "views/SoulsView.vue");
    expect(souls?.src, "器魂页要接共同卷首").toMatch(/<FolioPageHeader[\s\S]{0,180}title="器 魂"/);
    expect(souls?.src, "天界返回兜底要写清").toContain('back-to="celestial"');
    expect(souls?.src, "道源读数要进独立动作槽").toMatch(/<template[\s\S]{0,80}#action>/);
    expect(souls?.src, "道源仍读同一份 endgame 数据").toContain("formatNum(endgame.daoSource)");
  });

  it("器魂槽位:卡壳不许自称按钮,两个动作各用原生 button —— 读屏听到的与按得动的必须同源", () => {
    /*
     * 两笔账,同一个根:
     *   一 空槽从前恒挂 role="button" 与 aria-label「空」,tabindex 才给 -1。读屏念出
     *      一个"空 按钮",按下去只把 soulDetail 赋成 null,弹窗连开都不开;
     *   二 有器魂的卡壳整张是 role=button 的 div,里面又嵌着「卸下」<button>。CDP 读出
     *      的无障碍树真把它画成 button ⊃ button —— ARIA 里 button 带
     *      Children Presentational,读屏本该把里面的内容压平成一段文字,那个「卸下」
     *      在 VoiceOver / TalkBack 上就可能根本不可达(本作是移动端优先的放置游戏)。
     *
     * 现在按钮语义由真 <button> 自己带:卡壳是普通容器,「详情」与「卸下」是两枚同级
     * 原生按钮,键盘可达也不必自己写 keydown(浏览器给 Enter / 空格)。
     * 「这一格有没有器魂」仍只有一处出口 soulAt —— 样式与两枚按钮都从它取值,
     * 各写一份三元,漏一处就又是一个"念出来却按不动"的东西。
     * 浏览器那一遍另有通用判据(layout-check 的 deadControls + 本轮新增的 nesting),
     * 这条守的是写法不回退。
     */
    const souls = FILES.find((f) => f.path === "views/SoulsView.vue");
    const shell = /<div\s+v-for="i in SOUL_SLOTS"[\s\S]*?>/.exec(souls?.src ?? "")?.[0];
    expect(shell, "槽位卡壳要定位得到 —— 定位不到这条就是空转").toBeTruthy();
    expect(
      shell,
      "卡壳不许声明 role(带 Children Presentational 的 role 会吞掉里面的真按钮)",
    ).not.toMatch(/role=/);
    expect(shell, "卡壳不许自己接管点击(点击归里面那两枚真按钮)").not.toMatch(/@click/);
    expect(shell, "卡壳不许自己挂 Tab 序(原生按钮各在 Tab 序里)").not.toMatch(/tabindex/i);
    expect(souls?.src, "空槽不许再把占位文字当控件名").not.toMatch(/:\s*["']空["']/);
    expect(souls?.src, "「有没有器魂」只许一处判断").toMatch(
      /function soulAt\(i: number\): SoulInstance \| null/,
    );
    expect(souls?.src, "两枚按钮都要由 soulAt 决定存不存在").toMatch(
      /<template v-if="soulAt\(i\)">/,
    );
    expect(souls?.src, "详情按钮要有自己的读屏名").toMatch(
      /:aria-label="detailLabel\(soulAt\(i\)!\)"/,
    );
    expect(souls?.src, "卸下按钮的读屏名要带是哪一缕(只念「卸下」不知卸的什么)").toMatch(
      /:aria-label="`卸下 \$\{soulLabel\(soulAt\(i\)!\)\}`"/,
    );
    expect(souls?.src, "真按钮不必再手写键盘事件").not.toContain("onSlotKeydown");
    expect(buttonNesting(souls?.src ?? ""), "槽位卡壳与两枚动作按钮必须同级").toEqual([]);
  });
  it("空槽的下一步「装配」只在真有闲置形意时出现 —— 不给按不动的入口", () => {
    /*
     * 空槽从前只写一个「空」:玩家手上有闲置形意,却要自己想起页面下方那张
     * 「散置形意」清单才能装。现在那一格里给出「装配」,但按第四十四条同一道闸 ——
     * **没有可装的东西时它就不是按钮**(v-if 掉整枚 <button>),而不是灰着一枚
     * 让人以为漏了什么。点开的是那张清单由玩家挑一缕,不是替玩家装某不知名的魂。
     */
    const souls = FILES.find((f) => f.path === "views/SoulsView.vue");
    expect(souls?.src, "空槽的装配入口要有条件").toMatch(
      /<template v-else>[\s\S]*?v-if="soulPulse\.idleSouls\.length > 0"[\s\S]*?@click="idleOpen = true"/,
    );
    expect(souls?.src, "装配入口的读屏名要说清是空槽且要挑一缕").toContain(
      'aria-label="空槽 · 挑一缕装配"',
    );
    expect(souls?.src, "不许改成 disabled 的灰按钮(那正是念得出却按不动)").not.toMatch(
      /<button[^>]{0,400}disabled[^>]{0,400}>装配/,
    );
  });

  it("器魂槽位在极窄档放开成两列 —— 名字不许被挤成竖排", () => {
    /*
     * 200% 缩放档(390 的机型把字放大一倍,布局视口只剩 195 CSS px)实测:三列下每格
     * 只有 49px,「显形·锋魂」折成两截、「卸下」一字一行 —— 名字与动作键都读不出来。
     * 极窄时放开成两列(实测格宽 78px:名字一行、动作键 36×32 一行,无越界无横向溢出),
     * 320 / 390 两档仍是三列(阈值 220px,量在两者之间)。
     *
     * 阈值写成数字是刻意的:它是**排版档位**而不是会被常数改动的数值(与「写常量即撒谎」
     * 那一族无关),改它就得同时重测三档 —— 所以判据把两件事一起钉住。
     */
    const souls = FILES.find((f) => f.path === "views/SoulsView.vue");
    const grid = /<div class="(mt-2 grid[^"]*)">/.exec(souls?.src ?? "")?.[1];
    expect(grid, "槽位网格要能定位到").toBeTruthy();
    expect(grid, "常态仍是三列").toContain("grid-cols-3");
    expect(grid, "极窄档要放开列数").toMatch(/tinylens:grid-cols-2/);
    /*
     * 「动作标签不许折行」不再是逐处手写的装饰,而是 tap-row 这条角色的语义
     * (src/style.css):挂它的 8 处调用点全是 2~6 字短动作标签。此前有两处各写了一遍
     * whitespace-nowrap,其余各处靠运气 —— 200% 档实测坊市「← 返回」被挤成三行。
     * 判据只钉角色本体:各调用点不许再抄一遍(两本账),也不许被删掉。
     */
    const css = readStyleCss();
    const tapRow = /\.tap-row \{([^}]*)\}/.exec(css)?.[1];
    expect(tapRow, "tap-row 角色要能定位到 —— 定位不到这条就是空转").toBeTruthy();
    expect(tapRow, "短动作标签不许折行(角色的语义,不是某处的装饰)").toContain(
      "white-space: nowrap",
    );
    const restated = FILES.filter((f) => /class="tap-row[^"]*whitespace-nowrap/.test(f.src)).map(
      (f) => f.path,
    );
    expect(restated, "角色已经管了 nowrap,调用点不许再抄一遍(两本账)").toEqual([]);
  });

  it("人物页总案与属性行在极窄档放开列数 —— 九位数与属性名不许挤成竖排", () => {
    /*
     * 195 CSS px(390 按 200%)实测:
     *   道躯总案常态三列会只剩几十像素,读数与占比挤成两行;极窄档把占比退到
     *     数值下方,名称与主值仍各占一行。总案本身在 720px 以下保持单列。
     *   属性行两列时每列 56.5px,「进阶成功率」被压成 11px 宽一字一行(8 行里 7 行竖排)
     *     —— 放开成单列,名字回到 44px 一行。
     * 320 / 390 两档实测读数一分未动。
     */
    const ch = FILES.find((f) => f.path === "views/CharacterView.vue");
    expect(ch?.src, "道躯总案要定位得到 —— 定位不到这条就是空转").toContain(
      "data-character-dossier",
    );
    const rows = /class="(grid grid-cols-2 gap-x-4 gap-y-1[^"]*)"/.exec(ch?.src ?? "")?.[1];
    expect(rows, "属性行网格要定位得到").toBeTruthy();
    expect(rows, "极窄档放开成单列").toContain("tinylens:grid-cols-1");
    const css = readStyleCss();
    expect(css, "总案常态单列").toMatch(
      /\.character-dossier__grid \{[\s\S]{0,100}?grid-template-columns: minmax\(0, 1fr\)/,
    );
    expect(css, "极窄档十位数与占比分两层").toMatch(
      /@media \(max-width: 220px\) \{[\s\S]{0,1800}?\.character-dossier__stat \{[\s\S]{0,100}?grid-template-columns: minmax\(0, 1fr\) auto/,
    );
    expect(css, "主值读数列不许折行").toMatch(
      /\.character-dossier__stat-value \{[\s\S]{0,120}?white-space: nowrap/,
    );
  });

  it("浮层在极窄档收窄内边距 —— 195 宽下 20px 一层的内边距吃掉四成可用宽", () => {
    /*
     * 归来卷轴在 195 CSS px 下的面板只有 155px 宽,而 BaseModal 三层各 20px 的内边距
     * (遮罩 / 头部 / 卷身)让收益行只剩 113px —— 「修为」与「+46.39兆」并排时各自折两行。
     * 极窄档收成 12px:面板 171px、行内 145px,两段并排也放得下。
     * 这是全库所有弹窗共用的原语,故在它身上收一次,而不是逐个弹窗各自补。
     */
    const bm = FILES.find((f) => f.path === "components/common/BaseModal.vue");
    const padded = [...(bm?.src ?? "").matchAll(/class="([^"]*\bpx-5\b[^"]*)"/g)].map((m) => m[1]!);
    expect(padded.length, "四层内边距要定位得到 —— 定位不到这条就是空转").toBe(4);
    for (const cls of padded) expect(cls, "极窄档收窄").toContain("tinylens:px-3");
  });

  it("归来卷轴在极窄档上下叠 —— 面板内宽 113px 时「修为」与「+46.39兆」各自折成两行", () => {
    /*
     * 这一屏玩家每几天见一次,而它只在开局弹一次:主巡页与缩放档那一遍都碰不到它
     * (巡页前先 clearOverlays 收掉了)。390 上的读数一分不代表 195 —— 实测面板内宽
     * 只剩 113px,「修为」与「+46.39兆」并排时各自折成两行,整行 58px。
     * 改极窄档上下叠:标签一行、数值一行,各自都读得完整。
     */
    const off = FILES.find((f) => f.path === "components/offline/OfflineRewardDialog.vue");
    const rows = [
      ...(off?.src ?? "").matchAll(
        /class="(flex items-center justify-between rounded-\[2px\] bg-paper-deep\/70 px-3 py-2[^"]*)"/g,
      ),
    ].map((m) => m[1]!);
    expect(rows.length, "入账 / 路上两组行都要定位得到 —— 定位不到这条就是空转").toBe(2);
    for (const cls of rows) {
      expect(cls, "极窄档上下叠").toContain("tinylens:flex-col");
      expect(cls, "叠起来后从行首对齐,不是居中").toContain("tinylens:items-start");
    }
  });

  it("后期档在极窄档的四处放开 —— 空档量不出的那几块", () => {
    /*
     * 主巡页量的是刚建号的空档:建筑未营、没有在途秘境、灵石只有三位数。
     * 同一批页面在神人境(九位数灵石 + 成套装备 + 在途秘境)的 195 CSS px 下,
     * 四处当场坏掉 —— 空档那一遍一页都量不到,故单列一条判据钉住:
     *   一 洞府七作两列时每卡内宽 ~51px,「连升×5 ·共 31.37万 石 400 铁」两段 nowrap
     *      顶出卡片左右各 13px;分组工作台在极窄档改单列。
     *   二 在途秘境「再入一层 / 出秘境」两枚 flex-1 并排各剩 61px,五个字带字距放不下,
     *      折成三行、按钮涨到 84px;改极窄档上下叠。
     *   三 远征择路两径并排每格 ~52px,节点说明被压成三行竖排;改单列。
     *   四 修炼页灵气主值行:一段「灵气 +X/秒」92px 加一段「现值 · 已封顶」85px 挤在
     *      128px 里,「· 已封顶」被甩到第二行(主值行折行判据红);改极窄档上下两段。
     */
    const dv = FILES.find((f) => f.path === "views/DongfuView.vue");
    const css = readStyleCss();
    expect(dv?.src, "七作仍走自己的分组网格").toContain('class="dongfu-workshop__grid"');
    expect(css, "七作常态是两列").toMatch(
      /\.dongfu-workshop__grid\s*\{[\s\S]{0,120}grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/,
    );
    expect(css, "极窄档七作改单列").toMatch(
      /@media \(max-width: 220px\)\s*\{[\s\S]{0,900}\.dongfu-workshop__grid\s*\{[\s\S]{0,100}grid-template-columns:\s*minmax\(0, 1fr\)/,
    );

    const sr = FILES.find((f) => f.path === "components/adventure/SecretRealmCard.vue");
    expect(sr?.src, "在途秘境的两枚动作键极窄档要上下叠").toMatch(
      /class="mt-2 flex gap-2 tinylens:flex-col"/,
    );

    const exp = FILES.find((f) => f.path === "components/celestial/ExpeditionPanel.vue");
    expect(exp?.src, "远征择路极窄档要单列").toMatch(
      /class="stagger-in grid grid-cols-2 gap-2 tinylens:grid-cols-1"/,
    );

    const cv = FILES.find((f) => f.path === "views/CultivationView.vue");
    // 两条主值行都带 data-value-row,灵气那条是唯一要求极窄档上下两段的
    const qiRows = [...(cv?.src ?? "").matchAll(/data-value-row[\s\S]{0,240}?class="([^"]*)"/g)]
      .map((m) => m[1]!)
      .filter((c) => c.includes("text-body"));
    expect(qiRows.length, "两处主值行都要定位得到 —— 定位不到这条就是空转").toBe(2);
    expect(
      qiRows.filter((c) => c.includes("tinylens:flex-col")),
      "灵气那一行极窄档上下两段(挤在一行会把「· 已封顶」甩到第二行)",
    ).toHaveLength(1);
    expect(cv?.src, "极窄档隐去「/ 上限」,上限在进度条与详情里").toMatch(
      /class="tinylens:hidden">\/ \{\{ formatNum\(player\.qiCapValue\) \}\}/,
    );
  });

  it("页面不许禁掉缩放 —— 那正是这一部在防的那档被自己关了门", () => {
    /*
     * index.html 的 viewport 从首个版本起写着 `maximum-scale=1.0, user-scalable=no` ——
     * 低视力用户放大不了页面,而 docs/design.md 第四十一条与 AGENTS 的移动端口径都在
     * 「按 200% 缩放防折行」上做了好几轮:一边修 200% 档的排版,一边把 200% 关掉不让人用。
     *
     * 它当初大概是为了挡 iOS「输入框字号 <16px 时聚焦自动放大并顶偏布局」——
     * 但那是可以正面解决的:把文本输入框提到 16px(iOS 的自动放大门槛是**计算字号 <16px**,
     * 见下方那条判据)。两条一起才成立:关缩放是拿无障碍换省事。
     */
    const html = readFileSync(resolve(__dirname, "../../index.html"), "utf-8");
    const meta = /<meta\s+name="viewport"[^>]*content="([^"]*)"/.exec(html)?.[1] ?? "";
    expect(meta, "index.html 要有 viewport meta —— 定位不到这条就是空转").toBeTruthy();
    expect(meta, "不许用 user-scalable=no 禁掉缩放").not.toContain("user-scalable=no");
    expect(meta, "maximum-scale 不许压到 1 —— 那等于禁掉放大").not.toMatch(
      /maximum-scale\s*=\s*1(\.0+)?\b/,
    );
  });

  it("文本输入框都要有可访问名 —— 读屏念「文本框」等于没说是哪一个", () => {
    /*
     * 三处此前只靠 placeholder:建号页的道号、丹房的搜方名、重铸面板的「至多洗 N 次」。
     * placeholder 不是可访问名(它一输入就消失,读屏在聚焦那一刻也未必念它),
     * 而这三处恰好都是**玩家必须填**的那一格 —— 念不出名字就等于让人盲填。
     * 只查文本类输入(checkbox / range / file 由别的判据管)。
     */
    const offenders: string[] = [];
    for (const f of FILES) {
      for (const m of f.src.matchAll(/<input\b(?:"[^"]*"|'[^']*'|[^>"'])*?>/g)) {
        const tag = m[0];
        const type = /type="([^"]*)"/.exec(tag)?.[1] ?? "text";
        if (["hidden", "file", "checkbox", "radio", "range", "color"].includes(type)) continue;
        if (/aria-label|aria-labelledby|\sid="/.test(tag)) continue;
        offenders.push(`${f.path}: ${type} ${tag.replace(/\s+/g, " ").slice(0, 70)}`);
      }
    }
    expect(offenders, "这些输入框没有可访问名").toEqual([]);
  });

  it("文本输入框字号 ≥16px —— 否则 iOS 聚焦会自动放大、把布局顶歪", () => {
    /*
     * iOS Safari 在输入框**计算字号 <16px** 时,一聚焦就自动放大页面并把它居中,
     * 玩家得手动捏回去。这正是上一版「禁掉缩放」的来由;正确解法是把字号提上去。
     * 只查文本类输入(text / number / search 等):checkbox / range / file 不触发这条。
     */
    const offenders: string[] = [];
    for (const f of FILES) {
      for (const m of f.src.matchAll(/<input\b(?:"[^"]*"|'[^']*'|[^>"'])*?>/g)) {
        const tag = m[0];
        const type = /type="([^"]*)"/.exec(tag)?.[1] ?? "text";
        if (["hidden", "file", "checkbox", "radio", "range", "color"].includes(type)) continue;
        const size = Number(/text-\[(\d+)px\]/.exec(tag)?.[1] ?? NaN);
        // 未声明字号的按组件角色兜底(t-card = 14px),同样不足 16
        if (!(size >= 16))
          offenders.push(`${f.path}: ${type} ${Number.isFinite(size) ? size + "px" : "未声明"}`);
      }
    }
    expect(offenders, "这些文本输入框在 iOS 上聚焦即自动放大").toEqual([]);
  });

  it("页签条在极窄档去字距并锁一行 —— 六枚页签不许各自折成两行", () => {
    /*
     * InkTabs 供六个页面共用,标签全是 2 字。常态字距 0.2em 是那枚墨块的呼吸,但
     * 200% 缩放档(195 CSS px)下 6 枚页签每枚只剩 26px:2 字 14px 加字距要 34px,
     * 实测六枚全折成两行。极窄档收到 11px 并去字距后,文字 22px 留出余量,但仍会
     * 因边界抖动折行,故两条一起要:字号收口 + tracking 归零 + nowrap。
     */
    const tabs = FILES.find((f) => f.path === "components/common/InkTabs.vue");
    const cls = /class="([^"]*font-kai[^"]*)"/.exec(tabs?.src ?? "")?.[1];
    expect(cls, "页签的类名要定位得到 —— 定位不到这条就是空转").toBeTruthy();
    expect(cls, "常态保留那口呼吸(字距 0.2em)").toContain("tracking-[0.2em]");
    expect(cls, "极窄档去字距").toContain("tinylens:tracking-normal");
    expect(cls, "极窄档锁一行(只去字距仍会因边界抖动折行)").toContain("tinylens:whitespace-nowrap");
  });

  it("页签选中态走淡底墨字 + 朱砂小印,不压成实心墨块", () => {
    const tabs = FILES.find((f) => f.path === "components/common/InkTabs.vue");
    expect(tabs?.src, "选中态要有淡纸底").toContain("bg-paper-deep/70");
    expect(tabs?.src, "选中态文字仍是墨字").toContain("text-ink");
    expect(tabs?.src, "选中态要留一枚朱砂小印").toContain("bg-cinnabar/70");
    expect(tabs?.src, "不许退回实心墨块 + 反白字").not.toMatch(
      /rounded-md bg-ink shadow[\s\S]{0,120}text-paper/,
    );
    const cls = /class="([^"]*font-kai[^"]*)"/.exec(tabs?.src ?? "")?.[1];
    expect(cls, "页签字号要落在页面字阶内").toContain("text-title");
    expect(cls, "极窄档用 body 档收口").toContain("tinylens:text-body");
  });

  it("极窄档的顶栏与行要放开 —— 三段横排塞不下时不许把标题压成一字一行", () => {
    /*
     * 195 CSS px(390 按 200%)实测,三处同构的「左返回 / 中标题 / 右动作」顶栏:
     *   坊市 中间列 8px / 副题 14 行、整块 221px;门庭 20px / 16 行、266px;
     *   货架行三段横排时名称块 4px / 10 行、行高 140px。
     * 放开后(顶栏纵向堆叠、名称块占满整行):113 / 120 / 86px,标题 129px / 4 行。
     * 320 / 390 两档读数一分未动 —— 所以只钉"极窄档那一侧有放开",不钉具体高度。
     */
    const market = FILES.find((f) => f.path === "views/MarketView.vue");
    const appr = FILES.find((f) => f.path === "views/ApprenticeView.vue");
    // 坊市卷首动作 + 悬赏板题头 + 货架/悬赏行
    expect(market?.src, "坊市要接共同卷首").toContain("<FolioPageHeader");
    expect(market?.src, "坊市卷首动作极窄档落整行").toContain(
      "tinylens:w-full tinylens:justify-between",
    );
    expect(market?.src, "悬赏板题头极窄档要纵向堆叠").toMatch(
      /justify-between pr-1 tinylens:flex-col/,
    );
    expect(market?.src, "坊市总账改接共享此刻账").toContain("<LedgerPulse");
    expect(market?.src, "坊市不再私写先手栏").not.toContain("market-pulse__lead");
    expect(market?.src, "坊市先手按钮读共享动作键").toContain("folio-ledger-pulse__action");
    // 门庭卷首动作按钮在极窄档落整行
    expect(appr?.src, "门庭要接共同卷首").toContain("<FolioPageHeader");
    expect(appr?.src, "收徒动作极窄档落整行").toContain("tinylens:w-full");
    expect(appr?.src, "弟子行极窄档要允许换行").toMatch(/flex flex-wrap items-center gap-2/);
  });

  it("极窄档的阈值只住一处 —— 不许各处再手写 max-[Npx]", () => {
    /*
     * 阈值一旦各处各写一遍,就是两本账:改一处另一处不动,同一台 200% 的机器上一处
     * 放开一处不放开,而排版自检只判溢出/越界,看不出这是"两本账"而不是"没坏"。
     * Tailwind 的 JIT 扫不到 `max-[${X}px]` 这类拼接(会静默不生成媒体查询),所以
     * 任意值写法本来就必须是字面量 —— 索性把它收成配置里的一个具名变体(tinylens),
     * 这里守"别人不许再抄数值"。
     */
    const strays = FILES.filter((f) => /max-\[\d+px\]:grid-cols-/.test(f.src)).map((f) => f.path);
    expect(strays, "极窄档放开列数一律走 tinylens:,不许各处手写阈值").toEqual([]);
    const cfg = readFileSync(resolve(SRC, "../tailwind.config.js"), "utf-8");
    const declared = [
      ...cfg.matchAll(/addVariant\(\s*"tinylens",\s*"@media \(max-width: *(\d+)px\)"/g),
    ].map((m) => m[1]!);
    expect(declared, "配置里要能找到那条阈值声明(改名/删掉时这条会空转)").toHaveLength(1);
    const users = FILES.filter((f) => /tinylens:grid-cols-/.test(f.src)).map((f) => f.path);
    expect(users.length, "至少有一处在用这个变体").toBeGreaterThan(0);
    /*
     * style.css 里那条 @media 是同一个阈值的第二处写法(按钮族的极窄档内边距)——
     * CSS 里没法用 Tailwind 变体,但数值必须与配置一字不差,否则两边会各走各的:
     * 改了配置里那一行,按钮的内边距仍停在旧阈值上,而排版自检看不出这种漂移。
     */
    const css = readStyleCss();
    const cssThresholds = [...css.matchAll(/@media \(max-width: *(\d+)px\)/g)].map((m) => m[1]!);
    for (const t of cssThresholds) {
      expect(declared, `style.css 里的 ${t}px 与 tinylens 的阈值不是同一个数`).toContain(t);
    }
  });

  it("全库不许有按钮套在按钮里 —— 读屏只念得出外层那一个", () => {
    /*
     * 浏览器那一遍(layout-check 的 nestedControls)量的是「此刻画出来的」形状,
     * 要等到某条路由、某个弹窗、某个存档状态把那个形状摆出来才算数;这一条扫源码,
     * 所有 components/views 一次过 —— 没渲染到的分支也在射程内。
     * 数量不写在这里(「写常数即撒谎」),真数看一次运行。
     */
    const offenders = FILES.map((f) => ({ path: f.path, bad: buttonNesting(f.src) })).filter(
      (f) => f.bad.length > 0,
    );
    expect(
      offenders.map((f) => `${f.path} → ${f.bad.join(" / ")}`),
      "这些文件把可聚焦控件嵌进了按钮语义的元件里(内层那枚在 VoiceOver / TalkBack 上可能根本不可达)",
    ).toEqual([]);
  });

  it("扫描器自己有牙 —— 嵌套报得出,label 的关联与组合控件不报", () => {
    /*
     * 判据从没抓到过东西时,绿得毫无信息(与 data-value-row / deadControls 同一套防法)。
     * 故拿内联夹具自证:真嵌套必须报,规范写法必须不报。
     */
    expect(
      buttonNesting(
        '<template><div><button aria-label="详情"><span>x</span><button>卸下</button></button></div></template>',
      ),
      "真 button 套真 button 必须报",
    ).toHaveLength(1);
    expect(
      buttonNesting(
        '<template><div role="button" tabindex="0"><button aria-label="卸下">卸下</button></div></template>',
      ),
      "role=button 的壳里嵌真按钮(器魂页的老形状)必须报",
    ).toHaveLength(1);
    expect(
      buttonNesting(
        '<template><label>名<input type="text" /></label><button>提交</button></template>',
      ),
      "label 里的原生控件是关联,不是嵌套",
    ).toEqual([]);
    expect(
      buttonNesting(
        '<template><div role="tablist"><button role="tab">甲</button></div></template>',
      ),
      "组合控件里的 tab 不在射程(宿主只认按钮语义)",
    ).toEqual([]);
  });

  it("门庭收徒按钮收进卷首动作槽 —— 长价签不挤册名", () => {
    // 收徒按钮文案在「收徒 · 尚差 X 石 / 收徒 NNN 石 / 已收满 N/M」之间换长。
    // 统一卷首把动作放在标题之外,极窄档再让它独占一行。
    const appr = FILES.find((f) => f.path === "views/ApprenticeView.vue");
    expect(appr?.src, "门庭要接共同卷首").toContain("<FolioPageHeader");
    expect(appr?.src, "卷首册名要写「门庭有徒」").toContain('title="门庭有徒"');
    expect(appr?.src, "收徒按钮要进独立动作槽").toContain("<template #action>");
    expect(appr?.src, "极窄档收徒按钮独占整行").toContain("tinylens:w-full");
    expect(appr?.src, "洞府返回兜底要写清").toContain('back-to="dongfu"');
  });

  it("门庭派活卡排成等高两列 —— 五个产出项目前靠内容宽窄拼成 3+2 的锯齿", () => {
    /*
     * 派活是这一页唯一的分支动作,五枚任务原先走 flex-wrap:按钮宽度由文案决定,
     * 390 宽下第一行 3 枚、第二行 2 枚且逐枚不等宽,像一组没对齐的标签。
     * 两列等宽让五枚产出在同一把尺上比较;200% 缩放(195 CSS px)再收一列,
     * 不把产出文案挤成窄胶囊。图标取任务数据里的 icon,选中态用淡朱砂边底报出。
     */
    const appr = FILES.find((f) => f.path === "views/ApprenticeView.vue");
    expect(appr?.src, "派活卡要排成稳定的两列网格").toMatch(
      /grid grid-cols-2 gap-1\.5 tinylens:grid-cols-1/,
    );
    expect(appr?.src, "每枚任务卡占满单元格并留足触达高度").toContain("min-h-[44px] w-full");
    expect(appr?.src, "任务图标读 APPRENTICE_TASKS 的 icon,不另抄一套").toContain(':name="t.icon"');
    expect(appr?.src, "选中态用 4% 朱砂底与可读边框,不用实心彩胶囊").toContain(
      "'border-cinnabar/35 bg-cinnabar/4'",
    );
    expect(appr?.src, "展开态与派发判定共用同一个任务 key 谓词").toContain(
      ':aria-expanded="isTaskOpen(a.uid, t.spec)"',
    );
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
    // 指示器(对照 InkTabs 淡纸底 + 朱砂小印 / 行程点实底呼吸)。当前档改实底 paper 字。
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
    expect(cp?.src, "星级按钮仍要吃满 32px 触达高度").toContain(
      'class="tap-row -my-2 -ml-1 px-1 active:opacity-60"',
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
      ["views/ApprenticeView.vue", ':aria-expanded="isTaskOpen(a.uid, t.spec)"'],
      // 秘境整卡先收成一行;这张卡与卡内名录各有一层 disclosure
      ["components/adventure/SecretRealmCard.vue", ':aria-expanded="cardExpanded"'],
      // 秘境名录是历练页的支线,默认只亮最近两处;展开/收起要把状态报给读屏
      ["components/adventure/SecretRealmCard.vue", ':aria-expanded="secretListExpanded"'],
      // 建筑卡把完整效果与连升账收进详情,主键先露;展开态同样要报给读屏
      ["components/dongfu/BuildingCard.vue", ':aria-expanded="detailsOpen"'],
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
    const css = readStyleCss();
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
    const css = readStyleCss();
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
    const css = readStyleCss();
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
    expect(dlg?.src, "器谱进度也要露在铁砧前").toContain("blueprintMastery");
    expect(dlg?.src, "判据必须与技艺表同源(skillStageProgress),不另起一套").toContain(
      "skillStageProgress",
    );
    expect(dlg?.src, "技艺要有进度条可读").toContain("<ProgressBar");
  });

  it("读通的器谱也是轮回遗产 —— 宿慧里计一份,轮回录里看得见", () => {
    const legacy = FILES.find((f) => f.path === "views/LegacyView.vue");
    expect(legacy?.src, "轮回录要列读通的器谱数").toContain("masteredBlueprintCount");
    expect(legacy?.src, "器谱要与灵材、丹方、敌手同处「随神魂不灭」一栏").toContain("读通器谱");

    const rebirth = FILES.find((f) => f.path === "components/character/ReincarnationDialog.vue");
    expect(rebirth?.src, "转世说明要把器谱列进随神魂带走的认知").toContain("器谱");

    const codex = readFileSync(resolve(__dirname, "../ui/codex.ts"), "utf8");
    expect(codex, "装备图鉴也要读同一份逐模板器谱").toContain("blueprintMastery(def.id)");
  });

  it("铭纹的用处露在重铸决策点 —— 不只长一条进度", () => {
    const panel = FILES.find((f) => f.path === "components/equipment/EquipReforgePanel.vue");
    expect(panel?.src, "重铸面板要读取铭纹保底(与核心同一函数)").toContain("inscribeRollFloor");
    expect(panel?.src, "器谱要与铭纹合成实际保底,不许各算一套").toContain(
      "effectiveReforgeRollFloor",
    );
    expect(panel?.src, "新词条掷点保底必须写成玩家看得懂的话").toContain("新词条");
    expect(panel?.src, "保底数值要落到面板上").toContain("reforgeFloor");
    expect(panel?.src, "器谱离读通还有几次要摊在按重铸之前").toContain(
      "blueprintReforgesUntilMastered",
    );
    expect(panel?.src, "读通器谱的宿慧收益要与数据源同源").toContain("INSIGHT_PER_BLUEPRINT");
  });

  it("自动重铸给出真实目标次数,不可达目标不许继续烧钱", () => {
    const panel = FILES.find((f) => f.path === "components/equipment/EquipReforgePanel.vue");
    expect(panel?.src, "候选池与核心同源").toContain("reforgeAffixPool");
    expect(panel?.src, "选中目标要按当前阈值重算次数").toMatch(
      /triesOf\(\w+\.affixId,\s*\w+\.minRoll/,
    );
    expect(panel?.src, "阈值不可能达到时要明说").toContain("不会命中");
    expect(panel?.src, "不可达目标也要置灰").toMatch(
      /:disabled="[^"]*!autoReachable[^"]*!autoAffordable/,
    );
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
    // 置灰要有分隔,但**不许靠整块 opacity**:那会把「已选满」这行字一起压掉
    // (实测 2.4:1,读不出来)。压色 —— 边框淡一档、字落到 ink-faint。
    expect(cel?.src, "置灰要压色(边框淡一档),不许退回整块 opacity").toContain(
      "'border-ink/15 text-ink-faint'",
    );
    expect(cel?.src, "置灰不许用整块 opacity(压字不压色)").not.toMatch(/opacity-\d+/);
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

  it("坊市先报此刻,再把货架 / 悬赏 / 售出分成三册", () => {
    /*
     * 坊市此前把三件互不相干的事一路竖排:货架六格、悬赏四单、寄卖与即时售,
     * 玩家想寄一件旧兵刃得先滚过整块卖货区。现在卷首先报「可买 / 可交 / 寄售」,
     * 页签再带路;可交数与逐单缺口必须共用 core/marketOverview 的一份判据,
     * 不许页签另算一遍「看起来能交」。
     */
    const market = FILES.find((f) => f.path === "views/MarketView.vue");
    expect(market?.src, "卷首市况要走 core/marketOverview").toContain("marketOverview(");
    expect(market?.src, "逐单缺口与可交数要共用 bountyStatus").toContain(
      "bountyStatus(o, bountyHoldings.value)",
    );
    expect(market?.src, "货架 / 悬赏 / 售出要收成吸顶页签").toContain(
      '<InkTabs v-model="marketTab" :tabs="marketTabRows" />',
    );
    for (const marker of ["data-market-pulse-goods", "data-market-pulse-bounties"]) {
      expect(market?.src, `卷首缺少 ${marker}`).toContain(marker);
    }
    expect(market?.src, "寄售数要从同一份市况真值报出").toContain("marketPulse.consignCount");
    expect(market?.src, "切册后顶栏时钟要跟着当前册走").toContain("headerClock.title");
  });

  it("寄卖分批复现全件背包 + 即时售丹有声 —— 别把第 13 件藏起来、售丹不许哑卖", () => {
    // ① 寄卖是背包装备唯一出手口,却只渲染前 12 件(bagItems.slice(0,12))——
    //    背包容量 120,第 13 件往后连按钮都没有、也不说明,晚期玩家那件刚
    //    洗出来的货永远寄不出去。现在与背包装备走同一套渲染窗口:首批只画一批,
    //    「再看 N 件」显式续开 —— 既不许静默截断,也不许把 120 枚横条一次塞进 DOM。
    // ② 售丹按钮写「(N)」读起来像卖一整类,实际一按只出一颗且零反馈;
    //    改成「现持 N」点明数量,并给每颗成功/失败的 toast,不许闷声。
    const market = FILES.find((f) => f.path === "views/MarketView.vue");
    expect(market?.src, "寄卖要列全背包,不许 slice 截断").not.toContain(
      "inventory.bagItems.slice(0, 12)",
    );
    expect(market?.src, "寄卖首批只遍历渲染窗口").toContain('v-for="it in consignPage.visible"');
    expect(market?.src, "余件必须显式续开,不许静默截断").toContain("consignPage.hidden > 0");
    expect(market?.src, "窗口封顶后要能回看前一批").toContain('data-market-prev="consign"');
    expect(market?.src, "回看必须走同一窗口函数").toContain("previousInventoryLimit");
    expect(market?.src, "寄卖窗口要有硬顶").toMatch(
      /inventoryWindow\(\s*inventory\.bagItems,\s*consignLimit\.value,\s*MARKET_RENDER_WINDOW/,
    );
    expect(market?.src, "续开必须回到同一份完整 bagItems").toMatch(
      /const shownBefore = consignPage\.value\.shown;[\s\S]{0,120}nextInventoryLimit\(\s*shownBefore,\s*inventory\.bagItems\.length\)/,
    );
    expect(market?.src, "贡器候选同样不许一次铺满整包").toContain(
      'v-for="it in equipCandidatePage.visible"',
    );
    expect(market?.src, "贡器候选余件也要显式续开").toContain("equipCandidatePage.hidden > 0");
    expect(market?.src, "贡器候选窗口也要能回看并封顶").toContain('data-market-prev="equip"');
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
    // 顶满判据要随钟走:读 useNow 的响应式读数(与修行快捷卡同一把钟)——
    // 药效到期后「服 用」自己亮回来,不许停在一次读出的灰里直到重开弹窗
    expect(inv?.src, "顶满判据要读响应式 now.value,不读一次性 Date.now()").toContain(
      "buffOverflowOf(cult.buffs, def.buffId, now.value)",
    );
    // 拆分后轮回弹窗归 RebirthDialog,兵解置灰判据随本体改指子面板
    const char = FILES.find((f) => f.path === "components/character/RebirthDialog.vue");
    expect(char?.src, "兵解未达境要置灰(canRebirth)").toContain(':disabled="!canRebirth"');
    expect(char?.src, "兵解置灰要列门槛境名,不许只有定性").toContain("境方可自行兵解");
  });

  it("修行快捷丹药超过四味要报余量并直达丹匣,不许静默截断", () => {
    // 修行页按品阶取前四味做速服入口；玩家收着更多可服丹药时，旧实现直接 slice，
    // 既不说还有几味，也没有去丹匣的入口 —— 最该服的那几味反而可能永远看不见。
    const cult = FILES.find((f) => f.path === "views/CultivationView.vue");
    expect(cult?.src, "快捷栏要先保留完整候选再切前四味").toMatch(
      /const quickPills = computed\(\(\) => quickPillRows\.value\.slice\(0, QUICK_PILL_LIMIT\)\)/,
    );
    expect(cult?.src, "隐藏数必须由全量候选与现列条目同源相减").toMatch(
      /const quickPillsHidden = computed\([\s\S]{0,120}quickPillRows\.value\.length - quickPills\.value\.length/,
    );
    expect(cult?.src, "余量不能只活在 computed 里").toContain("data-quick-pills-hidden");
    expect(cult?.src, "余量入口要直达丹匣页签").toMatch(
      /<RouterLink[\s\S]{0,300}path:\s*['"]\/inventory['"][\s\S]{0,120}tab:\s*['"]pill['"]/,
    );

    const inv = FILES.find((f) => f.path === "views/InventoryView.vue");
    expect(inv?.src, "背包要认 ?tab=pill，否则直达入口仍落在装备页").toContain(
      'useRouteTab(INVENTORY_CHAPTERS, "equip")',
    );
    const routeTab = readFileSync(resolve(SRC, "composables/useRouteTab.ts"), "utf8");
    expect(routeTab, "分册 query 与选中态必须由同一处接线").toContain("route.query.tab");
    expect(routeTab, "页面内换签也要把落点写回地址").toContain("router.replace");
  });

  it("构筑对照不许只给最近八则 —— 道痕余量可续开,旧构筑仍可达", () => {
    // 道痕最多留 60 则，构筑对照却只切最近 8 则：再往前的历史构筑既没有计数，
    // 也没有续开入口，玩家会以为道痕里只剩这些。全量候选与可见窗必须分开。
    const build = FILES.find((f) => f.path === "views/BuildView.vue");
    expect(build?.src, "先保留全部可比道痕").toContain("const compareRows = computed");
    expect(build?.src, "可见窗走长列表同一把尺").toMatch(
      /const comparePage = computed\([\s\S]{0,160}listWindow\(compareRows\.value, compareLimit\.value\)/,
    );
    expect(build?.src, "续开必须按全量道痕收敛").toMatch(
      /nextListLimit\(\s*comparePage\.value\.shown,\s*compareRows\.value\.length,\s*COMPARE_BATCH,?\s*\)/,
    );
    expect(build?.src, "每条候选要有稳定判据").toContain("data-compare-candidate");
    expect(build?.src, "余量不能静默消失").toContain("data-compare-more");
  });

  it("历世履历再长也要分批回看 —— 不许把整部家谱一次塞进 DOM", () => {
    const legacy = FILES.find((f) => f.path === "views/LegacyView.vue");
    expect(legacy?.src, "履历要有独立的可见窗").toMatch(
      /const lifePage = computed\([\s\S]{0,160}listWindow\(\s*lifeRows\.value,\s*lifeLimit\.value,\s*LIFE_RENDER_WINDOW,?\s*\)/,
    );
    expect(legacy?.src, "只渲染当前窗内的历世").toContain("lifePage.visible");
    expect(legacy?.src, "余下的历世要能续开").toContain("data-life-more");
    expect(legacy?.src, "滑走的首批要能回翻").toContain("data-life-prev");
    expect(
      legacy?.src.indexOf("data-life-more"),
      "续开要排在当前批之后:读完这一世再往下走,不必滚回册首找按钮",
    ).toBeGreaterThan(legacy?.src.indexOf('v-for="l in lifePage.visible"') ?? -1);
  });

  it("行迹录只列八则时也要有回头路 —— 总数与清单必须同源", () => {
    const legacy = FILES.find((f) => f.path === "views/LegacyView.vue");
    expect(legacy?.src, "旧回响不许被 slice 永久藏掉").not.toContain(".slice(0, 8)");
    expect(legacy?.src, "总数直接取完整清单").toMatch(
      /const lossTotal = computed\(\(\) => lossRows\.value\.length\)/,
    );
    expect(legacy?.src, "行迹也走同一个长列表窗口").toMatch(
      /const lossPage = computed\([\s\S]{0,160}listWindow\(\s*lossRows\.value,\s*lossLimit\.value,\s*LOSS_RENDER_WINDOW,?\s*\)/,
    );
    expect(legacy?.src, "旧回响要能续开").toContain("data-loss-more");
    expect(legacy?.src, "滑走的旧回响要能回翻").toContain("data-loss-prev");
    expect(
      legacy?.src.indexOf("data-loss-more"),
      "行迹续开也要排在当前批之后,与历世履历同向",
    ).toBeGreaterThan(legacy?.src.indexOf('v-for="l in lossPage.visible"') ?? -1);
  });

  it("历世同行再长也只铺当前窗 —— 最近一段先见，旧缘仍可回看", () => {
    // 道侣履历每世追加一笔，却没有上限；弹窗曾把整份履历一次铺进固定滚动框，
    // 而且按追加顺序最旧在前 —— 玩家打开只看见最早几世，最近一段反而埋在底部。
    const bond = FILES.find((f) => f.path === "components/character/BondDialog.vue");
    expect(bond?.src, "最近一段同行先出现").toContain("[...pastBonds.value].reverse()");
    expect(bond?.src, "履历走同一套长列表窗口").toMatch(
      /const pastBondPage = computed\([\s\S]{0,180}listWindow\(\s*pastBondRows\.value,\s*bondHistoryLimit\.value,\s*BOND_HISTORY_RENDER_WINDOW,?\s*\)/,
    );
    expect(bond?.src, "只渲染当前窗内的旧缘").toContain("pastBondPage.visible");
    expect(bond?.src, "余下的旧缘要能续开").toContain("data-bond-history-more");
    expect(bond?.src, "滑走的旧缘要能回翻").toContain("data-bond-history-prev");
  });

  it("器魂两册再长也只铺当前窗 —— 闲置形意与可凝法器都能分批回看", () => {
    // 器魂没有持有上限，可凝法器也会随背包一起增长；两册若整份铺进 max-h-64，
    // DOM 会跟着存档无限长大。两册都走同一套列表窗口，并让高品阶先见。
    const souls = FILES.find((f) => f.path === "views/SoulsView.vue");
    expect(souls?.src, "闲置形意按品阶降序").toMatch(
      /const idleSoulRows = computed\([\s\S]{0,220}\.sort\(\s*\(a, b\) =>[\s\S]{0,80}b\.grade - a\.grade/,
    );
    expect(souls?.src, "闲置形意走同一套列表窗口").toMatch(
      /const idleSoulPage = computed\([\s\S]{0,180}listWindow\(\s*idleSoulRows\.value,\s*idleSoulLimit\.value,\s*SOUL_RENDER_WINDOW/,
    );
    expect(souls?.src, "可凝法器按品质与层级降序").toMatch(
      /const refinableRows = computed\([\s\S]{0,260}\.sort\(\s*\(a, b\) =>[\s\S]{0,140}qualityDef\(b\.inst\.quality\)\.rank[\s\S]{0,160}b\.inst\.tier/,
    );
    expect(souls?.src, "可凝法器走同一套列表窗口").toMatch(
      /const refinablePage = computed\([\s\S]{0,180}listWindow\(\s*refinableRows\.value,\s*refinableLimit\.value,\s*SOUL_RENDER_WINDOW/,
    );
    expect(souls?.src, "两册都只渲染当前窗").toContain("idleSoulPage.visible");
    expect(souls?.src).toContain("refinablePage.visible");
    for (const marker of [
      "data-soul-idle-more",
      "data-soul-idle-prev",
      "data-soul-forge-more",
      "data-soul-forge-prev",
    ]) {
      expect(souls?.src, `缺少 ${marker}`).toContain(marker);
    }
  });

  it("器魂卷首、天界入口与凝炼台共用一份可凝与道源汇总", () => {
    // 「可凝」曾只数行囊资格:道源不够时入口仍写 N 件可凝,点进去才看到付不起。
    // 现在卷首、入口、凝炼台与天界入口都读 core/soulOverview 的同一份账。
    const souls = FILES.find((f) => f.path === "views/SoulsView.vue");
    expect(souls?.src, "卷首先报此刻").toContain("data-soul-pulse");
    expect(souls?.src, "可做判据收进 core").toContain("soulOverview(");
    expect(souls?.src, "入口读同一份可凝数").toContain("soulPulse.affordableRefines");
    expect(souls?.src, "付不起要列短差").toContain("soulPulse.shortfall");
    expect(souls?.src, "视图不再自行过滤可凝件").not.toContain("const refinable = computed");

    const celestial = FILES.find((f) => f.path === "views/CelestialView.vue");
    expect(celestial?.src, "天界入口也读同一份槽位账").toContain("soulOverview(");
    expect(celestial?.src, "入口报的是同一份已凝数").toContain("soulPulse.activeCount");
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

  it("炉前亮存货账 —— 存 N 与药力状态,炼制决策不许半盲", () => {
    // 炉台此前只摊把握/双成/代价/短差,不摊行囊里已存几枚 —— 行囊躺着 8 枚顶满丹
    // 也照炼不误,炼出来白占一格。方子行亮「存 N」(读 inventory.pills,与丹匣同一份账),
    // 增益丹再亮药力状态(已顶/将顶);判据与服用侧同一把尺(buffOverflowOf)+
    // 同一把响应式钟(useNow),拆分后都住在 composables/useBrewing.ts。
    const brew = FILES.find((f) => f.path === "components/inventory/BrewingDialog.vue");
    expect(brew?.src, "方子行要亮存 N").toContain("存 {{ r.stock }}");
    expect(brew?.src, "顶满要就地写「已顶」(与服用侧同族措辞)").toContain("已顶");
    expect(brew?.src, "将顶要亮(amber 金赭,与突破已封顶同族)").toContain("将顶");
    const src = readFileSync(join(SRC, "composables/useBrewing.ts"), "utf-8");
    expect(src, "存货读 inventory.pills,不另数一遍").toContain("inventory.pills[id] ?? 0");
    expect(src, "药力判据读 buffOverflowOf + 响应式 now.value(同一把尺同一把钟)").toContain(
      "buffOverflowOf(cult.buffs, def.buffId, now.value)",
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
    /*
     * 收徒价:这条从前要求"界面与 store 都读 APPRENTICE_RECRUIT_TIER_AMOUNT"。
     * 那是**同一个公式的两个副本**——两处各自 stoneByTier(major, 常量),
     * 改参数或公式时报价与实际扣费会分家,而两边都"算对了"。现在收口成
     * service 里的一处实现,界面与 store 都调它;判据随之改为:
     * 常量只许住在 service 里,别处一律走函数。
     */
    const av = readFileSync(resolve(__dirname, "../views/ApprenticeView.vue"), "utf-8");
    expect(av, "收徒价签该调 service 那一处实现,不许手写 30").toContain("apprenticeRecruitCost");
    expect(av, "界面不该再直接引用收徒档常量 —— 它只该住在 service 那一处").not.toContain(
      "APPRENTICE_RECRUIT_TIER_AMOUNT",
    );
    const apprStore = readFileSync(resolve(__dirname, "../stores/apprentice.ts"), "utf-8");
    expect(apprStore, "扣费也该调同一处实现").toContain("apprenticeRecruitCost");
    expect(apprStore, "store 不该再直接引用收徒档常量 —— 那正是报价与扣费分家的根源").not.toContain(
      "APPRENTICE_RECRUIT_TIER_AMOUNT",
    );
    expect(
      readFileSync(resolve(__dirname, "./apprenticeService.ts"), "utf-8"),
      "常量的唯一住处:报价与扣费共用的那一处",
    ).toContain("APPRENTICE_RECRUIT_TIER_AMOUNT");
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

  it("门庭卷首先报在途、闲置与最近归期 —— 差事进度同走纯函数", () => {
    // 弟子卡原先只在路上时给一个倒计时,页面上没有一眼可读的「几个人在家、几个人
    // 在途、最近谁先回来」;一键派发也不报这次会派走几人。汇总若散在模板里各数一遍,
    // 迟早出现卷首与按钮对不上。故卷首、按钮与逐单进度都接同一份 core 真值。
    const appr = FILES.find((f) => f.path === "views/ApprenticeView.vue");
    expect(appr?.src, "门庭汇总要调 apprenticeOverview").toContain("apprenticeOverview(");
    expect(appr?.src, "卷首要挂稳定落点").toContain("data-apprentice-pulse");
    expect(appr?.src, "在途/闲置读同一份 pulse").toContain("pulse.away");
    expect(appr?.src, "最近归期读同一份 pulse").toContain("pulse.value.nextReturnAt");
    expect(appr?.src, "派发文案要报这次派走几人").toContain("pulse.value.idle");
    expect(appr?.src, "逐单进度要调纯函数").toContain("apprenticeTaskProgress(a.task");
    expect(appr?.src, "进度条要有读屏语义").toContain('role="progressbar"');
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
    expect(cult?.src, "没有伤势时连入口都不出现,短差句也不许单独挂出来").toContain(
      "if (!repair.value.injured || repair.value.affordable) return null;",
    );
    expect(cult?.src, "短差句要与突破钮共用同一枚展示").toContain("<QiShortfallNote");
    expect(cult?.src, "短差值接共享展示").toContain(':short="repairBlock.short"');
    expect(cult?.src, "回够时长接共享展示").toContain(':eta="repairBlock.eta"');
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

  it("建筑卡默认收口详情,主升级键先露 —— 完整效果与连升账要点得开", () => {
    // 一张卡同时铺当前效果、下一级、连升成本、连升净得与联动信息,390 双列时
    // 卡面像账本,首屏只剩阅读没有行动。卡面只留「当前首项 + 下一级首项 + 主键」,
    // 完整效果、联动与连升账收进 disclosure;展开态必须报给读屏。
    const b = FILES.find((f) => f.path === "components/dongfu/BuildingCard.vue");
    expect(b?.src, "主升级键要有稳定运行时指纹").toContain("data-building-action");
    expect(b?.src, "详情开关要有稳定运行时指纹").toContain("data-building-detail-toggle");
    expect(b?.src, "详情开关要把展开态报给读屏").toContain(':aria-expanded="detailsOpen"');
    expect(b?.src, "详情开关要关联正文").toContain(':aria-controls="detailId"');
    expect(b?.src, "详情正文默认收起").toMatch(/<div v-show="detailsOpen" :id="detailId"/);
    expect(b?.src, "收起态要留完整效果入口").toContain("当前效果");
    expect(b?.src, "收起态要留连升入口").toContain("连升×{{ batch.levels }}");

    const layout = readFileSync(resolve(__dirname, "../../scripts/layout-check.mjs"), "utf8");
    expect(layout, "390 首屏要实测首枚可用升级键").toContain(
      '["洞府首屏的营造优先", taskDongfuFold]',
    );
    expect(layout, "运行时门要按稳定指纹找主升级键").toContain(
      'document.querySelectorAll("[data-building-action]:not([disabled])")',
    );
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
    const row =
      home?.src.match(
        /<div class="flex flex-wrap items-center gap-x-1\.5 gap-y-0\.5">[\s\S]{0,400}/,
      )?.[0] ?? "";
    expect(row).toContain("flex flex-wrap");
    // 只钉「不折」这件事(whitespace-nowrap + shrink-0 + 楷体),字号不进判据 ——
    // 字阶归「主巡页 · 字阶同一套」管,一条判据只管一件事,改字号不该打红布局判据。
    expect(row).toMatch(
      /shrink-0 whitespace-nowrap font-kai text-(?:note|body|title|section|heading) tracking-widest/,
    );
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

  it("洞府巡游的离开键只留动作,后果单独说 —— 195px 下短标签不许被括号挤折", () => {
    const cave = FILES.find((f) => f.path === "components/dongfu/CaveEventModal.vue");
    expect(cave?.src, "离开后的后果要单独成行").toContain("离开后,今日不再巡游");
    expect(cave?.src, "按钮只留短动作并锁一行").toMatch(
      /class="btn-ghost tap-row w-full"[^>]*>离 开<\/button>/,
    );
    expect(cave?.src, "后果句不许再塞回按钮标签").not.toContain("离 开(今日不再巡游)");
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
    expect(s?.src, "残缺备份要在确认框点名缺片,不能导入后才少一块").toContain(
      "importInspect.skipped",
    );
    expect(s?.src, "缺 player/game 的备份必须禁用导入按钮").toContain(
      "importInspect?.missingCritical === true",
    );
    expect(s?.src, "关键分片缺失要把原因摊在按钮上方,不能只留一个灰色按钮").toContain(
      "importInspect.skipped.length || importInspect.missingCritical",
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

  it("流派名单源 —— 道途发现页与模拟矩阵都由 BUILD_STYLES 派生", () => {
    // 六大流派短名此前在空态与 buildSim 矩阵各抄一份,新增/改名一侧另一侧不跟。
    const bd = readFileSync(resolve(__dirname, "../core/buildDetect.ts"), "utf-8");
    expect(bd, "发现页读数要从 BUILD_STYLES 逐路计算").toContain("BUILD_STYLES.map");
    const discovery = FILES.find((f) => f.path === "components/build/BuildDiscovery.vue");
    expect(discovery?.src, "每一路的名字从行数据读").toContain("{{ row.style.name }}");
    expect(discovery?.src, "发现页不手抄任何流派名").not.toMatch(
      /背水流|罡盾流|反震流|连击流|沐泽流|锋芒流/,
    );
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

  it("道痕是独立册 —— 道途页不许混入履历,marks 页签必须真挂面板", () => {
    // 拆分面板时,条件一度写成 celTab === 'dao':于是道途册同时铺下道途与整卷道痕,
    // 而点「道痕」册反而什么都不出现。这不是布局噪声,是页签承诺与内容对不上。
    const cel = FILES.find((f) => f.path === "views/CelestialView.vue");
    expect(cel?.src, "道痕面板必须挂在 marks 页签").toMatch(
      /<MarksPanel\s+v-else-if="celTab === 'marks'"/,
    );
    expect(cel?.src, "道途册不许再挂道痕面板").not.toMatch(
      /<MarksPanel\s+v-else-if="celTab === 'dao'"/,
    );
  });

  it("道痕 60 则按批回看 —— 只铺当前窗,续开与回翻都把焦点送到新内容", () => {
    // max-h-64 只裁眼睛看到的高度,不裁 DOM。满卷 60 则每则都带忆战/重写动作,
    // 整卷铺开会把页签切换拖成一次大渲染;窗口仍须覆盖完整履历并可前后回看。
    const cel = FILES.find((f) => f.path === "components/celestial/MarksPanel.vue");
    expect(cel?.src, "道痕要使用共享窗口而不是整卷 v-for").toContain("listWindow(endgame.marks,");
    expect(cel?.src, "每批 12 则、最多同时保留两批").toMatch(
      /MARKS_RENDER_BATCH = 12[\s\S]{0,120}MARKS_RENDER_WINDOW = MARKS_RENDER_BATCH \* 2/,
    );
    for (const contract of [
      "data-marks-total",
      "data-marks-shown",
      "data-marks-start",
      "data-mark-row",
      "data-marks-more",
      "data-marks-prev",
      "focusMarksRow",
    ]) {
      expect(cel?.src, `道痕分页缺少 ${contract} 契约`).toContain(contract);
    }
    expect(cel?.src, "续开要聚焦新露出的第一则").toContain(
      "firstNewVisibleIndex(shownBefore, shownAfter, MARKS_RENDER_WINDOW)",
    );
    expect(cel?.src, "回翻要聚焦当前窗首则").toMatch(
      /showPreviousMarks\(\)[\s\S]{0,400}focusMarksRow\(\)/,
    );
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
    const css = readStyleCss();
    expect(css, "seal-breathe 的帧定义被删了 —— 归来印退回瞬显").toMatch(/@keyframes seal-breathe/);
    const tw = readFileSync(resolve(__dirname, "../../tailwind.config.js"), "utf-8");
    expect(
      tw,
      "seal-breathe 只许由伪元素承载 —— 同名 Tailwind 工具会把归来印本体也一起淡掉",
    ).not.toContain(`"seal-breathe": "seal-breathe`);
  });

  it("呼吸辉光只动伪元素 —— 不许生成会盖掉 animation:none 的同名工具", () => {
    const css = readStyleCss();
    const tw = readFileSync(resolve(__dirname, "../../tailwind.config.js"), "utf-8");

    for (const name of ["glow-pulse", "seal-breathe"]) {
      expect(tw, `${name} 不该再生成同名 Tailwind animation 工具`).not.toMatch(
        new RegExp(`"${name}"\\s*:\\s*"${name}`),
      );
      expect(css, `${name} 的宿主必须停掉本体动画`).toMatch(
        new RegExp(`\\.animate-${name}\\s*\\{[^}]*animation:\\s*none;`),
      );
      expect(css, `${name} 的呼吸必须落在伪元素`).toMatch(
        new RegExp(`\\.animate-${name}::before\\s*\\{[^}]*animation:\\s*${name}`),
      );
    }
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
    expect(dlg?.src, "残页要缩写").toContain("+${formatNum(s.page)}");
    expect(dlg?.src, "器灵尘总额要缩写").toContain("+${formatNum(s.dust)}");
    expect(dlg?.src, "回收件数只报件数,化尘额不重复记第二遍").toContain("已折入器灵尘");
    expect(dlg?.src, "回收件数取结算回执,不能从装备清单二次猜").toContain("s.recycledEquipment");
    expect(dlg?.src, "区域之主战要单列胜负,不能混进寻常历练").toContain("s.bossBattles");
    expect(dlg?.src, "丹药/法宝等无法从总差额区分的际遇所得要逐项可见").toContain("eventReceipts");
    expect(dlg?.src, "际遇明细要有自己的标题,不能混进普通资源行").toContain("际遇结果");
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
    const css = readStyleCss();
    expect(
      css,
      "chip-ink 基类要有 :active 按压反馈(限 button —— 装饰性 chip 是 span,不该有按压态)",
    ).toMatch(/button\.chip-ink:active:not\(:disabled\)/);
    expect(css, "chip-ink 要带 transition(弹簧感,与 btn-ghost 同款)").toMatch(
      /^[ \t]*\.chip-ink \{[\s\S]{0,300}transition:/m,
    );
    // 拆分后逆旅契试炼卡归 RebirthDialog,判据随本体改指子面板
    const char = FILES.find((f) => f.path === "components/character/RebirthDialog.vue");
    expect(char?.src, "卡状可点元素(试炼卡)也要带按压反馈").toContain("active:scale-99");
  });

  it("可交互 chip 自己守 28px 触控下限,装饰 chip 不跟着变胖", () => {
    /*
     * chip-ink 原本只有 22.5px 高,修行页的状态胶囊在后期档被排版门抓红。
     * 触控下限只该落在交互按钮上;品阶、首领等 span 装饰 chip 尺寸不应被连带改掉。
     */
    const css = readStyleCss();
    expect(css, "button.chip-ink 要自带 28px 最小高度").toMatch(
      /button\.chip-ink\s*\{[^}]*min-height:\s*28px;/s,
    );
    expect(css, "装饰用的 chip-ink 基类不该整体抬高").not.toMatch(
      /^[ \t]*\.chip-ink\s*\{[^}]*min-height:/ms,
    );
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

  it("人物子页返回控件齐 —— 四个册页共用「人物」父页兜底", () => {
    // /titles /collection /build /legacy 都是 CharacterView 的子目标。统一卷首
    // 保留父页兜底,冷启动直达时也不会被裸 back() 送出游戏。
    for (const f of ["TitlesView", "CollectionView", "BuildView", "LegacyView"]) {
      const src = FILES.find((x) => x.path === `views/${f}.vue`)?.src ?? "";
      expect(src, `${f} 要接共同卷首`).toContain("<FolioPageHeader");
      expect(src, `${f} 的返回兜底要指向人物`).toContain('back-to="character"');
      expect(src, `${f} 的返回文案要写「人物」`).toContain('back-label="人物"');
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
    const css = readStyleCss();
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
    // 措辞可以变,意思不能丢:它参与成形校准,但**不改写历练里的战斗**。
    // 事实本身由 worldSemantics.spec 钉着(历练的合并点不含 mortalWorld)。
    expect(mw?.src, "要明说它不改写战斗,免得玩家以为真被降能").toContain("不改写历练里的战斗");
    expect(mw?.src, "同一条规则不要又叫「气象之名」").not.toContain("此世气象之名");
  });

  it("锁定路线只把可行动的那一段说一次,后段不再逐卡复读", () => {
    const worldView = FILES.find((f) => f.path === "views/MortalWorldView.vue");
    expect(worldView?.src, "路线阶段提示要来自统一判据").toContain("mortalStageStatuses");
    expect(worldView?.src, "眼下可去的那一段要有明确记号").toContain("眼下可往");
    expect(worldView?.src, "紧随其后的锁定段要给唯一前置").toContain("须先通");
    expect(worldView?.src, "更后面的锁定段只描述相对位置").toContain("尚在前路之后");
    expect(worldView?.src, "不许逐卡重复同一个全局目的地").not.toContain(
      "entryBlockReason(p.regionId)",
    );
  });

  it("本世地界的出发钮服从统一准入 —— 旧链已开的中段不能只画锁", () => {
    /*
     * 旧链全开的老存档可以绕开路线顺序,这是 `canEnterRegion` 已明确接受的
     * 兼容代价;但世界页此前仍只看 `canEnterNode`,把路线中段画成锁并写
     * 「须先通」,而玩家从历练页其实能直接出发。两个入口对同一处地界说
     * 两套话,正是这轮要收掉的裂缝。
     */
    const worldView = FILES.find((f) => f.path === "views/MortalWorldView.vue");
    expect(worldView?.src, "出发资格要读统一准入谓词").toMatch(
      /function canDepart\(regionId: string\): boolean \{\s*return canEnterRegion\(regionId\);/,
    );
    expect(worldView?.src, "按钮条件也要用同一个谓词").toContain('v-if="canDepart(p.regionId)"');
    expect(worldView?.src, "锁图标与拦截理由不能再只认路线顺序").not.toContain(
      "unlocked(p.nodeId)",
    );
    expect(worldView?.src, "旧链可先行时要给玩家一个可见状态").toContain("旧路可往");
  });

  it("山河行旅图三种阶段同时有图形、文字与读屏名,不只靠颜色", () => {
    const map = FILES.find((f) => f.path === "components/world/MortalRouteMap.vue");
    expect(map?.src, "路线图要挂稳定落点,运行时与判据才认得出它").toContain("data-world-route-map");
    expect(map?.src, "图本身要有随阶段与段数变化的可访问名").toContain("mapLabel");
    expect(map?.src, "已通不能只剩绿色圆点").toContain(">已通");
    expect(map?.src, "眼下不能只剩石青圆点").toContain(">眼下");
    expect(map?.src, "未至不能只剩虚线框").toContain(">未至");
    expect(map?.src, "路线笔路要走可单测的手卷函数").toContain("smoothRoutePath");
    expect(map?.src, "已走实线要停在最后已通节点,不许按整条路等比例越界").toContain(
      "clearedRoutePath",
    );
    expect(map?.src, "阶段状态仍由 mortalStageStatuses 的同一份结果驱动").toContain(
      "MortalStageStatus[]",
    );
  });

  it("历练页的行旅条复用世界视图与阶段判据,不另造一套进度", () => {
    const adventure = FILES.find((f) => f.path === "views/AdventureView.vue");
    const ribbon = FILES.find((f) => f.path === "components/world/MortalWorldRibbon.vue");
    expect(adventure?.src, "历练页要真的挂上行旅条").toContain("<MortalWorldRibbon");
    expect(adventure?.src, "首次进历练时本世之界要凝成,不能只等观象页").toContain(
      "if (!adventure.mortalWorld) ensureMortalWorld()",
    );
    expect(adventure?.src, "进度只认 mortalStageStatuses").toContain("mortalStageStatuses(");
    expect(adventure?.src, "世界名与路线只认 worldView").toContain("worldView(");
    expect(ribbon?.src, "行旅条要挂稳定落点").toContain("data-world-ribbon");
    expect(ribbon?.src, "行旅条读同一份世界视图").toContain("WorldView | null");
    expect(ribbon?.src, "行旅条读同一份阶段结果").toContain("MortalStageStatus[]");
    expect(ribbon?.src, "读屏名要带进度与眼下去处").toContain("linkLabel");
  });

  it("历练首屏先给主线:卷首在秘境支线之前,支线默认收口", () => {
    const adventure = FILES.find((f) => f.path === "views/AdventureView.vue");
    const src = adventure?.src ?? "";
    const titleAt = src.search(/<FolioPageHeader[\s\S]{0,180}\btitle="历练"/);
    const secretAt = src.indexOf("<SecretRealmCard");
    expect(titleAt, "历练卷首要能找到").toBeGreaterThan(-1);
    expect(secretAt, "秘境卡要能找到").toBeGreaterThan(titleAt);
    expect(src, "地界列表要挂稳定落点").toContain("data-adventure-regions");
    const secret = FILES.find((f) => f.path === "components/adventure/SecretRealmCard.vue");
    expect(secret?.src, "未入秘境时卡默认收起").toContain("const cardExpanded = ref(false)");
    expect(secret?.src, "收起态要留展开入口").toContain("data-secret-realm-card-toggle");
    expect(secret?.src, "只有展开或已在境中才露出名录").toContain('v-show="state || cardExpanded"');
  });

  it("行旅条说眼下可往时,历练列表必须把同一段路摆在可见首位", () => {
    const adventure = FILES.find((f) => f.path === "views/AdventureView.vue");
    expect(adventure?.src, "可见范围要收口到可单测的同一实现").toContain("visibleRegionRows(");
    expect(adventure?.src, "当前段要从阶段判据反查区域,不许另猜").toContain("currentRouteRegionId");
    expect(adventure?.src, "当前段与首个可行动段都是可见钉子").toContain("pinned");
    expect(adventure?.src, "当前段要在卡上明说「本世眼下」").toContain("data-route-current");
    expect(adventure?.src, "当前界域要排到最前").toContain(
      "b.rows.some((row) => row.isRouteCurrent)",
    );
    expect(
      adventure?.src.match(/Number\(b\.isRouteCurrent\) - Number\(a\.isRouteCurrent\)/g),
      "当前卡也要在同界域内排到最前 —— 少这一层,高境界的长列表仍会把眼下埋掉",
    ).toHaveLength(1);
  });

  it("历练页的锁定原因只留一条:路线内说路线,路线外才退回旧链", () => {
    const adventure = FILES.find((f) => f.path === "views/AdventureView.vue");
    expect(adventure?.src, "旧链的「需先击败」只能在路线判据没有给出理由时兜底").toContain(
      'v-if="!row.canEnter && !row.blockReason"',
    );
    expect(adventure?.src, "路线内的拦截理由仍要显示").toContain('v-if="row.blockReason"');
  });

  it("前尘山河要把跨世世界史摊开,不让去重记录只活在 store 里", () => {
    const world = FILES.find((f) => f.path === "views/MortalWorldView.vue");
    expect(world?.src, "世界页要读取最近几世的历史").toContain("mortalWorldHistory");
    expect(world?.src, "历史行要复用当前世界的同一份视图翻译").toContain("historyRows");
    expect(world?.src, "历史册要有稳定落点给运行时门").toContain("data-world-history");
    expect(world?.src, "历史世界名与路线长度不许另拼一套").toContain("worldHistoryRows(");
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
  const usedSizes = usedTypeSizes;

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

  /**
   * 弹窗同族刻度 —— 扫描面是**全部**弹窗组件,不是手写清单。
   *
   * 原先这里列了六个文件。可是 components 下共有三十多个文件在用 BaseModal,
   * 剩下的二十来个**从来没被这条判据看过**:它们中间长着 12 / 13 / 9 私档
   * (EquipmentDetailDialog 三样齐全),而下面的页面字阶判据又只管 views ——
   * 于是"弹窗"这一整层成了两套判据之间的缝。
   *
   * 手写清单的通病不是"当时漏了谁",而是**它不会自己长**:新拆一个弹窗,
   * 不会有人想起来往表里补一行。故改为按依赖枚举:凡在 components/ 下、
   * 且用了 BaseModal 的文件,自动进扫描面。
   *
   * 刻度与页面同源(18/15/14/11/10),弹窗少一档 18(弹窗里不用匾额字);
   * 剩下的「不成行文」的字号(Graphic 印章单字、角标、图标框)按文件登记,
   * 每一条写明它是什么 —— 不写清理由的放行等于给下一处私档开后门。
   */
  it("弹窗同族刻度:16 / 15 / 14 / 11 / 10", () => {
    const DIALOG_TIERS = [16, 15, 14, 11, 10];
    /**
     * 弹窗里的「不成行文」字号 —— 印章单字、角标、图标框。
     *
     * 判据是「这段字是不是在读一句话」:行文走刻度,图形化标识另计。
     * 每条都必须写明度量的是什么,写不出来的就该改回刻度。
     */
    const DIALOG_GRAPHIC: Record<string, { sizes: number[]; why: string }> = {
      "components/common/BottomNavigation.vue": {
        sizes: [8],
        why: "导航角标(未读数)的极小字,量的是圆点直径不是行文",
      },
      "components/adventure/CombatPanel.vue": { sizes: [9], why: "战报里数值增减的角标" },
      "components/adventure/SecretRealmCard.vue": { sizes: [9], why: "秘境类别的角标" },
      "components/adventure/BattleIntelPanel.vue": { sizes: [9], why: "敌情标签的角标" },
      "components/common/QualitySeal.vue": { sizes: [9], why: "品质印章小号的单字" },
      "components/equipment/EquipmentDetailDialog.vue": {
        sizes: [9],
        why: "品质印章的小号单字 —— 量的是印章直径,不是行文",
      },
      "components/character/RebirthDialog.vue": {
        sizes: [18],
        why: "道果主读数 —— 整张轮回弹窗的第一眼就是它,量的是读数不是行文",
      },
      "components/opening/OpeningPact.vue": {
        sizes: [18],
        why: "入山契的朱砂契印单字 —— 量的是印面标识,不是行文",
      },
    };
    const dialogs = FILES.filter(
      (f) =>
        f.path.startsWith("components/") && f.path.endsWith(".vue") && f.src.includes("<BaseModal"),
    );
    // 防空转:枚举真的找到了弹窗,不是路径写错后"零个文件零个违规"
    expect(dialogs.length, "一个弹窗都没扫到 —— 枚举路径写错了").toBeGreaterThanOrEqual(20);
    for (const dlg of dialogs) {
      const extra = DIALOG_GRAPHIC[dlg.path];
      const allow = extra ? [...DIALOG_TIERS, ...extra.sizes] : DIALOG_TIERS;
      const off = [...new Set(usedSizes(dlg.src))].filter((n) => !allow.includes(n));
      expect(
        off,
        `${dlg.path} 冒出了同族刻度以外的字号:${off.join(", ")}${
          extra ? `(本文件已放行:${extra.why})` : ""
        }`,
      ).toEqual([]);
    }
  });

  it("判据自证:认得出越档的坏样本", () => {
    const bad = usedTypeSizes('<p class="text-[13px]">x</p><p class="text-[9px]">y</p>');
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
    "components/adventure/SecretRealmCard.vue",
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
    "views/CharacterView.vue": { sizes: [20], why: "卷首战力主读数" },
    "views/DongfuView.vue": { sizes: [30], why: "营造总账的已营主读数" },
    /*
     * 首屏两页的题字与印面是「这一作的门面」,它们的尺寸不属于页面字阶 ——
     * 字阶管的是「读」的层次,而 40~56 的题字与印章是「认」的图形。
     */
    "views/CreateView.vue": {
      sizes: [42, 26, 18, 16],
      why: "题字 · 灵根圆环里的字 · 修行倍率主读数 · 「踏入仙途」主钮",
    },
    "views/WelcomeView.vue": { sizes: [46, 40, 17], why: "印面「道」· 题字 · 主钮" },
    /*
     * 文本输入框的 16px 不是「行文字阶」,是 iOS 的一条硬门槛:输入框**计算字号 <16px**
     * 时一聚焦就自动放大页面并把它居中(玩家得手动捏回去)。这条门槛与「放开缩放」
     * 是一对:不放宽输入框,就只能靠 viewport 的 user-scalable=no 把整个页面缩放关掉。
     * 故输入框统一 16px 并在此登记 —— 它度量的是「能不能正常输入」,不是阅读层次。
     */
    "components/celestial/TrialPanel.vue": {
      sizes: [16],
      why: "挑战书命名输入框(防 iOS 聚焦放大)",
    },
  };

  for (const path of pages) {
    it(`${path} 不冒出页面字阶以外的私档`, () => {
      const view = FILES.find((f) => f.path === path);
      let src = view?.src ?? "";
      if (path === "views/DongfuView.vue") {
        const css = readStyleCss();
        const start = css.indexOf(".dongfu-masthead__meta");
        const end = css.indexOf("/*\n   * 道躯案", start);
        src += [
          FILES.find((f) => f.path === "components/dongfu/DongfuAtlas.vue")?.src ?? "",
          FILES.find((f) => f.path === "components/dongfu/DongfuGatewayRow.vue")?.src ?? "",
          css.slice(start, end),
        ].join("\n");
      }
      if (src.includes("@/components/common/LedgerHeader.vue")) {
        /*
         * 章首字阶已迁进共享案头；防空转要把组件结构与 style.css 里的案头字阶一起数，
         * 不能把抽组件误判成整页清空。结构本身仍由 ui/ledgerHeader.spec 另守。
         */
        const css = readStyleCss();
        const start = css.indexOf(".folio-ledger-head {");
        const end = css.indexOf("@media (max-width: 220px)", start);
        src += [
          FILES.find((f) => f.path === "components/common/LedgerHeader.vue")?.src ?? "",
          css.slice(start, end),
        ].join("\n");
      }
      const extra = NON_TEXT_ALLOW[path];
      const allow = extra ? [...PAGE_TIERS, ...extra.sizes] : PAGE_TIERS;
      const off = [...new Set(usedTypeSizes(src))].filter((n) => !allow.includes(n));
      expect(
        off,
        `${path} 冒出了页面字阶以外的字号:${off.join(", ")}${
          extra ? `(本页已放行:${extra.why})` : ""
        }`,
      ).toEqual([]);
      /*
       * 防空转:这页真在写字号,不是被整页清空换了一张绿。
       * 门庭把总账壳与账首交给共享组件后,页面自身仍保留四档真实字阶
       * (body / section / title / note);共享组件由各自的契约另守,
       * 不能为了凑数在页面里重复挂同一档 class。
       */
      expect(usedTypeSizes(src).length).toBeGreaterThanOrEqual(4);
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

describe("底部导航 · 当前位置与角标都要说给读屏", () => {
  /*
   * 由来:底栏用颜色 + 一枚朱砂短笔标「现在在哪一页」,看上去像「只有视觉」。
   * **实测不是**:RouterLink 在 exact-active 时会自己渲染 aria-current="page"
   * (vue-router 的 aria-current-value 默认值),读屏本来就知道当前在哪 —— 这一条
   * 是把它钉住,不是补一个新的。判据分两层:
   *   · 浏览器那层在 layout-check 的逐页巡览里:页签页恰有一枚、且指向当前路由;
   *   · 这里管「别把它换成手写链接、也别再手写第二份」—— 前者会一起丢掉 aria-current,
   *     后者是同一事实两套来源(route.name 与 exact-active 并不是同一个判据)。
   *
   * 真正的缺口是角标:背包那枚「3」会被念成「背包 3」,听起来像第 3 项 —— 它说的是
   * 「有几件新货」;修炼页那枚玉色圆点干脆 aria-hidden,读屏完全听不到「此刻可以
   * 破境」,而这恰好是本作最要紧的一次点击提示。两处都补 sr-only 等价物。
   */
  const nav = (): { path: string; src: string } | undefined =>
    FILES.find((f) => f.path === "components/common/BottomNavigation.vue");

  it("当前页签状态由 RouterLink 提供,不手写第二份", () => {
    expect(nav(), "底部导航不在扫描面里(判据会假绿)").toBeTruthy();
    expect(
      nav()?.src,
      "页签要用 RouterLink —— aria-current=page 是它按 exact-active 渲染的",
    ).toContain("<RouterLink");
    expect(
      nav()?.src,
      "手写 aria-current 是第二套真相(route.name ≠ exact-active),出分歧时没人说得清哪份对",
    ).not.toContain("aria-current");
  });

  it("两处只在视觉里的状态要有读屏等价物", () => {
    const src = nav()?.src ?? "";
    expect(src, "背包角标要说清是「几件新货」,不是一个孤零零的数字").toContain("件新物");
    expect(src, "破境圆点要念出「可破境」").toContain("(可破境)");
    expect(src, "角标的数字本身对读屏是噪音").toMatch(
      /v-if="tab\.name === 'inventory' && bagNewCount >= 2"[\s\S]{0,400}aria-hidden="true"/,
    );
  });

  it("判据自证:把 RouterLink 换成手写 a,「当前项」就没了来源", () => {
    const handwritten = `<a :href="tab.to" :class="route.name === tab.name ? 'text-cinnabar' : ''">`;
    expect(handwritten.includes("<RouterLink")).toBe(false);
    expect(handwritten.includes("aria-current")).toBe(false);
  });
});

describe("语义色类 —— 指向不存在的 token 就是静默无色", () => {
  /*
   * 这一条守的是「写了类名,产物里一个字节都没有」。
   *
   * Tailwind 对**不存在的 token** 不报错、不生成 —— 模板照写不误,浏览器照旧忽略。
   * 于是 `text-accent` 落到继承色、`border-ink/12` 连边框色都不给(退回默认灰)。
   * 这类缺陷行为测试看不见(元素在、字在、只是没颜色),人眼也容易当「设计就这样」。
   *
   * 实测抓到九处:词条转移的选中态(`text-accent` / `bg-accent/10` / `!border-accent`)、
   * 转移成功的绿字(`text-ink-success`)、两条短差的警示色(`text-ink-warn`)、
   * 备注输入框的焦点边(`focus:border-azure`)、三处分隔线(`border-ink/12` /
   * `border-violet-ink/12`)、导航卡徽标的 `border-current/50`。
   * 前四个指向**根本没定义**的 token(`accent` / `ink-success` / `ink-warn` / `azure`),
   * 后几个用了不在透明度档位里的 `/12`,以及 `currentColor` 不支持斜杠透明度。
   *
   * 判据按**配置本身**枚举,不抄白名单:色板 token 读 `tailwind.config.js` 的 colors,
   * 透明度档位读 theme.opacity(基础档 + 本地补的那几档)。新增 token 自动纳入,
   * 删了 token 而模板还在用,当场红。
   */
  const CFG = readFileSync(resolve(__dirname, "../../tailwind.config.js"), "utf-8");

  /** colors 里每个 withAlpha 的名字(含 DEFAULT 与纸/墨/朱三族的子键) */
  function paletteTokens(): Set<string> {
    const start = CFG.indexOf("colors: {");
    if (start < 0) throw new Error("tailwind.config.js 里找不到 colors —— 判据要跟着改");
    let depth = 0;
    let end = start;
    for (let i = start; i < CFG.length; i += 1) {
      if (CFG[i] === "{") depth += 1;
      else if (CFG[i] === "}") {
        depth -= 1;
        if (depth === 0) {
          end = i + 1;
          break;
        }
      }
    }
    const body = CFG.slice(start, end);
    const out = new Set<string>();
    for (const m of body.matchAll(/"([a-z-]+)":\s*withAlpha/g)) out.add(m[1]!);
    for (const m of body.matchAll(/\n\s{8}([a-z-]+):\s*withAlpha/g)) out.add(m[1]!);
    for (const m of body.matchAll(/([a-z-]+):\s*\{([^{}]*)\}/g)) {
      if (!m[2]!.includes("withAlpha")) continue;
      out.add(m[1]!);
      for (const sub of m[2]!.matchAll(/([a-z-]+):\s*withAlpha/g)) {
        if (sub[1] !== "DEFAULT") out.add(`${m[1]!}-${sub[1]!}`);
      }
    }
    return out;
  }

  /** 透明度档位:tailwind 基础步长 5 的 0..100,加上 theme.opacity 里补的那几档 */
  function opacitySteps(): Set<number> {
    const out = new Set<number>();
    for (let n = 0; n <= 100; n += 5) out.add(n);
    const block = /opacity:\s*\{([\s\S]*?)\}/.exec(CFG)?.[1] ?? "";
    for (const m of block.matchAll(/(\d+):\s*"/g)) out.add(Number(m[1]));
    return out;
  }

  const TOKENS = paletteTokens();
  const STEPS = opacitySteps();

  /**
   * 一个「颜色类」的形状:`前缀-名字` 或 `前缀-名字/透明度`。
   * 不是颜色类的一律排除 —— 尺寸(text-lg)、方向与线型(border-l-2 / border-dashed)、
   * 关键字(bg-none / text-center)、CSS 属性(border-color)都不在此列。
   */
  const COLOR_UTIL =
    /(?<![\w-])(?:bg|border|text|from|via|to|decoration|divide|outline|fill|placeholder)-([a-z][a-z0-9-]*?)(?:\/(\d+))?(?=[\s"'`]|$)/g;
  const NON_COLOR = new Set([
    // 方向与线型:border-t / border-l / divide-y 都是「哪一边」,不是颜色
    "l",
    "r",
    "t",
    "b",
    "x",
    "y",
    "s",
    "e",
    "none",
    "solid",
    "dashed",
    "dotted",
    "double",
    "hidden",
    "full",
    "screen",
    "auto",
    "center",
    "left",
    "right",
    "justify",
    "ellipsis",
    "clip",
    "wrap",
    "nowrap",
    "balance",
    "pretty",
    "transparent",
    "current",
    "inherit",
    "white",
    "black",
    "origin",
    "color",
  ]);
  const TEXT_SIZES = new Set([
    "xs",
    "sm",
    "base",
    "lg",
    "xl",
    "2xl",
    "3xl",
    "4xl",
    "5xl",
    "note",
    "body",
    "title",
    "section",
    "heading",
    "display",
  ]);

  /** 扫一段源码,回报「指向不存在的 token / 不在档位的透明度」的类名 */
  function deadColorClasses(src: string): string[] {
    const out: string[] = [];
    for (const m of src.matchAll(COLOR_UTIL)) {
      const name = m[1]!;
      const alpha = m[2];
      // currentColor 不支持斜杠透明度 —— 这条要在「非颜色名」放行之前判,否则永远够不到
      if (name === "current" && alpha !== undefined) {
        out.push(m[0]);
        continue;
      }
      if (NON_COLOR.has(name) || name.startsWith("gradient")) continue;
      if (/^\d+$/.test(name)) continue;
      // 方向 + 线宽(border-l-2)与方向 + 线型(border-t-dashed)都不是颜色
      if (/^[lrtbxyse]-\d+$/.test(name) || /^[lrtbxyse]-[a-z]+$/.test(name) === false) {
        if (/^[lrtbxyse]-\d+$/.test(name)) continue;
      }
      if (TEXT_SIZES.has(name)) continue;
      // border-l-qing/70 这类:方向 + 颜色
      const base = /^[lrtbxyse]-[a-z][a-z0-9-]*$/.test(name) ? name.slice(2) : name;
      const unknownToken = !TOKENS.has(base);
      const unknownAlpha = alpha !== undefined && !STEPS.has(Number(alpha));
      // currentColor 不支持斜杠透明度:border-current/50 永远生成不出来
      if (unknownToken || unknownAlpha) out.push(m[0]);
    }
    return out;
  }

  it("模板与样式里没有指向不存在 token 的颜色类", () => {
    const offenders: string[] = [];
    for (const f of FILES) {
      for (const cls of deadColorClasses(f.src)) offenders.push(`${f.path} → ${cls}`);
    }
    // .ts 里的色类(composable 返回的 class 串)也扫:它们不进 FILES
    const TS = ["composables/useBrewing.ts", "ui/itemText.ts", "ui/qualityTier.ts"];
    for (const rel of TS) {
      const src = readFileSync(resolve(__dirname, "..", rel), "utf-8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/^\s*\/\/.*$/gm, "");
      for (const cls of deadColorClasses(src)) offenders.push(`${rel} → ${cls}`);
    }
    expect(
      offenders,
      `这些颜色类指向不存在的 token 或不在档位的透明度 —— 产物里一个字节都不会生成:${offenders.join(" | ")}`,
    ).toEqual([]);
  });

  it("判据自证:九处真缺陷都认得出,合法类不误伤", () => {
    // 真缺陷(修前形态)
    for (const bad of [
      "text-accent",
      "bg-accent/10",
      "!border-accent",
      "text-ink-success",
      "text-ink-warn",
      "focus:border-azure",
      "border-ink/12",
      "border-violet-ink/12",
      "border-current/50",
    ]) {
      const hit = deadColorClasses(bad);
      expect(hit, `应认出 ${bad}`).toHaveLength(1);
      expect(bad.endsWith(hit[0]!), `认出的类名应当是 ${bad} 的尾巴,实际 ${hit[0]}`).toBe(true);
    }
    // 合法类(修后形态与全库常见写法)
    for (const ok of [
      "text-jade",
      "bg-cinnabar/6",
      "border-ink/15",
      "border-l-qing/70",
      "border-dashed",
      "text-lg",
      "bg-paper-deep/60",
      "text-ink-faint",
      "border-current",
      "bg-none",
      "text-center",
    ]) {
      expect(deadColorClasses(ok), `不该误伤 ${ok}`).toEqual([]);
    }
  });

  it("色板与档位都真读到了东西 —— 枚举失灵时这条会空转", () => {
    expect(TOKENS.size, "色板 token 一个都没读到").toBeGreaterThanOrEqual(15);
    expect(STEPS.has(6), "本地补的 6% 档没读到").toBe(true);
    expect(STEPS.has(12), "12 不在档位里,判据的前提变了").toBe(false);
  });
});

describe("样式层序 —— 角色定基线,调用处的工具类必须能盖", () => {
  /*
   * 这条守的是一次**静默失效**:角色类(card-ink / chip-ink / btn-seal / btn-ghost /
   * t-* / tap-row …)裸写在 `@tailwind utilities` 之后,同特指度下后出现的赢 ——
   * 于是模板里拼在角色上的工具类全部失效。实测 36 处:chip-ink 上的 `text-[10px]`
   * 仍是 11px、card-ink 上的 `border-dashed` 仍是实线、`bg-cinnabar/6` 与
   * `shadow-lg` 一个都没落地。最扎眼的一处:秘境卡「未解锁 = 虚线框」从上线起
   * 就没画出来过 —— 因为卡自己的 `border: 1px solid` 一直压着那两条工具类。
   *
   * 修法不是给每处补 `!`,是把角色挪进 `@layer shared` / `@layer page`:
   * utilities 层整体压在它们上面,
   * 角色定基线、调用处永远能盖。这条判据守两件事:
   *   一 那批角色确实在 shared / page 层里(挪出去就退回静默失效);
   *   二 层内的暗色覆写照旧按特指度生效(层不改变层内先后)。
   */
  const STYLE = readStyleCss();

  /**
   * 取**所有** `@layer shared` 与 `@layer page` 段的正文(按花括号配平)。
   *
   * 层可以开多次(排版角色一块、按钮与触达一块),判据要把它们合起来看 ——
   * 只取第一块会让第二块里的角色读成「在层外」,那是一条假红。
   */
  function layerBody(css: string): string {
    let out = "";
    for (const marker of ["@layer shared {", "@layer page {"]) {
      let from = 0;
      for (;;) {
        const start = css.indexOf(marker, from);
        if (start < 0) break;
        let depth = 0;
        let end = -1;
        for (let i = start; i < css.length; i += 1) {
          if (css[i] === "{") depth += 1;
          else if (css[i] === "}") {
            depth -= 1;
            if (depth === 0) {
              end = i + 1;
              break;
            }
          }
        }
        if (end < 0) throw new Error(`${marker} 没有配平的花括号`);
        out += `${css.slice(start, end)}\n`;
        from = end;
      }
    }
    if (out === "") throw new Error("style.css 里找不到 @layer shared / page —— 判据要跟着改");
    return out;
  }

  it("定基线的角色都在 shared / page 层里 —— 不许再裸写在 utilities 之后", () => {
    const layer = layerBody(STYLE);
    const roles = [
      "card-ink",
      "chip-ink",
      "btn-seal",
      "btn-ghost",
      "t-card",
      "t-entry",
      "t-item",
      "t-body",
      "t-note",
      "tap-row",
      "track-ink",
      "bar-fill",
      "tab-rail",
      "font-kai",
      "tabular",
    ];
    const outside = roles.filter((r) => !new RegExp(`^[ \\t]*\\.${r} \\{`, "m").test(layer));
    expect(
      outside,
      `这些角色还在层外 —— 同特指度下会盖掉调用处的工具类:${outside.join(", ")}`,
    ).toEqual([]);
  });

  it("层外的暗色覆写照旧生效 —— 层只管与 utilities 的先后,不管层内特指度", () => {
    // html[data-theme="dark"] .card-ink / .btn-seal 必须仍在源码里(层内先后不变)
    expect(STYLE, "暗色卡片顶光被搬走或删了").toMatch(/html\[data-theme="dark"\] \.card-ink \{/);
    expect(STYLE, "暗色印面被搬走或删了").toMatch(/html\[data-theme="dark"\] \.btn-seal \{/);
  });

  it("判据自证:层外的角色会被认出来", () => {
    const fake =
      "@layer shared {\n.btn-seal {\n  color: red;\n}\n}\n.tap-row {\n  display: flex;\n}\n";
    const layer = layerBody(fake);
    expect(/^[ \t]*\.tap-row \{/m.test(layer), "层外的 tap-row 应被认出来").toBe(false);
    expect(/^[ \t]*\.btn-seal \{/m.test(layer), "层内的 btn-seal 应被认出来").toBe(true);
  });
});

describe("禁用态 —— 压色不压字", () => {
  /*
   * 「灰掉」有两种做法,只有一种读得出来:
   *
   *   压色 —— 边框/底色让位,字保留一档能读的墨。禁用态那行字往往正是
   *          「为什么不让我点」(「尚差 N 道源」「修为未至圆满」),它是答案不是装饰。
   *   压字 —— 整块 `opacity-40`,字与底一起向对方靠。实测浅色 2.31:1、夜间 2.94:1,
   *          连 WCAG 的 3:1 门槛都够不着;而 `getComputedStyle().color` 读到的
   *          仍是压之前的值,源码里看着完全正常 —— 这正是它反复回流的原因。
   *
   * 真浏览器那道门(scripts/layout-check.mjs 的 dimDisabled)量的是合成之后的读数,
   * 但它只量得到**巡到的页面**。这条判据守源码面:凡是把禁用/不可用写成
   * 「整块压透明度」的,当场红。
   */
  const STYLE = readStyleCss();

  /** 一个 class 串里有没有「整块压透明度」的写法(按压态 active:opacity 不算) */
  function dimsWholeElement(cls: string): boolean {
    for (const tok of cls.split(/\s+/)) {
      if (/^(active|hover|focus|group|peer)[-:]/.test(tok)) continue;
      if (/^!?opacity-(\d+)$/.test(tok)) return true;
    }
    return false;
  }

  it("模板里不许用整块 opacity 表示禁用/不可用", () => {
    const offenders: string[] = [];
    for (const f of FILES) {
      for (const m of f.src.matchAll(/:class="([^"]*)"/g)) {
        const expr = m[1] ?? "";
        // 只看条件分支里的字面量:三元/对象的两个分支各是一段 class 串
        for (const lit of expr.matchAll(/'([^']*)'/g)) {
          if (dimsWholeElement(lit[1] ?? "")) offenders.push(`${f.path} → ${lit[1]}`);
        }
      }
      for (const m of f.src.matchAll(/class="([^"]*)"/g)) {
        const cls = m[1] ?? "";
        // 静态 class 里带 disabled:/aria-disabled: 前缀的透明度,是同一件事的变体
        if (/(?:disabled|aria-disabled):!?opacity-\d+/.test(cls))
          offenders.push(`${f.path} → ${cls}`);
        else if (dimsWholeElement(cls) && /:disabled=/.test(f.src)) {
          // 静态 opacity 落在「这个文件里有禁用按钮」的模板上,值得人看一眼
        }
      }
    }
    expect(
      offenders,
      `整块压透明度会把「为什么不让我点」那句一起压掉(实测 2.3~2.9:1)—— 改用压色:${offenders.join(" | ")}`,
    ).toEqual([]);
  });

  it("判据自证:按压态与半透明底色不算整块压字", () => {
    expect(dimsWholeElement("active:opacity-60")).toBe(false);
    expect(dimsWholeElement("border-ink/10 bg-ink/4")).toBe(false);
    expect(dimsWholeElement("text-ink-faint/80")).toBe(false);
    expect(dimsWholeElement("opacity-40")).toBe(true);
    expect(dimsWholeElement("!opacity-40")).toBe(true);
    expect(dimsWholeElement("card-ink opacity-50 active:scale-99")).toBe(true);
  });

  it("四个可禁用基类都自带禁用态 —— 压色不压字", () => {
    // chip-ink 此前压根没有禁用态:付不起的聚气丹那枚胶囊把「尚差 30 石」写在自己
    // 身上,却和可点的胶囊长得一模一样。四个基类都要有,少一个就有一条路漏回压字。
    for (const role of ["btn-seal", "btn-ghost", "chip-ink"]) {
      expect(STYLE, `缺 .${role}:disabled 的禁用态定义`).toMatch(
        new RegExp(`\\.${role}:disabled \\{`),
      );
    }
    // 夜间印面单独一档:html[data-theme=dark] .btn-seal 的特指度高过 .btn-seal:disabled,
    // 不禁用态会在夜间原地退回深朱 —— 同一页上禁用钮与可用钮是同一个色块。
    expect(STYLE, "夜间要另给一档禁用印面(否则特指度更高的深朱会盖掉它)").toMatch(
      /html\[data-theme="dark"\] \.btn-seal:disabled \{/,
    );
  });

  it("禁用态的底色与字色都不叠半透明 —— 对比度要算得出来", () => {
    // 浅色那份用**不透明**的 ink-faint 打底 + 92% 白字;夜间那份用纸上墨 28% 压出来
    // (夜间的 ink-faint 是浅墨,奶油字放上去只剩 2.0:1,不能照搬)。
    // 取**基类那条**(前面没有 html[...] 前缀):先出现的 `.btn-seal:disabled {` 是它
    // 取基类那条:先在源码里切掉所有 html[data-theme] 开头的规则,剩下的第一条才是它
    const baseOnly = STYLE.replace(/^[ \t]*html\[[^\]]+\][^{]*\{[\s\S]*?\n[ \t]*\}/gm, "");
    const seal = /^[ \t]*\.btn-seal:disabled \{([\s\S]*?)\n[ \t]*\}/m.exec(baseOnly)?.[1] ?? "";
    expect(seal, ".btn-seal:disabled 该用不透明的 ink-faint 打底").toContain(
      "background: var(--color-ink-faint)",
    );
    const dark =
      /html\[data-theme="dark"\] \.btn-seal:disabled \{([\s\S]*?)\}/.exec(STYLE)?.[1] ?? "";
    expect(dark, "夜间禁用印面要取纸上墨,不用浅墨(浅墨托不住奶油字)").toMatch(
      /background: rgb\(var\(--color-ink-rgb\) \/ 0\.\d+\)/,
    );
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
  const STYLE = readStyleCss();

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
    expect(bodyBlock, ".t-body 要读语义变量").toMatch(/font-size: var\(--type-body\)/);
  });

  it("正文三连不许手写回来 —— 用 .t-body", () => {
    const offenders: string[] = [];
    for (const f of FILES) {
      // 同一 class 里同时出现这三样的,就是「正文」那个角色
      for (const m of f.src.matchAll(/class="([^"]*)"/g)) {
        const toks = (m[1] ?? "").split(/\s+/);
        if (
          toks.includes("text-body") &&
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

  it("人物页的册目都走 CharacterIndexRow", () => {
    const src = char();
    expect(src, "人物页要引入册目行").toContain(
      'from "@/components/character/CharacterIndexRow.vue"',
    );
    expect((src.match(/<CharacterIndexRow/g) ?? []).length, "九处去向一项不少").toBe(9);
    // 手写骨架的特征组合:card-ink + items-center + gap-3 + px-4 py-3
    const handWritten = [
      ...src.matchAll(/class="[^"]*card-ink[^"]*items-center[^"]*gap-3[^"]*"/g),
    ].map((m) => m[0]);
    expect(
      handWritten,
      `人物页还有手写的入口卡骨架 —— 改用 <CharacterIndexRow>:${handWritten.join(" | ")}`,
    ).toEqual([]);
  });

  it("CharacterIndexRow 自带去向、状态、动作与待办提醒", () => {
    const row = readFileSync(
      resolve(__dirname, "../components/character/CharacterIndexRow.vue"),
      "utf-8",
    );
    expect(row, "题头图走同一枚图标").toContain('<GameIcon :name="icon" :size="16"');
    expect(row, "去向走 title 档楷体").toContain("character-index__title");
    expect(row, "动作自动缀箭头").toContain("{{ action }}");
    expect(row, "待办提醒仍能在行内出现").toContain("character-index__badge");
    expect(row, "当前事实仍占一行").toContain("character-index__sub");
    expect(row, "按压反馈由册目行承担").toContain("active:bg-ink/5");
  });

  it("NavCard 自己带齐三件:题头图 / 卡名 / 动作词", () => {
    const nav = readFileSync(resolve(__dirname, "../components/common/NavCard.vue"), "utf-8");
    // 三件的字号必须落在页面字阶上,不许各写各的
    expect(nav, "题头图 16px").toContain(':size="16"');
    expect(nav, "卡名走 title 档楷体").toContain("text-title");
    expect(nav, "动作词走 body 档").toContain("text-body");
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
  const STYLE = readStyleCss();

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

describe("设计文档的字阶 · 与判据同一份清单", () => {
  /*
   * design.md 自称「配色的唯一权威」,字阶也写在那里。它此前写的是「六档」,
   * 下面却只列了五个数 —— 一份权威文档把自己的档位数说错,后面的人就会照它去长第六档。
   * 这里把文档里那行清单与 uiLayering 的 PAGE_TIERS 逐个对上,谁改一边都不许。
   */
  const DOC = readFileSync(resolve(__dirname, "../../docs/design.md"), "utf8");
  const DOC_TIERS = [18, 15, 14, 11, 10];

  const listed = (text: string): number[] => {
    const line = /\*\*字号档位\*\*[:：]([^\n]+)/.exec(text)?.[1] ?? "";
    return [...line.matchAll(/(\d+)/g)].map((m) => Number(m[1]));
  };

  it("文档列的档位与 PAGE_TIERS 一致", () => {
    expect(listed(DOC), "design.md 的字号档位与 PAGE_TIERS 对不上").toEqual(DOC_TIERS);
  });

  it("标题不再说「六档」", () => {
    expect(DOC).toMatch(/### 字号只有五档/);
    expect(DOC, "标题与下面那五个数打架").not.toContain("字号只有六档");
  });

  it("判据自证:把文档里的 11 改成 12,当场红", () => {
    expect(listed(DOC.replace("18 / 15 / 14 / 11 / 10", "18 / 15 / 14 / 12 / 10"))).not.toEqual(
      DOC_TIERS,
    );
  });
});

describe("不可逆的动作要先问一句 · 换一方天地", () => {
  /*
   * 换界花 15~1500 枚道果,还会把本世路线清零 —— 与转世、重置、导入同一档的不可逆。
   * 那三处都有确认弹窗,唯独这里曾经是点了就执行:一手滑,最贵的一笔开销加一整条路线
   * 一起没了。这里钉住「按钮只开确认框、确认之后才真的换」这条结构。
   */
  const MW = readFileSync(resolve(__dirname, "../views/MortalWorldView.vue"), "utf8");

  it("按钮只负责开确认框", () => {
    expect(MW, "按钮不再走确认框,点了就直接换界了").toContain('@click="rerollConfirm = true"');
    expect(MW, "按钮又直接调 rerollWorld 了").not.toMatch(
      /data-world-reroll[\s\S]{0,200}?@click="rerollWorld"/,
    );
  });

  it("确认框里把代价说全:花多少、剩多少、清零什么", () => {
    expect(MW, "确认按钮不见了").toContain("data-world-reroll-confirm");
    expect(MW, "没写要花多少道果").toMatch(/耗[\s\S]{0,60}rerollCost/);
    expect(MW, "没写换完还剩多少").toMatch(/换完剩/);
    expect(MW, "没写本世路线会清零").toMatch(/本世路线进度清零/);
  });

  it("禁用时把真正拦住玩家的原因写出来", () => {
    expect(MW, "按钮门槛要来自核心报价,不许在视图另拼一套").toContain("worldRerollQuote");
    expect(MW, "历练中禁用却没写原因").toContain("历练中");
    expect(MW, "缺道果时仍要报差多少").toContain("尚差");
  });

  it("来源说明承认道果换界,不能再说只有兵解能换", () => {
    expect(MW, "页面已有道果换界按钮,说明却还说唯有兵解").not.toContain("唯有");
    expect(MW, "换界入口已存在,不能再把这一世写成绝不会变").not.toMatch(/>这一世之内不会再变。</);
    expect(MW, "换界按钮就在上方,不能再说「不重掷」").not.toContain("不重掷,这一世之内不会再变");
    expect(MW, "天地不会自行变,要写成「不主动换界就不会再变」").toContain("不主动换界就不会再变");
    expect(MW, "来源说明要同时交代道果重掷与兵解转世").toMatch(/道果[\s\S]{0,80}兵解转世/);
    expect(MW, "道果重掷仍要明说清空本世路线进度").toContain("清空本世路线进度");
  });
});
