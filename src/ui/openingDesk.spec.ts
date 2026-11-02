import { describe, expect, it } from "vite-plus/test";
import { readSource } from "@/test/readSource";

const source = readSource;

describe("开卷两页 · 先立山门,再问心定命", () => {
  it("欢迎页把山门与三则收成一册两章,主入口仍在首屏", () => {
    const welcome = source("src/views/WelcomeView.vue");
    const pact = source("src/components/opening/OpeningPact.vue");
    const chapterHead = source("src/components/common/FolioChapterHead.vue");

    expect(welcome).toContain("data-opening-gate");
    expect(welcome).toContain("data-opening-gate-register");
    expect(welcome).toContain(
      'import OpeningBackdrop from "@/components/opening/OpeningBackdrop.vue"',
    );
    expect(welcome).toContain(
      'import FolioChapterHead from "@/components/common/FolioChapterHead.vue"',
    );
    expect(welcome).toContain('<OpeningBackdrop variant="gate" />');
    expect(welcome).toContain("data-opening-enter");
    expect(welcome).toContain("cnNumber(WORLDS.length)");
    expect(welcome).toContain("cnNumber(REALMS.length)");
    expect(welcome).toContain('v-for="(line, index) in highlights"');
    expect(welcome).toContain("btn-seal animate-glow-pulse");
    expect(welcome).not.toContain("card-ink");
    expect(welcome, "两章共用一个章首组件").toContain("<FolioChapterHead");
    expect(
      [...welcome.matchAll(/data-opening-chapter="([^"]+)"/g)].map((match) => match[1]),
      "先立山门，再读三则",
    ).toEqual(["gate", "rules"]);
    expect(welcome, "旧山门版式壳已撤").not.toContain("opening-gate__layout");
    expect(welcome, "大标题折两行时要均分，不许把末字孤悬").toContain("text-wrap: balance;");
    expect(chapterHead, "章首要同时报卷次、眉题、题名、读法与真值").toContain(
      'class="folio-chapter-head__index"',
    );
    expect(chapterHead).toContain('class="folio-chapter-head__eyebrow"');
    expect(chapterHead).toContain("folio-chapter-head__fact");
    expect(welcome, "欢迎页要接独立入山契,不再把隐私确认塞回通用说明框").toMatch(
      /<OpeningPact[\s\S]{0,120}:open="agreeOpen"/,
    );
    expect(pact, "入山契要有稳定的运行时契约").toContain("data-opening-pact");
    expect(pact, "入山契把本机存档、断网与数据控制写成三则").toContain("立约 · 三事");
    expect(pact, "署印前必须显式勾选,按钮不能提前可用").toContain(':disabled="!agreed"');
    expect(pact, "署印动作本身还要防御一次,不能只靠按钮禁用").toContain(
      "if (!agreed.value) return;",
    );
    expect(pact, "每次重新开契都要清掉上一次勾选").toContain("if (open) agreed.value = false;");
    expect(pact, "极窄档收起契印时要用 important 压过组件自身的 display:grid").toContain(
      "tinylens:!hidden",
    );
    expect(pact, "隐私政策入口要实打实过 28px 触达下限").toMatch(
      /\.opening-pact__policy\s*\{[\s\S]{0,160}min-height:\s*30px/,
    );
  });

  it("隐私政策先给本机、零请求、不接第三方三项结论,再逐条展开原文", () => {
    const privacy = source("src/components/common/PrivacyDialog.vue");

    expect(privacy, "隐私政策要有独立的账页契约").toContain("data-privacy-ledger");
    expect(privacy.match(/data-privacy-fact/g), "卷首三项结论不能缺项").toHaveLength(3);
    expect(privacy.match(/data-privacy-section/g), "七则正文要逐条保留").toHaveLength(7);
    expect(privacy, "极窄档把三项结论改成单列").toContain("tinylens:!grid-cols-1");
    expect(privacy, "系统备份与换机路径仍要写清").toContain("系统自动备份已关闭");
    expect(privacy, "外部反馈入口仍是真链接").toContain("https://github.com/pplmx/xian/issues");
  });

  it("建号页把留名、验根与定卷排成一册三章,重掷与踏入仙途仍走原动作", () => {
    const create = source("src/views/CreateView.vue");

    expect(create).toContain("data-opening-create");
    expect(create).toContain('<OpeningBackdrop variant="create" />');
    expect(create).toContain("data-opening-roots");
    expect(create).toContain("data-opening-reroll");
    expect(create).toContain("data-opening-create-register");
    expect(create).toContain(
      'import FolioChapterHead from "@/components/common/FolioChapterHead.vue"',
    );
    expect(
      [...create.matchAll(/data-opening-chapter="([^"]+)"/g)].map((match) => match[1]),
      "留名、验根、定卷按命书顺序续排",
    ).toEqual(["name", "roots", "vow"]);
    expect(create.match(/<FolioChapterHead\b/g), "三章各用同一枚章首").toHaveLength(3);
    expect(create, "旧命书卡壳已撤").not.toContain("opening-create__sheet");
    expect(create, "旧分区题头已撤").not.toContain("opening-create__section-head");
    expect(create, "道号实时报本页字数").toContain(':fact="nameFact"');
    expect(create, "灵根章首直读同一份鉴定结果").toContain(':fact="profile.gradeName"');
    expect(create, "定卷章首随落印状态改口").toContain(
      ":fact=\"starting ? '正在定卷' : '未落印'\"",
    );
    expect(create).toContain('@click="reroll"');
    expect(create).toContain('@click="begin"');
    expect(create).toContain("ui.worldEnter =");
    expect(create).not.toContain("card-ink");
    expect(create, "灵根盘改自适应网格,五枚在 320+ 不再落单").toContain(
      "grid-template-columns: repeat(auto-fit, minmax(2.75rem, 1fr));",
    );
    expect(create, "灵根圆盘由网格与视口共同定宽,不许再写死 h-16 w-16").not.toContain(
      "grid h-16 w-16 place-items-center",
    );
    expect(create).toContain("width: clamp(2.8rem, 14vw, 3.4rem);");
    expect(create, "320 以下收起纯装饰命印,把整行让给四字题名").toContain(
      'class="opening-create__stamp compact:!hidden"',
    );
  });

  it("桌面把开卷页放宽成双栏,极窄档仍收成单列且动作锁一行", () => {
    const app = source("src/App.vue");
    const css = source("src/style.css");
    const welcome = source("src/views/WelcomeView.vue");
    const create = source("src/views/CreateView.vue");

    expect(app).toContain(':data-opening="!game.started"');
    expect(css).toMatch(/\.app-shell\[data-opening="true"\]\s*\{[\s\S]{0,120}max-width:\s*72rem/);
    expect(welcome).toMatch(
      /@media \(min-width: 820px\)\s*\{[\s\S]{0,220}\.opening-gate__register\s*\{[\s\S]{0,160}grid-template-columns:/,
    );
    expect(create).toMatch(
      /@media \(min-width: 760px\)\s*\{[\s\S]{0,180}\.opening-create__register\s*\{[\s\S]{0,140}grid-template-columns:/,
    );
    expect(create).toMatch(
      /@media \(min-width: 960px\)\s*\{[\s\S]{0,220}\.opening-create__register\s*\{[\s\S]{0,160}grid-template-columns:[\s\S]{0,180}minmax\(12rem, 0\.58fr\)/,
    );
    expect(create, "定卷列较窄时真值退到题下").toMatch(
      /\.opening-create__vow :deep\(\.folio-chapter-head__fact\)\s*\{[\s\S]{0,120}grid-column:\s*2/,
    );
    expect(welcome).toMatch(
      /@media \(max-width: 220px\)\s*\{[\s\S]{0,500}\.opening-gate__measure\s*\{[\s\S]{0,100}grid-template-columns:\s*minmax\(0, 1fr\)/,
    );
    expect(create).toMatch(/\.opening-create__reroll\s*\{[\s\S]{0,620}white-space:\s*nowrap/);
  });

  it("真浏览器门从 390 首屏量到 1280 双栏,并保留两页截图", () => {
    const layout = source("scripts/layout-check.mjs");

    expect(layout).toContain("[data-opening-enter], [data-opening-reroll]");
    expect(layout).toContain("390_welcome.png");
    expect(layout).toContain("390_welcome_pact.png");
    expect(layout).toContain("390_privacy_ledger.png");
    expect(layout).toContain("390_create.png");
    expect(layout).toContain("1280x800_welcome.png");
    expect(layout).toContain("1280x800_create.png");
    expect(layout).toContain("首屏主入口被推到折线以下");
    expect(layout).toContain("桌面上没有并读山门与三则");
    expect(layout, "真浏览器门要核对两页章序与章首").toContain("data-opening-chapter");
    expect(layout, "建号页桌面双栏改名后仍要真量").toContain("[data-opening-create-register]");
    expect(layout, "建号页宽桌面要量三章并读").toContain("宽桌面没有并读留名 / 验根 / 定卷");
    expect(layout, "取消入山契后要重开并证明勾选没有残留").toContain(
      "取消入山契后再次开契,上次勾选仍残留",
    );
    expect(layout, "隐私总账也要在 200% 档量过").toContain("隐私总账在 200% 下坏了");
    expect(layout, "开局页在 768 宽也要从手机窄栏展开").toContain(
      "page.setViewportSize({ width: 768, height: 1024 })",
    );
    expect(layout, "开局宽叶仍是一条手机窄栏要当场报红").toContain("开局宽叶仍收成手机窄栏");
  });
});
