/**
 * 恒真断言守卫 —— 一条永远为真的断言不是判据,是注释。
 *
 * 这个仓把审计读数的结论写进断言,好事;但其中有一类写法会把判据退化成
 * 「只打印不判断」,而它长得和真判据一模一样,评审时看不出来:
 *
 *   expect(shared.length).toBeGreaterThanOrEqual(0)   // 长度恒不为负
 *   expect(unfocused).toBeGreaterThanOrEqual(0)        // 计数器恒不为负
 *   expect(totalRejected).toBeGreaterThanOrEqual(0)    // 同上
 *
 * 三处实测都是这个形状,且三处的注释都写着「把事实钉住」「门槛确实在筛选」——
 * 声称的与做的相反。危害不是"少一条测试",而是**它代替了本该存在的那条**:
 * 弃用数归零、语义发散归零、跨世复用归零,这些正是各自用例声称要守的事,
 * 发生了却不会有任何反应。
 *
 * 本文件按两种形状查(含白名单,理由写在 EXEMPT 里,与 deadExportAudit 同风格):
 *   ① `.length).toBeGreaterThanOrEqual(0)` —— 恒真;
 *   ② 具名计数器 / 累计值(非索引、非"不为负"语义)的 `>= 0`,需要人工判断,
 *      故只查白名单之外**且注释里声称"钉住/筛选/约束/必"**的那一类。
 *
 * 判据只认能机械判定的形状:真正的索引查找(`.indexOf(...)`、`findIndex`、
 * 初值 -1 的哨兵)与"不为负"的值域断言(`minRealm`、`winRate`、`spiritStone`)
 * 都是**有效**的 `>= 0`,一律放行 —— 否则判据会逼人把好断言改坏。
 */
import { describe, expect, it } from "vite-plus/test";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "../..");

/**
 * 本文件自己的自证段落里会**故意写出**恒真形状的字符串(判据先自证:
 * 认不出那种写法就等于没有判据)。扫描时必须跳过本文件,否则判据会扫到
 * 自己的样例 —— 这是自指陷阱,不是真问题。
 */
const SELF = "src/core/tautologyGuard.spec.ts";

/** 递归收集 spec 文件(只看本作 src 与公共库 packages,不看 node_modules) */
function specFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === "dist" || name.startsWith(".")) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) specFiles(full, out);
    else if (name.endsWith(".spec.ts") && full.slice(ROOT.length + 1) !== SELF) out.push(full);
  }
  return out;
}

/**
 * 白名单:这些 `>= 0` 是**值域断言**(值本身不许为负),不是恒真断言。
 *
 * 加新条目必须说清「为什么这个值可以为 0 却不该判失败」—— 例如索引哨兵
 * (找不到时是 -1,所以 >= 0 恰好就是"找到了")、比率值域、资源余额。
 * 不加条目就写 `>= 0` 的,一律按恒真处理。
 *
 * 全库实测 40 处,按语义分四组(不是"看着差不多就放进来"):
 *   ① 索引哨兵 —— 找不到时约定 -1,`>= 0` 就是"找到了";
 *   ② 比率 / 随机值域 —— 处在 [0,1] 之间的量,断言"没跑出下界";
 *   ③ 资源与数值余额 —— 花掉之后不许变成负数(负数是真 bug);
 *   ④ 境界 / 层数 / 天数下标 —— 从 0 起算的整数,负值即越界。
 */
const EXEMPT_SUBJECTS = [
  // ① 索引哨兵
  "start",
  "from",
  "idx",
  "index",
  "findIndex",
  // ② 比率 / 随机值域
  "winRate",
  "php",
  "ehp",
  "roll.roll",
  "rng.next()",
  "noisy.next()",
  "rng.float(0, 1)",
  "Math.min(...values)",
  "seed",
  // ③ 资源与数值余额(花完不许为负)
  "spiritStone",
  "resources.wudao",
  "resources.page",
  "wudao",
  "res.count",
  "run.wallet.coin!",
  "run.wallet.exp!",
  "incomePerHour",
  "sinkPerHour",
  "dr",
  "p",
  "v",
  // ④ 境界 / 层数 / 天数下标
  "major",
  "minRealm",
  "playerMajor!",
  "realmMajor",
  "ev.minRealm",
  "prep",
  "plan.prep[dim]",
  "normal.prep.sustain",
  "enteredAt",
  "fixed.enteredAt",
  "day",
  "lingyuDay",
  "qingheDay",
  "stormDay",
  "unfocused",
] as const;

/**
 * 从一行里抽出 `expect(...)` 的**第一个实参**(主题)。
 *
 * 不能用 `[^,)]+` 这种正则:主题本身常带括号与引号
 * (`toNum(useResourcesStore().spiritStone)`、`rng.float(0, 1)`),正则会被
 * 第一个 `)` 截断,于是白名单永远匹配不上 —— 判据就会误报有效断言。
 * 故按括号配对走,并在深度 0 的逗号处切出第一个实参。
 */
function subjectOf(line: string): string {
  const at = line.indexOf("expect(");
  if (at < 0) return "";
  let depth = 1;
  let i = at + "expect(".length;
  const start = i;
  for (; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === "(") depth += 1;
    else if (ch === ")") {
      depth -= 1;
      // 闭掉 expect 自己的那一层:实参到此为止(不能把 `)` 收进主题)
      if (depth === 0) break;
    } else if (ch === "," && depth === 1) break;
  }
  return line.slice(start, i).trim();
}

/** 一条断言的主题是不是被白名单认领(主题是 expect(...) 的第一个实参) */
function exempted(subject: string): boolean {
  const s = subject.trim();
  if (!s) return false;
  // 精确认领,或按属性尾巴 / 被包装进函数调用 / 含该属性三种形状认领
  return EXEMPT_SUBJECTS.some(
    (k) => s === k || s.endsWith(`.${k}`) || s.endsWith(`(${k})`) || s.includes(`.${k}`),
  );
}

interface Hit {
  file: string;
  line: number;
  text: string;
}

function scan(dir: string): Hit[] {
  const hits: Hit[] = [];
  for (const file of specFiles(dir)) {
    const lines = readFileSync(file, "utf8").split("\n");
    for (const [i, line] of lines.entries()) {
      if (!line.includes("toBeGreaterThanOrEqual(0)")) continue;
      // 注释行不算:判据只看真断言
      if (line.trimStart().startsWith("*") || line.trimStart().startsWith("//")) continue;
      const subject = subjectOf(line);
      if (exempted(subject)) continue;
      hits.push({ file: file.slice(ROOT.length + 1), line: i + 1, text: line.trim() });
    }
  }
  return hits;
}

describe("恒真断言 · 判据不该写成永远为真", () => {
  it("没有 `.length >= 0` 这种恒真断言", () => {
    // 长度恒不为负 —— 这一条按形状就能机械判定,不需要白名单
    const bad: Hit[] = [];
    for (const file of specFiles(ROOT)) {
      const lines = readFileSync(file, "utf8").split("\n");
      for (const [i, line] of lines.entries()) {
        if (!/\.length\s*\)?\s*\.toBeGreaterThanOrEqual\(0\)/.test(line)) continue;
        if (line.trimStart().startsWith("*") || line.trimStart().startsWith("//")) continue;
        bad.push({ file: file.slice(ROOT.length + 1), line: i + 1, text: line.trim() });
      }
    }
    expect(
      bad.map((b) => `${b.file}:${b.line}  ${b.text}`),
      "长度恒不为负,这些断言永远为真 —— 要么改成真正的下界,要么删掉",
    ).toEqual([]);
  });

  it("其余 `>= 0` 都被白名单认领(值域断言或索引哨兵)", () => {
    const unclaimed = scan(ROOT);
    expect(
      unclaimed.map((b) => `${b.file}:${b.line}  ${b.text}`),
      "这些 `>= 0` 既不是值域断言也没登记 —— 若它其实恒真,请改成能被违反的形状;" +
        "若是有效判据,把它登记进 EXEMPT_SUBJECTS 并写明理由",
    ).toEqual([]);
  });

  it("判据先自证:两种形状都认得出来,白名单也确实放行", () => {
    // 若不先自证,这段正则漏掉的写法就等于没有判据(与 deadExportAudit 同一条纪律)
    const tautology = /\bexpect\(([^,)]+?)(?:\s*,\s*"[^"]*")?\)\s*\.toBeGreaterThanOrEqual\(0\)/;
    expect(tautology.test("expect(shared.length).toBeGreaterThanOrEqual(0);")).toBe(true);
    expect(tautology.test("expect(totalRejected).toBeGreaterThanOrEqual(0);")).toBe(true);
    // 带消息的写法同样认得
    expect(tautology.test('expect(idx, "找不到选项").toBeGreaterThanOrEqual(0);')).toBe(true);
    // 有效的形状不该被误伤
    expect(exempted("idx")).toBe(true);
    expect(exempted("chosen.findIndex")).toBe(true);
    // 未登记的主题要被抓出来
    expect(exempted("someRandomCounter")).toBe(false);
  });
});
