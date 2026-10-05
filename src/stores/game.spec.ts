/**
 * 建号「逆天改命」额度
 *
 * 政策:建号不限次(掷到满意为止),所以额度不是闸门;真正要守的是那副牌 ——
 * 牌面落在 game store 上,刷新页面看到的是同一副牌,而不是背着玩家换一副。
 * 额度保留数字形态,是为了将来收紧成有限次数时不必再动存档结构。
 */
import { beforeEach, describe, expect, it } from "vite-plus/test";
import { createPinia, setActivePinia } from "pinia";
import { useGameStore } from "@/stores/game";
import { usePlayerStore } from "@/stores/player";
import { useUiStore } from "@/stores/ui";
import { rollLinggen } from "@/core/linggenGen";
import {
  confirmReincarnation,
  prepareReincarnation,
  rollReincarnateName,
} from "@/core/reincarnation";
import { RandomService, mulberry32 } from "@/utils/random";
import { CREATE_REROLL_QUOTA } from "@/data/constants";

/** 复刻 CreateView 的 setup:有草稿就沿用,没有才开掷 */
function enterCreateView(rng: RandomService): void {
  const game = useGameStore();
  if (!game.createProfile) game.setCreateProfile(rollLinggen(rng));
}

describe("建号「逆天改命」不限次", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("想刷多少次就刷多少次,额度不会被扣减", () => {
    const rng = new RandomService(mulberry32(20260902));
    const game = useGameStore();
    enterCreateView(rng);

    expect(game.createRerolls, "建号默认不是不限次").toBeNull();
    for (let i = 0; i < 50; i += 1) {
      expect(game.spendCreateReroll()).toBe(true);
      game.setCreateProfile(rollLinggen(rng));
    }
    expect(game.createRerolls, "刷多了额度被扣成数字").toBeNull();
  });

  it("刷新不会背着玩家换牌:已有草稿时不重新开牌", () => {
    const rng = new RandomService(mulberry32(7));
    const game = useGameStore();
    enterCreateView(rng);
    const drafted = game.createProfile;

    enterCreateView(rng);
    expect(game.createProfile, "重进建号页换了一副玩家没掷过的牌").toBe(drafted);
  });

  it("旧存档里遗留的有限额度归位到不限次", () => {
    const rng = new RandomService(mulberry32(99));
    const game = useGameStore();
    enterCreateView(rng);
    // 老版本的存档写的是 8 次额度,刷到 0 就被锁住了
    game.createRerolls = 0;
    game.sanitize();

    expect(game.createRerolls, "旧存档的花光额度没有归位,老玩家被锁在最后一副牌上").toBeNull();
    expect(game.spendCreateReroll()).toBe(true);
  });

  it("转世是新的一世:上一世的草稿作废,额度回到不限次", () => {
    const rng = new RandomService(mulberry32(1234));
    const game = useGameStore();
    const player = usePlayerStore();
    player.initCharacter("测试道友", rollLinggen(rng));
    enterCreateView(rng);
    game.setCreateProfile(rollLinggen(rng));

    prepareReincarnation();
    confirmReincarnation(null);

    expect(game.createRerolls, "转世后额度形态变了").toBe(CREATE_REROLL_QUOTA);
    expect(game.createProfile, "上一世的建号草稿没有作废").toBeNull();
  });

  it("掷出的道号草稿由词根与尾缀构成,同一随机源可复现", () => {
    const rng = new RandomService(mulberry32(4242));
    const a = rollReincarnateName(rng);
    const rng2 = new RandomService(mulberry32(4242));
    const b = rollReincarnateName(rng2);
    expect(a, "同一随机源应掷出同一道号").toBe(b);
    expect(a.length, "道号至少「两字词根+尾缀」").toBeGreaterThanOrEqual(3);
    expect(a).toMatch(
      /^(?:清虚|妙微|抱朴|守拙|漱玉|归真|太虚|玄真|素心|青冥|孤鸿|静虚|凌云|白云|回月|灵犀|紫电|青锋|归藏|抱元|守一|忘机|澄澈|栖霞|望舒|扶摇|冲虚|无涯|观澜|清风)(?:真人|道人|散人|子|居士|上人)$/,
    );
  });

  it("转世准备时会掷出一枚新的道号草稿(不改 player.name)", () => {
    const rng = new RandomService(mulberry32(20260930));
    const player = usePlayerStore();
    player.initCharacter("旧名", rollLinggen(rng));

    const view = prepareReincarnation();
    expect(view.nameDraft.length, "确认页至少要有可改的道号草稿").toBeGreaterThanOrEqual(3);
    // 只算不改:草稿留给确认页,此际 name 仍是旧名
    expect(player.name).toBe("旧名");
  });

  it("确认转世时把草稿写进新一世(带名走,不带名则沿用)", () => {
    const rng = new RandomService(mulberry32(777));
    const player = usePlayerStore();
    const ui = useUiStore();
    player.initCharacter("旧名", rollLinggen(rng));

    prepareReincarnation();
    const draft = ui.reincarnation!.nameDraft;
    confirmReincarnation(null, null, draft);
    expect(player.name, "确认页的道号草稿应随神魂落为新一世之名").toBe(draft);

    // 不带姓名走一遭:名号不因此改动
    const before = player.name;
    prepareReincarnation();
    confirmReincarnation(null);
    expect(player.name).toBe(before);
  });
});
