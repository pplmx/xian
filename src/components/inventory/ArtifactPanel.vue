<template>
  <!--
    主值行只留读数;「几境开下一格」是**次要信息**,自己占一行 ——
    挤在同一行里,窄屏上会被顶成两行(与修炼页那两行同一类)。
  -->
  <p class="mt-3 px-1 text-[11px] text-ink-faint tabular">
    法宝位 {{ inventory.equippedArtifacts.length }}/{{ artifactSlots }}
  </p>
  <p v-if="artifactSlots < ARTIFACT_MAX_SLOTS" class="mt-0.5 px-1 text-[10px] text-ink-faint">
    {{ artifactUnlockRealm }}境开启第{{ cnNumber(ARTIFACT_MAX_SLOTS) }}法宝位
  </p>
  <!-- 祭炼到底给什么:数值都从上界常数来,不在界面里再写一份 -->
  <p class="mt-1 px-1 text-[10px] text-ink-faint">
    祭炼一重,被动与神通各强 {{ formatPercent(ARTIFACT_LEVEL_BONUS) }},至多
    {{ cnNumber(ARTIFACT_MAX_LEVEL) }} 重 —— 顶到封顶的不再涨,卡片上标着
  </p>
  <div v-if="artifactRows.length" class="mt-2 space-y-2.5">
    <!--
      法宝行卡的品阶晕染:边框随档加深(qualityTier 同源),天/仙/神另有角章。
      底色**固定 6%**(不随档):法宝行是多行文字密卡(名/描述/被动/神通 11-14px),
      进阶档的 10% 与稀有档的 13% 底会把文字对比度压破 AA(货架 4.35:1 的同一教训,
      见 MarketView shelfTier)—— 档位线索由边框与角章承担,底色退回弱晕。
    -->
    <div
      v-for="row in artifactRows"
      :key="row.def.id"
      class="card-ink relative px-4 py-3"
      :style="{
        borderColor: colorWithAlpha(
          qualityDef(row.def.quality).color,
          tierOf(row.def.quality).border,
        ),
        background: colorWithAlpha(qualityDef(row.def.quality).color, 0.06),
      }"
    >
      <!-- 佩戴中的法宝盖「随」章(玉色,与装备格的「佩」同族) —— 靠按钮文字区分太隐晦 -->
      <span
        v-if="row.equipped"
        class="absolute left-2 top-2 rounded-sm bg-jade/15 px-[3px] font-kai text-[10px] leading-[1.4] text-jade"
        >随</span
      >
      <!-- 天/仙/神右上盖品阶阴文章 —— 与装备/丹药同一套视觉语言(见 qualityTier) -->
      <span v-if="isRareQuality(row.def.quality)" class="absolute right-2 top-2 leading-none">
        <QualitySeal :quality="row.def.quality" :size="16" />
      </span>
      <div class="flex items-center gap-2">
        <GameIcon
          :name="row.def.icon"
          :size="18"
          :style="{ color: qualityDef(row.def.quality).color }"
        />
        <span class="font-kai text-[14px]" :style="{ color: qualityDef(row.def.quality).color }">{{
          row.def.name
        }}</span>
        <QualityTag :quality="row.def.quality" />
        <!-- 「重」而不是「阶」:阶是地界与装备层级的词,法宝这一头说的是祭炼了几重 -->
        <span class="ml-auto tabular text-[11px] text-gold-ink">{{
          artifactLevelLabel(row.owned.level)
        }}</span>
      </div>
      <!-- 祭炼进度条:离满重还有多远,2px 细条(与成就组头同一根尺) -->
      <ProgressBar
        class="mt-1.5"
        :value="row.owned.level / ARTIFACT_MAX_LEVEL"
        color="var(--color-gold-ink)"
        :height="2"
      />
      <p class="mt-1.5 t-body text-ink-faint">{{ row.def.desc }}</p>
      <p class="mt-1 text-[11px] text-qing">
        {{ passiveLines(row.def.id, row.owned.level).join(" · ") }}
      </p>
      <!--
        神通说明按品阶与祭炼等级现算:效果随「品阶 × (1+0.08×重数)」走,
        文案不能停在基线那一句
        (见 data/artifacts.artifactActiveText —— 战斗与这句话读的是同一个函数)
      -->
      <p class="mt-1 text-[11px] text-violet-ink">
        神通「{{ row.def.active.name }}」:{{ artifactActiveText(row.def, row.owned.level) }}
      </p>
      <!--
        下一重给多少:按钮只报代价,玩家得自己按 ×1.08 心算 —— 而「值不值」
        正是按下之前要想清楚的事(数值由 artifactNextLevelGain 算,含封顶提示)。
      -->
      <p
        v-if="nextGainText(row.def.id, row.owned.level)"
        class="mt-1 text-[10px] leading-relaxed text-ink-faint tabular"
      >
        下一重:{{ nextGainText(row.def.id, row.owned.level) }}
      </p>
      <div class="mt-2.5 flex gap-2">
        <button
          class="btn-seal flex-1 !py-1.5 !text-[11px]"
          :class="{ '!bg-ink-faint': row.equipped }"
          @click="toggleArtifact(row.def.id)"
        >
          {{ row.equipped ? "收回法宝" : "祭炼随身" }}
        </button>
        <button
          v-if="row.upCost"
          class="btn-ghost flex-1 !py-1.5 !text-[11px] tabular"
          :disabled="!row.upAffordable"
          @click="upgradeArtifact(row.def.id)"
        >
          <!--
            两种代价都要写出来:炼化既扣悟道点、也扣灵石(见 forge.artifactUpCost),
            而按钮此前只报悟道 —— 玩家按标签算账,回头发现灵石也少了一大截。
          -->
          炼化(悟道点 {{ row.upCost.wudao }} · 灵石 {{ formatGN(row.upCost.stone) }})
        </button>
      </div>
      <!-- 付不起就把缺摆出来:灰按钮只说不许,不告诉差多少等于没说完 -->
      <p v-if="row.upCost && !row.upAffordable" class="mt-1.5 text-[10px] text-cinnabar tabular">
        尚差 悟道点 {{ Math.max(0, row.upCost.wudao - resources.wudao) }} · 灵石
        {{ formatGN(Math.max(0, toNum(row.upCost.stone) - toNum(resources.spiritStone))) }}
      </p>
    </div>
  </div>
  <p v-else class="empty-note mt-16 text-center text-[11px] text-ink-faint">
    尚无法宝随身
    <br />
    <span class="text-[11px]">法宝多出自际遇与强敌之手</span>
  </p>
  <p v-if="player.petId" class="mt-4 text-center text-[11px] text-ink-faint">
    灵兽相伴,可在「名号」页更替
  </p>
</template>

<script setup lang="ts">
import { computed } from "vue";
import GameIcon from "@/components/common/GameIcon.vue";
import QualityTag from "@/components/common/QualityTag.vue";
import QualitySeal from "@/components/common/QualitySeal.vue";
import ProgressBar from "@/components/common/ProgressBar.vue";
import { isRareQuality, qualityTierStyle as tierOf } from "@/ui/qualityTier";
import { colorWithAlpha } from "@/ui/colorVar";
import { useInventoryStore } from "@/stores/inventory";
import { useResourcesStore } from "@/stores/resources";
import { usePlayerStore } from "@/stores/player";
import { useUiStore } from "@/stores/ui";
import { qualityDef } from "@/data/qualities";
import {
  artifactActiveText,
  artifactDef,
  artifactLevelLabel,
  artifactNextLevelGain,
  artifactValue,
  ARTIFACT_LEVEL_BONUS,
  ARTIFACT_MAX_LEVEL,
  ARTIFACT_MAX_SLOTS,
  ARTIFACT_SLOT_UNLOCK_MAJOR,
  artifactSlotsFor,
} from "@/data/artifacts";
import { artifactSlotBonus } from "@/core/heritageEffects";
import { REALMS } from "@/data/realms";
import { artifactUpCost, upgradeArtifact } from "@/core/forge";
import { cnNumber, formatGN, formatPercent, formatSignedPercent } from "@/utils/format";
import { toNum } from "@/utils/gnum";
import { STAT_NAMES } from "@/data/statNames";
import type { AnyStatKey } from "@/types";

const inventory = useInventoryStore();
const resources = useResourcesStore();
const player = usePlayerStore();
const ui = useUiStore();

const artifactSlots = computed(
  () => artifactSlotsFor(player.major) + artifactSlotBonus(player.reincarnation.heritage),
);
/** 开第二法宝位的那一境的名字 —— 门槛挪动时文案跟着走,不手写「元婴」 */
const artifactUnlockRealm = computed(() => REALMS[ARTIFACT_SLOT_UNLOCK_MAJOR]?.name ?? "");

const artifactRows = computed(() =>
  inventory.artifacts
    .map((a) => {
      const def = artifactDef(a.defId);
      if (!def) return null;
      const upCost = artifactUpCost(a.defId);
      return {
        owned: a,
        def,
        upCost,
        // 炼化既花悟道也花灵石:按下之前就得看得出付不付得起(见 forge.artifactUpCost)
        upAffordable:
          !upCost || (resources.wudao >= upCost.wudao && resources.hasStone(upCost.stone)),
        equipped: inventory.equippedArtifacts.includes(a.defId),
      };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null)
    // 与行囊同一套排法:品质降序 → 祭炼高的在前(此前按入手先后排,越捡越乱)
    .sort(
      (a, b) =>
        qualityDef(b.def.quality).rank - qualityDef(a.def.quality).rank ||
        b.owned.level - a.owned.level ||
        a.def.name.localeCompare(b.def.name),
    ),
);

function toggleArtifact(defId: string): void {
  const result = inventory.toggleArtifact(defId, artifactSlots.value);
  if (result === "replaced") ui.toast("法宝位已满,替换了最早祭炼的一件", "info");
}

function passiveLines(defId: string, level: number): string[] {
  const def = artifactDef(defId);
  if (!def) return [];
  // 与属性汇总(store/inventory)同源:卡片上写多少,身上加的就是多少
  return Object.entries(artifactValue(def, level).passive).map(
    ([k, v]) => `${STAT_NAMES[k as AnyStatKey] ?? k} ${formatSignedPercent(v as number)}`,
  );
}

/** 神通主体那个数说的是什么(用药名之外的话:威力 / 护盾 / 破解…) */
const ACTIVE_NOUNS: Record<string, string> = {
  damage: "威力",
  drain: "威力",
  heal: "回复",
  shield: "护盾",
  weaken: "削弱",
  sunder: "破甲",
  purge: "挣脱",
};

/**
 * 祭炼下一重的账:被动逐项 + 神通主体 + 吸命回补,到顶的标「已至上限」。
 * 已达满重(artifactNextLevelGain 返回 null)时不显示这一行。
 */
function nextGainText(defId: string, level: number): string {
  const def = artifactDef(defId);
  const gain = def ? artifactNextLevelGain(def, level) : null;
  if (!gain) return "";
  const parts = gain.passive.map(
    (p) => `${STAT_NAMES[p.key] ?? p.key} ${formatPercent(p.from)} → ${formatPercent(p.to)}`,
  );
  if (gain.active) {
    const noun = ACTIVE_NOUNS[def!.active.effect.type] ?? "效果";
    /**
     * 零重就顶到封顶的那几件(神鞭的破甲、神魔镜的回补…)再炼也不会更高,
     * 写「50% → 50%(已至上限)」等于让人自己看出来 —— 直接说清只涨被动。
     */
    const alreadyCapped = gain.active.capped && Math.abs(gain.active.to - gain.active.from) < 1e-9;
    parts.push(
      alreadyCapped
        ? `神通${noun}已至上限(${formatPercent(gain.active.to)}),祭炼只涨被动`
        : `神通${noun} ${formatPercent(gain.active.from)} → ${formatPercent(gain.active.to)}${gain.active.capped ? "(已至上限)" : ""}`,
    );
  } else {
    parts.push("神通不随祭炼变");
  }
  if (gain.heal) {
    parts.push(
      `回补 ${formatPercent(gain.heal.from)} → ${formatPercent(gain.heal.to)}${gain.heal.capped ? "(已至上限)" : ""}`,
    );
  }
  return parts.join(" · ");
}
</script>
