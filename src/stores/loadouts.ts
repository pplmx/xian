/** 构筑快照 —— 保存/切换整套 Build(功法+法宝+装备) */
import { defineStore } from "pinia";
import { ref } from "vue";
import type { Loadout } from "@/types";
import { persistConfig } from "@/utils/storage";
import { asArray } from "@/utils/saveShape";

export const MAX_LOADOUTS = 6;

export const useLoadoutsStore = defineStore(
  "loadouts",
  () => {
    const list = ref<Loadout[]>([]);

    /** 存档修复:配装列表被写坏时,配装页会在渲染期抛错 */
    function sanitize(): void {
      list.value = asArray<Loadout>(list.value).filter(
        (l) => l !== null && typeof l === "object" && typeof l.id === "string",
      );
    }

    function add(loadout: Loadout): boolean {
      if (list.value.length >= MAX_LOADOUTS) return false;
      list.value = [...list.value, loadout];
      return true;
    }

    function remove(id: string): void {
      list.value = list.value.filter((l) => l.id !== id);
    }

    return { list, add, remove, sanitize };
  },
  { persist: persistConfig("loadouts") },
);
