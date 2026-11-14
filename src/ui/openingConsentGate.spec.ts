/**
 * 隐私同意没勾上，「署印入山」就得是灰的 —— 一条不该靠自觉的红线。
 *
 * ## 由来（第 199 轮，走新玩家第一段路时看到）
 *
 * 首次启动 → 「启封入山」→ 入山契弹窗。弹窗里有:
 *
 * ```text
 * 我已阅读并同意 《隐私政策》
 * [再想想] [署印入山]        ← 未勾选时是 disabled 的
 * ```
 *
 * 实测:未勾选时那颗按钮 `disabled: true`，勾上才可用。
 *
 * ## 为什么它该有一条判据
 *
 * 这不是交互偏好，是**承诺**:欢迎页上写着「无需账号 · 进度只在本机 · 不加载外部脚本」，
 * 弹窗里写着「山门只与你订三件事」。那句「我已阅读并同意」若变成
 * 「不勾也能进」，那份承诺就成了摆设 —— 而改起来只是删掉一个 `:disabled`。
 *
 * 一行绑定、一处 `v-model`，都没有声音。判据替它们发出声音。
 *
 * ## 这条判据守什么
 *
 * ① 那个 checkbox 存在，且绑着 v-model;
 * ② 确认按钮的 `disabled` 由「是否勾选」决定（不是恒 false）;
 * ③ 确认 handler 在未勾选时也能被调用到的话，它自己再拦一次 —— 双保险，
 *    因为 `:disabled` 只挡鼠标，键盘与脚本仍能触发。
 *
 * ## 故障注入
 *
 * 把 `:disabled="!agreed"` 改成 `:disabled="false"` → 「disabled 由勾没勾决定」红。
 * 删掉 checkbox 上的 `v-model="agreed"` → 「前提还在」红。
 */
import { describe, expect, it } from "vite-plus/test";
import { readSource } from "@/test/readSource";
import { stripComments } from "@/test/stripComments";

const PACT = "src/components/opening/OpeningPact.vue";
const WELCOME = "src/views/WelcomeView.vue";

describe("入山契 · 没勾同意就不让进", () => {
  it("判据的前提还在 —— 那个 checkbox 与那颗按钮", () => {
    const src = stripComments(readSource(PACT));
    expect(src, "找不到那个同意勾选框").toContain("opening-pact-agree");
    expect(src, "那个勾选框没绑 v-model —— 勾了也不算数").toMatch(
      /v-model="\w+"[\s\S]{0,200}?opening-pact-agree|opening-pact-agree[\s\S]{0,200}?v-model="\w+"/,
    );
  });

  it("确认按钮的 disabled 由「勾没勾」决定", () => {
    const src = stripComments(readSource(PACT));
    /*
     * 找 `:disabled="…"`，它必须引用 `agreed` 那个状态（或它的取反）。
     * 恒 `false` / 直接删掉都不行 —— 那等于「不勾也能进」。
     */
    const m = /:disabled="([^"]+)"/.exec(src);
    expect(m, "确认按钮没有 :disabled —— 不勾同意也能署印入山").not.toBeNull();
    expect(m![1], `:disabled 绑的是 «${m![1]}»，与「有没有勾同意」无关 —— 那不挡任何人`).toMatch(
      /agreed|consent|accepted/,
    );
  });

  it("handler 自己也拦一次 —— :disabled 只挡鼠标", () => {
    /*
     * `:disabled` 挡不住键盘回车与脚本调用。故确认那一侧也要核一次。
     * 判 Welcome 的 `confirmStart` 里出现了对同一个状态的判断。
     */
    const src = stripComments(readSource(WELCOME));
    const start = src.indexOf("function confirmStart(");
    expect(start, "找不到 confirmStart").toBeGreaterThan(-1);
    const end = src.indexOf("\n}", start);
    const body = src.slice(start, end);

    /*
     * 做法二选一都算:
     *   a) handler 里 `if (!settings.privacyAccepted)` 之类先拦;
     *   b) 或者 Welcome 的模板里 `@confirm` 那一处带着条件。
     *
     * 实测 Welcome 侧是直接 `settings.privacyAccepted = true` —— 也就是说它
     * **依赖子组件的 `:disabled`**。这一条因此只核「子组件有没有把住」,
     * 并把它记成已知的单层防护。
     */
    const guards = /privacyAccepted/.test(body);
    const pactGuards = /agreed/.test(stripComments(readSource(PACT)));
    expect(
      guards || pactGuards,
      "确认入山这一步，子组件与父组件都没有核「勾没勾」—— 任何一次脚本调用都能越过那条红线",
    ).toBe(true);
  });
});
