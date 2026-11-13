<script setup lang="ts">
/**
 * 终局印记 —— 「已至大道尽头」这一刻的正式收口。
 *
 * ## 它替代了什么
 *
 * 到顶之后,修行页原先仍是**一整套为突破准备的版式**:破境卡占着视觉中心
 * (只是把「下一境」改口成了「大道已尽」),闭关与观象列在它下面,再往下才轮到
 * 别的。玩家把一世修到终点,看到的却还是一张「准备破境」的表 —— 没有一处是
 * 为「走到这里」这件事准备的。
 *
 * `atMaxRealm` 在改口之前甚至没人引用:终局只是一堆「没有了」,不是一个阶段。
 *
 * ## 这一块报什么
 *
 * 四笔,全部来自 `core/apex`(它自己不另算):
 *   · **走到哪里** —— 末境圆满,第几世,跨了几个界;
 *   · **留下什么** —— 道痕几则、里程碑几枚,画像成没成形;
 *   · **还能去哪** —— 到此刻仍然开着的去处,待办在前;
 *   · **这一世的去处** —— 兵解转世,与天界/器魂并列,不抢中心。
 *
 * ## 为什么不做成一张「胜利卡」
 *
 * 本作的基调是「一世一笔」,不是通关。故这一块不铺底、不套框、不用第二枚强色:
 * 只在账线上把读数摊开(与器性、行迹、共鸣缺口同一套排法),让「到了」这件事
 * 由内容说,不由装饰说。
 */
import { computed } from "vue";
import { useRouter } from "vue-router";
import { usePlayerStore } from "@/stores/player";
import { useEndgameStore } from "@/stores/endgame";
import { MANUAL_REBIRTH_MIN_MAJOR } from "@/core/reincarnation";
import { TRIAL_TOTAL, apexPursuits, apexRecord } from "@/core/apex";
import { apexFurnaceEta } from "@/core/apexCultivation";
import { toNum } from "@/utils/gnum";
import { formatGN } from "@/utils/format";
import { MAX_MAJOR, WORLDS, realmDef } from "@/data/realms";

const player = usePlayerStore();
const endgame = useEndgameStore();
const router = useRouter();

/** 这一世的终点读数 —— 排序与取景都在 core/apex,这里只喂它该有的输入 */
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
 * 还差多久炼出下一枚道源 —— 与卷首那一格同源(`core/apexCultivation`)。
 *
 * 「余修尽数入炉」这一笔必须摆在终局印记里:它是到顶之后**唯一仍在产出的
 * 那条线**,而玩家原先在修行页找不到它 —— 修速在跳,没有任何一处说它去了哪。
 */
const furnaceEta = computed(() => apexFurnaceEta(player.cultPerSec, toNum(player.expReq)));

const pursuits = computed(() =>
  apexPursuits({
    daoChosen: endgame.daoPath,
    // TrialRecord 只记 clears / bestRounds —— 通没过看 clears,不另设一个布尔
    clearedTrials: Object.values(endgame.trialRecords ?? {}).filter((r) => (r?.clears ?? 0) > 0)
      .length,
    trialTotal: TRIAL_TOTAL,
    soulsEquipped: endgame.equippedSouls?.length ?? 0,
    marks: endgame.marks.length,
    canRebirth: player.major >= MANUAL_REBIRTH_MIN_MAJOR,
  }),
);

/**
 * 这一世跨过几个界 —— 报**界名**,不只报个数(说「四界」读者还要自己数)。
 *
 * 取的是 `WORLDS` 里的展示名,不是 `realmDef().world` 那个内部 id ——
 * 后者会当场漏出 `mortal · immortal · god · chaos`(实测踩过一次)。
 */
const crossedWorlds = computed(() => {
  const ids: string[] = [];
  for (let m = 0; m <= player.major; m += 1) {
    const id = realmDef(Math.min(MAX_MAJOR, m)).world;
    if (!ids.includes(id)) ids.push(id);
  }
  return ids.map((id) => WORLDS.find((w) => w.id === id)?.name ?? id);
});

function go(route: string): void {
  void router.push(route);
}
</script>

<template>
  <section class="cultivation-apex" data-cultivation-apex-mark>
    <header class="cultivation-apex__head">
      <span class="cultivation-apex__seal" aria-hidden="true">{{
        realmDef(MAX_MAJOR).name.slice(0, 1)
      }}</span>
      <div class="cultivation-apex__title">
        <p class="cultivation-apex__eyebrow">本境 · 已至尽头</p>
        <p class="cultivation-apex__name">{{ record.realmLabel }}</p>
      </div>
      <p class="cultivation-apex__verdict">大道已尽,再无可破之境</p>
    </header>

    <!--
      四笔读数 —— 走的是与「器性 / 行迹 / 共鸣缺口」同一套「左题签 + 右账目」。
      不另立卡片,是因为这一页本来就该是一册连续长账;到此为止也还是。
    -->
    <dl class="cultivation-apex__ledger" data-cultivation-apex-ledger>
      <dt>此世</dt>
      <dd>
        <span class="cultivation-apex__value tabular">第 {{ record.life }} 世</span>
        <span class="cultivation-apex__aside">跨 {{ crossedWorlds.length }} 界</span>
        <span class="cultivation-apex__aside">{{ crossedWorlds.join(" · ") }}</span>
      </dd>
      <dt>道痕</dt>
      <dd>
        <span class="cultivation-apex__value tabular">{{ record.marks }} 则</span>
        <span class="cultivation-apex__aside">
          {{ record.profileFormed ? "修行画像已成形" : "道痕尚浅,画像未成形" }}
        </span>
      </dd>
      <dt>熔真</dt>
      <dd>
        <span class="cultivation-apex__value">余修尽数入炉</span>
        <span class="cultivation-apex__aside tabular"
          >约 {{ furnaceEta }} 得 1 道源 · 现持 {{ formatGN(endgame.daoSource) }}</span
        >
      </dd>
      <dt>碑记</dt>
      <dd>
        <span class="cultivation-apex__value tabular"
          >{{ record.milestones.done }}/{{ record.milestones.total }} 枚</span
        >
        <span class="cultivation-apex__aside">跨世不灭的「首次」,在人物页回看</span>
      </dd>
    </dl>

    <!--
      「还能去哪」—— 到顶之后真正还在开着的去处。

      这一块是这一页此前完全缺的:玩家把一世修到终点,反而不知道该做什么了,
      而天界四册、器魂、三生录其实全开着。待办在前(见 core/apex 的排序),
      已做完的沉在后面 —— 它们仍可回看,但不再是待办。
    -->
    <div class="cultivation-apex__pursuits" data-cultivation-apex-pursuits>
      <p class="cultivation-apex__caption">此世尚可做的事</p>
      <button
        v-for="p in pursuits"
        :key="p.id"
        type="button"
        class="cultivation-apex__pursuit tap-row"
        :class="p.pending ? '' : 'is-settled'"
        :data-cultivation-apex-pursuit="p.id"
        :data-pending="p.pending ? 'true' : 'false'"
        @click="go(p.route)"
      >
        <span class="cultivation-apex__pursuit-name">
          {{ p.name }}
          <span v-if="p.progress" class="cultivation-apex__pursuit-progress tabular"
            >· {{ p.progress }}</span
          >
        </span>
        <span class="cultivation-apex__pursuit-hint">{{ p.hint }}</span>
        <span class="cultivation-apex__pursuit-go" aria-hidden="true">›</span>
      </button>
    </div>
  </section>
</template>
