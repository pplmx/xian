<script setup lang="ts">
/**
 * 终局屏 —— 首页那格「今日一步 / 当前道途」在到顶之后换成的样子。
 *
 * ## 它替掉的是什么
 *
 * 那一格原来的两个分支都在回答「接下来往哪走」:「今日一步」是系统递来的第一个动作,
 * 「当前道途」是 `generateCurrentGoal` 算出的当前目标。而走到大道尽头的玩家,
 * 两者都没有了 —— 目标函数在到顶时会跳过突破那一支(见 `core/goal`),
 * 于是首页落进兜底的「静」:「眼下没有系统递来的下一步」。
 *
 * 一屏「没有下一步」,是把**一个阶段**当成了**没有内容**。终局该说的是:
 * 这一世走完了、你成了什么、接下来还能去哪。
 *
 * ## 为什么不自成一张大卡
 *
 * 首页那一格本来就是「一块纸 + 一道左侧朱砂短笔」的形制(见 `.home-deck__next`)。
 * 终局屏沿用同一块形制,不另起一张更大的卡:到了终点这件事不该靠"更大的框"来说,
 * 而该靠它写的内容。
 */
import { computed } from "vue";
import { useRouter } from "vue-router";
import { usePlayerStore } from "@/stores/player";
import { useEndgameStore } from "@/stores/endgame";
import { useCultivationStore } from "@/stores/cultivation";
import { apexRecord } from "@/core/apex";
import { daoPathDef } from "@/data/endgame";

const player = usePlayerStore();
const endgame = useEndgameStore();
const cultivation = useCultivationStore();
const router = useRouter();

const record = computed(() =>
  apexRecord({
    major: player.major,
    sub: player.sub,
    life: player.reincarnation.count + 1,
    marks: endgame.marks.length,
    milestonesDone: endgame.milestones.length,
  }),
);

/**
 * 这一世的「成了什么」—— 已择道途优先,未择则直说还没定。
 *
 * 道途报的是**道名**不是内部 id:`endgame.daoPath` 存的是 `"sword"` 这类键,
 * 直接插进文案会漏出 `此世行「sword」`(实测踩过一次)。道名走 `daoPathDef`,
 * 与天界那一册同源。
 */
const became = computed(() => {
  if (endgame.daoPath) {
    const name = daoPathDef(endgame.daoPath)?.name ?? endgame.daoPath;
    return { text: `此世行「${name}」`, done: true };
  }
  return { text: "此世尚未立道途", done: false };
});

/**
 * 修为圆满之后,还能报一件别处没有的事:**这一世攒下的功法**。
 *
 * 到顶的玩家最常回看的就是「我一共练成了什么」,而这一页此前只报修为。
 * 数量取 cultivation store,与功法页同源。
 */
const gongfaCount = computed(() => Object.keys(cultivation.learned).length);

function go(route: string): void {
  void router.push(route);
}
</script>

<template>
  <div class="home-deck__next home-deck__next--apex" data-home-apex>
    <span class="home-deck__next-tag">此生已尽</span>
    <span class="home-deck__next-body">
      <span class="home-deck__next-title">{{ record.realmLabel }}</span>
      <span class="home-deck__next-copy">
        {{ became.text }} · 第 {{ record.life }} 世 · {{ gongfaCount }} 部功法 ·
        {{ record.marks }} 则道痕
      </span>
    </span>
    <!--
      去处直接摆在这一格里 —— 终局玩家最需要的不是一句判词,是「我还能去哪」。
      转世与三生录并列,不抢中心(与修行页的终局印记同一口径)。
    -->
    <span class="home-deck__apex-actions">
      <button type="button" class="home-deck__apex-go tap-row" @click="go('/cultivation')">
        修行页 → 还能做的事
      </button>
      <button type="button" class="home-deck__apex-go tap-row" @click="go('/legacy')">
        三生录 · 这一世 →
      </button>
    </span>
  </div>
</template>
