import * as THREE from 'three';
import { BlockId, ItemId } from '../types/game';

// 8x10 tile grid of 16x16 pixel art tiles -> 128x160 atlas
export const ATLAS_COLS = 8;
export const ATLAS_ROWS = 10;
export const TILE_PX = 16;

export const enum Tile {
  Bedrock = 0,
  Stone = 1,
  Cobblestone = 2,
  Dirt = 3,
  GrassTop = 4,
  GrassSide = 5,
  Sand = 6,
  Gravel = 7,
  OakLogSide = 8,
  OakLogTop = 9,
  OakLeaves = 10,
  OakPlanks = 11,
  BirchLogSide = 12,
  BirchLogTop = 13,
  BirchLeaves = 14,
  BirchPlanks = 15,
  SpruceLogSide = 16,
  SpruceLogTop = 17,
  SpruceLeaves = 18,
  SprucePlanks = 19,
  Water = 20,
  Lava = 21,
  CoalOre = 22,
  IronOre = 23,
  GoldOre = 24,
  DiamondOre = 25,
  RedstoneOre = 26,
  LapisOre = 27,
  EmeraldOre = 28,
  CraftingTop = 29,
  CraftingSide = 30,
  FurnaceFront = 31,
  FurnaceSide = 32,
  ChestFront = 33,
  ChestSide = 34,
  ChestTop = 35,
  Glass = 36,
  Torch = 37,
  Glowstone = 38,
  Obsidian = 39,
  Snow = 40,
  Ice = 41,
  CactusSide = 42,
  CactusTop = 43,
  TallGrass = 44,
  Dandelion = 45,
  Poppy = 46,
  StoneBricks = 47,
  Bricks = 48,
  Bookshelf = 49,
  TntSide = 50,
  TntTop = 51,
  WoolWhite = 52,
  WoolRed = 53,
  WoolBlue = 54,
  Ladder = 55,
  Clay = 56,
  Netherrack = 57,
  FurnaceTop = 58,
  TntBottom = 59,
  BedTop = 60,
  BedSide = 61,
  FarmlandTop = 62,
  Wheat0 = 63,
  Wheat1 = 64,
  Wheat2 = 65,
  Wheat3 = 66,
  OakSapling = 67,
  OakDoor = 68,
  EnchantTop = 69,
  EnchantSide = 70,
}

export type FaceDir = 'px' | 'nx' | 'py' | 'ny' | 'pz' | 'nz';

export function getBlockFaceTile(blockId: BlockId, face: FaceDir): Tile {
  switch (blockId) {
    case BlockId.Bedrock:
      return Tile.Bedrock;
    case BlockId.Stone:
      return Tile.Stone;
    case BlockId.Cobblestone:
      return Tile.Cobblestone;
    case BlockId.Dirt:
      return Tile.Dirt;
    case BlockId.GrassBlock:
      if (face === 'py') return Tile.GrassTop;
      if (face === 'ny') return Tile.Dirt;
      return Tile.GrassSide;
    case BlockId.Sand:
      return Tile.Sand;
    case BlockId.Gravel:
      return Tile.Gravel;
    case BlockId.OakLog:
      return face === 'py' || face === 'ny' ? Tile.OakLogTop : Tile.OakLogSide;
    case BlockId.OakLeaves:
      return Tile.OakLeaves;
    case BlockId.OakPlanks:
      return Tile.OakPlanks;
    case BlockId.BirchLog:
      return face === 'py' || face === 'ny' ? Tile.BirchLogTop : Tile.BirchLogSide;
    case BlockId.BirchLeaves:
      return Tile.BirchLeaves;
    case BlockId.BirchPlanks:
      return Tile.BirchPlanks;
    case BlockId.SpruceLog:
      return face === 'py' || face === 'ny' ? Tile.SpruceLogTop : Tile.SpruceLogSide;
    case BlockId.SpruceLeaves:
      return Tile.SpruceLeaves;
    case BlockId.SprucePlanks:
      return Tile.SprucePlanks;
    case BlockId.Water:
      return Tile.Water;
    case BlockId.Lava:
      return Tile.Lava;
    case BlockId.CoalOre:
      return Tile.CoalOre;
    case BlockId.IronOre:
      return Tile.IronOre;
    case BlockId.GoldOre:
      return Tile.GoldOre;
    case BlockId.DiamondOre:
      return Tile.DiamondOre;
    case BlockId.RedstoneOre:
      return Tile.RedstoneOre;
    case BlockId.LapisOre:
      return Tile.LapisOre;
    case BlockId.EmeraldOre:
      return Tile.EmeraldOre;
    case BlockId.CraftingTable:
      if (face === 'py') return Tile.CraftingTop;
      if (face === 'ny') return Tile.OakPlanks;
      return Tile.CraftingSide;
    case BlockId.Furnace:
      if (face === 'py' || face === 'ny') return Tile.FurnaceTop;
      if (face === 'pz') return Tile.FurnaceFront;
      return Tile.FurnaceSide;
    case BlockId.Chest:
      if (face === 'py' || face === 'ny') return Tile.ChestTop;
      if (face === 'pz') return Tile.ChestFront;
      return Tile.ChestSide;
    case BlockId.Glass:
      return Tile.Glass;
    case BlockId.Torch:
      return Tile.Torch;
    case BlockId.Glowstone:
      return Tile.Glowstone;
    case BlockId.Obsidian:
      return Tile.Obsidian;
    case BlockId.SnowBlock:
      return Tile.Snow;
    case BlockId.Ice:
      return Tile.Ice;
    case BlockId.Cactus:
      return face === 'py' || face === 'ny' ? Tile.CactusTop : Tile.CactusSide;
    case BlockId.TallGrass:
      return Tile.TallGrass;
    case BlockId.Dandelion:
      return Tile.Dandelion;
    case BlockId.Poppy:
      return Tile.Poppy;
    case BlockId.StoneBricks:
      return Tile.StoneBricks;
    case BlockId.Bricks:
      return Tile.Bricks;
    case BlockId.Bookshelf:
      return face === 'py' || face === 'ny' ? Tile.OakPlanks : Tile.Bookshelf;
    case BlockId.Tnt:
      if (face === 'py') return Tile.TntTop;
      if (face === 'ny') return Tile.TntBottom;
      return Tile.TntSide;
    case BlockId.WoolWhite:
      return Tile.WoolWhite;
    case BlockId.WoolRed:
      return Tile.WoolRed;
    case BlockId.WoolBlue:
      return Tile.WoolBlue;
    case BlockId.Ladder:
      return Tile.Ladder;
    case BlockId.Clay:
      return Tile.Clay;
    case BlockId.Netherrack:
      return Tile.Netherrack;
    case BlockId.Bed:
      return face === 'py' ? Tile.BedTop : face === 'ny' ? Tile.OakPlanks : Tile.BedSide;
    case BlockId.Farmland:
      return face === 'py' ? Tile.FarmlandTop : Tile.Dirt;
    case BlockId.WheatCrop0:
      return Tile.Wheat0;
    case BlockId.WheatCrop1:
      return Tile.Wheat1;
    case BlockId.WheatCrop2:
      return Tile.Wheat2;
    case BlockId.WheatCrop3:
      return Tile.Wheat3;
    case BlockId.OakSapling:
      return Tile.OakSapling;
    case BlockId.OakDoorClosed:
    case BlockId.OakDoorOpen:
      return Tile.OakDoor;
    case BlockId.OakFence:
      return Tile.OakPlanks;
    case BlockId.EnchantingTable:
      return face === 'py' ? Tile.EnchantTop : face === 'ny' ? Tile.Obsidian : Tile.EnchantSide;
    default:
      return Tile.Stone;
  }
}

function pxHash(x: number, y: number, seed: number): number {
  let h = (Math.imul(x + 17, 374761393) + Math.imul(y + 31, 668265263) + Math.imul(seed, 1442695041)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function drawTilePixel(ctx: CanvasRenderingContext2D, tile: Tile, px: number, py: number, color: string) {
  if (px < 0 || px > 15 || py < 0 || py > 15) return;
  const tx = (tile % ATLAS_COLS) * TILE_PX;
  const ty = Math.floor(tile / ATLAS_COLS) * TILE_PX;
  ctx.fillStyle = color;
  ctx.fillRect(tx + px, ty + py, 1, 1);
}

function fillNoiseTile(ctx: CanvasRenderingContext2D, tile: Tile, palette: string[], seed: number, alpha = 1) {
  const tx = (tile % ATLAS_COLS) * TILE_PX;
  const ty = Math.floor(tile / ATLAS_COLS) * TILE_PX;
  ctx.save();
  ctx.globalAlpha = alpha;
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const idx = Math.floor(pxHash(x, y, seed) * palette.length);
      ctx.fillStyle = palette[idx];
      ctx.fillRect(tx + x, ty + y, 1, 1);
    }
  }
  ctx.restore();
}

function fillStoneTile(ctx: CanvasRenderingContext2D, tile: Tile, seed = 12) {
  const palette = ['#7e7e7e', '#767676', '#868686', '#707070', '#8d8d8d'];
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      // Java-style subtle horizontal strata streaks
      const strata = pxHash(Math.floor(x / 2), y, seed);
      const grain = pxHash(x, y, seed + 50);
      const idx = Math.floor((strata * 0.65 + grain * 0.35) * palette.length);
      drawTilePixel(ctx, tile, x, y, palette[Math.min(palette.length - 1, idx)]);
    }
  }
}

function drawOre(
  ctx: CanvasRenderingContext2D,
  tile: Tile,
  darkCol: string,
  midCol: string,
  brightCol: string,
  seed: number
) {
  fillStoneTile(ctx, tile, 12);
  const clusters = [
    [[2, 3], [3, 3], [4, 3], [3, 4], [4, 4]],
    [[10, 2], [11, 2], [11, 3], [12, 3], [10, 4]],
    [[6, 7], [7, 7], [8, 7], [7, 8], [8, 8], [6, 8]],
    [[11, 10], [12, 10], [13, 10], [12, 11], [13, 11]],
    [[2, 11], [3, 11], [3, 12], [4, 12], [2, 12]],
  ];
  clusters.forEach((cluster, ci) => {
    cluster.forEach(([x, y], pi) => {
      // Stone rim shadow around nuggets
      if (pi === 0) drawTilePixel(ctx, tile, x - 1, y, '#595959');
      const r = pxHash(x, y, seed + ci * 7 + pi);
      const col = r > 0.72 ? brightCol : r > 0.3 ? midCol : darkCol;
      drawTilePixel(ctx, tile, x, y, col);
    });
  });
}

function drawPlanks(
  ctx: CanvasRenderingContext2D,
  tile: Tile,
  shades: string[],
  highlightCol: string,
  lineCol: string
) {
  for (let y = 0; y < 16; y++) {
    const plankRow = Math.floor(y / 4);
    const rowY = y % 4;
    for (let x = 0; x < 16; x++) {
      const isVertSeam = (plankRow % 2 === 0 && x === 7) || (plankRow % 2 === 1 && x === 14);
      if (rowY === 0 || isVertSeam) {
        drawTilePixel(ctx, tile, x, y, lineCol);
      } else if (rowY === 1) {
        const g = pxHash(Math.floor(x / 3), y, tile + 301);
        drawTilePixel(ctx, tile, x, y, g > 0.55 ? highlightCol : shades[0]);
      } else {
        const streak = pxHash(Math.floor(x / 2), y, tile + 300);
        drawTilePixel(ctx, tile, x, y, shades[Math.floor(streak * shades.length)]);
      }
    }
  }
}

function drawLog(
  ctx: CanvasRenderingContext2D,
  sideTile: Tile,
  topTile: Tile,
  bark: string[],
  ringCol: string,
  heartCol: string,
  birchSpots = false
) {
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      if (birchSpots) {
        const spot =
          ((y === 2 || y === 3) && x >= 2 && x <= 5) ||
          ((y === 6 || y === 7) && x >= 9 && x <= 13) ||
          ((y === 11 || y === 12) && x >= 4 && x <= 8) ||
          (y === 14 && x >= 11 && x <= 14);
        const c = spot
          ? pxHash(x, y, 444) > 0.35
            ? '#33332f'
            : '#5c5c56'
          : bark[Math.floor(pxHash(x, Math.floor(y / 2), 401) * (bark.length - 1))];
        drawTilePixel(ctx, sideTile, x, y, c);
      } else {
        const verticalGrain = pxHash(x, Math.floor(y / 3), sideTile + 400);
        const groove = x % 4 === 0 ? 0 : Math.floor(verticalGrain * bark.length);
        drawTilePixel(ctx, sideTile, x, y, bark[Math.min(bark.length - 1, groove)]);
      }
    }
  }
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const distEdge = Math.min(x, 15 - x, y, 15 - y);
      if (distEdge === 0) {
        drawTilePixel(ctx, topTile, x, y, bark[0]);
      } else if (distEdge === 1) {
        drawTilePixel(ctx, topTile, x, y, bark[1] ?? bark[0]);
      } else if (distEdge === 3 || distEdge === 5) {
        drawTilePixel(ctx, topTile, x, y, ringCol);
      } else {
        const shade = pxHash(x, y, topTile + 90) > 0.6 ? ringCol : heartCol;
        drawTilePixel(ctx, topTile, x, y, shade);
      }
    }
  }
}

function drawLeaves(ctx: CanvasRenderingContext2D, tile: Tile, greens: string[], seed: number) {
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const cluster = pxHash(Math.floor(x / 2), Math.floor(y / 2), seed + 19);
      const detail = pxHash(x, y, seed);
      if (cluster * 0.55 + detail * 0.45 < 0.23) continue;
      const idx = Math.floor((cluster * 0.4 + detail * 0.6) * greens.length);
      drawTilePixel(ctx, tile, x, y, greens[Math.min(greens.length - 1, idx)]);
    }
  }
}

export function buildTextureAtlas(maxAnisotropy: number): {
  canvas: HTMLCanvasElement;
  atlasTexture: THREE.CanvasTexture;
  crackTextures: THREE.CanvasTexture[];
} {
  const canvas = document.createElement('canvas');
  canvas.width = ATLAS_COLS * TILE_PX;
  canvas.height = ATLAS_ROWS * TILE_PX;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  fillNoiseTile(ctx, Tile.Bedrock, ['#2a2a2a', '#434343', '#1a1a1a', '#595959', '#333333'], 11);
  fillStoneTile(ctx, Tile.Stone, 12);

  // Authentic Java Cobblestone with rounded stone cells & dark mortar
  fillNoiseTile(ctx, Tile.Cobblestone, ['#7b7b7b', '#6b6b6b', '#8e8e8e', '#5e5e5e'], 13);
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const row = Math.floor(y / 4);
      const isMortarH = y % 4 === 0;
      const isMortarV = (row % 2 === 0 && (x === 0 || x === 6 || x === 11)) || (row % 2 === 1 && (x === 3 || x === 9 || x === 14));
      if (isMortarH || isMortarV) {
        drawTilePixel(ctx, Tile.Cobblestone, x, y, '#484848');
      } else if (y % 4 === 1) {
        drawTilePixel(ctx, Tile.Cobblestone, x, y, '#9c9c9c');
      }
    }
  }

  // Authentic Java Stone Bricks (like Screenshot 1!)
  fillNoiseTile(ctx, Tile.StoneBricks, ['#7a7a7a', '#727272', '#828282', '#6b6b6b'], 75);
  for (let x = 0; x < 16; x++) {
    // Dark mortar seams
    drawTilePixel(ctx, Tile.StoneBricks, x, 0, '#494949');
    drawTilePixel(ctx, Tile.StoneBricks, x, 8, '#494949');
    // Subtle top edge highlight on each brick row
    drawTilePixel(ctx, Tile.StoneBricks, x, 1, '#929292');
    drawTilePixel(ctx, Tile.StoneBricks, x, 9, '#929292');
    // Subtle bottom shadow
    drawTilePixel(ctx, Tile.StoneBricks, x, 7, '#5a5a5a');
    drawTilePixel(ctx, Tile.StoneBricks, x, 15, '#5a5a5a');
  }
  for (let y = 0; y < 8; y++) {
    drawTilePixel(ctx, Tile.StoneBricks, 7, y, '#494949');
    drawTilePixel(ctx, Tile.StoneBricks, 8, y, '#919191');
  }
  for (let y = 8; y < 16; y++) {
    drawTilePixel(ctx, Tile.StoneBricks, 0, y, '#494949');
    drawTilePixel(ctx, Tile.StoneBricks, 1, y, '#919191');
    drawTilePixel(ctx, Tile.StoneBricks, 15, y, '#5a5a5a');
  }

  // Dirt & Grass
  fillNoiseTile(ctx, Tile.Dirt, ['#866043', '#79553a', '#966c4a', '#593d29', '#6e4d34'], 14);
  fillNoiseTile(ctx, Tile.GrassTop, ['#5ea33e', '#6ab246', '#529336', '#76c04f', '#64aa42'], 15);

  fillNoiseTile(ctx, Tile.GrassSide, ['#866043', '#79553a', '#966c4a', '#593d29'], 14);
  for (let x = 0; x < 16; x++) {
    const drop = 2 + Math.floor(pxHash(x, 0, 99) * 3);
    for (let y = 0; y <= drop; y++) {
      const col = y === drop ? '#457c2c' : y === 0 ? '#79c252' : pxHash(x, y, 88) > 0.45 ? '#5da13f' : '#6cb349';
      drawTilePixel(ctx, Tile.GrassSide, x, y, col);
    }
    // Dirt shadow directly beneath the grass overhang
    drawTilePixel(ctx, Tile.GrassSide, x, drop + 1, '#4d3523');
  }

  fillNoiseTile(ctx, Tile.Sand, ['#dfd7a6', '#d5cc95', '#e7dfb0', '#cbbd85'], 16);
  fillNoiseTile(ctx, Tile.Gravel, ['#878383', '#716d6d', '#9b9797', '#625e5e'], 17);
  fillNoiseTile(ctx, Tile.Clay, ['#9ea4b0', '#9198a6', '#aeb4bf', '#89909c'], 18);
  fillNoiseTile(ctx, Tile.Netherrack, ['#6d3131', '#5a2525', '#7f3c3c', '#4b1e1e'], 19);

  drawLog(ctx, Tile.OakLogSide, Tile.OakLogTop, ['#4d3820', '#63492c', '#735635', '#573f25'], '#9c7d4e', '#ba9660');
  drawLeaves(ctx, Tile.OakLeaves, ['#35751f', '#449129', '#2b6118', '#56a635'], 201);
  drawPlanks(ctx, Tile.OakPlanks, ['#a37f4b', '#b28e56', '#947240', '#ab8650'], '#be9b63', '#6b4f2b');

  drawLog(ctx, Tile.BirchLogSide, Tile.BirchLogTop, ['#e3e1da', '#d5d2ca', '#eeede8'], '#c2ad7f', '#d7c394', true);
  drawLeaves(ctx, Tile.BirchLeaves, ['#558b3c', '#639c47', '#487932', '#72ab54'], 202);
  drawPlanks(ctx, Tile.BirchPlanks, ['#cbb987', '#d8c796', '#bda975', '#c3b07e'], '#e4d5a6', '#8f7e56');

  drawLog(ctx, Tile.SpruceLogSide, Tile.SpruceLogTop, ['#26180c', '#362212', '#442c18', '#2c1b0e'], '#785838', '#8d6945');
  drawLeaves(ctx, Tile.SpruceLeaves, ['#2d5133', '#365f3d', '#234228', '#3f6d47'], 203);
  drawPlanks(ctx, Tile.SprucePlanks, ['#6d4c2c', '#7a5633', '#5f4125', '#73502f'], '#87613d', '#472f19');

  // Water & Lava with crisp ripple streaks
  fillNoiseTile(ctx, Tile.Water, ['#2b66ea', '#2458d4', '#3977f7', '#2f6bf0'], 21, 0.8);
  for (let y = 2; y < 16; y += 5) {
    for (let x = 2; x < 14; x += 4) {
      drawTilePixel(ctx, Tile.Water, x, y, '#6ca4ff');
      drawTilePixel(ctx, Tile.Water, x + 1, y, '#5994ff');
    }
  }
  fillNoiseTile(ctx, Tile.Lava, ['#e65c19', '#f5891d', '#d13c0c', '#ffae2b'], 22);
  for (let y = 1; y < 15; y += 4) {
    for (let x = 1; x < 15; x += 5) {
      drawTilePixel(ctx, Tile.Lava, x, y, '#ffe666');
      drawTilePixel(ctx, Tile.Lava, x + 1, y + 1, '#ff981f');
    }
  }

  drawOre(ctx, Tile.CoalOre, '#151515', '#252525', '#3c3c3c', 31);
  drawOre(ctx, Tile.IronOre, '#9c7860', '#d6b095', '#f2d9c4', 32);
  drawOre(ctx, Tile.GoldOre, '#b88614', '#fcee4b', '#fff9a8', 33);
  drawOre(ctx, Tile.DiamondOre, '#1d9b98', '#4eece8', '#b8fffd', 34);
  drawOre(ctx, Tile.RedstoneOre, '#8c0a0a', '#e61919', '#ff6e6e', 35);
  drawOre(ctx, Tile.LapisOre, '#11297a', '#2658db', '#648eff', 36);
  drawOre(ctx, Tile.EmeraldOre, '#0b8538', '#17dd62', '#82ffae', 37);

  // Crafting Table Top & Side
  drawPlanks(ctx, Tile.CraftingTop, ['#a8804e', '#9a7343'], '#bc9460', '#4f3518');
  for (let x = 2; x <= 13; x++) {
    drawTilePixel(ctx, Tile.CraftingTop, x, 2, '#3c2610');
    drawTilePixel(ctx, Tile.CraftingTop, x, 13, '#3c2610');
    drawTilePixel(ctx, Tile.CraftingTop, 2, x, '#3c2610');
    drawTilePixel(ctx, Tile.CraftingTop, 13, x, '#3c2610');
  }
  for (let i = 5; i <= 10; i += 4) {
    for (let j = 3; j <= 12; j++) {
      drawTilePixel(ctx, Tile.CraftingTop, i, j, '#3c2610');
      drawTilePixel(ctx, Tile.CraftingTop, j, i, '#3c2610');
    }
  }
  drawPlanks(ctx, Tile.CraftingSide, ['#9e7b49', '#8f6e3f'], '#b5905c', '#5c4120');
  for (let y = 3; y <= 11; y++) {
    for (let x = 3; x <= 6; x++) drawTilePixel(ctx, Tile.CraftingSide, x, y, x === 3 ? '#757575' : '#4a4a4a');
    for (let x = 9; x <= 12; x++) drawTilePixel(ctx, Tile.CraftingSide, x, y, y < 6 ? '#6b6b6b' : '#3d2814');
  }

  // Furnace (Screenshot 1)
  fillStoneTile(ctx, Tile.FurnaceSide, 40);
  fillStoneTile(ctx, Tile.FurnaceTop, 41);
  for (let x = 0; x < 16; x++) {
    drawTilePixel(ctx, Tile.FurnaceTop, x, 0, '#4f4f4f');
    drawTilePixel(ctx, Tile.FurnaceTop, x, 15, '#4f4f4f');
    drawTilePixel(ctx, Tile.FurnaceSide, x, 1, '#929292');
    drawTilePixel(ctx, Tile.FurnaceSide, x, 15, '#4c4c4c');
  }
  fillStoneTile(ctx, Tile.FurnaceFront, 42);
  for (let x = 0; x < 16; x++) {
    drawTilePixel(ctx, Tile.FurnaceFront, x, 0, '#555555');
    drawTilePixel(ctx, Tile.FurnaceFront, x, 15, '#454545');
  }
  for (let y = 2; y <= 6; y++) {
    for (let x = 3; x <= 12; x++) {
      drawTilePixel(ctx, Tile.FurnaceFront, x, y, y === 2 || x === 3 || x === 12 ? '#424242' : '#1b1b1b');
    }
  }
  for (let y = 9; y <= 14; y++) {
    for (let x = 4; x <= 11; x++) {
      drawTilePixel(ctx, Tile.FurnaceFront, x, y, y >= 12 && x >= 5 && x <= 10 ? '#d95716' : '#151515');
    }
  }

  // Chest (Screenshot 1)
  fillNoiseTile(ctx, Tile.ChestTop, ['#a8772e', '#966824', '#b88639'], 50);
  fillNoiseTile(ctx, Tile.ChestSide, ['#9e6f29', '#8d6121', '#ab7931'], 51);
  fillNoiseTile(ctx, Tile.ChestFront, ['#9e6f29', '#8d6121', '#ab7931'], 52);
  for (let i = 0; i < 16; i++) {
    drawTilePixel(ctx, Tile.ChestTop, i, 0, '#3e270c');
    drawTilePixel(ctx, Tile.ChestTop, i, 15, '#3e270c');
    drawTilePixel(ctx, Tile.ChestTop, 0, i, '#3e270c');
    drawTilePixel(ctx, Tile.ChestTop, 15, i, '#3e270c');

    drawTilePixel(ctx, Tile.ChestFront, i, 0, '#3e270c');
    drawTilePixel(ctx, Tile.ChestFront, i, 15, '#3e270c');
    drawTilePixel(ctx, Tile.ChestFront, 0, i, '#3e270c');
    drawTilePixel(ctx, Tile.ChestFront, 15, i, '#3e270c');
    drawTilePixel(ctx, Tile.ChestFront, i, 5, '#2b1a07');
    drawTilePixel(ctx, Tile.ChestFront, i, 6, '#c79646');

    drawTilePixel(ctx, Tile.ChestSide, i, 0, '#3e270c');
    drawTilePixel(ctx, Tile.ChestSide, i, 15, '#3e270c');
    drawTilePixel(ctx, Tile.ChestSide, 0, i, '#3e270c');
    drawTilePixel(ctx, Tile.ChestSide, 15, i, '#3e270c');
    drawTilePixel(ctx, Tile.ChestSide, i, 5, '#2b1a07');
  }
  for (let y = 4; y <= 8; y++) {
    for (let x = 7; x <= 8; x++) {
      drawTilePixel(ctx, Tile.ChestFront, x, y, y === 8 ? '#696969' : '#e0e0e0');
    }
  }

  // Authentic Java Glass (Screenshot 1!)
  for (let i = 0; i < 16; i++) {
    drawTilePixel(ctx, Tile.Glass, i, 0, '#a6dce3');
    drawTilePixel(ctx, Tile.Glass, i, 15, '#89c4cc');
    drawTilePixel(ctx, Tile.Glass, 0, i, '#a6dce3');
    drawTilePixel(ctx, Tile.Glass, 15, i, '#89c4cc');
  }
  drawTilePixel(ctx, Tile.Glass, 2, 4, '#ffffff');
  drawTilePixel(ctx, Tile.Glass, 3, 3, '#ffffff');
  drawTilePixel(ctx, Tile.Glass, 4, 2, '#ffffff');
  drawTilePixel(ctx, Tile.Glass, 3, 4, '#d9f6fa');
  drawTilePixel(ctx, Tile.Glass, 11, 13, '#ffffff');
  drawTilePixel(ctx, Tile.Glass, 12, 12, '#ffffff');
  drawTilePixel(ctx, Tile.Glass, 13, 11, '#d9f6fa');

  // Torch
  for (let y = 6; y < 16; y++) {
    drawTilePixel(ctx, Tile.Torch, 7, y, '#7c5933');
    drawTilePixel(ctx, Tile.Torch, 8, y, '#593e22');
  }
  for (let y = 2; y <= 6; y++) {
    for (let x = 7; x <= 8; x++) {
      drawTilePixel(ctx, Tile.Torch, x, y, y <= 4 ? '#fff6a6' : '#ff9914');
    }
  }

  fillNoiseTile(ctx, Tile.Glowstone, ['#f7d36f', '#e5a83c', '#fff0a8', '#b87b22'], 60);
  fillNoiseTile(ctx, Tile.Obsidian, ['#181024', '#26183b', '#100a19', '#362254'], 61);
  fillNoiseTile(ctx, Tile.Snow, ['#f6fbfc', '#edf6f9', '#ffffff', '#e1eff4'], 62);
  fillNoiseTile(ctx, Tile.Ice, ['#8cb8f5', '#9ec5fa', '#7aa9ed', '#b4d5fc'], 63, 0.8);

  fillNoiseTile(ctx, Tile.CactusSide, ['#1f6e27', '#298431', '#18591e', '#34993d'], 64);
  fillNoiseTile(ctx, Tile.CactusTop, ['#298431', '#1f6e27', '#38a142'], 65);
  for (let y = 1; y < 15; y += 3) {
    drawTilePixel(ctx, Tile.CactusSide, 3, y, '#d5e8c8');
    drawTilePixel(ctx, Tile.CactusSide, 12, y + 1, '#d5e8c8');
  }

  for (let x = 2; x <= 13; x += 2) {
    const h = 4 + Math.floor(pxHash(x, 1, 70) * 9);
    for (let y = 15; y >= 15 - h; y--) drawTilePixel(ctx, Tile.TallGrass, x, y, y < 8 ? '#6db843' : '#4f8e2e');
  }
  for (let y = 9; y <= 15; y++) drawTilePixel(ctx, Tile.Dandelion, 7, y, '#478f29');
  for (let y = 5; y <= 8; y++) for (let x = 6; x <= 9; x++) drawTilePixel(ctx, Tile.Dandelion, x, y, '#f8e024');
  for (let y = 8; y <= 15; y++) drawTilePixel(ctx, Tile.Poppy, 7, y, '#478f29');
  for (let y = 4; y <= 7; y++) for (let x = 6; x <= 9; x++) drawTilePixel(ctx, Tile.Poppy, x, y, x === 7 && y === 5 ? '#1b1b1b' : '#df2323');

  // Bricks
  fillNoiseTile(ctx, Tile.Bricks, ['#9c4d3c', '#8a4031', '#ab5845'], 76);
  for (let y = 0; y < 16; y += 4) for (let x = 0; x < 16; x++) drawTilePixel(ctx, Tile.Bricks, x, y, '#c2bdb7');

  // Bookshelf
  drawPlanks(ctx, Tile.Bookshelf, ['#9e7b49', '#8f6e3f'], '#b5905c', '#5c4120');
  const bookCols = ['#a62b2b', '#2b5ca6', '#2b8a3e', '#bfa12b', '#7c3ba6'];
  for (let row = 0; row < 2; row++) {
    const sy = row === 0 ? 2 : 9;
    for (let x = 1; x < 15; x++) {
      const col = bookCols[(x + row * 2) % bookCols.length];
      for (let y = sy; y < sy + 5; y++) drawTilePixel(ctx, Tile.Bookshelf, x, y, y === sy ? '#e8d8b5' : col);
    }
  }

  // TNT
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const band = y >= 5 && y <= 10;
      drawTilePixel(ctx, Tile.TntSide, x, y, band ? '#ececec' : x % 2 === 0 ? '#d13426' : '#b82a1e');
      drawTilePixel(ctx, Tile.TntTop, x, y, x > 4 && x < 11 && y > 4 && y < 11 ? '#333333' : '#d13426');
      drawTilePixel(ctx, Tile.TntBottom, x, y, '#b82a1e');
    }
  }
  const tntPixels = [
    [3,6],[4,6],[5,6],[4,7],[4,8],[4,9],
    [7,6],[7,7],[7,8],[7,9],[8,7],[9,8],[10,6],[10,7],[10,8],[10,9],
    [12,6],[13,6],[14,6],[13,7],[13,8],[13,9],
  ];
  tntPixels.forEach(([x, y]) => drawTilePixel(ctx, Tile.TntSide, x, y, '#141414'));

  fillNoiseTile(ctx, Tile.WoolWhite, ['#ececec', '#dfdfdf', '#f4f4f4'], 80);
  fillNoiseTile(ctx, Tile.WoolRed, ['#b52a2a', '#9e2121', '#c63636'], 81);
  fillNoiseTile(ctx, Tile.WoolBlue, ['#2d41a8', '#24358f', '#384fbf'], 82);

  for (let y = 0; y < 16; y++) {
    drawTilePixel(ctx, Tile.Ladder, 2, y, '#8f693b');
    drawTilePixel(ctx, Tile.Ladder, 3, y, '#7a582f');
    drawTilePixel(ctx, Tile.Ladder, 12, y, '#8f693b');
    drawTilePixel(ctx, Tile.Ladder, 13, y, '#7a582f');
    if (y % 4 === 2) for (let x = 2; x <= 13; x++) drawTilePixel(ctx, Tile.Ladder, x, y, '#9c7444');
  }

  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      drawTilePixel(ctx, Tile.BedTop, x, y, y < 5 ? '#f2f2f2' : '#bd2b2b');
      drawTilePixel(ctx, Tile.BedSide, x, y, y > 11 ? '#7c5933' : y < 8 ? '#bd2b2b' : '#9c7444');
    }
  }

  fillNoiseTile(ctx, Tile.FarmlandTop, ['#593822', '#4d2f1c', '#634028'], 88);
  for (let y = 2; y < 16; y += 4) for (let x = 0; x < 16; x++) drawTilePixel(ctx, Tile.FarmlandTop, x, y, '#3b2212');

  const drawWheatStage = (tile: Tile, h: number, col: string) => {
    for (let x = 2; x <= 14; x += 3) {
      for (let y = 15; y >= 15 - h; y--) {
        drawTilePixel(ctx, tile, x, y, col);
        drawTilePixel(ctx, tile, x + 1, y, col);
      }
    }
  };
  drawWheatStage(Tile.Wheat0, 3, '#4f9c2d');
  drawWheatStage(Tile.Wheat1, 6, '#65b33d');
  drawWheatStage(Tile.Wheat2, 10, '#9eb837');
  drawWheatStage(Tile.Wheat3, 13, '#e3be39');

  for (let y = 9; y <= 15; y++) {
    drawTilePixel(ctx, Tile.OakSapling, 7, y, '#6b4927');
    drawTilePixel(ctx, Tile.OakSapling, 8, y, '#593b1f');
  }
  for (let y = 3; y <= 9; y++) {
    for (let x = 4; x <= 11; x++) {
      if ((x + y) % 3 !== 0) drawTilePixel(ctx, Tile.OakSapling, x, y, y < 6 ? '#5ab837' : '#408c24');
    }
  }

  // Oak Door with crisp window bars & iron handle (like Screenshot 1!)
  drawPlanks(ctx, Tile.OakDoor, ['#9e7b49', '#8f6e3f'], '#b5905c', '#5c4120');
  for (let y = 2; y <= 6; y++) {
    for (let x = 3; x <= 12; x++) {
      if (x === 3 || x === 12 || y === 2 || y === 6) {
        drawTilePixel(ctx, Tile.OakDoor, x, y, '#4a3217');
      } else if (x === 7 || x === 8 || y === 4) {
        drawTilePixel(ctx, Tile.OakDoor, x, y, '#694a24');
      } else {
        drawTilePixel(ctx, Tile.OakDoor, x, y, '#9ecad6');
      }
    }
  }
  drawTilePixel(ctx, Tile.OakDoor, 12, 8, '#3b3b3b');
  drawTilePixel(ctx, Tile.OakDoor, 13, 8, '#1f1f1f');

  // Enchanting Table
  fillNoiseTile(ctx, Tile.EnchantTop, ['#a81f2e', '#8c1622', '#bf2a3b'], 91);
  for (let x = 0; x < 16; x++) {
    drawTilePixel(ctx, Tile.EnchantTop, x, 0, '#221436');
    drawTilePixel(ctx, Tile.EnchantTop, x, 15, '#221436');
    drawTilePixel(ctx, Tile.EnchantTop, 0, x, '#221436');
    drawTilePixel(ctx, Tile.EnchantTop, 15, x, '#221436');
  }
  for (let x = 5; x <= 10; x++) for (let y = 5; y <= 10; y++) drawTilePixel(ctx, Tile.EnchantTop, x, y, '#4eece8');
  fillNoiseTile(ctx, Tile.EnchantSide, ['#181024', '#26183b', '#120b1c'], 92);
  for (let x = 0; x < 16; x++) for (let y = 0; y <= 3; y++) drawTilePixel(ctx, Tile.EnchantSide, x, y, y === 3 ? '#4eece8' : '#a81f2e');

  const atlasTexture = new THREE.CanvasTexture(canvas);
  atlasTexture.magFilter = THREE.NearestFilter;
  atlasTexture.minFilter = THREE.NearestFilter;
  atlasTexture.generateMipmaps = false;
  atlasTexture.colorSpace = THREE.SRGBColorSpace;
  atlasTexture.anisotropy = maxAnisotropy;
  atlasTexture.needsUpdate = true;

  const crackTextures: THREE.CanvasTexture[] = [];
  for (let stage = 0; stage < 10; stage++) {
    const c = document.createElement('canvas');
    c.width = 16;
    c.height = 16;
    const cctx = c.getContext('2d')!;
    const branches = stage + 2;
    for (let b = 0; b < branches; b++) {
      let cx = 8;
      let cy = 8;
      const angle = (b / 11) * Math.PI * 2 + 0.3;
      for (let s = 0; s <= stage; s++) {
        const nx = Math.round(cx + Math.cos(angle + Math.sin(s * 2.1) * 0.6) * 1.4);
        const ny = Math.round(cy + Math.sin(angle + Math.cos(s * 1.7) * 0.6) * 1.4);
        cctx.fillStyle = 'rgba(0,0,0,0.78)';
        cctx.fillRect(Math.max(0, Math.min(15, nx)), Math.max(0, Math.min(15, ny)), 1, 1);
        cx = nx;
        cy = ny;
      }
    }
    const tex = new THREE.CanvasTexture(c);
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.colorSpace = THREE.SRGBColorSpace;
    crackTextures.push(tex);
  }

  return { canvas, atlasTexture, crackTextures };
}

const itemIconCache = new Map<ItemId, string>();

/**
 * Draw true isometric 3D Minecraft block projection onto a 32x32 canvas
 */
function drawIsometricBlockIcon(
  ctx: CanvasRenderingContext2D,
  atlasCanvas: HTMLCanvasElement,
  topTile: Tile,
  leftTile: Tile,
  rightTile: Tile
) {
  const drawFace = (tile: Tile, a: number, b: number, c: number, d: number, e: number, f: number, shadeAlpha: number) => {
    const tx = (tile % ATLAS_COLS) * TILE_PX;
    const ty = Math.floor(tile / ATLAS_COLS) * TILE_PX;
    ctx.save();
    ctx.setTransform(a, b, c, d, e, f);
    ctx.drawImage(atlasCanvas, tx, ty, 16, 16, 0, 0, 16, 16);
    if (shadeAlpha > 0) {
      ctx.fillStyle = `rgba(0, 0, 0, ${shadeAlpha})`;
      ctx.fillRect(0, 0, 16, 16);
    } else if (shadeAlpha < 0) {
      ctx.fillStyle = `rgba(255, 255, 255, ${-shadeAlpha})`;
      ctx.fillRect(0, 0, 16, 16);
    }
    ctx.restore();
  };

  // Top diamond (brightest)
  drawFace(topTile, 0.78, 0.39, -0.78, 0.39, 16, 2.5, -0.06);
  // Front-left face
  drawFace(leftTile, 0.78, 0.39, 0, 0.88, 3.52, 8.74, 0.14);
  // Front-right face (darkest)
  drawFace(rightTile, 0.78, -0.39, 0, 0.88, 16, 14.98, 0.34);
}

export function getItemIconUrl(itemId: ItemId, atlasCanvas: HTMLCanvasElement): string {
  const cached = itemIconCache.get(itemId);
  if (cached) return cached;

  const c = document.createElement('canvas');
  c.width = 32;
  c.height = 32;
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;

  if (itemId.startsWith('block:')) {
    const blockId = Number(itemId.slice(6)) as BlockId;
    const flatTile = getBlockFaceTile(blockId, 'pz');
    const tx = (flatTile % ATLAS_COLS) * TILE_PX;
    const ty = Math.floor(flatTile / ATLAS_COLS) * TILE_PX;

    if (
      blockId === BlockId.Torch ||
      blockId === BlockId.TallGrass ||
      blockId === BlockId.Dandelion ||
      blockId === BlockId.Poppy ||
      blockId === BlockId.Ladder ||
      blockId === BlockId.OakSapling ||
      blockId === BlockId.OakDoorClosed
    ) {
      ctx.drawImage(atlasCanvas, tx, ty, 16, 16, 2, 2, 28, 28);
    } else {
      const topTile = getBlockFaceTile(blockId, 'py');
      const leftTile = getBlockFaceTile(blockId, 'pz');
      const rightTile = getBlockFaceTile(blockId, 'px');
      drawIsometricBlockIcon(ctx, atlasCanvas, topTile, leftTile, rightTile);
    }
  } else {
    drawPixelItemSprite(ctx, itemId);
  }

  const url = c.toDataURL();
  itemIconCache.set(itemId, url);
  return url;
}

export function createItemCanvasTexture(itemId: ItemId, atlasCanvas: HTMLCanvasElement): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 32;
  c.height = 32;
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  drawPixelItemSprite(ctx, itemId);
  const tex = new THREE.CanvasTexture(c);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  void atlasCanvas;
  return tex;
}

function drawPixelItemSprite(ctx: CanvasRenderingContext2D, id: ItemId) {
  const px = (x: number, y: number, col: string, w = 2, h = 2) => {
    if (x < 0 || x > 15 || y < 0 || y > 15) return;
    ctx.fillStyle = col;
    ctx.fillRect(x * 2, y * 2, w, h);
  };

  const drawTool = (
    kind: 'pickaxe' | 'axe' | 'shovel' | 'sword' | 'hoe',
    lightCol: string,
    midCol: string,
    darkCol: string
  ) => {
    // Diagonal wooden handle with dark shadow edge
    for (let i = 2; i <= 11; i++) {
      if (kind === 'sword' && i > 6) continue;
      px(i, 15 - i, '#6d4c2c');
      if (i < 11) px(i, 14 - i, '#8a6239');
    }
    if (kind === 'pickaxe') {
      for (let i = 5; i <= 11; i++) {
        px(i, 2, lightCol);
        px(i, 3, midCol);
      }
      px(4, 3, midCol); px(4, 4, darkCol);
      px(11, 4, midCol); px(12, 3, lightCol); px(12, 4, midCol);
      px(13, 5, darkCol); px(13, 6, darkCol); px(12, 6, darkCol);
    } else if (kind === 'axe') {
      for (let x = 8; x <= 12; x++) {
        for (let y = 2; y <= 6; y++) {
          px(x, y, x === 12 ? lightCol : y === 6 ? darkCol : midCol);
        }
      }
      px(13, 3, lightCol); px(13, 4, darkCol); px(13, 5, darkCol);
    } else if (kind === 'shovel') {
      for (let x = 10; x <= 13; x++) {
        for (let y = 2; y <= 5; y++) {
          px(x, y, x + y <= 14 ? lightCol : x === 13 || y === 5 ? darkCol : midCol);
        }
      }
    } else if (kind === 'hoe') {
      for (let x = 6; x <= 12; x++) {
        px(x, 2, lightCol);
        px(x, 3, midCol);
      }
      px(12, 4, darkCol); px(12, 5, darkCol);
    } else if (kind === 'sword') {
      // Blade
      for (let i = 6; i <= 13; i++) {
        px(i, 15 - i, lightCol);
        if (i < 13) px(i + 1, 15 - i, midCol);
        if (i > 6 && i < 13) px(i, 14 - i, darkCol);
      }
      px(13, 2, lightCol);
      // Crossguard
      px(4, 9, '#5e4422'); px(5, 10, '#8a6239'); px(6, 11, '#5e4422');
      px(3, 12, '#8a6239'); px(2, 13, darkCol);
    }
  };

  if (id.startsWith('wooden_')) return drawTool(id.slice(7) as 'pickaxe', '#be945b', '#9e7b49', '#6e522d');
  if (id.startsWith('stone_')) return drawTool(id.slice(6) as 'pickaxe', '#adadad', '#888888', '#525252');
  if (id.startsWith('iron_')) {
    if (id.endsWith('helmet')) {
      for (let x = 4; x <= 11; x++) for (let y = 4; y <= 9; y++) if (!(y > 7 && x > 5 && x < 10)) px(x, y, y === 4 ? '#f2f2f2' : '#cfcfcf');
      return;
    }
    if (id.endsWith('chestplate')) {
      for (let x = 3; x <= 12; x++) for (let y = 3; y <= 12; y++) px(x, y, y < 5 ? '#f2f2f2' : '#c7c7c7');
      return;
    }
    if (id.endsWith('leggings')) {
      for (let x = 4; x <= 11; x++) for (let y = 3; y <= 13; y++) if (!(y > 7 && (x === 7 || x === 8))) px(x, y, '#cfcfcf');
      return;
    }
    if (id.endsWith('boots')) {
      for (let y = 6; y <= 12; y++) { px(4, y, '#d8d8d8'); px(5, y, '#b5b5b5'); px(10, y, '#d8d8d8'); px(11, y, '#b5b5b5'); }
      return;
    }
    return drawTool(id.slice(5) as 'pickaxe', '#ffffff', '#d8d8d8', '#8a8a8a');
  }
  if (id.startsWith('diamond_')) {
    if (id.endsWith('helmet')) {
      for (let x = 4; x <= 11; x++) for (let y = 4; y <= 9; y++) if (!(y > 7 && x > 5 && x < 10)) px(x, y, y === 4 ? '#9ffcf9' : '#3ee4e0');
      return;
    }
    if (id.endsWith('chestplate')) {
      for (let x = 3; x <= 12; x++) for (let y = 3; y <= 12; y++) px(x, y, y < 5 ? '#9ffcf9' : '#32d4d0');
      return;
    }
    if (id.endsWith('leggings')) {
      for (let x = 4; x <= 11; x++) for (let y = 3; y <= 13; y++) if (!(y > 7 && (x === 7 || x === 8))) px(x, y, '#3bd4d0');
      return;
    }
    if (id.endsWith('boots')) {
      for (let y = 6; y <= 12; y++) { px(4, y, '#4eece8'); px(5, y, '#29bab6'); px(10, y, '#4eece8'); px(11, y, '#29bab6'); }
      return;
    }
    return drawTool(id.slice(8) as 'pickaxe', '#b2fffc', '#4eece8', '#1da19d');
  }

  switch (id) {
    case 'stick':
      for (let i = 3; i <= 12; i++) {
        px(i, 15 - i, '#6d4c2c');
        px(i, 14 - i, '#8f673e');
      }
      break;
    case 'coal':
    case 'charcoal':
      for (let x = 4; x <= 11; x++) for (let y = 4; y <= 11; y++) px(x, y, (x + y) % 3 === 0 ? '#3b3b3b' : '#1b1b1b');
      px(6, 5, '#525252');
      break;
    case 'iron_ingot':
    case 'gold_ingot': {
      const hi = id === 'iron_ingot' ? '#ffffff' : '#fff899';
      const c1 = id === 'iron_ingot' ? '#dcdcdc' : '#fcee4b';
      const c2 = id === 'iron_ingot' ? '#969696' : '#c99316';
      for (let x = 3; x <= 12; x++) for (let y = 5; y <= 10; y++) px(x, y, y === 5 ? hi : y > 8 ? c2 : c1);
      break;
    }
    case 'raw_iron':
    case 'raw_gold': {
      const c1 = id === 'raw_iron' ? '#d8b498' : '#f7d53b';
      for (let x = 4; x <= 11; x++) for (let y = 4; y <= 11; y++) px(x, y, (x + y) % 2 === 0 ? c1 : '#9c7858');
      break;
    }
    case 'diamond':
    case 'emerald': {
      const c1 = id === 'diamond' ? '#4eece8' : '#25e06a';
      const c2 = id === 'diamond' ? '#b3fcf9' : '#8ef7b4';
      const c3 = id === 'diamond' ? '#1ea3a0' : '#0d9942';
      for (let x = 5; x <= 10; x++) for (let y = 4; y <= 11; y++) px(x, y, x < 8 && y < 8 ? c2 : x > 9 || y > 9 ? c3 : c1);
      px(4, 6, c1); px(11, 6, c3); px(7, 12, c3);
      break;
    }
    case 'ender_pearl':
      for (let x = 4; x <= 11; x++) for (let y = 4; y <= 11; y++) px(x, y, (x + y) % 3 === 0 ? '#116159' : '#1f998a');
      px(6, 6, '#7af5e3'); px(7, 6, '#7af5e3');
      break;
    case 'flint_and_steel':
      for (let x = 4; x <= 8; x++) px(x, 6, '#e0e0e0');
      px(8, 7, '#d4d4d4'); px(8, 8, '#d4d4d4');
      for (let x = 9; x <= 12; x++) for (let y = 8; y <= 12; y++) px(x, y, '#383838');
      break;
    case 'flint':
      for (let x = 5; x <= 10; x++) for (let y = 5; y <= 11; y++) px(x, y, y < 7 ? '#5e5e5e' : '#2e2e2e');
      break;
    case 'bone':
    case 'bone_meal':
      for (let i = 4; i <= 11; i++) px(i, 15 - i, id === 'bone' ? '#e8e5d8' : '#ffffff');
      if (id === 'bone_meal') {
        px(5, 6, '#e5e5e5'); px(10, 9, '#e5e5e5'); px(8, 5, '#ffffff');
      }
      break;
    case 'wheat_seeds':
      px(5, 8, '#588c32'); px(8, 6, '#71b84d'); px(10, 9, '#588c32'); px(7, 10, '#a6bf4b');
      break;
    case 'wheat':
      for (let i = 4; i <= 11; i++) {
        px(i, 15 - i, '#d9b443');
        px(i + 1, 15 - i, '#f0cc56');
      }
      break;
    case 'redstone':
    case 'lapis_lazuli':
    case 'gunpowder': {
      const col = id === 'redstone' ? '#e61919' : id === 'lapis_lazuli' ? '#254fd4' : '#5e5e5e';
      for (let x = 4; x <= 11; x++) for (let y = 5; y <= 11; y++) if ((x + y) % 2 === 0) px(x, y, col);
      break;
    }
    case 'leather':
      for (let x = 4; x <= 11; x++) for (let y = 4; y <= 11; y++) px(x, y, '#9c582d');
      break;
    case 'feather':
      for (let i = 4; i <= 12; i++) { px(i, 15 - i, '#f2f2f2'); px(i - 1, 15 - i, '#d6d6d6'); }
      break;
    case 'string':
      for (let x = 4; x <= 11; x++) px(x, 6 + Math.round(Math.sin(x)), '#ececec');
      break;
    case 'apple':
      for (let x = 4; x <= 11; x++) for (let y = 5; y <= 12; y++) px(x, y, y > 10 || x > 10 ? '#9e1717' : '#e02424');
      px(5, 6, '#ff8585'); px(7, 3, '#6b4722'); px(9, 4, '#47942a');
      break;
    case 'bread':
      for (let x = 3; x <= 12; x++) for (let y = 6; y <= 10; y++) px(x, y, y < 8 ? '#d6a04b' : '#9c6c28');
      break;
    case 'cooked_beef':
    case 'cooked_porkchop':
    case 'cooked_mutton':
      for (let x = 3; x <= 12; x++) for (let y = 5; y <= 10; y++) px(x, y, y > 8 ? '#572d18' : '#8a4c2d');
      px(5, 6, '#b8724b'); px(8, 7, '#b8724b');
      break;
    case 'raw_beef':
    case 'raw_porkchop':
    case 'raw_mutton':
    case 'rotten_flesh':
      for (let x = 3; x <= 12; x++) for (let y = 5; y <= 10; y++) px(x, y, id === 'rotten_flesh' ? '#6e7330' : '#cf4848');
      px(5, 6, id === 'rotten_flesh' ? '#8c4b37' : '#f0a8a8');
      break;
    case 'bow':
      for (let y = 3; y <= 12; y++) px(4, y, '#dadada');
      px(5, 3, '#7a5934'); px(7, 4, '#7a5934'); px(9, 6, '#7a5934'); px(9, 9, '#7a5934'); px(7, 11, '#7a5934'); px(5, 12, '#7a5934');
      break;
    case 'arrow':
      for (let i = 3; i <= 11; i++) px(i, 15 - i, '#7a5934');
      px(12, 3, '#b8b8b8'); px(12, 4, '#b8b8b8'); px(11, 3, '#b8b8b8');
      px(3, 12, '#efefef'); px(2, 11, '#efefef');
      break;
    case 'bucket':
    case 'water_bucket':
    case 'lava_bucket': {
      // Rim & body shading (like Screenshot 1!)
      for (let x = 4; x <= 11; x++) {
        px(x, 5, '#d8d8d8');
        for (let y = 6; y <= 12; y++) {
          px(x, y, x < 7 ? '#b5b5b5' : x > 9 ? '#6b6b6b' : '#949494');
        }
      }
      px(5, 13, '#787878'); px(6, 13, '#787878'); px(9, 13, '#6b6b6b'); px(10, 13, '#6b6b6b');
      const fill = id === 'water_bucket' ? '#3675f5' : id === 'lava_bucket' ? '#f56a19' : '#3a3a3a';
      for (let x = 5; x <= 10; x++) px(x, 6, fill);
      break;
    }
    default:
      for (let x = 4; x <= 11; x++) for (let y = 4; y <= 11; y++) px(x, y, '#c4b89b');
      break;
  }
}
