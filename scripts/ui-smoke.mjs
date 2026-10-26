/* oxlint-disable no-console -- 自检脚本的产出就是给人看的报告 */
/**
 * 界面冒烟 —— 把每个页面上的按钮都点一遍,看有没有运行时异常
 *
 * 与 layout-check 的分工:那边量排版,这边戳交互。
 * 静态审计能查「有没有接线」,查不出「点下去会不会炸」——比如某个弹窗打开时
 * 读了一个只在特定存档下才存在的字段。故这里用真浏览器真存档,逐页点按钮。
 *
 * 用法(需要 playwright,已是 devDependency):
 *   bun run build
 *   bunx playwright install chromium
 *   bun scripts/ui-smoke.mjs             # 每页最多点 12 个按钮
 *   bun scripts/ui-smoke.mjs --depth 25  # 点更多
 *   bun scripts/ui-smoke.mjs --late      # 用后期夹具存档(神人境)覆盖终局界面
 *   bun scripts/ui-smoke.mjs --jobs 6    # 并发路数;也可用 UI_SMOKE_JOBS 环境变量
 *
 * 每页一个独立 context(各带自己的存档),由下面的 runPool 并发跑 —— 从前 15 页
 * 排成一队,一轮约十分钟;并发后本地实测两分多钟。--jobs 1 退化回串行。
 * 各页的点击序、失败清单按 ROUTES 固定顺序合并,报告与串行时一致。
 *
 * 会跳过有破坏性的按钮(分解/删除/清空/重置/兵解/转世),免得把冒烟盘玩坏。
 * 发现 pageerror 即失败并打印堆栈前几行 —— 那通常就是一处真 bug。
 * 应用自己 `console.error` 的(`[引擎] Tick 异常` 这类**被 catch 住**的)同样计入失败:
 * 它们不会触发 pageerror,却是「游戏不动了」的真身(见 lib/pageErrors.mjs 的说明)。
 * 它同时在 CI 里跑(见 .github/workflows/build.yml 的 ui-check job 与 deploy.yml),
 * 与排版自检同属一道门:那边量排版,这边戳交互,红一条就不发布。
 * 页面异常一律计入失败;外域请求由 lib/pageErrors.mjs 的 blockExternal 拦掉并计数(应当恒为 0)。
 *
 * 除逐页点按钮外,还有两条"环境异常"专场景(各占一个独立 context):
 *   ① 旧档兼容 —— 按旧形状落盘,走真实启动,再从盘上读回,确认迁移真的写回了;
 *   ② 存储写满 —— 把配额填死再改一次设置,设置页要说得出"上次写入存档失败",
 *      腾出空间后那一行要自己消失(自动重试)。
 * 两条都只在浏览器里才验得到:前者考启动序列,后者考 localStorage 真会抛的那种错。
 *
 * ⚠ 夹具说明:存档密钥就写在包里(见 utils/crypto 的注释:并非安全边界),
 * 故这里能照同一套格式造一份"神人境"存档。它是**自检夹具**,不是作弊入口:
 * 别把它当推荐玩法,也别据此以为存档不可改。
 *
 * ⚠ --late 很慢(终局页面上的按钮会真的触发模拟:突破推演 / 远征预估 / 挑战书
 * 定价,不是脚本卡住了)。日常冒烟用默认模式;并发只是让这些等待叠在一起,并不减免。
 */
/**
 * 元素句柄,不用 nth 序号定位器 —— 一处曾被当作「游戏性能问题」的教训
 * --------
 * 抓按钮清单若用 `getByRole("button").all()`,拿到的是一串**钉了序号**的定位器
 * (nth(0), nth(1), …):toast 进出、弹窗开合、点了「← 返回」/入口卡跳页,
 * 都会让序号指向别的节点或空号 —— 而 Playwright 的查询会按可操作性**自动等待**,
 * 空号一路等到默认 30s 超时。实测后果:/market /apprentice /dongfu 三页被拖到
 * ~44s/点击(点击「返回」离页后,余下 9 个序号 × 30s 纯等待),墙钟 626s 里
 * 一半以上是它;CDP 采样证明等待期间主线程全闲 —— 游戏侧毫无问题,玩家无感。
 * 时机的三变(toast TTL 2.6s/4.2s、弹窗、导航)也解释了「同一枚按钮时卡时不卡」。
 *
 * 改用 `elementHandles()`:句柄钉住**DOM 节点本身**,toast 进出不挪它,节点一没
 * innerText/click 立即抛错(被 .catch 吃掉,快进快出)。另加一道离页守卫:
 * hash 一变即断循环 —— 离页后旧页的按钮本就无从点起。
 *
 * 单步 >1s 的等待仍会记进「慢步骤」读数(不判失败):--late 的终局模拟是真算,
 * 不能当门槛;但它能把将来再长回来的静默等待晒在报告里。
 */
import { chromium } from "playwright";
import { cpus } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { blockExternal, watchPageErrors } from "./lib/pageErrors.mjs";
import { decryptSlice, lateSlices, seedSave } from "./lib/saveFixture.mjs";
import { SAVE_VERSION } from "../src/utils/storage.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const INDEX = `file://${join(ROOT, "dist/index.html")}`;
const depthArg = process.argv.indexOf("--depth");
const DEPTH = depthArg > 0 ? Number(process.argv[depthArg + 1]) || 12 : 12;
const LATE = process.argv.includes("--late");

/** 并发路数:`--jobs N` > `UI_SMOKE_JOBS` > 按核数自适应(上限 8,CI 少核也不会把内存打爆) */
const JOBS = (() => {
  const i = process.argv.indexOf("--jobs");
  if (i > 0) {
    const n = Number(process.argv[i + 1]);
    if (Number.isFinite(n) && n >= 1) return Math.floor(n);
  }
  const env = Number(process.env.UI_SMOKE_JOBS);
  if (Number.isFinite(env) && env >= 1) return Math.floor(env);
  return Math.max(2, Math.min(8, (cpus().length || 4) - 1));
})();

/**
 * 全量路由 —— 从前只点九页,流派/收藏/修仙录/洞府/本世之界/天界这六页
 * 只被排版自检量过尺寸,没人戳过它们的按钮(点下去会不会炸、有没有 NaN 泄漏都没看过)。
 *
 * 没有列 /welcome 与 /create:这两页是**开局前**的状态,路由守卫见存档已开就把它们
 * 重定向回首页(见 router/index.ts 的 beforeEach)—— 本脚本每个 context 都先建号,
 * 导航过去量到的只会是首页,硬塞进来等于空转。它们的排版与对比度由 layout-check
 * 的「开局前两页」任务(无存档的新 context)守着。
 */
const ROUTES = [
  "/",
  "/cultivation",
  "/adventure",
  "/inventory",
  "/character",
  "/codex",
  "/souls",
  "/titles",
  "/settings",
  "/build",
  "/collection",
  "/legacy",
  "/dongfu",
  "/world",
  "/celestial",
  "/market",
  "/apprentice",
];
/** 正文里不该出现的数字/占位泄漏 */
const NUMERIC_LEAK = ["NaN", "Infinity", "undefined"];
/** 破坏性/离开型按钮:冒烟盘上不点 */
const SKIP = /分解|删除|清空|重置|兵解|转世|散尽|导出|导入|隐私|关于我们|出 秘 境|暂别/;

/**
 * 分析脚本的域名在自检里断掉(见 lib/pageErrors.mjs 里那段实测说明):
 * 不是为了省时间,而是不让第三方脚本的加载与异常掺进这道门。
 */
const browser = await chromium.launch({
  args: [
    "--allow-file-access-from-files",
    "--disable-web-security",
    "--enable-precise-memory-info",
  ],
});

/**
 * 建"我们自己的"上下文 —— **外域请求一律拦掉**。
 * 挂在 context 层:该上下文里所有页面(含后续新建的)自动覆盖。
 * 后期模式顺手把夹具注进去(每个 context 一份,互不干扰)。
 */
async function makeContext() {
  const context = await browser.newContext({ viewport: { width: 375, height: 812 } });
  const blocked = await blockExternal(context);
  // 夹具与出图同源(见 lib/saveFixture.mjs),不再各写一份
  if (LATE) await seedSave(context, lateSlices(), "__smokeFixture");
  return { context, blocked };
}

/** 一页的冒烟:建号(或夹具)、逐按钮点、点开弹窗再关掉,收回这一页的异常读数 */
async function runRoute(route) {
  const routeT0 = performance.now();
  const { context, blocked } = await makeContext();
  const page = await context.newPage();
  const errors = [];
  const silent = [];
  const slowSteps = []; // 单步 >1s 的等待(读数,不判失败)—— 见文件头的「元素句柄」注
  let clicked = 0;
  /** 这一页真的找到几个可点控件(可见 + 没禁用 + 有名字)—— 用来区分「页面本来就没东西点」与「点击器坏了」 */
  let controls = 0;
  let leftPage = false;
  watchPageErrors(page, (msg) => errors.push({ where: `${route} 载入`, msg }));

  /**
   * 计一步的墙钟:>1s 记入 slowSteps(用途是把静默等待晒出来,不判成败)。
   *
   * **只记叶子步骤**(自己不再调 step 的那些)。容器步骤会把内层的全部耗时连本带利
   * 算进自己:外层「弹窗内逐枚」包着最多 6 个弹窗按钮,每个按钮后都有一条固定的
   * `waitForTimeout(160)`,于是外层读数恒在 1.2–1.7s —— 上一轮报告里的四条
   * `/inventory 弹窗内逐枚(…)` 正是这么来的,读者(和我自己)第一反应是「点开收纳
   * 真慢」,而那段里没有一行在量游戏。
   * 这与文件头那条教训是同一个病 ——「量到的不是要量的事」。读数一旦常驻噪声,
   * 真变慢时就没人会再看它。故用一叠帧标记:谁有子步骤,谁就不记账。
   */
  const stepFrames = [];
  async function step(where, fn) {
    const t = performance.now();
    const frame = { hadChild: false };
    // 进这一层之前,栈顶那位就多了一个子步骤 —— 它随之失去记账资格
    if (stepFrames.length > 0) stepFrames[stepFrames.length - 1].hadChild = true;
    stepFrames.push(frame);
    try {
      return await fn();
    } finally {
      stepFrames.pop();
      const ms = performance.now() - t;
      if (!frame.hadChild && ms > 1000) slowSteps.push({ where, ms: Math.round(ms) });
    }
  }

  /**
   * 点了没反应的按钮 —— 只报告,不判失败。
   *
   * 判据是「点击前后看不出任何变化」:正文文本、弹窗数、toast 数都没动。
   * 空白点击有时是合理的(比如点一个已选中的页签),故先当读数看:
   * 一屏里要是冒出十几个,那就说明有一批入口在静默失败。
   */
  async function fingerprint() {
    return page.evaluate(() => {
      const text = document.body.innerText.replace(/\s+/g, " ").slice(0, 4000);
      /*
       * 指纹里必须带上「不体现在文字上的变化」。
       *
       * 主题与战报速度这两组切换改的是 CSS 变量与 aria-pressed,正文一个字都不变 ——
       * 于是它们每一轮都被报成「点了没反应」,而读数一旦常驻噪声,真事故就会被忽略。
       * 故把 data-theme 与当前按下的选择一并算进指纹(顺手也能看出选中态有没有变)。
       */
      /*
       * 全文哈希:只看首尾会漏掉「变化发生在中间」的点击 ——
       * 比如人物页点一行属性,来源明细是在正文中段展开的,
       * 首 120/末 80 字都没动,于是它被记成「点了没反应」(实测)。
       */
      const full = document.body.innerText.replace(/\s+/g, " ");
      let hash = 0;
      for (let i = 0; i < full.length; i += 1) hash = (hash * 31 + full.charCodeAt(i)) | 0;
      const pressed = [...document.querySelectorAll("[aria-pressed=true]")]
        .map((b) => (b.textContent || "").trim().slice(0, 6))
        .join(",");
      const theme = document.documentElement.getAttribute("data-theme") ?? "";
      // 路由进指纹:导航类点击「换了页」就是它的反应(见下面 re-poll 那段)
      return `${location.hash}|${text.length}:${full.length}:${hash}|${theme}|${pressed}|${document.querySelectorAll(".modal-panel").length}|${document.querySelectorAll("[class*=toast]").length}`;
    });
  }

  /**
   * 数字体检:正文里出现 NaN / Infinity / undefined 一律算失败。
   * 这类泄漏在单元测试里看不出来(函数返回了"数字"),到了百万级数值与
   * 除法密集的后期界面才现形 —— 后期夹具正是为它准备的。
   *
   * 且不能只扫开页时的正文:本作大量数值渲染在弹窗/交互之后才出现
   * (炼丹、收纳、人物入口、天界册页),点开弹窗才现形的 NaN/undefined 不抛异常,
   * watchPageErrors 逮不到 —— 故把同一判据搬进每次点击之后重跑。
   */
  async function scanNumericLeaks(where) {
    const leaked = await page.evaluate((patterns) => {
      const text = document.body.innerText;
      return patterns
        .filter((p) => text.includes(p))
        .map((p) => {
          const i = text.indexOf(p);
          return `${p}@…${text.slice(Math.max(0, i - 24), i + 24).replace(/\n/g, "↵")}…`;
        });
    }, NUMERIC_LEAK);
    for (const l of leaked) errors.push({ where, msg: l });
    return leaked.length;
  }

  /** 弹窗里的按钮也要点 —— 大部分交互都藏在 modal 里(炼丹/收纳/人物各入口/天界册页) */
  async function clickInsideModal(where) {
    const panel = page.locator(".modal-panel").first();
    if (!(await panel.count())) return;
    // 元素句柄(见文件头):toast 进出会让 nth 序号换指,句柄钉节点,没了一抛即走
    const inner = await panel.getByRole("button").elementHandles();
    for (const b of inner.slice(0, 6)) {
      const label = await step(`${where} 弹窗按钮读名`, () => b.innerText().catch(() => ""));
      const text = (label || "").replace(/\s+/g, " ").trim();
      if (!text || SKIP.test(text)) continue;
      if (!(await b.isVisible().catch(() => false))) continue;
      if (await b.isDisabled().catch(() => false)) continue;
      const before = errors.length;
      await step(`${where} 弹窗内点「${text}」`, () => b.click({ timeout: 800 }).catch(() => {}));
      clicked += 1;
      await page.waitForTimeout(160);
      if (errors.length > before) errors[errors.length - 1].where = `${where} 弹窗内点「${text}」`;
    }
  }

  await page.goto(INDEX, { waitUntil: "load" });
  if (!LATE) {
    await page
      .getByRole("button", { name: /开\s*始\s*游\s*戏/ })
      .first()
      .click();
    await page.locator("input[type=checkbox]").first().check();
    await page
      .getByRole("button", { name: /同意并开始/ })
      .first()
      .click();
    await page.waitForTimeout(3200);
    await page.locator("input:not([type=file]):not([type=checkbox])").first().fill("冒烟自检");
    await page
      .getByRole("button", { name: /踏\s*入\s*仙\s*途/ })
      .first()
      .click();
  }
  await page.waitForTimeout(LATE ? 1800 : 1500);

  await page.goto(INDEX + "#" + route, { waitUntil: "load" });
  await page.waitForTimeout(600);
  // 计时插桩:建号/夹具 + 首跳的耗时单独记 —— 它是每页都要付一遍的固定开销,
  // 与按钮循环的耗时分开量,才知道优化该往哪头下刀(只量时间,不判成败)。
  const setupMs = Math.round(performance.now() - routeT0);
  await scanNumericLeaks(`${route} 正文泄漏`);
  // 逐页按钮清单在导航之后再抓:goto 前抓会拿到上一页的数组(41847c0 把这一行
  // 卷进 scanNumericLeaks 重构时丢过一次,门在首路由上直接 ReferenceError 崩掉)
  // 元素句柄(见文件头):.all() 钉序号,toast/弹窗/跳页一变就空号空等 30s
  const buttons = await page.getByRole("button").elementHandles();
  const startHash = await page.evaluate(() => location.hash);
  for (const b of buttons.slice(0, DEPTH)) {
    // 离页守卫:点了「← 返回」/入口卡这类导航钮,旧页按钮已无从点起,断循环
    if ((await page.evaluate(() => location.hash)) !== startHash) {
      leftPage = true;
      break;
    }
    const label = await step(`${route} 读名`, () => b.innerText().catch(() => ""));
    const text = (label || "").replace(/\s+/g, " ").trim();
    if (!text || SKIP.test(text)) continue;
    if (!(await b.isVisible().catch(() => false))) continue;
    if (await b.isDisabled().catch(() => false)) continue;
    controls += 1;
    const before = errors.length;
    const beforeFp = await fingerprint();
    /**
     * 已经是「按下」态的单选/开关按钮:点了当然不变 —— 这不是「没反应」。
     *
     * 战报速度 ×1/×2/×4、主题三档这类 `aria-pressed` 组,循环会逐个点一遍;
     * 点到的若是**当前已选**那一档,页面一个像素都不该动,而旧判据把它记成
     * 「点了没反应」。上一轮报告里那条 `/settings 点「×1」` 就是它 —— 噪声进报告,
     * 真事故就没人看(与文件头「量到的不是要量的事」同一条毛病)。
     */
    const alreadyPressed = await b
      .evaluate((el) => el.getAttribute("aria-pressed") === "true")
      .catch(() => false);
    await step(`${route} 点「${text}」`, () => b.click({ timeout: 800 }).catch(() => {}));
    clicked += 1;
    await page.waitForTimeout(160);
    /*
     * 导航类点击要等它真的换页,否则 160ms 的采样的确"看不出变化"。
     *
     * 实测:/dongfu 与 /apprentice 的「← 返回」常驻这张表 —— goBack 走的是
     * router.back() / router.push(父页),而路由是懒加载分包 + 页面淡入,160ms 时
     * 新页还没画出来。同一张表里躺着两条"看着像事故、其实是判据采样太早"的行,
     * 真事故就会被当成噪声忽略(与本文件那条 `aria-pressed` 的教训同一个病)。
     *
     * 改法:指纹没变时再等一次(总共 ~560ms)复检;仍然一字不动才记 silent。
     * 只多花一次 evaluate 的量,且只在"看起来没反应"的时候才花。
     */
    if (errors.length > before) errors[errors.length - 1].where = `${route} 点「${text}」`;
    else if (!alreadyPressed) {
      const after = await fingerprint();
      if (after === beforeFp) {
        await page.waitForTimeout(400);
        if ((await fingerprint()) === beforeFp) silent.push(`${route} 点「${text}」`);
      }
    }
    await scanNumericLeaks(`${route} 点「${text}」后泄漏`);
    await step(`${route} 弹窗内逐枚(${text})`, () => clickInsideModal(route));
    // 点开弹窗后关掉,免得挡住后面的按钮
    await page.keyboard.press("Escape").catch(() => {});
    await page.waitForTimeout(80);
  }

  await context.close();
  return {
    route,
    errors,
    silent,
    slowSteps,
    leftPage,
    clicked,
    controls,
    blocked: blocked(),
    ms: Math.round(performance.now() - routeT0),
    setupMs,
  };
}

/**
 * 旧档兼容 —— 玩家最痛的一类事故:一次改版之后,老存档进不去、或者进去了却少了东西。
 *
 * 单测只测迁移函数本身;这一条走**真实启动路径**:按旧形状加密落盘(标量灵草、
 * 没有五档表),打开游戏,再从盘上读回来 —— 迁移必须已经写回新形状、旧键清掉、
 * 且那几株草一株不少。迁移代码在 main.ts 里,任何一次启动顺序改动都可能让它不跑。
 */
async function checkLegacySave(browser) {
  const fails = [];
  const slices = lateSlices();
  delete slices.resources.herbs;
  slices.resources.herb = 7;
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  try {
    await seedSave(ctx, slices, "__legacyFixture");
    const page = await ctx.newPage();
    const pageErrors = [];
    watchPageErrors(page, pageErrors);
    await page.goto(INDEX + "#/inventory", { waitUntil: "load" });
    await page.waitForTimeout(1800);
    const raw = await page.evaluate(() => localStorage.getItem("xuanshu.resources"));
    const res = JSON.parse(decryptSlice(raw) || "{}");
    if (!res.herbs) fails.push("旧档的标量灵草没有被迁移成五档");
    if (res.herb !== undefined) fails.push("迁移之后旧键 herb 还在盘上");
    if ((res.herbs?.["1"] ?? 0) < 7)
      fails.push(`旧档攒下的 7 株灵草没保住(实得 ${res.herbs?.["1"]})`);
    if (pageErrors.length) fails.push(`旧档载入报错:${pageErrors[0]}`);
  } finally {
    await ctx.close();
  }
  return fails;
}

/**
 * 存储写满 —— 「进度没进档」这件事必须说得出来,而且要好得了。
 *
 * 单测已经证明了存储层:失败会浮出状态、订阅方收到通知、那一片留在队列里重试、
 * 恢复时再报一声。但那都在假 localStorage 上;真浏览器里配额是真会抛的,
 * 而**玩家看不看得见**只有这一层能验:
 *   ① 把配额填死(大块 → 小块,直到 64 字节也写不进去);
 *   ② 改一次设置(主题切到另一边)逼一次落盘;
 *   ③ 设置页必须出现「上次写入存档失败」;
 *   ④ 清掉填充物,那一行必须自己消失(存储层每 5 秒重试一次)。
 * 三个判据都不看实现,只看玩家能看到的那句话在与不在。
 */
async function checkSaveFull(browser) {
  const fails = [];
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  try {
    await seedSave(ctx, lateSlices(), "__fullFixture");
    const page = await ctx.newPage();
    const pageErrors = [];
    watchPageErrors(page, pageErrors);
    await page.goto(INDEX + "#/settings", { waitUntil: "load" });
    await page.waitForTimeout(2000);
    const filled = await page.evaluate(() => {
      // 大块先填、失败就换更小的块继续 —— 大块写不进去不等于没缝了
      for (const size of [512 * 1024, 64 * 1024, 8 * 1024, 1024, 256, 64]) {
        const chunk = "x".repeat(size);
        for (let i = 0; i < 2000; i += 1) {
          try {
            localStorage.setItem(`__smokeBallast${size}_${i}`, chunk);
          } catch {
            break;
          }
        }
      }
      try {
        localStorage.setItem("__smokeProbe", "y".repeat(64));
        return false;
      } catch {
        return true;
      }
    });
    if (!filled) fails.push("存储写满场景:没能把配额填死(判据不成立,不是游戏的问题)");
    else {
      // 切主题一定会改设置 → 触发一次 persist 落盘
      const theme = await page.evaluate(() => document.documentElement.dataset.theme ?? "");
      await page
        .getByRole("button", { name: theme === "dark" ? "日间" : "夜间" })
        .first()
        .click({ timeout: 5000 })
        .catch(() => undefined);
      const shown = await page
        .waitForFunction(() => /上次写入存档失败/.test(document.body.innerText), { timeout: 20000 })
        .then(() => true)
        .catch(() => false);
      if (!shown)
        fails.push("存储写满场景:写不进去却没有任何常驻交代(设置页应出现「上次写入存档失败」)");
      await page.evaluate(() => {
        for (const k of Object.keys(localStorage)) {
          if (k.startsWith("__smokeBallast") || k === "__smokeProbe") localStorage.removeItem(k);
        }
      });
      const healed = await page
        .waitForFunction(() => !/上次写入存档失败/.test(document.body.innerText), {
          timeout: 20000,
        })
        .then(() => true)
        .catch(() => false);
      if (!healed) fails.push("存储写满场景:腾出空间之后那句警告没消失(自动重试没生效)");
    }
    if (pageErrors.length)
      fails.push(`存储写满场景页面异常:${[...new Set(pageErrors)].join(" | ")}`);
  } finally {
    await ctx.close();
  }
  return fails;
}

/**
 * 导入存档 —— 换档之后不能被旧内存回写覆盖。
 *
 * 这条盖的是设置页那条链里最险的一步:`importSaveText` 只写盘,之后靠
 * `sealStorageWrites()` + 延时 reload 把内存里的旧档压住。万一封存漏了、或者
 * reload 之前引擎把旧状态刷了一次盘,**玩家看到的会是「导入成功」然后一切照旧** ——
 * 而盘上已经是旧档了,连恢复都没得恢复。
 *
 * 判据两步:导入后道号变成新档的;再挂 3 秒(引擎照跑)、再重载一次,道号仍是新档。
 */
async function checkImportReplacesSave(browser) {
  const fails = [];
  const NEW_NAME = "导入自检";
  const slices = lateSlices();
  const oldName = String(slices.player?.name ?? "");
  const payload = JSON.stringify({
    game: "xuanshu",
    version: SAVE_VERSION,
    exportedAt: Date.now(),
    data: { ...slices, player: { ...slices.player, name: NEW_NAME } },
  });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  try {
    await seedSave(ctx, slices, "__importFixture");
    const page = await ctx.newPage();
    const pageErrors = [];
    watchPageErrors(page, pageErrors);
    await page.goto(INDEX + "#/settings", { waitUntil: "load" });
    await page.waitForTimeout(1500);
    await page.setInputFiles('input[type="file"]', {
      name: "xuanshu-save.json",
      mimeType: "application/json",
      buffer: Buffer.from(payload, "utf8"),
    });
    await page
      .getByRole("button", { name: /用这份替换/ })
      .first()
      .click({ timeout: 5000 });
    // 确认后 800ms 才 reload,再多等一会儿让新档完全起来
    await page.waitForTimeout(3000);
    const readName = async () => {
      await page.goto(INDEX + "#/character", { waitUntil: "load" });
      await page.waitForTimeout(1200);
      return page.evaluate(() => document.body.innerText.slice(0, 4000));
    };
    const afterImport = await readName();
    if (!afterImport.includes(NEW_NAME)) {
      fails.push(`导入后道号没变成「${NEW_NAME}」—— 新档没生效`);
    }
    // 挂着跑一会儿:引擎每 tick 都在改内存,若有回写,这里就会把新档盖掉
    await page.waitForTimeout(3000);
    const afterTick = await readName();
    if (!afterTick.includes(NEW_NAME)) {
      fails.push(`挂 3 秒再重载,道号不再是「${NEW_NAME}」—— 旧内存把新档覆盖了`);
    }
    if (oldName && afterTick.includes(oldName) && oldName !== NEW_NAME) {
      fails.push(`旧道号「${oldName}」又回来了`);
    }
    if (pageErrors.length) fails.push(`导入流程页面异常:${[...new Set(pageErrors)].join(" | ")}`);
    console.log(`导入存档:${oldName} → ${NEW_NAME},挂 3 秒后仍是新档`);
  } finally {
    await ctx.close();
  }
  return fails;
}

/**
 * 挂机稳定性 —— 心跳每拍都会改响应式状态,谁在订阅里往页面/全局表里塞东西,
 * 开一夜就会慢慢变大。这类"越挂越沉"的问题只有跑一段时间才看得见。
 *
 * 判据(20 秒,读的是玩家那一页):
 *   ① DOM 节点数不许长(±5 容差;实测六分钟挂机恒为 314)。
 *   ② 堆内存不许翻三倍以上(读数是抖的,故只拦"翻几倍"这种明显泄漏)。
 * 打印两份读数,方便以后判断是"抖"还是"真的在长"。
 */
async function checkSoakStability(browser) {
  const fails = [];
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  try {
    await seedSave(ctx, lateSlices(), "__soakFixture");
    const page = await ctx.newPage();
    const pageErrors = [];
    watchPageErrors(page, pageErrors);
    await page.goto(INDEX + "#/", { waitUntil: "load" });
    await page.waitForTimeout(3000);
    const sample = () =>
      page.evaluate(() => ({
        nodes: document.getElementsByTagName("*").length,
        mb: (performance.memory?.usedJSHeapSize ?? 0) / 1048576,
      }));
    const before = await sample();
    await page.waitForTimeout(20000);
    const after = await sample();
    if (after.nodes > before.nodes + 5) {
      fails.push(
        `挂机 20 秒后 DOM 节点 ${before.nodes} → ${after.nodes} —— 有心跳在往页面上堆东西`,
      );
    }
    if (before.mb > 0 && after.mb > before.mb * 3 + 20) {
      fails.push(`挂机 20 秒后堆内存 ${before.mb.toFixed(1)}MB → ${after.mb.toFixed(1)}MB`);
    }
    if (pageErrors.length) fails.push(`挂机稳定性页面异常:${[...new Set(pageErrors)].join(" | ")}`);
    console.log(
      `挂机稳定:DOM ${before.nodes} → ${after.nodes} · 堆 ${before.mb.toFixed(1)}MB → ${after.mb.toFixed(1)}MB`,
    );
  } finally {
    await ctx.close();
  }
  return fails;
}

/** 固定上限的并发池:一页一个任务,谁空出来谁接下一页 */
async function runPool(items, limit, worker) {
  const out = Array.from({ length: items.length });
  let next = 0;
  const run = async () => {
    for (;;) {
      const i = next++;
      if (i >= items.length) return;
      try {
        out[i] = await worker(items[i]);
      } catch (e) {
        out[i] = {
          route: items[i],
          errors: [{ where: `${items[i]} 载入`, msg: `任务自身抛异常:${e?.stack ?? e}` }],
          silent: [],
          slowSteps: [],
          leftPage: false,
          clicked: 0,
          blocked: 0,
          ms: 0,
          setupMs: 0,
        };
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
  return out;
}

const wallT0 = performance.now();
const results = await runPool(ROUTES, JOBS, runRoute);
const legacyFails = await checkLegacySave(browser);
const fullFails = await checkSaveFull(browser);
const soakFails = await checkSoakStability(browser);
const importFails = await checkImportReplacesSave(browser);
await browser.close();
const wallMs = Math.round(performance.now() - wallT0);

const clicked = results.reduce((n, r) => n + r.clicked, 0);
const silent = results.flatMap((r) => r.silent);
const errors = results.flatMap((r) => r.errors);
for (const msg of legacyFails) errors.push({ where: "旧档兼容", msg });
for (const msg of fullFails) errors.push({ where: "存储写满", msg });
for (const msg of soakFails) errors.push({ where: "挂机稳定", msg });
for (const msg of importFails) errors.push({ where: "导入存档", msg });
/**
 * 每页至少点得到一个控件 —— 「页面画出来了,但一个能点的都没有」。
 *
 * 冒烟此前只在「点了报错」时红:一页若因某个 v-if 写反、数据分支没走到,
 * 整块行动区消失,它会安静地通过(0 次点击,0 个错误) —— 而那正是最该被发现的一种坏。
 * 门槛设 1 而不是平均值:只拦「彻底没有」,不惩罚本来就该安静的页面。
 */
for (const r of results) {
  if (r.controls > 0 && r.clicked === 0) {
    errors.push({
      where: r.route,
      msg: `找到 ${r.controls} 个可点控件却一个都没点成 —— 点击器坏了,还是全被条件挡住了?`,
    });
  }
}

const blockedTotal = results.reduce((n, r) => n + r.blocked, 0);

console.log(`\n界面冒烟:${ROUTES.length} 页,点击 ${clicked} 次(每页上限 ${DEPTH})`);
// 计时读数:总墙钟、单页耗时 top10、建号/首跳固定开销占墙钟比例(并发摊薄后)。
// 只报数,不判成败 —— 用途是给「14 分钟在哪」这类问题供数据。
const byTime = [...results].sort((a, b) => b.ms - a.ms);
const setupSum = results.reduce((n, r) => n + r.setupMs, 0);
const busySum = results.reduce((n, r) => n + r.ms, 0);
console.log(
  `墙钟 ${(wallMs / 1000).toFixed(1)}s · 单页合计 ${(busySum / 1000).toFixed(1)}s · ` +
    `并发 ${JOBS} 路 · 建号/首跳合计 ${(setupSum / 1000).toFixed(1)}s` +
    `(摊到墙钟约 ${((setupSum / JOBS / wallMs) * 100).toFixed(0)}%)`,
);
console.log("单页耗时 top10(总耗时 · 其中建号/首跳 · 点击数):");
for (const r of byTime.slice(0, 10)) {
  console.log(
    `  ${(r.ms / 1000).toFixed(1).padStart(6)}s (setup ${(r.setupMs / 1000).toFixed(1)}s) · ${String(r.clicked).padStart(3)} 次点击 · ${r.route}`,
  );
}
// 慢步骤读数(>1s,不判失败):静默等待再长回来会先在这里现形(见文件头「元素句柄」注)。
// --late 的终局模拟是真算,会合理落进来 —— 当读数看,不当门槛。
const slow = results.flatMap((r) => r.slowSteps ?? []);
const leftPages = results.filter((r) => r.leftPage);
if (slow.length) {
  console.log(`单步 >1s 的等待 ${slow.length} 处(读数,不判失败):`);
  for (const s of [...slow].sort((a, b) => b.ms - a.ms).slice(0, 15))
    console.log(`  · ${String(s.ms).padStart(6)}ms  ${s.where}`);
}
if (leftPages.length) {
  console.log(
    `中途离页 ${leftPages.length} 页(点了导航钮,旧页余下按钮不再点):${leftPages.map((r) => r.route).join("、")}`,
  );
}
if (silent.length) {
  console.log(`点了没反应 ${silent.length} 处(读数,不判失败):`);
  for (const s of silent.slice(0, 20)) console.log(`  · ${s}`);
}
if (errors.length === 0) {
  if (blockedTotal !== 0) {
    console.log(`✗ 这一轮发起了 ${blockedTotal} 个外域请求 —— 本站的决定是「零外部请求」`);
    process.exitCode = 1;
  } else {
    console.log("✓ 无运行时异常(外域请求 0 个:不接入任何第三方)");
  }
} else {
  for (const e of errors) console.log(`✗ ${e.where}\n   ${e.msg.split("\n")[0]}`);
  process.exitCode = 1;
}
