/**
 * 行年 —— 把散在四处「何时得来的」收成一本按年岁读的谱。
 *
 * ## 起因:同一类事实,记了四处,却读不出一处
 *
 * 第 7 轮给图鉴补了道历(收录时第几世、活到几岁),第 27 轮给称号补上,
 * 第 34 轮给灵兽补上。三处都用了 `ui/codexMoment` 那一份历法与文案。
 *
 * 于是一个玩了七世的玩家,手上现成有两百多条「第 N 世 · M 岁得到 X」——
 * 但它们**分躺在三个册子里**:图鉴按品类排、名号页按名录排、灵兽谱按品阶排。
 * 玩家想回答一个最朴素的问题——**「我这一世都做了什么」**——只能一本一本翻。
 *
 * 三张表各自按自己那一册的规矩排序,是那三册的正事;它们合起来讲的却是同一个故事。
 * 这个故事现在没有一页在讲。
 *
 * ## 做什么
 *
 * 只做一件事:把这四处**已经记下的道历**按「第几世 → 多少岁」排成一条年谱。
 *
 * 不新记任何东西、不新写一套历法、不新造一个时刻。凡是没记道历的(旧档里的条目、
 * 只在现实钟上留了痕的宿敌)一律不往里塞 —— 见下面「不编」那一组。
 *
 * ## 为什么是按「世」分卷
 *
 * 道历的两个读数本来就是一粗一细:`世`跨世不变,`岁`在每一世里从零数。故年谱
 * 天然是「世 → 卷,岁 → 行」。这一层分组不是排版偏好,是那一对读数自己的形状。
 *
 * ## 不编
 *
 * 旧档里已收录的条目**没有**道历(那三处的用例都钉着「不补造」)。它们进不了年谱,
 * 年谱写一句「早年收录,未记道历」,与三个册子上的「早年收录」同一句话。
 * 把不知道的时刻编出来,比空着更坏:玩家会拿它当真的。
 */
import { describe, expect, it } from "vite-plus/test";
import { readSource } from "@/test/readSource";
import {
  CHRONICLE_KIND_LABELS,
  type ChronicleEntry,
  buildLifeChronicle,
  chronicleHeadline,
  chronicleRowText,
  countChronicleByKind,
  CHRONICLE_ROW_BATCH,
  groupChronicleByLife,
  renderChronicleRow,
  chronicleLegacyCount,
  type ChronicleInput,
} from "./lifeChronicle";

const emptyInput = (): ChronicleInput => ({
  collectionMoments: {},
  titleMoments: {},
  petMoments: {},
  lives: [],
  lifeNow: 1,
});

describe("行年 · 排序", () => {
  it("先按世、再按岁 —— 一世之内从进山写到此刻", () => {
    const rows = buildLifeChronicle({
      ...emptyInput(),
      titleMoments: {
        ti_zhuji: { life: 2, age: 18 },
        ti_lianqi: { life: 2, age: 9 },
        ti_churu: { life: 1, age: 16 },
      },
    });
    expect(rows.map((r) => [r.life, r.age])).toEqual([
      [1, 16],
      [2, 9],
      [2, 18],
    ]);
  });

  it("同一世同一岁里的几笔并排,谁先谁后不编先后", () => {
    const rows = buildLifeChronicle({
      ...emptyInput(),
      collectionMoments: {
        "gongfa:m_taixuan": { life: 1, age: 16 },
        "equip:tie_jian": { life: 1, age: 16 },
      },
      titleMoments: { ti_churu: { life: 1, age: 16 } },
    });
    // 同岁三笔:顺序只要求稳定(同一份输入恒得同一份输出),不要求时间先后
    const again = buildLifeChronicle({
      ...emptyInput(),
      collectionMoments: {
        "equip:tie_jian": { life: 1, age: 16 },
        "gongfa:m_taixuan": { life: 1, age: 16 },
      },
      titleMoments: { ti_churu: { life: 1, age: 16 } },
    });
    expect(rows.map((r) => r.kind + r.name)).toEqual(again.map((r) => r.kind + r.name));
  });

  it("旧的历世接在年谱前面,当代接在后面", () => {
    const rows = buildLifeChronicle({
      ...emptyInput(),
      lifeNow: 3,
      lives: [
        {
          index: 1,
          major: 3,
          realmLabel: "金丹",
          age: 210,
          themeId: null,
          themeResult: null,
          insight: 12,
          at: 1,
        },
      ],
      titleMoments: { ti_lianqi: { life: 3, age: 7 } },
    });
    expect(rows.map((r) => r.life)).toEqual([1, 3]);
    expect(rows[0]?.kind).toBe("life");
  });
});

describe("行年 · 名字要读得出", () => {
  it("印出来的是物件的真名,不是内部的 id", () => {
    const rows = buildLifeChronicle({
      ...emptyInput(),
      collectionMoments: { "gongfa:m_taixuan": { life: 1, age: 16 } },
      titleMoments: { ti_churu: { life: 1, age: 16 } },
      petMoments: { pet_qingyu: { life: 1, age: 17 } },
    });
    const names = rows.map((r) => r.name);
    expect(names, "功法要读真名").toContain("太玄引气诀");
    expect(names, "称号要读真名").toContain("初入仙途");
    expect(names, "灵兽要读真名").toContain("青羽灵狐");
    // 内部 id 一个都不许穿到玩家眼前
    expect(names.join("|")).not.toMatch(/^(m_taixuan|ti_churu|pet_qingyu)$/m);
  });

  it("认不出的死 id 照实退回键本身 —— 不编一个名字,也不让整行消失", () => {
    const rows = buildLifeChronicle({
      ...emptyInput(),
      titleMoments: { ti_no_such: { life: 1, age: 9 } },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.name).toBe("ti_no_such");
  });

  it("认不得的图鉴品类不进谱 —— 品类名册是这一页的口径,不猜", () => {
    const rows = buildLifeChronicle({
      ...emptyInput(),
      collectionMoments: { "no_such_cat:x": { life: 1, age: 9 } },
    });
    expect(rows).toEqual([]);
  });
});

describe("行年 · 不编", () => {
  it("旧档里没有道历的条目进不了年谱 —— 不按今天的年岁往回编", () => {
    const rows = buildLifeChronicle({
      ...emptyInput(),
      collectionMoments: { "gongfa:m_taixuan": null as never },
      titleMoments: { ti_churu: undefined as never },
      petMoments: {},
    });
    expect(rows).toEqual([]);
  });

  it("坏值(负世、NaN 岁)一律不算一笔", () => {
    const rows = buildLifeChronicle({
      ...emptyInput(),
      titleMoments: {
        bad1: { life: 0, age: 3 },
        bad2: { life: Number.NaN, age: 3 },
        bad3: { life: 2, age: Number.NaN },
        ok: { life: 2, age: 3 },
      },
    });
    expect(rows.map((r) => r.id)).toEqual(["title:ok"]);
  });

  it("数得清有几笔没记道历 —— 空着也照实说,不假装谱是满的", () => {
    const n = chronicleLegacyCount({
      collectionMoments: { "gongfa:a": null as never, "gongfa:b": { life: 1, age: 9 } },
      titleMoments: { x: undefined as never },
      petMoments: {},
      lives: [],
      lifeNow: 1,
    });
    expect(n).toBe(2);
  });
});

describe("行年 · 一行的说法", () => {
  const entry = (over: Partial<ChronicleEntry>): ChronicleEntry => ({
    id: "collection:gongfa:m_taixuan",
    kind: "collection",
    kindLabel: CHRONICLE_KIND_LABELS.collection,
    life: 2,
    age: 18,
    name: "太玄引气诀",
    note: "参入功法册",
    ...over,
  });
  it("一行写得清「多少岁、得了什么、哪一册」", () => {
    expect(chronicleRowText(entry({}))).toBe("十八岁 · 太玄引气诀 · 参入功法册");
  });

  it("岁数写汉字 —— 与全作「第几世」「几岁」同一套写法", () => {
    const text = chronicleRowText(entry({ age: 42 }));
    expect(text.startsWith("四十二岁")).toBe(true);
    // 中文与数字之间留一格;汉字岁数不该再夹阿拉伯数字
    expect(text).not.toMatch(/^\d/);
  });

  it("四类各有自己的印,不混成一类", () => {
    expect(CHRONICLE_KIND_LABELS.collection).toBeTruthy();
    expect(CHRONICLE_KIND_LABELS.title).toBeTruthy();
    expect(CHRONICLE_KIND_LABELS.pet).toBeTruthy();
    expect(CHRONICLE_KIND_LABELS.life).toBeTruthy();
    const labels = Object.values(CHRONICLE_KIND_LABELS);
    expect(new Set(labels).size, "四类的印不许重字").toBe(labels.length);
  });
});

describe("行年 · 卷首一句", () => {
  it("说出这一世留下几笔、走到第几年 —— 不报别的世的账", () => {
    const rows = buildLifeChronicle({
      ...emptyInput(),
      lifeNow: 2,
      titleMoments: {
        a: { life: 2, age: 9 },
        b: { life: 2, age: 33 },
        c: { life: 1, age: 40 },
      },
    });
    const head = chronicleHeadline(rows, 2);
    expect(head.count).toBe(2);
    expect(head.text).toContain("此世");
    expect(head.text).toContain("2 笔");
    expect(head.text).toContain("三十三岁");
  });

  it("空谱不吹牛:一句都不报笔数", () => {
    const head = chronicleHeadline([], 1);
    expect(head.count).toBe(0);
    expect(head.text).not.toMatch(/\d+ 笔/);
  });
});

describe("行年 · 分组与计数", () => {
  it("卷内先铺一批,余下的报得清 —— 两百条的年谱不许一帧全铺", () => {
    const titleMoments: Record<string, { life: number; age: number }> = {};
    for (let i = 0; i < 40; i += 1) titleMoments[`t${i}`] = { life: 1, age: i };
    const groups = groupChronicleByLife(buildLifeChronicle({ ...emptyInput(), titleMoments }), 1);
    const volume = groups[0]!;
    expect(volume.total, "卷要记得自己共有几笔").toBe(40);
    const page = renderChronicleRow(volume, CHRONICLE_ROW_BATCH);
    expect(page.rows.length, "首批只铺一批").toBe(CHRONICLE_ROW_BATCH);
    expect(page.hidden, "余下的要报得清").toBe(40 - CHRONICLE_ROW_BATCH);
    // 续开到底时一行不少
    const all = renderChronicleRow(volume, 999);
    expect(all.rows.length).toBe(40);
    expect(all.hidden).toBe(0);
  });

  it("按世分卷,卷内仍是年岁次第", () => {
    const rows = buildLifeChronicle({
      ...emptyInput(),
      titleMoments: {
        a: { life: 1, age: 3 },
        b: { life: 2, age: 1 },
        c: { life: 1, age: 8 },
      },
    });
    const groups = groupChronicleByLife(rows);
    expect(groups.map((g) => g.life)).toEqual([2, 1]);
    expect(groups[1]?.rows.map((r) => r.age)).toEqual([3, 8]);
  });

  it("计数按类摊开,合计等于总笔数", () => {
    const rows = buildLifeChronicle({
      ...emptyInput(),
      lifeNow: 1,
      titleMoments: { a: { life: 1, age: 3 } },
      petMoments: { p: { life: 1, age: 4 }, q: { life: 1, age: 5 } },
    });
    const byKind = countChronicleByKind(rows);
    expect(byKind.title).toBe(1);
    expect(byKind.pet).toBe(2);
    expect(byKind.collection).toBe(0);
    expect(Object.values(byKind).reduce((a, b) => a + b, 0)).toBe(rows.length);
  });
});

describe("行年 · 真接线", () => {
  it("只读四处已记的道历,不自己记时刻", () => {
    const src = readSource("src/ui/lifeChronicle.ts")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
    expect(src, "不该读墙钟").not.toContain("Date.now()");
    expect(src, "不该直接读 store —— 数据由调用方递进来").not.toMatch(/from ["']@\/stores\//);
  });

  it("三生录立了「行年」这一册,并真的读它", () => {
    const nav = readSource("src/ui/navigation.ts");
    expect(nav, "分册要登记").toContain("行年");
    const view = readSource("src/views/LegacyView.vue");
    expect(view, "要读年谱").toContain("buildLifeChronicle(");
    expect(view, "要有稳定落点").toContain("data-legacy-chronicle");
  });

  it("三处记道历的入口都接进年谱 —— 少一处就少一类", () => {
    const view = readSource("src/views/LegacyView.vue");
    expect(view, "图鉴那一路").toContain("collectedMoment");
    expect(view, "称号那一路").toContain("titleMoments");
    expect(view, "灵兽那一路").toContain("petMoments");
  });
});
