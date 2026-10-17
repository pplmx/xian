<template>
  <div class="stagger-in space-y-4 px-4 pb-6 pt-4">
    <!--
      道躯总览 —— 战力是这一页唯一「一个数概括全部」的读数,故它是主角字;
      但它由攻/防/血三项按权重折成,只报那个数等于让人背结论。
      于是把三项按权重摊在同一行,读数与「这数怎么来的」同框而不同级。
    -->
    <div class="card-ink px-4 py-3">
      <!--
        这张卡不设卡名 —— 它原叫「道 躯」,与一屏之下的分区标题撞名。
        卡片题头的作用是「这一张讲什么」,而这张只讲一件事:战力。
        而「战 力」那一行本身就是它的名字,再加一层题头是多余的一层。
        右上角那句话交代折算口径,是这张卡唯一需要的旁注。
      -->
      <div data-value-row class="flex items-baseline justify-between gap-2">
        <span class="text-[11px] tracking-[0.3em] text-ink-faint">战 力</span>
        <span class="font-kai text-[18px] text-cinnabar tabular">
          <TapNumber :value="stats.power" title="战力" :rows="powerDetailRows" />
        </span>
      </div>
      <!--
        折算口径这句旁注**不能**待在主值行里:200% 缩放档的有效视口只有 ~195px,
        「战 力」与这句一起放,主值行当场折成两行(layout-check 报过)。
        主值行只放主读数,旁注自成一行。
      -->
      <p class="mt-0.5 text-right text-[10px] text-ink-faint">攻 · 防 · 血 按权重折算</p>
      <!--
        战力构成 —— 一条按比例分段的横条,不是一个三格数字阵。
        
        由来:这里原先摆着「攻击 45% / 防御 19% / 气血 36%」三枚 15px 楷体数字,
        而一屏之下的「道躯」节又摆着同样三项标签(攻击/防御/气血)的原始值 ——
        同名的三项在一屏里出现两次、都占主角位置,读者第一反应是「重复了」。
        
        职责确实不同(这里是占比、那里是原值),但**不同职责不等于要各占一行大字**:
        占比这件事本来就是「谁撑起了这个数」,一把横条说得比三个百分数更直接,
        而且不再与下方三项撞名同框。
      -->
      <div class="mt-2">
        <div class="flex h-1.5 overflow-hidden rounded-sm" role="img" :aria-label="powerShareLabel">
          <span
            v-for="row in powerDetailRows"
            :key="row.label"
            :style="{ width: `${row.share * 100}%`, background: row.barColor }"
          />
        </div>
        <!-- 图例:小字一行,三项按各自的色点对位 -->
        <p class="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10px] text-ink-faint">
          <span v-for="row in powerDetailRows" :key="row.label" class="flex items-center gap-1">
            <span class="h-1.5 w-1.5 shrink-0 rounded-full" :style="{ background: row.barColor }" />
            {{ row.label }} {{ formatPercent(row.share, 0) }}
          </span>
        </p>
      </div>
      <div class="ink-divider-mark my-3" />
      <!-- 灵根 -->
      <!--
        灵根名必须 nowrap 且不参与收缩:窄屏上「杂灵根」曾被两侧
        (灵根圆环 + ×倍率)挤到只剩 24px 宽,一个字一行竖排下来。
        改成一整行可换行:挤不下时让 ×倍率 落到下一行,而不是把名字压扁。
      -->
      <div class="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span class="shrink-0 font-kai text-[11px] tracking-widest text-ink-faint">灵根</span>
        <span class="shrink-0 whitespace-nowrap font-kai text-[14px] text-cinnabar">{{
          player.linggen?.gradeName
        }}</span>
        <div class="flex shrink-0 gap-1.5">
          <span
            v-for="root in player.linggen?.roots ?? []"
            :key="root.element"
            class="flex flex-col items-center"
            :title="`资质 ${root.aptitude}`"
          >
            <span
              class="grid h-6 w-6 place-items-center rounded-full border text-[11px] font-kai"
              :style="{
                borderColor: ELEMENTS[root.element].color,
                color: ELEMENTS[root.element].color,
              }"
            >
              {{ ELEMENTS[root.element].char }}
            </span>
            <!-- 资质直接亮在圆环下,不再只藏 hover —— 手机上看得到才谈得上权衡 -->
            <span
              class="mt-0.5 text-[10px] leading-none tabular"
              :style="{ color: ELEMENTS[root.element].color }"
            >
              {{ root.aptitude }}
            </span>
          </span>
        </div>
        <span class="ml-auto shrink-0 whitespace-nowrap text-[11px] text-ink-faint tabular">
          ×{{ player.linggen?.growthMult.toFixed(2) }}
        </span>
      </div>
      <!-- 天然牌面(Phase 32.2):转世发下的这张牌决定路好不好走,而非走得多快 -->
      <div v-if="tendencies.length" class="mt-2 space-y-1">
        <p
          v-for="t in tendencies"
          :key="t.element"
          class="flex gap-1.5 t-body text-ink-faint"
        >
          <span class="shrink-0 font-kai" :style="{ color: ELEMENTS[t.element].color }">{{
            ELEMENTS[t.element].char
          }}</span>
          <span>{{ t.text }}</span>
        </p>
      </div>
    </div>

    <!-- 属性 -->
    <section>
      <SectionTitle title="道躯" />
      <div class="card-ink mt-2 px-4 py-3">
        <div class="grid grid-cols-3 gap-2 text-center">
          <div>
            <p class="text-[10px] text-ink-faint">攻击</p>
            <p class="tabular font-kai text-[15px] text-ink">
              <TapNumber :value="stats.attack" title="攻击" />
            </p>
          </div>
          <div>
            <p class="text-[10px] text-ink-faint">防御</p>
            <p class="tabular font-kai text-[15px] text-ink">
              <TapNumber :value="stats.defense" title="防御" />
            </p>
          </div>
          <div>
            <p class="text-[10px] text-ink-faint">气血</p>
            <p class="tabular font-kai text-[15px] text-ink">
              <TapNumber :value="stats.maxHp" title="气血" />
            </p>
          </div>
        </div>
        <div v-if="modRows.length" class="ink-divider-mark my-2.5" />
        <div class="grid grid-cols-2 gap-x-4 gap-y-1">
          <!-- 每行可点:玩家问的从来不只是「多少」,还有「从哪来」 -->
          <button
            v-for="row in modRows"
            :key="row.label"
            class="tap-row -my-1 flex justify-between py-1.5 text-left text-[11px] active:opacity-60"
            @click="toggleBreakdown(row.key)"
          >
            <span class="text-ink-faint">
              {{ row.label }}
              <span v-if="row.capped" class="ml-0.5 text-[10px] text-cinnabar">软</span>
            </span>
            <span class="tabular" :class="row.value > 0 ? 'text-qing' : 'text-cinnabar'">
              {{ row.value > 0 ? "+" : "" }}{{ formatPercent(row.value) }}
            </span>
          </button>
        </div>
        <p v-if="modRows.length" class="mt-1 text-[10px] text-ink-faint">点一行看它从哪来</p>
        <!--
          进阶成功率的名字容易过度承诺:它只进小进阶那一次掷点,大关走天劫推演。
          有这一项时才提示 —— 没有这项的玩家不需要知道这个边界。
        -->
        <p v-if="hasAdvanceRate" class="mt-0.5 text-[10px] leading-relaxed text-ink-faint">
          进阶成功率只作用于小进阶;大关须渡天劫,看的是劫型与四维准备度(护持/恢复/抗性/爆发)。
        </p>
        <p v-if="hasShieldMods" class="mt-0.5 text-[10px] leading-relaxed text-ink-faint">
          护盾至多覆盖最大气血的 {{ formatPercent(SHIELD_CAP_RATIO, 0) }} ——
          盾系堆得再多也顶不破这道上限。
        </p>
        <div v-if="breakdownRows.length" class="mt-1.5 rounded-md bg-paper-deep/60 px-2.5 py-2">
          <p class="text-[10px] text-ink-soft">{{ STAT_NAMES[breakdownKey!] }} · 来源明细</p>
          <p
            v-for="c in breakdownRows"
            :key="c.name"
            class="mt-0.5 flex justify-between text-[10px]"
          >
            <span class="text-ink-faint">
              {{ c.name }}
              <span v-if="c.onTop" class="ml-1 text-[10px] text-cinnabar">另乘</span>
            </span>
            <span class="tabular" :class="c.value > 0 ? 'text-qing' : 'text-cinnabar'">
              {{ c.value > 0 ? "+" : "" }}{{ formatPercent(c.value) }}
            </span>
          </p>
          <p class="mt-1 text-[10px] leading-relaxed text-ink-faint">
            明细之和就是上面那个数;标「另乘」的不并入百分比,而是单独乘在攻防血上。
          </p>
          <p v-if="diminishNote" class="mt-0.5 text-[10px] leading-relaxed text-cinnabar">
            {{ diminishNote }}
          </p>
        </div>
        <p v-if="softCappedNotes.length" class="mt-1.5 text-[10px] leading-relaxed text-cinnabar">
          标「软」者已达软上限:{{
            softCappedNotes.join("、")
          }}。极限堆叠到此后收益递减,不是面板被削。
        </p>
      </div>
    </section>

    <!-- 各处入口 —— 按「道途 / 缘法 / 记录」分节,每张卡带一枚题头图标,免成一列同形的卡 -->
    <section>
      <SectionTitle title="道途" hint="流派" />
      <div class="mt-2 space-y-2">
        <RouterLink to="/build" class="card-ink flex items-center gap-3 px-4 py-3 active:scale-99">
          <GameIcon name="swords" :size="16" class="shrink-0 text-cinnabar" />
          <span class="min-w-0 grow">
            <span class="block font-kai text-[14px] tracking-[0.25em] text-ink">流 派</span>
            <span class="block truncate text-[10px] text-ink-faint tabular">
              <template v-if="build">
                {{ build.displayName }} · 契合 {{ formatPercent(build.affinity, 0) }} · 快照
                {{ loadouts.list.length }} 套
              </template>
              <template v-else>道途尚未成路,词条与功法凑成一派便见分晓</template>
            </span>
          </span>
          <span class="text-[11px] text-cinnabar">参详 →</span>
        </RouterLink>

        <!-- 修行画像(Phase 31.2:历史行为归纳,纯描述无数值) -->
        <button
          class="card-ink flex w-full items-center gap-3 px-4 py-3 text-left active:scale-99"
          @click="identityOpen = true"
        >
          <GameIcon name="circle-user" :size="16" class="shrink-0 text-ink-soft" />
          <span class="min-w-0 grow">
            <span class="block font-kai text-[14px] tracking-[0.25em] text-ink">修行画像</span>
            <!-- 画像叙述是这一页最有「人味」的一行,一行截断会拦腰断句 —— 给两行 -->
            <span class="line-clamp-2 text-[10px] leading-relaxed text-ink-faint"
              >「{{ identity?.epithet ?? "玄枢散人" }}」 ·
              {{ identity?.narrative ?? "足迹尚浅" }}</span
            >
          </span>
          <span class="shrink-0 text-[11px] text-ink-soft">展卷 →</span>
        </button>

        <RouterLink to="/titles" class="card-ink flex items-center gap-3 px-4 py-3 active:scale-99">
          <!-- 相伴灵兽的"脸":有伴时亮出一枚玉色印章,未伴时无印 —— 伙伴不该只是名字 -->
          <!-- 相伴灵兽的「脸」:有伴亮伴侣的形,未伴用名号的冕 —— 同其他入口一样是一枚题头图 -->
          <GameIcon :name="currentPetIcon ?? 'crown'" :size="16" class="shrink-0 text-jade" />
          <span class="min-w-0 grow">
            <span class="block font-kai text-[14px] tracking-[0.25em] text-ink">名号与灵兽</span>
            <span class="block truncate text-[10px] text-ink-faint">
              {{ currentTitleName ?? "未佩名号" }} · {{ currentPetName ?? "未伴灵兽" }}
            </span>
          </span>
          <span class="text-[11px] text-jade">整理 →</span>
        </RouterLink>
      </div>
    </section>

    <!-- 缘法:这一世遇见的人 -->
    <section>
      <SectionTitle title="缘法" hint="师承道侣" />
      <div class="mt-2 space-y-2">
        <!-- 师承(Phase 31 S1):修行理念 + 师尊评价 -->
        <button
          class="card-ink flex w-full items-center gap-3 px-4 py-3 text-left active:scale-99"
          @click="mentorDialog = true"
        >
          <GameIcon name="scroll" :size="16" class="shrink-0 text-qing" />
          <span class="min-w-0 grow">
            <span class="block font-kai text-[14px] tracking-[0.25em] text-ink">师 承</span>
            <span class="block truncate text-[10px] text-ink-faint">
              {{
                mentorVer
                  ? `${mentorVer.mentor?.name ?? ""}·${mentorVer.mentor?.title ?? ""} | ${mentorVer.line}`
                  : "尚未拜师,可寻一位师尊"
              }}
            </span>
          </span>
          <span class="shrink-0 text-[11px] text-qing">{{ mentorVer ? "求教 →" : "拜师 →" }}</span>
        </button>

        <!-- 道侣(Phase 33.8):这一世遇见的人。只记关系与经历,不给任何属性 -->
        <button
          class="card-ink flex w-full items-center gap-3 px-4 py-3 text-left active:scale-99"
          @click="bondDialog = true"
        >
          <GameIcon name="user" :size="16" class="shrink-0 text-qing" />
          <span class="min-w-0 grow">
            <span class="block font-kai text-[14px] tracking-[0.25em] text-ink">道 侣</span>
            <!--
          她开了口 / 提了事,还等你一句 —— 这一行要报出来。此前只有点开弹窗
          才知道有事在等,而不开弹窗就永远不知道(与「卦在身」「今日天道未做」同族)。
        -->
            <span class="block truncate text-[10px] text-ink-faint">
              <span
                v-if="hasBondWord"
                class="chip-ink mr-1 align-middle border-qing/50 text-[10px] text-qing"
                >有话说</span
              >
              {{
                bondDef && bond
                  ? `${bondDef.name}·${STAGE_NAMES[bond.stage]}${bond.fallen ? "(已殁)" : bond.departed ? "(已离)" : ""} | ${bondDef.brief}`
                  : pastBonds.length
                    ? `此生尚未遇见,历世曾有 ${pastBonds.length} 段同行`
                    : "此生尚未遇见谁"
              }}
            </span>
          </span>
          <span class="shrink-0 text-[11px] text-qing">{{ bondDef ? "相知 →" : "履历 →" }}</span>
        </button>
      </div>
    </section>

    <!-- 记录:走过什么、这条路从哪来 -->
    <section>
      <SectionTitle title="记录" hint="藏珍" />
      <div class="mt-2 space-y-2">
        <RouterLink
          to="/collection"
          class="card-ink flex items-center gap-3 px-4 py-3 active:scale-99"
        >
          <GameIcon name="gem" :size="16" class="shrink-0 text-gold-ink" />
          <span class="min-w-0 grow">
            <span class="block font-kai text-[14px] tracking-[0.25em] text-ink">藏珍与成就</span>
            <span class="block text-[10px] text-ink-faint tabular">
              成就 {{ achievementCounts(achievementStateOf(quests.achieved)).done }}/{{
                ACHIEVEMENTS.length
              }}
              · 图鉴 {{ collectHave }}/{{ collectTotal }}
            </span>
          </span>
          <span class="text-[11px] text-gold-ink">翻阅 →</span>
        </RouterLink>

        <RouterLink to="/legacy" class="card-ink flex items-center gap-3 px-4 py-3 active:scale-99">
          <GameIcon name="book" :size="16" class="shrink-0 text-ink-soft" />
          <span class="min-w-0 grow">
            <span class="block font-kai text-[14px] tracking-[0.25em] text-ink">修仙录</span>
            <span class="block truncate text-[10px] text-ink-faint tabular"
              >画像 · 节点 · 我的纪录——这一部只写你自己</span
            >
          </span>
          <span class="text-[11px] text-ink-soft">展卷 →</span>
        </RouterLink>

        <!-- 界域志:与修仙录同级 —— 一部写你,一部写这条路从哪来 -->
        <RouterLink to="/codex" class="card-ink flex items-center gap-3 px-4 py-3 active:scale-99">
          <GameIcon name="mountain" :size="16" class="shrink-0 text-ink-soft" />
          <span class="min-w-0 grow">
            <span class="block font-kai text-[14px] tracking-[0.25em] text-ink">界域志</span>
            <!--
          这一册装着两半:界域/典籍是「来路」(只读),周易/紫微/星象/奇门是「术数四门」
          (有当下,问卦就在里面) —— 副题要把两半都说出来,否则想找问卦的人根本不会点进来。
        -->
            <span class="block text-[10px] text-ink-faint tabular">
              <span
                v-if="divinationOn"
                class="chip-ink mr-1 border-cinnabar/50 text-[10px] text-cinnabar"
                >卦在身</span
              >
              {{ cnNumber(WORLDS.length) }}界{{ cnNumber(REALMS.length) }}境的来路与典籍 · 术数四门
            </span>
          </span>
          <span class="text-[11px] text-ink-soft">查阅 →</span>
        </RouterLink>

        <button
          class="card-ink flex w-full items-center gap-3 px-4 py-3 text-left active:scale-99"
          @click="rebirthOpen = true"
        >
          <GameIcon name="refresh" :size="16" class="shrink-0 text-violet-ink" />
          <span class="min-w-0 grow">
            <span class="block font-kai text-[14px] tracking-[0.25em] text-ink">轮 回</span>
            <span class="block text-[10px] text-ink-faint tabular">
              <span class="chip-ink mr-1 border-violet-ink/50 text-[10px] text-violet-ink"
                >永久积累</span
              >
              道果 {{ formatNum(player.reincarnation.daoFruit) }} · 天赋 {{ ownedTalents.length }}
              项
            </span>
          </span>
          <span class="text-[11px] text-violet-ink">观想 →</span>
        </button>
      </div>
    </section>

    <!-- 修行画像弹窗(Phase 31.2) -->
    <BaseModal
      :open="identityOpen"
      :title="`修行画像 · 「${identity?.epithet ?? '玄枢散人'}」`"
      @close="identityOpen = false"
    >
      <div v-if="identity" class="space-y-2.5">
        <p class="t-body text-ink-soft">{{ identity.narrative }}</p>
        <div class="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
          <p class="flex justify-between">
            <span class="text-ink-faint">师承</span
            ><span class="text-ink-soft">{{ identity.roots.mentor?.name ?? "未定" }}</span>
          </p>
          <p class="flex justify-between">
            <span class="text-ink-faint">道途</span
            ><span class="text-ink-soft">{{ identity.roots.daoPath ?? "未立" }}</span>
          </p>
          <p class="flex justify-between">
            <span class="text-ink-faint">流派</span
            ><span class="text-ink-soft">{{ identity.roots.build ?? "未成" }}</span>
          </p>
          <p class="flex justify-between">
            <span class="text-ink-faint">悟道</span
            ><span class="text-ink-soft">{{ identity.roots.branches.join("、") || "未定" }}</span>
          </p>
        </div>
        <p v-if="identity.roots.fortunes.length" class="text-[11px] text-ink-faint">
          机缘印记:{{ identity.roots.fortunes.map((f) => f.title).join(" · ") }}
        </p>
        <p class="text-[10px] leading-relaxed text-ink-faint">
          画像基于真实选择归纳——你玩成了什么样,它便描述什么。
        </p>
      </div>
      <template #footer>
        <button class="btn-seal w-full" @click="identityOpen = false">收 卷</button>
      </template>
    </BaseModal>

    <!-- 轮回弹窗 -->
    <BaseModal :open="rebirthOpen" title="轮回" @close="rebirthOpen = false">
      <p class="flex justify-between text-[11px]">
        <span class="text-ink-soft">
          道果
          <span class="ml-1 text-[10px] text-violet-ink">【永久积累】</span>
          <span class="block text-[10px] text-ink-faint">
            每枚名义:修行 +{{ formatPercent(DAO_FRUIT_CULT_BONUS, 0) }},道躯 +{{
              formatPercent(DAO_FRUIT_COMBAT_BONUS, 0)
            }}(合计受软上限,见下方「有效收益」);转世保留
          </span>
        </span>
        <span class="tabular font-kai text-[15px] text-cinnabar">{{
          formatNum(player.reincarnation.daoFruit)
        }}</span>
      </p>
      <!-- S3 道果收益:有效值与软上限白话 -->
      <p class="mt-1 text-[11px] text-ink-faint tabular">
        有效收益
        <span class="text-gold-ink">{{ fruitInfo.effectiveText }} 枚</span>
        (边际渐减)·
        {{ fruitInfo.total > 0 ? `当前修行 ${fruitInfo.cultBonusText}` : "" }}
      </p>
      <!-- 逆旅契:道果的第一个消费出口。花道果换一世逆境,回报只有履历 -->
      <p class="mt-2 flex items-center justify-between text-[11px]">
        <span class="text-ink-soft">
          逆旅契
          <span class="ml-1 text-[10px] text-violet-ink">【本世 · 消耗道果】</span>
          <span class="block text-[10px] text-ink-faint">
            {{
              signedTrial
                ? `此生已立「${signedTrial.name}」·${signedTrial.ruleText}`
                : "以道果换一世逆境,所得唯有履历一笔"
            }}
          </span>
        </span>
        <!-- 拇指够得着:纯文字按钮只有 18px 高,补成 30px(弹窗里的可点元素同样受 28px 那条约束) -->
        <button
          v-if="!signedTrial"
          class="shrink-0 self-center -my-1.5 px-2 py-1.5 text-[11px] text-gold-ink underline underline-offset-2 active:text-cinnabar"
          @click="trialOpen = true"
        >
          立契
        </button>
        <span v-else class="shrink-0 font-kai text-[15px] text-cinnabar">{{
          signedTrial.seal
        }}</span>
      </p>

      <div class="mt-2">
        <div class="flex flex-wrap gap-1.5">
          <!-- 天赋效果不再只藏 hover:点一下芯片,下面展开一行说明(手机上看得见才算数) -->
          <button
            v-for="t in ownedTalents"
            :key="t!.id"
            class="chip-ink border-current bg-transparent text-left"
            :style="{ color: TALENT_GRADE_COLORS[t!.grade] }"
            :title="t!.desc"
            :aria-expanded="talentTap === t!.id"
            @click="talentTap = talentTap === t!.id ? null : t!.id"
          >
            {{ t!.name }}
          </button>
          <span v-if="!ownedTalents.length" class="text-[11px] text-ink-faint"
            >转世后可觉醒先天之姿</span
          >
        </div>
        <p
          v-if="talentTap && tappedTalent"
          class="mt-1.5 text-[10px] leading-relaxed text-ink-faint"
        >
          <span :style="{ color: TALENT_GRADE_COLORS[tappedTalent.grade] }">{{
            tappedTalent.name
          }}</span>
          ：{{ tappedTalent.desc }}
          <span class="mt-0.5 block text-qing">{{ modsText(tappedTalent.mods) }}</span>
        </p>
      </div>
      <p class="mt-3 t-body text-ink-faint">
        兵解转世保留道果 / 先天之姿 /
        称号等随魂之物;功法回一层,法宝归尘,余者随皮囊散去。金丹境方可自行兵解。
      </p>
      <!--
        去留一览:兵解是不可逆的大事,一句「随皮囊散去」盖不住整本账 ——
        哪一样去了哪、留下什么,读的就是 core/samsaraAudit 那份 HERITAGE(同表,不另写)。
        默认收起:不压弹窗高度,按下前点开即可核对。
      -->
      <button
        class="mt-2 flex w-full items-center justify-between px-2 py-2 text-left text-[11px] text-ink-soft active:opacity-60"
        :aria-expanded="heritageOpen"
        @click="heritageOpen = !heritageOpen"
      >
        <span>转世去留一览({{ keepCount }} 留 · {{ resetCount }} 去)</span>
        <span class="text-[10px] text-qing">{{ heritageOpen ? "▾ 收 起" : "▸ 展 开" }}</span>
      </button>
      <div v-if="heritageOpen" class="mt-1.5 rounded-md bg-paper-deep/60 px-3 py-2">
        <p class="text-[10px] text-ink-faint">随魂留存 / 归尘 · 与结算同表</p>
        <div class="mt-1 space-y-1">
          <p
            v-for="row in heritageKeepRows"
            :key="row.id"
            class="flex items-baseline justify-between gap-2 text-[10px]"
          >
            <span class="text-ink-soft">{{ row.name }}</span>
            <span class="shrink-0" :class="row.cls">{{ row.modeLabel }}</span>
          </p>
          <div class="my-1 border-t border-ink/6" />
          <p
            v-for="row in heritageResetRows"
            :key="row.id"
            class="flex items-baseline justify-between gap-2 text-[10px]"
          >
            <span class="text-ink-faint">{{ row.name }}</span>
            <span class="shrink-0" :class="row.cls">{{ row.modeLabel }}</span>
          </p>
        </div>
      </div>
      <template #footer>
        <button class="btn-ghost w-full !text-[11px]" :disabled="!canRebirth" @click="rebirth">
          {{
            canRebirth
              ? "兵解转世"
              : `${REALMS[MANUAL_REBIRTH_MIN_MAJOR]?.name ?? ""}境方可自行兵解`
          }}
        </button>
      </template>
    </BaseModal>

    <!-- 逆旅契弹窗:一世一份,签下不可解除;只加难度,不给任何属性或资源 -->
    <BaseModal :open="trialOpen" title="逆旅契" @close="trialOpen = false">
      <p class="t-body text-ink-faint">
        道果本是历世所积,却一向只堆在身上。立一份契,把它押在这一世的逆境里——
        契不予你分毫气力,只把路走窄。走完了,它会留在你的履历上。
      </p>
      <div class="mt-3 space-y-2">
        <button
          v-for="t in LIFE_TRIALS"
          :key="t.id"
          class="card-ink w-full px-3 py-2 text-left active:scale-99 disabled:opacity-40"
          :disabled="!canSignLifeTrial(t.id)"
          @click="signTrial(t.id)"
        >
          <span class="flex items-baseline justify-between">
            <span class="font-kai text-[14px] text-ink">{{ t.seal }} · {{ t.name }}</span>
            <!--
              哑巴灰的补齐:契签不下只有两个理由 —— 本世已签过 / 道果不足。
              已签过整组都灰,报「此生已签」(此时再报尚差会指错方向);
              道果不足照「尚差 N」报差数(与聚气丹/建筑同款纪律),不稳灰到底。
            -->
            <span v-if="signedTrial" class="shrink-0 tabular text-[11px] text-ink-faint"
              >此生已签</span
            >
            <span v-else class="shrink-0 tabular text-[11px] text-cinnabar">
              {{
                player.reincarnation.daoFruit >= t.cost
                  ? `${t.cost} 道果`
                  : `尚差 ${t.cost - player.reincarnation.daoFruit} 道果`
              }}
            </span>
          </span>
          <span class="mt-0.5 block t-body text-ink-soft">{{ t.desc }}</span>
          <span class="mt-0.5 block text-[10px] text-ink-faint">{{ t.ruleText }}</span>
        </button>
      </div>
      <p class="mt-3 t-body text-ink-faint">
        一世只可立一契,立下不可解。转世时契随皮囊散去,履历长存。
      </p>
    </BaseModal>

    <!-- 道侣弹窗:这一世的关系与历世的同行 -->
    <BaseModal
      :open="bondDialog"
      :title="bondDef ? `道侣 · ${bondDef.name}` : '道侣'"
      @close="bondDialog = false"
    >
      <template v-if="bondDef && bond">
        <p class="font-kai text-[14px] text-ink">{{ bondDef.name }}</p>
        <p class="mt-0.5 t-body text-ink-faint">{{ bondDef.brief }}</p>
        <p class="mt-2 text-[11px] text-ink-soft">
          {{ TEMPER_NAMES[bondDef.temper] }} · {{ LEAN_NAMES[bondDef.lean] }}道
          <span class="ml-1 text-qing">{{ STAGE_NAMES[bond.stage] }}</span>
          <span v-if="bond.fallen" class="ml-1 text-cinnabar">已殁</span
          ><span v-if="bond.departed" class="ml-1 text-qing">已离</span>
        </p>

        <!-- 三维只影响关系推进,不进任何属性 -->
        <div class="mt-3 space-y-1.5">
          <p v-for="m in bondMeters" :key="m.label" class="flex items-center gap-2 text-[11px]">
            <span class="w-10 shrink-0 text-ink-faint">{{ m.label }}</span>
            <ProgressBar :value="m.v / 100" class="grow" :height="4" color="var(--color-qing)" />
            <span class="w-8 shrink-0 text-right tabular text-ink-soft">{{ m.v }}</span>
          </p>
        </div>
        <p class="mt-2 text-[11px] text-ink-faint">共历 {{ bond.shared }} 次</p>
        <p v-if="responseLine" class="mt-1 text-[11px] text-ink-faint">
          她开的口,你历次回应:{{ responseLine }}
        </p>

        <p class="mt-3 t-body text-ink-soft">她所求:{{ bondDef.pursuit }}</p>
        <p class="mt-0.5 t-body text-ink-faint">
          她不越的线:{{ bondDef.taboo }}
        </p>

        <p v-if="gateHint" class="mt-3 text-[11px] text-gold-ink">
          离「{{ STAGE_NAMES[gateHint.stage] }}」尚差:{{ gateHint.lacking.join("、") }}
        </p>

        <!-- 她自己提出的事(Phase 34.1):不是世界安排的事件,是她开的口 -->
        <template v-if="herIntent">
          <div class="mt-4 border-t border-ink/10 pt-3">
            <p class="text-[11px] leading-relaxed text-gold-ink">{{ herIntent.line }}</p>
            <p class="mt-1 text-[10px] text-ink-faint">她所求:{{ herIntent.wish }}</p>
            <!-- 意图由经历催生,不是凭空的:把「因何而起」摆出来 -->
            <p v-if="herIntentSparks" class="text-[10px] text-ink-faint">
              因何而起:{{ herIntentSparks }}
            </p>
            <div class="mt-2.5 flex gap-2">
              <button
                v-for="r in INTENT_CHOICES"
                :key="r.id"
                class="card-ink grow px-2 py-2 text-center text-[11px] text-ink-soft active:scale-99"
                @click="answerIntent(r.id)"
              >
                {{ r.label }}
              </button>
            </div>
          </div>
        </template>

        <!-- 共同事件:她的诉求与底线在此第一次被玩家看见并回应 -->
        <template v-if="pendingEvent && !bond.fallen && !bond.departed">
          <div class="mt-4 border-t border-ink/10 pt-3">
            <p class="t-card">{{ pendingEvent.title }}</p>
            <p class="text-[10px] text-ink-faint">因何而来:{{ pendingEventTriggers }}</p>
            <p class="mt-1 t-body text-ink-soft">{{ pendingEvent.text }}</p>
            <p class="mt-1.5 text-[11px] text-qing">{{ pendingEvent.herWish }}</p>
            <p class="text-[10px] text-ink-faint">{{ pendingEvent.herLimit }}</p>
            <p v-if="herLine" class="mt-1.5 text-[11px] text-gold-ink">{{ herLine }}</p>
            <div class="mt-2.5 space-y-1.5">
              <button
                v-for="ch in pendingEvent.choices"
                :key="ch.id"
                class="card-ink w-full px-3 py-2 text-left text-[11px] text-ink-soft active:scale-99"
                :class="{
                  '!border-cinnabar/50 text-cinnabar': ch.peril,
                  '!border-gold-ink/40': ch.risky && !ch.peril,
                }"
                @click="pickChoice(ch.id)"
              >
                {{ ch.label }}
                <span v-if="ch.peril" class="ml-1 text-[10px] text-cinnabar">〔共命之险〕</span>
              </button>
            </div>
          </div>
        </template>
        <p
          v-else-if="lastEventText"
          class="mt-4 border-t border-ink/10 pt-3 t-body text-ink-soft"
        >
          {{ lastEventText }}
        </p>
      </template>
      <p v-else class="t-body text-ink-faint">
        此生尚未遇见谁。人是在路上碰到的,不是挑出来的 —— 多走几处地界,或许自有相逢。
      </p>

      <template v-if="pastBonds.length">
        <p class="mt-4 font-kai text-[14px] tracking-widest text-ink-soft">历世同行</p>
        <div class="scroll-pane mt-2 max-h-40 space-y-1.5 overflow-y-auto">
          <p v-for="(r, i) in pastBonds" :key="i" class="flex justify-between text-[11px]">
            <span class="text-ink-soft">{{ r.name }}</span>
            <span class="text-ink-faint"
              >{{ STAGE_NAMES[r.stage] }} · {{ ENDING_NAMES[r.ending] }}</span
            >
          </p>
        </div>
      </template>
    </BaseModal>

    <!-- 师承弹窗:拜师 / 师尊评价
        (Phase 31 S1:四种师承理念,拜后不改,转世保留,纯叙事反馈) -->
    <BaseModal
      :open="mentorDialog"
      :title="mentorVer ? `师承 · ${mentorVer.mentor?.name ?? ''}` : '拜师'"
      @close="mentorDialog = false"
    >
      <div v-if="mentorVer" class="space-y-3">
        <p class="font-kai text-[14px] text-ink">{{ mentorVer.mentor?.master }}</p>
        <p class="t-body text-ink-soft">「{{ mentorVer.line }}」</p>
        <p class="text-[11px] text-ink-faint tabular">
          契合度
          <span
            :class="
              mentorVer.affinity > 0.2
                ? 'text-jade'
                : mentorVer.affinity < -0.2
                  ? 'text-cinnabar'
                  : 'text-ink-faint'
            "
          >
            {{ mentorVer.affinity.toFixed(2) }}
          </span>
        </p>
        <p class="t-body text-ink-faint">
          师承词条(并入终局属性):{{ modsText(mentorVer.mentor?.mods ?? {}) || "—" }}
        </p>
      </div>
      <div v-else class="space-y-2.5">
        <p class="t-body text-ink-faint">
          师承是凡界修行者给你的"额外成长思想"。拜入师门,获一条方向性词条;行为与师承相合,师尊自有嘉许,不设惩罚。
        </p>
        <button
          v-for="m in mentorChoices()"
          :key="m!.id"
          class="w-full rounded-lg border px-3 py-2.5 text-left transition-[transform,background-color] active:scale-98"
          :class="hintMentor === m!.id ? 'border-cinnabar/60 bg-cinnabar/5' : 'border-ink/20'"
          @click="player.adoptMentor(m!.id)"
        >
          <p class="flex items-baseline gap-2">
            <span class="font-kai text-[14px] text-ink">{{ m!.name }}</span>
            <span class="text-[11px] text-qing">{{ m!.title }}</span>
            <span
              v-if="hintMentor === m!.id"
              class="chip-ink ml-1 border-cinnabar/50 text-[10px] text-cinnabar"
              >机缘引荐</span
            >
            <span class="ml-auto text-[10px] text-ink-faint">{{ m!.master }}</span>
          </p>
          <p class="mt-0.5 text-[11px] text-ink-faint">{{ m!.desc }}</p>
          <!-- 拜师是跨世保留的永久抉择:词条数值在按下前就摊开(与已拜后那行同源 modsText,不另拼) -->
          <p class="mt-1 block text-[11px] text-qing">{{ modsText(m!.mods) }}</p>
        </button>
      </div>
      <template #footer>
        <button class="btn-seal w-full" @click="mentorDialog = false">知道了</button>
      </template>
    </BaseModal>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { usePlayerStore } from "@/stores/player";
import { ENDING_NAMES, LEAN_NAMES, STAGE_NAMES, TEMPER_NAMES, daoluDef } from "@/data/daolu";
import {
  chooseBondEvent,
  herStance,
  nextGateHint,
  pendingBondEvent,
  pendingIntent,
  respondIntent,
} from "@/core/daoluService";
import { LIFE_TRIALS } from "@/data/lifeTrials";
import { activeLifeTrial, canSignLifeTrial, signLifeTrial } from "@/core/lifeTrialService";
import { useQuestsStore } from "@/stores/quests";
import { useUiStore } from "@/stores/ui";
import { ELEMENTS } from "@/data/linggen";
import { titleDef } from "@/data/titles";
import { petDef, PETS } from "@/data/pets";
import { talentDef, TALENT_GRADE_COLORS, TALENTS } from "@/data/talents";
import { ACHIEVEMENTS } from "@/data/achievements";
import { EQUIPMENT_TEMPLATES } from "@/data/equipment";
import { GONGFA } from "@/data/gongfa";
import { PILLS } from "@/data/pills";
import { ARTIFACTS } from "@/data/artifacts";
import { REALMS, WORLDS } from "@/data/realms";
import { EVENTS } from "@/data/events";
import { prepareReincarnation, MANUAL_REBIRTH_MIN_MAJOR } from "@/core/reincarnation";
import { HERITAGE } from "@/core/samsaraAudit";
import { detectBuild } from "@/core/buildDetect";
import { useLoadoutsStore } from "@/stores/loadouts";
import { isSoftCapped, modOf } from "@/core/statsCalc";
import {
  DAO_FRUIT_COMBAT_BONUS,
  DAO_FRUIT_CULT_BONUS,
  DIMINISH_KEYS,
  DIMINISH_WEIGHTS,
  POWER_WEIGHTS,
  SHIELD_CAP_RATIO,
  SOFT_CAPS,
} from "@/data/constants";
import { RESPONSE_NAMES, SPARK_NAMES } from "@/data/bondIntent";
import { TRIGGER_NAMES } from "@/data/bondEvents";
import { fruitMarginalInfo } from "@/core/resourceGuidance";
import { branchCodex, materialCodex } from "@/ui/codex";
import { mentorVerdict, mentorChoices } from "@/core/mentorService";
import { mentorHint } from "@/core/fortuneChain";
import { buildIdentity } from "@/core/identityService";
import { rootElements, tendencyLines } from "@/core/linggenAffinity";
import { cnNumber, formatNum, formatPercent } from "@/utils/format";
import { add, gn, mulN, ratio } from "@/utils/gnum";
import TapNumber from "@/components/common/TapNumber.vue";
import type { AnyStatKey } from "@/types";
import { STAT_NAMES, modsText } from "@/ui/statNames";
import { achievementCounts, achievementStateOf } from "@/core/engineUnlocks";
import SectionTitle from "@/components/common/SectionTitle.vue";
import BaseModal from "@/components/common/BaseModal.vue";
import GameIcon from "@/components/common/GameIcon.vue";
import ProgressBar from "@/components/common/ProgressBar.vue";

const player = usePlayerStore();
/** 卦在身:时限制的一卦在跑 —— 界域志那一行要报出来(问卦就在那一册里) */
const divinationOn = computed(() => !!player.activeDivination);

/** S3 道果链路:有效收益与软上限白话 */
const fruitInfo = computed(() => fruitMarginalInfo());
const quests = useQuestsStore();
const ui = useUiStore();
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
    { label: "攻击", value: player.finalStats.attack, w: POWER_WEIGHTS.attack, bar: "var(--color-cinnabar)" },
    { label: "防御", value: player.finalStats.defense, w: POWER_WEIGHTS.defense, bar: "var(--color-qing)" },
    { label: "气血", value: player.finalStats.maxHp, w: POWER_WEIGHTS.maxHp, bar: "var(--color-jade)" },
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

const knownIn = (ids: string[], table: readonly { id: string }[]): number => {
  const tableIds = new Set(table.map((row) => row.id));
  return new Set(ids.filter((id) => tableIds.has(id))).size;
};

const collectHave = computed(
  () =>
    knownIn(quests.collections.equip, EQUIPMENT_TEMPLATES) +
    knownIn(quests.collections.gongfa, GONGFA) +
    knownIn(quests.collections.pill, PILLS) +
    knownIn(quests.collections.artifact, ARTIFACTS) +
    knownIn(quests.collections.pet, PETS) +
    knownIn(quests.collections.event, EVENTS) +
    knownIn(quests.collections.talent, TALENTS) +
    // 图鉴页还有灵材谱与悟道录两类(派生视图,见 ui/codex.ts),计数要带上,否则两页对不上
    branchCodex().entries.filter((e) => e.stage > 0).length +
    materialCodex().entries.filter((e) => e.stage > 0).length,
);
const collectTotal =
  EQUIPMENT_TEMPLATES.length +
  GONGFA.length +
  PILLS.length +
  ARTIFACTS.length +
  PETS.length +
  EVENTS.length +
  TALENTS.length +
  branchCodex().entries.length +
  materialCodex().entries.length;

// ---- 轮回 ----
const rebirthOpen = ref(false);
/** 天赋芯片点按展开(移动端无 hover,效果说明内联显示);关弹窗复位 */
const talentTap = ref<string | null>(null);
const tappedTalent = computed(() => (talentTap.value ? talentDef(talentTap.value) : undefined));
watch(rebirthOpen, (open) => {
  if (!open) {
    talentTap.value = null;
    heritageOpen.value = false;
  }
});
/**
 * 转世去留一览:兵解是不可逆的大事,一句「随皮囊散去」盖不住整本账。
 * 行取自 core/samsaraAudit 的 HERITAGE 同表(审计处核实过,非样设口径),按留/去分组。
 * 默认收起:不压弹窗高度,按下前点开即可核对。
 */
const heritageOpen = ref(false);
const MODE_LABEL: Record<string, string> = {
  full: "随魂留存",
  partial: "折半/部分保留",
  reset: "归尘",
};
const heritageRows = computed(() =>
  HERITAGE.map((r) => ({
    id: r.id,
    name: r.name,
    mode: r.mode,
    modeLabel: MODE_LABEL[r.mode] ?? r.mode,
    /** 留=jade 色、归尘=淡墨 —— 一眼分得清哪些带得走 */
    cls: r.mode === "reset" ? "text-ink-faint" : "text-jade",
    detail: r.detail,
  })),
);
const heritageKeepRows = computed(() => heritageRows.value.filter((r) => r.mode !== "reset"));
const heritageResetRows = computed(() => heritageRows.value.filter((r) => r.mode === "reset"));
const keepCount = computed(() => heritageKeepRows.value.length);
const resetCount = computed(() => heritageResetRows.value.length);
const bondDialog = ref(false);
const bond = computed(() => player.bond);
const bondDef = computed(() => (bond.value ? (daoluDef(bond.value.daoluId) ?? null) : null));
const bondMeters = computed(() =>
  bond.value
    ? [
        { label: "缘分", v: bond.value.fate },
        { label: "信任", v: bond.value.trust },
        { label: "契合", v: bond.value.accord },
      ]
    : [],
);
const gateHint = computed(() => nextGateHint());
const pastBonds = computed(() => player.reincarnation.bonds);
/**
 * 待决的共同事件 —— 由历练情境写入关系状态,界面只读取。
 *
 * 34.0 之前是「打开弹窗才抽一个」:内容是真的,时机是假的。
 * 现在事件在历练途中就已发生,弹窗只是去看它
 */
const pendingEvent = computed(() => pendingBondEvent());
/** 这件事因何而来(触发名取自 bondEvents,不在视图里手写) */
const pendingEventTriggers = computed(() =>
  (pendingEvent.value?.triggers ?? [])
    .map((t) => TRIGGER_NAMES[t])
    .filter(Boolean)
    .join("、"),
);
const lastEventText = ref("");
const herLine = computed(() => (pendingEvent.value ? herStance(pendingEvent.value) : null));
watch(bondDialog, (open) => {
  if (open) lastEventText.value = "";
});
function pickChoice(choiceId: string): void {
  if (!pendingEvent.value) return;
  const r = chooseBondEvent(pendingEvent.value.id, choiceId);
  lastEventText.value = r?.text ?? "";
}

/** 她主动提出的事(34.1);三种回应,忽略不等于回绝 */
const herIntent = computed(() =>
  bond.value && !bond.value.departed && !bond.value.fallen ? pendingIntent() : null,
);
/** 道侣有未答的事(她自己提的言 / 世界递的事) —— 入口那一行要报出来 */
const hasBondWord = computed(() => !!pendingEvent.value || !!herIntent.value);
/** 这份心意因何而起(经历名取自 bondIntent) */
const herIntentSparks = computed(() => {
  const sparks = herIntent.value?.sparks ?? [];
  return [...new Set(sparks)].map((s) => SPARK_NAMES[s]).join("、");
});
/** 她记得你怎么答的 —— 回应名取自 bondIntent,视图不另写一份 */
const responseLine = computed(() => {
  const rs = bond.value?.intent?.responses ?? [];
  return rs.length ? rs.map((r) => RESPONSE_NAMES[r]).join(" · ") : "";
});
const INTENT_CHOICES = [
  { id: "accept" as const, label: "与她同去" },
  { id: "refuse" as const, label: "婉言谢绝" },
  { id: "ignore" as const, label: "不作声" },
];
function answerIntent(r: "accept" | "refuse" | "ignore"): void {
  const a = respondIntent(r);
  lastEventText.value = a?.text ?? "";
}
const trialOpen = ref(false);
/** 本世已立的逆旅契;未立为 null */
const signedTrial = computed(() => activeLifeTrial());
function signTrial(id: string): void {
  if (signLifeTrial(id)) trialOpen.value = false;
}
const canRebirth = computed(() => player.major >= MANUAL_REBIRTH_MIN_MAJOR);

// Phase 31 S1 师承
const mentorDialog = ref(false);
const mentorVer = computed(() => mentorVerdict(player.mentor));
// Phase 31.1 机缘链:机缘取/弃记忆 → 师承推荐
const hintMentor = computed(() => mentorHint());
// Phase 31.2 修行画像
const identityOpen = ref(false);
const identity = computed(() => buildIdentity());

function rebirth(): void {
  if (!canRebirth.value) {
    ui.toast(`至少金丹境方可自行兵解`, "warn");
    return;
  }
  rebirthOpen.value = false;
  prepareReincarnation();
}
</script>
