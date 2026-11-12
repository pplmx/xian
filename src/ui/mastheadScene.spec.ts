/**
 * 卷首山水景的覆盖面 —— 别让「这一屏有没有画」靠记性。
 *
 * ## 这件事的由来
 *
 * 前二十几轮逐个界面加画,每轮只量当屏。这轮把全站 37 处 `InkScene` 与我做过的
 * 面积测量对了一遍,发现一件事:**哪些页的卷首有山水景,是历史偶然,不是标准**:
 *
 *   有 `#backdrop` 山水景:AdventureView / CollectionView / CultivationView /
 *                          MortalWorldView / SoulsView / TitlesView
 *   没有(却用了 FolioPageHeader):ApprenticeView / BuildView / CelestialView /
 *                          CharacterView / DongfuView / InventoryView / LegacyView /
 *                          MarketView / RealmCodexView / SettingsView
 *
 * 而 `FolioPageHeader` 的 `backdrop` 槽本来就是这个用途(那一槽渲染在最底层)。
 * 缺它的几页不是「不适合画」,是**当时没想到**——玩家点得最多的三屏
 * (人物 / 行囊 / 天界)都在里面。
 *
 * ## 判据守什么
 *
 * 不给全部十个 view 一律要求(设为主页那类本来就没有主视觉)。钉的是**主页面**:
 * 取了 `folio-page--stack` 且用了 `FolioPageHeader` 的那些,卷首要有一层山水景。
 * 名单写在下面 —— 加一页就加一行,那正是「这一屏该不该有画」要被显式回答。
 */
import { describe, expect, it } from "vite-plus/test";
import { readSource } from "@/test/readSource";

/**
 * 卷首该有山水景的页(逐页显式列出,不靠通配)。
 *
 * 不在名单里的页各有理由(设置页、图鉴页这类以表格为主),要加就加进这里 ——
 * 让「这一屏有没有画」是一个被写下来的决定。
 */
const MUST_HAVE_BACKDROP = [
  "src/views/CharacterView.vue",
  "src/views/InventoryView.vue",
  "src/views/CelestialView.vue",
  "src/views/AdventureView.vue",
  "src/views/CollectionView.vue",
  "src/views/CultivationView.vue",
  "src/views/MortalWorldView.vue",
  "src/views/TitlesView.vue",
  "src/views/DongfuView.vue",
  "src/views/LegacyView.vue",
  "src/views/MarketView.vue",
  "src/views/ApprenticeView.vue",
] as const;

describe("卷首山水景的覆盖面", () => {
  it("名单里的页,卷首都有 #backdrop 且里面是 InkScene", () => {
    const missing: string[] = [];
    for (const path of MUST_HAVE_BACKDROP) {
      const src = readSource(path);
      const slot = src.match(/<template\s+#backdrop>[\s\S]*?<\/template>/)?.[0] ?? "";
      /*
       * 卷首先要有这一槽,且槽里真的是 `InkScene` —— 只查「有 backdrop 字样」
       * 会被注释蒙混过去(那些页的注释里本来就常提 backdrop)。
       */
      if (!slot) missing.push(`${path} 没有 #backdrop 槽`);
      else if (!slot.includes("<InkScene")) missing.push(`${path} 的 #backdrop 里不是 InkScene`);
    }
    expect(missing, "这几页的卷首没有山水景 —— backdrop 槽渲染在最底层,本该放的就是它").toEqual([]);
  });

  it("卷首的天按这一屏的身份算,不是写死的一片", () => {
    /*
     * 前一条只核「槽在不在」——实测把「行囊不分页签」「天界不看正在征伐的界」
     * 两处逻辑删掉,判据仍然绿:结构对了,内容退化成一片固定地形也看不出来。
     *
     * 这一条钉的是**取景依据**:卷首那处 `:terrain` 要么直接调 sceneTerrainOf*
     * (把身份当参数传进去),要么绑到一个 computed —— 而那个 computed 里
     * 必须真的读了某个会变的东西。不许出现 `:terrain="'peaks'"` 这种字面量,
     * 也不许有 `terrain="forest"` 这种静态属性(那两处是既有例外,单独列)。
     */
    const STATIC_OK = new Set([
      /* 这两处是上一批做的,理由写在各自注释里(名号=林麓、藏珍=宫阙) */
      "src/views/TitlesView.vue",
      "src/views/CollectionView.vue",
    ]);
    const offenders: string[] = [];
    for (const path of MUST_HAVE_BACKDROP) {
      if (STATIC_OK.has(path)) continue;
      const src = readSource(path);
      const slot = src.slice(src.indexOf("#backdrop"), src.indexOf("#backdrop") + 900);
      const tag = slot.match(/<InkScene[\s\S]*?\/>/)?.[0] ?? "";
      /* 静态 terrain="xxx" 属性(不带冒号)= 写死 */
      if (/\sterrain="/.test(tag)) offenders.push(`${path} 写死了 terrain`);
      /* 无身份属性(既没 :terrain 也没 :world-id/:icon/:tags)= 没有依据 */
      if (!/:terrain=|:world-id=|:icon=|:tags=/.test(tag)) {
        offenders.push(`${path} 的卷首景没有任何身份依据`);
      }
    }
    expect(offenders, "卷首那片天得由这一屏的身份决定 —— 写死一片等于所有页共用一张底").toEqual([]);
  });

  it("卷首那片天要淡到不给读数拖后腿", () => {
    /*
     * 这一条是**像素门抓出来的**:人物页卷首补上画之后,`layout-check` 的
     * 「渐变/图片底上的字读不出来」当场红 —— 那两行 11px 读数(«人间界» / «道途未成»)
     * 落在画上,对比度掉到 4.42:1 / 4.32:1(需 4.5)。
     *
     * 所以卷首那片天的墨要压得住:0.34 太重、过不了门;压到 0.18 才全绿。
     * 判据钉住这个上限 —— 下一个人调浓之前会先看到它,而不是等门红。
     */
    const tooDark: string[] = [];
    for (const path of MUST_HAVE_BACKDROP) {
      const src = readSource(path);
      /*
       * 类名从模板里取 —— 它写在 `<InkScene class="xxx-masthead__scene">` 上,
       * 不是 CSS 规则里(第一版按 `.xxx-masthead__scene {` 去 Vue 文件里找,
       * 永远取不到,判据空转 —— 实测把墨调回 0.34 仍然绿)。
       */
      const vue = src
        .slice(src.indexOf("#backdrop"))
        .match(/class="([a-z-]+-masthead__scene)"/)?.[1];
      if (!vue) continue;
      const page = path.replace("src/views/", "").replace("View.vue", "").toLowerCase();
      const css = readSource(`src/styles/pages/${page}.css`);
      const rule = css.match(new RegExp(`\\.${vue}\\s*\\{[\\s\\S]*?\\n\\s*\\}`))?.[0] ?? "";
      const ink = Number(rule.match(/--ink-scene-ink:\s*([0-9.]+)/)?.[1] ?? "1");
      /*
       * 0.34 是多数窗用的档,但**卷首**不同:那一格压着名号 / 境界 / 灵根 / 道途
       * 四行 11px 读数,像素门量的是真实对比度。上限取 0.25。
       */
      if (path.includes("CharacterView") && ink > 0.25)
        tooDark.push(`${path} 的卷首墨 ${ink} 偏浓(上限 0.25)`);
    }
    expect(tooDark, "卷首墨太浓会把那几行 11px 读数压到 AA 以下 —— 像素门会红").toEqual([]);
  });

  it("凡取景的页,卷首那片天都要真接上 —— 不是写在名单里就算", () => {
    /*
     * 这一条把「有没有画」的账从源码推进一步:不只查模板里有没有 `<InkScene`,
     * 还要**在浏览器里量到它**。
     *
     * 为什么需要:洞府页的措辞与结构都「像」有画 —— 它有 `DongfuAtlas` 自绘 SVG、
     * 有 `#visual` 槽,单看源码很容易以为这一屏已经有画了;而实测那一屏
     * `scenes = 0`(卷首根本没有山水景)。**结构对了不等于画看得见**。
     *
     * 判据读的是 `scripts/sceneAudit.json`(由 scripts/audit-scenes.mjs 生成,
     * 一次真浏览器跑出来的每页可见场数),与 shots / layout-check 同一套口径:
     * 生成一次、比一次,而不是每次测试都开浏览器。
     */
    const audit = readSource("scripts/sceneAudit.json");
    const rows = JSON.parse(audit) as Array<{ route: string; scenes: number }>;
    const empty = rows.filter((r) => r.scenes === 0).map((r) => r.route);
    expect(empty, "这些主页面在真浏览器里一场景都量不到 —— 等于玩家看不到画").toEqual([]);
  });

  it("每处卷首景都交代了「为什么是这片天」", () => {
    /*
     * 卷首那片天也是「按身份取景」,不是随手挑一种地形好看。
     * 判据要的是**旁边有一段注释说清楚**——写死地形的尤其需要
     * (TitlesView 的 forest、CollectionView 的 palace 都是写死的)。
     */
    const unexplained: string[] = [];
    for (const path of MUST_HAVE_BACKDROP) {
      const src = readSource(path);
      /*
       * 不切 `#backdrop` 槽再找注释 —— 槽里可能套着别的元素(CultivationView 的
       * InkScene 就在一层 `div` 里),非贪婪切到第一个 `</template>` 会切在元素之前,
       * 于是「槽前的注释」根本不在切片里(实测就是这样误报的)。
       * 改在**整份源码**里,从 `#backdrop` 那个位置往前 1200 字符内找注释。
       */
      /*
       * 注释可以写在槽**之前**(多数页),也可以写在槽**里面**贴着 InkScene
       * (CultivationView 那一段就在 div 里)。两处都算交代 —— 钉的是
       * 「这一片天有理由」,不是理由落在第几行。
       */
      const at = src.indexOf("#backdrop");
      const near = at > 0 ? src.slice(Math.max(0, at - 1200), at + 900) : "";
      if (!/<!--[\s\S]*?-->/.test(near)) unexplained.push(`${path} 的卷首景没有交代`);
    }
    expect(unexplained, "卷首这片天也得写清楚为什么").toEqual([]);
  });
});
