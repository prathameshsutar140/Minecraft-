import * as THREE from 'three';
import { BlockId, BiomeType } from '../types/game';
import { BLOCKS } from '../data/itemsAndBlocks';
import { SeededNoise } from './noise';
import { ATLAS_COLS, ATLAS_ROWS, FaceDir, getBlockFaceTile } from './textures';

export const CHUNK_SIZE = 16;
export const CHUNK_HEIGHT = 64;
export const SEA_LEVEL = 22;

export interface ChunkData {
  cx: number;
  cz: number;
  blocks: Uint8Array;
  opaqueMesh: THREE.Mesh | null;
  cutoutMesh: THREE.Mesh | null;
  liquidMesh: THREE.Mesh | null;
  dirty: boolean;
}

export interface VoxelHit {
  x: number;
  y: number;
  z: number;
  nx: number;
  ny: number;
  nz: number;
  blockId: BlockId;
  distance: number;
}

const FACE_DEFS: {
  dir: FaceDir;
  normal: [number, number, number];
  shade: number;
  corners: [number, number, number][];
  uvs: [number, number][];
}[] = [
  {
    dir: 'px',
    normal: [1, 0, 0],
    shade: 0.82,
    corners: [
      [1, 0, 1],
      [1, 0, 0],
      [1, 1, 0],
      [1, 1, 1],
    ],
    uvs: [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ],
  },
  {
    dir: 'nx',
    normal: [-1, 0, 0],
    shade: 0.82,
    corners: [
      [0, 0, 0],
      [0, 0, 1],
      [0, 1, 1],
      [0, 1, 0],
    ],
    uvs: [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ],
  },
  {
    dir: 'py',
    normal: [0, 1, 0],
    shade: 1.0,
    corners: [
      [0, 1, 1],
      [1, 1, 1],
      [1, 1, 0],
      [0, 1, 0],
    ],
    uvs: [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ],
  },
  {
    dir: 'ny',
    normal: [0, -1, 0],
    shade: 0.56,
    corners: [
      [0, 0, 0],
      [1, 0, 0],
      [1, 0, 1],
      [0, 0, 1],
    ],
    uvs: [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ],
  },
  {
    dir: 'pz',
    normal: [0, 0, 1],
    shade: 0.9,
    corners: [
      [0, 0, 1],
      [1, 0, 1],
      [1, 1, 1],
      [0, 1, 1],
    ],
    uvs: [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ],
  },
  {
    dir: 'nz',
    normal: [0, 0, -1],
    shade: 0.9,
    corners: [
      [1, 0, 0],
      [0, 0, 0],
      [0, 1, 0],
      [1, 1, 0],
    ],
    uvs: [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ],
  },
];

function chunkKey(cx: number, cz: number): string {
  return `${cx},${cz}`;
}

export class VoxelWorld {
  public noise: SeededNoise;
  public chunks = new Map<string, ChunkData>();
  public deltas = new Map<string, BlockId>(); // "x,y,z" -> BlockId for player modifications
  public structureChests: { x: number; y: number; z: number }[] = [];
  public group = new THREE.Group();

  private opaqueMat: THREE.MeshLambertMaterial;
  private cutoutMat: THREE.MeshLambertMaterial;
  private liquidMat: THREE.MeshLambertMaterial;

  constructor(seed: number, atlasTexture: THREE.Texture) {
    this.noise = new SeededNoise(seed);

    this.opaqueMat = new THREE.MeshLambertMaterial({
      map: atlasTexture,
      vertexColors: true,
    });

    this.cutoutMat = new THREE.MeshLambertMaterial({
      map: atlasTexture,
      vertexColors: true,
      alphaTest: 0.45,
      side: THREE.DoubleSide,
    });

    this.liquidMat = new THREE.MeshLambertMaterial({
      map: atlasTexture,
      vertexColors: true,
      transparent: true,
      opacity: 0.82,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
  }

  public dispose() {
    for (const ch of this.chunks.values()) {
      ch.opaqueMesh?.geometry.dispose();
      ch.cutoutMesh?.geometry.dispose();
      ch.liquidMesh?.geometry.dispose();
    }
    this.chunks.clear();
    this.opaqueMat.dispose();
    this.cutoutMat.dispose();
    this.liquidMat.dispose();
  }

  public getBiomeAt(wx: number, wz: number): BiomeType {
    return this.noise.getBiome(wx, wz);
  }

  public getBlock(wx: number, wy: number, wz: number): BlockId {
    if (wy < 0 || wy >= CHUNK_HEIGHT) return BlockId.Air;
    const cx = Math.floor(wx / CHUNK_SIZE);
    const cz = Math.floor(wz / CHUNK_SIZE);
    const ch = this.chunks.get(chunkKey(cx, cz));
    if (!ch) return BlockId.Air;
    const lx = wx - cx * CHUNK_SIZE;
    const lz = wz - cz * CHUNK_SIZE;
    return ch.blocks[lx + lz * CHUNK_SIZE + wy * CHUNK_SIZE * CHUNK_SIZE] as BlockId;
  }

  public setBlock(wx: number, wy: number, wz: number, id: BlockId, recordDelta = true) {
    if (wy < 0 || wy >= CHUNK_HEIGHT) return;
    const cx = Math.floor(wx / CHUNK_SIZE);
    const cz = Math.floor(wz / CHUNK_SIZE);
    const ch = this.chunks.get(chunkKey(cx, cz));
    if (!ch) return;
    const lx = wx - cx * CHUNK_SIZE;
    const lz = wz - cz * CHUNK_SIZE;
    const idx = lx + lz * CHUNK_SIZE + wy * CHUNK_SIZE * CHUNK_SIZE;
    if (ch.blocks[idx] === id) return;
    ch.blocks[idx] = id;
    ch.dirty = true;

    if (recordDelta) {
      this.deltas.set(`${wx},${wy},${wz}`, id);
    }

    // Mark neighbor chunks dirty when touching chunk borders
    if (lx === 0) this.markDirty(cx - 1, cz);
    if (lx === CHUNK_SIZE - 1) this.markDirty(cx + 1, cz);
    if (lz === 0) this.markDirty(cx, cz - 1);
    if (lz === CHUNK_SIZE - 1) this.markDirty(cx, cz + 1);
  }

  private markDirty(cx: number, cz: number) {
    const ch = this.chunks.get(chunkKey(cx, cz));
    if (ch) ch.dirty = true;
  }

  public getTopSolidY(wx: number, wz: number): number {
    for (let y = CHUNK_HEIGHT - 1; y >= 1; y--) {
      const b = this.getBlock(wx, y, wz);
      if (BLOCKS[b].solid || BLOCKS[b].liquid) return y + 1;
    }
    return 32;
  }

  public ensureChunk(cx: number, cz: number): ChunkData {
    const key = chunkKey(cx, cz);
    const existing = this.chunks.get(key);
    if (existing) return existing;

    const blocks = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT);
    const ch: ChunkData = {
      cx,
      cz,
      blocks,
      opaqueMesh: null,
      cutoutMesh: null,
      liquidMesh: null,
      dirty: true,
    };
    this.chunks.set(key, ch);
    this.generateChunkBlocks(ch);

    // Mark adjacent chunks dirty so border faces cull cleanly
    this.markDirty(cx - 1, cz);
    this.markDirty(cx + 1, cz);
    this.markDirty(cx, cz - 1);
    this.markDirty(cx, cz + 1);

    return ch;
  }

  private setLocal(ch: ChunkData, lx: number, y: number, lz: number, id: BlockId) {
    if (lx < 0 || lx >= CHUNK_SIZE || lz < 0 || lz >= CHUNK_SIZE || y < 0 || y >= CHUNK_HEIGHT) return;
    ch.blocks[lx + lz * CHUNK_SIZE + y * CHUNK_SIZE * CHUNK_SIZE] = id;
  }

  private getLocal(ch: ChunkData, lx: number, y: number, lz: number): BlockId {
    if (lx < 0 || lx >= CHUNK_SIZE || lz < 0 || lz >= CHUNK_SIZE || y < 0 || y >= CHUNK_HEIGHT) {
      return BlockId.Air;
    }
    return ch.blocks[lx + lz * CHUNK_SIZE + y * CHUNK_SIZE * CHUNK_SIZE] as BlockId;
  }

  private generateChunkBlocks(ch: ChunkData) {
    const baseX = ch.cx * CHUNK_SIZE;
    const baseZ = ch.cz * CHUNK_SIZE;

    const surfaceYGrid = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE);
    const biomeGrid: BiomeType[] = new Array(CHUNK_SIZE * CHUNK_SIZE);

    for (let lz = 0; lz < CHUNK_SIZE; lz++) {
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        const wx = baseX + lx;
        const wz = baseZ + lz;
        const biome = this.noise.getBiome(wx, wz);
        const surfY = this.noise.getSurfaceHeight(wx, wz, biome);
        surfaceYGrid[lx + lz * CHUNK_SIZE] = surfY;
        biomeGrid[lx + lz * CHUNK_SIZE] = biome;

        for (let y = 0; y < CHUNK_HEIGHT; y++) {
          let block = BlockId.Air;

          if (y === 0 || (y === 1 && this.noise.hash3D(wx, y, wz) < 0.55)) {
            block = BlockId.Bedrock;
          } else if (y <= surfY) {
            // Cave carving (skip surface shell near water)
            let isCave = false;
            if (y > 2 && y < surfY - 2) {
              const c1 = Math.abs(this.noise.noise3D(wx * 0.055, y * 0.075, wz * 0.055));
              const c2 = Math.abs(this.noise.noise3D(wx * 0.03 + 200, y * 0.05, wz * 0.03 - 200));
              if (c1 < 0.068 && c2 < 0.14) isCave = true;
            }

            if (isCave) {
              block = y <= 5 ? BlockId.Lava : BlockId.Air;
            } else if (y === surfY) {
              if (surfY < SEA_LEVEL - 1) {
                block = this.noise.hash2D(wx, wz) < 0.25 ? BlockId.Clay : BlockId.Sand;
              } else if (surfY <= SEA_LEVEL + 1 && biome !== 'taiga') {
                block = biome === 'desert' || this.noise.hash2D(wx + 3, wz) < 0.65 ? BlockId.Sand : BlockId.GrassBlock;
              } else if (biome === 'desert') {
                block = BlockId.Sand;
              } else if (biome === 'taiga' && surfY > 33) {
                block = BlockId.SnowBlock;
              } else if (biome === 'mountains' && surfY > 42) {
                block = BlockId.SnowBlock;
              } else if (biome === 'mountains' && surfY > 37) {
                block = BlockId.Stone;
              } else {
                block = BlockId.GrassBlock;
              }
            } else if (y >= surfY - 3) {
              block = biome === 'desert' ? BlockId.Sand : surfY < SEA_LEVEL ? BlockId.Sand : BlockId.Dirt;
            } else {
              // Stone & Ores
              block = BlockId.Stone;
              const h = this.noise.hash3D(wx, y, wz);
              if (y <= 14 && h < 0.008) block = BlockId.DiamondOre;
              else if (y <= 18 && h < 0.018) block = BlockId.RedstoneOre;
              else if (y <= 22 && h < 0.024) block = BlockId.GoldOre;
              else if (y <= 24 && biome === 'mountains' && h < 0.027) block = BlockId.EmeraldOre;
              else if (y <= 24 && h < 0.032) block = BlockId.LapisOre;
              else if (y <= 38 && h < 0.052) block = BlockId.IronOre;
              else if (h < 0.082) block = BlockId.CoalOre;
              else if (h > 0.985) block = BlockId.Gravel;
            }
          } else if (y <= SEA_LEVEL) {
            block = biome === 'taiga' && y === SEA_LEVEL ? BlockId.Ice : BlockId.Water;
          }

          this.setLocal(ch, lx, y, lz, block);
        }
      }
    }

    // Trees, Cacti, and Flora (placed inside chunk bounds 2..13 so canopies stay self-contained)
    for (let lz = 2; lz < CHUNK_SIZE - 2; lz++) {
      for (let lx = 2; lx < CHUNK_SIZE - 2; lx++) {
        const wx = baseX + lx;
        const wz = baseZ + lz;
        const surfY = surfaceYGrid[lx + lz * CHUNK_SIZE];
        const biome = biomeGrid[lx + lz * CHUNK_SIZE];
        const topBlock = this.getLocal(ch, lx, surfY, lz);
        if (surfY <= SEA_LEVEL) continue;

        const r = this.noise.hash2D(wx * 3 + 7, wz * 3 + 13);

        if (biome === 'desert' && topBlock === BlockId.Sand) {
          if (r < 0.012) {
            const h = 2 + Math.floor(this.noise.hash2D(wx, wz) * 2);
            for (let dy = 1; dy <= h; dy++) this.setLocal(ch, lx, surfY + dy, lz, BlockId.Cactus);
          }
          continue;
        }

        if (topBlock !== BlockId.GrassBlock && topBlock !== BlockId.SnowBlock) continue;

        const treeChance =
          biome === 'forest' ? 0.045 : biome === 'taiga' ? 0.035 : biome === 'plains' ? 0.008 : 0.01;

        if (r < treeChance) {
          const isBirch = biome === 'forest' && this.noise.hash2D(wx + 55, wz - 55) < 0.35;
          const isSpruce = biome === 'taiga';
          const log = isSpruce ? BlockId.SpruceLog : isBirch ? BlockId.BirchLog : BlockId.OakLog;
          const leaves = isSpruce ? BlockId.SpruceLeaves : isBirch ? BlockId.BirchLeaves : BlockId.OakLeaves;
          const trunkH = isSpruce ? 5 + Math.floor(r * 40) % 2 : 4 + Math.floor(r * 60) % 2;

          for (let dy = 1; dy <= trunkH; dy++) {
            this.setLocal(ch, lx, surfY + dy, lz, log);
          }
          for (let dy = trunkH - 1; dy <= trunkH + 2; dy++) {
            const rad = dy === trunkH + 2 ? 1 : 2;
            for (let ox = -rad; ox <= rad; ox++) {
              for (let oz = -rad; oz <= rad; oz++) {
                if (ox === 0 && oz === 0 && dy <= trunkH) continue;
                if (Math.abs(ox) === rad && Math.abs(oz) === rad && dy > trunkH) continue;
                if (this.getLocal(ch, lx + ox, surfY + dy, lz + oz) === BlockId.Air) {
                  this.setLocal(ch, lx + ox, surfY + dy, lz + oz, leaves);
                }
              }
            }
          }
        } else if (topBlock === BlockId.GrassBlock) {
          if (r > 0.86 && r < 0.95) {
            this.setLocal(ch, lx, surfY + 1, lz, BlockId.TallGrass);
          } else if (r >= 0.95 && r < 0.975) {
            this.setLocal(ch, lx, surfY + 1, lz, BlockId.Dandelion);
          } else if (r >= 0.975) {
            this.setLocal(ch, lx, surfY + 1, lz, BlockId.Poppy);
          }
        }
      }
    }

    // Occasional Villager Cottage or Ruined Nether Portal in flat chunk centers
    const structHash = this.noise.hash2D(ch.cx * 17 + 5, ch.cz * 29 - 11);
    if ((ch.cx !== 0 || ch.cz !== 0) && structHash < 0.065) {
      const midSurf = surfaceYGrid[8 + 8 * CHUNK_SIZE];
      const midBiome = biomeGrid[8 + 8 * CHUNK_SIZE];
      if (midSurf > SEA_LEVEL + 1 && midSurf < 44) {
        if (structHash < 0.035 && (midBiome === 'plains' || midBiome === 'forest' || midBiome === 'taiga')) {
          // Small Villager Oak Cottage (5x4x5) with Bed, Crafting Table, Door & Loot Chest
          for (let dx = 6; dx <= 10; dx++) {
            for (let dz = 6; dz <= 10; dz++) {
              this.setLocal(ch, dx, midSurf, dz, BlockId.Cobblestone);
              for (let dy = 1; dy <= 3; dy++) {
                const isWall = dx === 6 || dx === 10 || dz === 6 || dz === 10;
                if (dy === 3) {
                  this.setLocal(ch, dx, midSurf + dy, dz, BlockId.OakPlanks);
                } else if (isWall) {
                  if (dx === 8 && dz === 6 && dy === 1) {
                    this.setLocal(ch, dx, midSurf + dy, dz, BlockId.OakDoorClosed);
                  } else if (dy === 2 && (dx === 8 || dz === 8)) {
                    this.setLocal(ch, dx, midSurf + dy, dz, BlockId.Glass);
                  } else {
                    this.setLocal(ch, dx, midSurf + dy, dz, BlockId.OakPlanks);
                  }
                } else {
                  this.setLocal(ch, dx, midSurf + dy, dz, BlockId.Air);
                }
              }
            }
          }
          this.setLocal(ch, 7, midSurf + 1, 9, BlockId.Bed);
          this.setLocal(ch, 9, midSurf + 1, 9, BlockId.Chest);
          this.setLocal(ch, 7, midSurf + 1, 7, BlockId.CraftingTable);
          this.setLocal(ch, 9, midSurf + 2, 7, BlockId.Torch);
          this.structureChests.push({ x: baseX + 9, y: midSurf + 1, z: baseZ + 9 });
        } else {
          // Ruined Nether Portal with Obsidian, Netherrack, Glowstone & Loot Chest
          for (let dx = 6; dx <= 9; dx++) {
            for (let dz = 7; dz <= 9; dz++) {
              this.setLocal(ch, dx, midSurf, dz, (dx + dz) % 2 === 0 ? BlockId.Netherrack : BlockId.StoneBricks);
            }
          }
          for (let dy = 1; dy <= 4; dy++) {
            this.setLocal(ch, 6, midSurf + dy, 8, BlockId.Obsidian);
            if (dy <= 3) this.setLocal(ch, 9, midSurf + dy, 8, BlockId.Obsidian);
          }
          this.setLocal(ch, 7, midSurf + 1, 8, BlockId.Obsidian);
          this.setLocal(ch, 8, midSurf + 1, 8, BlockId.Obsidian);
          this.setLocal(ch, 7, midSurf + 4, 8, BlockId.Obsidian);
          this.setLocal(ch, 9, midSurf + 1, 9, BlockId.Glowstone);
          this.setLocal(ch, 7, midSurf + 1, 7, BlockId.Chest);
          this.structureChests.push({ x: baseX + 7, y: midSurf + 1, z: baseZ + 7 });
        }
      }
    }

    // Re-apply saved block deltas inside this chunk
    for (const [k, bId] of this.deltas) {
      const [dx, dy, dz] = k.split(',').map(Number);
      if (Math.floor(dx / CHUNK_SIZE) === ch.cx && Math.floor(dz / CHUNK_SIZE) === ch.cz) {
        this.setLocal(ch, dx - baseX, dy, dz - baseZ, bId);
      }
    }
  }

  public growOakTreeAt(wx: number, wy: number, wz: number) {
    const trunkH = 4 + Math.floor(Math.random() * 2);
    for (let dy = 0; dy < trunkH; dy++) {
      this.setBlock(wx, wy + dy, wz, BlockId.OakLog);
    }
    for (let dy = trunkH - 2; dy <= trunkH + 1; dy++) {
      const rad = dy === trunkH + 1 ? 1 : 2;
      for (let ox = -rad; ox <= rad; ox++) {
        for (let oz = -rad; oz <= rad; oz++) {
          if (ox === 0 && oz === 0 && dy < trunkH) continue;
          if (Math.abs(ox) === rad && Math.abs(oz) === rad && dy >= trunkH) continue;
          if (this.getBlock(wx + ox, wy + dy, wz + oz) === BlockId.Air) {
            this.setBlock(wx + ox, wy + dy, wz + oz, BlockId.OakLeaves);
          }
        }
      }
    }
  }

  public updateDirtyChunks(maxPerFrame = 3) {
    let built = 0;
    for (const ch of this.chunks.values()) {
      if (!ch.dirty) continue;
      this.rebuildChunkGeometry(ch);
      ch.dirty = false;
      built++;
      if (built >= maxPerFrame) break;
    }
  }

  public pruneFarChunks(centerCx: number, centerCz: number, radius: number) {
    const maxDist = radius + 2;
    for (const [key, ch] of this.chunks.entries()) {
      if (Math.abs(ch.cx - centerCx) > maxDist || Math.abs(ch.cz - centerCz) > maxDist) {
        if (ch.opaqueMesh) {
          this.group.remove(ch.opaqueMesh);
          ch.opaqueMesh.geometry.dispose();
        }
        if (ch.cutoutMesh) {
          this.group.remove(ch.cutoutMesh);
          ch.cutoutMesh.geometry.dispose();
        }
        if (ch.liquidMesh) {
          this.group.remove(ch.liquidMesh);
          ch.liquidMesh.geometry.dispose();
        }
        this.chunks.delete(key);
      }
    }
  }

  private isSolidForAO(wx: number, wy: number, wz: number): boolean {
    const b = this.getBlock(wx, wy, wz);
    return b !== BlockId.Air && !BLOCKS[b].transparent && BLOCKS[b].solid;
  }

  private getSkyColumnClear(wx: number, wy: number, wz: number): number {
    // Fast vertical sky check + nearby emissive torch/lava check
    let sky = 1.0;
    for (let y = wy + 1; y < Math.min(CHUNK_HEIGHT, wy + 14); y++) {
      const b = this.getBlock(wx, y, wz);
      if (b !== BlockId.Air && !BLOCKS[b].transparent) {
        sky = 0.34;
        break;
      }
    }
    // Check immediate 3x3x3 neighborhood for light-emitting blocks
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        for (let dz = -2; dz <= 2; dz++) {
          const nb = this.getBlock(wx + dx, wy + dy, wz + dz);
          if (BLOCKS[nb].lightLevel > 0) {
            const dist = Math.abs(dx) + Math.abs(dy) + Math.abs(dz);
            const boost = Math.max(0, 1 - dist / 5) * (BLOCKS[nb].lightLevel / 15);
            sky = Math.max(sky, boost);
          }
        }
      }
    }
    return sky;
  }

  private rebuildChunkGeometry(ch: ChunkData) {
    if (ch.opaqueMesh) {
      this.group.remove(ch.opaqueMesh);
      ch.opaqueMesh.geometry.dispose();
      ch.opaqueMesh = null;
    }
    if (ch.cutoutMesh) {
      this.group.remove(ch.cutoutMesh);
      ch.cutoutMesh.geometry.dispose();
      ch.cutoutMesh = null;
    }
    if (ch.liquidMesh) {
      this.group.remove(ch.liquidMesh);
      ch.liquidMesh.geometry.dispose();
      ch.liquidMesh = null;
    }

    const opPos: number[] = [], opNorm: number[] = [], opUv: number[] = [], opCol: number[] = [], opIdx: number[] = [];
    const cutPos: number[] = [], cutNorm: number[] = [], cutUv: number[] = [], cutCol: number[] = [], cutIdx: number[] = [];
    const liqPos: number[] = [], liqNorm: number[] = [], liqUv: number[] = [], liqCol: number[] = [], liqIdx: number[] = [];

    const baseX = ch.cx * CHUNK_SIZE;
    const baseZ = ch.cz * CHUNK_SIZE;
    const uStep = 1 / ATLAS_COLS;
    const vStep = 1 / ATLAS_ROWS;

    const pushTileQuad = (
      pos: number[],
      norm: number[],
      uv: number[],
      col: number[],
      idx: number[],
      v0: [number, number, number],
      v1: [number, number, number],
      v2: [number, number, number],
      v3: [number, number, number],
      n: [number, number, number],
      tile: number,
      ao: [number, number, number, number],
      light: number
    ) => {
      const baseVertex = pos.length / 3;
      const colIdx = tile % ATLAS_COLS;
      const rowIdx = Math.floor(tile / ATLAS_COLS);
      const u0 = colIdx * uStep + 0.001;
      const u1 = (colIdx + 1) * uStep - 0.001;
      const vt1 = 1 - rowIdx * vStep - 0.001;
      const vt0 = 1 - (rowIdx + 1) * vStep + 0.001;

      const verts = [v0, v1, v2, v3];
      const uvs: [number, number][] = [
        [u0, vt0],
        [u1, vt0],
        [u1, vt1],
        [u0, vt1],
      ];

      for (let i = 0; i < 4; i++) {
        pos.push(verts[i][0], verts[i][1], verts[i][2]);
        norm.push(n[0], n[1], n[2]);
        uv.push(uvs[i][0], uvs[i][1]);
        const c = ao[i] * light;
        col.push(c, c, c);
      }

      // Flip diagonal if needed to avoid AO interpolation artifacts
      if (ao[0] + ao[2] > ao[1] + ao[3]) {
        idx.push(baseVertex, baseVertex + 1, baseVertex + 2, baseVertex, baseVertex + 2, baseVertex + 3);
      } else {
        idx.push(baseVertex + 1, baseVertex + 2, baseVertex + 3, baseVertex + 1, baseVertex + 3, baseVertex);
      }
    };

    for (let y = 0; y < CHUNK_HEIGHT; y++) {
      for (let lz = 0; lz < CHUNK_SIZE; lz++) {
        for (let lx = 0; lx < CHUNK_SIZE; lx++) {
          const bId = ch.blocks[lx + lz * CHUNK_SIZE + y * CHUNK_SIZE * CHUNK_SIZE] as BlockId;
          if (bId === BlockId.Air) continue;
          const def = BLOCKS[bId];
          const wx = baseX + lx;
          const wz = baseZ + lz;

          // Cross plants (TallGrass, Dandelion, Poppy)
          if (def.crossPlant) {
            const tile = getBlockFaceTile(bId, 'pz');
            const light = this.getSkyColumnClear(wx, y, wz);
            const ao: [number, number, number, number] = [0.9, 0.9, 1.0, 1.0];
            pushTileQuad(cutPos, cutNorm, cutUv, cutCol, cutIdx,
              [lx + 0.15, y, lz + 0.15], [lx + 0.85, y, lz + 0.85], [lx + 0.85, y + 0.9, lz + 0.85], [lx + 0.15, y + 0.9, lz + 0.15],
              [0, 1, 0], tile, ao, light);
            pushTileQuad(cutPos, cutNorm, cutUv, cutCol, cutIdx,
              [lx + 0.85, y, lz + 0.15], [lx + 0.15, y, lz + 0.85], [lx + 0.15, y + 0.9, lz + 0.85], [lx + 0.85, y + 0.9, lz + 0.15],
              [0, 1, 0], tile, ao, light);
            continue;
          }

          // Torch geometry
          if (def.torchLike) {
            const tile = getBlockFaceTile(bId, 'pz');
            const ao: [number, number, number, number] = [1, 1, 1, 1];
            pushTileQuad(cutPos, cutNorm, cutUv, cutCol, cutIdx,
              [lx + 0.43, y, lz + 0.43], [lx + 0.57, y, lz + 0.57], [lx + 0.57, y + 0.72, lz + 0.57], [lx + 0.43, y + 0.72, lz + 0.43],
              [0, 1, 0], tile, ao, 1.0);
            pushTileQuad(cutPos, cutNorm, cutUv, cutCol, cutIdx,
              [lx + 0.57, y, lz + 0.43], [lx + 0.43, y, lz + 0.57], [lx + 0.43, y + 0.72, lz + 0.57], [lx + 0.57, y + 0.72, lz + 0.43],
              [0, 1, 0], tile, ao, 1.0);
            continue;
          }

          // Half-slab geometry (Bed, Enchanting Table)
          if (def.halfSlab) {
            const light = this.getSkyColumnClear(wx, y, wz);
            const hTop = bId === BlockId.Bed ? 0.56 : 0.75;
            for (const face of FACE_DEFS) {
              const tile = getBlockFaceTile(bId, face.dir);
              const ao: [number, number, number, number] = [face.shade, face.shade, face.shade, face.shade];
              const verts = face.corners.map(([vx, vy, vz]) => [
                lx + vx,
                y + (vy === 1 ? hTop : 0),
                lz + vz,
              ]) as [[number, number, number], [number, number, number], [number, number, number], [number, number, number]];
              pushTileQuad(cutPos, cutNorm, cutUv, cutCol, cutIdx, verts[0], verts[1], verts[2], verts[3], face.normal, tile, ao, light);
            }
            continue;
          }

          // Fence Post geometry
          if (def.fenceLike) {
            const light = this.getSkyColumnClear(wx, y, wz);
            const tile = getBlockFaceTile(bId, 'pz');
            for (const face of FACE_DEFS) {
              const ao: [number, number, number, number] = [face.shade, face.shade, face.shade, face.shade];
              const verts = face.corners.map(([vx, vy, vz]) => [
                lx + (vx === 0 ? 0.36 : 0.64),
                y + vy,
                lz + (vz === 0 ? 0.36 : 0.64),
              ]) as [[number, number, number], [number, number, number], [number, number, number], [number, number, number]];
              pushTileQuad(cutPos, cutNorm, cutUv, cutCol, cutIdx, verts[0], verts[1], verts[2], verts[3], face.normal, tile, ao, light);
            }
            continue;
          }

          // Door geometry (Closed or Open)
          if (bId === BlockId.OakDoorClosed || bId === BlockId.OakDoorOpen) {
            const light = this.getSkyColumnClear(wx, y, wz);
            const tile = getBlockFaceTile(bId, 'pz');
            const isOpen = bId === BlockId.OakDoorOpen;
            for (const face of FACE_DEFS) {
              const ao: [number, number, number, number] = [face.shade, face.shade, face.shade, face.shade];
              const verts = face.corners.map(([vx, vy, vz]) => [
                lx + (isOpen ? (vx === 0 ? 0.0 : 0.22) : vx),
                y + vy,
                lz + (isOpen ? vz : (vz === 0 ? 0.4 : 0.6)),
              ]) as [[number, number, number], [number, number, number], [number, number, number], [number, number, number]];
              pushTileQuad(cutPos, cutNorm, cutUv, cutCol, cutIdx, verts[0], verts[1], verts[2], verts[3], face.normal, tile, ao, light);
            }
            continue;
          }

          // Standard / Liquid / Transparent Cubes
          for (const face of FACE_DEFS) {
            const nx = wx + face.normal[0];
            const ny = y + face.normal[1];
            const nz = wz + face.normal[2];
            const neighborId = this.getBlock(nx, ny, nz);
            const neighborDef = BLOCKS[neighborId];

            if (def.liquid) {
              if (neighborId === bId || (neighborDef.solid && !neighborDef.transparent)) continue;
            } else if (def.transparent) {
              if (neighborId === bId && (bId === BlockId.Glass || bId === BlockId.Ice)) continue;
              if (neighborDef.solid && !neighborDef.transparent) continue;
            } else {
              if (neighborDef.solid && !neighborDef.transparent) continue;
            }

            const tile = getBlockFaceTile(bId, face.dir);
            const light = bId === BlockId.Lava || bId === BlockId.Glowstone ? 1.0 : this.getSkyColumnClear(nx, ny, nz);

            // Compute simple vertex AO for opaque faces
            const ao: [number, number, number, number] = [1, 1, 1, 1];
            if (!def.liquid && !def.transparent) {
              for (let c = 0; c < 4; c++) {
                const cx = face.corners[c][0] === 1 ? 1 : -1;
                const cy = face.corners[c][1] === 1 ? 1 : -1;
                const cz = face.corners[c][2] === 1 ? 1 : -1;
                let occ = 0;
                if (face.normal[1] !== 0) {
                  if (this.isSolidForAO(wx + cx, ny, wz)) occ++;
                  if (this.isSolidForAO(wx, ny, wz + cz)) occ++;
                  if (this.isSolidForAO(wx + cx, ny, wz + cz)) occ++;
                } else if (face.normal[0] !== 0) {
                  if (this.isSolidForAO(nx, y + cy, wz)) occ++;
                  if (this.isSolidForAO(nx, y, wz + cz)) occ++;
                  if (this.isSolidForAO(nx, y + cy, wz + cz)) occ++;
                } else {
                  if (this.isSolidForAO(wx + cx, y, nz)) occ++;
                  if (this.isSolidForAO(wx, y + cy, nz)) occ++;
                  if (this.isSolidForAO(wx + cx, y + cy, nz)) occ++;
                }
                ao[c] = (1 - occ * 0.16) * face.shade;
              }
            } else {
              for (let c = 0; c < 4; c++) ao[c] = face.shade;
            }

            const yTopDrop = def.liquid && face.dir !== 'ny' && this.getBlock(wx, y + 1, wz) === BlockId.Air ? 0.12 : 0;
            const verts = face.corners.map(([vx, vy, vz]) => [
              lx + vx,
              y + vy - (vy === 1 ? yTopDrop : 0),
              lz + vz,
            ]) as [
              [number, number, number],
              [number, number, number],
              [number, number, number],
              [number, number, number],
            ];

            if (def.liquid) {
              pushTileQuad(liqPos, liqNorm, liqUv, liqCol, liqIdx, verts[0], verts[1], verts[2], verts[3], face.normal, tile, ao, light);
            } else if (def.transparent) {
              pushTileQuad(cutPos, cutNorm, cutUv, cutCol, cutIdx, verts[0], verts[1], verts[2], verts[3], face.normal, tile, ao, light);
            } else {
              pushTileQuad(opPos, opNorm, opUv, opCol, opIdx, verts[0], verts[1], verts[2], verts[3], face.normal, tile, ao, light);
            }
          }
        }
      }
    }

    const makeMesh = (
      pos: number[],
      norm: number[],
      uv: number[],
      col: number[],
      idx: number[],
      mat: THREE.Material,
      castShadow: boolean,
      receiveShadow: boolean
    ): THREE.Mesh | null => {
      if (idx.length === 0) return null;
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geo.setAttribute('normal', new THREE.Float32BufferAttribute(norm, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
      geo.setIndex(idx);
      geo.computeBoundingSphere();

      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(baseX, 0, baseZ);
      mesh.castShadow = castShadow;
      mesh.receiveShadow = receiveShadow;
      this.group.add(mesh);
      return mesh;
    };

    ch.opaqueMesh = makeMesh(opPos, opNorm, opUv, opCol, opIdx, this.opaqueMat, true, true);
    ch.cutoutMesh = makeMesh(cutPos, cutNorm, cutUv, cutCol, cutIdx, this.cutoutMat, true, true);
    ch.liquidMesh = makeMesh(liqPos, liqNorm, liqUv, liqCol, liqIdx, this.liquidMat, false, true);
  }

  /**
   * 3D DDA voxel traversal raycaster (up to maxDist blocks).
   */
  public raycastVoxel(origin: THREE.Vector3, dir: THREE.Vector3, maxDist = 5.2): VoxelHit | null {
    let x = Math.floor(origin.x);
    let y = Math.floor(origin.y);
    let z = Math.floor(origin.z);

    const stepX = dir.x >= 0 ? 1 : -1;
    const stepY = dir.y >= 0 ? 1 : -1;
    const stepZ = dir.z >= 0 ? 1 : -1;

    const tDeltaX = dir.x === 0 ? Infinity : Math.abs(1 / dir.x);
    const tDeltaY = dir.y === 0 ? Infinity : Math.abs(1 / dir.y);
    const tDeltaZ = dir.z === 0 ? Infinity : Math.abs(1 / dir.z);

    let tMaxX = dir.x === 0 ? Infinity : ((stepX > 0 ? x + 1 - origin.x : origin.x - x) * tDeltaX);
    let tMaxY = dir.y === 0 ? Infinity : ((stepY > 0 ? y + 1 - origin.y : origin.y - y) * tDeltaY);
    let tMaxZ = dir.z === 0 ? Infinity : ((stepZ > 0 ? z + 1 - origin.z : origin.z - z) * tDeltaZ);

    let nx = 0, ny = 0, nz = 0;
    let dist = 0;

    for (let i = 0; i < 64; i++) {
      const b = this.getBlock(x, y, z);
      if (b !== BlockId.Air && !BLOCKS[b].liquid) {
        return { x, y, z, nx, ny, nz, blockId: b, distance: dist };
      }

      if (tMaxX < tMaxY) {
        if (tMaxX < tMaxZ) {
          dist = tMaxX;
          x += stepX;
          tMaxX += tDeltaX;
          nx = -stepX; ny = 0; nz = 0;
        } else {
          dist = tMaxZ;
          z += stepZ;
          tMaxZ += tDeltaZ;
          nx = 0; ny = 0; nz = -stepZ;
        }
      } else {
        if (tMaxY < tMaxZ) {
          dist = tMaxY;
          y += stepY;
          tMaxY += tDeltaY;
          nx = 0; ny = -stepY; nz = 0;
        } else {
          dist = tMaxZ;
          z += stepZ;
          tMaxZ += tDeltaZ;
          nx = 0; ny = 0; nz = -stepZ;
        }
      }

      if (dist > maxDist) break;
    }
    return null;
  }
}
