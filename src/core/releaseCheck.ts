/**
 * 发版前的本地体检 —— 把「只有 tag 上才会知道的事」尽量提前到本地。
 *
 * 本仓两次发版都栽在「本地永远绿、只有 CI 才执行到」的路径上(Android 签名口令被
 * Groovy 注释遮蔽、Electron 隐式发 Release)。这里的判据不重复校验流水线的 JSON,
 * 只回答三件本地能答的事:版本对不对得上 notes、工作区干不干净、这个 tag 是不是
 * 已经有了;再把「只在 tag 上跑的路径自上次发版以来改过几次」摆出来当提醒。
 */

export interface ReleaseFacts {
  /** package.json 里的版本(不带 v) */
  version: string;
  /** docs/release-notes/v<version>.md 是否存在 */
  notesExists: boolean;
  /** git status --porcelain 是否有输出 */
  dirty: boolean;
  /** git tag -l v<version> 是否已有 */
  tagExists: boolean;
  /** 自上次 tag 以来,只在 tag 流线上跑的路径的改动提交数 */
  tagOnlyCommits: number;
}

export interface ReleaseVerdict {
  ok: boolean;
  /** 阻塞项:有则不许打 tag */
  blockers: string[];
  /** 提醒项:不阻塞,但要在 tag 之后用真跑一次确认 */
  warnings: string[];
  /** 通过后该执行的命令 */
  next: string[];
}

const SEMVER = /^\d+\.\d+\.\d+$/;

export function checkRelease(f: ReleaseFacts): ReleaseVerdict {
  const blockers: string[] = [];
  const warnings: string[] = [];

  if (!SEMVER.test(f.version)) {
    blockers.push(`package.json 的版本「${f.version}」不是 x.y.z —— 打不出规范的 tag`);
  }
  if (!f.notesExists) {
    blockers.push(
      `缺 docs/release-notes/v${f.version}.md —— 流水线会退回自动提交清单,而本仓的约定是正文写在仓库里`,
    );
  }
  if (f.dirty) {
    blockers.push("工作区不干净 —— tag 会指向一个和仓库内容对不上的提交");
  }
  if (f.tagExists) {
    blockers.push(`tag v${f.version} 已经存在 —— 要重发得先换版本号,不要复用同名 tag`);
  }
  if (f.tagOnlyCommits > 0) {
    warnings.push(
      `自上次发版以来有 ${f.tagOnlyCommits} 个提交动过只在 tag 流线上跑的路径` +
        "(android / electron / .github/workflows/build.yml)—— 本地门全绿不代表发得出去,打完 tag 要看真跑结果",
    );
  }

  const tag = `v${f.version}`;
  return {
    ok: blockers.length === 0,
    blockers,
    warnings,
    next: [
      `git tag ${tag}`,
      `git push origin main ${tag}`,
      "然后盯住 tag 流水线:Android 签名 / Electron 打包 / Release 正文三项都是本地看不到的",
    ],
  };
}
