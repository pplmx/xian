/**
 * 音量那条链路：设置里是 0-100，交给音频层之前除以 100。
 *
 * ## 由来（第 218 轮，逐个实测设置项是否真的生效）
 *
 * 读 `core/audio` 时看到:
 *
 * ```ts
 * musicBus = new tone.Gain(prefs.musicVol * 0.9).toDestination();
 * ```
 *
 * 而 `settings.musicVol` 的范围是 **0-100**（`Math.min(100, …)`，默认 50）。
 * 若直接把它交给 `Gain`，默认值就会变成增益 **45 倍** —— Tone 的 `Gain`
 * 默认单位是线性振幅（`rampTo(1, 0.1)` 那个例子即原始音量）。
 *
 * **一度以为这是缺陷。不是。** 追到调用链才看见:
 *
 * ```ts
 * // App.vue 里 watch 时就归一化了
 * configureAudio({ …, musicVol: musicVol / 100, sfxVol: sfxVol / 100 });
 * ```
 *
 * 于是 `prefs.musicVol` 是 0~1，`* 0.9` 得到 0~0.9 —— 正确。
 *
 * ## 那为什么还要判据
 *
 * 这条链路**没有任何判据**（`audio.spec` 里搜不到 `musicVol`）。
 * 而它只在 `App.vue` 的一个 `watch` 里成立:
 *
 * ```text
 * 有人把 `/ 100` 删掉   → 音量变成 45 倍防噪，而没有任何一条判据会红
 * 有人把 0-100 改成 0-1 → 同上
 * ```
 *
 * 这正是这个仓库反复踩的那种:**一个正确性依赖两个文件之间的约定，而约定没有字据。**
 *
 * ## 这条判据守什么
 *
 * ① 设置层的音量是 0-100（有上界 100）;
 * ② 交给 `configureAudio` 之前除过 100;
 * ③ 音频层把进来的值夹在 0-1（第二道保险，防别的调用方绕过 App.vue）。
 *
 * ## 故障注入
 *
 * 把 `App.vue` 里的 `/ 100` 删掉 → 第二条红（点名「默认值 50 会被当成 45 倍线性增益」）。
 * 把设置层的上界从 100 改成 1 → 第一条红。
 */
import { describe, expect, it } from "vite-plus/test";
import { readSource } from "@/test/readSource";
import { stripComments } from "@/test/stripComments";

describe("音量 · 0-100 与 0-1 之间的那道换算", () => {
  it("设置层存的是 0-100", () => {
    const src = stripComments(readSource("src/stores/settings.ts"));
    const line = /musicVol\.value\s*=\s*Math\.min\((\d+)/.exec(src);
    expect(line, "找不到 musicVol 的上界约束").not.toBeNull();
    expect(Number(line![1]), "设置层的音量上界不是 100").toBe(100);
  });

  it("交给音频层之前除过 100", () => {
    const src = stripComments(readSource("src/App.vue"));
    /*
     * 判那件事:`configureAudio(...)` 的实参里，musicVol / sfxVol 都带 `/ 100`。
     */
    const call = /configureAudio\(\{([^}]*)\}/.exec(src);
    expect(call, "找不到 configureAudio 调用").not.toBeNull();
    const args = call![1]!;
    expect(
      /musicVol:\s*[\w.]+\s*\/\s*100/.test(args),
      "musicVol 没有除以 100 —— 默认值 50 会被当成 45 倍线性增益。Tone 的 Gain " +
        "默认单位是线性振幅，不是 0-100 的刻度",
    ).toBe(true);
    expect(/sfxVol:\s*[\w.]+\s*\/\s*100/.test(args), "sfxVol 没有除以 100").toBe(true);
  });

  it("音频层再把进来的值夹在 0-1（第二道保险）", () => {
    const src = stripComments(readSource("src/core/audio.ts"));
    /*
     * 防空转的第二层:就算 App.vue 那一层对了，别的调用方也可能绕过它。
     * 故 `configureAudio` 自己也要夹。
     */
    expect(
      src,
      "configureAudio 没有把音量夹在 0-1 —— 绕过 App.vue 的调用方会把增益放大几十倍",
    ).toMatch(/prefs\.musicVol\s*=\s*Math\.max\(0,\s*Math\.min\(1,/);
  });
});
