/**
 * 藏珍谱检索 —— 九柜一千余条目,得能按名字找
 *
 * ## 缺口:九册只能一册一册翻
 *
 * `ui/codex.collectionCodex()` 把图鉴装配成九柜(装备 / 功法 / 悟道 / 丹药 / 材料 /
 * 法宝 / 灵兽 / 际遇 / 天赋),条目总量在千条以上。玩家要找「某件东西在哪一册」时,
 * 现在只有一条路:逐册翻。这不是「再加个搜索框」的装饰需求 ——
 * 它是**这个体量下的必需**:一册 191 则际遇、53 类装备、70 门功法,翻到第三册
 * 就忘了第一册有没有。
 *
 * ## 只搜**已识**的条目,不搜「???」
 *
 * 图鉴的核心设计是「未识的只留一枚 `???`」。若检索能搜到未识条目的名字,
 * 那等于把「还没见过什么」提前告诉玩家 —— 泄漏的不只是名字,是整个收集目标。
 * 故检索只在 `stage >= 1` 的范围里做,与页面上能看见的那部分**同源**。
 *
 * ## 结果按柜分组,不拍成一张混列表
 *
 * 藏珍谱的版式是**九柜并列**,每一柜有自己的章首与计数。检索若把结果拍成一张
 * 混列表,玩家就失去了「这是哪一册」这个上下文,也就没法回到那一册继续看。
 * 故结果按柜分组,每组带该柜的名字与该柜命中数。
 *
 * ## 纯函数
 *
 * 检索只做字符串匹配与分组,不读 store —— 输入是已经装配好的 `CodexCat[]`。
 */
import type { CodexCat } from "./codex";

/** 检索输入:装配好的九柜(只需 key / name / entries) */
export type CodexSearchInput = Pick<CodexCat, "key" | "name" | "entries">;

/** 某一柜的命中 */
export interface CodexSearchHit {
  /** 柜 key(与图鉴的分册 key 同一份) */
  key: string;
  /** 柜名(取自 `CodexCat.name`),界面直接印 */
  title: string;
  /** 该柜命中的条目,保持图鉴原序 */
  entries: CodexCat["entries"];
  /** 命中条数 —— 界面据此写「本柜命中 N 条」,不必自己再数一遍 */
  count: number;
}

/**
 * 归一化:去首尾空白、转小写、全角转半角。
 *
 * 中文输入法下打出来的全角英文与数字很常见(把 Sword 打成全角那几个字形),若不归一,
 * 玩家会以为「明明有这个名字却搜不到」。
 */
function normalize(text: string): string {
  return text
    .replace(/[\uFF01-\uFF5E]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0))
    .replace(/\u3000/g, " ")
    .trim()
    .toLowerCase();
}

/**
 * 在九柜里按关键词找已识条目。
 *
 * 空查询返回空数组 —— **不当成「全列一遍」**:那会让清空输入框时整个图鉴突然
 * 重排成一张全量清单,而玩家只是想撤掉筛选。
 *
 * 没有命中的柜整柜不出(不印一行空白标题)。
 */
export function searchCodex(cats: readonly CodexSearchInput[], query: string): CodexSearchHit[] {
  const needle = normalize(query);
  if (!needle) return [];
  const hits: CodexSearchHit[] = [];
  for (const cat of cats) {
    const matched = cat.entries.filter((entry) => {
      // 未识条目一律不参与 —— 见文件头「只搜已识」
      if (entry.stage < 1) return false;
      if (normalize(entry.name).includes(needle)) return true;
      const desc = typeof entry.desc === "string" ? entry.desc : "";
      return normalize(desc).includes(needle);
    });
    if (matched.length === 0) continue;
    hits.push({ key: cat.key, title: cat.name, entries: matched, count: matched.length });
  }
  return hits;
}
