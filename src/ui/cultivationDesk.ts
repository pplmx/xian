export type CultivationChapterKey = "practice" | "next" | "support" | "gongfa";

export interface CultivationChapter {
  key: CultivationChapterKey;
  index: string;
  title: string;
  hint: string;
}

const CHAPTER_SPECS = [
  {
    key: "practice",
    index: "壹",
    title: "修 行",
    hint: "此刻功课 · 周天行功",
  },
  {
    key: "next",
    index: "贰",
    title: "下一步",
    hint: "关口看把握,闭关看当下",
  },
  {
    key: "support",
    index: "叁",
    title: "随身",
    hint: "状态与丹药,随手可动",
  },
  {
    key: "gongfa",
    index: "肆",
    title: "功法",
    hint: "主辅秘三册,沿同一账续读",
  },
] satisfies CultivationChapter[];

/**
 * 行功续卷的章序。
 *
 * 这里只装配阅读顺序与章名,不复制修为、行动或功法事实;每章的数值仍由
 * CultivationView、突破/闭关与 GongfaSection 直读原来的结算 function。
 */
export function cultivationChapters(): CultivationChapter[] {
  return CHAPTER_SPECS.map((chapter) => ({ ...chapter }));
}

export function cultivationChapter(key: CultivationChapterKey): CultivationChapter {
  const chapter = cultivationChapters().find((candidate) => candidate.key === key);
  if (!chapter) throw new Error(`unknown cultivation chapter: ${key}`);
  return chapter;
}
