/**
 * 图鉴九册的规模数,注释与实物必须同步。
 *
 * ## 复现:注释写着 809,实物是 816
 *
 * `views/CollectionView.vue` 在分批渲染那段注释里写着:
 *
 *     九册全收是 809 枚 chip,首帧全铺实测 1326 DOM;
 *
 * 而按当前数据算出来是 **816** 枚:
 *
 *     装备 288 + 悟道 151 + 事件 104 + 功法 68 + 丹药 69
 *     + 法宝 46 + 灵兽 40 + 天赋 34 + 材料 16 = 816
 *
 * 差 7 枚 —— 内容是长出来的,注释留在原地。这类数字不报错、不崩,
 * 只是让下一个读它的人按错误的分母估算首帧预算。
 *
 * ## 为什么注释里的数也值得钉
 *
 * 本仓的纪律是「不做两本账」:同一个事实只留一处。注释里那个数若与实物分叉,
 * 它就是第二本账 —— 而且是最难发现的一本(不参与任何计算,没有任何判据会红)。
 * 上轮「一律」的教训是同一形态:写下来的规矩若没人守,它只是一句话。
 *
 * 故这条判据做两件事:
 *   一 盘一遍九册的真实规模,和注释里写的数比;
 *   二 把构成列进断言消息 —— 哪一册长胖了,红的时候一眼看得出是哪一册。
 */
import { describe, expect, it } from "vite-plus/test";
import { createPinia, setActivePinia } from "pinia";
import { readSource } from "@/test/readSource";
import { collectionCodex } from "@/ui/codex";

/** 图鉴九册的 { key → 条目数 } */
function bookSizes(): Map<string, number> {
  setActivePinia(createPinia());
  const sizes = new Map<string, number>();
  for (const cat of collectionCodex()) sizes.set(cat.key, cat.entries.length);
  return sizes;
}

function describeSizes(sizes: Map<string, number>): string {
  return [...sizes.entries()].map(([k, n]) => `${k} ${n}`).join(" + ");
}

describe("图鉴九册 · 规模数与注释同源", () => {
  it("九册都非空 —— 空册子说明取数路径断了", () => {
    const sizes = bookSizes();
    expect(sizes.size, "应该正好九册").toBe(9);
    for (const [key, n] of sizes) {
      expect(n, `${key} 册一条都没有`).toBeGreaterThan(0);
    }
  });

  it("注释里那个「九册全收是 N 枚」与实物相等", () => {
    const sizes = bookSizes();
    const total = [...sizes.values()].reduce((a, b) => a + b, 0);
    const src = readSource("src/views/CollectionView.vue");
    const m = src.match(/九册全收是\s*(\d+)\s*枚/);
    expect(m, "注释里该有一句「九册全收是 N 枚」—— 它是首帧预算的分母").not.toBeNull();
    expect(
      Number(m![1]),
      `注释写 ${m![1]} 枚,实物 ${total} 枚 —— 实际构成:${describeSizes(sizes)}`,
    ).toBe(total);
  });

  it("注释里的构成明细也逐册对得上", () => {
    // 修注释时把构成写进去了(装备 288 + 悟道 151 + …),那串数也得是真的
    const sizes = bookSizes();
    const src = readSource("src/views/CollectionView.vue");
    const detail = {
      equip: /装备\s*(\d+)/,
      branch: /悟道\s*(\d+)/,
      event: /事件\s*(\d+)/,
      gongfa: /功法\s*(\d+)/,
      pill: /丹药\s*(\d+)/,
      artifact: /法宝\s*(\d+)/,
      pet: /灵兽\s*(\d+)/,
      talent: /天赋\s*(\d+)/,
      material: /材料\s*(\d+)/,
    } as const;
    for (const [key, re] of Object.entries(detail)) {
      const m = src.match(re);
      expect(m, `注释里该有「${key} N」`).not.toBeNull();
      expect(Number(m![1]), `${key}:注释写 ${m![1]},实物 ${sizes.get(key)}`).toBe(sizes.get(key));
    }
  });
});
