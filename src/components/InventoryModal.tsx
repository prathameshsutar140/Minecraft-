import React, { useEffect, useMemo, useState } from 'react';
import {
  ArmorSlotType,
  ChestState,
  EnchantmentData,
  FurnaceState,
  HudSnapshot,
  ItemId,
  ItemStack,
} from '../types/game';
import { CREATIVE_CATALOG, ITEMS } from '../data/itemsAndBlocks';
import { CRAFTING_RECIPES, CraftingRecipe, matchCraftingGrid } from '../data/recipes';
import { getItemIconUrl } from '../engine/textures';
import { ItemSlot } from './ItemSlot';
import { soundEngine } from '../engine/audio';

interface InventoryModalProps {
  hud: HudSnapshot;
  atlasCanvas: HTMLCanvasElement | null;
  onClose: () => void;
  onSetSlot: (zone: 'hotbar' | 'inventory' | 'armor', index: number, stack: ItemStack | null) => void;
  onUpdateFurnace: (posKey: string, state: FurnaceState) => void;
  onUpdateChest: (posKey: string, state: ChestState) => void;
  onGiveCreativeItem: (id: ItemId, count: number) => void;
  onEnchantItem: (
    zone: 'hotbar' | 'inventory',
    index: number,
    enchantment: EnchantmentData,
    xpCost: number
  ) => boolean;
}

const ARMOR_TYPES: ArmorSlotType[] = ['helmet', 'chestplate', 'leggings', 'boots'];

export const InventoryModal: React.FC<InventoryModalProps> = ({
  hud,
  atlasCanvas,
  onClose,
  onSetSlot,
  onUpdateFurnace,
  onUpdateChest,
  onGiveCreativeItem,
  onEnchantItem,
}) => {
  const [cursor, setCursor] = useState<ItemStack | null>(null);
  const [craftGrid, setCraftGrid] = useState<(ItemStack | null)[]>(() => new Array(9).fill(null));
  const [showRecipeBook, setShowRecipeBook] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth >= 768 : true
  );
  const [splitHalfMode, setSplitHalfMode] = useState(false);
  const [enchantTarget, setEnchantTarget] = useState<{ zone: 'hotbar' | 'inventory'; index: number } | null>(null);
  const [creativeSearch, setCreativeSearch] = useState('');
  const [mousePos, setMousePos] = useState({ x: -999, y: -999 });
  const [slotSize, setSlotSize] = useState(() =>
    typeof window !== 'undefined' && window.innerWidth < 460 ? 34 : 42
  );

  useEffect(() => {
    const onResize = () => {
      setSlotSize(window.innerWidth < 460 ? 34 : 42);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const is3x3 = hud.activeContainer === 'crafting_table';
  const gridSize: 2 | 3 = is3x3 ? 3 : 2;
  const activePosKey = hud.activeBlockPos
    ? `${hud.activeBlockPos.x},${hud.activeBlockPos.y},${hud.activeBlockPos.z}`
    : '';

  const activeCraftSlice = useMemo(() => {
    if (gridSize === 3) return craftGrid;
    return [craftGrid[0], craftGrid[1], craftGrid[3], craftGrid[4]];
  }, [craftGrid, gridSize]);

  const matchedRecipe = useMemo(
    () => matchCraftingGrid(activeCraftSlice, gridSize),
    [activeCraftSlice, gridSize]
  );

  // Return crafting items to inventory on close if any remain
  const handleClose = () => {
    for (let i = 0; i < craftGrid.length; i++) {
      const s = craftGrid[i];
      if (s) onGiveCreativeItem(s.id, s.count);
    }
    if (cursor) onGiveCreativeItem(cursor.id, cursor.count);
    setCraftGrid(new Array(9).fill(null));
    setCursor(null);
    onClose();
  };

  // Generic click handler for any ItemStack slot
  const handleSlotClick = (
    e: React.MouseEvent,
    getSlot: () => ItemStack | null,
    setSlot: (next: ItemStack | null) => void,
    validator?: (stack: ItemStack) => boolean
  ) => {
    e.preventDefault();
    const current = getSlot();
    const isRight = e.button === 2 || splitHalfMode;

    if (!cursor) {
      if (!current) return;
      soundEngine.playClick();
      if (isRight && current.count > 1) {
        const half = Math.ceil(current.count / 2);
        setCursor({ ...current, count: half });
        setSlot({ ...current, count: current.count - half });
      } else {
        setCursor({ ...current });
        setSlot(null);
      }
      return;
    }

    if (validator && !validator(cursor)) return;
    soundEngine.playClick();

    if (!current) {
      if (isRight) {
        setSlot({ ...cursor, count: 1 });
        if (cursor.count <= 1) setCursor(null);
        else setCursor({ ...cursor, count: cursor.count - 1 });
      } else {
        setSlot({ ...cursor });
        setCursor(null);
      }
      return;
    }

    const maxStack = ITEMS[current.id]?.stackSize ?? 64;
    if (current.id === cursor.id && maxStack > 1 && current.count < maxStack) {
      if (isRight) {
        setSlot({ ...current, count: current.count + 1 });
        if (cursor.count <= 1) setCursor(null);
        else setCursor({ ...cursor, count: cursor.count - 1 });
      } else {
        const transfer = Math.min(cursor.count, maxStack - current.count);
        setSlot({ ...current, count: current.count + transfer });
        if (cursor.count - transfer <= 0) setCursor(null);
        else setCursor({ ...cursor, count: cursor.count - transfer });
      }
      return;
    }

    // Swap
    setSlot({ ...cursor });
    setCursor({ ...current });
  };

  const craftOne = () => {
    if (!matchedRecipe) return;
    const resDef = ITEMS[matchedRecipe.result.id];
    const resStack: ItemStack = {
      id: matchedRecipe.result.id,
      count: matchedRecipe.result.count,
      durability: resDef?.maxDurability,
    };

    if (cursor) {
      if (cursor.id !== resStack.id || cursor.count + resStack.count > (resDef?.stackSize ?? 64)) return;
      setCursor({ ...cursor, count: cursor.count + resStack.count });
    } else {
      setCursor(resStack);
    }

    soundEngine.playClick();
    const next = [...craftGrid];
    const indices = gridSize === 3 ? [0, 1, 2, 3, 4, 5, 6, 7, 8] : [0, 1, 3, 4];
    for (const idx of indices) {
      const s = next[idx];
      if (s) {
        if (s.count <= 1) next[idx] = null;
        else next[idx] = { ...s, count: s.count - 1 };
      }
    }
    setCraftGrid(next);
  };

  // Count total owned items for Recipe Book availability
  const ownedCounts = useMemo(() => {
    const counts = new Map<ItemId, number>();
    for (const s of [...hud.hotbar, ...hud.inventory]) {
      if (s) counts.set(s.id, (counts.get(s.id) ?? 0) + s.count);
    }
    return counts;
  }, [hud.hotbar, hud.inventory]);

  const canCraftRecipe = (r: CraftingRecipe): boolean => {
    if (!is3x3 && r.pattern && (r.pattern.length > 2 || r.pattern[0].length > 2)) return false;
    const req = new Map<ItemId, number>();
    if (r.ingredients) {
      for (const id of r.ingredients) req.set(id, (req.get(id) ?? 0) + 1);
    } else if (r.pattern && r.key) {
      for (const row of r.pattern) {
        for (const ch of row) {
          if (ch === ' ') continue;
          const k = r.key[ch];
          const chosen = Array.isArray(k)
            ? k.find((opt) => (ownedCounts.get(opt) ?? 0) > 0) ?? k[0]
            : k;
          req.set(chosen, (req.get(chosen) ?? 0) + 1);
        }
      }
    }
    for (const [id, need] of req) {
      if ((ownedCounts.get(id) ?? 0) < need) return false;
    }
    return true;
  };

  const quickCraftFromBook = (r: CraftingRecipe) => {
    if (!canCraftRecipe(r)) return;
    const consumed = new Map<ItemId, number>();
    const needList: ItemId[] = [];
    if (r.ingredients) {
      needList.push(...r.ingredients);
    } else if (r.pattern && r.key) {
      for (const row of r.pattern) {
        for (const ch of row) {
          if (ch === ' ') continue;
          const k = r.key[ch];
          const chosen = Array.isArray(k)
            ? k.find((opt) => (ownedCounts.get(opt) ?? 0) - (consumed.get(opt) ?? 0) > 0) ?? k[0]
            : k;
          needList.push(chosen);
          consumed.set(chosen, (consumed.get(chosen) ?? 0) + 1);
        }
      }
    }

    // Deduct from inventory/hotbar
    const tempHotbar = hud.hotbar.map((s) => (s ? { ...s } : null));
    const tempInv = hud.inventory.map((s) => (s ? { ...s } : null));
    for (const id of needList) {
      let took = false;
      for (let i = 0; i < tempInv.length && !took; i++) {
        const s = tempInv[i];
        if (s && s.id === id) {
          s.count -= 1;
          if (s.count <= 0) tempInv[i] = null;
          onSetSlot('inventory', i, tempInv[i]);
          took = true;
        }
      }
      for (let i = 0; i < tempHotbar.length && !took; i++) {
        const s = tempHotbar[i];
        if (s && s.id === id) {
          s.count -= 1;
          if (s.count <= 0) tempHotbar[i] = null;
          onSetSlot('hotbar', i, tempHotbar[i]);
          took = true;
        }
      }
    }

    soundEngine.playClick();
    onGiveCreativeItem(r.result.id, r.result.count);
  };

  const filteredCreative = useMemo(() => {
    const q = creativeSearch.trim().toLowerCase();
    if (!q) return CREATIVE_CATALOG;
    return CREATIVE_CATALOG.filter((id) => ITEMS[id]?.name.toLowerCase().includes(q));
  }, [creativeSearch]);

  const furnace = hud.furnaceState;
  const chest = hud.chestState;

  const selectedEnchantStack = enchantTarget
    ? enchantTarget.zone === 'hotbar'
      ? hud.hotbar[enchantTarget.index]
      : hud.inventory[enchantTarget.index]
    : null;

  const enchantOptions = useMemo((): { enchantment: EnchantmentData; xpCost: number }[] => {
    if (!selectedEnchantStack) return [];
    const def = ITEMS[selectedEnchantStack.id];
    if (!def) return [];
    if (def.toolCategory === 'sword') {
      return [
        { enchantment: { id: 'sharpness', label: 'Sharpness', level: 1 }, xpCost: 1 },
        { enchantment: { id: 'sharpness', label: 'Sharpness', level: 2 }, xpCost: 2 },
        { enchantment: { id: 'unbreaking', label: 'Unbreaking', level: 2 }, xpCost: 3 },
      ];
    }
    if (def.toolCategory && def.toolCategory !== 'none') {
      return [
        { enchantment: { id: 'efficiency', label: 'Efficiency', level: 1 }, xpCost: 1 },
        { enchantment: { id: 'efficiency', label: 'Efficiency', level: 2 }, xpCost: 2 },
        { enchantment: { id: 'unbreaking', label: 'Unbreaking', level: 2 }, xpCost: 3 },
      ];
    }
    if (def.armorSlot) {
      return [
        { enchantment: { id: 'protection', label: 'Protection', level: 1 }, xpCost: 1 },
        { enchantment: { id: 'protection', label: 'Protection', level: 2 }, xpCost: 2 },
        { enchantment: { id: 'unbreaking', label: 'Unbreaking', level: 2 }, xpCost: 3 },
      ];
    }
    return [];
  }, [selectedEnchantStack]);

  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center bg-black/65 p-2 sm:p-4 overflow-y-auto"
      onMouseMove={(e) => setMousePos({ x: e.clientX, y: e.clientY })}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="flex flex-col md:flex-row items-center md:items-start gap-3 max-w-[98vw] max-h-[94vh] overflow-y-auto">
        {/* Recipe Book Sidebar */}
        {(hud.activeContainer === 'inventory' || hud.activeContainer === 'crafting_table') && showRecipeBook && (
          <div className="mc-panel w-full max-w-[320px] md:w-[250px] p-3 text-[#1f1f1f] flex flex-col gap-2 max-h-[220px] md:max-h-[440px]">
            <div className="flex items-center justify-between border-b border-[#808080] pb-1.5">
              <span className="text-xs font-bold">Recipe Book</span>
              <span className="text-[10px] text-[#555]">Tap to craft</span>
            </div>
            <div className="grid grid-cols-6 md:grid-cols-4 gap-1 overflow-y-auto pr-1">
              {CRAFTING_RECIPES.filter((r) => is3x3 || !r.pattern || (r.pattern.length <= 2 && r.pattern[0].length <= 2)).map(
                (r) => {
                  const craftable = canCraftRecipe(r);
                  const icon = atlasCanvas ? getItemIconUrl(r.result.id, atlasCanvas) : '';
                  return (
                    <button
                      key={r.id}
                      onClick={() => quickCraftFromBook(r)}
                      disabled={!craftable}
                      title={`${ITEMS[r.result.id]?.name} x${r.result.count}`}
                      className={`h-10 md:h-11 flex items-center justify-center relative border cursor-pointer ${
                        craftable
                          ? 'bg-[#6e9150] border-[#d5f5b3] hover:bg-[#82ab5e]'
                          : 'bg-[#7b7b7b] border-[#525252] opacity-55 cursor-not-allowed'
                      }`}
                    >
                      {icon && <img src={icon} alt={r.id} className="w-7 h-7 pixelated" />}
                      {r.result.count > 1 && (
                        <span className="absolute bottom-0.5 right-1 text-[10px] text-white mc-text-shadow">
                          {r.result.count}
                        </span>
                      )}
                    </button>
                  );
                }
              )}
            </div>
          </div>
        )}

        {/* Main Container Panel */}
        <div className="mc-panel p-3 sm:p-4 text-[#1f1f1f] flex flex-col gap-2.5 sm:gap-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <h2 className="text-sm font-bold">
              {hud.activeContainer === 'crafting_table'
                ? 'Crafting'
                : hud.activeContainer === 'furnace'
                  ? 'Furnace'
                  : hud.activeContainer === 'chest'
                    ? 'Chest'
                    : hud.activeContainer === 'enchanting'
                      ? 'Enchanting Table'
                      : hud.activeContainer === 'creative'
                        ? 'Creative Inventory'
                        : 'Inventory'}
            </h2>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setSplitHalfMode((v) => !v)}
                className={`mc-button px-2 py-1 text-[10px] cursor-pointer ${
                  splitHalfMode ? 'ring-2 ring-[#fde047]' : ''
                }`}
                title="Touch helper: Split/Place 1 item on tap"
              >
                {splitHalfMode ? 'Split: ON' : 'Split'}
              </button>
              {(hud.activeContainer === 'inventory' || hud.activeContainer === 'crafting_table') && (
                <button
                  onClick={() => setShowRecipeBook((v) => !v)}
                  className="mc-button px-2.5 py-1 text-[10px] sm:text-[11px] cursor-pointer"
                >
                  Recipes
                </button>
              )}
              <button onClick={handleClose} className="mc-button px-2.5 py-1 text-[10px] sm:text-[11px] cursor-pointer">
                Close
              </button>
            </div>
          </div>

          {/* Enchanting Table UI */}
          {hud.activeContainer === 'enchanting' && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-[#9f9f9f] p-2.5 border border-[#5f5f5f]">
              <div className="flex flex-col items-center gap-1">
                <ItemSlot
                  stack={selectedEnchantStack}
                  atlasCanvas={atlasCanvas}
                  size={48}
                  placeholder="Tool"
                />
                <span className="text-[10px] font-bold text-[#2f4f15]">
                  XP Lv: {hud.xpLevel}
                </span>
              </div>

              <div className="flex-1 flex flex-col gap-1.5 w-full">
                {!selectedEnchantStack ? (
                  <p className="text-[11px] text-[#2c2c2c] text-center">
                    Tap any tool, sword, or armor piece below to enchant it.
                  </p>
                ) : enchantOptions.length === 0 ? (
                  <p className="text-[11px] text-[#7f1d1d] text-center">
                    This item cannot be enchanted. Select a tool, weapon, or armor.
                  </p>
                ) : (
                  enchantOptions.map((opt, idx) => {
                    const affordable = hud.gameMode === 'creative' || hud.xpLevel >= opt.xpCost;
                    return (
                      <button
                        key={idx}
                        disabled={!affordable}
                        onClick={() => {
                          if (!enchantTarget) return;
                          onEnchantItem(enchantTarget.zone, enchantTarget.index, opt.enchantment, opt.xpCost);
                        }}
                        className={`mc-button px-3 py-1.5 text-xs flex items-center justify-between cursor-pointer ${
                          affordable ? '' : 'opacity-50 cursor-not-allowed'
                        }`}
                      >
                        <span className="text-[#e9d5ff]">
                          ✦ {opt.enchantment.label} {opt.enchantment.level}
                        </span>
                        <span className="text-[#80ff20] font-mc-mono">
                          {hud.gameMode === 'creative' ? 'FREE' : `${opt.xpCost} Lv`}
                        </span>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* Creative Mode Catalog */}
          {hud.activeContainer === 'creative' && (
            <div className="flex flex-col gap-2">
              <input
                type="text"
                value={creativeSearch}
                onChange={(e) => setCreativeSearch(e.target.value)}
                placeholder="Search items..."
                className="bg-[#1e1e1e] text-white px-2.5 py-1.5 text-xs border-2 border-[#3f3f3f] focus:outline-none"
              />
              <div className="grid grid-cols-9 gap-1 max-h-[200px] sm:max-h-[220px] overflow-y-auto p-1 bg-[#8b8b8b]/40">
                {filteredCreative.map((id) => (
                  <ItemSlot
                    key={id}
                    stack={{ id, count: 1 }}
                    atlasCanvas={atlasCanvas}
                    size={slotSize}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      const def = ITEMS[id];
                      const amt = e.shiftKey || e.button === 2 || splitHalfMode ? def.stackSize : 1;
                      soundEngine.playClick();
                      setCursor({ id, count: amt, durability: def.maxDurability });
                    }}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Survival Inventory (Armor + 2x2 Crafting) */}
          {hud.activeContainer === 'inventory' && (
            <div className="flex items-center justify-between gap-4 px-1">
              {/* Armor column */}
              <div className="flex flex-col gap-1">
                {ARMOR_TYPES.map((slotType, idx) => (
                  <ItemSlot
                    key={slotType}
                    stack={hud.armorSlots[idx]}
                    atlasCanvas={atlasCanvas}
                    size={40}
                    placeholder={slotType.slice(0, 4)}
                    onMouseDown={(e) =>
                      handleSlotClick(
                        e,
                        () => hud.armorSlots[idx],
                        (next) => onSetSlot('armor', idx, next),
                        (s) => ITEMS[s.id]?.armorSlot === slotType
                      )
                    }
                  />
                ))}
              </div>

              {/* 2x2 Crafting */}
              <div className="flex items-center gap-3">
                <div className="grid grid-cols-2 gap-1">
                  {[0, 1, 3, 4].map((gridIdx) => (
                    <ItemSlot
                      key={gridIdx}
                      stack={craftGrid[gridIdx]}
                      atlasCanvas={atlasCanvas}
                      size={42}
                      onMouseDown={(e) =>
                        handleSlotClick(
                          e,
                          () => craftGrid[gridIdx],
                          (next) => {
                            const copy = [...craftGrid];
                            copy[gridIdx] = next;
                            setCraftGrid(copy);
                          }
                        )
                      }
                    />
                  ))}
                </div>
                <span className="text-lg font-bold text-[#4a4a4a]">→</span>
                <ItemSlot
                  stack={
                    matchedRecipe
                      ? { id: matchedRecipe.result.id, count: matchedRecipe.result.count }
                      : null
                  }
                  atlasCanvas={atlasCanvas}
                  size={44}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    craftOne();
                  }}
                />
              </div>
            </div>
          )}

          {/* 3x3 Crafting Table */}
          {hud.activeContainer === 'crafting_table' && (
            <div className="flex items-center justify-center gap-4 py-1">
              <div className="grid grid-cols-3 gap-1">
                {craftGrid.map((s, idx) => (
                  <ItemSlot
                    key={idx}
                    stack={s}
                    atlasCanvas={atlasCanvas}
                    size={44}
                    onMouseDown={(e) =>
                      handleSlotClick(
                        e,
                        () => craftGrid[idx],
                        (next) => {
                          const copy = [...craftGrid];
                          copy[idx] = next;
                          setCraftGrid(copy);
                        }
                      )
                    }
                  />
                ))}
              </div>
              <span className="text-xl font-bold text-[#4a4a4a]">→</span>
              <ItemSlot
                stack={
                  matchedRecipe
                    ? { id: matchedRecipe.result.id, count: matchedRecipe.result.count }
                    : null
                }
                atlasCanvas={atlasCanvas}
                size={48}
                onMouseDown={(e) => {
                  e.preventDefault();
                  craftOne();
                }}
              />
            </div>
          )}

          {/* Furnace UI */}
          {hud.activeContainer === 'furnace' && furnace && (
            <div className="flex items-center justify-center gap-6 py-2">
              <div className="flex flex-col items-center gap-2">
                <ItemSlot
                  stack={furnace.input}
                  atlasCanvas={atlasCanvas}
                  size={44}
                  placeholder="Ore"
                  onMouseDown={(e) =>
                    handleSlotClick(
                      e,
                      () => furnace.input,
                      (next) => onUpdateFurnace(activePosKey, { ...furnace, input: next })
                    )
                  }
                />
                <div className="w-7 h-5 bg-[#404040] border border-[#1a1a1a] relative overflow-hidden">
                  <div
                    className="absolute bottom-0 left-0 right-0 bg-[#f97316]"
                    style={{
                      height: `${
                        furnace.maxBurnTime > 0
                          ? Math.round((furnace.burnTime / furnace.maxBurnTime) * 100)
                          : 0
                      }%`,
                    }}
                  />
                </div>
                <ItemSlot
                  stack={furnace.fuel}
                  atlasCanvas={atlasCanvas}
                  size={44}
                  placeholder="Fuel"
                  onMouseDown={(e) =>
                    handleSlotClick(
                      e,
                      () => furnace.fuel,
                      (next) => onUpdateFurnace(activePosKey, { ...furnace, fuel: next }),
                      (s) => (ITEMS[s.id]?.fuelTicks ?? 0) > 0
                    )
                  }
                />
              </div>

              <div className="w-16 h-4 bg-[#404040] border border-[#1a1a1a] relative overflow-hidden">
                <div
                  className="h-full bg-[#e5e5e5]"
                  style={{
                    width: `${Math.round((furnace.cookTime / furnace.maxCookTime) * 100)}%`,
                  }}
                />
              </div>

              <ItemSlot
                stack={furnace.output}
                atlasCanvas={atlasCanvas}
                size={48}
                placeholder="Out"
                onMouseDown={(e) =>
                  handleSlotClick(
                    e,
                    () => furnace.output,
                    (next) => onUpdateFurnace(activePosKey, { ...furnace, output: next }),
                    () => false // prevent putting items into output slot
                  )
                }
              />
            </div>
          )}

          {/* Chest 27-slot UI */}
          {hud.activeContainer === 'chest' && chest && (
            <div className="grid grid-cols-9 gap-1">
              {chest.slots.map((s, idx) => (
                <ItemSlot
                  key={idx}
                  stack={s}
                  atlasCanvas={atlasCanvas}
                  size={slotSize}
                  onMouseDown={(e) =>
                    handleSlotClick(
                      e,
                      () => chest.slots[idx],
                      (next) => {
                        const copy = [...chest.slots];
                        copy[idx] = next;
                        onUpdateChest(activePosKey, { slots: copy });
                      }
                    )
                  }
                />
              ))}
            </div>
          )}

          {/* Player Main 27-slot Inventory (hidden in pure Creative catalog except hotbar) */}
          {hud.activeContainer !== 'creative' && (
            <div className="flex flex-col gap-1 border-t border-[#7c7c7c] pt-2">
              <div className="grid grid-cols-9 gap-1">
                {hud.inventory.map((s, idx) => (
                  <ItemSlot
                    key={idx}
                    stack={s}
                    atlasCanvas={atlasCanvas}
                    size={slotSize}
                    selected={
                      hud.activeContainer === 'enchanting' &&
                      enchantTarget?.zone === 'inventory' &&
                      enchantTarget.index === idx
                    }
                    onMouseDown={(e) => {
                      if (hud.activeContainer === 'enchanting') {
                        e.preventDefault();
                        if (s) setEnchantTarget({ zone: 'inventory', index: idx });
                        return;
                      }
                      handleSlotClick(
                        e,
                        () => hud.inventory[idx],
                        (next) => onSetSlot('inventory', idx, next)
                      );
                    }}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Player 9-slot Hotbar */}
          <div className="grid grid-cols-9 gap-1 pt-1 border-t border-[#5c5c5c]">
            {hud.hotbar.map((s, idx) => (
              <ItemSlot
                key={idx}
                stack={s}
                atlasCanvas={atlasCanvas}
                size={slotSize}
                selected={
                  hud.activeContainer === 'enchanting' &&
                  enchantTarget?.zone === 'hotbar' &&
                  enchantTarget.index === idx
                }
                onMouseDown={(e) => {
                  if (hud.activeContainer === 'enchanting') {
                    e.preventDefault();
                    if (s) setEnchantTarget({ zone: 'hotbar', index: idx });
                    return;
                  }
                  handleSlotClick(
                    e,
                    () => hud.hotbar[idx],
                    (next) => onSetSlot('hotbar', idx, next)
                  );
                }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Floating Cursor Item Stack */}
      {cursor && atlasCanvas && (
        <div
          className="fixed z-50 pointer-events-none"
          style={{ left: mousePos.x - 16, top: mousePos.y - 16 }}
        >
          <img
            src={getItemIconUrl(cursor.id, atlasCanvas)}
            alt={cursor.id}
            className="w-8 h-8 pixelated"
          />
          {cursor.count > 1 && (
            <span className="absolute -bottom-1 -right-1 text-xs font-bold text-white mc-text-shadow tabular-nums">
              {cursor.count}
            </span>
          )}
        </div>
      )}
    </div>
  );
};
