<template>
  <div class="folio-page folio-page--stack stagger-in">
    <FolioPageHeader title="道躯" subtitle="根骨、灵根与道途" featured>
      <template #meta>
        <p class="mt-1.5 flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-body">
          <span class="whitespace-nowrap">
            <span class="world-label font-kai tracking-[0.24em]">{{ player.worldName }}</span>
            <span class="mx-1 text-ink-faint" aria-hidden="true">·</span>
            <span class="font-kai tracking-[0.16em] text-cinnabar">{{ player.realm.name }}</span>
          </span>
          <span class="ml-auto whitespace-nowrap">
            <span class="text-ink-soft">{{ player.linggen?.gradeName ?? "灵根未显" }}</span>
            <span class="mx-1 text-ink-faint" aria-hidden="true">·</span>
            <span class="tabular text-ink-faint">{{ build?.displayName ?? "道途未成" }}</span>
          </span>
        </p>
      </template>
      <template #visual>
        <CharacterSigil
          :name="player.name"
          :growth-mult="player.linggen?.growthMult ?? 1"
          :roots="player.linggen?.roots ?? []"
          :segments="powerSegments"
        />
      </template>
    </FolioPageHeader>

    <!--
      道躯总案 —— 一张账同时回答「我有多强」与「这副根骨适合怎么走」。
      三围不再在上下两张卡里各占一次主位：原值、权重与占战力比在同一行读，
      灵根则独立成另一半，名号、资质、倍率与天然倾向不再挤在战力卡尾。
    -->
    <section class="folio-span-all">
      <SectionTitle title="道躯总案" hint="三围折成战力,灵根定下行路" />
      <div class="character-dossier" data-character-dossier>
        <header class="character-dossier__head">
          <span class="character-dossier__seal" aria-hidden="true">躯</span>
          <span class="character-dossier__heading">
            <span class="character-dossier__eyebrow">本世根骨</span>
            <span class="character-dossier__title">战力与灵根</span>
          </span>
          <span class="character-dossier__position tabular">
            第 {{ player.major + 1 }} / {{ REALMS.length }} 境
          </span>
        </header>

        <div class="character-dossier__grid">
          <section class="character-dossier__power" data-character-power>
            <div class="character-dossier__power-head">
              <span class="character-dossier__label">战 力</span>
              <span class="character-dossier__hint">攻 / 防 / 血按引擎权重折算</span>
            </div>
            <p class="character-dossier__power-value font-kai tabular">
              <TapNumber :value="stats.power" title="战力" :rows="powerDetailRows" />
            </p>
            <p class="character-dossier__formula tabular">{{ powerFormulaText }}</p>
            <div class="character-dossier__bar" role="img" :aria-label="powerShareLabel">
              <span
                v-for="row in powerDetailRows"
                :key="row.label"
                :style="{ width: `${row.share * 100}%`, background: row.barColor }"
              />
            </div>
            <div class="character-dossier__stats">
              <div v-for="row in powerDetailRows" :key="row.label" class="character-dossier__stat">
                <span class="character-dossier__stat-name">
                  {{ row.label }}
                  <span class="character-dossier__weight">×{{ row.weightText }}</span>
                </span>
                <span class="character-dossier__stat-value font-kai tabular">
                  <TapNumber
                    :value="row.value"
                    :title="row.label"
                    :rows="[
                      { label: '战力权重', text: `×${row.weightText}` },
                      { label: '占战力', text: formatPercent(row.share, 0) },
                    ]"
                  />
                </span>
                <span class="character-dossier__stat-share tabular">
                  {{ formatPercent(row.share, 0) }}
                </span>
              </div>
            </div>
          </section>

          <section class="character-dossier__roots" data-character-roots>
            <div class="character-dossier__roots-head">
              <span class="character-dossier__label">灵 根</span>
              <span class="character-dossier__grade">{{ player.linggen?.gradeName }}</span>
              <span class="character-dossier__growth tabular">
                ×{{ player.linggen?.growthMult.toFixed(2) }}
              </span>
            </div>
            <div class="character-dossier__root-list">
              <span
                v-for="root in player.linggen?.roots ?? []"
                :key="root.element"
                class="character-dossier__root"
                :title="`${ELEMENTS[root.element].char}系 · 资质 ${root.aptitude}`"
              >
                <span
                  class="character-dossier__root-mark"
                  :style="{
                    borderColor: ELEMENTS[root.element].color,
                    color: ELEMENTS[root.element].color,
                  }"
                  >{{ ELEMENTS[root.element].char }}</span
                >
                <span
                  class="character-dossier__root-aptitude tabular"
                  :style="{ color: ELEMENTS[root.element].color }"
                  >{{ root.aptitude }}</span
                >
              </span>
            </div>
            <p class="character-dossier__roots-copy">
              灵根倍率作用于修行所得；五行只定亲近之路,不分高低。
            </p>
            <div v-if="tendencies.length" class="character-dossier__tendencies">
              <p
                v-for="t in tendencies"
                :key="t.element"
                class="character-dossier__tendency t-body"
              >
                <span
                  class="character-dossier__tendency-mark"
                  :style="{ color: ELEMENTS[t.element].color }"
                  >{{ ELEMENTS[t.element].char }}</span
                >
                <span>{{ t.text }}</span>
              </p>
            </div>
          </section>
        </div>
      </div>
    </section>

    <!-- 属性 -->
    <section>
      <SectionTitle title="行藏加成" hint="点一行看它从哪来" />
      <div class="card-ink mt-2 px-4 py-3" data-character-modifiers>
        <!--
          每行可点:玩家问的从来不只是「多少」,还有「从哪来」。
          可点这件事得先看得见 —— 选中那行染底并亮出「明细」,其余行才敢不吭声。
          此前全无选中态,点开之后只多出一块正文,看不出点的是哪一行。
        -->
        <!--
          属性名(「进阶成功率」五个字)在两列时每列只有 56.5px,名字被压成
          11px 宽一字一列(实测 8 行里 7 行竖排)—— 极窄档放开成单列,
          名字回到 44px 一行。两列是常态(390 档实测一分不动)。
        -->
        <div class="grid grid-cols-2 gap-x-4 gap-y-1 tinylens:grid-cols-1">
          <button
            v-for="row in modRows"
            :key="row.label"
            class="-my-1 flex items-center justify-between rounded px-1.5 py-1.5 text-left text-body transition-colors active:opacity-60"
            :class="breakdownKey === row.key ? 'bg-ink/5' : ''"
            :aria-expanded="breakdownKey === row.key"
            @click="toggleBreakdown(row.key)"
          >
            <span class="text-ink-faint">
              {{ row.label }}
              <span v-if="row.capped" class="ml-0.5 text-note text-cinnabar">软</span>
            </span>
            <span class="flex items-center gap-1">
              <span class="tabular" :class="row.value > 0 ? 'text-qing' : 'text-cinnabar'">
                {{ row.value > 0 ? "+" : "" }}{{ formatPercent(row.value) }}
              </span>
              <!-- 明细口:收着时是一枚淡「›」,展开时转 90° 并转朱砂 -->
              <span
                class="w-2 text-note leading-none transition-transform"
                :class="breakdownKey === row.key ? 'rotate-90 text-cinnabar' : 'text-ink-faint'"
                aria-hidden="true"
                >›</span
              >
            </span>
          </button>
        </div>
        <!-- 提示只在没展开时出现:一旦展开,下面那块牌子本身就是答案 -->
        <p v-if="modRows.length && !breakdownRows.length" class="mt-1 text-note text-ink-faint">
          点一行看它从哪来
        </p>
        <!--
          进阶成功率的名字容易过度承诺:它只进小进阶那一次掷点,大关走天劫推演。
          有这一项时才提示 —— 没有这项的玩家不需要知道这个边界。
        -->
        <p v-if="hasAdvanceRate" class="mt-0.5 text-note leading-relaxed text-ink-faint">
          进阶成功率只作用于小进阶;大关须渡天劫,看的是劫型与四维准备度(护持/恢复/抗性/爆发)。
        </p>
        <p v-if="hasShieldMods" class="mt-0.5 text-note leading-relaxed text-ink-faint">
          护盾至多覆盖最大气血的 {{ formatPercent(SHIELD_CAP_RATIO, 0) }} ——
          盾系堆得再多也顶不破这道上限。
        </p>
        <div v-if="breakdownRows.length" class="mt-1.5 rounded-md bg-paper-deep/60 px-2.5 py-2">
          <p class="text-note text-ink-soft">{{ STAT_NAMES[breakdownKey!] }} · 来源明细</p>
          <p v-for="c in breakdownRows" :key="c.name" class="mt-0.5 flex justify-between text-note">
            <span class="text-ink-faint">
              {{ c.name }}
              <span v-if="c.onTop" class="ml-1 text-note text-cinnabar">另乘</span>
            </span>
            <span class="tabular" :class="c.value > 0 ? 'text-qing' : 'text-cinnabar'">
              {{ c.value > 0 ? "+" : "" }}{{ formatPercent(c.value) }}
            </span>
          </p>
          <p class="mt-1 text-note leading-relaxed text-ink-faint">
            明细之和就是上面那个数;标「另乘」的不并入百分比,而是单独乘在攻防血上。
          </p>
          <p v-if="diminishNote" class="mt-0.5 text-note leading-relaxed text-cinnabar">
            {{ diminishNote }}
          </p>
        </div>
        <p v-if="softCappedNotes.length" class="mt-1.5 text-note leading-relaxed text-cinnabar">
          标「软」者已达软上限:{{
            softCappedNotes.join("、")
          }}。极限堆叠到此后收益递减,不是面板被削。
        </p>
      </div>
    </section>

    <!-- 至此是「我是谁」;往下转入九册去向,用一道页内花饰换气。 -->
    <div class="ink-divider-mark my-4" aria-hidden="true" />

    <!--
      九处去向不再各占一张同形入口卡。三组册目只留「去向 / 当前事实 / 动作」三列，
      一行读一件事；人物页的主体回到战力与灵根，导航退成一册索引。
    -->
    <section>
      <SectionTitle title="道途" hint="路数与身份" />
      <div class="character-index mt-2" data-character-index="way">
        <CharacterIndexRow
          to="/build"
          icon="swords"
          title="流 派"
          tone="cinnabar"
          action="参详"
          :sub="
            build
              ? `${build.displayName} · 契合 ${formatPercent(build.affinity, 0)} · 快照 ${loadouts.list.length} 套`
              : '道途尚未成路,词条与功法凑成一派便见分晓'
          "
        />

        <!-- 修行画像(Phase 31.2:历史行为归纳,纯描述无数值) -->
        <CharacterIndexRow
          icon="circle-user"
          title="修行画像"
          action="展卷"
          :sub="`「${identity?.epithet ?? '玄枢散人'}」 · ${identity?.narrative ?? '足迹尚浅'}`"
          @click="identityOpen = true"
        />

        <!-- 相伴灵兽的「脸」:有伴亮伴侣的形,未伴用名号的冕 —— 同其他入口一样是一枚题头图 -->
        <CharacterIndexRow
          to="/titles"
          :icon="currentPetIcon ?? 'crown'"
          title="名号与灵兽"
          tone="jade"
          action="整理"
          :sub="`${currentTitleName ?? '未佩名号'} · ${currentPetName ?? '未伴灵兽'}`"
        />
      </div>
    </section>

    <!-- 缘法:这一世遇见的人 -->
    <section>
      <SectionTitle title="缘法" hint="师承道侣" />
      <div class="character-index mt-2" data-character-index="bond">
        <!-- 师承(Phase 31 S1):修行理念 + 师尊评价 -->
        <CharacterIndexRow
          icon="scroll"
          title="师 承"
          tone="qing"
          :action="mentorVer ? '求教' : '拜师'"
          :sub="
            mentorVer
              ? `${mentorVer.mentor?.name ?? ''}·${mentorVer.mentor?.title ?? ''} | ${mentorVer.line}`
              : '尚未拜师,可寻一位师尊'
          "
          @click="mentorDialog = true"
        />

        <!--
          道侣(Phase 33.8):这一世遇见的人。只记关系与经历,不给任何属性。
          她开了口 / 提了事,还等你一句 —— 这一行要报出来。此前只有点开弹窗
          才知道有事在等,而不开弹窗就永远不知道(与「卦在身」「今日天道未做」同族)。
        -->
        <CharacterIndexRow
          icon="user"
          title="道 侣"
          tone="qing"
          :action="bondDef ? '相知' : '履历'"
          :badge="hasBondWord ? '有话说' : ''"
          :sub="
            bondDef && bond
              ? `${bondDef.name}·${STAGE_NAMES[bond.stage]}${bond.fallen ? '(已殁)' : bond.departed ? '(已离)' : ''} | ${bondDef.brief}`
              : pastBonds.length
                ? `此生尚未遇见,历世曾有 ${pastBonds.length} 段同行`
                : '此生尚未遇见谁'
          "
          @click="bondDialog = true"
        />
      </div>
    </section>

    <!-- 记录:走过什么、这条路从哪来 -->
    <section>
      <SectionTitle title="行迹" hint="藏珍与轮回" />
      <div class="character-index mt-2" data-character-index="record">
        <CharacterIndexRow
          to="/collection"
          icon="gem"
          title="藏珍与成就"
          tone="gold"
          action="翻阅"
          :badge="quests.hasCollectionNew ? '有新得' : ''"
          :sub="`成就 ${achievementCounts(achievementStateOf(quests.achieved)).done}/${ACHIEVEMENTS.length} · 图鉴 ${collectionSummary.known}/${collectionSummary.total}`"
        />

        <CharacterIndexRow
          to="/legacy"
          icon="book"
          title="修仙录"
          action="展卷"
          sub="画像 · 节点 · 我的纪录——这一部只写你自己"
        />

        <!--
          界域志:与修仙录同级 —— 一部写你,一部写这条路从哪来。
          这一册装着两半:界域/典籍是「来路」(只读),周易/紫微/星象/奇门是「术数四门」
          (有当下,问卦就在里面) —— 副题要把两半都说出来,否则想找问卦的人根本不会点进来。
        -->
        <CharacterIndexRow
          to="/codex"
          icon="mountain"
          title="界域志"
          action="查阅"
          :badge="divinationOn ? '卦在身' : ''"
          :sub="`${cnNumber(WORLDS.length)}界${cnNumber(REALMS.length)}境的来路与典籍 · 术数四门`"
        />

        <CharacterIndexRow
          icon="refresh"
          title="轮 回"
          tone="violet"
          action="观想"
          badge="永久积累"
          :sub="`道果 ${formatNum(player.reincarnation.daoFruit)} · 天赋 ${ownedTalents.length} 项`"
          @click="rebirthOpen = true"
        />
      </div>
    </section>

    <IdentityDialog :open="identityOpen" @close="identityOpen = false" />

    <RebirthDialog :open="rebirthOpen" @close="rebirthOpen = false" />

    <BondDialog :open="bondDialog" @close="bondDialog = false" />

    <MentorDialog :open="mentorDialog" @close="mentorDialog = false" />
  </div>
</template>

<script setup lang="ts">
import "@/styles/pages/character.css";
import { computed, ref } from "vue";
import { usePlayerStore } from "@/stores/player";
import { STAGE_NAMES } from "@/data/daolu";
import { useQuestsStore } from "@/stores/quests";
import { ELEMENTS } from "@/data/linggen";
import { titleDef } from "@/data/titles";
import { petDef } from "@/data/pets";
import { talentDef } from "@/data/talents";
import { ACHIEVEMENTS } from "@/data/achievements";
import { REALMS, WORLDS } from "@/data/realms";
import { detectBuild } from "@/core/buildDetect";
import { useLoadoutsStore } from "@/stores/loadouts";
import { isSoftCapped, modOf } from "@/core/statsCalc";
import {
  DIMINISH_KEYS,
  DIMINISH_WEIGHTS,
  POWER_WEIGHTS,
  SHIELD_CAP_RATIO,
  SOFT_CAPS,
} from "@/data/constants";
import { collectionCodex } from "@/ui/codex";
import { collectionProgressOverviewFromCodex } from "@/core/collectionProgress";
import { mentorVerdict } from "@/core/mentorService";
import { buildIdentity } from "@/core/identityService";
import { rootElements, tendencyLines } from "@/core/linggenAffinity";
import { cnNumber, formatNum, formatPercent } from "@/utils/format";
import { add, gn, mulN, ratio } from "@/utils/gnum";
import FolioPageHeader from "@/components/common/FolioPageHeader.vue";
import TapNumber from "@/components/common/TapNumber.vue";
import type { AnyStatKey } from "@/types";
import { STAT_NAMES } from "@/data/statNames";
import { achievementCounts, achievementStateOf } from "@/core/engineUnlocks";
import SectionTitle from "@/components/common/SectionTitle.vue";
import CharacterIndexRow from "@/components/character/CharacterIndexRow.vue";
import CharacterSigil from "@/components/character/CharacterSigil.vue";
import RebirthDialog from "@/components/character/RebirthDialog.vue";
import BondDialog from "@/components/character/BondDialog.vue";
import MentorDialog from "@/components/character/MentorDialog.vue";
import IdentityDialog from "@/components/character/IdentityDialog.vue";
import { useBondOverview } from "@/composables/useBondOverview";

const player = usePlayerStore();
/** 卦在身:时限制的一卦在跑 —— 界域志那一行要报出来(问卦就在那一册里) */
const divinationOn = computed(() => !!player.activeDivination);

const quests = useQuestsStore();
const loadouts = useLoadoutsStore();

const stats = computed(() => player.finalStats);
/** 战力详情:三围各一行,并标明它们在战力里的权重 —— 战力是加权和(见 powerScore),
 *  拆开才知道涨在哪一项、哪项根本不顶事(×0.15 的气血再高也拉不动战力)。 */
/**
 * 战力的三项构成 —— 值取最终属性,权重读 POWER_WEIGHTS 本体。
 *
 * share = 该项加权后占战力的比例。加权与 powerScore 同走 mulN,
 * 故三份占比之和恒为 1(不用另写一份「战力」算法,也就不会与面板打架)。
 * weightText 供三围那一格直接印出「×3」这类系数:系数若手抄,
 * 调平引擎权重时界面就成了唯一不跟的那处。
 */
const powerDetailRows = computed(() => {
  /*
   * 配色:三条各取语义色之一(攻=朱砂、防=石青、血=石绿)。
   * 这三个色在本作里本来就分工明确(朱砂=行动/要害,青=信息,玉=生生不息),
   * 横条借它们分档,不必再造一套调色。
   */
  const weighted = [
    {
      label: "攻击",
      value: player.finalStats.attack,
      w: POWER_WEIGHTS.attack,
      bar: "var(--color-cinnabar)",
    },
    {
      label: "防御",
      value: player.finalStats.defense,
      w: POWER_WEIGHTS.defense,
      bar: "var(--color-qing)",
    },
    {
      label: "气血",
      value: player.finalStats.maxHp,
      w: POWER_WEIGHTS.maxHp,
      bar: "var(--color-jade)",
    },
  ].map((r) => ({ ...r, part: mulN(r.value, r.w) }));
  const total = weighted.reduce((acc, r) => add(acc, r.part), gn(0));
  return weighted.map((r) => ({
    label: r.label,
    value: r.value,
    barColor: r.bar,
    weightText: `${r.w}`,
    // ratio 自带零分母与指数差钳制,不必在这里另判一遍
    share: ratio(r.part, total),
    hint: `按 ×${r.w} 计入战力`,
  }));
});

/** 横条的读屏描述 —— 纯视觉的百分比分段,读屏用户也该知道这个数由谁撑起来 */
const powerShareLabel = computed(() =>
  powerDetailRows.value.map((r) => `${r.label} ${formatPercent(r.share, 0)}`).join(" · "),
);

const powerSegments = computed(() =>
  powerDetailRows.value.map(({ label, share, barColor }) => ({
    label,
    share,
    color: barColor,
  })),
);

/** 战力公式直接摊开三项权重；调 POWER_WEIGHTS 时这里跟着变。 */
const powerFormulaText = computed(() =>
  powerDetailRows.value.map((row) => `${row.label} × ${row.weightText}`).join(" + "),
);

/** 灵根的天然牌面(倾向文案,不含任何数值) */
const tendencies = computed(() => tendencyLines(rootElements(player.linggen?.roots)));

const MOD_KEYS: AnyStatKey[] = [
  "cultivationSpeed",
  "qiRegen",
  "breakthroughRate",
  "critRate",
  "critDamage",
  "damageBonus",
  "damageReduction",
  "dodgeRate",
  "accuracy",
  "shieldOnStart",
  "luck",
  "explorationSpeed",
  "dropRate",
];

const modRows = computed(() =>
  MOD_KEYS.map((k) => ({
    key: k,
    label: STAT_NAMES[k],
    value: modOf(stats.value.mods, k),
    capped: isSoftCapped(stats.value.mods, k),
  })).filter((x) => x.value !== 0),
);

/** 面板上是否需要那句「进阶成功率只作用于小进阶」的边界说明 */
const hasAdvanceRate = computed(() => modOf(stats.value.mods, "breakthroughRate") !== 0);

/** 面板上是否需要护盾上限说明 —— 只在有盾系词条(与这条规则真相关)时亮,不占常驻字数 */
const SHIELD_MOD_KEYS: AnyStatKey[] = ["shieldOnStart", "shieldPower", "overhealShield"];
const hasShieldMods = computed(() => SHIELD_MOD_KEYS.some((k) => modOf(stats.value.mods, k) !== 0));

/** 来源明细:点哪一行看哪一行 —— 数据来自 finalStats.breakdown,不在界面里另算 */
const breakdownKey = ref<AnyStatKey | null>(null);
const breakdownRows = computed(() => {
  const key = breakdownKey.value;
  if (!key) return [];
  return stats.value.breakdown
    .map((r) => ({ name: r.name, value: r.mods[key] ?? 0, onTop: r.onTop === true }))
    .filter((c) => c.value !== 0);
});

function toggleBreakdown(key: AnyStatKey): void {
  breakdownKey.value = breakdownKey.value === key ? null : key;
}

/**
 * 递减规则别只活在注释里:同一条件/触发词条多个来源时,明细里每一份已是打完折的
 * 真值,但玩家对着两三个来源看不出「第三个被砍半」。权重序从 DIMINISH_WEIGHTS
 * 本体读(第 5 个起一律 25%),不在界面手抄 "50%/25%"。
 */
const DIMINISH = new Set<AnyStatKey>(DIMINISH_KEYS);
const diminishNote = computed(() => {
  const key = breakdownKey.value;
  if (!key || !DIMINISH.has(key)) return null;
  if (breakdownRows.value.length < 2) return null;
  const ladder = DIMINISH_WEIGHTS.map((w, i) => `第${i + 1}个 ${formatPercent(w, 0)}`).join("、");
  return `同类来源按贡献降序 ${ladder} 递减计入 —— 混合构筑比单条堆砌更值`;
});

/**
 * 软上限从来不是暗改:越过之后超出部分按折扣计入,
 * 折扣率取自 SOFT_CAPS 本体,不在这里手抄"折半"(各键并非同一个数)
 */
const softCappedNotes = computed(() =>
  modRows.value
    .filter((r) => r.capped)
    .map((r) => `${r.label}(超出按 ${formatPercent(SOFT_CAPS[r.key]?.diminish ?? 1, 0)} 计入)`),
);

const build = computed(() => detectBuild(stats.value.mods));

const currentTitleName = computed(() =>
  player.titleId ? titleDef(player.titleId)?.name : undefined,
);
const currentPetName = computed(() => (player.petId ? petDef(player.petId)?.name : undefined));
const currentPetIcon = computed(() => (player.petId ? petDef(player.petId)?.icon : undefined));
const ownedTalents = computed(() =>
  player.reincarnation.talents.map((id) => talentDef(id)).filter((t) => t !== undefined),
);

/** 图鉴入口与藏珍页共用同一份九册装配与 stage 汇总。 */
const collectionSummary = computed(() => collectionProgressOverviewFromCodex(collectionCodex()));

// ---- 轮回 ----
const rebirthOpen = ref(false);
const bondDialog = ref(false);
// 道侣域共享投影收在 useBondOverview(入口卡副行/badge 与 BondDialog 同一份定义)
const { bond, bondDef, pastBonds, hasBondWord } = useBondOverview();

// Phase 31 S1 师承(弹窗归 MentorDialog;mentorVer 入口卡与本组件各算一份纯投影)
const mentorDialog = ref(false);
const mentorVer = computed(() => mentorVerdict(player.mentor));
// Phase 31.2 修行画像
const identityOpen = ref(false);
const identity = computed(() => buildIdentity());
</script>
