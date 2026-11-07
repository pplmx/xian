/**
 * 「注」原语的四条不变式 —— 此前**一条判据都没有**。
 *
 * ## 缺口
 *
 * `public` 组件 `FolioNote.vue` 是全站 8 处收拢的共同落点(修行画像、门规、
 * 星象与本世所钟、功名墙排序、灵根口径、命数管到哪……),但这些不变式
 * ——默认合着 / aria 正确 / 点开一字不少 / name 唯一——**没有任何判据守着**。
 *
 * 实测核实过:`data-folio-note` 在全部 spec 里出现 **0 次**。
 * 也就是说有人改坏这枚组件时,8 处收拢会一起静默失效:
 * 要么注一进页面就摊开(收了个寂寞),要么点开没反应(文案读不到)。
 *
 * ## 为什么用静态判据
 *
 * 四条不变式都能从组件源码与调用点判定;放进浏览器门会让它们只能在整个
 * 布局自检跑完时才可见 —— 改这枚组件的人当场看不到。
 * (浏览器侧的实际开合行为由 `note-audit` 那类一次性脚本验过:
 * 6 个页面 8 处注,默认合着=true、aria=true、点开后文案长度 > 20 且无溢出。)
 */
import { describe, expect, it } from "vite-plus/test";
import { isVueFile, readSource, walkFiles } from "@/test/readSource";

const component = readSource("src/components/common/FolioNote.vue");

describe("「注」原语的不变式", () => {
  it("默认合着:状态初值必须是 false", () => {
    expect(
      /const open = ref\(false\)/.test(component),
      "open 的初值不是 false —— 注会一进页面就摊开,等于没收",
    ).toBe(true);
  });

  it("正文默认不见:v-show 绑在 open 上,不是 v-if", () => {
    /*
     * v-show 保 DOM(点开时内容已在,v-if 会重新渲染整段 slot);
     * 更重要的是切 v-if 后「默认合着」的判据会看着还对、但语义变了。
     */
    expect(/v-show="open"/.test(component), "正文没有用 v-show 绑 open").toBe(true);
  });

  it("读屏知道可开可合:aria-expanded 与 aria-controls 都要有", () => {
    expect(/:aria-expanded="open"/.test(component), "缺 aria-expanded").toBe(true);
    expect(/:aria-controls="bodyId"/.test(component), "缺 aria-controls").toBe(true);
    /* aria-controls 指向的那个 id 必须真的挂在正文上,否则指向空气 */
    expect(/:id="bodyId"/.test(component), "aria-controls 指向的 id 没挂在正文上").toBe(true);
  });

  it("全站 8 处调用的 name 互不相同(否则 aria-controls 会撞 id)", () => {
    const views = walkFiles("src", isVueFile);
    const names: { file: string; name: string }[] = [];
    for (const f of views) {
      const src = readSource(f);
      for (const m of src.matchAll(/<FolioNote\s+name="([^"]+)"/g)) {
        names.push({ file: f, name: m[1]! });
      }
    }
    expect(names.length, "一处 FolioNote 都没找到(判据空转)").toBeGreaterThan(0);
    const dup = names.filter((n, i) => names.findIndex((x) => x.name === n.name) !== i);
    expect(
      dup.map((d) => `${d.name}@${d.file}`),
      "有两处注用了同一个 name —— 它们会共用同一个 DOM id,aria-controls 指向错的那个",
    ).toEqual([]);
  });
});
