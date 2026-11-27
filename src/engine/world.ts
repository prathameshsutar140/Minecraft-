import * as THREE from 'three';
import { BlockId, BiomeType, DimensionType, GraphicsQuality, LeafQuality } from '../types/game';
import { BLOCKS } from '../data/itemsAndBlocks';
import { SeededNoise } from './noise';
import { ATLAS_COLS, ATLAS_ROWS, FaceDir, Tile, getBlockFaceTile } from './textures';

export const CHUNK_SIZE = 16;
export const CHUNK_HEIGHT = 64;
export const SEA_LEVEL = 22;

export interface LightEmitter {
  x: number;
  y: number;
  z: number;
  power: number;
}

export interface ChunkData {
  cx: number;
  cz: number;
  blocks: Uint8Array;
  fluidLevels: Uint8Array;
  skyTopY: Uint8Array;
  lightEmitters: LightEmitter[];
  emittersDirty: boolean;
  opaqueMesh: THREE.Mesh | null;
  cutoutMesh: THREE.Mesh | null;
  leavesMesh: THREE.Mesh | null;
  liquidMesh: THREE.Mesh | null;
  dirty: boolean;
}

// Reusable scratch buffers to eliminate per-chunk GC allocations
const _opPos: number[] = [];
const _opNorm: number[] = [];
const _opUv: number[] = [];
const _opCol: number[] = [];
const _opIdx: number[] = [];

const _cutPos: number[] = [];
const _cutNorm: number[] = [];
const _cutUv: number[] = [];
const _cutCol: number[] = [];
const _cutIdx: number[] = [];

const _leafPos: number[] = [];
const _leafNorm: number[] = [];
const _leafUv: number[] = [];
const _leafCol: number[] = [];
const _leafIdx: number[] = [];

const _liqPos: number[] = [];
const _liqNorm: number[] = [];
const _liqUv: number[] = [];
const _liqCol: number[] = [];
const _liqIdx: number[] = [];

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
    shade: 0.78,
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
    shade: 0.78,
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
    shade: 0.52,
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
  public dimension: DimensionType;
  public chunks = new Map<string, ChunkData>();
  public deltas = new Map<string, BlockId>(); // "x,y,z" -> BlockId for player modifications
  public fluidDeltas = new Map<string, number>();
  public structureChests: { x: number; y: number; z: number }[] = [];
  public group = new THREE.Group();

  private opaqueMat: THREE.MeshLambertMaterial;
  private cutoutMat: THREE.MeshLambertMaterial;
  private leavesMat: THREE.MeshLambertMaterial;
  private liquidMat: THREE.MeshLambertMaterial;

  private leavesUniforms = {
    uFastLeaves: { value: 0 },
  };
  private liquidUniforms = {
    uTime: { value: 0 },
    uVibrant: { value: 1 },
    uSunDir: { value: new THREE.Vector3(0.4, 0.85, 0.2).normalize() },
    uSkyTint: { value: new THREE.Color(0x78a7ff) },
  };

  constructor(seed: number, atlasTexture: THREE.Texture, dimension: DimensionType = 'overworld') {
    this.noise = new SeededNoise(seed);
    this.dimension = dimension;

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

    this.leavesMat = new THREE.MeshLambertMaterial({
      map: atlasTexture,
      vertexColors: true,
      side: THREE.DoubleSide,
    });
    this.leavesMat.onBeforeCompile = (shader) => {
      shader.uniforms.uFastLeaves = this.leavesUniforms.uFastLeaves;
      shader.fragmentShader = 'uniform float uFastLeaves;\n' + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <color_fragment>',
        `
        #include <color_fragment>
        if (uFastLeaves > 0.5) {
          if (diffuseColor.a < 0.45) {
            diffuseColor.rgb = vColor.rgb * 0.22;
          }
          diffuseColor.a = 1.0;
        } else {
          if (diffuseColor.a < 0.45) discard;
        }
        `
      );
    };

    this.liquidMat = new THREE.MeshLambertMaterial({
      map: atlasTexture,
      vertexColors: true,
      transparent: true,
      opacity: 0.82,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.liquidMat.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = this.liquidUniforms.uTime;
      shader.uniforms.uVibrant = this.liquidUniforms.uVibrant;
      shader.uniforms.uSunDir = this.liquidUniforms.uSunDir;
      shader.uniforms.uSkyTint = this.liquidUniforms.uSkyTint;

      shader.vertexShader =
        'varying vec3 vWaterWorldPos;\nvarying vec3 vWaterNormal;\n' + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace(
        '#include <begin_vertex>',
        `
        #include <begin_vertex>
        vWaterWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
        vWaterNormal = normal;
        `
      );

      shader.fragmentShader =
        `
        uniform float uTime;
        uniform float uVibrant;
        uniform vec3 uSunDir;
        uniform vec3 uSkyTint;
        varying vec3 vWaterWorldPos;
        varying vec3 vWaterNormal;
        ` + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <color_fragment>',
        `
        #include <color_fragment>
        bool isWaterPixel = diffuseColor.b > diffuseColor.r * 1.15;
        if (isWaterPixel) {
          vec2 pixPos = floor(vWaterWorldPos.xz * 16.0) / 16.0;
          float waveA = sin(pixPos.x * 3.1 + pixPos.y * 2.4 + uTime * 2.6);
          float waveB = cos(pixPos.x * 2.1 - pixPos.y * 3.7 + uTime * 1.9);
          float ripple = (waveA + waveB) * 0.5;
          diffuseColor.rgb += vec3(0.05, 0.09, 0.14) * max(0.0, ripple);

          if (uVibrant > 0.1) {
            vec3 viewDir = normalize(cameraPosition - vWaterWorldPos);
            vec3 nrm = normalize(vWaterNormal + vec3(waveA * 0.08, 0.0, waveB * 0.08) * uVibrant);
            float fresnel = pow(1.0 - max(0.0, dot(viewDir, nrm)), 3.0);
            vec3 halfVec = normalize(uSunDir + viewDir);
            float spec = pow(max(0.0, dot(nrm, halfVec)), 42.0) * step(0.1, uSunDir.y);
            diffuseColor.rgb = mix(diffuseColor.rgb, uSkyTint * 1.12, fresnel * 0.45 * uVibrant);
            diffuseColor.rgb += vec3(1.0, 0.96, 0.85) * spec * 0.65 * uVibrant;
            diffuseColor.a = clamp(0.74 + fresnel * 0.22 * uVibrant, 0.72, 0.96);
          }
        } else {
          // Lava or Nether Portal animated shimmer
          float pulse = 0.92 + 0.12 * sin(vWaterWorldPos.x * 2.3 + vWaterWorldPos.y * 2.7 + uTime * 3.4);
          diffuseColor.rgb *= pulse;
        }
        `
      );
    };
  }

  public setRenderSettings(
    quality: GraphicsQuality,
    leafQuality: LeafQuality,
    sunDir: THREE.Vector3,
    skyColor: THREE.Color,
    time: number
  ) {
    this.leavesUniforms.uFastLeaves.value = leafQuality === 'fast' || quality === 'fast' ? 1 : 0;
    this.liquidUniforms.uVibrant.value = quality === 'vibrant' ? 1.0 : quality === 'fancy' ? 0.3 : 0.0;
    this.liquidUniforms.uSunDir.value.copy(sunDir).normalize();
    this.liquidUniforms.uSkyTint.value.copy(skyColor);
    this.liquidUniforms.uTime.value = time;
  }

  public dispose() {
    for (const ch of this.chunks.values()) {
      ch.opaqueMesh?.geometry.dispose();
      ch.cutoutMesh?.geometry.dispose();
      ch.leavesMesh?.geometry.dispose();
      ch.liquidMesh?.geometry.dispose();
    }
    this.chunks.clear();
    this.opaqueMat.dispose();
    this.cutoutMat.dispose();
    this.leavesMat.dispose();
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

  public getFluidLevel(wx: number, wy: number, wz: number): number {
    if (wy < 0 || wy >= CHUNK_HEIGHT) return 0;
    const cx = Math.floor(wx / CHUNK_SIZE);
    const cz = Math.floor(wz / CHUNK_SIZE);
    const ch = this.chunks.get(chunkKey(cx, cz));
    if (!ch) return 0;
    const lx = wx - cx * CHUNK_SIZE;
    const lz = wz - cz * CHUNK_SIZE;
    return ch.fluidLevels[lx + lz * CHUNK_SIZE + wy * CHUNK_SIZE * CHUNK_SIZE];
  }

  public setFluidLevel(wx: number, wy: number, wz: number, level: number, recordDelta = true) {
    if (wy < 0 || wy >= CHUNK_HEIGHT) return;
    const cx = Math.floor(wx / CHUNK_SIZE);
    const cz = Math.floor(wz / CHUNK_SIZE);
    const ch = this.chunks.get(chunkKey(cx, cz));
    if (!ch) return;
    const lx = wx - cx * CHUNK_SIZE;
    const lz = wz - cz * CHUNK_SIZE;
    const idx = lx + lz * CHUNK_SIZE + wy * CHUNK_SIZE * CHUNK_SIZE;
    if (ch.fluidLevels[idx] === level) return;
    ch.fluidLevels[idx] = level;
    ch.dirty = true;
    if (recordDelta) {
      if (level === 0) this.fluidDeltas.delete(`${wx},${wy},${wz}`);
      else this.fluidDeltas.set(`${wx},${wy},${wz}`, level);
    }
    if (lx === 0) this.markDirty(cx - 1, cz);
    if (lx === CHUNK_SIZE - 1) this.markDirty(cx + 1, cz);
    if (lz === 0) this.markDirty(cx, cz - 1);
    if (lz === CHUNK_SIZE - 1) this.markDirty(cx, cz + 1);
  }

  public setBlock(wx: number, wy: number, wz: number, id: BlockId, recordDelta = true, fluidLevel = 0) {
    if (wy < 0 || wy >= CHUNK_HEIGHT) return;
    const cx = Math.floor(wx / CHUNK_SIZE);
    const cz = Math.floor(wz / CHUNK_SIZE);
    const ch = this.chunks.get(chunkKey(cx, cz));
    if (!ch) return;
    const lx = wx - cx * CHUNK_SIZE;
    const lz = wz - cz * CHUNK_SIZE;
    const idx = lx + lz * CHUNK_SIZE + wy * CHUNK_SIZE * CHUNK_SIZE;
    const nextLevel = BLOCKS[id].liquid ? fluidLevel : 0;
    const prevId = ch.blocks[idx] as BlockId;
    if (prevId === id && ch.fluidLevels[idx] === nextLevel) return;
    ch.blocks[idx] = id;
    ch.fluidLevels[idx] = nextLevel;
    ch.dirty = true;
    if (BLOCKS[prevId].lightLevel > 0 || BLOCKS[id].lightLevel > 0) {
      ch.emittersDirty = true;
    }
    this.recomputeColumnSkyTop(ch, lx, lz);

    if (recordDelta) {
      this.deltas.set(`${wx},${wy},${wz}`, id);
      if (nextLevel === 0) this.fluidDeltas.delete(`${wx},${wy},${wz}`);
      else this.fluidDeltas.set(`${wx},${wy},${wz}`, nextLevel);
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

  private recomputeColumnSkyTop(ch: ChunkData, lx: number, lz: number) {
    let top = 0;
    const base = lx + lz * CHUNK_SIZE;
    const stride = CHUNK_SIZE * CHUNK_SIZE;
    for (let y = CHUNK_HEIGHT - 1; y >= 0; y--) {
      const b = ch.blocks[base + y * stride] as BlockId;
      if (b !== BlockId.Air && !BLOCKS[b].transparent) {
        top = y;
        break;
      }
    }
    ch.skyTopY[base] = top;
  }

  private recomputeAllSkyTopAndEmitters(ch: ChunkData) {
    ch.lightEmitters.length = 0;
    const stride = CHUNK_SIZE * CHUNK_SIZE;
    const baseX = ch.cx * CHUNK_SIZE;
    const baseZ = ch.cz * CHUNK_SIZE;
    for (let lz = 0; lz < CHUNK_SIZE; lz++) {
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        const col = lx + lz * CHUNK_SIZE;
        let top = 0;
        for (let y = CHUNK_HEIGHT - 1; y >= 0; y--) {
          const b = ch.blocks[col + y * stride] as BlockId;
          if (b !== BlockId.Air) {
            if (top === 0 && !BLOCKS[b].transparent) {
              top = y;
            }
            const ll = BLOCKS[b].lightLevel;
            if (ll > 0) {
              ch.lightEmitters.push({
                x: baseX + lx,
                y,
                z: baseZ + lz,
                power: ll / 15,
              });
            }
          }
        }
        ch.skyTopY[col] = top;
      }
    }
    ch.emittersDirty = false;
  }

  private ensureChunkEmitters(ch: ChunkData) {
    if (!ch.emittersDirty) return;
    ch.lightEmitters.length = 0;
    const stride = CHUNK_SIZE * CHUNK_SIZE;
    const baseX = ch.cx * CHUNK_SIZE;
    const baseZ = ch.cz * CHUNK_SIZE;
    for (let y = 0; y < CHUNK_HEIGHT; y++) {
      const yOff = y * stride;
      for (let lz = 0; lz < CHUNK_SIZE; lz++) {
        const zOff = yOff + lz * CHUNK_SIZE;
        for (let lx = 0; lx < CHUNK_SIZE; lx++) {
          const b = ch.blocks[zOff + lx] as BlockId;
          if (b !== BlockId.Air) {
            const ll = BLOCKS[b].lightLevel;
            if (ll > 0) {
              ch.lightEmitters.push({
                x: baseX + lx,
                y,
                z: baseZ + lz,
                power: ll / 15,
              });
            }
          }
        }
      }
    }
    ch.emittersDirty = false;
  }

  public getTopSolidY(wx: number, wz: number): number {
    const startY = this.dimension === 'nether' ? 46 : CHUNK_HEIGHT - 1;
    for (let y = startY; y >= 1; y--) {
      const b = this.getBlock(wx, y, wz);
      if (BLOCKS[b].solid || BLOCKS[b].liquid) {
        if (this.dimension === 'nether' && y >= 48) continue;
        return y + 1;
      }
    }
    return this.dimension === 'nether' ? 20 : 32;
  }

  public ensureChunk(cx: number, cz: number): ChunkData {
    const key = chunkKey(cx, cz);
    const existing = this.chunks.get(key);
    if (existing) return existing;

    const size = CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT;
    const blocks = new Uint8Array(size);
    const fluidLevels = new Uint8Array(size);
    const ch: ChunkData = {
      cx,
      cz,
      blocks,
      fluidLevels,
      skyTopY: new Uint8Array(CHUNK_SIZE * CHUNK_SIZE),
      lightEmitters: [],
      emittersDirty: false,
      opaqueMesh: null,
      cutoutMesh: null,
      leavesMesh: null,
      liquidMesh: null,
      dirty: true,
    };
    this.chunks.set(key, ch);
    this.generateChunkBlocks(ch);
    this.recomputeAllSkyTopAndEmitters(ch);

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

    if (this.dimension === 'nether') {
      for (let lz = 0; lz < CHUNK_SIZE; lz++) {
        for (let lx = 0; lx < CHUNK_SIZE; lx++) {
          const wx = baseX + lx;
          const wz = baseZ + lz;
          const floorH = Math.floor(16 + this.noise.fbm2D(wx * 0.03, wz * 0.03, 3) * 10);
          const ceilH = Math.floor(50 + this.noise.fbm2D(wx * 0.035 + 120, wz * 0.035 - 80, 3) * 7);

          for (let y = 0; y < CHUNK_HEIGHT; y++) {
            let block = BlockId.Air;
            if (y === 0 || y === CHUNK_HEIGHT - 1 || ((y === 1 || y === CHUNK_HEIGHT - 2) && this.noise.hash3D(wx, y, wz) < 0.55)) {
              block = BlockId.Bedrock;
            } else if (y <= floorH || y >= ceilH) {
              const cavern = Math.abs(this.noise.noise3D(wx * 0.06, y * 0.075, wz * 0.06));
              if (cavern < 0.09 && y > 6 && y < CHUNK_HEIGHT - 4) {
                block = y <= 14 ? BlockId.Lava : BlockId.Air;
              } else {
                const h = this.noise.hash3D(wx, y, wz);
                if (y <= floorH && y >= 13 && y <= 18 && this.noise.fbm2D(wx * 0.08 + 40, wz * 0.08, 2) > 0.25) {
                  block = BlockId.SoulSand;
                } else if (y >= ceilH && y <= ceilH + 2 && h < 0.045) {
                  block = BlockId.Glowstone;
                } else if (h < 0.035) {
                  block = BlockId.NetherQuartzOre;
                } else {
                  block = BlockId.Netherrack;
                }
              }
            } else if (y <= 14) {
              block = BlockId.Lava;
            }
            this.setLocal(ch, lx, y, lz, block);
          }
        }
      }

      for (const [k, bId] of this.deltas) {
        const [dx, dy, dz] = k.split(',').map(Number);
        if (Math.floor(dx / CHUNK_SIZE) === ch.cx && Math.floor(dz / CHUNK_SIZE) === ch.cz) {
          this.setLocal(ch, dx - baseX, dy, dz - baseZ, bId);
        }
      }
      for (const [k, lvl] of this.fluidDeltas) {
        const [dx, dy, dz] = k.split(',').map(Number);
        if (Math.floor(dx / CHUNK_SIZE) === ch.cx && Math.floor(dz / CHUNK_SIZE) === ch.cz && dy >= 0 && dy < CHUNK_HEIGHT) {
          ch.fluidLevels[(dx - baseX) + (dz - baseZ) * CHUNK_SIZE + dy * CHUNK_SIZE * CHUNK_SIZE] = lvl;
        }
      }
      return;
    }

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
              // Stone, Deepslate, Amethyst Geodes & Ores
              const isDeepslate = y <= 8 || (y <= 11 && this.noise.hash3D(wx, y, wz) > (y - 8) * 0.35);
              block = isDeepslate ? BlockId.Deepslate : BlockId.Stone;
              const h = this.noise.hash3D(wx, y, wz);
              if (y >= 4 && y <= 14 && Math.abs(this.noise.noise3D(wx * 0.08 + 77, y * 0.08, wz * 0.08 - 77)) < 0.025) {
                block = BlockId.AmethystBlock;
              } else if (y <= 14 && h < 0.008) block = BlockId.DiamondOre;
              else if (y <= 18 && h < 0.018) block = BlockId.RedstoneOre;
              else if (y <= 22 && h < 0.024) block = BlockId.GoldOre;
              else if (y <= 24 && biome === 'mountains' && h < 0.027) block = BlockId.EmeraldOre;
              else if (y <= 24 && h < 0.032) block = BlockId.LapisOre;
              else if (y <= 38 && h < 0.052) block = BlockId.IronOre;
              else if (y >= 12 && y <= 35 && h >= 0.12 && h < 0.145) block = BlockId.CopperOre;
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
          biome === 'forest'
            ? 0.045
            : biome === 'taiga'
              ? 0.035
              : biome === 'cherry'
                ? 0.028
                : biome === 'plains'
                  ? 0.008
                  : 0.01;

        if (r < treeChance) {
          const isCherry = biome === 'cherry';
          const isBirch = biome === 'forest' && this.noise.hash2D(wx + 55, wz - 55) < 0.35;
          const isSpruce = biome === 'taiga';
          const log = isCherry
            ? BlockId.CherryLog
            : isSpruce
              ? BlockId.SpruceLog
              : isBirch
                ? BlockId.BirchLog
                : BlockId.OakLog;
          const leaves = isCherry
            ? BlockId.CherryLeaves
            : isSpruce
              ? BlockId.SpruceLeaves
              : isBirch
                ? BlockId.BirchLeaves
                : BlockId.OakLeaves;
          const trunkH = isSpruce || isCherry ? 5 + Math.floor(r * 40) % 2 : 4 + Math.floor(r * 60) % 2;

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
            this.setLocal(ch, lx, surfY + 1, lz, biome === 'cherry' ? BlockId.Poppy : BlockId.Dandelion);
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

    // Re-apply saved block & fluid deltas inside this chunk
    for (const [k, bId] of this.deltas) {
      const [dx, dy, dz] = k.split(',').map(Number);
      if (Math.floor(dx / CHUNK_SIZE) === ch.cx && Math.floor(dz / CHUNK_SIZE) === ch.cz) {
        this.setLocal(ch, dx - baseX, dy, dz - baseZ, bId);
      }
    }
    for (const [k, lvl] of this.fluidDeltas) {
      const [dx, dy, dz] = k.split(',').map(Number);
      if (Math.floor(dx / CHUNK_SIZE) === ch.cx && Math.floor(dz / CHUNK_SIZE) === ch.cz && dy >= 0 && dy < CHUNK_HEIGHT) {
        ch.fluidLevels[(dx - baseX) + (dz - baseZ) * CHUNK_SIZE + dy * CHUNK_SIZE * CHUNK_SIZE] = lvl;
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

  public updateDirtyChunks(maxPerFrame = 3, centerCx = 0, centerCz = 0, budgetMs = 4.5) {
    const dirty: ChunkData[] = [];
    for (const ch of this.chunks.values()) {
      if (ch.dirty) dirty.push(ch);
    }
    if (dirty.length === 0) return;

    dirty.sort((a, b) => {
      const da = (a.cx - centerCx) * (a.cx - centerCx) + (a.cz - centerCz) * (a.cz - centerCz);
      const db = (b.cx - centerCx) * (b.cx - centerCx) + (b.cz - centerCz) * (b.cz - centerCz);
      return da - db;
    });

    const start = performance.now();
    let built = 0;
    for (const ch of dirty) {
      this.rebuildChunkGeometry(ch);
      ch.dirty = false;
      built++;
      if (built >= maxPerFrame) break;
      if (maxPerFrame < 50 && performance.now() - start >= budgetMs) break;
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
        if (ch.leavesMesh) {
          this.group.remove(ch.leavesMesh);
          ch.leavesMesh.geometry.dispose();
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

  private getSkyExposure(wx: number, wy: number, wz: number): number {
    if (this.dimension === 'nether') return 0.52;
    if (wy < 0) return 0.28;
    const cx = Math.floor(wx / CHUNK_SIZE);
    const cz = Math.floor(wz / CHUNK_SIZE);
    const ch = this.chunks.get(chunkKey(cx, cz));
    if (!ch) return 1.0;
    const lx = wx - cx * CHUNK_SIZE;
    const lz = wz - cz * CHUNK_SIZE;
    return wy >= ch.skyTopY[lx + lz * CHUNK_SIZE] ? 1.0 : 0.28;
  }

  private getSkyColumnClear(wx: number, wy: number, wz: number): number {
    if (this.dimension === 'nether') return 0.52;
    const center = this.getSkyExposure(wx, wy, wz);
    if (center >= 1.0) return 1.0;
    let sum = center * 2;
    sum += this.getSkyExposure(wx + 1, wy, wz);
    sum += this.getSkyExposure(wx - 1, wy, wz);
    sum += this.getSkyExposure(wx, wy, wz + 1);
    sum += this.getSkyExposure(wx, wy, wz - 1);
    return Math.max(0.24, sum / 6);
  }

  private getFluidTopHeight(wx: number, wy: number, wz: number, fluidId: BlockId): number {
    if (this.getBlock(wx, wy + 1, wz) === fluidId) return 1.0;
    const lvl = this.getFluidLevel(wx, wy, wz);
    if (lvl === 0) return 0.88;
    if (lvl >= 8) return 0.98;
    return Math.max(0.14, 0.88 - lvl * 0.1);
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
    if (ch.leavesMesh) {
      this.group.remove(ch.leavesMesh);
      ch.leavesMesh.geometry.dispose();
      ch.leavesMesh = null;
    }
    if (ch.liquidMesh) {
      this.group.remove(ch.liquidMesh);
      ch.liquidMesh.geometry.dispose();
      ch.liquidMesh = null;
    }

    _opPos.length = 0; _opNorm.length = 0; _opUv.length = 0; _opCol.length = 0; _opIdx.length = 0;
    _cutPos.length = 0; _cutNorm.length = 0; _cutUv.length = 0; _cutCol.length = 0; _cutIdx.length = 0;
    _leafPos.length = 0; _leafNorm.length = 0; _leafUv.length = 0; _leafCol.length = 0; _leafIdx.length = 0;
    _liqPos.length = 0; _liqNorm.length = 0; _liqUv.length = 0; _liqCol.length = 0; _liqIdx.length = 0;

    const opPos = _opPos, opNorm = _opNorm, opUv = _opUv, opCol = _opCol, opIdx = _opIdx;
    const cutPos = _cutPos, cutNorm = _cutNorm, cutUv = _cutUv, cutCol = _cutCol, cutIdx = _cutIdx;
    const leafPos = _leafPos, leafNorm = _leafNorm, leafUv = _leafUv, leafCol = _leafCol, leafIdx = _leafIdx;
    const liqPos = _liqPos, liqNorm = _liqNorm, liqUv = _liqUv, liqCol = _liqCol, liqIdx = _liqIdx;

    const baseX = ch.cx * CHUNK_SIZE;
    const baseZ = ch.cz * CHUNK_SIZE;
    const uStep = 1 / ATLAS_COLS;
    const vStep = 1 / ATLAS_ROWS;

    // Gather pre-cached light emitters in the 3x3 chunk neighborhood in O(E)
    const lightEmitters: LightEmitter[] = [];
    for (let dcx = -1; dcx <= 1; dcx++) {
      for (let dcz = -1; dcz <= 1; dcz++) {
        const nch = this.chunks.get(chunkKey(ch.cx + dcx, ch.cz + dcz));
        if (!nch) continue;
        this.ensureChunkEmitters(nch);
        for (let i = 0; i < nch.lightEmitters.length; i++) {
          lightEmitters.push(nch.lightEmitters[i]);
        }
      }
    }

    const sampleLightRGB = (wx: number, wy: number, wz: number): [number, number, number] => {
      const sky = this.getSkyColumnClear(wx, wy, wz);
      let blockLight = 0;
      for (let i = 0; i < lightEmitters.length; i++) {
        const em = lightEmitters[i];
        const dist = Math.abs(wx - em.x) + Math.abs(wy - em.y) + Math.abs(wz - em.z);
        if (dist < 8) {
          const atten = (1 - dist / 8) * em.power;
          if (atten > blockLight) blockLight = atten;
        }
      }
      const r = Math.min(1.15, Math.max(sky, blockLight * 1.15));
      const g = Math.min(1.08, Math.max(sky, blockLight * 0.94));
      const b = Math.min(1.0, Math.max(sky, blockLight * 0.64));
      return [r, g, b];
    };

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
      rgb: [number, number, number]
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
        col.push(ao[i] * rgb[0], ao[i] * rgb[1], ao[i] * rgb[2]);
      }

      if (ao[0] + ao[2] > ao[1] + ao[3]) {
        idx.push(baseVertex, baseVertex + 1, baseVertex + 2, baseVertex, baseVertex + 2, baseVertex + 3);
      } else {
        idx.push(baseVertex + 1, baseVertex + 2, baseVertex + 3, baseVertex + 1, baseVertex + 3, baseVertex);
      }
    };

    const pushBoxCustom = (
      pos: number[],
      norm: number[],
      uv: number[],
      col: number[],
      idx: number[],
      minX: number,
      minY: number,
      minZ: number,
      maxX: number,
      maxY: number,
      maxZ: number,
      tile: number,
      rgb: [number, number, number]
    ) => {
      for (const face of FACE_DEFS) {
        const ao: [number, number, number, number] = [face.shade, face.shade, face.shade, face.shade];
        const verts = face.corners.map(([vx, vy, vz]) => [
          vx === 0 ? minX : maxX,
          vy === 0 ? minY : maxY,
          vz === 0 ? minZ : maxZ,
        ]) as [[number, number, number], [number, number, number], [number, number, number], [number, number, number]];
        pushTileQuad(pos, norm, uv, col, idx, verts[0], verts[1], verts[2], verts[3], face.normal, tile, ao, rgb);
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

          // Cross plants (TallGrass, Dandelion, Poppy, Wheat, Sapling)
          if (def.crossPlant) {
            const tile = getBlockFaceTile(bId, 'pz');
            const rgb = sampleLightRGB(wx, y, wz);
            const ao: [number, number, number, number] = [0.88, 0.88, 1.0, 1.0];
            pushTileQuad(cutPos, cutNorm, cutUv, cutCol, cutIdx,
              [lx + 0.15, y, lz + 0.15], [lx + 0.85, y, lz + 0.85], [lx + 0.85, y + 0.9, lz + 0.85], [lx + 0.15, y + 0.9, lz + 0.15],
              [0, 1, 0], tile, ao, rgb);
            pushTileQuad(cutPos, cutNorm, cutUv, cutCol, cutIdx,
              [lx + 0.85, y, lz + 0.15], [lx + 0.15, y, lz + 0.85], [lx + 0.15, y + 0.9, lz + 0.85], [lx + 0.85, y + 0.9, lz + 0.15],
              [0, 1, 0], tile, ao, rgb);
            continue;
          }

          // 3D Torch / Redstone Torch geometry (stick + glowing flame top)
          if (def.torchLike) {
            const tile = getBlockFaceTile(bId, 'pz');
            const ao: [number, number, number, number] = [1, 1, 1, 1];
            const isRedstoneTorch = bId === BlockId.RedstoneTorch;
            const bright: [number, number, number] = isRedstoneTorch ? [1.25, 0.45, 0.45] : [1.2, 1.12, 0.9];
            pushBoxCustom(cutPos, cutNorm, cutUv, cutCol, cutIdx, lx + 0.43, y, lz + 0.43, lx + 0.57, y + 0.68, lz + 0.57, Tile.OakLogSide, [1.0, 0.95, 0.85]);
            pushTileQuad(cutPos, cutNorm, cutUv, cutCol, cutIdx,
              [lx + 0.42, y + 0.15, lz + 0.42], [lx + 0.58, y + 0.15, lz + 0.58], [lx + 0.58, y + 0.82, lz + 0.58], [lx + 0.42, y + 0.82, lz + 0.42],
              [0, 1, 0], tile, ao, bright);
            pushTileQuad(cutPos, cutNorm, cutUv, cutCol, cutIdx,
              [lx + 0.58, y + 0.15, lz + 0.42], [lx + 0.42, y + 0.15, lz + 0.58], [lx + 0.42, y + 0.82, lz + 0.58], [lx + 0.58, y + 0.82, lz + 0.42],
              [0, 1, 0], tile, ao, bright);
            continue;
          }

          // Nether Portal translucent glowing pane
          if (bId === BlockId.NetherPortal) {
            const tile = Tile.NetherPortal;
            const ao: [number, number, number, number] = [1, 1, 1, 1];
            const portalGlow: [number, number, number] = [1.2, 0.85, 1.3];
            const eastWest =
              this.getBlock(wx + 1, y, wz) === BlockId.NetherPortal ||
              this.getBlock(wx - 1, y, wz) === BlockId.NetherPortal ||
              this.getBlock(wx + 1, y, wz) === BlockId.Obsidian ||
              this.getBlock(wx - 1, y, wz) === BlockId.Obsidian;
            if (eastWest) {
              pushTileQuad(liqPos, liqNorm, liqUv, liqCol, liqIdx,
                [lx, y, lz + 0.44], [lx + 1, y, lz + 0.44], [lx + 1, y + 1, lz + 0.44], [lx, y + 1, lz + 0.44],
                [0, 0, 1], tile, ao, portalGlow);
            } else {
              pushTileQuad(liqPos, liqNorm, liqUv, liqCol, liqIdx,
                [lx + 0.44, y, lz], [lx + 0.44, y, lz + 1], [lx + 0.44, y + 1, lz + 1], [lx + 0.44, y + 1, lz],
                [1, 0, 0], tile, ao, portalGlow);
            }
            continue;
          }

          // Redstone Dust Wire (flat floor strip)
          if (bId === BlockId.RedstoneWire || bId === BlockId.RedstoneWireOn) {
            const isOn = bId === BlockId.RedstoneWireOn;
            const tile = isOn ? Tile.RedstoneWireOn : Tile.RedstoneWireOff;
            const ao: [number, number, number, number] = [1, 1, 1, 1];
            const rgb: [number, number, number] = isOn ? [1.28, 0.35, 0.35] : [0.75, 0.55, 0.55];
            pushTileQuad(cutPos, cutNorm, cutUv, cutCol, cutIdx,
              [lx, y + 0.025, lz + 1], [lx + 1, y + 0.025, lz + 1], [lx + 1, y + 0.025, lz], [lx, y + 0.025, lz],
              [0, 1, 0], tile, ao, rgb);
            continue;
          }

          // Lever (cobblestone base + tilted wooden handle)
          if (bId === BlockId.LeverOff || bId === BlockId.LeverOn) {
            const rgb = sampleLightRGB(wx, y, wz);
            const active = bId === BlockId.LeverOn;
            pushBoxCustom(cutPos, cutNorm, cutUv, cutCol, cutIdx, lx + 0.34, y, lz + 0.28, lx + 0.66, y + 0.16, lz + 0.72, Tile.Cobblestone, rgb);
            const dx = active ? 0.18 : -0.18;
            pushBoxCustom(cutPos, cutNorm, cutUv, cutCol, cutIdx,
              lx + 0.44 + dx * 0.5, y + 0.14, lz + 0.44,
              lx + 0.56 + dx * 0.5, y + 0.56, lz + 0.56,
              Tile.OakLogSide, active ? [1.2, 0.8, 0.8] : rgb);
            continue;
          }

          // Half-slab geometry (Bed, Enchanting Table)
          if (def.halfSlab) {
            const rgb = sampleLightRGB(wx, y, wz);
            const hTop = bId === BlockId.Bed ? 0.56 : 0.75;
            for (const face of FACE_DEFS) {
              const tile = getBlockFaceTile(bId, face.dir);
              const ao: [number, number, number, number] = [face.shade, face.shade, face.shade, face.shade];
              const verts = face.corners.map(([vx, vy, vz]) => [
                lx + vx,
                y + (vy === 1 ? hTop : 0),
                lz + vz,
              ]) as [[number, number, number], [number, number, number], [number, number, number], [number, number, number]];
              pushTileQuad(cutPos, cutNorm, cutUv, cutCol, cutIdx, verts[0], verts[1], verts[2], verts[3], face.normal, tile, ao, rgb);
            }
            continue;
          }

          // Fence Post + Connected Horizontal Rails (like Screenshot 2!)
          if (def.fenceLike) {
            const rgb = sampleLightRGB(wx, y, wz);
            const tile = getBlockFaceTile(bId, 'pz');
            pushBoxCustom(cutPos, cutNorm, cutUv, cutCol, cutIdx, lx + 0.375, y, lz + 0.375, lx + 0.625, y + 1.0, lz + 0.625, tile, rgb);
            const connects = (nx: number, nz: number) => {
              const nb = this.getBlock(nx, y, nz);
              return nb === bId || (BLOCKS[nb].solid && !BLOCKS[nb].transparent);
            };
            if (connects(wx + 1, wz)) {
              pushBoxCustom(cutPos, cutNorm, cutUv, cutCol, cutIdx, lx + 0.625, y + 0.375, lz + 0.44, lx + 1.0, y + 0.56, lz + 0.56, tile, rgb);
              pushBoxCustom(cutPos, cutNorm, cutUv, cutCol, cutIdx, lx + 0.625, y + 0.75, lz + 0.44, lx + 1.0, y + 0.935, lz + 0.56, tile, rgb);
            }
            if (connects(wx - 1, wz)) {
              pushBoxCustom(cutPos, cutNorm, cutUv, cutCol, cutIdx, lx, y + 0.375, lz + 0.44, lx + 0.375, y + 0.56, lz + 0.56, tile, rgb);
              pushBoxCustom(cutPos, cutNorm, cutUv, cutCol, cutIdx, lx, y + 0.75, lz + 0.44, lx + 0.375, y + 0.935, lz + 0.56, tile, rgb);
            }
            if (connects(wx, wz + 1)) {
              pushBoxCustom(cutPos, cutNorm, cutUv, cutCol, cutIdx, lx + 0.44, y + 0.375, lz + 0.625, lx + 0.56, y + 0.56, lz + 1.0, tile, rgb);
              pushBoxCustom(cutPos, cutNorm, cutUv, cutCol, cutIdx, lx + 0.44, y + 0.75, lz + 0.625, lx + 0.56, y + 0.935, lz + 1.0, tile, rgb);
            }
            if (connects(wx, wz - 1)) {
              pushBoxCustom(cutPos, cutNorm, cutUv, cutCol, cutIdx, lx + 0.44, y + 0.375, lz, lx + 0.56, y + 0.56, lz + 0.375, tile, rgb);
              pushBoxCustom(cutPos, cutNorm, cutUv, cutCol, cutIdx, lx + 0.44, y + 0.75, lz, lx + 0.56, y + 0.935, lz + 0.375, tile, rgb);
            }
            continue;
          }

          // Door geometry (Closed or Open)
          if (bId === BlockId.OakDoorClosed || bId === BlockId.OakDoorOpen) {
            const rgb = sampleLightRGB(wx, y, wz);
            const tile = getBlockFaceTile(bId, 'pz');
            const isOpen = bId === BlockId.OakDoorOpen;
            for (const face of FACE_DEFS) {
              const ao: [number, number, number, number] = [face.shade, face.shade, face.shade, face.shade];
              const verts = face.corners.map(([vx, vy, vz]) => [
                lx + (isOpen ? (vx === 0 ? 0.0 : 0.2) : vx),
                y + vy,
                lz + (isOpen ? vz : (vz === 0 ? 0.4 : 0.6)),
              ]) as [[number, number, number], [number, number, number], [number, number, number], [number, number, number]];
              pushTileQuad(cutPos, cutNorm, cutUv, cutCol, cutIdx, verts[0], verts[1], verts[2], verts[3], face.normal, tile, ao, rgb);
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
            const rgb: [number, number, number] =
              bId === BlockId.Lava || bId === BlockId.Glowstone || bId === BlockId.RedstoneLampOn
                ? [1.18, 1.05, 0.85]
                : sampleLightRGB(nx, ny, nz);

            // Smooth Java Edition 4-level vertex AO for opaque faces
            const ao: [number, number, number, number] = [1, 1, 1, 1];
            if (!def.liquid && !def.transparent) {
              for (let c = 0; c < 4; c++) {
                const cx = face.corners[c][0] === 1 ? 1 : -1;
                const cy = face.corners[c][1] === 1 ? 1 : -1;
                const cz = face.corners[c][2] === 1 ? 1 : -1;
                let side1 = false;
                let side2 = false;
                let corner = false;
                if (face.normal[1] !== 0) {
                  side1 = this.isSolidForAO(wx + cx, ny, wz);
                  side2 = this.isSolidForAO(wx, ny, wz + cz);
                  corner = this.isSolidForAO(wx + cx, ny, wz + cz);
                } else if (face.normal[0] !== 0) {
                  side1 = this.isSolidForAO(nx, y + cy, wz);
                  side2 = this.isSolidForAO(nx, y, wz + cz);
                  corner = this.isSolidForAO(nx, y + cy, wz + cz);
                } else {
                  side1 = this.isSolidForAO(wx + cx, y, nz);
                  side2 = this.isSolidForAO(wx, y + cy, nz);
                  corner = this.isSolidForAO(wx + cx, y + cy, nz);
                }
                const occ = side1 && side2 ? 3 : (side1 ? 1 : 0) + (side2 ? 1 : 0) + (corner ? 1 : 0);
                const aoCurve = occ === 0 ? 1.0 : occ === 1 ? 0.82 : occ === 2 ? 0.65 : 0.48;
                ao[c] = aoCurve * face.shade;
              }
            } else {
              for (let c = 0; c < 4; c++) ao[c] = face.shade;
            }

            const fluidTop = def.liquid ? this.getFluidTopHeight(wx, y, wz, bId) : 1;
            const verts = face.corners.map(([vx, vy, vz]) => {
              let vHeight = vy;
              if (def.liquid && vy === 1) {
                // Smoothly slope corner height across neighboring fluid cells
                let hSum = fluidTop;
                let hCount = 1;
                const ox = vx === 0 ? -1 : 1;
                const oz = vz === 0 ? -1 : 1;
                if (this.getBlock(wx + ox, y, wz) === bId) {
                  hSum += this.getFluidTopHeight(wx + ox, y, wz, bId);
                  hCount++;
                }
                if (this.getBlock(wx, y, wz + oz) === bId) {
                  hSum += this.getFluidTopHeight(wx, y, wz + oz, bId);
                  hCount++;
                }
                if (this.getBlock(wx + ox, y, wz + oz) === bId) {
                  hSum += this.getFluidTopHeight(wx + ox, y, wz + oz, bId);
                  hCount++;
                }
                vHeight = hSum / hCount;
              }
              return [lx + vx, y + vHeight, lz + vz];
            }) as [
              [number, number, number],
              [number, number, number],
              [number, number, number],
              [number, number, number],
            ];

            const isLeaves =
              bId === BlockId.OakLeaves ||
              bId === BlockId.BirchLeaves ||
              bId === BlockId.SpruceLeaves ||
              bId === BlockId.CherryLeaves;

            if (def.liquid) {
              pushTileQuad(liqPos, liqNorm, liqUv, liqCol, liqIdx, verts[0], verts[1], verts[2], verts[3], face.normal, tile, ao, rgb);
            } else if (isLeaves) {
              pushTileQuad(leafPos, leafNorm, leafUv, leafCol, leafIdx, verts[0], verts[1], verts[2], verts[3], face.normal, tile, ao, rgb);
            } else if (def.transparent) {
              pushTileQuad(cutPos, cutNorm, cutUv, cutCol, cutIdx, verts[0], verts[1], verts[2], verts[3], face.normal, tile, ao, rgb);
            } else {
              pushTileQuad(opPos, opNorm, opUv, opCol, opIdx, verts[0], verts[1], verts[2], verts[3], face.normal, tile, ao, rgb);
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
    ch.leavesMesh = makeMesh(leafPos, leafNorm, leafUv, leafCol, leafIdx, this.leavesMat, true, true);
    ch.liquidMesh = makeMesh(liqPos, liqNorm, liqUv, liqCol, liqIdx, this.liquidMat, false, true);
  }

  /**
   * 3D DDA voxel traversal raycaster (up to maxDist blocks).
   */
  public raycastVoxel(origin: THREE.Vector3, dir: THREE.Vector3, maxDist = 5.2, includeLiquids = false): VoxelHit | null {
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
      if (b !== BlockId.Air && (includeLiquids || !BLOCKS[b].liquid)) {
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
