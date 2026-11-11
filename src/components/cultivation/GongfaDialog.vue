<template>
  <BaseModal :open="def !== undefined" :title="def?.name ?? ''" @close="close">
    <div v-if="def">
      <div class="flex items-center gap-2">
        <QualityTag :quality="def.quality" />
        <span class="chip-ink border-ink/30 text-ink-soft">{{ GONGFA_TYPE_NAMES[def.type] }}</span>
        <span v-if="def.type === 'secret'" class="text-note text-ink-faint">装配时占辅修席</span>
        <span v-if="def.element" class="chip-ink" :style="{ color: ELEMENTS[def.element].color }">
          {{ ELEMENTS[def.element].name }}属性
        </span>
        <!--
          Phase 32.2:同源功法参悟时更易撞见(倾向,非独占;无此灵根照样学得到)。

          带倍率:玩家**正是在这个弹窗里**决定参悟哪一门,而「更易撞见」此前
          只是一个词 —— 人物页的牌面折算已经报得出 ×2.2,决策现场反而读不到。
          倍率读同一个 `gongfaAffinity`(与 `sameRoot` 同一个函数,不可能分叉),
          写法走 `multText` 与人物页同源。非同源时不印 ×1:那是「没有加成」,
          印出来会像一个不存在的档位。
        -->
        <span
          v-if="sameRoot"
          class="chip-ink border-gold-ink/40 text-gold-ink"
          :title="`与你的灵根同源,藏经阁参悟时更易撞见(参悟权重 ${multText(sameRootMult)}）`"
          data-gongfa-same-root
          >同源 {{ multText(sameRootMult) }}</span
        >
        <span
          v-if="learned && branchPicked"
          class="rounded-[2px] bg-gold-ink/6 px-1.5 py-0.5 text-note text-gold-ink"
          >{{ branchPicked.name }}</span
        >
        <span
          v-else-if="learned && fullLevel && branches.length"
          class="rounded-[2px] bg-qing/6 px-1.5 py-0.5 text-note text-qing"
          >待悟道</span
        >
        <span v-if="learned" class="ml-auto tabular text-body text-gold-ink"
          >第 {{ level }}/{{ def.maxLevel }} 层</span
        >
      </div>
      <!--
        品评 —— 这一档凭什么(见 data/qualityVerdicts)。
        与品阶名同处眉题之下第一行:上面那一行报「这是哪一档」,这一行报「那一档凭什么」。
        此前只有器评帖有这一句,而功法的眉题上同样挂着品阶名 —— 同一件事在界面上
        成了半句话。不铺底、不加字号(它读的是「为什么」,不是标题),只用品阶色托出来。
      -->
      <p
        v-if="verdictLine"
        class="mt-1.5 font-kai text-body"
        :style="{ color: qualityTextColor(def.quality) }"
        data-gongfa-verdict-line
      >
        {{ verdictLine }}
      </p>
      <!--
        这一门属什么 —— 按五行取景,没五行的按门径。

        这一作里**五行是构筑的一半**:同一部功法五行不同,与之同源的灵根、
        藏经阁的参悟权重、与其它功法的相生相克全都跟着变。而 474 行模板里
        一个 `<svg>` 都没有,五行的身份只在眉题挂着一枚 chip。

        没有 element 的那 59 部(纯体术 / 心法)按**门径**取景(主修 / 辅修 / 秘术)——
        那是三种不同的装配规则,不是三种画法。给它们一律落同一片兜底,
        那 59 部就等于共用一张底。

        落法是背景层:这一窗正文是效果、悟道分支与按钮,画占布局会把它们推下去。
        高度只能走 `--ink-scene-h`(这一层同时就是 `.ink-scene` 本身,
        直接写 height 会被组件内那条 `height: var(--ink-scene-h, 100%)` 盖过)。
      -->
      <div class="gongfa-detail__scene">
        <InkScene
          :terrain="sceneTerrainOfGongfa(def.element, def.type)"
          :marks="false"
          aria-hidden="true"
        />
      </div>
      <p class="mt-2 t-body text-ink-faint">{{ def.desc }}</p>
      <p v-if="!learned && def.minRealm > player.major" class="mt-1 text-body text-cinnabar">
        需 {{ realmDef(def.minRealm)?.name ?? `第${def.minRealm}境` }} 境方可参悟其精义
      </p>
      <div class="ink-divider my-3" />
      <template v-if="learned">
        <div class="space-y-1.5">
          <p v-for="row in modRows" :key="row.label" class="flex justify-between text-body">
            <span class="text-ink-soft">{{ row.label }}</span>
            <span class="tabular text-qing">{{ row.value }}</span>
          </p>
          <p v-if="def.skill" class="t-body text-cinnabar">
            {{ gongfaSkillLine(def.skill) }}
          </p>
        </div>
        <!-- 每进一层的增量:进修要花悟道点与残页,值不值当得看得见 -->
        <p class="mt-2 text-body text-ink-faint">
          每进一层:<span class="tabular text-qing">{{ modsText(def.perLevelMods) }}</span>
        </p>
        <p v-if="upCost" class="mt-3 text-right text-body text-ink-faint tabular">
          进修需 悟道点×{{ upCost.wudao }} · 残页×{{ upCost.page }}
        </p>
        <!--
          冲满的尽头要看得见:分支内容不预告(圆满才揭晓),但"这部功法是条有选择的
          路"这个事实得先说 —— 不然冲哪部全靠名字猜,圆满了才发现没岔路可走。
        -->
        <p v-if="!fullLevel && branches.length" class="mt-2 text-body text-ink-faint">
          修至圆满,可循其中一条道走到底({{ branches.length }} 条道途)
          <span class="text-cinnabar">—— 一经择定终身不改</span>
        </p>
        <!-- Phase 31 A3:满级悟道,择一分支。文案须自解释——给什么、要不要慎重,按下之前就得看见 -->
        <div v-if="fullLevel && branches.length" class="mt-3">
          <p class="mb-1 font-kai text-body tracking-[0.2em] text-ink-faint">功 行 圆 满 · 悟 道</p>
          <p class="mb-2 t-body text-ink-faint">
            此功已修至顶层,可就其中一条道走到底,永久追加下方词条(转世不失)。
            <span class="text-cinnabar">道分歧路,一经择定终身不改。</span>
          </p>
          <div v-if="branchPicked" class="rounded-[2px] bg-paper-deep/70 px-3 py-2">
            <p>
              <span class="font-kai text-title text-gold-ink">{{ branchPicked.name }}</span>
              <span class="ml-2 text-body text-ink-faint">{{ branchPicked.desc }}</span>
            </p>
            <p class="tabular mt-0.5 text-body text-qing">{{ modsText(branchPicked.mods) }}</p>
            <!--
              道记 —— 择道那一刻的落款(见 core/daoNote)。此前择定之后只剩一枚词,
              几十小时后回头,那一年走到哪儿、放弃了哪几条路,全都不在了。
            -->
            <p v-if="branchNoteLine" class="mt-1 t-note text-ink-faint" data-gongfa-dao-note>
              {{ branchNoteLine }}
            </p>
            <!--
              未行之道 —— 择定之后,其余几条从这里退成一行题跋(见 ui/unwalkedBranch)。
              悟道录那边一直留着它们的「已见」,而这一页把它们藏了:玩家刚做完一个
              不可撤销的决定,却在这一页看不到另外几条当时给的是什么。
              写成字,不写成按钮 —— 它们已经不可选了。
            -->
            <p
              v-if="unwalked.length"
              class="mt-1 border-t border-ink/10 pt-1 t-note text-ink-faint"
              data-gongfa-unwalked
            >
              <span class="tracking-[0.18em]">未行</span>
              <template v-for="(w, i) in unwalked" :key="w.id">
                <span v-if="i > 0" class="px-1 text-ink-faint">·</span>
                <span class="font-kai">{{ w.name }}</span>
                <span class="ml-1">{{ w.effect }}</span>
              </template>
            </p>
          </div>
          <div v-else class="space-y-1.5">
            <button
              v-for="b in branches"
              :key="b.id"
              class="flex w-full items-center justify-between gap-2 rounded-[2px] border border-ink/20 px-3 py-2 text-left active:scale-98"
              @click="branchConfirm = b.id"
            >
              <span class="min-w-0">
                <span class="font-kai text-title text-ink">{{ b.name }}</span>
                <span class="ml-2 text-body text-ink-faint">{{ b.desc }}</span>
                <span class="tabular mt-0.5 block text-body text-qing">{{ modsText(b.mods) }}</span>
              </span>
              <span class="shrink-0 text-note text-qing">择此道 →</span>
            </button>
            <!-- 永久抉择二步确认:选了就改不了,按一下不该就此了结 -->
            <div v-if="branchConfirm" class="rounded-[2px] bg-cinnabar/5 px-3 py-2">
              <p class="t-note text-cinnabar">
                道分歧路,一经择定<strong>终身不改</strong>(转世仍随你)。确认择【{{
                  gongfaBranchDef(branchConfirm)?.name ?? ""
                }}】?
              </p>
              <div class="mt-1.5 flex justify-end gap-2">
                <button class="btn-ghost !px-3 !py-1 !text-body" @click="branchConfirm = null">
                  再想想
                </button>
                <button class="btn-seal !px-3 !py-1 !text-body" @click="confirmBranch()">
                  确认择道
                </button>
              </div>
            </div>
          </div>
        </div>
        <!-- 满级却无分支:也要交代一句,免得玩家满世界找入口 -->
        <p v-else-if="fullLevel" class="mt-3 text-body text-ink-faint">
          此功已修至顶层,一以贯之,别无歧路可择。
        </p>
      </template>
      <!--
        未习得也要给得出「学它做什么」:参悟是花残页的抉择,池子里若只写着风味,
        玩家只能凭名字挑 —— 而名字看不出它是攻是守。故这里给满级账。
      -->
      <template v-else>
        <p class="text-body text-ink-faint">尚未习得此功法。</p>
        <p class="mt-2 text-body text-ink-soft">修至圆满({{ def.maxLevel }} 层)可得:</p>
        <div class="mt-1 space-y-1">
          <p v-for="row in previewRows" :key="row.label" class="flex justify-between text-body">
            <span class="text-ink-faint">{{ row.label }}</span>
            <span class="tabular text-qing">{{ row.value }}</span>
          </p>
          <p v-if="def.skill" class="t-body text-cinnabar">
            {{ gongfaSkillLine(def.skill) }}
          </p>
          <!-- 同上一行:满级账之外,把这功法的"尽头是条可择之路"一并预告 -->
          <p v-if="branches.length" class="flex justify-between text-body">
            <span class="text-ink-faint">圆满后道途</span>
            <span class="tabular text-gold-ink">共 {{ branches.length }} 条可择(终身不改)</span>
          </p>
        </div>
      </template>
    </div>
    <template v-if="learned" #footer>
      <div class="flex flex-col gap-2">
        <!--
          两枚 flex-1 并排(设为主修 / 进修)在 200% 缩放档(195 CSS px)下每枚只剩 31px:
          「进修 · 尚差 12 残页」被挤成一字一行、「修到顶 · 尚差 …」折成两行。极窄档改成
          纵向堆叠,各自整行。320 / 390 两档不动。
        -->
        <div class="flex gap-2 tinylens:flex-col">
          <button
            v-if="def?.type === 'main'"
            class="btn-seal flex-1"
            :disabled="isMain"
            @click="setMain"
          >
            {{ isMain ? "主修中" : "设为主修" }}
          </button>
          <button v-else class="btn-seal flex-1" :disabled="subFull" @click="toggleSub">
            {{ subFull ? `辅修席满(${dongfu.subGongfaSlots} 席)` : subSlotLabel }}
          </button>
          <!-- 进修付不起就置灰+列差:缺哪样、差多少都在按钮上直说(与聚气丹/建筑同款纪律) -->
          <button
            v-if="upCost"
            class="btn-ghost flex-1"
            :disabled="!upAffordable"
            @click="def && upgradeGongfa(def.id)"
          >
            <template v-if="upAffordable"
              >进 修 · {{ upCost.wudao }} 悟道点 · {{ upCost.page }} 残页</template
            >
            <template v-else>进修 · 尚差 {{ upShort }}</template>
          </button>
        </div>
        <!--
          修到顶不是「一直点单层」：本轮实际能修几层、吃多少、停在哪里，
          按下前先摊开。按钮与结算同读 core 的 planGongfaUpgradeAll。
        -->
        <BatchSpendLedger
          v-if="batchPlan.count > 0"
          id="gongfa-batch-plan"
          seal="修"
          :status="batchPlan.ended === 'max' ? '可至圆满' : '料尽止'"
          :tone="batchPlan.ended === 'max' ? 'qing' : 'cinnabar'"
          data-gongfa-batch-plan
          :data-gongfa-batch-count="batchPlan.count"
          :data-gongfa-batch-from="batchPlan.fromLevel"
          :data-gongfa-batch-to="batchPlan.toLevel"
          :data-gongfa-batch-wudao="batchPlan.wudao"
          :data-gongfa-batch-page="batchPlan.page"
          :data-gongfa-batch-ended="batchPlan.ended"
        >
          <template #title>
            本轮修至第 {{ batchPlan.toLevel }} 层,共 {{ batchPlan.count }} 层
          </template>
          <template #detail> 耗 悟道点×{{ batchPlan.wudao }} · 残页×{{ batchPlan.page }} </template>
        </BatchSpendLedger>
        <button
          v-if="upCost"
          class="btn-ghost w-full !py-1.5 !text-body"
          :disabled="!upAffordable"
          :aria-label="batchActionLabel"
          :aria-describedby="batchPlan.count > 0 ? 'gongfa-batch-plan' : undefined"
          @click="doUpgradeAll"
        >
          <template v-if="upAffordable">
            {{
              batchPlan.ended === "broke"
                ? `修至料尽 · ${batchPlan.count} 层`
                : `修到顶 · ${batchPlan.count} 层`
            }}
          </template>
          <template v-else>修到顶 · 尚差 {{ upShort }}</template>
        </button>
      </div>
    </template>
  </BaseModal>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useUiStore } from "@/stores/ui";
import { useCultivationStore } from "@/stores/cultivation";
import { useDongfuStore } from "@/stores/dongfu";
import { usePlayerStore } from "@/stores/player";
import { useResourcesStore } from "@/stores/resources";
import { gongfaDef, GONGFA_TYPE_NAMES } from "@/data/gongfa";
import InkScene from "@/components/common/InkScene.vue";
import { sceneTerrainOfGongfa } from "@/ui/sceneTerrain";
import { realmDef, realmLabel } from "@/data/realms";
import { ELEMENTS } from "@/data/linggen";
import { branchesFor, gongfaBranchDef } from "@/data/gongfaBranches";
import {
  gongfaUpgradeCost,
  planGongfaUpgradeAll,
  upgradeGongfa,
  upgradeGongfaAll,
} from "@/core/gongfaService";
import { gongfaAffinity, rootElements } from "@/core/linggenAffinity";
import { daoNoteLine } from "@/core/daoNote";
import { unwalkedBranches } from "@/ui/unwalkedBranch";
import { gongfaModsAt } from "@/stores/cultivation";
import { cnNumber, formatSignedPercent, yearsShown } from "@/utils/format";
import { gongfaSkillLine } from "@/ui/itemText";
import { STAT_NAMES, modsText } from "@/data/statNames";
import type { AnyStatKey } from "@/types";
import BaseModal from "@/components/common/BaseModal.vue";
import BatchSpendLedger from "@/components/common/BatchSpendLedger.vue";
import QualityTag from "@/components/common/QualityTag.vue";
import { qualityVerdict } from "@/data/qualityVerdicts";
import { qualityTextColor } from "@/ui/qualityTier";
import { multText } from "@/ui/multText";

const ui = useUiStore();
const cultivation = useCultivationStore();
const dongfu = useDongfuStore();
const player = usePlayerStore();
const resources = useResourcesStore();

const def = computed(() => (ui.gongfaDetailId ? gongfaDef(ui.gongfaDetailId) : undefined));
/**
 * 品评一句话(见 data/qualityVerdicts)—— 与器评帖、藏珍详情读同一份。
 * 认不得的档给空串,整行不出(宁可少一行,也不要空一句)。
 */
const verdictLine = computed(() => (def.value ? qualityVerdict(def.value.quality) : ""));
const level = computed(() => (def.value ? (cultivation.learned[def.value.id] ?? 0) : 0));
const learned = computed(() => level.value > 0);
const upCost = computed(() => (def.value ? gongfaUpgradeCost(def.value.id) : null));
/** 进修付不起即灰:悟道点与残页两道账,缺一不可(与 upgradeGongfa 失败臂同口径) */
const upAffordable = computed(() => {
  const c = upCost.value;
  if (!c) return false;
  return resources.hasSmall("wudao", c.wudao) && resources.hasSmall("page", c.page);
});
/** 尚差文案:双缺用「·」粘连(与建筑卡同款) */
const upShort = computed(() => {
  const c = upCost.value;
  if (!c) return "";
  const wudaoShort = Math.max(0, c.wudao - resources.wudao);
  const pageShort = Math.max(0, c.page - resources.page);
  if (wudaoShort > 0 && pageShort > 0) return `${wudaoShort} 悟道点 · ${pageShort} 残页`;
  if (wudaoShort > 0) return `${wudaoShort} 悟道点`;
  return `${pageShort} 残页`;
});
const batchPlan = computed(() =>
  def.value
    ? planGongfaUpgradeAll(def.value.id)
    : {
        fromLevel: 0,
        toLevel: 0,
        count: 0,
        wudao: 0,
        page: 0,
        ended: "notlearned" as const,
      },
);
const batchActionLabel = computed(() => {
  if (!upAffordable.value) return `修到顶 · 尚差 ${upShort.value}`;
  const stop = batchPlan.value.ended === "broke" ? "修至料尽" : "修到顶";
  return `${stop} · ${batchPlan.value.count} 层 · 耗 悟道点 ${batchPlan.value.wudao} · 残页 ${batchPlan.value.page}`;
});

/**
 * 这一门与灵根的参悟权重倍率。
 *
 * 与 `sameRoot` 读**同一个函数**:两者的判据都来自 `gongfaAffinity`,
 * 故「同源」这个标签与它后面那个倍数不可能分叉(不会是「同源 ×1」)。
 */
const sameRootMult = computed(() =>
  gongfaAffinity(def.value?.element, rootElements(player.linggen?.roots)),
);

/** 与灵根同源?判据直接取自参悟权重函数,标签与实际权重不可能分叉 */
const sameRoot = computed(() => sameRootMult.value > 1);

const modRows = computed(() => {
  if (!def.value || !learned.value) return [];
  const mods = gongfaModsAt(def.value.id, level.value);
  return Object.entries(mods).map(([k, v]) => ({
    label: STAT_NAMES[k as AnyStatKey] ?? k,
    value: formatSignedPercent(v as number),
  }));
});

/** 未习得时的满级预览 —— 与习得后同一套算法(满级 = maxLevel 层) */
const previewRows = computed(() => {
  const d = def.value;
  if (!d) return [];
  const mods = gongfaModsAt(d.id, d.maxLevel);
  return Object.entries(mods).map(([k, v]) => ({
    label: STAT_NAMES[k as AnyStatKey] ?? k,
    value: formatSignedPercent(v as number),
  }));
});

const isMain = computed(() => def.value && cultivation.mainGongfa === def.value.id);
const isSub = computed(() => def.value && cultivation.subGongfa.includes(def.value.id));
/** 秘术没有自己的席,装上的是辅修席。按钮把这件事说穿,和列表上的「在辅修席」同一句话。 */
const subSlotLabel = computed(() => {
  const secret = def.value?.type === "secret";
  if (isSub.value) return secret ? "移出辅修席" : "卸下辅修";
  return secret ? "放入辅修席" : "设为辅修";
});

/** 辅修席满且这部功法不在席上:装不进,须先卸一部(浑装不行的同一套置灰拦因) */
const subFull = computed(
  () => !isSub.value && cultivation.subGongfa.length >= dongfu.subGongfaSlots,
);

// Phase 31 A3:满级悟道分支
const fullLevel = computed(() => (def.value ? level.value >= (def.value.maxLevel ?? 9) : false));
const branches = computed(() => (def.value ? branchesFor(def.value.id) : []));
const branchPicked = computed(() => {
  if (!def.value) return undefined;
  const id = cultivation.gongfaBranch[def.value.id];
  return id ? gongfaBranchDef(id) : undefined;
});

/** 悟道分岔确认态(按分支 id):永久抉择先确认。换功法/关弹窗即复位 */
const branchConfirm = ref<string | null>(null);

/**
 * 那一行落款 —— 年岁与境界名都取自各自的事实源(utils/format 的年岁口径、
 * data/realms 的境界名),本组件只负责把三者拼成一句(拼句在 core/daoNote)。
 */
/**
 * 没走的那几条道(见 ui/unwalkedBranch)。
 *
 * 只在**已择定**时非空:没择之前页面上是完整可选列表,再列一遍就是同一屏说两遍。
 */
const unwalked = computed(() =>
  unwalkedBranches(branches.value, cultivation.gongfaBranch[def.value?.id ?? ""] ?? null),
);

const branchNoteLine = computed(() => {
  if (!def.value) return "";
  const note = cultivation.daoNotes[def.value.id];
  if (!note) return "";
  return daoNoteLine(note, {
    ageText: `${cnNumber(yearsShown(note.age))}岁`,
    realmText: realmLabel(note.major, note.sub),
    branchName: (id) => gongfaBranchDef(id)?.name ?? "",
  });
});
watch(def, () => {
  branchConfirm.value = null;
});

function choose(branchId: string): void {
  if (!def.value) return;
  // 落款要记的是**此刻**的年岁与境界(道记不给数值,但年岁与境是自己走出来的证据)
  const ok = cultivation.chooseBranch(def.value.id, branchId, {
    age: player.age,
    major: player.major,
    sub: player.sub,
  });
  if (ok) {
    /*
     * 带上这条道给了什么 —— 悟道是**一次性且不可逆**的(满级后各择一条,择过就定了,
     * 转世才另算)。玩家在这一刻最想知道「我选了它,它给了我什么」,而原先只报名字。
     *
     * 加成文案走 modsText,与装备词条、称号、buff 同一口径,不在这里手拼百分数。
     */
    const b = gongfaBranchDef(branchId);
    const bonus = b ? modsText(b.mods) : "";
    ui.toast(`已悟道「${b?.name ?? ""}」${bonus ? ` —— ${bonus}` : ""}`, "rare");
  }
}

function confirmBranch(): void {
  if (!branchConfirm.value) return;
  const id = branchConfirm.value;
  branchConfirm.value = null;
  choose(id);
}

/** 修到顶:一次修到圆满或料尽(gongfaService.upgradeGongfaAll 已合一条总账) */
function doUpgradeAll(): void {
  if (def.value) upgradeGongfaAll(def.value.id);
}

function close(): void {
  ui.gongfaDetailId = null;
}

function setMain(): void {
  if (def.value) cultivation.equipMain(def.value.id);
}

function toggleSub(): void {
  if (!def.value) return;
  const ok = cultivation.toggleSub(def.value.id, dongfu.subGongfaSlots);
  if (!ok) ui.toast(`辅修栏已满(${dongfu.subGongfaSlots} 个,升级藏经阁可扩容)`, "warn");
}
</script>

<style scoped>
/*
 * 功法详情卷首那片天 —— 按**这一门属什么**取景。
 *
 * 背景层,不占布局:这一窗正文是效果、悟道分支与按钮,画排进流里会把它们推下去。
 * 高度走 `--ink-scene-h`(InkScene 读它),位置由这一层自己给。
 *
 * 写在组件内而不是 cultivation.css:`InkScene` 的高度规则是带 data-v 的 scoped 规则,
 * 同特指度下顺序决定谁赢;写在组件内、同一个 data-v 上反而更稳(上一轮在器评帖上
 * 踩过一次 height 被盖过、画撑满整帖)。
 *
 * 点景关掉(模板上 `:marks="false"`):这一层底下压着眉题与品评那几行,
 * 月与舟落在字上两边都读不清。
 */
/*
 * 卷首那片天 —— 钉在面板顶,不参与这一窗的流。
 *
 * 这一窗的面板是 `flex flex-col`,正文照流排下来。若把画当流里的一块,
 * 它就落在品评与风味之间(实测截图里正是这样:一条山夹在「炼得成形,已有章法」
 * 与「取青木生生不息之意」中间,像一条被压扁的横幅)。
 *
 * 故 `absolute` 钉在面板顶,正文照旧从上面过 —— 它只是一层底,不改任何一行的位置。
 * 面板本身是 `relative`(BaseModal 的 `.modal-panel` 自带),故这里不用再造一层锚。
 */
.gongfa-detail__scene {
  --ink-scene-h: 6.4rem;
  --ink-scene-ink: 0.5;
  position: absolute;
  inset-inline: 0;
  top: 0;
  overflow: hidden;
  pointer-events: none;
}
</style>
