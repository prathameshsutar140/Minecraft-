import { BlockId, ItemId, ItemStack } from '../types/game';
import { BLOCK_ITEM } from './itemsAndBlocks';

export interface CraftingRecipe {
  id: string;
  pattern?: string[]; // 1..3 rows of equal length (1..3 chars)
  key?: Record<string, ItemId | ItemId[]>;
  ingredients?: ItemId[]; // shapeless
  result: { id: ItemId; count: number };
}

export interface SmeltRecipe {
  input: ItemId;
  output: ItemId;
  xp: number;
}

const PLANKS: ItemId[] = [
  BLOCK_ITEM(BlockId.OakPlanks),
  BLOCK_ITEM(BlockId.BirchPlanks),
  BLOCK_ITEM(BlockId.SprucePlanks),
];

const WOOLS: ItemId[] = [
  BLOCK_ITEM(BlockId.WoolWhite),
  BLOCK_ITEM(BlockId.WoolRed),
  BLOCK_ITEM(BlockId.WoolBlue),
];

export const CRAFTING_RECIPES: CraftingRecipe[] = [
  // Planks from Logs
  {
    id: 'oak_planks',
    ingredients: [BLOCK_ITEM(BlockId.OakLog)],
    result: { id: BLOCK_ITEM(BlockId.OakPlanks), count: 4 },
  },
  {
    id: 'birch_planks',
    ingredients: [BLOCK_ITEM(BlockId.BirchLog)],
    result: { id: BLOCK_ITEM(BlockId.BirchPlanks), count: 4 },
  },
  {
    id: 'spruce_planks',
    ingredients: [BLOCK_ITEM(BlockId.SpruceLog)],
    result: { id: BLOCK_ITEM(BlockId.SprucePlanks), count: 4 },
  },
  // Sticks
  {
    id: 'sticks',
    pattern: ['P', 'P'],
    key: { P: PLANKS },
    result: { id: 'stick', count: 4 },
  },
  // Crafting Table
  {
    id: 'crafting_table',
    pattern: ['PP', 'PP'],
    key: { P: PLANKS },
    result: { id: BLOCK_ITEM(BlockId.CraftingTable), count: 1 },
  },
  // Torch
  {
    id: 'torch_coal',
    pattern: ['C', 'S'],
    key: { C: ['coal', 'charcoal'], S: 'stick' },
    result: { id: BLOCK_ITEM(BlockId.Torch), count: 4 },
  },
  // Furnace
  {
    id: 'furnace',
    pattern: ['CCC', 'C C', 'CCC'],
    key: { C: BLOCK_ITEM(BlockId.Cobblestone) },
    result: { id: BLOCK_ITEM(BlockId.Furnace), count: 1 },
  },
  // Chest
  {
    id: 'chest',
    pattern: ['PPP', 'P P', 'PPP'],
    key: { P: PLANKS },
    result: { id: BLOCK_ITEM(BlockId.Chest), count: 1 },
  },
  // Bed
  {
    id: 'bed',
    pattern: ['WWW', 'PPP'],
    key: { W: WOOLS, P: PLANKS },
    result: { id: BLOCK_ITEM(BlockId.Bed), count: 1 },
  },
  // Oak Door
  {
    id: 'oak_door',
    pattern: ['PP', 'PP', 'PP'],
    key: { P: PLANKS },
    result: { id: BLOCK_ITEM(BlockId.OakDoorClosed), count: 3 },
  },
  // Oak Fence
  {
    id: 'oak_fence',
    pattern: ['PSP', 'PSP'],
    key: { P: PLANKS, S: 'stick' },
    result: { id: BLOCK_ITEM(BlockId.OakFence), count: 3 },
  },
  // Enchanting Table
  {
    id: 'enchanting_table',
    pattern: [' L ', 'DOD', 'OOO'],
    key: { L: 'leather', D: 'diamond', O: BLOCK_ITEM(BlockId.Obsidian) },
    result: { id: BLOCK_ITEM(BlockId.EnchantingTable), count: 1 },
  },
  // Ladder
  {
    id: 'ladder',
    pattern: ['S S', 'SSS', 'S S'],
    key: { S: 'stick' },
    result: { id: BLOCK_ITEM(BlockId.Ladder), count: 3 },
  },
  // Stone Bricks
  {
    id: 'stone_bricks',
    pattern: ['SS', 'SS'],
    key: { S: BLOCK_ITEM(BlockId.Stone) },
    result: { id: BLOCK_ITEM(BlockId.StoneBricks), count: 4 },
  },
  // Bookshelf
  {
    id: 'bookshelf',
    pattern: ['PPP', 'LLL', 'PPP'],
    key: { P: PLANKS, L: 'leather' },
    result: { id: BLOCK_ITEM(BlockId.Bookshelf), count: 1 },
  },
  // TNT
  {
    id: 'tnt',
    pattern: ['GSG', 'SGS', 'GSG'],
    key: { G: 'gunpowder', S: BLOCK_ITEM(BlockId.Sand) },
    result: { id: BLOCK_ITEM(BlockId.Tnt), count: 1 },
  },
  // Glowstone
  {
    id: 'glowstone',
    pattern: ['RR', 'RR'],
    key: { R: 'redstone' },
    result: { id: BLOCK_ITEM(BlockId.Glowstone), count: 1 },
  },
  // Bucket & Flint and Steel
  {
    id: 'bucket',
    pattern: ['I I', ' I '],
    key: { I: 'iron_ingot' },
    result: { id: 'bucket', count: 1 },
  },
  {
    id: 'flint_and_steel',
    ingredients: ['iron_ingot', 'flint'],
    result: { id: 'flint_and_steel', count: 1 },
  },
  // Bone Meal
  {
    id: 'bone_meal',
    ingredients: ['bone'],
    result: { id: 'bone_meal', count: 3 },
  },
  // Bow & Arrows
  {
    id: 'bow',
    pattern: [' ST', 'S T', ' ST'],
    key: { S: 'stick', T: 'string' },
    result: { id: 'bow', count: 1 },
  },
  {
    id: 'arrow',
    pattern: ['F', 'S', 'E'],
    key: { F: 'flint', S: 'stick', E: 'feather' },
    result: { id: 'arrow', count: 4 },
  },
  // Bread
  {
    id: 'bread',
    pattern: ['WWW'],
    key: { W: 'wheat' },
    result: { id: 'bread', count: 1 },
  },

  // Wooden Tools
  {
    id: 'wooden_pickaxe',
    pattern: ['PPP', ' S ', ' S '],
    key: { P: PLANKS, S: 'stick' },
    result: { id: 'wooden_pickaxe', count: 1 },
  },
  {
    id: 'wooden_axe',
    pattern: ['PP', 'PS', ' S'],
    key: { P: PLANKS, S: 'stick' },
    result: { id: 'wooden_axe', count: 1 },
  },
  {
    id: 'wooden_shovel',
    pattern: ['P', 'S', 'S'],
    key: { P: PLANKS, S: 'stick' },
    result: { id: 'wooden_shovel', count: 1 },
  },
  {
    id: 'wooden_sword',
    pattern: ['P', 'P', 'S'],
    key: { P: PLANKS, S: 'stick' },
    result: { id: 'wooden_sword', count: 1 },
  },
  {
    id: 'wooden_hoe',
    pattern: ['PP', ' S', ' S'],
    key: { P: PLANKS, S: 'stick' },
    result: { id: 'wooden_hoe', count: 1 },
  },

  // Stone Tools
  {
    id: 'stone_pickaxe',
    pattern: ['CCC', ' S ', ' S '],
    key: { C: BLOCK_ITEM(BlockId.Cobblestone), S: 'stick' },
    result: { id: 'stone_pickaxe', count: 1 },
  },
  {
    id: 'stone_axe',
    pattern: ['CC', 'CS', ' S'],
    key: { C: BLOCK_ITEM(BlockId.Cobblestone), S: 'stick' },
    result: { id: 'stone_axe', count: 1 },
  },
  {
    id: 'stone_shovel',
    pattern: ['C', 'S', 'S'],
    key: { C: BLOCK_ITEM(BlockId.Cobblestone), S: 'stick' },
    result: { id: 'stone_shovel', count: 1 },
  },
  {
    id: 'stone_sword',
    pattern: ['C', 'C', 'S'],
    key: { C: BLOCK_ITEM(BlockId.Cobblestone), S: 'stick' },
    result: { id: 'stone_sword', count: 1 },
  },
  {
    id: 'stone_hoe',
    pattern: ['CC', ' S', ' S'],
    key: { C: BLOCK_ITEM(BlockId.Cobblestone), S: 'stick' },
    result: { id: 'stone_hoe', count: 1 },
  },

  // Iron Tools
  {
    id: 'iron_pickaxe',
    pattern: ['III', ' S ', ' S '],
    key: { I: 'iron_ingot', S: 'stick' },
    result: { id: 'iron_pickaxe', count: 1 },
  },
  {
    id: 'iron_axe',
    pattern: ['II', 'IS', ' S'],
    key: { I: 'iron_ingot', S: 'stick' },
    result: { id: 'iron_axe', count: 1 },
  },
  {
    id: 'iron_shovel',
    pattern: ['I', 'S', 'S'],
    key: { I: 'iron_ingot', S: 'stick' },
    result: { id: 'iron_shovel', count: 1 },
  },
  {
    id: 'iron_sword',
    pattern: ['I', 'I', 'S'],
    key: { I: 'iron_ingot', S: 'stick' },
    result: { id: 'iron_sword', count: 1 },
  },
  {
    id: 'iron_hoe',
    pattern: ['II', ' S', ' S'],
    key: { I: 'iron_ingot', S: 'stick' },
    result: { id: 'iron_hoe', count: 1 },
  },

  // Diamond Tools
  {
    id: 'diamond_pickaxe',
    pattern: ['DDD', ' S ', ' S '],
    key: { D: 'diamond', S: 'stick' },
    result: { id: 'diamond_pickaxe', count: 1 },
  },
  {
    id: 'diamond_axe',
    pattern: ['DD', 'DS', ' S'],
    key: { D: 'diamond', S: 'stick' },
    result: { id: 'diamond_axe', count: 1 },
  },
  {
    id: 'diamond_shovel',
    pattern: ['D', 'S', 'S'],
    key: { D: 'diamond', S: 'stick' },
    result: { id: 'diamond_shovel', count: 1 },
  },
  {
    id: 'diamond_sword',
    pattern: ['D', 'D', 'S'],
    key: { D: 'diamond', S: 'stick' },
    result: { id: 'diamond_sword', count: 1 },
  },
  {
    id: 'diamond_hoe',
    pattern: ['DD', ' S', ' S'],
    key: { D: 'diamond', S: 'stick' },
    result: { id: 'diamond_hoe', count: 1 },
  },

  // Iron Armor
  {
    id: 'iron_helmet',
    pattern: ['III', 'I I'],
    key: { I: 'iron_ingot' },
    result: { id: 'iron_helmet', count: 1 },
  },
  {
    id: 'iron_chestplate',
    pattern: ['I I', 'III', 'III'],
    key: { I: 'iron_ingot' },
    result: { id: 'iron_chestplate', count: 1 },
  },
  {
    id: 'iron_leggings',
    pattern: ['III', 'I I', 'I I'],
    key: { I: 'iron_ingot' },
    result: { id: 'iron_leggings', count: 1 },
  },
  {
    id: 'iron_boots',
    pattern: ['I I', 'I I'],
    key: { I: 'iron_ingot' },
    result: { id: 'iron_boots', count: 1 },
  },

  // Diamond Armor
  {
    id: 'diamond_helmet',
    pattern: ['DDD', 'D D'],
    key: { D: 'diamond' },
    result: { id: 'diamond_helmet', count: 1 },
  },
  {
    id: 'diamond_chestplate',
    pattern: ['D D', 'DDD', 'DDD'],
    key: { D: 'diamond' },
    result: { id: 'diamond_chestplate', count: 1 },
  },
  {
    id: 'diamond_leggings',
    pattern: ['DDD', 'D D', 'D D'],
    key: { D: 'diamond' },
    result: { id: 'diamond_leggings', count: 1 },
  },
  {
    id: 'diamond_boots',
    pattern: ['D D', 'D D'],
    key: { D: 'diamond' },
    result: { id: 'diamond_boots', count: 1 },
  },

  // Wool colors
  {
    id: 'wool_red',
    ingredients: [BLOCK_ITEM(BlockId.WoolWhite), BLOCK_ITEM(BlockId.Poppy)],
    result: { id: BLOCK_ITEM(BlockId.WoolRed), count: 1 },
  },
  {
    id: 'wool_blue',
    ingredients: [BLOCK_ITEM(BlockId.WoolWhite), 'lapis_lazuli'],
    result: { id: BLOCK_ITEM(BlockId.WoolBlue), count: 1 },
  },
];

export const SMELTING_RECIPES: SmeltRecipe[] = [
  { input: 'raw_iron', output: 'iron_ingot', xp: 0.7 },
  { input: BLOCK_ITEM(BlockId.IronOre), output: 'iron_ingot', xp: 0.7 },
  { input: 'raw_gold', output: 'gold_ingot', xp: 1.0 },
  { input: BLOCK_ITEM(BlockId.GoldOre), output: 'gold_ingot', xp: 1.0 },
  { input: BLOCK_ITEM(BlockId.Sand), output: BLOCK_ITEM(BlockId.Glass), xp: 0.1 },
  { input: BLOCK_ITEM(BlockId.Cobblestone), output: BLOCK_ITEM(BlockId.Stone), xp: 0.1 },
  { input: BLOCK_ITEM(BlockId.OakLog), output: 'charcoal', xp: 0.15 },
  { input: BLOCK_ITEM(BlockId.BirchLog), output: 'charcoal', xp: 0.15 },
  { input: BLOCK_ITEM(BlockId.SpruceLog), output: 'charcoal', xp: 0.15 },
  { input: BLOCK_ITEM(BlockId.Clay), output: BLOCK_ITEM(BlockId.Bricks), xp: 0.3 },
  { input: 'raw_beef', output: 'cooked_beef', xp: 0.35 },
  { input: 'raw_porkchop', output: 'cooked_porkchop', xp: 0.35 },
  { input: 'raw_mutton', output: 'cooked_mutton', xp: 0.35 },
];

export function findSmeltOutput(inputId: ItemId | null): SmeltRecipe | null {
  if (!inputId) return null;
  return SMELTING_RECIPES.find((r) => r.input === inputId) ?? null;
}

function matchesItem(actual: ItemId | null, expected: ItemId | ItemId[] | undefined): boolean {
  if (!expected) return actual === null;
  if (!actual) return false;
  return Array.isArray(expected) ? expected.includes(actual) : actual === expected;
}

export function matchCraftingGrid(
  grid: (ItemStack | null)[],
  gridSize: 2 | 3
): CraftingRecipe | null {
  const nonEmpty: { r: number; c: number; id: ItemId }[] = [];
  for (let r = 0; r < gridSize; r++) {
    for (let c = 0; c < gridSize; c++) {
      const slot = grid[r * gridSize + c];
      if (slot && slot.count > 0) {
        nonEmpty.push({ r, c, id: slot.id });
      }
    }
  }
  if (nonEmpty.length === 0) return null;

  let minR: number = gridSize,
    maxR = -1,
    minC: number = gridSize,
    maxC = -1;
  for (const cell of nonEmpty) {
    if (cell.r < minR) minR = cell.r;
    if (cell.r > maxR) maxR = cell.r;
    if (cell.c < minC) minC = cell.c;
    if (cell.c > maxC) maxC = cell.c;
  }
  const boundH = maxR - minR + 1;
  const boundW = maxC - minC + 1;

  for (const recipe of CRAFTING_RECIPES) {
    if (recipe.ingredients) {
      if (nonEmpty.length !== recipe.ingredients.length) continue;
      const pool = nonEmpty.map((x) => x.id);
      let ok = true;
      for (const req of recipe.ingredients) {
        const idx = pool.indexOf(req);
        if (idx === -1) {
          ok = false;
          break;
        }
        pool.splice(idx, 1);
      }
      if (ok) return recipe;
    } else if (recipe.pattern && recipe.key) {
      const patH = recipe.pattern.length;
      const patW = recipe.pattern[0].length;
      if (patH !== boundH || patW !== boundW) continue;

      const checkPattern = (mirror: boolean): boolean => {
        for (let pr = 0; pr < patH; pr++) {
          for (let pc = 0; pc < patW; pc++) {
            const ch = recipe.pattern![pr][mirror ? patW - 1 - pc : pc];
            const slot = grid[(minR + pr) * gridSize + (minC + pc)];
            const actualId = slot && slot.count > 0 ? slot.id : null;
            if (ch === ' ') {
              if (actualId !== null) return false;
            } else {
              if (!matchesItem(actualId, recipe.key![ch])) return false;
            }
          }
        }
        return true;
      };

      if (checkPattern(false) || checkPattern(true)) {
        return recipe;
      }
    }
  }

  return null;
}
