/**
 * 设置页的每一个开关 —— 都必须有**真正的消费点**。
 *
 * ## 由来（第 175 轮）
 *
 * 设置页有十一个开关（音效 / 音乐 / 音量 ×2 / 触感 / 减少动效 / 战报速度 /
 * 主题 / 遇事勿扰 / 隐私同意 / 安装提示）。「开关摆在那儿，拨了没反应」
 * 是玩家最容易撞上、也最难报清楚的一类问题 —— 它没有报错，只是**不生效**。
 *
 * 这一轮逐个核过，十一个都接在真路径上:
 *
 * ```text
 * dndEvents     core/exploration 的弹窗闸 + 历练页的提示行
 * hapticsOn     stores/ui 的触感开关（与 reduceMotion 相与）
 * reduceMotion  CombatPanel 跳过回放、GauntletPanel 直接出结果
 * ```
 *
 * 但这件事**没有判据守着**。`settings.spec` 只测了「系统减少动效时默认值」那一条，
 * `settingsSanitize.spec` 只测坏值夹回。没有任何一条会问「这个开关有没有人读」。
 *
 * ## 这条判据守什么
 *
 * 不在 `stores/settings.ts` 里、也不在设置页自己的文件里 —— 这两处都是**声明与接线**。
 * 真正的消费点必须出现在**别的地方**（core / 其他视图 / 其他组件）。
 *
 * 只认 `settings.<key>` 这种读法。写自己的 store 用 `.value`，界面上读 store 用
 * `settings.x` —— 两种都在扫。
 */
import { describe, expect, it } from "vite-plus/test";
import { walkFiles, isSourceFile, readSource } from "@/test/readSource";

/**
 * 设置 store 里的全部**布尔开关**（以及有实际效果的数值项）。
 *
 * 从源码现读，不手抄 —— 手抄一份清单就是第二本账：加一个开关得记得回来改。
 * 只取 `ref(...)` 声明，且排除纯内部记账字段。
 */
function settingKeys(): string[] {
  const src = readSource("src/stores/settings.ts");
  const keys = [...src.matchAll(/^\s{4}const (\w+) = ref[<(]/gm)].map((m) => m[1]!);
  /*
   * 这几个是**存档记账**，不是开关：没有「消费点」这一说。
   * 显式列出来，而不是靠正则猜 —— 猜错会让判据漏掉真开关。
   */
  const INTERNAL = new Set([
    "privacyAccepted",
    "lastExportAt",
    "installNoticeDismissed",
    "decomposeRanks",
    "smartKeep",
    "onboarded",
  ]);
  return keys.filter((k) => !INTERNAL.has(k));
}

/** 声明与接线之外的源码（消费点只能在这些地方） */
function consumerSources(): { file: string; src: string }[] {
  return walkFiles("src", (f) => isSourceFile(f) && !f.endsWith(".spec.ts"))
    .filter((f) => !f.endsWith("stores/settings.ts"))
    .filter((f) => !f.endsWith("views/SettingsView.vue"))
    .map((f) => ({ file: f, src: readSource(f) }));
}

describe("设置开关 · 每个都要有真正的消费点", () => {
  it("扫到了足够多的开关（防空转）", () => {
    expect(settingKeys().length, "一个开关都没扫到 —— 判据空转或 store 改名了").toBeGreaterThan(5);
  });

  it("每一个开关都在声明与接线之外被读到", () => {
    const sources = consumerSources();
    const orphan: string[] = [];
    for (const key of settingKeys()) {
      const hit = sources.some(
        (s) =>
          s.src.includes(`settings.${key}`) ||
          s.src.includes(`.${key} &&`) ||
          s.src.includes(`.${key} ?`),
      );
      if (!hit) orphan.push(key);
    }
    expect(orphan, "这些开关在设置页上能拨，但没有任何地方读它 —— 拨了不会有反应").toEqual([]);
  });

  it("判据自己认得出「接线」与「消费」的区别（地基）", () => {
    // 设置页自己写 model-value 不算消费 —— 那是接线，已按文件路径排除
    const sources = consumerSources();
    expect(
      sources.some((s) => s.file.endsWith("views/SettingsView.vue")),
      "设置页本身不该算消费点",
    ).toBe(false);
    expect(
      sources.some((s) => s.file.endsWith("stores/settings.ts")),
      "store 本身不该算消费点",
    ).toBe(false);
    // 但别的文件应当在
    expect(sources.length, "消费点来源为空").toBeGreaterThan(50);
  });

  it("实测:那三个最容易假接的开关都有真消费点", () => {
    /*
     * 这三个是「看起来接了、其实只是自己页面上显示状态」的高危项:
     * 触感要真驱动震动、动效要真跳过回放、勿扰要真拦弹窗。
     * 单独点名核一遍 —— 建大清单的判据容易被一条空断言糊过去。
     */
    const sources = consumerSources();
    const has = (key: string, filePart: string) =>
      sources.some((s) => s.file.includes(filePart) && s.src.includes(`.${key}`));

    expect(has("hapticsOn", "stores/ui"), "触感没接进 ui store").toBe(true);
    expect(has("reduceMotion", "CombatPanel"), "减少动效没接进战报回放").toBe(true);
    expect(has("dndEvents", "core/exploration"), "遇事勿扰没接进际遇弹窗闸").toBe(true);
  });
});
