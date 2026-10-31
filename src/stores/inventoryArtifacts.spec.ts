import { beforeEach, describe, expect, it } from "vite-plus/test";
import { createPinia, setActivePinia } from "pinia";
import { useInventoryStore } from "@/stores/inventory";

describe("法宝随身位", () => {
  beforeEach(() => setActivePinia(createPinia()));

  it("满位换入替下最早随身的法 1,不按祭炼高低另挑", () => {
    const inventory = useInventoryStore();
    inventory.equippedArtifacts = ["af_first", "af_second"];

    expect(inventory.toggleArtifact("af_third", 2)).toBe("replaced");
    expect(inventory.equippedArtifacts).toEqual(["af_second", "af_third"]);
  });

  it("空位直接入位,已随身再点则收回", () => {
    const inventory = useInventoryStore();

    expect(inventory.toggleArtifact("af_first", 2)).toBe("equipped");
    expect(inventory.equippedArtifacts).toEqual(["af_first"]);
    expect(inventory.toggleArtifact("af_first", 2)).toBe("unequipped");
    expect(inventory.equippedArtifacts).toEqual([]);
  });

  it("零位时不硬塞一件进随身表", () => {
    const inventory = useInventoryStore();

    expect(inventory.toggleArtifact("af_first", 0)).toBe("blocked");
    expect(inventory.equippedArtifacts).toEqual([]);
  });
});
