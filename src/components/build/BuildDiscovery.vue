<template>
  <section
    data-build-discovery
    class="build-discovery stagger-in"
    :data-build-path-count="rows.length"
  >
    <LedgerHeader
      seal="未"
      :eyebrow="`道途未成 · ${cnNumber(rows.length)}路并观`"
      title="脚下还没有一条走重"
      description="修行不先选职业。功法、法宝、装备与天赋留下的核心词条，会把你推向其中一路；先走出一条，再谈混合与克制。"
      :score-label="hasTrace ? '最近契合' : '尚无契合'"
      :score-value="formatPercent(hasTrace ? closest.affinity : 0, 0)"
    />

    <div class="build-discovery__ledger" data-build-ledger>
      <p>
        <span>眼下</span>
        <strong>{{ hasTrace ? "已有路数" : "尚无核心词条" }}</strong>
      </p>
      <p>
        <span>最接近</span>
        <strong>{{ hasTrace ? closest.style.name : `${cnNumber(rows.length)}路未起` }}</strong>
      </p>
      <p>
        <!--
          这一格报**雏形线**，不报契合度。
          契合度已经由账首的 score 报过（「最近契合 N%」），两者同源
          （都是 closest.affinity），同屏出现就是一句话说两遍 ——
          实测 layout-check 在 320×568 上抓到过 «6%» 重复。
          雏形线是恒定参考值，账首没有它，而它正好解释下一行「距雏形」怎么算出来的。
        -->
        <span>雏形线</span>
        <strong class="tabular">{{ formatPercent(STYLE_EMERGENCE_AFFINITY, 0) }}</strong>
      </p>
      <p>
        <span>{{ hasTrace ? "距雏形" : "下一步" }}</span>
        <strong :class="{ tabular: hasTrace }">{{
          hasTrace ? formatPercent(closestGap, 0) : "先取一枚"
        }}</strong>
      </p>
    </div>

    <p class="build-discovery__reading">
      <template v-if="hasTrace && closestGap > 0">
        最近的是「{{ closest.style.name }}」。再补
        <span>{{ closestGapText }}</span>
        ，核心词条平均跨过 {{ formatPercent(STYLE_EMERGENCE_AFFINITY, 0) }} 便会成路。
      </template>
      <!--
        已经跨过雏形线:说「成了」。这一支原先不存在 —— gap 归零时仍走上面那句，
        读出来是「再补最后一步，核心词条平均跨过 25% 便会成路」，而玩家已经跨过了。
      -->
      <template v-else-if="hasTrace">
        最近的是「{{ closest.style.name }}」，已经跨过
        {{ formatPercent(STYLE_EMERGENCE_AFFINITY, 0) }} 的雏形线 —— 这一路已立得住。
      </template>
      <template v-else>
        眼下{{
          cnNumber(rows.length)
        }}路都还没有核心词条。先从一个方向拿第一枚词条，不必同时追所有路。
      </template>
    </p>

    <div class="build-discovery__section-head">
      <p>{{ cnNumber(rows.length) }}路全谱</p>
      <p>按当前契合排序，近路在前</p>
    </div>

    <div class="build-discovery__paths">
      <article
        v-for="(row, index) in rows"
        :key="row.style.id"
        class="build-discovery__path"
        :class="{ 'is-leading': index === 0 }"
        :data-build-path="row.style.id"
      >
        <header class="build-discovery__path-head">
          <span class="build-discovery__path-seal" aria-hidden="true">{{ row.style.seal }}</span>
          <div class="build-discovery__path-identity">
            <h3>{{ row.style.name }}</h3>
            <p>{{ row.style.desc }}</p>
          </div>
          <p class="build-discovery__path-score">
            <strong class="tabular">{{ formatPercent(row.affinity, 0) }}</strong>
            <span>契合</span>
          </p>
        </header>

        <div class="build-discovery__path-progress">
          <p>
            <span>{{ rowGap(row) > 0 ? "距雏形" : "已达雏形线" }}</span>
            <span class="tabular">{{ rowGapText(row) }}</span>
          </p>
          <div
            role="progressbar"
            :aria-label="`${row.style.name}成路进度`"
            aria-valuemin="0"
            aria-valuemax="100"
            :aria-valuenow="rowProgress(row) * 100"
            :aria-valuetext="`契合${formatPercent(row.affinity, 0)}，${rowGapText(row)}`"
          >
            <ProgressBar :value="rowProgress(row)" :height="4" color="var(--color-qing)" />
          </div>
        </div>

        <ul class="build-discovery__terms" :aria-label="`${row.style.name}核心词条`">
          <li v-for="term in row.terms" :key="term.key">
            <span>{{ STAT_NAMES[term.key] }}</span>
            <span class="tabular">
              <strong>{{ formatPercent(term.value, 0) }}</strong>
              <span> / {{ formatPercent(term.reference, 0) }} 参考</span>
            </span>
          </li>
        </ul>

        <footer class="build-discovery__path-foot">
          <span v-if="row.activeTerms">
            {{ row.activeTerms }} / {{ row.terms.length }} 条核心词条已留下
          </span>
          <span v-else>尚无此路核心词条</span>
        </footer>
      </article>
    </div>

    <footer class="build-discovery__footer">
      <div>
        <p class="build-discovery__footer-label">识别线</p>
        <p>
          核心词条平均达到 {{ formatPercent(STYLE_EMERGENCE_AFFINITY, 0) }} 为雏形 ·
          {{ formatPercent(STYLE_MATURE_AFFINITY, 0) }} 成形 ·
          {{ formatPercent(STYLE_MASTER_AFFINITY, 0) }} 大成
        </p>
      </div>
      <div class="build-discovery__actions">
        <RouterLink to="/cultivation" class="btn-seal min-h-11">去修行配功法 →</RouterLink>
        <RouterLink to="/inventory" class="btn-ghost min-h-11">看行囊装备</RouterLink>
      </div>
    </footer>
  </section>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { BuildAffinityRow } from "@/core/buildDetect";
import {
  STYLE_EMERGENCE_AFFINITY,
  STYLE_MASTER_AFFINITY,
  STYLE_MATURE_AFFINITY,
} from "@/core/buildDetect";
import { STAT_NAMES } from "@/data/statNames";
import { cnNumber, formatPercent } from "@/utils/format";
import LedgerHeader from "@/components/common/LedgerHeader.vue";
import ProgressBar from "@/components/common/ProgressBar.vue";

const props = defineProps<{
  rows: BuildAffinityRow[];
}>();

const closest = computed(() => props.rows[0]!);
const hasTrace = computed(() => props.rows.some((row) => row.activeTerms > 0));
const closestGap = computed(() => Math.max(0, STYLE_EMERGENCE_AFFINITY - closest.value.affinity));
/**
 * 离雏形线还差多少。
 *
 * 只在**还没到线**时才需要这个读数 —— 到了线就不该再说「再补」。
 * 从前这里给 `gap === 0` 返回「最后一步」,而它在模板里是这样读的:
 *
 * ```text
 * 最近的是「某某流」。再补 最后一步，核心词条平均跨过 25% 便会成路。
 * ```
 *
 * 两处不通:「再补最后一步」读不通（补是补一个量）;更要紧的是那一整句的前提错了 ——
 * 那时已经跨过 25%，而这句话还在说「跨过便会成路」。
 * 与首页道途卡那个「进度 100% 还说继续寻找」是同一个形状。
 */
const closestGapText = computed(() => `${formatPercent(closestGap.value, 0)} 契合`);

function rowGap(row: BuildAffinityRow): number {
  return Math.max(0, STYLE_EMERGENCE_AFFINITY - row.affinity);
}

function rowGapText(row: BuildAffinityRow): string {
  const gap = rowGap(row);
  return gap > 0 ? `尚差 ${formatPercent(gap, 0)}` : "可被识别为雏形";
}

function rowProgress(row: BuildAffinityRow): number {
  if (STYLE_EMERGENCE_AFFINITY <= 0) return 1;
  return Math.min(1, Math.max(0, row.affinity / STYLE_EMERGENCE_AFFINITY));
}
</script>
