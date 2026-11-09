import { describe, expect, it } from "vite-plus/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { checkRelease, type ReleaseFacts } from "./releaseCheck";

const BASE: ReleaseFacts = {
  version: "0.0.1",
  notesExists: true,
  dirty: false,
  tagExists: false,
  tagOnlyCommits: 0,
  staleNoteTags: [],
};

const facts = (patch: Partial<ReleaseFacts> = {}): ReleaseFacts => ({ ...BASE, ...patch });

describe("发版体检 · 三件本地能答的事", () => {
  it("全就绪时放行,并把要打的两条命令摆出来", () => {
    const v = checkRelease(facts());
    expect(v.ok).toBe(true);
    expect(v.blockers).toEqual([]);
    expect(v.next[0]).toBe("git tag v0.0.1");
    expect(v.next[1]).toBe("git push origin main v0.0.1");
  });

  it("缺发版正文就拦下 —— 流水线会退回自动清单", () => {
    const v = checkRelease(facts({ notesExists: false }));
    expect(v.ok).toBe(false);
    expect(v.blockers.join()).toContain("docs/release-notes/v0.0.1.md");
  });

  it("版本不是 x.y.z 就拦下(不打 0.0 或 0.0.1-beta 这种)", () => {
    for (const bad of ["0.0", "0.0.1-beta", "v0.0.1", ""]) {
      expect(checkRelease(facts({ version: bad })).ok, bad).toBe(false);
    }
  });

  it("工作区不干净、tag 已存在 —— 各自一条阻塞", () => {
    expect(checkRelease(facts({ dirty: true })).blockers.join()).toContain("工作区不干净");
    expect(checkRelease(facts({ tagExists: true })).blockers.join()).toContain("已经存在");
  });

  it("动过 tag-only 路径只提醒、不阻塞(本地跑不了,只能真跑)", () => {
    const v = checkRelease(facts({ tagOnlyCommits: 3 }));
    expect(v.ok).toBe(true);
    expect(v.warnings.join()).toContain("3 个提交");
    expect(v.warnings.join()).toContain("本地门全绿不代表发得出去");
  });

  it("正文里还引用着旧 tag 的图 —— 拦下(复制上一版正文最容易漏)", () => {
    const v = checkRelease(facts({ staleNoteTags: ["v0.0.1"] }));
    expect(v.ok).toBe(false);
    expect(v.blockers.join()).toContain("解析不到");
    expect(v.blockers.join()).toContain("碎图");
  });

  it("自证:三条阻塞可以同时出现,一次全报出来(不是只报第一条)", () => {
    const v = checkRelease(facts({ notesExists: false, dirty: true, tagExists: true }));
    expect(v.blockers.length).toBe(3);
  });
});

describe("只在 tag 流线上跑的路径清单", () => {
  it("package.json 必须在清单里 —— 打包配置全在它的 build 字段", () => {
    /*
     * 这份清单决定 `release:check` 提不提醒。漏一个路径的代价是
     * 「本地全绿、发不出去」—— v0.0.2 栽的正是 `package.json` 里的
     * `build.win.icon`(指着 48×48 的 favicon,electron-builder 要 ≥256)。
     *
     * 而清单本身此前**没有任何判据**:上面那几条只测 `tagOnlyCommits` 这个数
     * 怎么渲染成文案,把整个 `TAG_ONLY` 删空它们也照样绿。
     */
    const src = readFileSync(resolve(__dirname, "../../scripts/release-check.mjs"), "utf-8");
    const list = /const TAG_ONLY = \[([^\]]+)\]/.exec(src)?.[1] ?? "";
    for (const must of ["android", "electron", "package.json"]) {
      expect(list, `TAG_ONLY 里少了 ${must} —— 那条路径的改动不会被告警`).toContain(must);
    }
    expect(list, "工作流文件也得在清单里").toContain(".github/workflows/build.yml");
  });
});
