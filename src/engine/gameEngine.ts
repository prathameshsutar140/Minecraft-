import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  AdvancementToast,
  BlockId,
  ChatMessage,
  ChestState,
  ContainerType,
  EnchantmentData,
  FurnaceState,
  GameMode,
  GameOptions,
  GamePhase,
  HudSnapshot,
  ItemId,
  ItemStack,
  MobType,
  WeatherType,
} from '../types/game';
import {
  BLOCKS,
  BLOCK_ITEM,
  canHarvestBlock,
  getMiningDurationSeconds,
  ITEMS,
} from '../data/itemsAndBlocks';
import { findSmeltOutput } from '../data/recipes';
import { ATLAS_COLS, ATLAS_ROWS, buildTextureAtlas, createItemCanvasTexture, getBlockFaceTile } from './textures';
import { CHUNK_HEIGHT, CHUNK_SIZE, VoxelHit, VoxelWorld } from './world';
import {
  ArrowEntity,
  collidesBox,
  createArrowMesh,
  createDroppedItemMesh,
  createEnderPearlMesh,
  createMobEntity,
  createPlayerCharacterModel,
  DroppedItemEntity,
  EnderPearlEntity,
  getMobDrops,
  LitTntEntity,
  MobEntity,
  moveMobWithCollision,
  updateMobAmbientSounds,
} from './mobs';
import { soundEngine } from './audio';

const _vec3 = new THREE.Vector3();
const _vec3b = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _skyColor = new THREE.Color();
const _fogColor = new THREE.Color();
const _noonSky = new THREE.Color(0x78a7ff);
const _sunsetSky = new THREE.Color(0xd97348);
const _nightSky = new THREE.Color(0x090d1a);
const _rainSky = new THREE.Color(0x4c586b);

const SAVE_KEY = 'minecraft_java_edition_save_v1';

interface ParticleItem {
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
  life: number;
  maxLife: number;
}

export interface SaveSummary {
  seed: number;
  gameMode: GameMode;
  dayCount: number;
  savedAt: number;
}

export function getSavedWorldSummary(): SaveSummary | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return {
      seed: parsed.seed ?? 133742,
      gameMode: parsed.gameMode ?? 'survival',
      dayCount: parsed.dayCount ?? 1,
      savedAt: parsed.savedAt ?? Date.now(),
    };
  } catch {
    return null;
  }
}

export class MinecraftEngine {
  private container: HTMLElement;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private isSoftwareGl: boolean;

  private sunLight: THREE.DirectionalLight;
  private hemiLight: THREE.HemisphereLight;
  private heldTorchLight: THREE.PointLight;
  private sunMesh: THREE.Mesh;
  private moonMesh: THREE.Mesh;
  private starPoints: THREE.Points;
  private cloudGroup: THREE.Group;
  private cloudMat!: THREE.MeshBasicMaterial;
  private rainPoints: THREE.Points;

  private atlasCanvas: HTMLCanvasElement;
  private atlasTexture: THREE.CanvasTexture;
  private crackTextures: THREE.CanvasTexture[];

  public world!: VoxelWorld;
  private worldSeed = 133742;

  // Player state
  public phase: GamePhase = 'title';
  public gameMode: GameMode = 'survival';
  public options: GameOptions = {
    fov: 75,
    renderDistance: 4,
    mouseSensitivity: 1.0,
    soundVolume: 0.65,
    muted: false,
    showClouds: true,
    touchControls: 'auto',
  };

  private playerPos = new THREE.Vector3(0.5, 36, 0.5);
  private spawnPoint = new THREE.Vector3(0.5, 36, 0.5);
  private playerVel = new THREE.Vector3();
  private yaw = 0;
  private pitch = -0.1;
  private onGround = false;
  private isSprinting = false;
  private isSneaking = false;
  private isFlying = false;
  private lastSpaceTap = 0;
  private coyoteTimer = 0;
  private jumpBufferTimer = 0;
  private fallStartY = 36;
  private wasFalling = false;
  private stepAccum = 0;

  // Survival vitals
  private health = 20;
  private maxHealth = 20;
  private hunger = 20;
  private maxHunger = 20;
  private saturation = 5;
  private exhaustion = 0;
  private air = 20;
  private maxAir = 20;
  private regenTimer = 0;
  private lavaTickTimer = 0;
  private xpLevel = 0;
  private xpProgress = 0;
  private score = 0;
  private damageFlash = 0;
  private cameraShake = 0;

  // Inventory & Containers
  public selectedHotbar = 0;
  public hotbar: (ItemStack | null)[] = new Array(9).fill(null);
  public inventory: (ItemStack | null)[] = new Array(27).fill(null);
  public armorSlots: (ItemStack | null)[] = new Array(4).fill(null);
  public activeContainer: ContainerType = 'none';
  public activeBlockPos: { x: number; y: number; z: number } | null = null;
  private furnaces = new Map<string, FurnaceState>();
  private chests = new Map<string, ChestState>();

  // Camera & Viewmodel
  private cameraMode: 0 | 1 | 2 = 0;
  private playerModel: ReturnType<typeof createPlayerCharacterModel>;
  private viewModelGroup: THREE.Group;
  private heldArmGroup: THREE.Group;
  private heldBlockMesh: THREE.Mesh;
  private heldSpriteMesh: THREE.Mesh;
  private heldItemTexture: THREE.CanvasTexture | null = null;
  private swingProgress = 0;
  private isSwinging = false;
  private walkBobPhase = 0;

  // Block selection & breaking
  private selectionWireframe: THREE.LineSegments;
  private crackOverlay: THREE.Mesh;
  private currentTarget: VoxelHit | null = null;
  private miningBlockKey = '';
  private miningElapsed = 0;
  private miningDuration = 1;
  private digSoundTimer = 0;

  // Entities & FX
  private nextEntityId = 1;
  private mobs: MobEntity[] = [];
  private droppedItems: DroppedItemEntity[] = [];
  private arrows: ArrowEntity[] = [];
  private litTnts: LitTntEntity[] = [];
  private enderPearls: EnderPearlEntity[] = [];
  private particles: ParticleItem[] = [];
  private particleGeo = new THREE.BoxGeometry(0.12, 0.12, 0.12);
  private mobSpawnTimer = 2;
  private cropTickTimer = 0;

  // Advancements
  private unlockedAdvancements = new Set<string>();

  // Time & Weather
  private dayTime = 4500; // 0..24000 (6000 = noon, 18000 = midnight)
  private dayCount = 1;
  private weather: WeatherType = 'clear';
  private titleAngle = 0;

  // Input tracking & Touch controls
  private heldKeys = new Set<string>();
  private mouseLeftDown = false;
  private mouseRightDown = false;
  private rightClickCooldown = 0;
  private pointerLocked = false;
  private pointerLockUnsupported = false;
  private isDraggingLook = false;
  private lastPointerX = 0;
  private lastPointerY = 0;
  private touchMoveFwd = 0;
  private touchMoveStrafe = 0;
  private touchJump = false;
  private touchSneak = false;
  private touchMineHeld = false;
  private touchSprintToggle = false;
  private touchSneakToggle = false;

  // Loop & callbacks
  private frameId = 0;
  private lastTime = performance.now();
  private fpsAccum = 0;
  private fpsFrames = 0;
  private currentFps = 60;
  private hudSyncTimer = 0;
  private disposed = false;

  private onHudUpdate: (snap: HudSnapshot) => void;
  private onPhaseChange: (phase: GamePhase) => void;
  private onChatMessage: (msg: ChatMessage) => void;
  private onPointerLockChange: (locked: boolean) => void;
  private onAdvancement?: (toast: AdvancementToast) => void;

  constructor(
    container: HTMLElement,
    callbacks: {
      onHudUpdate: (snap: HudSnapshot) => void;
      onPhaseChange: (phase: GamePhase) => void;
      onChatMessage: (msg: ChatMessage) => void;
      onPointerLockChange: (locked: boolean) => void;
      onAdvancement?: (toast: AdvancementToast) => void;
    }
  ) {
    this.container = container;
    this.onHudUpdate = callbacks.onHudUpdate;
    this.onPhaseChange = callbacks.onPhaseChange;
    this.onChatMessage = callbacks.onChatMessage;
    this.onPointerLockChange = callbacks.onPointerLockChange;
    this.onAdvancement = callbacks.onAdvancement;

    this.isSoftwareGl = (() => {
      const gl = document.createElement('canvas').getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NeutralToneMapping;
    this.renderer.toneMappingExposure = 1.06;
    this.renderer.setPixelRatio(this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.setSize(container.clientWidth || window.innerWidth, container.clientHeight || window.innerHeight);
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x78a7ff);
    this.scene.fog = new THREE.Fog(0x78a7ff, 30, 76);

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

    const w = container.clientWidth || window.innerWidth;
    const h = container.clientHeight || window.innerHeight;
    this.camera = new THREE.PerspectiveCamera(this.options.fov, w / h, 0.08, 260);
    this.scene.add(this.camera);

    // Lighting
    this.hemiLight = new THREE.HemisphereLight(0xd9ecff, 0x453b31, 0.9);
    this.scene.add(this.hemiLight);

    this.sunLight = new THREE.DirectionalLight(0xfff5e0, 1.3);
    this.sunLight.castShadow = !this.isSoftwareGl;
    this.sunLight.shadow.mapSize.set(1024, 1024);
    this.sunLight.shadow.camera.left = -32;
    this.sunLight.shadow.camera.right = 32;
    this.sunLight.shadow.camera.top = 32;
    this.sunLight.shadow.camera.bottom = -32;
    this.sunLight.shadow.camera.near = 1;
    this.sunLight.shadow.camera.far = 140;
    this.sunLight.shadow.bias = -0.0006;
    this.sunLight.shadow.normalBias = 0.02;
    this.scene.add(this.sunLight);
    this.scene.add(this.sunLight.target);

    this.heldTorchLight = new THREE.PointLight(0xffb55a, 0, 12, 1.6);
    this.scene.add(this.heldTorchLight);

    // Pixel-art Java Sun & Moon Textures
    const makeSunTex = () => {
      const c = document.createElement('canvas');
      c.width = 8;
      c.height = 8;
      const ctx = c.getContext('2d')!;
      ctx.fillStyle = '#fde68a';
      ctx.fillRect(0, 0, 8, 8);
      ctx.fillStyle = '#fffbeb';
      ctx.fillRect(1, 1, 6, 6);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(2, 2, 4, 4);
      const t = new THREE.CanvasTexture(c);
      t.magFilter = THREE.NearestFilter;
      t.minFilter = THREE.NearestFilter;
      t.colorSpace = THREE.SRGBColorSpace;
      return t;
    };
    const makeMoonTex = () => {
      const c = document.createElement('canvas');
      c.width = 8;
      c.height = 8;
      const ctx = c.getContext('2d')!;
      ctx.fillStyle = '#d4d8e8';
      ctx.fillRect(0, 0, 8, 8);
      ctx.fillStyle = '#eef2ff';
      ctx.fillRect(1, 1, 6, 6);
      ctx.fillStyle = '#9ca3af';
      ctx.fillRect(2, 2, 2, 1);
      ctx.fillRect(5, 4, 1, 2);
      ctx.fillRect(2, 5, 1, 1);
      const t = new THREE.CanvasTexture(c);
      t.magFilter = THREE.NearestFilter;
      t.minFilter = THREE.NearestFilter;
      t.colorSpace = THREE.SRGBColorSpace;
      return t;
    };

    // Celestial objects
    this.sunMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(14, 14),
      new THREE.MeshBasicMaterial({ map: makeSunTex(), fog: false, side: THREE.DoubleSide })
    );
    this.moonMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(11, 11),
      new THREE.MeshBasicMaterial({ map: makeMoonTex(), fog: false, side: THREE.DoubleSide })
    );
    this.scene.add(this.sunMesh, this.moonMesh);

    // Starfield
    const starPositions = new Float32Array(260 * 3);
    for (let i = 0; i < 260; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random());
      const r = 140;
      starPositions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      starPositions[i * 3 + 1] = r * Math.cos(phi);
      starPositions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    this.starPoints = new THREE.Points(
      starGeo,
      new THREE.PointsMaterial({ color: 0xffffff, size: 1.35, transparent: true, opacity: 0, fog: false })
    );
    this.scene.add(this.starPoints);

    // Voxel Clouds
    this.cloudGroup = new THREE.Group();
    this.cloudMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 });
    for (let i = 0; i < 18; i++) {
      const cw = 10 + Math.floor(Math.random() * 14);
      const cd = 7 + Math.floor(Math.random() * 10);
      const cm = new THREE.Mesh(new THREE.BoxGeometry(cw, 1.5, cd), this.cloudMat);
      cm.position.set((Math.random() - 0.5) * 180, 56, (Math.random() - 0.5) * 180);
      this.cloudGroup.add(cm);
    }
    this.scene.add(this.cloudGroup);

    // Rain particles
    const rainCount = 450;
    const rainPos = new Float32Array(rainCount * 3);
    for (let i = 0; i < rainCount; i++) {
      rainPos[i * 3] = (Math.random() - 0.5) * 28;
      rainPos[i * 3 + 1] = Math.random() * 20;
      rainPos[i * 3 + 2] = (Math.random() - 0.5) * 28;
    }
    const rainGeo = new THREE.BufferGeometry();
    rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
    this.rainPoints = new THREE.Points(
      rainGeo,
      new THREE.PointsMaterial({ color: 0x8fb5ff, size: 0.16, transparent: true, opacity: 0.65 })
    );
    this.rainPoints.visible = false;
    this.scene.add(this.rainPoints);

    // Build Procedural Texture Atlas
    const maxAniso = this.renderer.capabilities.getMaxAnisotropy();
    const atlas = buildTextureAtlas(maxAniso);
    this.atlasCanvas = atlas.canvas;
    this.atlasTexture = atlas.atlasTexture;
    this.crackTextures = atlas.crackTextures;

    // Block target wireframe & crack overlay
    const wireGeo = new THREE.EdgesGeometry(new THREE.BoxGeometry(1.006, 1.006, 1.006));
    this.selectionWireframe = new THREE.LineSegments(
      wireGeo,
      new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.8 })
    );
    this.selectionWireframe.visible = false;
    this.scene.add(this.selectionWireframe);

    this.crackOverlay = new THREE.Mesh(
      new THREE.BoxGeometry(1.004, 1.004, 1.004),
      new THREE.MeshBasicMaterial({
        map: this.crackTextures[0],
        transparent: true,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -1,
      })
    );
    this.crackOverlay.visible = false;
    this.scene.add(this.crackOverlay);

    // First-person held Steve arm + 3D textured voxel block + pixel-art held item viewmodel
    this.viewModelGroup = new THREE.Group();

    this.heldArmGroup = new THREE.Group();
    const armSkin = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, 0.18, 0.44),
      new THREE.MeshStandardMaterial({ color: 0xd9a788, roughness: 0.85 })
    );
    const armSleeve = new THREE.Mesh(
      new THREE.BoxGeometry(0.19, 0.19, 0.16),
      new THREE.MeshStandardMaterial({ color: 0x1aa3a8, roughness: 0.85 })
    );
    armSleeve.position.set(0, 0, 0.22);
    this.heldArmGroup.add(armSkin, armSleeve);
    this.heldArmGroup.position.set(0.44, -0.36, -0.52);
    this.heldArmGroup.rotation.set(0.28, -0.38, 0.18);

    this.heldBlockMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.28, 0.28, 0.28),
      new THREE.MeshLambertMaterial({ map: this.atlasTexture })
    );
    this.heldBlockMesh.position.set(0.42, -0.34, -0.58);
    this.heldBlockMesh.rotation.set(0.18, 0.65, 0.08);
    this.heldBlockMesh.visible = false;

    this.heldSpriteMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(0.36, 0.36),
      new THREE.MeshBasicMaterial({
        transparent: true,
        alphaTest: 0.4,
        side: THREE.DoubleSide,
      })
    );
    this.heldSpriteMesh.position.set(0.42, -0.28, -0.55);
    this.heldSpriteMesh.rotation.set(0.1, -0.45, 0.12);
    this.heldSpriteMesh.visible = false;

    this.viewModelGroup.add(this.heldArmGroup, this.heldBlockMesh, this.heldSpriteMesh);
    this.camera.add(this.viewModelGroup);

    // 3rd-person player model
    this.playerModel = createPlayerCharacterModel();
    this.playerModel.group.visible = false;
    this.scene.add(this.playerModel.group);

    // Generate initial showcase terrain for Title Screen
    this.initWorld(133742, 'survival', false);

    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }

    this.bindEvents();
    this.startLoop();
  }

  public getAtlasCanvas(): HTMLCanvasElement {
    return this.atlasCanvas;
  }

  public initWorld(seed: number, mode: GameMode, giveBonusChest: boolean) {
    if (this.world) {
      this.scene.remove(this.world.group);
      this.world.dispose();
    }
    this.clearEntities();
    this.furnaces.clear();
    this.chests.clear();
    this.unlockedAdvancements.clear();

    this.worldSeed = seed;
    this.gameMode = mode;
    this.world = new VoxelWorld(seed, this.atlasTexture);
    this.scene.add(this.world.group);

    // Pre-generate spawn chunks
    const r = this.options.renderDistance;
    for (let cx = -r; cx <= r; cx++) {
      for (let cz = -r; cz <= r; cz++) {
        this.world.ensureChunk(cx, cz);
      }
    }
    this.world.updateDirtyChunks(999);
    this.populatePendingStructureChests();

    const spawnY = this.world.getTopSolidY(0, 0);
    this.playerPos.set(0.5, spawnY + 0.2, 0.5);
    this.spawnPoint.copy(this.playerPos);
    this.playerVel.set(0, 0, 0);
    this.fallStartY = this.playerPos.y;
    this.yaw = 0;
    this.pitch = -0.1;

    this.health = 20;
    this.hunger = 20;
    this.saturation = 5;
    this.air = 20;
    this.xpLevel = 0;
    this.xpProgress = 0;
    this.score = 0;
    this.dayTime = 4500;
    this.dayCount = 1;
    this.weather = 'clear';
    this.isFlying = mode === 'creative' || mode === 'spectator';
    this.touchMoveFwd = 0;
    this.touchMoveStrafe = 0;
    this.touchJump = false;
    this.touchSneak = false;
    this.touchMineHeld = false;
    this.touchSprintToggle = false;
    this.touchSneakToggle = false;

    this.hotbar.fill(null);
    this.inventory.fill(null);
    this.armorSlots.fill(null);

    if (mode === 'creative') {
      this.hotbar[0] = { id: BLOCK_ITEM(BlockId.GrassBlock), count: 64 };
      this.hotbar[1] = { id: BLOCK_ITEM(BlockId.StoneBricks), count: 64 };
      this.hotbar[2] = { id: BLOCK_ITEM(BlockId.OakPlanks), count: 64 };
      this.hotbar[3] = { id: BLOCK_ITEM(BlockId.Glass), count: 64 };
      this.hotbar[4] = { id: BLOCK_ITEM(BlockId.Torch), count: 64 };
      this.hotbar[5] = { id: BLOCK_ITEM(BlockId.Tnt), count: 64 };
      this.hotbar[6] = { id: 'diamond_pickaxe', count: 1, durability: 1561 };
      this.hotbar[7] = { id: 'diamond_sword', count: 1, durability: 1561 };
      this.hotbar[8] = { id: 'ender_pearl', count: 16 };
    } else if (giveBonusChest) {
      this.hotbar[0] = { id: 'wooden_pickaxe', count: 1, durability: 59 };
      this.hotbar[1] = { id: 'wooden_axe', count: 1, durability: 59 };
      this.hotbar[2] = { id: BLOCK_ITEM(BlockId.Torch), count: 8 };
      this.hotbar[3] = { id: 'bread', count: 4 };
      this.hotbar[4] = { id: BLOCK_ITEM(BlockId.OakPlanks), count: 12 };
    }

    // Spawn initial passive animals nearby
    this.spawnInitialMobs();
    this.updateHeldItemAppearance();
    this.syncHud();
  }

  public startNewGame(seed: number, mode: GameMode, bonusChest: boolean) {
    this.initWorld(seed, mode, bonusChest);
    this.phase = 'playing';
    this.activeContainer = 'none';
    this.onPhaseChange('playing');
    this.requestPointerLock();
    this.pushChat(`World created (Seed: ${seed}) in ${mode.toUpperCase()} mode.`, '#a7f3d0');
  }

  public loadSavedGame(): boolean {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return false;
      const data = JSON.parse(raw);
      this.initWorld(data.seed ?? 133742, data.gameMode ?? 'survival', false);

      if (Array.isArray(data.deltas)) {
        for (const [k, bId] of data.deltas) {
          this.world.deltas.set(k, bId);
          const [dx, dy, dz] = k.split(',').map(Number);
          this.world.setBlock(dx, dy, dz, bId, false);
        }
        this.world.updateDirtyChunks(999);
      }

      if (data.playerPos) this.playerPos.set(data.playerPos.x, data.playerPos.y, data.playerPos.z);
      if (data.spawnPoint) this.spawnPoint.set(data.spawnPoint.x, data.spawnPoint.y, data.spawnPoint.z);
      this.yaw = data.yaw ?? 0;
      this.pitch = data.pitch ?? 0;
      this.health = data.health ?? 20;
      this.hunger = data.hunger ?? 20;
      this.saturation = data.saturation ?? 5;
      this.xpLevel = data.xpLevel ?? 0;
      this.xpProgress = data.xpProgress ?? 0;
      this.score = data.score ?? 0;
      this.dayTime = data.dayTime ?? 4500;
      this.dayCount = data.dayCount ?? 1;
      if (Array.isArray(data.hotbar)) this.hotbar = data.hotbar;
      if (Array.isArray(data.inventory)) this.inventory = data.inventory;
      if (Array.isArray(data.armorSlots)) this.armorSlots = data.armorSlots;
      if (Array.isArray(data.furnaces)) this.furnaces = new Map(data.furnaces);
      if (Array.isArray(data.chests)) this.chests = new Map(data.chests);
      if (Array.isArray(data.advancements)) this.unlockedAdvancements = new Set(data.advancements);

      this.phase = 'playing';
      this.activeContainer = 'none';
      this.onPhaseChange('playing');
      this.updateHeldItemAppearance();
      this.syncHud();
      this.requestPointerLock();
      this.pushChat('Loaded saved world.', '#fde68a');
      return true;
    } catch {
      return false;
    }
  }

  public saveGame() {
    try {
      const payload = {
        seed: this.worldSeed,
        gameMode: this.gameMode,
        playerPos: { x: this.playerPos.x, y: this.playerPos.y, z: this.playerPos.z },
        spawnPoint: { x: this.spawnPoint.x, y: this.spawnPoint.y, z: this.spawnPoint.z },
        yaw: this.yaw,
        pitch: this.pitch,
        health: this.health,
        hunger: this.hunger,
        saturation: this.saturation,
        xpLevel: this.xpLevel,
        xpProgress: this.xpProgress,
        score: this.score,
        dayTime: this.dayTime,
        dayCount: this.dayCount,
        hotbar: this.hotbar,
        inventory: this.inventory,
        armorSlots: this.armorSlots,
        deltas: Array.from(this.world.deltas.entries()),
        furnaces: Array.from(this.furnaces.entries()),
        chests: Array.from(this.chests.entries()),
        advancements: Array.from(this.unlockedAdvancements),
        savedAt: Date.now(),
      };
      localStorage.setItem(SAVE_KEY, JSON.stringify(payload));
    } catch {
      // Storage quota fallback
    }
  }

  public saveAndQuitToTitle() {
    this.saveGame();
    this.exitPointerLock();
    this.activeContainer = 'none';
    this.phase = 'title';
    this.onPhaseChange('title');
  }

  public resumeGame() {
    this.activeContainer = 'none';
    this.activeBlockPos = null;
    this.phase = 'playing';
    this.onPhaseChange('playing');
    this.requestPointerLock();
    this.syncHud();
  }

  public respawnPlayer() {
    const sx = Math.floor(this.spawnPoint.x);
    const sz = Math.floor(this.spawnPoint.z);
    const safeY = Math.max(this.spawnPoint.y, this.world.getTopSolidY(sx, sz) + 0.2);
    if (!BLOCKS[this.world.getBlock(sx, Math.floor(this.spawnPoint.y), sz)].solid) {
      this.playerPos.copy(this.spawnPoint);
    } else {
      this.playerPos.set(this.spawnPoint.x, safeY, this.spawnPoint.z);
    }
    this.playerVel.set(0, 0, 0);
    this.health = 20;
    this.hunger = 20;
    this.saturation = 5;
    this.air = 20;
    this.damageFlash = 0;
    this.fallStartY = this.playerPos.y;
    this.phase = 'playing';
    this.onPhaseChange('playing');
    this.requestPointerLock();
    this.syncHud();
  }

  public openContainer(type: ContainerType, pos: { x: number; y: number; z: number } | null = null) {
    this.activeContainer = type;
    this.activeBlockPos = pos;
    this.heldKeys.clear();
    this.mouseLeftDown = false;
    this.touchMoveFwd = 0;
    this.touchMoveStrafe = 0;
    this.touchJump = false;
    this.touchMineHeld = false;
    this.exitPointerLock();
    this.syncHud();
  }

  public closeContainer() {
    this.activeContainer = 'none';
    this.activeBlockPos = null;
    if (this.phase === 'playing') {
      this.requestPointerLock();
    }
    this.syncHud();
  }

  public updateOptions(next: Partial<GameOptions>) {
    this.options = { ...this.options, ...next };
    this.camera.fov = this.options.fov;
    this.camera.updateProjectionMatrix();
    soundEngine.volume = this.options.soundVolume;
    soundEngine.muted = this.options.muted;
    this.cloudGroup.visible = this.options.showClouds;
    const maxDist = Math.max(40, this.options.renderDistance * 16 + 10);
    if (this.scene.fog instanceof THREE.Fog) {
      this.scene.fog.near = maxDist * 0.42;
      this.scene.fog.far = maxDist;
    }
  }

  public selectHotbarSlot(index: number) {
    this.selectedHotbar = ((index % 9) + 9) % 9;
    this.updateHeldItemAppearance();
    this.syncHud();
  }

  public setInventorySlot(
    zone: 'hotbar' | 'inventory' | 'armor',
    index: number,
    stack: ItemStack | null
  ) {
    if (zone === 'hotbar') this.hotbar[index] = stack;
    else if (zone === 'inventory') this.inventory[index] = stack;
    else if (zone === 'armor') this.armorSlots[index] = stack;
    this.updateHeldItemAppearance();
    this.syncHud();
  }

  public updateFurnaceState(posKey: string, state: FurnaceState) {
    this.furnaces.set(posKey, state);
    this.syncHud();
  }

  public updateChestState(posKey: string, state: ChestState) {
    this.chests.set(posKey, state);
    this.syncHud();
  }

  public giveItem(id: ItemId, count = 1): boolean {
    const def = ITEMS[id];
    if (!def) return false;
    let remaining = count;

    if (id === 'iron_ingot') this.unlockAdvancement('smelt_iron', 'Acquire Hardware', 'Smelt or obtain an iron ingot');
    if (id === 'diamond') this.unlockAdvancement('diamonds', 'Diamonds!', 'Acquire diamonds');
    if (id === BLOCK_ITEM(BlockId.CraftingTable)) this.unlockAdvancement('craft_table', 'Benchmarking', 'Craft a crafting table');

    // Try stacking onto existing hotbar/inventory stacks first
    const lists = [this.hotbar, this.inventory];
    for (const list of lists) {
      for (let i = 0; i < list.length; i++) {
        const s = list[i];
        if (s && s.id === id && s.count < def.stackSize && def.stackSize > 1) {
          const add = Math.min(remaining, def.stackSize - s.count);
          s.count += add;
          remaining -= add;
          if (remaining <= 0) {
            this.updateHeldItemAppearance();
            this.syncHud();
            return true;
          }
        }
      }
    }

    // Empty slots
    for (const list of lists) {
      for (let i = 0; i < list.length; i++) {
        if (!list[i]) {
          const add = Math.min(remaining, def.stackSize);
          list[i] = {
            id,
            count: add,
            durability: def.maxDurability,
          };
          remaining -= add;
          if (remaining <= 0) {
            this.updateHeldItemAppearance();
            this.syncHud();
            return true;
          }
        }
      }
    }
    this.updateHeldItemAppearance();
    this.syncHud();
    return remaining < count;
  }

  public setTouchMove(fwd: number, strafe: number) {
    this.touchMoveFwd = THREE.MathUtils.clamp(fwd, -1, 1);
    this.touchMoveStrafe = THREE.MathUtils.clamp(strafe, -1, 1);
  }

  public setTouchAction(action: 'jump' | 'sneak' | 'mine', pressed: boolean) {
    if (action === 'jump') {
      if (pressed && !this.touchJump) {
        this.jumpBufferTimer = 0.14;
        if (this.gameMode === 'creative' || this.gameMode === 'spectator') {
          const now = performance.now();
          if (now - this.lastSpaceTap < 280) {
            this.isFlying = !this.isFlying;
            this.playerVel.y = 0;
            this.lastSpaceTap = 0;
            this.syncHud();
          } else {
            this.lastSpaceTap = now;
          }
        }
      }
      this.touchJump = pressed;
    } else if (action === 'sneak') {
      this.touchSneak = pressed;
    } else if (action === 'mine') {
      this.touchMineHeld = pressed;
      if (pressed) {
        this.triggerSwing();
        this.tryAttackMobOrStartBreak();
      } else {
        this.resetMining();
      }
    }
  }

  public triggerTouchPlaceOrUse() {
    if (this.phase !== 'playing' || this.activeContainer !== 'none') return;
    this.rightClickCooldown = 0;
    this.handleRightClick();
  }

  public addLookDelta(dx: number, dy: number) {
    if (this.phase !== 'playing' || this.activeContainer !== 'none') return;
    const sens = 0.0042 * this.options.mouseSensitivity;
    this.yaw -= dx * sens;
    this.pitch = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, this.pitch - dy * sens));
  }

  public toggleSprint() {
    this.touchSprintToggle = !this.touchSprintToggle;
    this.syncHud();
  }

  public toggleSneak() {
    this.touchSneakToggle = !this.touchSneakToggle;
    this.syncHud();
  }

  public toggleCameraMode() {
    this.cameraMode = ((this.cameraMode + 1) % 3) as 0 | 1 | 2;
    this.syncHud();
  }

  public enchantSlotItem(
    zone: 'hotbar' | 'inventory',
    index: number,
    enchantment: EnchantmentData,
    xpCost: number
  ): boolean {
    const list = zone === 'hotbar' ? this.hotbar : this.inventory;
    const stack = list[index];
    if (!stack) return false;
    if (this.gameMode === 'survival' && this.xpLevel < xpCost) return false;

    if (this.gameMode === 'survival') {
      this.xpLevel -= xpCost;
    }
    list[index] = { ...stack, enchantment };
    soundEngine.playEnchant();
    this.unlockAdvancement('enchanter', 'Enchanter', 'Enchant an item at an Enchanting Table');
    this.updateHeldItemAppearance();
    this.syncHud();
    return true;
  }

  private unlockAdvancement(id: string, title: string, description: string) {
    if (this.unlockedAdvancements.has(id)) return;
    this.unlockedAdvancements.add(id);
    this.onAdvancement?.({ id, title, description, timestamp: Date.now() });
    this.pushChat(`Player has made the advancement [${title}]`, '#a7f3d0');
  }

  private populatePendingStructureChests() {
    if (this.world.structureChests.length === 0) return;
    const lootPool: { id: ItemId; min: number; max: number; chance: number }[] = [
      { id: 'bread', min: 1, max: 3, chance: 0.65 },
      { id: 'apple', min: 1, max: 3, chance: 0.5 },
      { id: 'iron_ingot', min: 1, max: 4, chance: 0.5 },
      { id: 'gold_ingot', min: 1, max: 3, chance: 0.35 },
      { id: 'wheat_seeds', min: 2, max: 5, chance: 0.55 },
      { id: BLOCK_ITEM(BlockId.Obsidian), min: 1, max: 2, chance: 0.25 },
      { id: 'flint', min: 1, max: 3, chance: 0.45 },
      { id: 'lapis_lazuli', min: 1, max: 4, chance: 0.4 },
      { id: 'diamond', min: 1, max: 1, chance: 0.16 },
      { id: 'ender_pearl', min: 1, max: 1, chance: 0.14 },
    ];
    while (this.world.structureChests.length > 0) {
      const pos = this.world.structureChests.pop()!;
      const key = `${pos.x},${pos.y},${pos.z}`;
      if (this.chests.has(key)) continue;
      const slots: (ItemStack | null)[] = new Array(27).fill(null);
      for (const entry of lootPool) {
        if (!ITEMS[entry.id]) continue;
        if (Math.random() < entry.chance) {
          const slotIdx = Math.floor(Math.random() * 27);
          const cnt = entry.min + Math.floor(Math.random() * (entry.max - entry.min + 1));
          slots[slotIdx] = { id: entry.id, count: cnt };
        }
      }
      slots[0] = slots[0] ?? { id: 'bread', count: 2 };
      this.chests.set(key, { slots });
    }
  }

  public executeCommand(raw: string) {
    const trimmed = raw.trim();
    if (!trimmed) return;
    if (!trimmed.startsWith('/')) {
      this.pushChat(`<Player> ${trimmed}`, '#ffffff');
      return;
    }

    const parts = trimmed.slice(1).split(/\s+/);
    const cmd = parts[0].toLowerCase();
    const arg1 = parts[1]?.toLowerCase();

    if (cmd === 'gamemode') {
      if (arg1 === 'survival' || arg1 === '0' || arg1 === 's') {
        this.gameMode = 'survival';
        this.isFlying = false;
        this.pushChat('Set own game mode to Survival Mode', '#fde68a');
      } else if (arg1 === 'creative' || arg1 === '1' || arg1 === 'c') {
        this.gameMode = 'creative';
        this.pushChat('Set own game mode to Creative Mode', '#fde68a');
      } else if (arg1 === 'spectator' || arg1 === '3') {
        this.gameMode = 'spectator';
        this.isFlying = true;
        this.pushChat('Set own game mode to Spectator Mode', '#fde68a');
      } else {
        this.pushChat('Usage: /gamemode <survival|creative|spectator>', '#fca5a5');
      }
    } else if (cmd === 'time' && arg1 === 'set') {
      const t = parts[2]?.toLowerCase();
      if (t === 'day') this.dayTime = 1000;
      else if (t === 'noon') this.dayTime = 6000;
      else if (t === 'sunset') this.dayTime = 12000;
      else if (t === 'night') this.dayTime = 14000;
      else if (t === 'midnight') this.dayTime = 18000;
      else if (!Number.isNaN(Number(t))) this.dayTime = Number(t) % 24000;
      this.pushChat(`Set the time to ${Math.round(this.dayTime)}`, '#fde68a');
    } else if (cmd === 'weather') {
      if (arg1 === 'rain') {
        this.weather = 'rain';
        this.pushChat('Changing to rainy weather', '#93c5fd');
      } else {
        this.weather = 'clear';
        this.pushChat('Changing to clear weather', '#fde68a');
      }
    } else if (cmd === 'give') {
      const targetItem = (parts[1] || '') as ItemId;
      const cnt = Math.max(1, Math.min(64, Number(parts[2]) || 1));
      const matched = (ITEMS[targetItem] ? targetItem : `block:${targetItem}`) as ItemId;
      if (ITEMS[matched]) {
        this.giveItem(matched, cnt);
        this.pushChat(`Gave ${cnt} [${ITEMS[matched].name}]`, '#a7f3d0');
      } else {
        this.pushChat(`Unknown item: ${parts[1]}`, '#fca5a5');
      }
    } else if (cmd === 'tp') {
      const tx = Number(parts[1]);
      const ty = Number(parts[2]);
      const tz = Number(parts[3]);
      if (!Number.isNaN(tx) && !Number.isNaN(ty) && !Number.isNaN(tz)) {
        this.playerPos.set(tx, Math.max(2, Math.min(62, ty)), tz);
        this.playerVel.set(0, 0, 0);
        this.pushChat(`Teleported to ${tx}, ${ty}, ${tz}`, '#fde68a');
      } else {
        this.pushChat('Usage: /tp <x> <y> <z>', '#fca5a5');
      }
    } else if (cmd === 'seed') {
      this.pushChat(`Seed: [${this.worldSeed}]`, '#a7f3d0');
    } else if (cmd === 'heal') {
      this.health = 20;
      this.hunger = 20;
      this.saturation = 10;
      this.pushChat('Restored health and hunger.', '#a7f3d0');
    } else if (cmd === 'clear') {
      this.hotbar.fill(null);
      this.inventory.fill(null);
      this.pushChat('Cleared player inventory.', '#fde68a');
    } else if (cmd === 'help') {
      this.pushChat('Commands: /gamemode, /time set, /weather, /give, /tp, /seed, /heal, /clear', '#d1d5db');
    } else {
      this.pushChat(`Unknown command: /${cmd}. Type /help`, '#fca5a5');
    }
    this.syncHud();
  }

  private pushChat(text: string, color = '#ffffff') {
    this.onChatMessage({
      id: `${Date.now()}-${Math.random()}`,
      text,
      color,
      timestamp: Date.now(),
    });
  }

  public requestPointerLock() {
    if (this.phase !== 'playing' || this.activeContainer !== 'none' || this.pointerLockUnsupported) return;
    const el = this.renderer.domElement;
    if (typeof el.requestPointerLock !== 'function') {
      this.pointerLockUnsupported = true;
      return;
    }
    try {
      const maybePromise = el.requestPointerLock() as unknown as Promise<void> | undefined;
      if (maybePromise && typeof maybePromise.catch === 'function') {
        maybePromise.catch(() => {
          this.pointerLockUnsupported = true;
          this.pointerLocked = false;
          this.onPointerLockChange(false);
        });
      }
    } catch {
      this.pointerLockUnsupported = true;
    }
  }

  public exitPointerLock() {
    try {
      if (document.pointerLockElement && typeof document.exitPointerLock === 'function') {
        const res = document.exitPointerLock() as unknown as Promise<void> | undefined;
        if (res && typeof res.catch === 'function') {
          res.catch(() => {});
        }
      }
    } catch {
      // Ignore
    }
  }

  private bindEvents() {
    const onResize = () => {
      if (this.disposed) return;
      const w = this.container.clientWidth || window.innerWidth;
      const h = this.container.clientHeight || window.innerHeight;
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(w, h);
    };
    window.addEventListener('resize', onResize);

    const onPointerLockChange = () => {
      this.pointerLocked = document.pointerLockElement === this.renderer.domElement;
      this.onPointerLockChange(this.pointerLocked);
    };
    document.addEventListener('pointerlockchange', onPointerLockChange);

    const onPointerLockError = () => {
      this.pointerLockUnsupported = true;
      this.pointerLocked = false;
      this.onPointerLockChange(false);
    };
    document.addEventListener('pointerlockerror', onPointerLockError);

    const onMouseMove = (e: MouseEvent) => {
      if (this.phase !== 'playing' || this.activeContainer !== 'none') return;
      const sens = 0.0022 * this.options.mouseSensitivity;
      if (this.pointerLocked) {
        this.yaw -= e.movementX * sens;
        this.pitch = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, this.pitch - e.movementY * sens));
      } else if (this.isDraggingLook) {
        const dx = e.clientX - this.lastPointerX;
        const dy = e.clientY - this.lastPointerY;
        this.lastPointerX = e.clientX;
        this.lastPointerY = e.clientY;
        this.yaw -= dx * sens * 1.4;
        this.pitch = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, this.pitch - dy * sens * 1.4));
      }
    };
    document.addEventListener('mousemove', onMouseMove);

    const onMouseDown = (e: MouseEvent) => {
      if (this.phase !== 'playing' || this.activeContainer !== 'none') return;
      (document.activeElement as HTMLElement | null)?.blur?.();
      if (!this.pointerLocked && !this.pointerLockUnsupported) {
        this.requestPointerLock();
      }
      if (!this.pointerLocked) {
        this.isDraggingLook = true;
        this.lastPointerX = e.clientX;
        this.lastPointerY = e.clientY;
      }
      if (e.button === 0) {
        this.mouseLeftDown = true;
        this.triggerSwing();
        this.tryAttackMobOrStartBreak();
      } else if (e.button === 2) {
        this.mouseRightDown = true;
        this.handleRightClick();
      } else if (e.button === 1 && this.gameMode === 'creative' && this.currentTarget) {
        // Middle click pick-block!
        const picked = BLOCK_ITEM(this.currentTarget.blockId);
        if (ITEMS[picked]) {
          this.hotbar[this.selectedHotbar] = { id: picked, count: 64 };
          this.updateHeldItemAppearance();
          this.syncHud();
        }
      }
    };
    this.renderer.domElement.addEventListener('mousedown', onMouseDown);

    const onMouseUp = (e: MouseEvent) => {
      this.isDraggingLook = false;
      if (e.button === 0) {
        this.mouseLeftDown = false;
        this.resetMining();
      }
      if (e.button === 2) {
        this.mouseRightDown = false;
      }
    };
    window.addEventListener('mouseup', onMouseUp);

    const onContextMenu = (e: MouseEvent) => {
      if (this.phase === 'playing') e.preventDefault();
    };
    this.renderer.domElement.addEventListener('contextmenu', onContextMenu);

    const onWheel = (e: WheelEvent) => {
      if (this.phase !== 'playing' || this.activeContainer !== 'none') return;
      const dir = e.deltaY > 0 ? 1 : -1;
      this.selectHotbarSlot(this.selectedHotbar + dir);
    };
    window.addEventListener('wheel', onWheel, { passive: true });

    const onKeyDown = (e: KeyboardEvent) => {
      if (this.phase !== 'playing') return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;

      this.heldKeys.add(e.code);

      if (
        this.activeContainer === 'none' &&
        (e.code === 'Space' ||
          e.code === 'ArrowUp' ||
          e.code === 'ArrowDown' ||
          e.code === 'ArrowLeft' ||
          e.code === 'ArrowRight')
      ) {
        e.preventDefault();
      }

      if (e.code === 'Space') {
        this.jumpBufferTimer = 0.14;
        if (this.gameMode === 'creative' || this.gameMode === 'spectator') {
          const now = performance.now();
          if (now - this.lastSpaceTap < 280) {
            this.isFlying = !this.isFlying;
            this.playerVel.y = 0;
            this.lastSpaceTap = 0;
            this.syncHud();
          } else {
            this.lastSpaceTap = now;
          }
        }
      }

      if (e.code.startsWith('Digit')) {
        const n = Number(e.code.slice(5));
        if (n >= 1 && n <= 9) this.selectHotbarSlot(n - 1);
      }

      if (e.code === 'KeyE') {
        e.preventDefault();
        if (this.activeContainer !== 'none') {
          this.closeContainer();
        } else {
          this.openContainer(this.gameMode === 'creative' ? 'creative' : 'inventory');
        }
      }

      if (e.code === 'KeyQ' && this.activeContainer === 'none') {
        this.dropSelectedHotbarItem(e.ctrlKey);
      }

      if (e.code === 'F5') {
        e.preventDefault();
        this.cameraMode = ((this.cameraMode + 1) % 3) as 0 | 1 | 2;
        this.syncHud();
      }
    };
    window.addEventListener('keydown', onKeyDown);

    const onKeyUp = (e: KeyboardEvent) => {
      this.heldKeys.delete(e.code);
    };
    window.addEventListener('keyup', onKeyUp);

    const onBlur = () => {
      this.heldKeys.clear();
      this.mouseLeftDown = false;
      this.mouseRightDown = false;
      this.isDraggingLook = false;
      this.touchMoveFwd = 0;
      this.touchMoveStrafe = 0;
      this.touchJump = false;
      this.touchSneak = false;
      this.touchMineHeld = false;
      this.resetMining();
    };
    window.addEventListener('blur', onBlur);

    this.cleanupListeners = () => {
      window.removeEventListener('resize', onResize);
      document.removeEventListener('pointerlockchange', onPointerLockChange);
      document.removeEventListener('pointerlockerror', onPointerLockError);
      document.removeEventListener('mousemove', onMouseMove);
      this.renderer.domElement.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mouseup', onMouseUp);
      this.renderer.domElement.removeEventListener('contextmenu', onContextMenu);
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }

  private cleanupListeners: () => void = () => {};

  public dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);
    this.cleanupListeners();
    this.clearEntities();
    this.world.dispose();
    this.atlasTexture.dispose();
    this.heldItemTexture?.dispose();
    this.crackTextures.forEach((t) => t.dispose());
    this.particleGeo.dispose();
    this.renderer.dispose();
    if (this.renderer.domElement.parentNode === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }

  private clearEntities() {
    for (const m of this.mobs) this.scene.remove(m.group);
    for (const d of this.droppedItems) this.scene.remove(d.mesh);
    for (const a of this.arrows) this.scene.remove(a.mesh);
    for (const t of this.litTnts) this.scene.remove(t.mesh);
    for (const e of this.enderPearls) this.scene.remove(e.mesh);
    for (const p of this.particles) this.scene.remove(p.mesh);
    this.mobs = [];
    this.droppedItems = [];
    this.arrows = [];
    this.litTnts = [];
    this.enderPearls = [];
    this.particles = [];
  }

  private updateHeldItemAppearance() {
    const slot = this.hotbar[this.selectedHotbar];
    if (this.heldItemTexture) {
      this.heldItemTexture.dispose();
      this.heldItemTexture = null;
    }

    if (!slot) {
      this.heldArmGroup.visible = true;
      this.heldBlockMesh.visible = false;
      this.heldSpriteMesh.visible = false;
      return;
    }

    const flatBlockItem =
      slot.id === BLOCK_ITEM(BlockId.Torch) ||
      slot.id === BLOCK_ITEM(BlockId.TallGrass) ||
      slot.id === BLOCK_ITEM(BlockId.Dandelion) ||
      slot.id === BLOCK_ITEM(BlockId.Poppy) ||
      slot.id === BLOCK_ITEM(BlockId.Ladder) ||
      slot.id === BLOCK_ITEM(BlockId.OakSapling) ||
      slot.id === BLOCK_ITEM(BlockId.OakDoorClosed);

    if (slot.id.startsWith('block:') && !flatBlockItem) {
      const bId = Number(slot.id.slice(6)) as BlockId;
      const faces: ('px' | 'nx' | 'py' | 'ny' | 'pz' | 'nz')[] = ['px', 'nx', 'py', 'ny', 'pz', 'nz'];
      const uvAttr = this.heldBlockMesh.geometry.attributes.uv as THREE.BufferAttribute;
      const uStep = 1 / ATLAS_COLS;
      const vStep = 1 / ATLAS_ROWS;

      for (let f = 0; f < 6; f++) {
        const tile = getBlockFaceTile(bId, faces[f]);
        const colIdx = tile % ATLAS_COLS;
        const rowIdx = Math.floor(tile / ATLAS_COLS);
        const u0 = colIdx * uStep + 0.002;
        const u1 = (colIdx + 1) * uStep - 0.002;
        const v1 = 1 - rowIdx * vStep - 0.002;
        const v0 = 1 - (rowIdx + 1) * vStep + 0.002;
        const base = f * 4;
        uvAttr.setXY(base, u0, v1);
        uvAttr.setXY(base + 1, u1, v1);
        uvAttr.setXY(base + 2, u0, v0);
        uvAttr.setXY(base + 3, u1, v0);
      }
      uvAttr.needsUpdate = true;

      this.heldArmGroup.visible = false;
      this.heldBlockMesh.visible = true;
      this.heldSpriteMesh.visible = false;
    } else {
      const tex = flatBlockItem ? null : createItemCanvasTexture(slot.id, this.atlasCanvas);
      const mat = this.heldSpriteMesh.material as THREE.MeshBasicMaterial;
      const uvAttr = this.heldSpriteMesh.geometry.attributes.uv as THREE.BufferAttribute;
      if (tex) {
        this.heldItemTexture = tex;
        mat.map = tex;
        uvAttr.setXY(0, 0, 1);
        uvAttr.setXY(1, 1, 1);
        uvAttr.setXY(2, 0, 0);
        uvAttr.setXY(3, 1, 0);
      } else {
        const bId = Number(slot.id.slice(6)) as BlockId;
        const tile = getBlockFaceTile(bId, 'pz');
        const colIdx = tile % ATLAS_COLS;
        const rowIdx = Math.floor(tile / ATLAS_COLS);
        const uStep = 1 / ATLAS_COLS;
        const vStep = 1 / ATLAS_ROWS;
        const u0 = colIdx * uStep + 0.002;
        const u1 = (colIdx + 1) * uStep - 0.002;
        const v1 = 1 - rowIdx * vStep - 0.002;
        const v0 = 1 - (rowIdx + 1) * vStep + 0.002;
        mat.map = this.atlasTexture;
        uvAttr.setXY(0, u0, v1);
        uvAttr.setXY(1, u1, v1);
        uvAttr.setXY(2, u0, v0);
        uvAttr.setXY(3, u1, v0);
      }
      uvAttr.needsUpdate = true;
      mat.needsUpdate = true;

      this.heldArmGroup.visible = false;
      this.heldBlockMesh.visible = false;
      this.heldSpriteMesh.visible = true;
    }
  }

  private triggerSwing() {
    this.isSwinging = true;
    this.swingProgress = 0;
  }

  private dropSelectedHotbarItem(wholeStack: boolean) {
    const slot = this.hotbar[this.selectedHotbar];
    if (!slot) return;
    const dropCount = wholeStack ? slot.count : 1;
    const droppedStack: ItemStack = { id: slot.id, count: dropCount, durability: slot.durability };
    if (slot.count <= dropCount) {
      this.hotbar[this.selectedHotbar] = null;
    } else {
      slot.count -= dropCount;
    }

    const forward = new THREE.Vector3(0, 0, -1).applyEuler(new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ'));
    this.spawnDroppedItem(
      droppedStack,
      new THREE.Vector3(this.playerPos.x, this.playerPos.y + 1.35, this.playerPos.z),
      forward.multiplyScalar(5.5).add(new THREE.Vector3(0, 2.2, 0)),
      0.75
    );
    this.updateHeldItemAppearance();
    this.syncHud();
  }

  private spawnDroppedItem(stack: ItemStack, pos: THREE.Vector3, vel?: THREE.Vector3, delay = 0.25) {
    const mesh = createDroppedItemMesh(stack);
    mesh.position.copy(pos);
    this.scene.add(mesh);
    this.droppedItems.push({
      id: this.nextEntityId++,
      mesh,
      stack,
      pos: pos.clone(),
      vel: vel ? vel.clone() : new THREE.Vector3((Math.random() - 0.5) * 2.5, 4.2, (Math.random() - 0.5) * 2.5),
      age: 0,
      pickupDelay: delay,
    });
  }

  private spawnParticles(pos: THREE.Vector3, colorHex: number, count = 12, speed = 4) {
    for (let i = 0; i < count; i++) {
      if (this.particles.length > 140) break;
      const mat = new THREE.MeshBasicMaterial({ color: colorHex });
      const mesh = new THREE.Mesh(this.particleGeo, mat);
      mesh.position.set(
        pos.x + (Math.random() - 0.5) * 0.6,
        pos.y + (Math.random() - 0.5) * 0.6,
        pos.z + (Math.random() - 0.5) * 0.6
      );
      this.scene.add(mesh);
      this.particles.push({
        mesh,
        vel: new THREE.Vector3(
          (Math.random() - 0.5) * speed,
          1.5 + Math.random() * speed * 0.9,
          (Math.random() - 0.5) * speed
        ),
        life: 0,
        maxLife: 0.35 + Math.random() * 0.3,
      });
    }
  }

  private getHeldDamage(): number {
    const slot = this.hotbar[this.selectedHotbar];
    if (!slot) return 1;
    let base = ITEMS[slot.id]?.attackDamage ?? 1;
    if (slot.enchantment?.id === 'sharpness') {
      base += slot.enchantment.level * 1.25;
    }
    return base;
  }

  private damageToolInHand() {
    if (this.gameMode === 'creative') return;
    const slot = this.hotbar[this.selectedHotbar];
    if (!slot || slot.durability === undefined) return;
    if (slot.enchantment?.id === 'unbreaking') {
      if (Math.random() > 1 / (slot.enchantment.level + 1)) return;
    }
    slot.durability -= 1;
    if (slot.durability <= 0) {
      this.hotbar[this.selectedHotbar] = null;
      soundEngine.playBlockBreak('wood');
      this.updateHeldItemAppearance();
    }
  }

  private tryAttackMobOrStartBreak() {
    // Raycast against mobs first (within 3.8 blocks)
    const eye = _vec3.set(this.playerPos.x, this.playerPos.y + 1.62, this.playerPos.z);
    _dir.set(0, 0, -1).applyEuler(new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ'));

    let hitMob: MobEntity | null = null;
    let bestDist = 3.8;

    for (const mob of this.mobs) {
      const mobCenter = _vec3b.set(mob.pos.x, mob.pos.y + mob.height * 0.55, mob.pos.z);
      const toMob = mobCenter.sub(eye);
      const proj = toMob.dot(_dir);
      if (proj < 0 || proj > bestDist) continue;
      const perpSq = toMob.lengthSq() - proj * proj;
      const rad = mob.width * 0.72;
      if (perpSq <= rad * rad) {
        bestDist = proj;
        hitMob = mob;
      }
    }

    if (hitMob) {
      const isCrit = !this.onGround && this.playerVel.y < -0.5;
      const dmg = this.getHeldDamage() * (isCrit ? 1.5 : 1);
      this.damageMob(hitMob, dmg, _dir, isCrit);
      this.damageToolInHand();
      return;
    }
  }

  private damageMob(mob: MobEntity, dmg: number, knockDir: THREE.Vector3, isCrit = false) {
    mob.hp -= dmg;
    mob.hurtFlash = 0.28;
    mob.vel.x = knockDir.x * 6.5;
    mob.vel.z = knockDir.z * 6.5;
    mob.vel.y = 4.2;
    if (!mob.hostile) mob.fleeTimer = 3.5;

    soundEngine.playHit(isCrit);
    this.spawnParticles(new THREE.Vector3(mob.pos.x, mob.pos.y + mob.height * 0.6, mob.pos.z), isCrit ? 0xfacc15 : 0xef4444, 8);

    if (mob.hp > 0 && mob.type === 'enderman' && Math.random() < 0.6) {
      this.teleportEndermanRandomly(mob);
    }

    if (mob.hp <= 0) {
      this.scene.remove(mob.group);
      this.mobs = this.mobs.filter((m) => m.id !== mob.id);
      const drops = getMobDrops(mob.type);
      for (const d of drops) {
        if (d.count > 0) {
          this.spawnDroppedItem({ id: d.item, count: d.count }, mob.pos.clone().add(new THREE.Vector3(0, 0.5, 0)));
        }
        if (d.xp > 0) this.grantXp(d.xp);
      }
      if (mob.hostile) {
        this.unlockAdvancement('monster_hunter', 'Monster Hunter', 'Defeat a hostile mob');
      }
      this.score += mob.hostile ? 25 : 10;
    }
  }

  private teleportEndermanRandomly(mob: MobEntity) {
    const tx = Math.floor(mob.pos.x + (Math.random() - 0.5) * 14);
    const tz = Math.floor(mob.pos.z + (Math.random() - 0.5) * 14);
    const ty = this.world.getTopSolidY(tx, tz);
    if (this.world.getBlock(tx, ty - 1, tz) !== BlockId.Water) {
      this.spawnParticles(mob.pos.clone().add(new THREE.Vector3(0, 1.4, 0)), 0xd946ef, 12);
      mob.pos.set(tx + 0.5, ty, tz + 0.5);
      soundEngine.playTeleport();
    }
  }

  private grantXp(amount: number) {
    this.xpProgress += amount / (7 + this.xpLevel * 2);
    soundEngine.playXpOrb();
    while (this.xpProgress >= 1) {
      this.xpProgress -= 1;
      this.xpLevel += 1;
      soundEngine.playLevelUp();
    }
  }

  private handleRightClick() {
    if (this.rightClickCooldown > 0) return;
    this.rightClickCooldown = 0.16;

    const held = this.hotbar[this.selectedHotbar];

    // 1. Interact with targeted block (Crafting Table, Furnace, Chest, Enchanting Table, Bed, Door, TNT)
    if (this.currentTarget && !this.isSneaking) {
      const { x, y, z, blockId } = this.currentTarget;
      const key = `${x},${y},${z}`;
      if (blockId === BlockId.CraftingTable) {
        soundEngine.playClick();
        this.openContainer('crafting_table', { x, y, z });
        return;
      }
      if (blockId === BlockId.EnchantingTable) {
        soundEngine.playClick();
        this.openContainer('enchanting', { x, y, z });
        return;
      }
      if (blockId === BlockId.Bed) {
        this.spawnPoint.set(x + 0.5, y + 0.6, z + 0.5);
        this.unlockAdvancement('sweet_dreams', 'Sweet Dreams', 'Set your respawn point on a bed');
        const isNight = this.dayTime >= 12500 || this.dayTime < 1000;
        if (isNight) {
          this.dayTime = 1000;
          this.dayCount += 1;
          this.weather = 'clear';
          this.pushChat('Respawn point set. Slept through the night!', '#fde68a');
        } else {
          this.pushChat('Respawn point set. You can sleep at night.', '#fde68a');
        }
        soundEngine.playClick();
        this.syncHud();
        return;
      }
      if (blockId === BlockId.OakDoorClosed || blockId === BlockId.OakDoorOpen) {
        const nextDoor = blockId === BlockId.OakDoorClosed ? BlockId.OakDoorOpen : BlockId.OakDoorClosed;
        this.world.setBlock(x, y, z, nextDoor);
        soundEngine.playDoorToggle();
        this.triggerSwing();
        return;
      }
      if (blockId === BlockId.Furnace) {
        if (!this.furnaces.has(key)) {
          this.furnaces.set(key, {
            input: null,
            fuel: null,
            output: null,
            burnTime: 0,
            maxBurnTime: 0,
            cookTime: 0,
            maxCookTime: 10,
          });
        }
        soundEngine.playClick();
        this.openContainer('furnace', { x, y, z });
        return;
      }
      if (blockId === BlockId.Chest) {
        if (!this.chests.has(key)) {
          this.chests.set(key, { slots: new Array(27).fill(null) });
        }
        soundEngine.playClick();
        this.openContainer('chest', { x, y, z });
        return;
      }
      if (blockId === BlockId.Tnt) {
        this.world.setBlock(x, y, z, BlockId.Air);
        this.igniteTnt(x + 0.5, y, z + 0.5);
        if (held?.id === 'flint_and_steel') this.damageToolInHand();
        return;
      }
    }

    if (!held) return;
    const itemDef = ITEMS[held.id];

    // 2. Eat Food
    if (itemDef.foodHunger && this.gameMode === 'survival' && this.hunger < this.maxHunger) {
      this.hunger = Math.min(this.maxHunger, this.hunger + itemDef.foodHunger);
      this.saturation = Math.min(this.hunger, this.saturation + (itemDef.foodSaturation ?? 2));
      soundEngine.playEat();
      this.triggerSwing();
      held.count -= 1;
      if (held.count <= 0) this.hotbar[this.selectedHotbar] = null;
      this.updateHeldItemAppearance();
      this.syncHud();
      return;
    }

    // 2.5 Throw Ender Pearl
    if (held.id === 'ender_pearl') {
      soundEngine.playBowShoot();
      this.triggerSwing();
      const eye = new THREE.Vector3(this.playerPos.x, this.playerPos.y + 1.56, this.playerPos.z);
      const dir = new THREE.Vector3(0, 0, -1).applyEuler(new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ'));
      const mesh = createEnderPearlMesh();
      mesh.position.copy(eye).addScaledVector(dir, 0.5);
      this.scene.add(mesh);
      this.enderPearls.push({
        id: this.nextEntityId++,
        mesh,
        pos: mesh.position.clone(),
        vel: dir.multiplyScalar(22),
        age: 0,
      });
      if (this.gameMode === 'survival') {
        held.count -= 1;
        if (held.count <= 0) this.hotbar[this.selectedHotbar] = null;
        this.updateHeldItemAppearance();
      }
      this.syncHud();
      return;
    }

    // 2.6 Hoe -> Till Dirt / Grass into Farmland
    if (itemDef.toolCategory === 'hoe' && this.currentTarget) {
      const { x, y, z, blockId } = this.currentTarget;
      const above = this.world.getBlock(x, y + 1, z);
      if ((blockId === BlockId.GrassBlock || blockId === BlockId.Dirt) && above === BlockId.Air) {
        this.world.setBlock(x, y, z, BlockId.Farmland);
        soundEngine.playTill();
        this.triggerSwing();
        this.damageToolInHand();
        this.syncHud();
        return;
      }
    }

    // 2.7 Plant Wheat Seeds on Farmland
    if (held.id === 'wheat_seeds' && this.currentTarget) {
      const { x, y, z, blockId } = this.currentTarget;
      if (blockId === BlockId.Farmland && this.world.getBlock(x, y + 1, z) === BlockId.Air) {
        this.world.setBlock(x, y + 1, z, BlockId.WheatCrop0);
        soundEngine.playBlockPlace('leaves');
        this.triggerSwing();
        if (this.gameMode === 'survival') {
          held.count -= 1;
          if (held.count <= 0) this.hotbar[this.selectedHotbar] = null;
          this.updateHeldItemAppearance();
        }
        this.syncHud();
        return;
      }
    }

    // 2.8 Bone Meal -> Instant Crop / Sapling Growth
    if (held.id === 'bone_meal' && this.currentTarget) {
      const { x, y, z, blockId } = this.currentTarget;
      if (blockId >= BlockId.WheatCrop0 && blockId < BlockId.WheatCrop3) {
        const nextStage = Math.min(BlockId.WheatCrop3, blockId + 1 + Math.floor(Math.random() * 2)) as BlockId;
        this.world.setBlock(x, y, z, nextStage);
        this.spawnParticles(new THREE.Vector3(x + 0.5, y + 0.5, z + 0.5), 0x86efac, 10);
        soundEngine.playXpOrb();
        this.triggerSwing();
        if (this.gameMode === 'survival') {
          held.count -= 1;
          if (held.count <= 0) this.hotbar[this.selectedHotbar] = null;
          this.updateHeldItemAppearance();
        }
        this.syncHud();
        return;
      }
      if (blockId === BlockId.OakSapling) {
        this.world.growOakTreeAt(x, y, z);
        this.spawnParticles(new THREE.Vector3(x + 0.5, y + 1, z + 0.5), 0x86efac, 14);
        soundEngine.playLevelUp();
        this.triggerSwing();
        if (this.gameMode === 'survival') {
          held.count -= 1;
          if (held.count <= 0) this.hotbar[this.selectedHotbar] = null;
          this.updateHeldItemAppearance();
        }
        this.syncHud();
        return;
      }
    }

    // 2.9 Flint & Steel sparks
    if (held.id === 'flint_and_steel' && this.currentTarget) {
      const { x, y, z } = this.currentTarget;
      this.spawnParticles(new THREE.Vector3(x + 0.5, y + 1.1, z + 0.5), 0xf97316, 12);
      soundEngine.playClick();
      this.triggerSwing();
      this.damageToolInHand();
      return;
    }

    // 3. Fire Bow
    if (held.id === 'bow') {
      const hasArrow = this.gameMode === 'creative' || this.consumeItem('arrow', 1);
      if (hasArrow) {
        soundEngine.playBowShoot();
        this.triggerSwing();
        const eye = new THREE.Vector3(this.playerPos.x, this.playerPos.y + 1.56, this.playerPos.z);
        const dir = new THREE.Vector3(0, 0, -1).applyEuler(new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ'));
        const mesh = createArrowMesh();
        mesh.position.copy(eye).addScaledVector(dir, 0.5);
        mesh.lookAt(mesh.position.clone().add(dir));
        this.scene.add(mesh);
        this.arrows.push({
          id: this.nextEntityId++,
          mesh,
          pos: mesh.position.clone(),
          vel: dir.multiplyScalar(28),
          fromPlayer: true,
          age: 0,
        });
        this.damageToolInHand();
      }
      return;
    }

    // 4. Water / Lava Bucket
    if ((held.id === 'water_bucket' || held.id === 'lava_bucket') && this.currentTarget) {
      const px = this.currentTarget.x + this.currentTarget.nx;
      const py = this.currentTarget.y + this.currentTarget.ny;
      const pz = this.currentTarget.z + this.currentTarget.nz;
      const fluid = held.id === 'water_bucket' ? BlockId.Water : BlockId.Lava;
      this.world.setBlock(px, py, pz, fluid);
      soundEngine.playBlockPlace('water');
      this.triggerSwing();
      if (this.gameMode === 'survival') {
        this.hotbar[this.selectedHotbar] = { id: 'bucket', count: 1 };
        this.updateHeldItemAppearance();
      }
      this.syncHud();
      return;
    }

    // 5. Place Block
    if (itemDef.blockId !== undefined && this.currentTarget) {
      const px = this.currentTarget.x + this.currentTarget.nx;
      const py = this.currentTarget.y + this.currentTarget.ny;
      const pz = this.currentTarget.z + this.currentTarget.nz;

      if (py <= 0 || py >= CHUNK_HEIGHT) return;
      const targetAtPlace = this.world.getBlock(px, py, pz);
      if (targetAtPlace !== BlockId.Air && !BLOCKS[targetAtPlace].liquid) return;

      // Prevent placing solid block overlapping player's own AABB
      if (BLOCKS[itemDef.blockId].solid) {
        const pMinX = this.playerPos.x - 0.3;
        const pMaxX = this.playerPos.x + 0.3;
        const pMinY = this.playerPos.y;
        const pMaxY = this.playerPos.y + 1.8;
        const pMinZ = this.playerPos.z - 0.3;
        const pMaxZ = this.playerPos.z + 0.3;
        if (
          px + 1 > pMinX && px < pMaxX &&
          py + 1 > pMinY && py < pMaxY &&
          pz + 1 > pMinZ && pz < pMaxZ
        ) {
          return;
        }
      }

      this.world.setBlock(px, py, pz, itemDef.blockId);
      soundEngine.playBlockPlace(BLOCKS[itemDef.blockId].soundGroup);
      this.triggerSwing();

      if (this.gameMode === 'survival') {
        held.count -= 1;
        if (held.count <= 0) {
          this.hotbar[this.selectedHotbar] = null;
          this.updateHeldItemAppearance();
        }
      }
      this.syncHud();
    }
  }

  private consumeItem(id: ItemId, count: number): boolean {
    for (const list of [this.hotbar, this.inventory]) {
      for (let i = 0; i < list.length; i++) {
        const s = list[i];
        if (s && s.id === id && s.count >= count) {
          s.count -= count;
          if (s.count <= 0) list[i] = null;
          return true;
        }
      }
    }
    return false;
  }

  private igniteTnt(x: number, y: number, z: number) {
    soundEngine.playCreeperHiss();
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.98, 0.98, 0.98),
      new THREE.MeshStandardMaterial({ color: 0xe64539, emissive: 0x331111 })
    );
    mesh.position.set(x, y + 0.5, z);
    this.scene.add(mesh);
    this.litTnts.push({
      id: this.nextEntityId++,
      mesh,
      pos: new THREE.Vector3(x, y, z),
      vel: new THREE.Vector3((Math.random() - 0.5) * 2, 4.5, (Math.random() - 0.5) * 2),
      fuse: 2.6,
    });
  }

  private explodeAt(cx: number, cy: number, cz: number, radius = 3.6) {
    soundEngine.playExplosion();
    this.cameraShake = 0.45;
    this.spawnParticles(new THREE.Vector3(cx, cy + 0.5, cz), 0xf97316, 26, 9);
    this.spawnParticles(new THREE.Vector3(cx, cy + 0.5, cz), 0x9ca3af, 20, 7);

    const rInt = Math.ceil(radius);
    for (let dx = -rInt; dx <= rInt; dx++) {
      for (let dy = -rInt; dy <= rInt; dy++) {
        for (let dz = -rInt; dz <= rInt; dz++) {
          const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
          if (dist > radius) continue;
          const bx = Math.floor(cx) + dx;
          const by = Math.floor(cy) + dy;
          const bz = Math.floor(cz) + dz;
          const b = this.world.getBlock(bx, by, bz);
          if (b === BlockId.Air || b === BlockId.Bedrock || b === BlockId.Obsidian) continue;
          if (b === BlockId.Tnt) {
            this.world.setBlock(bx, by, bz, BlockId.Air);
            this.igniteTnt(bx + 0.5, by, bz + 0.5);
          } else {
            this.world.setBlock(bx, by, bz, BlockId.Air);
            if (Math.random() < 0.35 && BLOCKS[b].dropItem) {
              this.spawnDroppedItem(
                { id: BLOCKS[b].dropItem!, count: 1 },
                new THREE.Vector3(bx + 0.5, by + 0.5, bz + 0.5)
              );
            }
          }
        }
      }
    }

    // Damage player & mobs in blast radius
    const pDist = this.playerPos.distanceTo(new THREE.Vector3(cx, cy, cz));
    if (pDist < radius * 1.8 && this.gameMode === 'survival') {
      const dmg = Math.max(1, Math.round((1 - pDist / (radius * 1.8)) * 18));
      this.applyPlayerDamage(dmg);
    }

    for (const mob of [...this.mobs]) {
      const mDist = mob.pos.distanceTo(new THREE.Vector3(cx, cy, cz));
      if (mDist < radius * 1.8) {
        const dir = mob.pos.clone().sub(new THREE.Vector3(cx, cy, cz)).normalize();
        this.damageMob(mob, Math.round((1 - mDist / (radius * 1.8)) * 22), dir);
      }
    }
  }

  private resetMining() {
    this.miningBlockKey = '';
    this.miningElapsed = 0;
    this.crackOverlay.visible = false;
  }

  private updateBlockTargetAndMining(dt: number) {
    if (this.phase !== 'playing' || this.activeContainer !== 'none') {
      this.selectionWireframe.visible = false;
      this.crackOverlay.visible = false;
      return;
    }

    const eye = _vec3.set(this.playerPos.x, this.playerPos.y + 1.62, this.playerPos.z);
    _dir.set(0, 0, -1).applyEuler(new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ'));

    const hit = this.world.raycastVoxel(eye, _dir, 5.2);
    this.currentTarget = hit;

    if (hit) {
      this.selectionWireframe.visible = true;
      this.selectionWireframe.position.set(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5);
    } else {
      this.selectionWireframe.visible = false;
      this.resetMining();
      return;
    }

    if (!this.mouseLeftDown && !this.touchMineHeld) {
      this.resetMining();
      return;
    }

    const key = `${hit.x},${hit.y},${hit.z}`;
    const held = this.hotbar[this.selectedHotbar];

    if (this.gameMode === 'creative') {
      this.breakBlockAt(hit.x, hit.y, hit.z, hit.blockId, false);
      this.mouseLeftDown = false;
      this.touchMineHeld = false;
      this.triggerSwing();
      return;
    }

    if (key !== this.miningBlockKey) {
      this.miningBlockKey = key;
      this.miningElapsed = 0;
      this.miningDuration = getMiningDurationSeconds(hit.blockId, held ?? null);
    }

    if (!Number.isFinite(this.miningDuration)) {
      this.crackOverlay.visible = false;
      return;
    }

    this.miningElapsed += dt;
    this.digSoundTimer -= dt;
    if (this.digSoundTimer <= 0) {
      this.digSoundTimer = 0.24;
      soundEngine.playDigTick(BLOCKS[hit.blockId].soundGroup);
      this.triggerSwing();
    }

    const progress = Math.min(1, this.miningElapsed / this.miningDuration);
    const stage = Math.min(9, Math.floor(progress * 10));
    this.crackOverlay.visible = true;
    this.crackOverlay.position.set(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5);
    const cMat = this.crackOverlay.material as THREE.MeshBasicMaterial;
    if (cMat.map !== this.crackTextures[stage]) {
      cMat.map = this.crackTextures[stage];
      cMat.needsUpdate = true;
    }

    if (progress >= 1) {
      this.breakBlockAt(hit.x, hit.y, hit.z, hit.blockId, true);
      this.damageToolInHand();
      this.resetMining();
    }
  }

  private breakBlockAt(x: number, y: number, z: number, blockId: BlockId, dropLoot: boolean) {
    const def = BLOCKS[blockId];
    this.world.setBlock(x, y, z, BlockId.Air);
    soundEngine.playBlockBreak(def.soundGroup);

    const particleCol =
      blockId === BlockId.GrassBlock || blockId === BlockId.OakLeaves
        ? 0x559e3c
        : blockId === BlockId.Sand
          ? 0xdbd29c
          : blockId === BlockId.OakLog || blockId === BlockId.OakPlanks
            ? 0x8f6e3f
            : 0x7f7f7f;
    this.spawnParticles(new THREE.Vector3(x + 0.5, y + 0.5, z + 0.5), particleCol, 10);

    // Drop chest contents if breaking chest
    const key = `${x},${y},${z}`;
    if (blockId === BlockId.Chest && this.chests.has(key)) {
      const chest = this.chests.get(key)!;
      for (const s of chest.slots) {
        if (s) this.spawnDroppedItem(s, new THREE.Vector3(x + 0.5, y + 0.5, z + 0.5));
      }
      this.chests.delete(key);
    }
    if (blockId === BlockId.Furnace && this.furnaces.has(key)) {
      this.furnaces.delete(key);
    }

    if (!dropLoot) return;

    if (blockId === BlockId.OakLog || blockId === BlockId.BirchLog || blockId === BlockId.SpruceLog) {
      this.unlockAdvancement('mine_wood', 'Getting Wood', 'Punch a tree until a block of wood pops out');
    }
    if (blockId === BlockId.Stone || blockId === BlockId.Cobblestone) {
      this.unlockAdvancement('stone_age', 'Stone Age', 'Mine stone with a pickaxe');
    }

    const heldId = this.hotbar[this.selectedHotbar]?.id ?? null;
    if (blockId === BlockId.OakLeaves || blockId === BlockId.BirchLeaves || blockId === BlockId.SpruceLeaves) {
      const r = Math.random();
      if (r < 0.06) this.spawnDroppedItem({ id: BLOCK_ITEM(BlockId.OakSapling), count: 1 }, new THREE.Vector3(x + 0.5, y + 0.5, z + 0.5));
      else if (r < 0.14) this.spawnDroppedItem({ id: 'apple', count: 1 }, new THREE.Vector3(x + 0.5, y + 0.5, z + 0.5));
      else if (r < 0.24) this.spawnDroppedItem({ id: 'stick', count: 1 }, new THREE.Vector3(x + 0.5, y + 0.5, z + 0.5));
      return;
    }

    if (blockId === BlockId.TallGrass) {
      const r = Math.random();
      if (r < 0.25) this.spawnDroppedItem({ id: 'wheat_seeds', count: 1 }, new THREE.Vector3(x + 0.5, y + 0.5, z + 0.5));
      else if (r < 0.34) this.spawnDroppedItem({ id: 'wheat', count: 1 }, new THREE.Vector3(x + 0.5, y + 0.5, z + 0.5));
      return;
    }

    if (blockId === BlockId.WheatCrop3) {
      this.spawnDroppedItem({ id: 'wheat', count: 1 }, new THREE.Vector3(x + 0.5, y + 0.5, z + 0.5));
      this.spawnDroppedItem({ id: 'wheat_seeds', count: 1 + Math.floor(Math.random() * 2) }, new THREE.Vector3(x + 0.5, y + 0.5, z + 0.5));
      return;
    }

    if (blockId >= BlockId.WheatCrop0 && blockId <= BlockId.WheatCrop2) {
      this.spawnDroppedItem({ id: 'wheat_seeds', count: 1 }, new THREE.Vector3(x + 0.5, y + 0.5, z + 0.5));
      return;
    }

    if (blockId === BlockId.Gravel && Math.random() < 0.18) {
      this.spawnDroppedItem({ id: 'flint', count: 1 }, new THREE.Vector3(x + 0.5, y + 0.5, z + 0.5));
      return;
    }

    if (def.dropItem && canHarvestBlock(blockId, heldId)) {
      this.spawnDroppedItem(
        { id: def.dropItem, count: def.dropCount ?? 1 },
        new THREE.Vector3(x + 0.5, y + 0.5, z + 0.5)
      );
      if (blockId === BlockId.CoalOre || blockId === BlockId.DiamondOre || blockId === BlockId.EmeraldOre) {
        this.grantXp(blockId === BlockId.CoalOre ? 2 : 5);
      }
      this.score += 2;
    }
  }

  private getArmorDefense(): number {
    let total = 0;
    for (const s of this.armorSlots) {
      if (s) {
        total += ITEMS[s.id]?.armorDefense ?? 0;
        if (s.enchantment?.id === 'protection') total += s.enchantment.level;
      }
    }
    return total;
  }

  private applyPlayerDamage(rawAmount: number) {
    if (this.gameMode !== 'survival' || this.phase !== 'playing') return;
    const def = this.getArmorDefense();
    const mitigated = Math.max(1, Math.round(rawAmount * (1 - Math.min(0.8, def * 0.032))));
    this.health = Math.max(0, this.health - mitigated);
    this.damageFlash = 0.45;
    this.cameraShake = 0.3;
    soundEngine.playHurt();

    if (this.health <= 0) {
      this.phase = 'dead';
      this.activeContainer = 'none';
      this.exitPointerLock();
      this.onPhaseChange('dead');
    }
    this.syncHud();
  }

  private updatePlayerPhysics(dt: number) {
    if (this.phase !== 'playing') return;

    const lockedControl = this.activeContainer === 'none';
    if (lockedControl) {
      const lookSpeed = 2.0 * this.options.mouseSensitivity;
      if (this.heldKeys.has('ArrowLeft')) this.yaw += lookSpeed * dt;
      if (this.heldKeys.has('ArrowRight')) this.yaw -= lookSpeed * dt;
      if (this.heldKeys.has('ArrowUp')) this.pitch = Math.min(Math.PI / 2 - 0.01, this.pitch + lookSpeed * dt);
      if (this.heldKeys.has('ArrowDown')) this.pitch = Math.max(-Math.PI / 2 + 0.01, this.pitch - lookSpeed * dt);
    }

    const keyFwd = lockedControl ? (this.heldKeys.has('KeyW') ? 1 : 0) - (this.heldKeys.has('KeyS') ? 1 : 0) : 0;
    const keyStr = lockedControl ? (this.heldKeys.has('KeyD') ? 1 : 0) - (this.heldKeys.has('KeyA') ? 1 : 0) : 0;
    const fwdInput = lockedControl ? THREE.MathUtils.clamp(keyFwd + this.touchMoveFwd, -1, 1) : 0;
    const strInput = lockedControl ? THREE.MathUtils.clamp(keyStr + this.touchMoveStrafe, -1, 1) : 0;

    this.isSneaking = lockedControl && (this.heldKeys.has('ShiftLeft') || this.heldKeys.has('ShiftRight') || this.touchSneak || this.touchSneakToggle);
    const wantsSprint =
      lockedControl &&
      fwdInput > 0.25 &&
      !this.isSneaking &&
      (this.heldKeys.has('ControlLeft') || this.heldKeys.has('KeyR') || this.touchSprintToggle) &&
      (this.gameMode === 'creative' || this.hunger > 6);
    this.isSprinting = wantsSprint;

    // Smooth FOV sprint widening
    const targetFov = this.isSprinting ? this.options.fov + 8 : this.options.fov;
    if (Math.abs(this.camera.fov - targetFov) > 0.05) {
      this.camera.fov = THREE.MathUtils.damp(this.camera.fov, targetFov, 10, dt);
      this.camera.updateProjectionMatrix();
    }

    const forwardX = -Math.sin(this.yaw);
    const forwardZ = -Math.cos(this.yaw);
    const rightX = Math.cos(this.yaw);
    const rightZ = -Math.sin(this.yaw);

    let moveX = forwardX * fwdInput + rightX * strInput;
    let moveZ = forwardZ * fwdInput + rightZ * strInput;
    const len = Math.hypot(moveX, moveZ);
    if (len > 1) {
      moveX /= len;
      moveZ /= len;
    }

    const feetBlock = this.world.getBlock(Math.floor(this.playerPos.x), Math.floor(this.playerPos.y + 0.1), Math.floor(this.playerPos.z));
    const headBlock = this.world.getBlock(Math.floor(this.playerPos.x), Math.floor(this.playerPos.y + 1.55), Math.floor(this.playerPos.z));
    const inWater = feetBlock === BlockId.Water || headBlock === BlockId.Water;
    const inLava = feetBlock === BlockId.Lava || headBlock === BlockId.Lava;
    const onLadder = feetBlock === BlockId.Ladder;

    const baseSpeed = this.isFlying ? 11.5 : this.isSneaking ? 2.1 : this.isSprinting ? 6.2 : 4.4;
    const targetVx = moveX * baseSpeed;
    const targetVz = moveZ * baseSpeed;
    const accel = this.onGround || this.isFlying ? 18 : 6;

    this.playerVel.x = THREE.MathUtils.damp(this.playerVel.x, targetVx, accel, dt);
    this.playerVel.z = THREE.MathUtils.damp(this.playerVel.z, targetVz, accel, dt);

    const wantsJump = lockedControl && (this.heldKeys.has('Space') || this.touchJump);
    if (this.isFlying || this.gameMode === 'spectator') {
      const flyUp = wantsJump ? 1 : 0;
      const flyDown = this.isSneaking ? 1 : 0;
      const targetVy = (flyUp - flyDown) * 9;
      this.playerVel.y = THREE.MathUtils.damp(this.playerVel.y, targetVy, 12, dt);
    } else if (onLadder) {
      this.playerVel.y = wantsJump ? 3.5 : fwdInput > 0 ? 3.2 : -1.5;
    } else if (inWater) {
      this.playerVel.y -= 7 * dt;
      if (wantsJump) {
        this.playerVel.y = Math.min(4.6, this.playerVel.y + 24 * dt);
      }
      this.playerVel.y = Math.max(-4, this.playerVel.y);
      this.fallStartY = this.playerPos.y;
    } else {
      this.playerVel.y -= 28 * dt;
      if (this.onGround) {
        this.coyoteTimer = 0.1;
      } else {
        this.coyoteTimer = Math.max(0, this.coyoteTimer - dt);
      }

      if (this.jumpBufferTimer > 0) {
        this.jumpBufferTimer -= dt;
        if (this.coyoteTimer > 0) {
          this.playerVel.y = 8.9;
          this.onGround = false;
          this.coyoteTimer = 0;
          this.jumpBufferTimer = 0;
          this.exhaustion += this.isSprinting ? 0.2 : 0.05;
        }
      }
    }

    const hw = 0.29;
    const ph = 1.8;
    const isSpectator = this.gameMode === 'spectator';

    // Unstuck recovery if player somehow overlaps a solid block at feet
    if (!isSpectator && collidesBox(this.world, this.playerPos.x, this.playerPos.y, this.playerPos.z, hw, ph)) {
      if (!collidesBox(this.world, this.playerPos.x, Math.floor(this.playerPos.y) + 1, this.playerPos.z, hw, ph)) {
        this.playerPos.y = Math.floor(this.playerPos.y) + 1;
      }
    }

    let wantsAutoStep = false;

    // X collision (with sneak edge-guard)
    const nextX = this.playerPos.x + this.playerVel.x * dt;
    if (isSpectator || !collidesBox(this.world, nextX, this.playerPos.y, this.playerPos.z, hw, ph)) {
      if (
        this.isSneaking &&
        this.onGround &&
        !this.isFlying &&
        !collidesBox(this.world, nextX, this.playerPos.y - 0.55, this.playerPos.z, hw, 0.4)
      ) {
        this.playerVel.x = 0;
      } else {
        this.playerPos.x = nextX;
      }
    } else {
      if (
        this.onGround &&
        !this.isFlying &&
        !this.isSneaking &&
        !collidesBox(this.world, nextX, this.playerPos.y + 1.01, this.playerPos.z, hw, ph)
      ) {
        wantsAutoStep = true;
      }
      this.playerVel.x = 0;
    }

    // Z collision (with sneak edge-guard)
    const nextZ = this.playerPos.z + this.playerVel.z * dt;
    if (isSpectator || !collidesBox(this.world, this.playerPos.x, this.playerPos.y, nextZ, hw, ph)) {
      if (
        this.isSneaking &&
        this.onGround &&
        !this.isFlying &&
        !collidesBox(this.world, this.playerPos.x, this.playerPos.y - 0.55, nextZ, hw, 0.4)
      ) {
        this.playerVel.z = 0;
      } else {
        this.playerPos.z = nextZ;
      }
    } else {
      if (
        this.onGround &&
        !this.isFlying &&
        !this.isSneaking &&
        !collidesBox(this.world, this.playerPos.x, this.playerPos.y + 1.01, nextZ, hw, ph)
      ) {
        wantsAutoStep = true;
      }
      this.playerVel.z = 0;
    }

    // Auto-jump up 1-block ledges when actively pressing touch movement or walking into a 1-block step
    if (wantsAutoStep && (Math.abs(this.touchMoveFwd) > 0.1 || Math.abs(this.touchMoveStrafe) > 0.1)) {
      this.playerVel.y = 8.9;
      this.onGround = false;
      this.coyoteTimer = 0;
    }

    // Y collision
    const nextY = this.playerPos.y + this.playerVel.y * dt;
    if (isSpectator || !collidesBox(this.world, this.playerPos.x, nextY, this.playerPos.z, hw, ph)) {
      this.playerPos.y = nextY;
      this.onGround = false;
      if (this.playerVel.y < 0 && !this.wasFalling) {
        this.wasFalling = true;
        this.fallStartY = this.playerPos.y;
      }
    } else {
      if (this.playerVel.y < 0) {
        this.playerPos.y = Math.floor(nextY + 0.001) + 1;
        this.onGround = true;
        if (this.wasFalling && !this.isFlying && !inWater) {
          const fallDist = this.fallStartY - this.playerPos.y;
          if (fallDist > 3.5) {
            this.applyPlayerDamage(Math.floor(fallDist - 3));
          }
        }
        this.wasFalling = false;
      }
      this.playerVel.y = 0;
    }

    // Footsteps & headbob
    const horizSpeed = Math.hypot(this.playerVel.x, this.playerVel.z);
    if (this.onGround && horizSpeed > 0.6 && !this.isFlying) {
      this.walkBobPhase += dt * horizSpeed * 2.2;
      this.stepAccum += horizSpeed * dt;
      if (this.stepAccum > 1.9) {
        this.stepAccum = 0;
        const groundB = this.world.getBlock(Math.floor(this.playerPos.x), Math.floor(this.playerPos.y - 0.2), Math.floor(this.playerPos.z));
        if (groundB !== BlockId.Air) {
          soundEngine.playFootstep(BLOCKS[groundB].soundGroup);
        }
      }
    }

    // Survival vitals: underwater air, lava, hunger & natural healing
    if (this.gameMode === 'survival') {
      if (headBlock === BlockId.Water) {
        this.air = Math.max(0, this.air - dt * 1.3);
        if (this.air <= 0) {
          this.lavaTickTimer += dt;
          if (this.lavaTickTimer >= 1.0) {
            this.lavaTickTimer = 0;
            this.applyPlayerDamage(2);
          }
        }
      } else {
        this.air = Math.min(this.maxAir, this.air + dt * 5);
      }

      if (inLava) {
        this.lavaTickTimer += dt;
        if (this.lavaTickTimer >= 0.5) {
          this.lavaTickTimer = 0;
          this.applyPlayerDamage(4);
        }
      }

      // Cactus prick
      if (feetBlock === BlockId.Cactus) {
        this.lavaTickTimer += dt;
        if (this.lavaTickTimer >= 0.5) {
          this.lavaTickTimer = 0;
          this.applyPlayerDamage(1);
        }
      }

      this.exhaustion += (this.isSprinting ? 0.1 : 0.015) * horizSpeed * dt;
      if (this.exhaustion >= 4) {
        this.exhaustion -= 4;
        if (this.saturation > 0) this.saturation = Math.max(0, this.saturation - 1);
        else this.hunger = Math.max(0, this.hunger - 1);
      }

      if (this.hunger >= 18 && this.health < this.maxHealth) {
        this.regenTimer += dt;
        if (this.regenTimer >= 2.2) {
          this.regenTimer = 0;
          this.health = Math.min(this.maxHealth, this.health + 1);
          this.exhaustion += 1.5;
        }
      } else if (this.hunger === 0 && this.health > 1) {
        this.regenTimer += dt;
        if (this.regenTimer >= 3.5) {
          this.regenTimer = 0;
          this.applyPlayerDamage(1);
        }
      }
    }
  }

  private spawnInitialMobs() {
    const passive: MobType[] = ['sheep', 'cow', 'pig'];
    for (let i = 0; i < 10; i++) {
      const mx = Math.round((Math.random() - 0.5) * 44);
      const mz = Math.round((Math.random() - 0.5) * 44);
      const my = this.world.getTopSolidY(mx, mz);
      const ground = this.world.getBlock(mx, my - 1, mz);
      if (ground === BlockId.GrassBlock || ground === BlockId.SnowBlock) {
        const type = passive[i % passive.length];
        const mob = createMobEntity(this.nextEntityId++, type, new THREE.Vector3(mx + 0.5, my, mz + 0.5));
        this.scene.add(mob.group);
        this.mobs.push(mob);
      }
    }
  }

  private updateMobs(dt: number) {
    const isNight = this.dayTime > 13000 && this.dayTime < 23000;

    // Periodic spawning around player
    this.mobSpawnTimer -= dt;
    if (this.mobSpawnTimer <= 0 && this.mobs.length < 18) {
      this.mobSpawnTimer = 5;
      const angle = Math.random() * Math.PI * 2;
      const dist = 16 + Math.random() * 14;
      const sx = Math.floor(this.playerPos.x + Math.cos(angle) * dist);
      const sz = Math.floor(this.playerPos.z + Math.sin(angle) * dist);
      const sy = this.world.getTopSolidY(sx, sz);
      const ground = this.world.getBlock(sx, sy - 1, sz);
      if (ground !== BlockId.Water && ground !== BlockId.Lava && ground !== BlockId.Air) {
        const spawnHostile = isNight && this.gameMode === 'survival' && Math.random() < 0.72;
        const pool: MobType[] = spawnHostile
          ? ['zombie', 'skeleton', 'creeper', 'spider', 'enderman']
          : ['sheep', 'cow', 'pig'];
        const type = pool[Math.floor(Math.random() * pool.length)];
        const mob = createMobEntity(this.nextEntityId++, type, new THREE.Vector3(sx + 0.5, sy, sz + 0.5));
        this.scene.add(mob.group);
        this.mobs.push(mob);
      }
    }

    for (const mob of [...this.mobs]) {
      const dist = mob.pos.distanceTo(this.playerPos);
      if (dist > 64) {
        this.scene.remove(mob.group);
        this.mobs = this.mobs.filter((m) => m.id !== mob.id);
        continue;
      }

      mob.attackCooldown = Math.max(0, mob.attackCooldown - dt);
      if (mob.hurtFlash > 0) {
        mob.hurtFlash -= dt;
        mob.bodyMaterials.forEach((m) => m.emissive.setHex(mob.hurtFlash > 0 ? 0xaa1111 : 0x000000));
      }

      // Daylight burn for Zombies & Skeletons
      if (!isNight && (mob.type === 'zombie' || mob.type === 'skeleton') && this.weather === 'clear') {
        const topY = this.world.getTopSolidY(Math.floor(mob.pos.x), Math.floor(mob.pos.z));
        if (mob.pos.y + 1.5 >= topY - 1) {
          mob.hurtFlash = 0.15;
          mob.hp -= dt * 2.5;
          if (mob.hp <= 0) {
            this.damageMob(mob, 99, _vec3.set(0, 1, 0));
            continue;
          }
        }
      }

      // Endermen hate water & rain
      if (mob.type === 'enderman') {
        const inMobWater = this.world.getBlock(Math.floor(mob.pos.x), Math.floor(mob.pos.y + 0.2), Math.floor(mob.pos.z)) === BlockId.Water;
        if (inMobWater) {
          mob.hp -= 2;
          this.teleportEndermanRandomly(mob);
          if (mob.hp <= 0) {
            this.damageMob(mob, 99, _vec3.set(0, 1, 0));
            continue;
          }
        }
      }

      // AI steering
      const toPlayerX = this.playerPos.x - mob.pos.x;
      const toPlayerZ = this.playerPos.z - mob.pos.z;
      const horizDist = Math.hypot(toPlayerX, toPlayerZ);

      if (mob.hostile && this.gameMode === 'survival' && this.phase === 'playing' && horizDist < 18) {
        mob.yaw = Math.atan2(toPlayerX, toPlayerZ);

        if (mob.type === 'creeper') {
          if (horizDist < 2.8) {
            if (mob.fuseTimer < 0) {
              mob.fuseTimer = 1.45;
              soundEngine.playCreeperHiss();
            }
            mob.vel.x = 0;
            mob.vel.z = 0;
            mob.isMoving = false;
            mob.fuseTimer -= dt;
            const pulse = Math.sin(mob.fuseTimer * 28) > 0;
            mob.bodyMaterials.forEach((m) => m.emissive.setHex(pulse ? 0xffffff : 0x000000));
            const s = 1 + (1.45 - Math.max(0, mob.fuseTimer)) * 0.14;
            mob.group.scale.set(s, s, s);
            if (mob.fuseTimer <= 0) {
              this.scene.remove(mob.group);
              this.mobs = this.mobs.filter((m) => m.id !== mob.id);
              this.explodeAt(mob.pos.x, mob.pos.y + 0.5, mob.pos.z, 3.3);
              continue;
            }
          } else {
            if (mob.fuseTimer >= 0) {
              mob.fuseTimer = -1;
              mob.group.scale.set(1, 1, 1);
              mob.bodyMaterials.forEach((m) => m.emissive.setHex(0x000000));
            }
            mob.vel.x = Math.sin(mob.yaw) * 2.7;
            mob.vel.z = Math.cos(mob.yaw) * 2.7;
            mob.isMoving = true;
          }
        } else if (mob.type === 'skeleton') {
          if (horizDist > 8) {
            mob.vel.x = Math.sin(mob.yaw) * 2.6;
            mob.vel.z = Math.cos(mob.yaw) * 2.6;
            mob.isMoving = true;
          } else {
            mob.vel.x *= 0.8;
            mob.vel.z *= 0.8;
            mob.isMoving = false;
            if (mob.attackCooldown <= 0) {
              mob.attackCooldown = 2.1;
              soundEngine.playBowShoot();
              const origin = new THREE.Vector3(mob.pos.x, mob.pos.y + 1.4, mob.pos.z);
              const aim = new THREE.Vector3(this.playerPos.x, this.playerPos.y + 1.2, this.playerPos.z)
                .sub(origin)
                .normalize();
              const mesh = createArrowMesh();
              mesh.position.copy(origin);
              mesh.lookAt(origin.clone().add(aim));
              this.scene.add(mesh);
              this.arrows.push({
                id: this.nextEntityId++,
                mesh,
                pos: origin,
                vel: aim.multiplyScalar(20),
                fromPlayer: false,
                age: 0,
              });
            }
          }
        } else if (mob.type === 'spider') {
          mob.vel.x = Math.sin(mob.yaw) * 3.45;
          mob.vel.z = Math.cos(mob.yaw) * 3.45;
          mob.isMoving = true;
          if (horizDist < 4.5 && mob.onGround && Math.random() < 0.04) {
            mob.vel.y = 5.6;
          }
          if (horizDist < 1.65 && Math.abs(this.playerPos.y - mob.pos.y) < 1.6 && mob.attackCooldown <= 0) {
            mob.attackCooldown = 0.95;
            this.applyPlayerDamage(2);
          }
        } else if (mob.type === 'enderman') {
          if (horizDist < 11) {
            mob.vel.x = Math.sin(mob.yaw) * 3.6;
            mob.vel.z = Math.cos(mob.yaw) * 3.6;
            mob.isMoving = true;
            if (horizDist < 1.85 && Math.abs(this.playerPos.y - mob.pos.y) < 2.2 && mob.attackCooldown <= 0) {
              mob.attackCooldown = 1.2;
              this.applyPlayerDamage(5);
            }
          } else {
            mob.vel.x *= 0.85;
            mob.vel.z *= 0.85;
            mob.isMoving = false;
          }
        } else {
          // Zombie melee
          mob.vel.x = Math.sin(mob.yaw) * 2.65;
          mob.vel.z = Math.cos(mob.yaw) * 2.65;
          mob.isMoving = true;
          if (horizDist < 1.65 && Math.abs(this.playerPos.y - mob.pos.y) < 1.8 && mob.attackCooldown <= 0) {
            mob.attackCooldown = 1.1;
            this.applyPlayerDamage(3);
          }
        }
      } else {
        // Passive wander or flee
        mob.aiTimer -= dt;
        if (mob.fleeTimer > 0) {
          mob.fleeTimer -= dt;
          mob.yaw = Math.atan2(-toPlayerX, -toPlayerZ);
          mob.vel.x = Math.sin(mob.yaw) * 3.4;
          mob.vel.z = Math.cos(mob.yaw) * 3.4;
          mob.isMoving = true;
        } else if (mob.aiTimer <= 0) {
          mob.aiTimer = 2 + Math.random() * 4;
          mob.isMoving = Math.random() < 0.55;
          mob.wanderYaw = Math.random() * Math.PI * 2;
        } else if (mob.isMoving) {
          mob.yaw = mob.wanderYaw;
          mob.vel.x = Math.sin(mob.yaw) * 1.45;
          mob.vel.z = Math.cos(mob.yaw) * 1.45;
        } else {
          mob.vel.x *= 0.8;
          mob.vel.z *= 0.8;
        }
      }

      moveMobWithCollision(mob, this.world, dt);
      updateMobAmbientSounds(mob, dist, dt);

      mob.group.position.copy(mob.pos);
      mob.group.rotation.y = mob.yaw;

      if (mob.isMoving) {
        mob.walkPhase += dt * 7;
        const swing = Math.sin(mob.walkPhase) * 0.55;
        mob.legs.forEach((leg, i) => {
          leg.rotation.x = i % 2 === 0 ? swing : -swing;
        });
      } else {
        mob.legs.forEach((leg) => {
          leg.rotation.x = THREE.MathUtils.damp(leg.rotation.x, 0, 8, dt);
        });
      }
    }
  }

  private updateEntitiesAndFx(dt: number) {
    // Dropped items
    for (const d of [...this.droppedItems]) {
      d.age += dt;
      d.pickupDelay = Math.max(0, d.pickupDelay - dt);
      d.vel.y -= 18 * dt;
      const ny = d.pos.y + d.vel.y * dt;
      const bBelow = this.world.getBlock(Math.floor(d.pos.x), Math.floor(ny), Math.floor(d.pos.z));
      if (BLOCKS[bBelow].solid) {
        d.vel.y = 0;
        d.vel.x *= 0.8;
        d.vel.z *= 0.8;
        d.pos.y = Math.floor(ny) + 1.02;
      } else {
        d.pos.x += d.vel.x * dt;
        d.pos.y = ny;
        d.pos.z += d.vel.z * dt;
      }

      // Magnetic pickup toward player
      const dist = d.pos.distanceTo(this.playerPos);
      if (this.phase === 'playing' && d.pickupDelay <= 0 && dist < 2.2) {
        d.pos.lerp(new THREE.Vector3(this.playerPos.x, this.playerPos.y + 0.8, this.playerPos.z), Math.min(1, dt * 10));
        if (dist < 1.15 && this.giveItem(d.stack.id, d.stack.count)) {
          soundEngine.playXpOrb();
          this.scene.remove(d.mesh);
          this.droppedItems = this.droppedItems.filter((x) => x.id !== d.id);
          continue;
        }
      }

      d.mesh.position.set(d.pos.x, d.pos.y + Math.sin(d.age * 3.5) * 0.08, d.pos.z);
      d.mesh.rotation.y = d.age * 2.1;

      if (d.age > 180) {
        this.scene.remove(d.mesh);
        this.droppedItems = this.droppedItems.filter((x) => x.id !== d.id);
      }
    }

    // Arrows
    for (const a of [...this.arrows]) {
      a.age += dt;
      a.vel.y -= 14 * dt;
      a.pos.addScaledVector(a.vel, dt);
      a.mesh.position.copy(a.pos);
      a.mesh.lookAt(a.pos.clone().add(a.vel));

      let remove = a.age > 8;
      const b = this.world.getBlock(Math.floor(a.pos.x), Math.floor(a.pos.y), Math.floor(a.pos.z));
      if (BLOCKS[b].solid) remove = true;

      if (!remove && a.fromPlayer) {
        for (const mob of this.mobs) {
          if (
            Math.abs(a.pos.x - mob.pos.x) < mob.width * 0.6 &&
            Math.abs(a.pos.z - mob.pos.z) < mob.width * 0.6 &&
            a.pos.y >= mob.pos.y &&
            a.pos.y <= mob.pos.y + mob.height
          ) {
            this.damageMob(mob, 7, a.vel.clone().normalize());
            remove = true;
            break;
          }
        }
      } else if (!remove && !a.fromPlayer && this.gameMode === 'survival') {
        if (
          Math.abs(a.pos.x - this.playerPos.x) < 0.45 &&
          Math.abs(a.pos.z - this.playerPos.z) < 0.45 &&
          a.pos.y >= this.playerPos.y &&
          a.pos.y <= this.playerPos.y + 1.8
        ) {
          this.applyPlayerDamage(3);
          remove = true;
        }
      }

      if (remove) {
        this.scene.remove(a.mesh);
        this.arrows = this.arrows.filter((x) => x.id !== a.id);
      }
    }

    // Lit TNT
    for (const t of [...this.litTnts]) {
      t.fuse -= dt;
      t.vel.y -= 24 * dt;
      const ny = t.pos.y + t.vel.y * dt;
      const hitB = this.world.getBlock(Math.floor(t.pos.x), Math.floor(ny), Math.floor(t.pos.z));
      if (BLOCKS[hitB].solid) {
        t.vel.y = 0;
        t.vel.x *= 0.7;
        t.vel.z *= 0.7;
        t.pos.y = Math.floor(ny) + 1;
      } else {
        t.pos.x += t.vel.x * dt;
        t.pos.y = ny;
        t.pos.z += t.vel.z * dt;
      }
      t.mesh.position.set(t.pos.x, t.pos.y + 0.5, t.pos.z);
      const flash = Math.sin(t.fuse * 20) > 0;
      (t.mesh.material as THREE.MeshStandardMaterial).emissive.setHex(flash ? 0xffffff : 0x220505);

      if (t.fuse <= 0) {
        this.scene.remove(t.mesh);
        this.litTnts = this.litTnts.filter((x) => x.id !== t.id);
        this.explodeAt(t.pos.x, t.pos.y, t.pos.z, 4.0);
      }
    }

    // Thrown Ender Pearls
    for (const p of [...this.enderPearls]) {
      p.age += dt;
      p.vel.y -= 18 * dt;
      p.pos.addScaledVector(p.vel, dt);
      p.mesh.position.copy(p.pos);

      const bx = Math.floor(p.pos.x);
      const by = Math.floor(p.pos.y);
      const bz = Math.floor(p.pos.z);
      const hitBlock = this.world.getBlock(bx, by, bz);

      if (BLOCKS[hitBlock].solid || p.age > 5) {
        const landY = BLOCKS[hitBlock].solid ? by + 1.05 : p.pos.y;
        this.playerPos.set(p.pos.x, Math.max(2, landY), p.pos.z);
        this.playerVel.set(0, 0, 0);
        this.fallStartY = this.playerPos.y;
        soundEngine.playTeleport();
        this.spawnParticles(this.playerPos.clone().add(new THREE.Vector3(0, 1, 0)), 0xa855f7, 16);
        if (this.gameMode === 'survival') {
          this.applyPlayerDamage(5);
        }
        this.scene.remove(p.mesh);
        this.enderPearls = this.enderPearls.filter((x) => x.id !== p.id);
      }
    }

    // Particles
    for (const p of [...this.particles]) {
      p.life += dt;
      p.vel.y -= 18 * dt;
      p.mesh.position.addScaledVector(p.vel, dt);
      const s = Math.max(0.01, 1 - p.life / p.maxLife);
      p.mesh.scale.setScalar(s);
      if (p.life >= p.maxLife) {
        this.scene.remove(p.mesh);
        (p.mesh.material as THREE.Material).dispose();
        this.particles = this.particles.filter((x) => x !== p);
      }
    }
  }

  private updateCropAndSaplingTicks(dt: number) {
    this.cropTickTimer += dt;
    if (this.cropTickTimer < 3.5) return;
    this.cropTickTimer = 0;

    for (let i = 0; i < 36; i++) {
      const rx = Math.floor(this.playerPos.x + (Math.random() - 0.5) * 28);
      const ry = Math.floor(this.playerPos.y + (Math.random() - 0.5) * 10);
      const rz = Math.floor(this.playerPos.z + (Math.random() - 0.5) * 28);
      const b = this.world.getBlock(rx, ry, rz);
      if (b >= BlockId.WheatCrop0 && b < BlockId.WheatCrop3) {
        this.world.setBlock(rx, ry, rz, (b + 1) as BlockId);
      } else if (b === BlockId.OakSapling && Math.random() < 0.3) {
        this.world.growOakTreeAt(rx, ry, rz);
      }
    }
  }

  private updateFurnaces(dt: number) {
    for (const f of this.furnaces.values()) {
      const recipe = f.input ? findSmeltOutput(f.input.id) : null;
      const canOutput =
        recipe &&
        (!f.output || (f.output.id === recipe.output && f.output.count < (ITEMS[recipe.output]?.stackSize ?? 64)));

      if (f.burnTime > 0) {
        f.burnTime = Math.max(0, f.burnTime - dt * 20);
      }

      if (recipe && canOutput) {
        if (f.burnTime <= 0 && f.fuel && f.fuel.count > 0) {
          const fuelTicks = ITEMS[f.fuel.id]?.fuelTicks;
          if (fuelTicks) {
            f.maxBurnTime = fuelTicks;
            f.burnTime = fuelTicks;
            f.fuel.count -= 1;
            if (f.fuel.count <= 0) f.fuel = null;
          }
        }

        if (f.burnTime > 0) {
          f.cookTime += dt;
          if (f.cookTime >= f.maxCookTime) {
            f.cookTime = 0;
            f.input!.count -= 1;
            if (f.input!.count <= 0) f.input = null;
            if (!f.output) f.output = { id: recipe.output, count: 1 };
            else f.output.count += 1;
            this.grantXp(Math.max(1, Math.round(recipe.xp * 2)));
          }
        } else {
          f.cookTime = Math.max(0, f.cookTime - dt * 2);
        }
      } else {
        f.cookTime = 0;
      }
    }
  }

  private updateSkyAndWeather(dt: number) {
    // 24000 ticks in ~12 minutes real-time (33 ticks/sec)
    this.dayTime += dt * 33;
    if (this.dayTime >= 24000) {
      this.dayTime -= 24000;
      this.dayCount += 1;
    }

    const angle = ((this.dayTime - 6000) / 24000) * Math.PI * 2;
    const sunY = Math.cos(angle);
    const sunX = Math.sin(angle);

    const anchor = this.camera.position;
    this.sunMesh.position.set(anchor.x + sunX * 120, anchor.y + sunY * 120, anchor.z - 25);
    this.sunMesh.lookAt(anchor);
    this.moonMesh.position.set(anchor.x - sunX * 120, anchor.y - sunY * 120, anchor.z + 25);
    this.moonMesh.lookAt(anchor);

    this.sunLight.position.set(this.playerPos.x + sunX * 45, this.playerPos.y + Math.max(8, sunY * 55), this.playerPos.z - 12);
    this.sunLight.target.position.copy(this.playerPos);

    const daylight = THREE.MathUtils.clamp((sunY + 0.25) * 1.4, 0, 1);
    const sunsetBand = THREE.MathUtils.clamp(1 - Math.abs(sunY) * 4.5, 0, 1);

    _skyColor.copy(_nightSky).lerp(_noonSky, daylight);
    if (sunsetBand > 0.05) _skyColor.lerp(_sunsetSky, sunsetBand * 0.55);
    if (this.weather === 'rain') _skyColor.lerp(_rainSky, 0.55);

    (this.scene.background as THREE.Color).copy(_skyColor);
    if (this.scene.fog instanceof THREE.Fog) {
      _fogColor.copy(_skyColor);
      this.scene.fog.color.copy(_fogColor);
    }

    const rainDim = this.weather === 'rain' ? 0.65 : 1.0;
    this.sunLight.intensity = (0.16 + daylight * 1.25) * rainDim;
    this.hemiLight.intensity = (0.24 + daylight * 0.68) * rainDim;
    (this.starPoints.material as THREE.PointsMaterial).opacity = Math.max(0, 1 - daylight * 1.6);
    this.starPoints.position.copy(anchor);

    // Dynamic cloud tint matching Java Edition sky phases
    this.cloudMat.color.setHex(0x232b3d).lerp(new THREE.Color(0xffffff), daylight);
    if (sunsetBand > 0.05) this.cloudMat.color.lerp(new THREE.Color(0xffb088), sunsetBand * 0.6);

    // Dynamic handheld light when holding Torch, Glowstone, or Lava Bucket
    const heldId = this.hotbar[this.selectedHotbar]?.id;
    const emitsHeldLight =
      heldId === BLOCK_ITEM(BlockId.Torch) ||
      heldId === BLOCK_ITEM(BlockId.Glowstone) ||
      heldId === 'lava_bucket';
    this.heldTorchLight.position.set(this.playerPos.x, this.playerPos.y + 1.5, this.playerPos.z);
    this.heldTorchLight.intensity = emitsHeldLight && this.phase === 'playing' ? 2.4 : 0;

    // Drift clouds gently
    this.cloudGroup.children.forEach((c) => {
      c.position.x += dt * 1.1;
      if (c.position.x - this.playerPos.x > 90) c.position.x -= 180;
    });

    // Rain particles
    this.rainPoints.visible = this.weather === 'rain';
    if (this.rainPoints.visible) {
      this.rainPoints.position.set(this.playerPos.x, this.playerPos.y - 4, this.playerPos.z);
      const posAttr = this.rainPoints.geometry.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < posAttr.count; i++) {
        let ry = posAttr.getY(i) - dt * 22;
        if (ry < 0) ry += 20;
        posAttr.setY(i, ry);
      }
      posAttr.needsUpdate = true;
    }
  }

  private updateCameraAndViewModel(dt: number) {
    if (this.phase === 'title') {
      // Live scenic orbital pan over the generated Minecraft world
      this.titleAngle += dt * 0.12;
      const rad = 22;
      const cx = Math.cos(this.titleAngle) * rad;
      const cz = Math.sin(this.titleAngle) * rad;
      const groundY = this.world.getTopSolidY(Math.floor(cx), Math.floor(cz));
      this.camera.position.set(cx, Math.max(groundY + 9, 36), cz);
      this.camera.lookAt(0, 26, 0);
      this.viewModelGroup.visible = false;
      this.playerModel.group.visible = false;
      return;
    }

    const eyeHeight = this.isSneaking ? 1.38 : 1.62;
    const bob =
      this.onGround && !this.isFlying && Math.hypot(this.playerVel.x, this.playerVel.z) > 0.5
        ? Math.sin(this.walkBobPhase) * 0.045
        : 0;

    if (this.cameraShake > 0) {
      this.cameraShake = Math.max(0, this.cameraShake - dt * 1.4);
    }
    const shakeX = (Math.random() - 0.5) * this.cameraShake * 0.35;
    const shakeY = (Math.random() - 0.5) * this.cameraShake * 0.35;

    const headPos = _vec3.set(this.playerPos.x + shakeX, this.playerPos.y + eyeHeight + bob + shakeY, this.playerPos.z);

    if (this.cameraMode === 0) {
      this.camera.position.copy(headPos);
      this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
      this.viewModelGroup.visible = true;
      this.playerModel.group.visible = false;
    } else {
      const dist = 3.8;
      const dirSign = this.cameraMode === 1 ? 1 : -1;
      const offset = new THREE.Vector3(0, 0, dist * dirSign).applyEuler(new THREE.Euler(this.pitch * dirSign, this.yaw, 0, 'YXZ'));
      this.camera.position.copy(headPos).add(offset);
      this.camera.lookAt(headPos);
      this.viewModelGroup.visible = false;
      this.playerModel.group.visible = true;
      this.playerModel.group.position.copy(this.playerPos);
      this.playerModel.group.rotation.y = this.yaw + Math.PI;
      this.playerModel.head.rotation.x = this.pitch;
      const legSwing = Math.sin(this.walkBobPhase) * 0.5;
      this.playerModel.legs[0].rotation.x = legSwing;
      this.playerModel.legs[1].rotation.x = -legSwing;
    }

    // Viewmodel swing animation
    if (this.isSwinging) {
      this.swingProgress += dt * 7.5;
      if (this.swingProgress >= 1) {
        this.isSwinging = false;
        this.swingProgress = 0;
      }
    }
    const swingAngle = Math.sin(this.swingProgress * Math.PI);
    this.viewModelGroup.position.set(
      Math.cos(this.walkBobPhase * 0.5) * 0.015 - swingAngle * 0.14,
      Math.abs(Math.sin(this.walkBobPhase)) * 0.015 - swingAngle * 0.12,
      -swingAngle * 0.14
    );
    this.viewModelGroup.rotation.set(-swingAngle * 0.85, swingAngle * 0.35, 0);
  }

  private streamChunksAroundPlayer() {
    const pcx = Math.floor(this.playerPos.x / CHUNK_SIZE);
    const pcz = Math.floor(this.playerPos.z / CHUNK_SIZE);
    const r = this.options.renderDistance;

    for (let dx = -r; dx <= r; dx++) {
      for (let dz = -r; dz <= r; dz++) {
        this.world.ensureChunk(pcx + dx, pcz + dz);
      }
    }
    this.populatePendingStructureChests();
    this.world.updateDirtyChunks(this.isSoftwareGl ? 2 : 3);
    this.world.pruneFarChunks(pcx, pcz, r);
  }

  private getFacingLabel(): string {
    const norm = ((this.yaw % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    if (norm < Math.PI * 0.25 || norm >= Math.PI * 1.75) return 'North (-Z)';
    if (norm < Math.PI * 0.75) return 'West (-X)';
    if (norm < Math.PI * 1.25) return 'South (+Z)';
    return 'East (+X)';
  }

  public syncHud() {
    const headB = this.world.getBlock(Math.floor(this.playerPos.x), Math.floor(this.playerPos.y + 1.55), Math.floor(this.playerPos.z));
    const feetB = this.world.getBlock(Math.floor(this.playerPos.x), Math.floor(this.playerPos.y + 0.2), Math.floor(this.playerPos.z));
    const activeKey = this.activeBlockPos ? `${this.activeBlockPos.x},${this.activeBlockPos.y},${this.activeBlockPos.z}` : '';

    this.onHudUpdate({
      health: this.health,
      maxHealth: this.maxHealth,
      hunger: this.hunger,
      maxHunger: this.maxHunger,
      saturation: this.saturation,
      armor: this.getArmorDefense(),
      air: this.air,
      maxAir: this.maxAir,
      xpLevel: this.xpLevel,
      xpProgress: this.xpProgress,
      score: this.score,
      gameMode: this.gameMode,
      selectedHotbar: this.selectedHotbar,
      hotbar: this.hotbar.map((s) => (s ? { ...s } : null)),
      inventory: this.inventory.map((s) => (s ? { ...s } : null)),
      armorSlots: this.armorSlots.map((s) => (s ? { ...s } : null)),
      activeContainer: this.activeContainer,
      activeBlockPos: this.activeBlockPos,
      furnaceState: this.activeContainer === 'furnace' && activeKey ? { ...(this.furnaces.get(activeKey)!) } : null,
      chestState: this.activeContainer === 'chest' && activeKey ? { slots: [...(this.chests.get(activeKey)?.slots ?? [])] } : null,
      cameraMode: this.cameraMode,
      isFlying: this.isFlying,
      isSprinting: this.isSprinting || this.touchSprintToggle,
      isSneaking: this.isSneaking || this.touchSneakToggle,
      isUnderwater: headB === BlockId.Water,
      isInLava: feetB === BlockId.Lava || headB === BlockId.Lava,
      damageFlash: this.damageFlash,
      advancements: Array.from(this.unlockedAdvancements),
      targetBlock: this.currentTarget
        ? {
            x: this.currentTarget.x,
            y: this.currentTarget.y,
            z: this.currentTarget.z,
            id: this.currentTarget.blockId,
            name: BLOCKS[this.currentTarget.blockId].name,
            breakProgress: this.miningDuration > 0 && Number.isFinite(this.miningDuration) ? Math.min(1, this.miningElapsed / this.miningDuration) : 0,
          }
        : null,
      debug: {
        fps: this.currentFps,
        x: this.playerPos.x,
        y: this.playerPos.y,
        z: this.playerPos.z,
        chunkX: Math.floor(this.playerPos.x / CHUNK_SIZE),
        chunkZ: Math.floor(this.playerPos.z / CHUNK_SIZE),
        facing: this.getFacingLabel(),
        yaw: THREE.MathUtils.radToDeg(this.yaw),
        pitch: THREE.MathUtils.radToDeg(this.pitch),
        biome: this.world.getBiomeAt(Math.floor(this.playerPos.x), Math.floor(this.playerPos.z)),
        dayTime: Math.round(this.dayTime),
        dayCount: this.dayCount,
        weather: this.weather,
        mobCount: this.mobs.length,
        loadedChunks: this.world.chunks.size,
        seed: this.worldSeed,
      },
    });
  }

  private startLoop() {
    const afterDraw = (cb: () => void) => {
      const gl = this.renderer.getContext() as WebGL2RenderingContext;
      const sync = typeof gl.fenceSync === 'function' ? gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0) : null;
      if (!sync) {
        this.frameId = window.setTimeout(cb, 80);
        return;
      }
      gl.flush();
      const poll = () => {
        if (this.disposed) {
          gl.deleteSync(sync);
          return;
        }
        const state = gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          this.frameId = window.setTimeout(poll, 5);
        } else {
          gl.deleteSync(sync);
          this.frameId = window.setTimeout(cb, 80);
        }
      };
      this.frameId = window.setTimeout(poll, 5);
    };

    const tick = () => {
      if (this.disposed) return;

      const now = performance.now();
      const rawDt = (now - this.lastTime) / 1000;
      this.lastTime = now;
      const dt = Math.min(rawDt, 0.05);

      this.fpsAccum += rawDt;
      this.fpsFrames += 1;
      if (this.fpsAccum >= 0.5) {
        this.currentFps = Math.round(this.fpsFrames / this.fpsAccum);
        this.fpsAccum = 0;
        this.fpsFrames = 0;
      }

      if (this.rightClickCooldown > 0) this.rightClickCooldown -= dt;
      if (this.damageFlash > 0) this.damageFlash = Math.max(0, this.damageFlash - dt * 1.4);

      if (this.phase === 'playing') {
        this.streamChunksAroundPlayer();
        this.updatePlayerPhysics(dt);
        this.updateBlockTargetAndMining(dt);
        this.updateMobs(dt);
        this.updateEntitiesAndFx(dt);
        this.updateFurnaces(dt);
        this.updateCropAndSaplingTicks(dt);
      }

      this.updateSkyAndWeather(dt);
      this.updateCameraAndViewModel(dt);

      this.renderer.render(this.scene, this.camera);

      if (this.phase === 'playing') {
        this.hudSyncTimer += dt;
        if (this.hudSyncTimer >= 0.065) {
          this.hudSyncTimer = 0;
          this.syncHud();
        }
      }

      if (this.isSoftwareGl) afterDraw(tick);
      else this.frameId = requestAnimationFrame(tick);
    };

    if (this.isSoftwareGl) afterDraw(tick);
    else this.frameId = requestAnimationFrame(tick);
  }
}
