/**
 * 品阶印 · 提示条带上「这是哪一档」
 *
 * 由来:高品之物落地时,那一条提示与「灵石 +3」「灵草 +10」长得一模一样 ——
 * 一句灰字、两秒、消失。玩家得到天品法器的那一刻,屏幕上没有任何东西比得上
 * 这件事的分量。品阶印让它自带这一档的印:色与单字都取自品质表。
 *
 * 判据四组:
 *   一 载荷只有品质 id —— core 不该知道色值(那是调色板的事);
 *   二 写坏的 id 不许盖出半枚印:认不得就整枚不出,尤其不许静默变成凡品印;
 *   三 三处高品落地都带印:装备拾得、法宝入手、神兽结缘;
 *   四 不填印的提示布局不变 —— 绝大多数提示没有印,它们不该被改。
 */
import { describe, expect, it } from "vite-plus/test";
import { createPinia, setActivePinia } from "pinia";
import { beforeEach } from "vite-plus/test";
import { readSource } from "@/test/readSource";
import { QUALITIES } from "@/data/qualities";
import { useUiStore } from "@/stores/ui";
import { notify, setNotifier } from "@/core/notify";

beforeEach(() => setActivePinia(createPinia()));

describe("品阶印 · 落点", () => {
  it("带印的提示照实记下那一档", () => {
    const ui = useUiStore();
    ui.toast("拾得天品", "rare", "heaven");
    expect(ui.toasts.at(-1)!.seal).toBe("heaven");
  });

  it("不带印的提示 seal 为 undefined —— 绝大多数提示走这条路", () => {
    const ui = useUiStore();
    ui.toast("灵石 +3");
    expect(ui.toasts.at(-1)!.seal).toBeUndefined();
  });

  it("写坏的品质 id 整枚不出,尤其不许静默变成凡品印", () => {
    const ui = useUiStore();
    ui.toast("坏印", "rare", "not_a_quality");
    expect(ui.toasts.at(-1)!.seal, "认不得的档位不该盖印").toBeUndefined();
    ui.toast("空印", "rare", "");
    expect(ui.toasts.at(-1)!.seal).toBeUndefined();
  });

  it("九档每一档都认得", () => {
    const ui = useUiStore();
    for (const q of QUALITIES) {
      ui.toast(`印 ${q.name}`, "rare", q.id);
      expect(ui.toasts.at(-1)!.seal, `${q.name} 的印没盖上`).toBe(q.id);
    }
  });
});

describe("品阶印 · 载荷只带 id", () => {
  it("notify 端口的 seal 是字符串,不带色值", () => {
    const src = readSource("src/core/notify.ts");
    expect(src, "端口只该声明「哪一档」").toMatch(/seal\?: string/);
    /*
     * 判据要认的是 **import**,不是「这份文件里有没有出现过这几个字」——
     * 注释里正当提到 `data/qualities`(说明色值归上层去取)不该被打红。
     * 与 deadExportAudit 同一条纪律:说法与接线要分开认。
     */
    expect(src, "core 不该 import 品质表").not.toMatch(/import[^;]*from ["']@\/data\/qualities/);
    expect(src, "core 不该 import 调色板").not.toMatch(/import[^;]*from ["']@\/ui\/colorVar/);
  });

  it("端口转发器不吞第三个参数 —— 印要真的走到落点", () => {
    /*
     * 这条守的是一个真实栽过的坑:转发器写成 `(text, kind) => toast(text, kind)`,
     * 类型上完全合法(多出来的实参被丢掉不报错),于是 core 传了品阶、落点却永远收不到 ——
     * 而单元测试里直接调 store 的 toast(三个参数)全是绿的。判据必须直接走端口。
     */
    const ui = useUiStore();
    setNotifier({ toast: (text, kind, seal) => ui.toast(text, kind, seal) });
    notify("走高品之物", "rare", "immortal");
    expect(ui.toasts.at(-1)!.seal).toBe("immortal");
    setNotifier(null);
  });

  it("界面那侧才去品质表取色与字", () => {
    const host = readSource("src/components/common/ToastHost.vue");
    expect(host, "印的字取品质名首字").toContain("qualityDef(t.seal).name.charAt(0)");
    expect(host, "印的色取品质表").toContain("qualityDef(quality).color");
    expect(host, "印要有稳定落点供真浏览器复核").toContain(":data-toast-seal=");
  });
});

describe("品阶印 · 三处高品落地都带印", () => {
  it("装备拾得 / 法宝入手 / 神兽结缘,各自把品阶交给 notify", () => {
    const loot = readSource("src/core/loot.ts");
    const event = readSource("src/core/eventEngine.ts");
    // 去掉空白再找:格式怎么排都认,守的是「这一条带着自己的品阶」(见上一条注释)
    const flatLoot = loot.replace(/\s+/g, " ");
    expect(flatLoot, "装备拾得要带品阶印").toContain('notify(pickup, "rare", inst.quality');
    expect(flatLoot, "法宝入手要带品阶印").toContain("def.quality");
    expect(event, "神兽结缘要带品阶印").toMatch(/notify\([^)]*def\.quality\)/);
  });

  it("不带印的提示不被改写:ToastHost 只在有印时多出一枚 span", () => {
    const host = readSource("src/components/common/ToastHost.vue");
    expect(host, "印要按 t.seal 条件渲染").toMatch(/v-if="t\.seal"/);
    // 正文仍是一个独立的 span,不被印取代
    expect(host).toContain('<span class="min-w-0">{{ t.text }}</span>');
  });
});
