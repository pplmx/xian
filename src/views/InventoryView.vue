<template>
  <div class="stagger-in px-4 pb-6 pt-4">
    <!-- 页签 -->
    <InkTabs v-model="tab" :tabs="TABS" />

    <!-- 装备:部位槽,点击唤起部位列表 -->
    <template v-if="tab === 'equip'">
      <!-- 装备共鸣:机制是活的,玩家却看不见 —— 同组两件即共鸣,（2/2）亮起 -->
      <div v-if="setRows.length" class="card-ink mt-3 px-4 py-2.5">
        <p class="text-[10px] text-ink-faint">装备共鸣(同组两件即共鸣,机制不叠数值)</p>
        <p v-for="s in setRows" :key="s.def.id" class="mt-1 flex items-baseline gap-2 text-[11px]">
          <span class="font-kai" :class="s.active ? 'text-jade' : 'text-ink-soft'">{{
            s.def.name
          }}</span>
          <span class="tabular" :class="s.active ? 'text-jade' : 'text-ink-faint'"
            >{{ s.count }}/{{ s.def.required }}</span
          >
          <span class="min-w-0 grow text-[10px] leading-relaxed text-ink-faint">{{
            s.def.effectDesc
          }}</span>
          <!-- 穿齐该套:换上已持有里最强的套件,已穿更强者不动(绝不降级) -->
          <button
            type="button"
            class="tap-row shrink-0 -my-1.5 py-1.5 font-kai text-[11px] text-cinnabar active:opacity-60"
            :aria-label="`穿齐${s.def.name}`"
            @click="wearSetOf(s.def.id)"
          >
            穿齐 →
          </button>
        </p>
      </div>
      <!--
        行囊读数与两个动作此前挤在同一行:11px 的三个数 + 11px 的两个按钮,
        320 宽下「行囊 30 · 器灵尘 123,456 收纳·启 分解」几乎要折。
        读数归读数、动作归动作 —— 动作单独一行,并各带自己的语义色。
      -->
      <div class="mt-3 flex items-baseline justify-between px-1">
        <span class="text-[11px] text-ink-faint tabular">行囊</span>
        <!--
          器灵尘走 formatExact 全量展开,不走 formatNum 的缩写 ——
          它是要对账的钱(强化扣多少、分解给多少都按它算),
          缩成「5千」就等于把账本藏起来一半。行囊数是小整数,照旧。
        -->
        <span class="text-[11px] text-ink-soft tabular">
          {{ inventory.bagItems.length }}/{{ BAG_CAPACITY }} ·
          <span class="text-ink-faint">器灵尘</span> {{ formatExact(resources.dust) }}
        </span>
      </div>
      <div class="mt-1.5 flex gap-2">
        <button
          class="chip-ink flex-1 !justify-center !py-1.5 text-[11px]"
          aria-label="智能收纳设置"
          :aria-expanded="smartOpen"
          @click="smartOpen = true"
        >
          收纳{{ settings.smartKeep.enabled ? "·启" : "" }}
        </button>
        <button
          class="chip-ink flex-1 !justify-center !py-1.5 text-[11px]"
          aria-label="批量分解装备"
          :aria-expanded="decomposeOpen"
          @click="decomposeOpen = true"
        >
          分解
        </button>
      </div>
      <div class="mt-2 grid grid-cols-3 gap-2">
        <button
          v-for="row in slotRows"
          :key="row.slot"
          class="card-ink flex flex-col items-center gap-1 px-2 py-2.5 active:scale-95"
          @click="pickerSlot = row.slot"
        >
          <!--
            槽名与下面的装备名同为 10px 时,一格里两层字一样重,读的人得先分辨
            「哪个是我的东西」。槽名走楷体 + 字距:外形一变就认得出是题头而非内容;
            「·N」是候选件数,压到更淡的一档。
          -->
          <span class="font-kai text-[10px] tracking-[0.15em] text-ink-faint">
            {{ row.name }}
            <span v-if="row.stock" class="tracking-normal text-ink-faint/70">·{{ row.stock }}</span>
          </span>
          <template v-if="row.item && row.template">
            <GameIcon
              :name="row.template.icon"
              :size="16"
              :style="{ color: qualityDef(row.item.quality).color }"
            />
            <span
              class="w-full truncate text-center font-kai text-[10px]"
              :style="{ color: qualityDef(row.item.quality).color }"
            >
              {{ row.template.name }}
              <template v-if="row.item.level > 0">+{{ row.item.level }}</template>
              <template v-if="row.item.note">·{{ row.item.note }}</template>
            </span>
          </template>
          <template v-else>
            <span class="grid h-4 w-4 place-items-center text-ink-faint">·</span>
            <span class="text-[10px] text-ink-faint">空悬</span>
          </template>
        </button>
      </div>
      <p class="mt-2 text-center text-[10px] text-ink-faint">
        点击部位查看候选,行囊满时新掉落自动折作器灵尘
      </p>
      <!--
        一键穿最强:纯方便性动作,只改装配,绝不把好换差。
        它是常驻的便利入口 —— 从前藏在「有共鸣套才出现」的卡里,后来塞进「收纳/分解」
        那一排 11px 小字里,两回都没人看得见(两次实测反馈)。故改成整行按钮,写明全称。
      -->
      <button
        class="btn-ghost mt-2 w-full !py-2 !text-[11px]"
        aria-label="一键各部位换最强"
        @click="wearEquipBest"
      >
        一键 · 各部位换最强
      </button>

      <!-- 全部藏品(含佩戴中):部位槽之下的完整清单 -->
      <div v-if="allItems.length" class="mt-4">
        <SectionTitle
          title="全部藏品"
          :hint="`${allItems.length} 件 · 行囊 ${inventory.bagItems.length}/${BAG_CAPACITY}`"
        />
        <!-- 方格背包:五列格子 + 空槽占位,一眼看出还剩多少地方 -->
        <!--
          四列,不是五列 —— 390 宽下五列每格只剩 ~70px,而格子里要装图标、名字、
          强化等级与三枚角标(佩/共/新):名字几乎必被截成两三个字,8px 的角标
          更是认不出的墨点。四列给到 ~88px,名字与角标才都有立足处。
          320 宽下四列仍有 ~66px,比原来的五列 ~50px 宽裕。
        -->
        <div class="mt-2 grid grid-cols-4 gap-2">
          <EquipmentCard
            v-for="row in allItems"
            :key="row.item.uid"
            :item="row.item"
            :equipped="row.equipped"
            @open="openDetail"
          />
        </div>
      </div>
      <p v-else class="empty-note mt-8 text-center text-[11px] text-ink-faint">
        行囊空空,去历练中寻些机缘吧
      </p>
    </template>

    <!-- 丹药 -->
    <template v-else-if="tab === 'pill'">
      <!-- 开炉炼丹:入口置顶,点开弹窗 -->
      <button
        class="card-ink mt-3 flex w-full items-center justify-between gap-3 px-4 py-3 text-left active:scale-99"
        @click="craftOpen = true"
      >
        <span
          class="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-cinnabar/85 font-kai text-[19px] text-paper"
          >炉</span
        >
        <span class="min-w-0 flex-1">
          <span class="block t-card">开炉炼丹</span>
          <span class="block truncate text-[10px] leading-relaxed text-ink-faint">
            {{
              recipes.length > 0
                ? `已知丹方 ${recipes.length} 种 · ${HERB_GRADE_SHORT[herbGradeOfMajor(player.major)]}灵草 ${resources.herbOf(herbGradeOfMajor(player.major))}`
                : "尚不知任何丹方"
            }}
          </span>
        </span>
        <span class="shrink-0 text-[11px] text-ink-faint">›</span>
      </button>

      <!-- 灵草坊(ISS-306):灵石购草 —— 草比石贵,想补哪一品,明码标价(极贵) -->
      <button
        class="card-ink mt-2 flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left active:scale-99"
        @click="marketOpen = true"
      >
        <span
          class="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-jade/85 font-kai text-[15px] text-paper"
          >坊</span
        >
        <span class="min-w-0 flex-1">
          <span class="block t-card">灵草坊</span>
          <span class="block truncate text-[10px] leading-relaxed text-ink-faint">
            灵石买草 · 凡品 {{ formatGN(herbBuyPrice(1)) }} 灵石一株,道品
            {{ formatGN(herbBuyPrice(5)) }} 灵石一株
          </span>
        </span>
        <span class="shrink-0 text-[11px] text-ink-faint">买 ›</span>
      </button>

      <!-- 丹匣:格子只给图标、名号与存量,详情看弹窗 -->
      <div v-if="pillRows.length" class="mt-3 grid grid-cols-4 gap-2">
        <ItemCell
          v-for="row in pillRows"
          :key="row.def!.id"
          :icon="row.def!.icon"
          :name="row.def!.name"
          :tone="qualityDef(row.def!.quality).color"
          :foot="`×${row.count}`"
          :label="`${qualityDef(row.def!.quality).name}·${row.def!.name} · 存 ${row.count}`"
          @open="pillDetail = row.def!.id"
        />
      </div>
      <p v-else class="empty-note mt-10 text-center text-[11px] text-ink-faint">
        丹匣空空,去藏经阁参悟丹方,或去坊市收购几株灵草
      </p>
    </template>

    <!-- 材料 -->
    <template v-else-if="tab === 'material'">
      <!--
        六格材料原先混成一排:灵草/玄铁/残页/器灵尘/悟道点/灵石,彼此的用途
        差得很远(前三样进炉子,后三样进账本)。分两组,各带一行说明 ——
        找「炼丹要什么」与「我还有多少底子」是两件事。
      -->
      <p class="mt-3 px-1 text-[11px] text-ink-faint">炼制之材 · 进炉子</p>
      <div class="mt-1.5 grid grid-cols-4 gap-2">
        <ItemCell
          v-for="m in craftMaterials"
          :key="m.key"
          :icon="m.icon"
          :name="m.name"
          plain
          :icon-class="m.color"
          :foot="m.display"
          :label="`${m.name} ${m.display}`"
          @open="materialDetail = m.key"
        />
      </div>
      <p class="mt-3 px-1 text-[11px] text-ink-faint">修行所积 · 进账本</p>
      <div class="mt-1.5 grid grid-cols-4 gap-2">
        <ItemCell
          v-for="m in stockMaterials"
          :key="m.key"
          :icon="m.icon"
          :name="m.name"
          plain
          :icon-class="m.color"
          :foot="m.display"
          :label="`${m.name} ${m.display}`"
          @open="materialDetail = m.key"
        />
      </div>
    </template>

    <!-- 法宝 -->
    <template v-else>
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
        <div v-for="row in artifactRows" :key="row.def.id" class="card-ink px-4 py-3">
          <div class="flex items-center gap-2">
            <GameIcon
              :name="row.def.icon"
              :size="18"
              :style="{ color: qualityDef(row.def.quality).color }"
            />
            <span
              class="font-kai text-[14px]"
              :style="{ color: qualityDef(row.def.quality).color }"
              >{{ row.def.name }}</span
            >
            <QualityTag :quality="row.def.quality" />
            <!-- 「重」而不是「阶」:阶是地界与装备层级的词,法宝这一头说的是祭炼了几重 -->
            <span class="ml-auto tabular text-[11px] text-gold-ink">{{
              artifactLevelLabel(row.owned.level)
            }}</span>
          </div>
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
          <p
            v-if="row.upCost && !row.upAffordable"
            class="mt-1.5 text-[10px] text-cinnabar tabular"
          >
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

    <!-- 丹药详情 -->
    <BaseModal
      :open="currentPill !== null"
      :title="currentPill?.def?.name ?? ''"
      @close="pillDetail = null"
    >
      <template v-if="currentPill?.def">
        <div class="flex items-center gap-3">
          <span
            class="grid h-12 w-12 shrink-0 place-items-center rounded-md"
            :style="{
              color: qualityDef(currentPill.def.quality).color,
              background: colorWithAlpha(qualityDef(currentPill.def.quality).color, 0.08),
            }"
          >
            <GameIcon :name="currentPill.def.icon" :size="24" />
          </span>
          <div class="min-w-0">
            <p class="text-[11px]" :style="{ color: qualityDef(currentPill.def.quality).color }">
              {{ qualityDef(currentPill.def.quality).name }}
            </p>
            <p class="text-[11px] text-ink-faint tabular">持有 ×{{ currentPill.count }}</p>
          </div>
        </div>
        <p class="mt-3 t-body text-ink-soft">{{ currentPill.def.desc }}</p>
        <!-- 效果与来路:丹药卡片此前只有风味与数量,服下去会怎样一个字都没说 -->
        <p class="mt-2 whitespace-pre-line text-[11px] leading-relaxed text-qing">
          {{ pillFuncText(currentPill.def) }}
        </p>
        <p v-if="pillMasteryText(currentPill.def.id)" class="mt-1 text-[11px] text-ink-faint">
          {{ pillMasteryText(currentPill.def.id) }}
        </p>
        <!--
          服前把叠层/将顶摊明(与修行快捷卡同口径 buffOverflowOf):增益丹顶满再吃 = 白费,
          usePill 在 full 也照吃,不能等服后 toast 才明白 —— 决策就地可见。
        -->
        <p
          v-if="currentPillHint"
          class="mt-1 text-[11px]"
          :class="
            currentPillHint.tone === 'cinnabar'
              ? 'text-cinnabar'
              : currentPillHint.tone === 'amber'
                ? 'text-amber-ink'
                : 'text-ink-faint'
          "
        >
          {{ currentPillHint.text }}
        </p>
      </template>
      <template #footer>
        <div class="flex gap-2">
          <!-- 即时丹才许连服:增益丹药力一顶后面全白吃,不挂批量按钮(涉策 buffOverflowOf) -->
          <button v-if="canBatchPill" class="btn-ghost flex-1" @click="onUsePillBatch()">
            连服 ×{{ PILL_BATCH }}
          </button>
          <button
            class="btn-seal flex-1"
            :disabled="currentPillOverflow === 'full'"
            @click="onUsePill()"
          >
            服 用
          </button>
        </div>
      </template>
    </BaseModal>

    <!-- 材料详情 -->
    <BaseModal
      :open="currentMaterial !== null"
      :title="currentMaterial?.name ?? ''"
      @close="materialDetail = null"
    >
      <template v-if="currentMaterial">
        <div class="flex items-center gap-3">
          <span class="grid h-12 w-12 shrink-0 place-items-center rounded-md bg-ink/5">
            <GameIcon :name="currentMaterial.icon" :size="24" :class="currentMaterial.color" />
          </span>
          <div class="min-w-0">
            <p class="font-kai text-[15px] text-ink tabular">{{ currentMaterial.full }}</p>
            <p class="text-[10px] text-ink-faint">现有</p>
          </div>
        </div>
        <!--
          灵草五品:总读数归一堆,看不出这一品的方子够不够。逐品列出持有 ——
          与炼丹头 / 灵草坊同一套分档读数(herbGradeHeld / herbOf 同源)。
        -->
        <template v-if="currentMaterial.key === RESOURCE_LABELS.herb">
          <p class="mt-3 text-[10px] text-ink-faint">分品持有</p>
          <div class="mt-1 flex flex-wrap gap-1.5">
            <span
              v-for="g in HERB_GRADES"
              :key="g"
              class="chip-ink !py-0.5 !px-2 !text-[10px] tabular"
              :class="herbGradeHeld(g) > 0 ? 'text-jade' : 'text-ink-faint'"
              :title="HERB_GRADE_NAMES[g]"
            >
              {{ HERB_GRADE_SHORT[g] }} {{ herbGradeHeld(g) }}
            </span>
          </div>
        </template>
        <p class="mt-3 t-body text-ink-soft">{{ currentMaterial.desc }}</p>
      </template>
      <template #footer>
        <button class="btn-seal w-full" @click="materialDetail = null">收 起</button>
      </template>
    </BaseModal>

    <!-- 灵草坊(ISS-306):灵石购草 —— 五品明码标价,只进不出 -->
    <BaseModal :open="marketOpen" title="灵草坊" @close="marketOpen = false">
      <p class="mb-3 t-body text-ink-faint">
        灵石买草,童叟无欺。<span class="text-ink-soft">草比石贵</span>——凡品
        {{ formatGN(herbBuyPrice(1)) }} 灵石一株, 道品
        {{ formatGN(herbBuyPrice(5)) }}
        灵石一株,越往上是十倍一翻。大把闲石没处去时,这里有一炉高品的念想。
      </p>
      <div class="space-y-1.5">
        <div
          v-for="row in marketRows"
          :key="row.grade"
          class="flex items-center gap-2.5 rounded-md bg-paper-deep/70 px-3 py-2"
        >
          <span
            class="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-jade/85 font-kai text-[14px] text-paper"
            >{{ row.grade }}</span
          >
          <div class="min-w-0 grow">
            <p class="font-kai text-[14px] text-ink">{{ row.name }}</p>
            <p class="text-[10px] text-ink-faint tabular">
              持有 {{ row.held }} · 单价 {{ formatGN(row.price) }} 灵石
            </p>
            <!-- 落处:买错品=大额沉没。「草比石贵」十倍一翻,先把这品草喂谁的方子摆出来 -->
            <p class="text-[10px] text-qing">{{ row.usage }}</p>
            <!--
              付不起就把缺摆出来:买十的门槛是十株的价,值与买一口径同源 ——
              一盏灰灯不告诉差多少等于没说完(法宝炼化同款句式)。
            -->
            <p v-if="!row.affordable" class="mt-0.5 text-[10px] text-cinnabar tabular">
              尚差 {{ formatGN(row.short) }} 石
            </p>
            <p v-else-if="!row.affordable10" class="mt-0.5 text-[10px] text-cinnabar tabular">
              尚差 {{ formatGN(row.short10) }} 石 · 买十株
            </p>
          </div>
          <button
            class="btn-seal shrink-0 !px-3 !py-1.5 !text-[11px]"
            :disabled="!row.affordable"
            @click="buyOne(row.grade)"
          >
            买1
          </button>
          <button
            class="btn-seal shrink-0 !px-3 !py-1.5 !text-[11px]"
            :disabled="!row.affordable10"
            @click="buyTen(row.grade)"
          >
            买10
          </button>
        </div>
      </div>
      <p class="mt-3 text-[10px] leading-relaxed text-ink-faint">
        灵石不够的品阶按钮会沉下去 —— 那就去历练,别硬买。
      </p>
      <template #footer>
        <button class="btn-seal w-full" @click="marketOpen = false">收 市</button>
      </template>
    </BaseModal>

    <!-- 开炉炼丹:弹窗本体在 BrewingDialog,炉前的账在 useBrewing(两处同源) -->
    <BrewingDialog
      :open="craftOpen"
      @close="craftOpen = false"
      @open-herb-shop="marketOpen = true"
    />

    <!-- 部位候选列表 -->
    <BaseModal
      :open="pickerSlot !== null"
      :title="pickerSlot ? EQUIP_SLOT_NAMES[pickerSlot] : ''"
      @close="pickerSlot = null"
    >
      <div v-if="pickerRows.length" class="space-y-1.5">
        <div
          v-for="row in pickerRows"
          :key="row.item.uid"
          class="flex items-center gap-2.5 rounded-md px-2.5 py-2"
          :class="row.equipped ? 'bg-jade/10' : 'bg-paper-deep/70'"
        >
          <GameIcon
            :name="row.template.icon"
            :size="16"
            :style="{ color: qualityDef(row.item.quality).color }"
          />
          <button
            class="min-w-0 grow text-left active:opacity-70"
            @click="openDetail(row.item.uid)"
          >
            <span
              class="block truncate font-kai text-[14px]"
              :style="{ color: qualityDef(row.item.quality).color }"
            >
              {{ row.template.name }}
              <template v-if="row.item.level > 0">+{{ row.item.level }}</template>
            </span>
            <span class="block text-[10px] text-ink-faint">
              <!-- 条数带分母:这一件还剩多少条可涨,一眼看得出(上限来自品质表) -->
              {{ qualityDef(row.item.quality).name }} · {{ row.item.tier }} 阶 · 词条
              {{ row.item.affixes.length }}/{{ qualityDef(row.item.quality).affixes[1] }}
            </span>
          </button>
          <!--
            换装决策的行级读数:这一件跟身上那件差多少战力,picker 层就该看见 ——
            不用每件点开详情才知道值不值得换(与人物页战力同一个数,pScore 线性差)。
          -->
          <span
            v-if="row.delta !== null"
            class="shrink-0 text-[10px] tabular"
            :class="row.deltaCls"
            :title="`vs 当前佩戴:${row.deltaText}`"
            >{{ row.deltaText }}</span
          >
          <button
            v-if="row.equipped"
            class="btn-ghost shrink-0 !px-2.5 !py-1 !text-[11px]"
            @click="unequipSlot()"
          >
            卸下
          </button>
          <button
            v-else
            class="btn-seal shrink-0 !px-2.5 !py-1 !text-[11px]"
            @click="equipItem(row.item.uid)"
          >
            换上
          </button>
        </div>
      </div>
      <p v-else class="py-8 text-center text-[11px] text-ink-faint">
        此部位尚无藏品,去历练中寻些机缘吧
      </p>
      <p class="mt-2 text-center text-[10px] text-ink-faint">点名称可查看详情与对比</p>
    </BaseModal>

    <!-- 一键分解:勾选品质(记忆勾选) -->
    <BaseModal :open="decomposeOpen" title="一键分解" @close="decomposeOpen = false">
      <!--
        这段文案此前承诺了两件事(手动筛选 + 自动回收),于是和「智能收纳」的保留线打架:
        玩家把保留线设在灵品,却因为这里勾过玄品而被自动扔掉玄品。现在这一页只管手动那一次。
      -->
      <p class="t-body text-ink-faint">
        勾选要分解的品质,已佩戴与上锁的装备不受影响。勾选会被记住,但<b class="text-ink"
          >只管这一页的手动分解</b
        >
        —— 掉落时的自动去留由「智能收纳」说了算(见上一页):那里定的「此品质起一律保留」是硬承诺,
        这里的勾选压不动它。
      </p>
      <div class="mt-2 space-y-1">
        <label
          v-for="row in decomposeRows"
          :key="row.rank"
          class="flex items-center gap-2.5 rounded-md px-2.5 py-1.5"
          :class="settings.decomposeRanks.includes(row.rank) ? 'bg-paper-deep/80' : ''"
        >
          <input
            type="checkbox"
            class="h-4 w-4 accent-cinnabar"
            :checked="settings.decomposeRanks.includes(row.rank)"
            @change="toggleRank(row.rank)"
          />
          <span class="font-kai text-[14px]" :style="{ color: row.color }">{{ row.name }}</span>
          <span class="ml-auto tabular text-[11px] text-ink-faint">
            现存 {{ row.count }} 件
            <template v-if="row.count > 0">· {{ row.text }}</template>
          </span>
        </label>
      </div>
      <p v-if="decomposeTotal > 0" class="mt-2 text-right text-[11px] text-cinnabar tabular">
        共 {{ decomposeTotal }} 件 → {{ batchYieldText(decomposePlanned) }}
      </p>
      <template #footer>
        <button class="btn-seal w-full" :disabled="decomposeTotal === 0" @click="confirmDecompose">
          分 解{{ decomposeTotal > 0 ? `(${decomposeTotal} 件)` : "" }}
        </button>
      </template>
    </BaseModal>

    <!-- 智能收纳弹窗入口共用分解弹窗下方 -->
    <BaseModal :open="smartOpen" title="智能收纳" @close="smartOpen = false">
      <p class="t-body text-ink-faint">
        开启后,新掉落先过智能裁决:无缘之物直接化尘不入包;行囊满时,值得收藏的新件会挤掉包内最弱的无缘旧物(品质低的先走,同档看层级与词条)。识别不只看品质:流派核心词条、组合技部件、成套共鸣件、条条近满的词条都算值得留。
      </p>
      <p class="mt-1 t-body text-ink-faint">
        你强化过、重铸过、封存过词条的件,自动收纳一律不动 ——
        要扔得你自己动手(单件分解,或勾选该品质的一键分解)。
      </p>
      <label class="mt-2 flex items-center justify-between py-1.5">
        <span class="text-[14px] text-ink-soft">启用智能收纳</span>
        <input
          v-model="settings.smartKeep.enabled"
          type="checkbox"
          class="h-4 w-4 accent-cinnabar"
        />
      </label>
      <!--
        品质下限:九档全给(凡→神)。从前只列灵/玄/地三档,于是"想更严一点"无处可选 ——
        而玩家真正想说的常常是"天品以下都别留"。
      -->
      <div class="py-1.5">
        <div class="flex items-baseline justify-between">
          <span class="text-[11px] text-ink-soft">此品质起一律保留</span>
          <span class="text-[10px] text-ink-faint">低于它才交给缘分裁决</span>
        </div>
        <!-- 选中的档位只靠 borderColor 表达,读屏需要显式的按压态(与 SettingsView 的 theme/battleSpeed 同一范式) -->
        <div class="mt-1.5 flex flex-wrap gap-1" role="group" aria-label="品质保留线">
          <button
            v-for="q in KEEP_QUALITY_CHOICES"
            :key="q.rank"
            class="chip-ink"
            :aria-pressed="settings.smartKeep.minQuality === q.rank"
            :style="
              settings.smartKeep.minQuality === q.rank
                ? { color: q.color, borderColor: q.color }
                : {}
            "
            :class="settings.smartKeep.minQuality === q.rank ? '' : 'border-ink/25 text-ink-faint'"
            @click="settings.smartKeep.minQuality = q.rank"
          >
            {{ q.name }}
          </button>
        </div>
      </div>
      <!--
        阶级下限:与品质下限是两条独立的废料定义 —— 品质管"这件成色如何",
        阶级管"这是哪一界的旧物"。它是无条件回收(不看缘分),所以给足读数与警示。
      -->
      <div class="py-1.5">
        <div class="flex items-baseline justify-between">
          <span class="text-[11px] text-ink-soft">此阶以下一律回收</span>
          <span
            class="text-[10px]"
            :class="settings.smartKeep.minTier > 0 ? 'text-cinnabar' : 'text-ink-faint'"
          >
            {{
              settings.smartKeep.minTier > 0
                ? `低于 ${settings.smartKeep.minTier} 阶:不问缘分`
                : "未启用"
            }}
          </span>
        </div>
        <div class="mt-1.5 flex items-center gap-2" role="group" aria-label="此阶以下回收的下限">
          <button
            class="chip-ink !px-3"
            :disabled="settings.smartKeep.minTier <= 0"
            aria-label="降低回收下限"
            @click="bumpMinTier(-1)"
          >
            −
          </button>
          <span class="tabular w-14 text-center font-kai text-[15px] text-ink">
            {{ settings.smartKeep.minTier > 0 ? `${settings.smartKeep.minTier} 阶` : "关" }}
          </span>
          <button
            class="chip-ink !px-3"
            :disabled="settings.smartKeep.minTier >= 32"
            aria-label="提高回收下限"
            @click="bumpMinTier(1)"
          >
            ＋
          </button>
          <span class="ml-1 text-[10px] text-ink-faint"> 你当前可到 {{ playerTier }} 阶 </span>
        </div>
      </div>
      <!--
        「线下不看缘分」:承接从前藏在「一键分解」里的那股需求(显式废料声明),
        但把它收回政策弹窗、并排在保留线之后 —— 线上的件永远不受它影响。
      -->
      <label class="flex items-center justify-between py-1.5">
        <span class="text-[11px] text-ink-soft">
          线下不看缘分,一律回收
          <span class="block text-[10px] text-ink-faint"
            >低于保留线的件不再由核心词条/套件救回</span
          >
        </span>
        <input
          v-model="settings.smartKeep.junkBelowLine"
          type="checkbox"
          class="h-4 w-4 accent-cinnabar"
        />
      </label>
      <!--
        读数:按**当前**规则体检行囊 —— 收纳最吓人的地方是"看不见",
        所以这里摊开"会扔几件、各因哪条规则",调开关时数字跟着动。
      -->
      <div
        v-if="settings.smartKeep.enabled"
        class="mt-1 rounded-md bg-paper-deep/60 px-2.5 py-2 text-[10px]"
      >
        <p class="text-ink-soft tabular">
          依当前规则:行囊 {{ impact.candidates }} 件中留 {{ impact.keep }} 件 · 化尘
          {{ impact.recycle }} 件
        </p>
        <p
          v-for="row in impact.byReason"
          :key="row.reason"
          class="mt-0.5 flex justify-between tabular"
        >
          <span class="text-ink-faint">{{ row.reason }}</span>
          <span class="text-cinnabar">{{ row.count }} 件</span>
        </p>
        <p v-if="impact.byReason.length === 0" class="mt-0.5 text-ink-faint">
          眼下没有会被自动判掉的件
        </p>
      </div>
      <label class="flex items-center justify-between py-1.5">
        <span class="text-[11px] text-ink-soft">保留主流派核心词条件</span>
        <input
          v-model="settings.smartKeep.keepCoreAffix"
          type="checkbox"
          class="h-4 w-4 accent-cinnabar"
        />
      </label>
      <label class="flex items-center justify-between py-1.5">
        <span class="text-[11px] text-ink-soft">保留组合技部件(副体系词条)</span>
        <input
          v-model="settings.smartKeep.keepComboPiece"
          type="checkbox"
          class="h-4 w-4 accent-cinnabar"
        />
      </label>
      <label class="flex items-center justify-between py-1.5">
        <span class="text-[11px] text-ink-soft">保留成套共鸣件(机制优先)</span>
        <input
          v-model="settings.smartKeep.keepSetPiece"
          type="checkbox"
          class="h-4 w-4 accent-cinnabar"
        />
      </label>
      <label class="flex items-center justify-between py-1.5">
        <span class="text-[11px] text-ink-soft">保留词条近满件</span>
        <input
          v-model="settings.smartKeep.keepPerfectRolls"
          type="checkbox"
          class="h-4 w-4 accent-cinnabar"
        />
      </label>
      <template #footer>
        <!-- 一键清理二步确认:整包报废,按一下不该就此了结 -->
        <template v-if="!cleanConfirm">
          <button class="btn-ghost w-full !text-[11px]" @click="cleanConfirm = true">
            依此规则清理行囊(未锁定的无缘之物化尘)
          </button>
        </template>
        <template v-else>
          <p class="mb-2 text-center text-[11px] text-cinnabar">
            将把行囊中未锁定的无缘之物尽数化尘,共 {{ cleanPlanned.count }} 件,拿回
            {{ batchYieldText(cleanPlanned) }}——此举不可逆,仍要清理?
          </p>
          <div class="flex gap-2">
            <button class="btn-ghost flex-1 !text-[11px]" @click="cleanConfirm = false">
              再想想
            </button>
            <button class="btn-seal flex-1 !text-[11px]" @click="smartClean()">清理化尘</button>
          </div>
        </template>
      </template>
    </BaseModal>
  </div>
</template>

<script setup lang="ts">
import { computed, onUnmounted, ref } from "vue";
import { useInventoryStore } from "@/stores/inventory";
import { useResourcesStore } from "@/stores/resources";
import { add, gn, gnZero, toNum } from "@/utils/gnum";
import { usePlayerStore } from "@/stores/player";
import { useUiStore } from "@/stores/ui";
import { useSettingsStore } from "@/stores/settings";
import { useCultivationStore } from "@/stores/cultivation";
import { qualityDef, QUALITIES } from "@/data/qualities";
import { pillDef } from "@/data/pills";
import { activeBuffsOf, buffOverflowOf, buffStackCount } from "@/core/engineBuffs";
import type { BuffOverflow } from "@/core/engineBuffs";
import {
  HERB_GRADES,
  HERB_GRADE_NAMES,
  HERB_GRADE_SHORT,
  herbBuyPrice,
  herbGradeBandLabel,
  herbGradeOfMajor,
  type HerbGrade,
} from "@/data/herbGrades";
import { buyHerbs } from "@/core/herbMarketService";
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
import { EQUIP_SLOT_NAMES, equipmentTemplate } from "@/data/equipment";
import { BAG_CAPACITY } from "@/data/constants";
import { RESOURCE_LABELS } from "@/data/resourceNames";
import { PILL_BATCH, usePill, usePillBatch } from "@/core/pillService";
import {
  batchYieldText,
  decomposeBatch,
  decomposeByRanks,
  decomposePreview,
  artifactUpCost,
  upgradeArtifact,
} from "@/core/forge";
import { equipAllBest, equipSetCombo, equippablePower } from "@/core/equipBest";
import { salvageOf } from "@/core/salvage";
import { smartKeepImpact, smartRecycleTargets } from "@/core/smartKeep";
import { maxTierForMajor } from "@/data/regions";
import { equipSetDef, setCounts, type EquipSetDef } from "@/core/equipSet";
import { useLoreStore } from "@/stores/lore";
import {
  cnNumber,
  formatGN,
  formatExact,
  formatNum,
  formatPercent,
  formatSignedPercent,
} from "@/utils/format";
import { STAT_NAMES } from "@/ui/statNames";
import { colorWithAlpha } from "@/ui/colorVar";
import type { AnyStatKey, EquipSlot, EquipmentInstance } from "@/types";
import SectionTitle from "@/components/common/SectionTitle.vue";
import InkTabs from "@/components/common/InkTabs.vue";
import GameIcon from "@/components/common/GameIcon.vue";
import QualityTag from "@/components/common/QualityTag.vue";
import BaseModal from "@/components/common/BaseModal.vue";
import EquipmentCard from "@/components/equipment/EquipmentCard.vue";
import ItemCell from "@/components/common/ItemCell.vue";
import BrewingDialog from "@/components/inventory/BrewingDialog.vue";
import { useBrewing } from "@/composables/useBrewing";

const inventory = useInventoryStore();
// 「新」角标清账时机 = 离开背包那一刻(路由无 keep-alive,离开即卸载):
// 若在挂载时清,首帧会把刚渲染出来的「新」立刻抹掉,玩家看不见哪个是新入包的。
// 挂着背包的整段看下来,离开时才把这一批记为已见 —— 下次进背包,新角标只归
// 这次离包之后新入的那几件(见 inventorySeen.spec)。
onUnmounted(() => inventory.markInventorySeen());
const resources = useResourcesStore();
const ui = useUiStore();
const player = usePlayerStore();
const settings = useSettingsStore();

// 开炉炼丹:页面只管开关(craftOpen)与跳灵草坊(marketOpen),炉前的账全在 useBrewing
// —— 页面与 BrewingDialog 同源调用,不许另抄一份 computed(两份定义 = 两本账)。
// 页面只解构自己用到的那几样(丹方总数 / 逐品持有 / 效果文案);其余成员弹窗专用。
const { herbGradeHeld, recipes, pillFuncText } = useBrewing();

// 灵草坊(ISS-306):灵石购草 —— 五品明码标价,一次或十株,灵石够才成
const marketOpen = ref(false);
const marketRows = computed(() =>
  HERB_GRADES.map((g) => {
    const price = herbBuyPrice(g);
    return {
      grade: g,
      name: HERB_GRADE_NAMES[g],
      held: resources.herbOf(g),
      // 这品草喂哪个境界的方子:十倍一翻的贵价,落处得写明白(读分档表,不另写)
      usage: herbGradeBandLabel(g),
      price, // 单价 :number,模板里走 formatGN 排版(千→「1,000」,万→「1000万」)
      // 可买性与购入口径同款(hasStone = buyHerbs 的判定);买十是十株的门槛,
      // 拿单株价放行只会出现「买10 亮着、点了才弹灵石不足」(曾真这么坏过)
      affordable: resources.hasStone(gn(price)),
      affordable10: resources.hasStone(gn(price * 10)),
      // 尚差:灰按钮不告诉差多少等于没说完(法宝炼化同款句式)
      short: Math.max(0, price - toNum(resources.spiritStone)),
      short10: Math.max(0, price * 10 - toNum(resources.spiritStone)),
    };
  }),
);
/** 某品灵草的持有量(herbGradeHeld)在 useBrewing —— 灵草坊与开炉头同源逐品读数 */

function buyOne(grade: HerbGrade) {
  const r = buyHerbs(grade, 1);
  if (r.ok)
    ui.toast(
      `灵草坊:花 ${formatGN(r.costPerHerb)} 灵石,得 ${HERB_GRADE_SHORT[grade]}灵草×${r.herbs}`,
      "info",
    );
  else if (r.reason === "noStone") ui.toast("灵石不足", "warn");
}
function buyTen(grade: HerbGrade) {
  const r = buyHerbs(grade, 10);
  if (r.ok)
    ui.toast(
      `灵草坊:花 ${formatGN(r.costPerHerb * 10)} 灵石,得 ${HERB_GRADE_SHORT[grade]}灵草×${r.herbs}`,
      "info",
    );
  else if (r.reason === "noStone") ui.toast("灵石不足", "warn");
}
const lore = useLoreStore();

type Tab = "equip" | "pill" | "material" | "artifact";
const tab = ref<Tab>("equip");

const TABS: { id: Tab; label: string }[] = [
  { id: "equip", label: "装备" },
  { id: "pill", label: "丹药" },
  { id: "material", label: "材料" },
  { id: "artifact", label: "法宝" },
];

// ---- 装备:部位槽 + 部位候选列表 ----
const SLOTS: EquipSlot[] = [
  "weapon",
  "head",
  "body",
  "wrist",
  "belt",
  "boots",
  "necklace",
  "ring",
  "talisman",
];
const pickerSlot = ref<EquipSlot | null>(null);

/** 装备共鸣:已装备件里的同组计数(未满也列出来,让玩家知道差几件) */
const setRows = computed(() => {
  const counts = setCounts(inventory.equippedItems);
  return [...counts.entries()]
    .map(([id, count]) => {
      const def = equipSetDef(id);
      return def ? { def, count, active: count >= def.required } : null;
    })
    .filter((row): row is { def: EquipSetDef; count: number; active: boolean } => row !== null)
    .sort((a, b) => Number(b.active) - Number(a.active) || b.count - a.count);
});

/** 一键穿最强:换成几件就报几件,没换就说"已是最佳"(与核心同一套不降级口径) */
function wearEquipBest(): void {
  const n = equipAllBest(inventory);
  ui.toast(n > 0 ? `一键换装:换上 ${n} 件` : "已是最佳,无需更动", n > 0 ? "success" : "info");
}

/** 穿齐某套:换成几件报几件;已穿更强的不动,幂等 */
function wearSetOf(setId: string): void {
  const n = equipSetCombo(inventory, setId);
  ui.toast(n > 0 ? `穿齐共鸣:换上 ${n} 件` : "此套已是最佳,无需更动", n > 0 ? "success" : "info");
}

const slotRows = computed(() =>
  SLOTS.map((slot) => {
    const uid = inventory.equipped[slot];
    const item = uid ? inventory.findItem(uid) : undefined;
    return {
      slot,
      name: EQUIP_SLOT_NAMES[slot],
      item,
      template: item ? equipmentTemplate(item.templateId) : undefined,
      stock: inventory.bagItems.filter((it) => equipmentTemplate(it.templateId)?.slot === slot)
        .length,
    };
  }),
);

/** 全部藏品(含佩戴中),按品质/层级降序 */
const allItems = computed(() =>
  inventory.items
    .map((item) => ({ item, equipped: inventory.equippedUids.has(item.uid) }))
    .sort((a, b) => {
      const dq = qualityDef(b.item.quality).rank - qualityDef(a.item.quality).rank;
      return dq !== 0 ? dq : b.item.tier - a.item.tier;
    }),
);

/** 当前部位的候选:佩戴中的置顶,其余按品质/层级降序 */
const pickerRows = computed(() => {
  const slot = pickerSlot.value;
  if (!slot) return [];
  const equippedUid = inventory.equipped[slot];
  // 这一槽当下的佩戴件 —— 每个候选的「战 ±N」都与它比(powerScore 是线性合计,
  // 换装的战力差 = 新件三围分 − 旧件三围分,与人物页战力同一个数,无需重算总属性)
  const occupant = equippedUid ? inventory.items.find((i) => i.uid === equippedUid) : undefined;
  // 战力差要走真实战力(平铺 × 词条%、会心联乘),与「一键穿最强」equippablePower 同源;
  // 只比三围会让一件平铺高、零词条的件压过满掷暴击/吸血的件,列表数字与实穿打架
  const powerOf = (i: EquipmentInstance): number => equippablePower(i);
  return inventory.items
    .map((item) => ({ item, template: equipmentTemplate(item.templateId) }))
    .filter(
      (
        row,
      ): row is {
        item: (typeof inventory.items)[number];
        template: NonNullable<ReturnType<typeof equipmentTemplate>>;
      } => !!row.template && row.template.slot === slot,
    )
    .map((row) => {
      const equipped = row.item.uid === equippedUid;
      // 佩戴中底行不报差(它自己就是基线);空槽的候选也不报(皆收益,无对比对象)
      const delta = !equipped && occupant ? powerOf(row.item) - powerOf(occupant) : null;
      const deltaText =
        delta === null
          ? ""
          : delta > 0
            ? `战 +${formatGN(Math.round(delta))}`
            : delta < 0
              ? `战 -${formatGN(Math.round(-delta))}`
              : "战 同";
      const deltaCls =
        delta === null
          ? ""
          : delta > 0
            ? "text-jade"
            : delta < 0
              ? "text-cinnabar"
              : "text-ink-faint";
      return { ...row, equipped, delta, deltaText, deltaCls };
    })
    .sort((a, b) => {
      if (a.equipped !== b.equipped) return Number(b.equipped) - Number(a.equipped);
      const dq = qualityDef(b.item.quality).rank - qualityDef(a.item.quality).rank;
      return dq !== 0 ? dq : b.item.tier - a.item.tier;
    });
});

function equipItem(uid: string): void {
  if (pickerSlot.value) inventory.equip(uid, pickerSlot.value);
}

function unequipSlot(): void {
  if (pickerSlot.value) inventory.unequip(pickerSlot.value);
}

function openDetail(uid: string): void {
  ui.equipDetailUid = uid;
}

const pillRows = computed(() =>
  Object.entries(inventory.pills)
    .map(([id, count]) => ({ def: pillDef(id), count }))
    .filter((x) => x.def !== undefined && x.count > 0)
    .sort((a, b) => qualityDef(b.def!.quality).rank - qualityDef(a.def!.quality).rank),
);

// 修行 store:丹药详情的服前判定(buffOverflowOf)与增益叠数要读当前 buff;
// 开炉幕的炼丹增益(alchemyBuffRows)也用它,如今在 useBrewing 里自取同一单例。
const cult = useCultivationStore();

/**
 * 材料的图标色 —— 一律走色板真类,且各按物性给色:
 * 灵草(木性)、玄铁(金性)、残页与悟道点(文墨)、器灵尘(器)、灵石(金贵)。
 * 曾经六格全是 ink-soft,格子里的图标只剩「黑白剪影」一种身份,
 * 于是四列格子最大的那块面积(图标)不承担任何识别功能。
 */
const materialRows = computed(() => [
  {
    icon: "leaf",
    name: RESOURCE_LABELS.herb,
    desc: "炼丹的根本",
    value: resources.herb,
    color: "text-jade",
  },
  {
    icon: "mountain",
    name: RESOURCE_LABELS.ore,
    desc: "筑造与炼器之材",
    value: resources.ore,
    color: "text-ink-soft",
  },
  {
    icon: "scroll",
    name: RESOURCE_LABELS.page,
    desc: "集残页可参悟功法",
    value: resources.page,
    color: "text-qing",
  },
  {
    icon: "sparkles",
    name: RESOURCE_LABELS.dust,
    desc: "强化装备的灵性之尘",
    value: resources.dust,
    color: "text-violet-ink",
  },
  {
    icon: "book",
    name: RESOURCE_LABELS.wudao,
    desc: "功法进修与法宝炼化所需",
    value: resources.wudao,
    color: "text-cinnabar",
  },
]);

/** 材料格子:含灵石一并展示,数量走 formatNum 免得格子被长数字撑破 */
const materialGrid = computed(() => [
  ...materialRows.value.map((m) => ({
    key: m.name,
    icon: m.icon,
    name: m.name,
    desc: m.desc,
    color: m.color,
    display: formatNum(m.value),
    full: String(m.value),
  })),
  {
    key: "灵石",
    icon: "gem",
    name: "灵石",
    desc: "修行界的通行货币",
    color: "text-gold-ink",
    display: formatGN(resources.spiritStone),
    full: formatGN(resources.spiritStone),
  },
]);

const materialDetail = ref<string | null>(null);
/**
 * 材料页的两组。分组的依据是**用途**而不是数量:前三样投进炼丹炉与炼器,
 * 后三样是账面上的积余(器灵尘/悟道点/灵石)。找「炼丹要什么」与
 * 「我还有多少底子」是两个问题,混成一排时两样都得从头找一遍。
 *
 * 组名一律读 RESOURCE_LABELS —— 手写字符串会在改全称时静默落空
 * (分组悄悄变空,而页面照常渲染,不会有人发现)。
 */
const CRAFT_KEYS: string[] = [
  RESOURCE_LABELS.herb,
  RESOURCE_LABELS.ore,
  RESOURCE_LABELS.dust,
  RESOURCE_LABELS.page,
];
const craftMaterials = computed(() =>
  materialGrid.value.filter((m) => CRAFT_KEYS.includes(m.name)),
);
const stockMaterials = computed(() =>
  materialGrid.value.filter((m) => !CRAFT_KEYS.includes(m.name)),
);
const currentMaterial = computed(
  () => materialGrid.value.find((m) => m.key === materialDetail.value) ?? null,
);

const pillDetail = ref<string | null>(null);
const currentPill = computed(() =>
  pillDetail.value ? (pillRows.value.find((r) => r.def?.id === pillDetail.value) ?? null) : null,
);

/**
 * 增益丹服前判定(与修行快捷卡同口径 buffOverflowOf,不另造判据):
 * full=顶满再服即白费,partial=贴着上限只续到顶。
 * 抽成独立 computed,让「服 用」按钮在 full 态一并置灰 —— 灰的同时
 * currentPillHint 已把拦因摊出来,仍走「白费也照吃不误」就说不通了。
 */
const currentPillOverflow = computed<BuffOverflow | null>(() => {
  const def = currentPill.value?.def;
  if (!def || def.kind !== "buff" || !def.buffId) return null;
  return buffOverflowOf(cult.buffs, def.buffId, Date.now());
});

const currentPillHint = computed<{ text: string; tone: "cinnabar" | "amber" | "faint" } | null>(
  () => {
    const def = currentPill.value?.def;
    if (!def || def.kind !== "buff" || !def.buffId) return null;
    const overflow = currentPillOverflow.value;
    if (overflow === "full") return { text: "药力已顶满——这一颗将白费", tone: "cinnabar" };
    if (overflow === "partial") return { text: "药力将触上限——这一颗只续到顶", tone: "amber" };
    const now = Date.now();
    const active = activeBuffsOf(cult.buffs, now).find((b) => b.def.id === def.buffId);
    const stack = active ? buffStackCount(def.buffId, active.remainingSec) : 1;
    if (stack <= 1) return null;
    return { text: `已叠 ${stack} 份,服之续时`, tone: "faint" };
  },
);

const craftOpen = ref(false);

/** 服用后若已吃完最后一枚,顺手关掉详情——否则弹窗会停在一个不存在的丹药上 */
function onUsePill(): void {
  const id = pillDetail.value;
  if (!id) return;
  usePill(id);
  if (!pillRows.value.some((r) => r.def?.id === id)) pillDetail.value = null;
}

/** 即时丹才许连服:增益丹药力一顶后面全白吃,不挂批量按钮(涉策 buffOverflowOf) */
const canBatchPill = computed(() => {
  const def = currentPill.value?.def;
  return def ? !def.buffId : false;
});

function onUsePillBatch(): void {
  const id = pillDetail.value;
  if (!id) return;
  usePillBatch(id, PILL_BATCH);
  if (!pillRows.value.some((r) => r.def?.id === id)) pillDetail.value = null;
}

/** 连炼一批与保底披露(craftBatch / batchGuaranteeText)在 useBrewing —— 开炉弹窗专用 */

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

function batchDecompose(): void {
  // 总账那一条由服务自己报(逐件弹提示只会互相顶掉)
  if (decomposeByRanks(settings.decomposeRanks) === 0) ui.toast("无可分解之物", "info");
}

// ---- 一键分解弹窗 ----
const decomposeOpen = ref(false);

/** 各品质档的现存件数与分解返还(与服务同一套算法:弹窗上写多少就是真给多少) */
const decomposeRows = computed(() =>
  QUALITIES.map((q) => {
    const got = decomposePreview([q.rank]);
    return {
      rank: q.rank,
      name: q.name,
      color: q.color,
      count: got.count,
      text: batchYieldText(got),
    };
  }),
);

const decomposeTotal = computed(() =>
  decomposeRows.value
    .filter((r) => settings.decomposeRanks.includes(r.rank))
    .reduce((sum, r) => sum + r.count, 0),
);

/** 已勾选那几档的总账 */
const decomposePlanned = computed(() => decomposePreview(settings.decomposeRanks));

function toggleRank(rank: number): void {
  const adding = !settings.decomposeRanks.includes(rank);
  settings.decomposeRanks = adding
    ? [...settings.decomposeRanks, rank].sort((a, b) => a - b)
    : settings.decomposeRanks.filter((r) => r !== rank);
  // 勾选只是「标记该档为废料」——行囊内现存同类不在此刻销毁,待玩家点「分 解」确认。
  // (智能收纳开启后,拾取到该档才会自动回收——那是不占行囊的入包裁决,与行囊内已存之物无关;未开启则照常入包。)
}

function confirmDecompose(): void {
  batchDecompose();
  decomposeOpen.value = false;
}

// ---- 智能收纳 ----
const smartOpen = ref(false);
/**
 * 品质下限的九档全给(凡→神)—— 只列灵/玄/地那三档时,"想更严一点"无处可选。
 * 名字与配色都取自品质表,不在这里另抄一份。
 */
const KEEP_QUALITY_CHOICES = QUALITIES.map((q) => ({ rank: q.rank, name: q.name, color: q.color }));

/** 玩家当前能到的最深层级 —— 给阶级下限一个参照(区域表的唯一口径) */
const playerTier = computed(() => maxTierForMajor(player.major));

function bumpMinTier(delta: number): void {
  settings.smartKeep.minTier = Math.max(0, Math.min(32, settings.smartKeep.minTier + delta));
  cleanConfirm.value = false;
}

/** 按当前规则的体检读数(与裁决同一口径,见 core/smartKeep.smartKeepImpact) */
const impact = computed(() => smartKeepImpact(inventory.bagItems));

/** 待清理件数(确认提示用)—— 与读数同源 */
const cleanCount = computed(() => impact.value.recycle);

/**
 * 待清理的预期收益:与真下手的 smartClean 用同一套目标(未上锁 + 裁决无缘)、
 * 同一份 salvageOf —— 只算不花,把「会拿回多少器灵尘 / 退多少灵石」在按下前摊开
 * (与一键分解的 decomposePreview 同一纪律)。
 */
const cleanPlanned = computed(() => {
  let dust = 0;
  let stone = gnZero();
  for (const it of smartRecycleTargets(inventory.bagItems)) {
    const g = salvageOf(it);
    dust += g.dust;
    stone = add(stone, g.stone);
  }
  return { count: cleanCount.value, dust, stone };
});

/** 清理确认态:按一次按钮先落在「再想想/清理化尘」上 */
const cleanConfirm = ref(false);

function smartClean(): void {
  cleanConfirm.value = false;
  const got = decomposeBatch(smartRecycleTargets(inventory.bagItems));
  ui.toast(
    got.count > 0
      ? `收纳毕:${got.count} 件无缘之物化尘,${batchYieldText(got)}`
      : "行囊中皆是有缘之物",
    "info",
  );
  smartOpen.value = false;
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

/**
 * 丹方读到几分熟 —— 与图鉴的「已得方/通晓」同一份状态(lore.recipeLore)。
 * 无方之丹没有这一行:它本就炼不出来(见 ui/itemText.pillSourceText)。
 */
function pillMasteryText(id: string): string {
  const def = pillDef(id);
  if (!def?.recipe) return "";
  const m = lore.recipeMastery(id);
  if (m <= 0) return "此方尚未到手 —— 去藏经阁翻书,或向师长讨教";
  if (m >= 1) return "此方已通晓:火候节点烂熟于心";
  return `此方已得,熟练 ${formatPercent(m, 0)} —— 多炼几炉便到通晓`;
}
</script>
