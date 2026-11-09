/**
 * 人物页灵根牌面 · 说得出「这副资质是垫着地板掷出来的」
 *
 * ## 缺口:同一个数,转世弹窗里能看到来路,人物页看不到
 *
 * `aptitudeFloorNow()` 是转世两条自动复利通道之一(另一条是道果,见
 * `core/compoundingAudit`)。它把 `rollLinggen` 掷出的每一根资质整体抬高 ——
 * 人物页灵根牌面上印的 `水 63 木 44` **已经是垫过的数**。
 *
 * 上一轮把这条账补进了转世弹窗(「来世根骨」四行),但那只在**转世那一刻**看得见。
 * 地板是**持续生效**的跨世资产:它留在玩家身上的每一天,人物页那几枚数字都带着它,
 * 而人物页一个字都没说。同一个数在两处的深浅不一样 —— 转世页答得出「这 63 是怎么来的」,
 * 道躯页答不出。
 *
 * ## 线性关系,不许说成概率
 *
 * `aptitude = Math.min(100, rng.int(40,100) + floor)` —— 地板是**加在掷点上**的,
 * 不是概率加成、不是概率门槛。故文案只能说「垫了多少」,不许写「更易得天灵根」
 * 这类带随机色彩的说法(那是另一套机制,而且它并不成立)。
 *
 * ## 只算,不读 store
 *
 * 复用 `ui/reincarnationDesk` 的 `aptitudeFloorBrief`:上一轮已把它做成纯函数,
 * 输入是 `{ lives, insight }`。人物页把 player 里那两个数递进去即可,不另造一套算法 ——
 * 两处各算一遍,改常数时必有一处撒谎。
 */
import { describe, expect, it } from "vite-plus/test";
import { readSource } from "@/test/readSource";

const view = () => readSource("src/views/CharacterView.vue");

describe("道躯页 · 灵根牌面补上地板来路", () => {
  it("灵根区印出地板值,且读的是同一份纯函数", () => {
    const src = view();
    expect(src, "人物页要读地板简报").toContain("aptitudeFloorBrief(");
    expect(src, "要有稳定落点给判据与浏览器门").toContain("data-character-floor");
  });

  it("输入取存档里的两个真值,不在界面另算一套", () => {
    const src = view();
    // lives = 已完成的转世次数;insight = 宿慧总额(含认知折算,见 samsaraService)
    expect(src, "地板输入要读 reincarnation.count").toContain("reincarnation.count");
    expect(src, "地板输入要读 totalInsight()").toContain("totalInsight()");
  });

  it("地板的说法与转世页同源:次数保底 / 宿慧折算,两条口径各自说得出", () => {
    const src = view();
    expect(src, "要说清是哪条口径在顶").toMatch(/宿慧折算|转世保底/);
  });

  it("反空转:这一格真的在说资质的事,不是只挂一个属性", () => {
    const src = view();
    const at = src.indexOf("data-character-floor");
    expect(at, "找不到地板落点").toBeGreaterThan(0);
    // 落点附近必须出现「地板」两个字
    const near = src.slice(Math.max(0, at - 600), at + 900);
    expect(near, "地板那一格没在说地板 —— 判据会空转").toContain("地板");
  });

  it("不许写成概率说法 —— 地板是加在掷点上的,不是提高概率", () => {
    const src = view();
    const at = src.indexOf("data-character-floor");
    const near = src.slice(Math.max(0, at - 600), at + 900);
    for (const banned of ["更易", "概率提升", "几率更高", "更容易出"]) {
      expect(near, `地板写成了概率说法(「${banned}」)—— 机制不是那样`).not.toContain(banned);
    }
  });
});

describe("道躯页 · 地板与转世页不许各算一套", () => {
  it("两处都 import 同一个 aptitudeFloorBrief,没有第二份实现", () => {
    const char = view();
    const dlg = readSource("src/components/character/ReincarnationDialog.vue");
    expect(char).toContain('from "@/ui/reincarnationDesk"');
    expect(dlg).toContain('from "@/ui/reincarnationDesk"');
    // 人物页不许自己写 max(count*5, insight/12) 这类算式
    expect(char, "人物页自己算了一遍地板 —— 与引擎那份必有一处会撒谎").not.toMatch(
      /Math\.max\([^)]*count[^)]*\*|insight\s*\/\s*12/,
    );
  });
});
