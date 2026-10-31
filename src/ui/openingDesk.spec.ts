import { describe, expect, it } from "vite-plus/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { readStyleCss } from "@/test/readStyleCss";

const ROOT = resolve(__dirname, "../..");

function source(rel: string): string {
  if (rel === "src/style.css") return readStyleCss();
  return readFileSync(resolve(ROOT, rel), "utf8");
}

describe("开卷两页 · 先立山门,再问心定命", () => {
  it("欢迎页把题字、境界总账与三则守则收成一页,主入口仍在首屏", () => {
    const welcome = source("src/views/WelcomeView.vue");
    const pact = source("src/components/opening/OpeningPact.vue");

    expect(welcome).toContain("data-opening-gate");
    expect(welcome).toContain(
      'import OpeningBackdrop from "@/components/opening/OpeningBackdrop.vue"',
    );
    expect(welcome).toContain('<OpeningBackdrop variant="gate" />');
    expect(welcome).toContain("data-opening-enter");
    expect(welcome).toContain("cnNumber(WORLDS.length)");
    expect(welcome).toContain("cnNumber(REALMS.length)");
    expect(welcome).toContain('v-for="(line, index) in highlights"');
    expect(welcome).toContain("btn-seal animate-glow-pulse");
    expect(welcome).not.toContain("card-ink");
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
  });

  it("建号页把留名、验根与定卷排成一张命书,重掷与踏入仙途仍走原动作", () => {
    const create = source("src/views/CreateView.vue");

    expect(create).toContain("data-opening-create");
    expect(create).toContain('<OpeningBackdrop variant="create" />');
    expect(create).toContain("data-opening-roots");
    expect(create).toContain("data-opening-reroll");
    expect(create).toContain('class="opening-create__sheet"');
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
      /@media \(min-width: 820px\)\s*\{[\s\S]{0,220}\.opening-gate__layout\s*\{[\s\S]{0,160}grid-template-columns:/,
    );
    expect(create).toMatch(
      /@media \(min-width: 760px\)\s*\{[\s\S]{0,180}\.opening-create__sheet\s*\{[\s\S]{0,140}grid-template-columns:/,
    );
    expect(welcome).toMatch(
      /@media \(max-width: 220px\)\s*\{[\s\S]{0,500}\.opening-gate__measure\s*\{[\s\S]{0,100}grid-template-columns:\s*minmax\(0, 1fr\)/,
    );
    expect(create).toMatch(/\.opening-create__reroll\s*\{[\s\S]{0,240}white-space:\s*nowrap/);
  });

  it("真浏览器门从 390 首屏量到 1280 双栏,并保留两页截图", () => {
    const layout = source("scripts/layout-check.mjs");

    expect(layout).toContain("[data-opening-enter], [data-opening-reroll]");
    expect(layout).toContain("390_welcome.png");
    expect(layout).toContain("390_welcome_pact.png");
    expect(layout).toContain("390_create.png");
    expect(layout).toContain("1280x800_welcome.png");
    expect(layout).toContain("1280x800_create.png");
    expect(layout).toContain("首屏主入口被推到折线以下");
    expect(layout).toContain("桌面上没有并读山门与三则");
    expect(layout, "取消入山契后要重开并证明勾选没有残留").toContain(
      "取消入山契后再次开契,上次勾选仍残留",
    );
  });
});
