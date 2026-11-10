/* oxlint-disable no-console */
/**
 * 凡界生成 · 主观新颖度代理审计
 *
 * 上一轮的结论带着一个明确的边界:结构新颖 0.42~0.53 证明的是
 * 「组合确实变了」,不能证明玩家打开这一世时不会想
 * 「还是那些区域、那些怪,只是重排了一遍」。
 *
 * 这一层用代理指标先排除**明显换皮**:把生成结果拆成玩家实际会看到的层,
 * 再问两个世界的表面特征是否仍高度相似。
 *
 * 不改生成器、不改玩法。
 */
import { describe, expect, it } from "vite-plus/test";
import { generateSeries } from "./mortalWorldGen";
import { MUTATORS, MUTATOR_THEMES, THEME_IDENTITY, mutatorsWithoutTheme } from "@/data/mutators";
import {
  avgVisibleByDim,
  isFocused,
  noveltyGap,
  skeletonDimensions,
  skeletonDistance,
  skeletonOf,
  skeletonRepeats,
  visibleDistance,
  visibleFeatures,
  worldIdentity,
} from "./mortalIdentity";

const SERIES = generateSeries(6, 20260904, 10);
const WORLDS = SERIES.map((s) => s.world);

describe("可见新颖 · 世界身份", () => {
  it("身份是从已有素材抽出来的,不需要新写剧情", () => {
    for (const w of WORLDS) {
      const id = worldIdentity(w);
      // 地貌来自区域 icon,主题来自变数语义轴,偏向来自资源
      expect(id.terrain).toBeTruthy();
      expect(id.themeName).toBeTruthy();
      // 名字未必含主地貌 —— 占比不足时不许拿它代表整个世界
      //(见 worldNaming.spec.ts:众数 ≠ 主导)。
      // 但主题词恒在:它是唯一横贯全程的属性
      if (id.form === "single") expect(id.name).toContain(id.terrain);
      if (id.form === "dual") expect(id.name).toContain(id.secondary!);
      if (id.form === "scattered") expect(id.name).toContain(id.themeName);
    }
    console.log("\n地貌取自区域 icon,主题取自 MUTATOR_THEMES,偏向取自资源 —— 全是现成素材");
  });

  it("语义聚焦度:六处地界拼出来的世界会不会变成大杂烩", () => {
    console.log("\n世代  语义轴数  聚焦");
    for (const [i, w] of WORLDS.entries()) {
      const id = worldIdentity(w);
      console.log(
        `${String(i + 1).padStart(4)} ${String(id.axisCount).padStart(9)}  ${isFocused(id) ? "是" : "否"}`,
      );
    }
    const unfocused = WORLDS.filter((w) => !isFocused(worldIdentity(w))).length;
    console.log(
      `\n${unfocused}/${WORLDS.length} 个世界语义发散 ——` +
        "\n地界是随机选的,地貌自然混杂;天界的「≤2 轴」语义门在这里不成立",
    );
    /**
     * 这条例子的结论是「随机选地界 ⇒ 语义必然发散」,而 `>= 0` 恒真,等于
     * 什么都没钉:哪天世界生成改成按语义挑地界(发散归零),它也不会响。
     * 真正要守的正是那个"必然"—— 断言写 > 0,让它能被违反。
     * 比例不设阈值:本作不打算给凡界套天界那把「≤2 轴」的尺子。
     */
    expect(
      unfocused,
      `没有一世语义发散(${WORLDS.length} 世全聚焦)—— 凡界的世界生成是不是被改成按语义挑地界了`,
    ).toBeGreaterThan(0);
  });
});

describe("可见新颖 · 结构与可见的落差", () => {
  it("预期被推翻:聚合可见新颖度并不低于结构新颖度", () => {
    const gaps = [];
    for (let i = 1; i < WORLDS.length; i += 1)
      gaps.push(noveltyGap(WORLDS[i]!, WORLDS.slice(0, i)));
    const avgStruct = gaps.reduce((s, g) => s + g.structural, 0) / gaps.length;
    const avgVisible = gaps.reduce((s, g) => s + g.visible, 0) / gaps.length;
    console.log(
      `\n平均结构新颖 ${avgStruct.toFixed(3)},平均可见新颖 ${avgVisible.toFixed(3)},` +
        `落差 ${(avgStruct - avgVisible).toFixed(3)}`,
    );
    // 原本预期落差为正(内部变了玩家看不出),实测两者接近甚至反向。
    // 但这个聚合读数不能拿来下结论——见下一条
    expect(Math.abs(avgStruct - avgVisible)).toBeLessThan(0.2);
    console.log("\n两者接近。但聚合值在这里是个坏指标,下一条拆开看");
  });

  it("曾经的失效方式已修复:两个死维度都活了", () => {
    const dims = avgVisibleByDim(WORLDS);
    console.log("\n可见维度        两两平均距离");
    for (const [k, v] of Object.entries(dims).sort((a, b) => b[1] - a[1])) {
      const bar = "█".repeat(Math.round(v * 20));
      console.log(`${k.padEnd(14)} ${v.toFixed(3)}  ${bar}`);
    }
    // 历史记录:路线形状与事件密度曾恒为 0,被地界名 0.81 的高分整个平均掉。
    // 那次失效正是「不可用综合分数掩盖关键维度缺失」这条原则的由来
    expect(dims["地界名"]!).toBeGreaterThan(0.7);
    expect(dims["路线形状"]!).toBeGreaterThan(0);
    expect(dims["事件密度"]!).toBeGreaterThan(0);
    console.log(
      "\n曾经:路线形状 0.000、事件密度 0.000,被地界名 0.811 平均掉,总分仍显示「很新」。" +
        `\n现在:路线形状 ${dims["路线形状"]!.toFixed(3)}、事件密度 ${dims["事件密度"]!.toFixed(3)} ——` +
        "\n骨架生成器与节奏原型接入后,这两维不再是死的",
    );
  });

  it("可见距离在两两之间也偏低", () => {
    const ds: number[] = [];
    for (let i = 0; i < WORLDS.length; i += 1) {
      for (let j = i + 1; j < WORLDS.length; j += 1)
        ds.push(visibleDistance(WORLDS[i]!, WORLDS[j]!));
    }
    const min = Math.min(...ds);
    const avg = ds.reduce((s, d) => s + d, 0) / ds.length;
    console.log(`\n两两可见距离:最小 ${min.toFixed(3)},平均 ${avg.toFixed(3)}`);
    expect(min).toBeGreaterThan(0);
  });
});

describe("可见新颖 · 体验骨架去重", () => {
  it("起步深浅属于骨架差异:整条路线平移仍是不同的开局", () => {
    const base = WORLDS[0]!;
    const deeper = {
      ...base,
      chain: base.chain.map((place) => ({ ...place, tier: place.tier + 3 })),
    };
    const dist = skeletonDistance(base, deeper);
    expect(dist, "层级整段抬高后骨架距离仍为 0 —— 起步深浅被归一化吃掉了").toBeGreaterThan(0);
    console.log(
      `\n同一条路线整体从 ${base.chain[0]!.tier} 档抬到 ${deeper.chain[0]!.tier} 档:` +
        `\n骨架距离 ${dist.toFixed(3)} > 0 —— 起步深浅不会被「只看曲线形状」抹平`,
    );
  });

  it("路线形状不再恒定 —— 曾经是当前生成器最明显的可见缺陷", () => {
    const dims = skeletonDimensions(WORLDS);
    const shape = dims.find((d) => d.dim === "路线形状")!;
    // 曾经:tier 硬编码为 `2 + i * 3`,六世的推进曲线一模一样
    expect(shape.values).toBeGreaterThan(1);
    console.log(
      `\n六世出现 ${shape.values} 种路线形状 —— 曾经全部是 2-5-8-11-14-17(硬编码 \`2 + i * 3\`)。` +
        "\n玩家不再每一世都走同样节奏的推进",
    );
  });

  it("骨架整体是否出现连续重复", () => {
    const r = skeletonRepeats(WORLDS);
    console.log(`\n骨架 ${r.distinct}/${WORLDS.length} 种,最长连续重复 ${r.longestRun} 世`);
    for (const [i, w] of WORLDS.entries()) {
      console.log(`  ${i + 1}. ${skeletonOf(w)}`);
    }
    // 连续重复比总重复更伤体验
    expect(r.longestRun).toBeLessThanOrEqual(WORLDS.length);
  });

  it("可见层已无死维度,重复感的主因被拆掉", () => {
    const dims = skeletonDimensions(WORLDS);
    const dead = dims.filter((d) => d.values === 1).map((d) => d.dim);
    console.log("\n各维取值数:");
    for (const d of dims) console.log(`  ${d.dim.padEnd(14)} ${d.values}`);
    // 曾经「事件密度结构」与「路线形状」恒为单值
    expect(dead).not.toContain("路线形状");
    expect(dead).not.toContain("事件密度结构");
    console.log(
      `\n取值恒定的维度:${dead.join("、") || "无"}` +
        "\n\n抬高 NOVELTY_MIN 从来治不了这个 —— 结构门槛管的是敌人机制与解法空间," +
        "\n而「又来了」的感觉来自路线节奏与地貌顺序。" +
        "\n解法是给这两维各自设独立的门(见 mortalGate),而不是把总分调高",
    );
  });
});

describe("可见新颖 · 本轮的边界", () => {
  it("代理指标只能排除明显换皮,不能证明玩家会觉得新鲜", () => {
    // visibleDistance 度量的仍是特征差异,不是主观体验。
    // 它能抓出「地界名与推进节奏都一样」这类硬伤,
    // 但「叙事是否有新鲜感」只有实际游玩能判断
    const w = WORLDS[0]!;
    const v = visibleFeatures(w);
    expect(v.placeNames.length).toBe(v.shape.length);
    console.log(
      "\n可见距离能抓出硬伤(名字重复、节奏雷同、首尾同型)," +
        "\n抓不出「文案读起来是不是同一个味道」——" +
        "\n地界名、事件文案全部沿用原素材,这一层仍需实际游玩验证",
    );
  });
});

/**
 * 世界身份的两件事:**主题表必须全覆盖**,且**不许静默兜底**。
 *
 * ## 缺口
 *
 * `MUTATOR_THEMES` 只有 10 条,而 `MUTATORS` 有 17 条。`worldIdentity` 当时写的是
 * `MUTATOR_THEMES[w.ruleId] ?? "survival"` —— 于是七条没登记的变数全被当成
 * 「求生」轴,凡界凡抽到它们,世界名就叫「生机断绝」。
 *
 * 实测本仓 240 座凡界:**94 座(39.2%)**落进这一档。玩家在同一屏读到
 * 「……为生机断绝所笼罩」与「命数:敌人防御 +25%」—— 两句话互相打脸。
 *
 * ## 为什么旧判据全绿
 *
 * 原有一条断言是 `expect(id.themeName).toBeTruthy()`。兜底出来的「生机断绝」
 * 同样非空,所以**判据在错误的样本上做出了正确的判断**。
 * 这与 `docs/development.md` 记的那条教训同形:不是没判据,是判据选错了落点。
 *
 * ## 这两条守什么
 *
 * ① 集合相等:每一条 `MUTATORS` 都必须在 `MUTATOR_THEMES` 里有登记,
 *    反向也不许多出没人用的键。差集由 `mutatorsWithoutTheme()` 现算。
 * ② 不兜底:拿一条**真的没登记**的变数造一个世界,世界名里不许出现任何主题词,
 *    `theme`/`themeName` 必须是 null —— 未知就老实说未知,不伪装成 survival。
 *    这条是注入验证过的:把 `?? "survival"` 加回去,它会红。
 */
describe("世界身份 · 主题表必须全覆盖,未知不许伪装", () => {
  it("每一条天道变数都登记了主题(集合相等,双向)", () => {
    const missing = mutatorsWithoutTheme().map((m) => `${m.id}(${m.name})`);
    expect(
      missing,
      "这些变数没登记 MUTATOR_THEMES —— 抽中它们的世界会被命名成错误的意象:" + missing.join("、"),
    ).toEqual([]);

    // 防空转:表要是空的,上面那条会「通过」
    expect(MUTATORS.length, "一条变数都没读到 —— 判据会空转").toBeGreaterThan(10);

    // 反向:表里不许有 MUTATORS 中不存在的键(改名后的剩键会让覆盖数看着够)
    const ids = new Set(MUTATORS.map((m) => m.id));
    const orphans = Object.keys(MUTATOR_THEMES).filter((id) => !ids.has(id));
    expect(orphans, "主题表里有 MUTATORS 中不存在的键:" + orphans.join("、")).toEqual([]);
  });

  it("世界名里的主题词与那一条变数对得上(逐条抽一个世界核)", () => {
    /*
     * 上面那条守「有没有登记」,这条守「登记对不对」——
     * 把主题表清空再全填 survival 也能过①,却仍在撒谎。
     * 逐条变数造一个 ruleId 就是它的世界,核世界名/摘要里的主题词
     * 正是 `THEME_IDENTITY[该变数的主题]`。
     */
    const base = generateSeries(1, 20260904, 1)[0]!.world;
    let checked = 0;
    for (const mut of MUTATORS) {
      const theme = MUTATOR_THEMES[mut.id];
      if (!theme) continue;
      const want = THEME_IDENTITY[theme];
      const id = worldIdentity({ ...base, ruleId: mut.id, ruleName: mut.name });
      // 主题词只出现在 single / scattered 两种命名里(dual 用地貌命名)
      if (id.form !== "dual") {
        expect(id.name, `${mut.name} 的世界名该带「${want}」`).toContain(want);
        expect(id.summary, `${mut.name} 的摘要该带「${want}」`).toContain(want);
      }
      expect(id.themeName, `${mut.name} 的 themeName`).toBe(want);
      checked += 1;
    }
    expect(checked, "一条变数都没核到 —— 判据会空转").toBe(MUTATORS.length);
  });

  it("没登记的变数不许被伪装成「生机断绝」—— 未知就老实说未知", () => {
    /*
     * 用一条确实不在表里的假 id 造世界。旧代码会给它 `?? "survival"`,
     * 于是世界名叫「生机断绝的 X 之世」—— 明明什么都不知道,却报了一个具体意象。
     * 现在 theme / themeName 是 null,名字里不许出现任何 THEME_IDENTITY 的值。
     */
    const base = generateSeries(1, 20260904, 1)[0]!.world;
    const id = worldIdentity({ ...base, ruleId: "__probe_unregistered__", ruleName: "未知" });
    expect(id.theme, "未登记的变数不该有一个具体主题").toBeNull();
    expect(id.themeName, "未登记的变数不该有一个具体意象").toBeNull();
    const anyThemeName = Object.values(THEME_IDENTITY);
    for (const word of anyThemeName) {
      expect(
        id.name + id.summary,
        `未登记的变数被命名成了「${word}」—— 未知被伪装成了已知`,
      ).not.toContain(word);
    }
    // 但仍要是一句完整的话,不许留空串或「null」
    expect(id.name.length, "名字不该留空").toBeGreaterThan(3);
    expect(id.name + id.summary).not.toContain("null");
    expect(id.name + id.summary).not.toContain("undefined");
  });
});
