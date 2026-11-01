import { BUILDINGS } from "@/data/buildings";
import type { BuildingDef, BuildingId } from "@/types";

export interface DongfuBuildingChapter {
  key: string;
  index: string;
  title: string;
  hint: string;
  ids: BuildingId[];
  defs: BuildingDef[];
}

const CHAPTER_SPECS = [
  {
    key: "foundation",
    index: "壹",
    title: "基业",
    hint: "洞府为诸作之枢",
    ids: ["mansion"],
  },
  {
    key: "cultivation",
    index: "贰",
    title: "修行",
    hint: "聚气与藏经",
    ids: ["array", "library"],
  },
  {
    key: "craft",
    index: "叁",
    title: "丹器",
    hint: "一炉一台",
    ids: ["alchemy", "forge"],
  },
  {
    key: "livelihood",
    index: "肆",
    title: "生计",
    hint: "田畴与灵兽",
    ids: ["field", "beast"],
  },
] satisfies Array<Omit<DongfuBuildingChapter, "defs">>;

/**
 * 七作续账的章序。
 *
 * 分组只决定阅读顺序，不另造等级或可达性事实；每行仍由 buildingService 与
 * dongfu store 给值。这里只把同一份建筑表装配成四章，防止模板与测试各抄一份顺序。
 */
export function dongfuBuildingChapters(): DongfuBuildingChapter[] {
  return CHAPTER_SPECS.map((chapter) => ({
    ...chapter,
    ids: [...chapter.ids],
    defs: chapter.ids
      .map((id) => BUILDINGS.find((def) => def.id === id))
      .filter((def): def is BuildingDef => Boolean(def)),
  }));
}
