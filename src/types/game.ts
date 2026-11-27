export type GamePhase = 'title' | 'playing' | 'paused' | 'dead';

export type GameMode = 'survival' | 'hardcore' | 'creative' | 'spectator';

export type DimensionType = 'overworld' | 'nether';

export type BiomeType = 'plains' | 'forest' | 'desert' | 'taiga' | 'mountains' | 'cherry';

export type WeatherType = 'clear' | 'rain';

export type GraphicsQuality = 'fast' | 'fancy' | 'vibrant';
export type CloudStyle = 'fancy' | 'fast' | 'off';
export type LeafQuality = 'fancy' | 'fast';

export type ContainerType =
  | 'none'
  | 'inventory'
  | 'crafting_table'
  | 'furnace'
  | 'chest'
  | 'enchanting'
  | 'creative';

export enum BlockId {
  Air = 0,
  Bedrock = 1,
  Stone = 2,
  Cobblestone = 3,
  Dirt = 4,
  GrassBlock = 5,
  Sand = 6,
  Gravel = 7,
  OakLog = 8,
  OakLeaves = 9,
  OakPlanks = 10,
  BirchLog = 11,
  BirchLeaves = 12,
  BirchPlanks = 13,
  SpruceLog = 14,
  SpruceLeaves = 15,
  SprucePlanks = 16,
  Water = 17,
  Lava = 18,
  CoalOre = 19,
  IronOre = 20,
  GoldOre = 21,
  DiamondOre = 22,
  RedstoneOre = 23,
  LapisOre = 24,
  EmeraldOre = 25,
  CraftingTable = 26,
  Furnace = 27,
  Chest = 28,
  Glass = 29,
  Torch = 30,
  Glowstone = 31,
  Obsidian = 32,
  SnowBlock = 33,
  Ice = 34,
  Cactus = 35,
  TallGrass = 36,
  Dandelion = 37,
  Poppy = 38,
  StoneBricks = 39,
  Bricks = 40,
  Bookshelf = 41,
  Tnt = 42,
  WoolWhite = 43,
  WoolRed = 44,
  WoolBlue = 45,
  Ladder = 46,
  Clay = 47,
  Netherrack = 48,
  Bed = 49,
  Farmland = 50,
  WheatCrop0 = 51,
  WheatCrop1 = 52,
  WheatCrop2 = 53,
  WheatCrop3 = 54,
  OakSapling = 55,
  OakDoorClosed = 56,
  OakDoorOpen = 57,
  OakFence = 58,
  EnchantingTable = 59,
  NetherPortal = 60,
  NetherQuartzOre = 61,
  SoulSand = 62,
  RedstoneWire = 63,
  RedstoneWireOn = 64,
  RedstoneTorch = 65,
  LeverOff = 66,
  LeverOn = 67,
  RedstoneLampOff = 68,
  RedstoneLampOn = 69,
  Deepslate = 70,
  CopperOre = 71,
  CopperBlock = 72,
  CherryLog = 73,
  CherryLeaves = 74,
  CherryPlanks = 75,
  AmethystBlock = 76,
}

export type ItemId =
  | `block:${BlockId}`
  | 'stick'
  | 'coal'
  | 'charcoal'
  | 'raw_iron'
  | 'iron_ingot'
  | 'raw_gold'
  | 'gold_ingot'
  | 'diamond'
  | 'emerald'
  | 'lapis_lazuli'
  | 'redstone'
  | 'quartz'
  | 'flint'
  | 'leather'
  | 'feather'
  | 'string'
  | 'bone'
  | 'bone_meal'
  | 'gunpowder'
  | 'rotten_flesh'
  | 'ender_pearl'
  | 'flint_and_steel'
  | 'wheat_seeds'
  | 'wheat'
  | 'bread'
  | 'apple'
  | 'raw_beef'
  | 'cooked_beef'
  | 'raw_porkchop'
  | 'cooked_porkchop'
  | 'raw_mutton'
  | 'cooked_mutton'
  | 'arrow'
  | 'bow'
  | 'bucket'
  | 'water_bucket'
  | 'lava_bucket'
  | 'wooden_pickaxe'
  | 'wooden_axe'
  | 'wooden_shovel'
  | 'wooden_sword'
  | 'wooden_hoe'
  | 'stone_pickaxe'
  | 'stone_axe'
  | 'stone_shovel'
  | 'stone_sword'
  | 'stone_hoe'
  | 'iron_pickaxe'
  | 'iron_axe'
  | 'iron_shovel'
  | 'iron_sword'
  | 'iron_hoe'
  | 'diamond_pickaxe'
  | 'diamond_axe'
  | 'diamond_shovel'
  | 'diamond_sword'
  | 'diamond_hoe'
  | 'iron_helmet'
  | 'iron_chestplate'
  | 'iron_leggings'
  | 'iron_boots'
  | 'diamond_helmet'
  | 'diamond_chestplate'
  | 'diamond_leggings'
  | 'diamond_boots'
  | 'raw_copper'
  | 'copper_ingot'
  | 'shield'
  | 'spyglass'
  | 'mace';

export type ToolCategory = 'none' | 'pickaxe' | 'axe' | 'shovel' | 'sword' | 'hoe';
export type ArmorSlotType = 'helmet' | 'chestplate' | 'leggings' | 'boots';

export interface EnchantmentData {
  id: 'efficiency' | 'sharpness' | 'unbreaking' | 'protection';
  label: string;
  level: number;
}

export interface ItemStack {
  id: ItemId;
  count: number;
  durability?: number;
  enchantment?: EnchantmentData;
}

export interface ItemDefinition {
  id: ItemId;
  name: string;
  stackSize: number;
  blockId?: BlockId;
  toolCategory?: ToolCategory;
  toolTier?: number; // 1 wood, 2 stone, 3 iron, 4 diamond
  miningSpeed?: number;
  attackDamage?: number;
  maxDurability?: number;
  foodHunger?: number;
  foodSaturation?: number;
  armorSlot?: ArmorSlotType;
  armorDefense?: number;
  fuelTicks?: number;
}

export interface BlockDefinition {
  id: BlockId;
  name: string;
  hardness: number; // -1 = unbreakable (bedrock)
  preferredTool: ToolCategory;
  minTier: number; // 0=hand, 1=wood, 2=stone, 3=iron, 4=diamond
  transparent: boolean;
  solid: boolean;
  liquid: boolean;
  crossPlant?: boolean;
  torchLike?: boolean;
  climbable?: boolean;
  halfSlab?: boolean;
  fenceLike?: boolean;
  lightLevel: number; // 0..15
  dropItem: ItemId | null;
  dropCount?: number;
  soundGroup: 'stone' | 'dirt' | 'grass' | 'wood' | 'sand' | 'glass' | 'leaves' | 'snow' | 'wool' | 'water';
  flammable?: boolean;
}

export interface FurnaceState {
  input: ItemStack | null;
  fuel: ItemStack | null;
  output: ItemStack | null;
  burnTime: number;
  maxBurnTime: number;
  cookTime: number;
  maxCookTime: number;
}

export interface ChestState {
  slots: (ItemStack | null)[]; // 27 slots
}

export type MobType = 'sheep' | 'cow' | 'pig' | 'zombie' | 'skeleton' | 'creeper' | 'spider' | 'enderman';

export interface ChatMessage {
  id: string;
  text: string;
  color?: string;
  timestamp: number;
}

export interface AdvancementToast {
  id: string;
  title: string;
  description: string;
  timestamp: number;
}

export interface GameOptions {
  fov: number;
  renderDistance: number; // chunks radius (3..8)
  mouseSensitivity: number;
  soundVolume: number;
  muted: boolean;
  showClouds: boolean;
  graphicsQuality: GraphicsQuality;
  cloudStyle: CloudStyle;
  leafQuality: LeafQuality;
  touchControls: 'auto' | 'on' | 'off';
}

export interface HudSnapshot {
  health: number;
  maxHealth: number;
  hunger: number;
  maxHunger: number;
  saturation: number;
  armor: number;
  air: number;
  maxAir: number;
  xpLevel: number;
  xpProgress: number;
  score: number;
  gameMode: GameMode;
  dimension: DimensionType;
  portalCharge: number;
  selectedHotbar: number;
  hotbar: (ItemStack | null)[];
  inventory: (ItemStack | null)[]; // 27 slots
  armorSlots: (ItemStack | null)[]; // 4 slots: helmet, chest, legs, boots
  activeContainer: ContainerType;
  activeBlockPos: { x: number; y: number; z: number } | null;
  furnaceState: FurnaceState | null;
  chestState: ChestState | null;
  cameraMode: 0 | 1 | 2; // 0=first, 1=3rd back, 2=3rd front
  isFlying: boolean;
  isSprinting: boolean;
  isSneaking: boolean;
  isUnderwater: boolean;
  isInLava: boolean;
  isSwimming: boolean;
  isBlocking: boolean;
  isSpyglassZoom: boolean;
  attackCharge: number;
  damageFlash: number;
  advancements: string[];
  targetBlock: {
    x: number;
    y: number;
    z: number;
    id: BlockId;
    name: string;
    breakProgress: number;
  } | null;
  debug: {
    fps: number;
    x: number;
    y: number;
    z: number;
    chunkX: number;
    chunkZ: number;
    facing: string;
    yaw: number;
    pitch: number;
    biome: BiomeType;
    dayTime: number;
    dayCount: number;
    weather: WeatherType;
    mobCount: number;
    loadedChunks: number;
    seed: number;
  };
}
