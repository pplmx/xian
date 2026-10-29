/**
 * 排版自检的量法口径(layout-check 脚本不在常规 verify 链里跑,量法回归此前零信号)。
 *
 * 与 yunyin 同源:量法每失守一次,都是等某次假红/漏检才被发现 —— e17d46f(桌面档
 * 弹窗按钮被量成 26.3px)、e3caed1(灵根圆环 stagger 中段假越界)都是量法在抖,不是排版在坏。
 * 这里用静态判据把量法口径钉在源码上:
 *   1. 各处量尺量几何前都要注入动画禁令;
 *   2. 横向越界左右两侧都查(负边距推到左缘外的块不再漏检);
 *   3. 纯装饰层按**计算后的 pointer-events** 豁免,滚动轨(auto/scroll)内的内容算设计,
 *      overflow-hidden 不豁免;
 *   4. 控件的「声明 = 行为」两条:假按钮的豁免面、控件套控件的宿主与排除项,
 *      以及各自的活信号(量不到东西时不许静默变绿)。
 */
import { describe, expect, it } from "vite-plus/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  FULL_COLLECTION_COUNTS,
  fullCollectionSlices,
} from "../../scripts/lib/fullCollectionFixture";
import { makeBigBagItems } from "../../scripts/lib/bigBagFixture";
import { equipmentTemplate } from "../data/equipment";

const SCRIPT = readFileSync(resolve(__dirname, "../../scripts/layout-check.mjs"), "utf-8");

describe("排版量法口径", () => {
  it("三把尺子都要注入动画禁令:整页 / 弹窗 / 开局子集", () => {
    // 只钉数量下限:将来新增尺子(如独立小目标量尺)忘了注入仍会红
    const injections = SCRIPT.match(/animation:none!important/g)?.length ?? 0;
    expect(injections, "整页 / 弹窗 / 开箱子集三处量尺都要注入").toBeGreaterThanOrEqual(3);
  });

  it("横向越界左右两侧都查,不只查右缘", () => {
    expect(SCRIPT).toContain("const leftOver = r.left < -1;");
    expect(SCRIPT).toContain("if (r.width <= 0 || (!rightOver && !leftOver)) return false;");
  });

  it("主内容区自身也要量横向余量与 scrollLeft —— overflow-hidden 会藏住被撑宽的滚动区", () => {
    /*
     * 实测:修行页的闭关按钮继承 chip-ink 的 nowrap,在 195px 下内容宽 214px、按钮盒
     * 只有 127px。外层 main 是 overflow-x-hidden,子元素的 getBoundingClientRect()
     * 仍落在视口内,横向溢出与越界元素都量不出来;直到打开功法详情触发焦点滚动,
     * main.scrollLeft 才变成 17px,整页左移。故必须直接量滚动宿主自己的可滚余量。
     */
    expect(SCRIPT).toContain("contentShift:");
    expect(SCRIPT).toContain("scrollWidth: Math.round(main.scrollWidth)");
    expect(SCRIPT).toContain("clientWidth: Math.round(main.clientWidth)");
    expect(SCRIPT).toContain("主内容区被滚偏");
    expect(SCRIPT).toContain("主内容区横向可滚");
  });

  it("装饰层按计算后的 pointer-events 豁免;滚动轨算设计,hidden 不豁免", () => {
    // 不是按类名找 .pointer-events-none —— 自定义类关事件的装饰层会漏
    expect(SCRIPT).toContain('getComputedStyle(node).pointerEvents === "none"');
    // 滚动轨(auto/scroll)内本来就该越出取景;overflow-hidden 是「玩家滚不动」的事故层
    expect(SCRIPT).toContain('s.overflowX === "auto" || s.overflowX === "scroll"');
  });

  it("假按钮判据的豁免面要逐条写明 —— 否则页签与置灰键会被量成一片假红", () => {
    /*
     * layout-check 的 deadControls 扫「声明了按钮语义却按不动」的控件。它一旦误伤,
     * 逼人做的就不是修界面而是削判据 —— 所以豁免面要钉死在源码上:
     *   一 roving tabindex(role=tab 的未选中项 tabindex=-1 是规范做法,靠方向键漫游);
     *   二 置灰(原生 disabled / aria-disabled=true 会念出原因,不是假按钮);
     *   三 零盒子(看不见 = 读屏与截图都到不了)。
     * 反过来,判据本体也不许被"顺手简化"成只看 tabindex 一种情形:自绘 role=button
     * **根本没写 tabindex** 同样是键盘进不去(器魂页的空槽就是那样漏过去的)。
     */
    expect(SCRIPT).toContain('if (el.getAttribute("role") === "tab") return false;');
    expect(SCRIPT).toContain('if (el.hasAttribute("disabled")) return false;');
    expect(SCRIPT).toContain('if (el.getAttribute("aria-disabled") === "true") return false;');
    expect(SCRIPT).toContain("if (r.width <= 0 || r.height <= 0) return false;");
    // 判据本体:role=button 的「没写 tabindex」与「tabindex=-1」两种都要抓
    expect(SCRIPT).toContain(
      'if (el.getAttribute("role") === "button") return ti === null || ti === "-1";',
    );
    // 挂进两遍巡页共用的 problemsOf(不是只在某一个场景里生效)
    expect(SCRIPT).toContain("if (info.deadControls.length)");
  });

  it("缩放档(200%)要判竖排与短标签折行 —— 这一档此前只判四条", () => {
    /*
     * 195 CSS px(390 按 200%)是 AGENTS 明写要防折行的那一档,而 zoomProblems 只判
     * 横向溢出 / 外壳被滚偏 / 越界元素 / 主值行折行四条 —— 竖排与按钮折行一直没接,
     * 实测 14 个页面在这一档把标题与属性名压成一字一行,门一路全绿。
     *
     * 现在两条接上了,但**按钮折行只算短标签**(≤6 字):整宽长文案按钮(「散尽修为,
     * 重入轮回(清空存档)」这类)折行是读得出来的正常换行,不该判红 —— 一条会误伤
     * 正常排版的判据,逼人做的不是修界面而是削判据。
     */
    expect(SCRIPT).toContain("文字被挤成竖排(200%)");
    expect(SCRIPT).toContain("短动作标签被折行(200%)");
    // 短标签的判据要真的按字数筛(而不是把整张折行表都报上来)
    // 用 Array.from 而不是 [...text]:按码点数字数,别把代理对拆成两半
    // (oxlint 的 no-misused-spread 也指着这条)
    expect(SCRIPT).toMatch(/Array\.from\(text\)\.length <= 6/);
    expect(SCRIPT).toContain("info.verticalTexts?.length");
  });

  it("缩放档要量后期档 —— 空档量不出「长数字 + 满屏内容」在 195 宽上什么样", () => {
    /*
     * 主巡页那一遍用的是刚建号的空档:灵石几百、行囊两件、没有在途秘境。195 CSS px 上
     * 最容易出事的恰恰是反过来的组合 —— 神人境的九位数灵石、成套装备、在途秘境全挤在
     * 一个 195 宽的布局视口里。这一遍与 320 那一遍同一个理由(空档量不出满屏内容),
     * 只是那一遍的视口还没窄到 195。
     *
     * 两条都要钉:后期档真的量了缩放档(而不是只有空档那一遍),以及它自己的账要并进
     * failures —— 只 push 进 zoomFails 而不落进 failures 的读数,报告里根本不会出现。
     */
    expect(SCRIPT).toContain("200% 缩放档上版面坏了(后期档)");
    expect(SCRIPT).toMatch(/\[390-late\] \$\{route\} → \$\{zoomBad\.join/);
  });

  it("前尘山河要真的量到三世,不能只留一个空 data 落点", () => {
    // 空档与后期档都只有当前世界,历史册永远不会出现;只查模板里有没有
    // data-world-history,等于量了一个永远不渲染的契约。
    expect(SCRIPT).toContain("worldHistoryFixture");
    expect(SCRIPT).toContain("fixture.expectedRows.length");
    expect(SCRIPT).toContain("[data-world-history-row]");
    expect(SCRIPT).toContain("[data-world-history-title]");
    expect(SCRIPT).toContain("[data-world-history-stages]");
    expect(SCRIPT).toContain('["前尘山河三世同册", taskWorldHistory]');
  });

  it("只在某个时刻弹一次的浮层也要过缩放档 —— 巡页永远碰不到它们", () => {
    /*
     * 本作有整整一族「只在某一步出现」的浮层:归来卷轴、渡劫结果、转世三步
     * (寿元将尽 / 此生已矣 / 轮回)。它们由 clearOverlays 收掉,或在巡页之前根本没触发,
     * 于是 200% 那一档**一页都量不到它们** —— 归来卷轴就是这么一路绿着的
     * (面板内宽 113px 时收益行各自折两行)。
     *
     * 钉三件事:
     *   一 尺子只有一份(measureDialogZoom + dialogZoomProblems),不许每个场景各写一遍;
     *   二 四类场景都真的调了它(归来卷轴 / 渡劫结果 / 转世的每一步);
     *   三 读数要并进 failures —— 只算不报的判据等于没有。
     */
    expect(SCRIPT).toContain("async function measureDialogZoom(");
    expect(SCRIPT).toContain("function dialogZoomProblems(");
    expect(SCRIPT).toContain("problems.push(`数值被标签挤折:");
    // 四类场景各调一次:数调用点而不是数场景名,场景改名时这条会红
    // (格式化会把长调用折成两行,故允许中间有换行)
    const calls = SCRIPT.match(/dialogZoomProblems\(\s*await measureDialogZoom\(/g) ?? [];
    expect(calls.length, "归来卷轴 / 渡劫结果 / 转世每一步都要量").toBeGreaterThanOrEqual(3);
    expect(SCRIPT).toMatch(/归来卷轴在 200% 下坏了/);
    expect(SCRIPT).toMatch(/转世「\$\{label\}」在 200% 下坏了/);
    expect(SCRIPT).toMatch(/渡劫结果在 200% 下坏了/);
    /*
     * 点得开的那些弹窗(装备详情 / 丹房 / 器魂 / 灵脉)另有一个任务:巡页不会去点它们,
     * 缩放档那一遍自然也碰不到 —— 实测丹房方子卡三列并排时中间只剩 42px,
     * 器魂详情两枚页脚键在空格处断成两行。这条钉住那个任务真的存在、且点不开时报红
     * (判据没量到东西时不许静默变绿)。
     */
    expect(SCRIPT).toContain("async function taskDialogZoom(");
    expect(SCRIPT).toMatch(/浮层「\$\{label\}」点不开/);
    expect(SCRIPT).toMatch(/\[195\] 浮层「\$\{label\}」在 200% 下坏了/);
    expect(SCRIPT).toMatch(/\["浮层在 200% 缩放档\(点得开的那几扇\)", taskDialogZoom\]/);
    // 与页面上那一套同一把尺子:禁用态的原因句不算折行
    expect(SCRIPT).toMatch(/if \(el\.hasAttribute\("disabled"\)\) continue; \/\/ 禁用态是原因句/);
  });

  it("后期档的随机际遇要在模块初始化前钉死 —— 否则丹药回执偶发假红", () => {
    /*
     * RandomService 在构造时就捕获了 Math.random 的函数引用。页面加载后再修改
     * 只影响后续新建的实例,不影响已经收走引用的全局 rng —— 后期档夹具必须把
     * 固定值放进 addInitScript,才能在「遇袭的弟子」掷后果之前生效。
     */
    const start = SCRIPT.indexOf("const latePayload = Object.fromEntries(");
    const end = SCRIPT.indexOf("const page = await ctx.newPage();", start);
    expect(start, "后期档夹具要能定位到 —— 定位不到这条就是空转").toBeGreaterThan(-1);
    expect(end, "后期档夹具要能定位到 page 创建之前").toBeGreaterThan(start);
    const lateSeed = SCRIPT.slice(start, end);
    expect(lateSeed).toContain("Math.random = () => 0;");
    expect(lateSeed).toContain("await ctx.addInitScript(");
  });

  it("坏档场景要等首轮导航落定后再进设置页 —— 20 秒不替启动竞态买单", () => {
    /*
     * app.mount 早于 router 首轮导航落定。坏档任务若在 mount 后立刻把 hash 改成
     * /settings,首轮导航仍可能把它写回 /;并发全量跑时实测卡满 20 秒,而单跑
     * 同一份产物正常。先等首轮导航落到 /,再走设置页,判据本身不动。
     */
    const start = SCRIPT.indexOf("async function taskBadSave()");
    const end = SCRIPT.indexOf("/** iOS 存档风险提示 */", start);
    expect(start, "坏档任务要能定位到 —— 定位不到这条就是空转").toBeGreaterThan(-1);
    expect(end, "坏档任务的结尾要能定位到").toBeGreaterThan(start);
    const task = SCRIPT.slice(start, end);
    expect(task).toContain('.waitForFunction(() => location.hash === "#/", { timeout: 5000 })');
    expect(task).toContain('location.hash = "#/settings";');
    expect(task).toContain('.waitForFunction(() => location.hash.startsWith("#/settings")');
    expect(task).not.toContain('page.goto(INDEX + "#" + "/settings"');
  });

  it("构建产物守住单块 500KB,并把 crypto-js 单独留成可缓存块", () => {
    /*
     * 构建器的 chunk 警告不会让任何门失败;警告看久了就等于不存在。这里钉住
     * 运行期产物判据(任一块 JS >500,000 字节即红)与分包配置(crypto-js 必须
     * 单独成 vendor-crypto),避免下一次「顺手合并」把 504KB 的 player 组带回来。
     */
    const start = SCRIPT.indexOf("async function taskBuildArtifacts()");
    const end = SCRIPT.indexOf("/**\n * 开局前两页", start);
    expect(start, "构建产物任务要能定位到 —— 定位不到这条就是空转").toBeGreaterThan(-1);
    expect(end, "构建产物任务的结尾要能定位到").toBeGreaterThan(start);
    const task = SCRIPT.slice(start, end);
    expect(task).toContain("chunk.bytes > 500_000");
    expect(task).toContain("/^vendor-crypto-.*\\.js$/");

    const vite = readFileSync(resolve(__dirname, "../../vite.config.ts"), "utf-8");
    expect(vite).toContain('name: "vendor-crypto"');
    expect(vite).toContain("crypto-js");
    expect(vite).toContain("codeSplitting:");
  });

  it("背包 300 件不许把全部装备卡塞进首帧 —— 分批放出并与运行时门同一条预算", () => {
    /*
     * 300 件时每张 EquipmentCard 都是一枚按钮加分角标,全量渲染实测 DOM 约 1955;
     * 帧率尚绿不代表没有维护成本,后续加一枚词条/印章都会再乘 300。背包先放首批,
     * 余下由玩家显式续开;每张卡只接收父级算好的 isNew,不再各自订阅库存单例。
     */
    const view = readFileSync(resolve(__dirname, "../views/InventoryView.vue"), "utf-8");
    expect(view).toContain("inventoryWindow(allItems");
    expect(view).toContain("data-inventory-total");
    expect(view).toContain("data-inventory-start");
    expect(view).toContain('v-for="row in itemPage.visible"');
    expect(view).toContain(':is-new="inventory.isNewItem(row.item.uid)"');
    expect(view).toMatch(
      /const shownBefore = itemPage\.value\.shown;[\s\S]{0,120}nextInventoryLimit\(\s*shownBefore,\s*allItems\.value\.length\s*\)/,
    );
    expect(view).toContain("previousInventoryLimit");
    expect(view).toContain("data-inventory-prev");
    expect(view).toContain("itemPage.hidden > 0");

    const card = readFileSync(
      resolve(__dirname, "../components/equipment/EquipmentCard.vue"),
      "utf-8",
    );
    expect(card).toContain("isNew?: boolean");
    expect(card).not.toContain('from "@/stores/inventory"');

    const perf = readFileSync(resolve(__dirname, "../../scripts/perf-profile.mjs"), "utf-8");
    expect(perf).toContain("maxDomByView");
    expect(perf).toContain("inventory: 700");
    expect(perf).toContain("makeBigBagItems");
    expect(perf).toContain("data-inventory-total");
    expect(perf).toContain("夹具只装进");
    expect(perf).toContain("newVisible === promised");
    expect(perf).toContain("焦点没有落到新露出条目");
    expect(perf).toContain("!beforeSet.has(focused)");
    expect(perf).toContain("startAfter < startBefore");
    expect(perf).toContain("清单只可达");
  });

  it("寄卖逐页验收只交一份续开选择器，总量与回翻契约不右移", () => {
    /*
     * expandAllBatches 的第 4 / 5 参是总量与回翻契约。若在续开选择器后再抄一遍
     * 选择器，两个配置对象会整体右移：运行时门会拿对象当选择器，件数校验与回翻
     * 校验都失效。这里钉住调用前缀，避免“门在，但没按预期验收”。
     */
    const perf = readFileSync(resolve(__dirname, "../../scripts/perf-profile.mjs"), "utf-8");
    const start = perf.indexOf("const consign = await expandAllBatches(");
    const end = perf.indexOf("let candidates;", start);
    expect(start, "寄卖逐页验收调用要能定位到 —— 定位不到这条就是空转").toBeGreaterThan(-1);
    expect(end, "寄卖逐页验收调用的结尾要能定位到").toBeGreaterThan(start);

    const call = perf.slice(start, end);
    expect(call.match(/button\[data-market-more="consign"\]/g) ?? []).toHaveLength(1);
    expect(call).toContain('selector: "[data-market-consign-total]"');
    expect(call).toContain('startSelector: "[data-market-consign-start]"');
    expect(call).toContain("previousSelector: '[data-market-prev=\"consign\"]'");
  });

  it("大背包性能夹具只取真实 14 阶模板，300 件必须真的进得去", () => {
    const rows = makeBigBagItems(300);
    expect(rows).toHaveLength(300);
    expect(new Set(rows.map((row) => row.templateId)).size).toBeGreaterThanOrEqual(4);
    for (const row of rows) {
      const template = equipmentTemplate(row.templateId);
      expect(template, `夹具模板 ${row.templateId} 不在装备表里`).toBeDefined();
      expect(template?.tier).toBe(14);
    }
    expect(makeBigBagItems(2.9)).toHaveLength(2);
    expect(makeBigBagItems(Number.NaN)).toHaveLength(0);
  });

  it("收藏全收集要有真实规模夹具，运行时门要切进收藏并逐册验续开", () => {
    /*
     * 默认后期档只在成就页量到 592 DOM，切进收藏也只有九张空册；终局九册全收
     * 才会铺出八百多枚 chip。夹具直接从内容表生成全收集状态，perf-profile 必须
     * 真点「收藏」、真点每册「再看」，并守住交互后的峰值 —— 只看默认成就页，
     * 「量过了」与「完全没量收藏」在报告里长得一样。
     */
    const slices = fullCollectionSlices();
    const twoState =
      Object.values(slices.quests.collections).reduce((sum, ids) => sum + ids.length, 0) +
      Object.keys(slices.lore.materialLore).length +
      FULL_COLLECTION_COUNTS.branch;
    expect(FULL_COLLECTION_COUNTS.total).toBeGreaterThan(700);
    expect(twoState, "七册二态 + 灵材 + 悟道要覆盖九册全部条目").toBe(FULL_COLLECTION_COUNTS.total);
    expect(Object.keys(slices.cultivation.learned)).toHaveLength(FULL_COLLECTION_COUNTS.gongfa);
    expect(Object.keys(slices.lore.recipeLore)).toHaveLength(FULL_COLLECTION_COUNTS.pill);
    expect(Object.keys(slices.lore.equipLore)).toHaveLength(FULL_COLLECTION_COUNTS.equip);
    expect(slices.inventory.artifacts).toHaveLength(FULL_COLLECTION_COUNTS.artifact);

    const perf = readFileSync(resolve(__dirname, "../../scripts/perf-profile.mjs"), "utf-8");
    expect(perf, "collection 视图要换全收集夹具").toContain("fullCollectionSlices");
    expect(perf).toContain('getByRole("tab", { name: "收藏" })');
    expect(perf, "册目收口后,运行时门要先逐册展开").toContain("data-collection-category-toggle");
    expect(perf).toContain("data-collection-more");
    expect(perf).toContain("collectionBatches");
    expect(perf).toContain("rewindSpec");
    expect(perf).toMatch(/collection:\s*\d+/);
    expect(perf, "收藏要守住逐册续开后的交互峰值").toContain("collection: 1100");
  });

  it("巡页与冒烟的路由表都要跟上 router —— 新页面不许悄悄漏在门外", () => {
    /*
     * ROUTES 是手抄的一份清单。新增一个页面却忘了加进来,那一刻起它就再也不被任何
     * 排版/触达/对比度判据量到,而门照样全绿 —— 这类漏检不会有人报,因为「没坏」
     * 和「没量」在报告里长得一模一样。
     *
     * 与 router/index.ts 逐个对:除开局前两页(有存档时被守卫重定向,另有无存档的
     * 那个任务专门量)与兜底重定向,两边必须是同一个集合。
     */
    const routerSrc = readFileSync(resolve(__dirname, "../router/index.ts"), "utf-8");
    const declared = new Set(
      [...routerSrc.matchAll(/path: "([^"]+)"/g)]
        .map((m) => m[1]!)
        .filter((p) => p !== "/welcome" && p !== "/create" && !p.includes("pathMatch")),
    );
    const block = /const ROUTES = \[([\s\S]*?)\];/.exec(SCRIPT)?.[1];
    expect(block, "ROUTES 要能定位得到 —— 定位不到这条就是空转").toBeTruthy();
    const gated = new Set([...(block ?? "").matchAll(/"([^"]+)"/g)].map((m) => m[1]!));
    expect(gated.size, "ROUTES 要能定位得到 —— 定位不到这条就是空转").toBeGreaterThan(10);
    expect(
      [...declared].filter((p) => !gated.has(p)),
      "这些页面在 router 里,却没进巡页清单",
    ).toEqual([]);
    expect(
      [...gated].filter((p) => !declared.has(p)),
      "巡页清单里有 router 不认识的路由",
    ).toEqual([]);

    /*
     * 冒烟脚本有它自己的一份 ROUTES(点击序按它排序),同样要跟上 —— 漏一页就等于
     * 那一页的按钮一次都没被点过,而「没报错」与「没点」在报告里长得一样。
     */
    const smoke = readFileSync(resolve(__dirname, "../../scripts/ui-smoke.mjs"), "utf-8");
    const smokeBlock = /const ROUTES = \[([\s\S]*?)\];/.exec(smoke)?.[1];
    expect(smokeBlock, "ui-smoke 的 ROUTES 要能定位得到").toBeTruthy();
    const smoked = new Set([...(smokeBlock ?? "").matchAll(/"([^"]+)"/g)].map((m) => m[1]!));
    expect(smoked.size, "ui-smoke 的 ROUTES 不许是空的").toBeGreaterThan(10);
    expect(
      [...declared].filter((p) => !smoked.has(p)),
      "这些页面在 router 里,却没进冒烟清单",
    ).toEqual([]);
    expect(
      [...smoked].filter((p) => !declared.has(p)),
      "冒烟清单里有 router 不认识的路由",
    ).toEqual([]);

    /*
     * perf-profile 也有自己的一份游戏视图表。它此前漏了坊市与收徒两页:
     * 两页都在 router 里、冒烟也点得到,却从来没被帧率/DOM 预算量过。
     * 「门全绿」和「两页没量」在报告里长得一样,故这里与 router 逐页对账。
     */
    const perf = readFileSync(resolve(__dirname, "../../scripts/perf-profile.mjs"), "utf-8");
    const perfBlock = /const VIEWS = \[([\s\S]*?)\];/.exec(perf)?.[1];
    expect(perfBlock, "perf-profile 的 VIEWS 要能定位得到").toBeTruthy();
    const measured = new Set(
      [...(perfBlock ?? "").matchAll(/route: "([^"]+)"/g)].map((m) => m[1]!),
    );
    expect(measured.size, "perf-profile 的 VIEWS 不许是空的").toBeGreaterThan(10);
    expect(
      [...declared].filter((p) => !measured.has(p)),
      "这些页面在 router 里,却没进帧率/DOM 预算",
    ).toEqual([]);
    expect(
      [...measured].filter((p) => !declared.has(p)),
      "帧率/DOM 预算里有 router 不认识的路由",
    ).toEqual([]);
    expect(perf, "坊市要守住寄卖 + 贡器弹窗的峰值 DOM").toContain("market: 1100");

    /*
     * 只传 --view / --no-gate 时,旧写法会把 --view 当秒数读成 NaN,
     * 采样器只跑一帧并报负数。参数缺口要回落到 3 秒,不能把「没量」伪装成绿色。
     */
    expect(perf).toContain('const si = args.indexOf("--seconds")');
    expect(perf).toContain("Number.isFinite(parsedSecs) && parsedSecs > 0 ? parsedSecs : 3");
  });

  it("控件套控件的判据:宿主按按钮语义选,内层排除 -1,且带活信号", () => {
    /*
     * layout-check 的 nestedControls 报的是「读屏只念得出外层那一个」。三个口径都要钉:
     *   一 宿主只认按钮语义(button / [role=button] / a[href])—— role=tab 一类
     *      组合控件天然带子件,把它们当宿主会一片假红;
     *   二 内层要排除 tabindex=-1 的(roving tabindex 的未选中页签、装饰性 tabindex),
     *      并且只算看得见的盒子;
     *   三 这条判据不许空转:扫到过几枚宿主要累计成 controlHostsSeen,为 0 就报故障
     *      (与 data-value-row / 200% 档 / 像素采样同一套防法)。
     */
    expect(SCRIPT).toContain(
      'const hosts = [...document.querySelectorAll("button, [role=button], a[href]")]',
    );
    expect(SCRIPT).toContain('if (el.getAttribute("tabindex") === "-1") return false;');
    expect(SCRIPT).toContain("if (!inner.length) continue;");
    expect(SCRIPT).toContain("if (info.nestedControls?.items.length)");
    expect(SCRIPT).toContain("controlHostsSeen += info.nestedControls?.hosts ?? 0;");
    expect(SCRIPT).toContain("if (controlHostsSeen === 0)");
  });
});

describe("排版门的覆盖面 · 视口档位不许悄悄缩水", () => {
  /*
   * 这道门每加一档视口都是被某一类真实毛病逼出来的(320 窄屏、844×390 横屏、
   * 1280×800 桌面、390 的 200% 缩放)。删掉一档不会让门变红,只会让它安静地
   * 少量一部分屏幕 —— 而"少量了"和"量过了"在报告里长得一模一样。
   */
  const widths = [...SCRIPT.matchAll(/\{\s*width:\s*(\d+),\s*height:\s*(\d+),\s*tag:/g)].map((m) =>
    Number(m[1]),
  );

  it("五档视口都在:320 / 375 / 390 / 844 / 1280", () => {
    for (const w of [320, 375, 390, 844, 1280]) {
      expect(widths, `少了 ${w} 宽那一档 —— 那一类屏幕从此不再被量`).toContain(w);
    }
  });

  it("200% 缩放那一档仍在量(195 CSS px)", () => {
    expect(SCRIPT, "200% 缩放的量法不见了").toMatch(/195/);
    expect(SCRIPT).toMatch(/zoomProblems|zoomBad/);
  });
});
