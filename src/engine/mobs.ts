import * as THREE from 'three';
import { BlockId, ItemId, ItemStack, MobType } from '../types/game';
import { BLOCKS, BLOCK_ITEM } from '../data/itemsAndBlocks';
import { VoxelWorld } from './world';
import { soundEngine } from './audio';

export interface MobEntity {
  id: number;
  type: MobType;
  hostile: boolean;
  group: THREE.Group;
  legs: THREE.Object3D[];
  arms: THREE.Object3D[];
  head: THREE.Object3D;
  bodyMaterials: THREE.MeshStandardMaterial[];
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  yaw: number;
  hp: number;
  maxHp: number;
  width: number;
  height: number;
  walkPhase: number;
  aiTimer: number;
  wanderYaw: number;
  isMoving: boolean;
  hurtFlash: number;
  attackCooldown: number;
  fuseTimer: number; // Creeper fuse (-1 = inactive)
  fleeTimer: number;
  soundTimer: number;
  onGround: boolean;
}

export interface DroppedItemEntity {
  id: number;
  mesh: THREE.Group;
  stack: ItemStack;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  age: number;
  pickupDelay: number;
}

export interface ArrowEntity {
  id: number;
  mesh: THREE.Group;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  fromPlayer: boolean;
  age: number;
}

export interface LitTntEntity {
  id: number;
  mesh: THREE.Mesh;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  fuse: number;
}

export interface EnderPearlEntity {
  id: number;
  mesh: THREE.Mesh;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  age: number;
}

function makePart(
  w: number,
  h: number,
  d: number,
  color: number,
  roughness = 0.85,
  metalness = 0.04
): { mesh: THREE.Mesh; mat: THREE.MeshStandardMaterial } {
  const geo = new THREE.BoxGeometry(w, h, d);
  const mat = new THREE.MeshStandardMaterial({ color, roughness, metalness });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return { mesh, mat };
}

export function createPlayerCharacterModel(): {
  group: THREE.Group;
  head: THREE.Group;
  arms: THREE.Object3D[];
  legs: THREE.Object3D[];
} {
  const group = new THREE.Group();

  // Legs (0..0.75)
  const legL = new THREE.Group();
  legL.position.set(-0.125, 0.75, 0);
  const legLMesh = makePart(0.24, 0.75, 0.24, 0x2c409c).mesh;
  legLMesh.position.y = -0.375;
  legL.add(legLMesh);

  const legR = new THREE.Group();
  legR.position.set(0.125, 0.75, 0);
  const legRMesh = makePart(0.24, 0.75, 0.24, 0x27398c).mesh;
  legRMesh.position.y = -0.375;
  legR.add(legRMesh);

  // Torso (0.75..1.50)
  const torso = makePart(0.5, 0.75, 0.25, 0x1aa3a8, 0.8).mesh;
  torso.position.set(0, 1.125, 0);

  // Arms
  const armL = new THREE.Group();
  armL.position.set(-0.37, 1.45, 0);
  const armLSleeve = makePart(0.22, 0.25, 0.22, 0x1aa3a8).mesh;
  armLSleeve.position.y = -0.125;
  const armLSkin = makePart(0.22, 0.5, 0.22, 0xd9a788).mesh;
  armLSkin.position.y = -0.5;
  armL.add(armLSleeve, armLSkin);

  const armR = new THREE.Group();
  armR.position.set(0.37, 1.45, 0);
  const armRSleeve = makePart(0.22, 0.25, 0.22, 0x1aa3a8).mesh;
  armRSleeve.position.y = -0.125;
  const armRSkin = makePart(0.22, 0.5, 0.22, 0xd9a788).mesh;
  armRSkin.position.y = -0.5;
  armR.add(armRSleeve, armRSkin);

  // Head
  const head = new THREE.Group();
  head.position.set(0, 1.5, 0);
  const skull = makePart(0.48, 0.48, 0.48, 0xd9a788).mesh;
  skull.position.y = 0.24;
  const hair = makePart(0.5, 0.14, 0.5, 0x422a18).mesh;
  hair.position.y = 0.44;
  const eyeL = makePart(0.08, 0.06, 0.03, 0x3b2fb8).mesh;
  eyeL.position.set(-0.11, 0.25, 0.24);
  const eyeR = makePart(0.08, 0.06, 0.03, 0x3b2fb8).mesh;
  eyeR.position.set(0.11, 0.25, 0.24);
  head.add(skull, hair, eyeL, eyeR);

  group.add(legL, legR, torso, armL, armR, head);
  return { group, head, arms: [armL, armR], legs: [legL, legR] };
}

export function createMobEntity(id: number, type: MobType, pos: THREE.Vector3): MobEntity {
  const group = new THREE.Group();
  const legs: THREE.Object3D[] = [];
  const arms: THREE.Object3D[] = [];
  const bodyMaterials: THREE.MeshStandardMaterial[] = [];
  const head = new THREE.Group();

  let hostile = false;
  let hp = 10;
  let width = 0.7;
  let height = 1.2;

  const track = (p: { mesh: THREE.Mesh; mat: THREE.MeshStandardMaterial }) => {
    bodyMaterials.push(p.mat);
    return p.mesh;
  };

  if (type === 'sheep') {
    hp = 8;
    width = 0.8;
    height = 1.15;
    const body = track(makePart(0.65, 0.52, 0.9, 0xf2f2f2, 0.95));
    body.position.set(0, 0.65, 0);
    group.add(body);

    head.position.set(0, 0.85, 0.45);
    const woolCap = track(makePart(0.4, 0.38, 0.36, 0xf2f2f2, 0.95));
    woolCap.position.set(0, 0.05, 0.12);
    const face = track(makePart(0.32, 0.3, 0.2, 0xe8c4b0, 0.85));
    face.position.set(0, 0.02, 0.26);
    const eyeL = track(makePart(0.06, 0.06, 0.03, 0x1b1b1b));
    eyeL.position.set(-0.1, 0.07, 0.36);
    const eyeR = track(makePart(0.06, 0.06, 0.03, 0x1b1b1b));
    eyeR.position.set(0.1, 0.07, 0.36);
    head.add(woolCap, face, eyeL, eyeR);
    group.add(head);

    const legOffsets = [[-0.2, 0.4, 0.28], [0.2, 0.4, 0.28], [-0.2, 0.4, -0.28], [0.2, 0.4, -0.28]];
    for (const [lx, ly, lz] of legOffsets) {
      const piv = new THREE.Group();
      piv.position.set(lx, ly, lz);
      const lm = track(makePart(0.18, 0.4, 0.18, 0xd8b4a0));
      lm.position.y = -0.2;
      piv.add(lm);
      group.add(piv);
      legs.push(piv);
    }
  } else if (type === 'cow') {
    hp = 10;
    width = 0.85;
    height = 1.3;
    const body = track(makePart(0.72, 0.6, 1.05, 0x4b3526, 0.88));
    body.position.set(0, 0.72, 0);
    const patch = track(makePart(0.74, 0.3, 0.42, 0xe8e4dc, 0.9));
    patch.position.set(0, 0.78, 0.1);
    group.add(body, patch);

    head.position.set(0, 0.92, 0.55);
    const skull = track(makePart(0.42, 0.42, 0.38, 0x4b3526));
    skull.position.set(0, 0.02, 0.16);
    const snout = track(makePart(0.32, 0.18, 0.14, 0xd1b3a7));
    snout.position.set(0, -0.08, 0.34);
    const hornL = track(makePart(0.07, 0.16, 0.07, 0xc7bfb2, 0.6));
    hornL.position.set(-0.22, 0.22, 0.12);
    const hornR = track(makePart(0.07, 0.16, 0.07, 0xc7bfb2, 0.6));
    hornR.position.set(0.22, 0.22, 0.12);
    head.add(skull, snout, hornL, hornR);
    group.add(head);

    const legOffsets = [[-0.22, 0.45, 0.34], [0.22, 0.45, 0.34], [-0.22, 0.45, -0.34], [0.22, 0.45, -0.34]];
    for (const [lx, ly, lz] of legOffsets) {
      const piv = new THREE.Group();
      piv.position.set(lx, ly, lz);
      const lm = track(makePart(0.2, 0.45, 0.2, 0x3b281c));
      lm.position.y = -0.225;
      piv.add(lm);
      group.add(piv);
      legs.push(piv);
    }
  } else if (type === 'pig') {
    hp = 10;
    width = 0.8;
    height = 0.95;
    const body = track(makePart(0.6, 0.48, 0.88, 0xf29ca3, 0.82));
    body.position.set(0, 0.5, 0);
    group.add(body);

    head.position.set(0, 0.62, 0.44);
    const skull = track(makePart(0.42, 0.4, 0.4, 0xf29ca3, 0.82));
    skull.position.set(0, 0.02, 0.16);
    const snout = track(makePart(0.24, 0.16, 0.1, 0xe87b86, 0.8));
    snout.position.set(0, -0.04, 0.38);
    const eyeL = track(makePart(0.07, 0.05, 0.03, 0x1b1b1b));
    eyeL.position.set(-0.14, 0.08, 0.36);
    const eyeR = track(makePart(0.07, 0.05, 0.03, 0x1b1b1b));
    eyeR.position.set(0.14, 0.08, 0.36);
    head.add(skull, snout, eyeL, eyeR);
    group.add(head);

    const legOffsets = [[-0.18, 0.28, 0.28], [0.18, 0.28, 0.28], [-0.18, 0.28, -0.28], [0.18, 0.28, -0.28]];
    for (const [lx, ly, lz] of legOffsets) {
      const piv = new THREE.Group();
      piv.position.set(lx, ly, lz);
      const lm = track(makePart(0.18, 0.28, 0.18, 0xe88a92));
      lm.position.y = -0.14;
      piv.add(lm);
      group.add(piv);
      legs.push(piv);
    }
  } else if (type === 'zombie') {
    hostile = true;
    hp = 20;
    width = 0.65;
    height = 1.95;
    const shirt = track(makePart(0.5, 0.72, 0.25, 0x2f8799, 0.85));
    shirt.position.set(0, 1.08, 0);
    group.add(shirt);

    head.position.set(0, 1.44, 0);
    const skull = track(makePart(0.46, 0.46, 0.46, 0x557d3b, 0.85));
    skull.position.y = 0.23;
    const eyeL = track(makePart(0.08, 0.05, 0.03, 0x1c1c1c));
    eyeL.position.set(-0.1, 0.24, 0.23);
    const eyeR = track(makePart(0.08, 0.05, 0.03, 0x1c1c1c));
    eyeR.position.set(0.1, 0.24, 0.23);
    head.add(skull, eyeL, eyeR);
    group.add(head);

    for (const sx of [-0.36, 0.36]) {
      const armPiv = new THREE.Group();
      armPiv.position.set(sx, 1.38, 0);
      armPiv.rotation.x = -Math.PI / 2.2; // Classic zombie outstretched arms!
      const am = track(makePart(0.2, 0.68, 0.2, 0x557d3b));
      am.position.y = -0.34;
      armPiv.add(am);
      group.add(armPiv);
      arms.push(armPiv);
    }

    for (const lx of [-0.13, 0.13]) {
      const legPiv = new THREE.Group();
      legPiv.position.set(lx, 0.72, 0);
      const lm = track(makePart(0.23, 0.72, 0.23, 0x3b3582));
      lm.position.y = -0.36;
      legPiv.add(lm);
      group.add(legPiv);
      legs.push(legPiv);
    }
  } else if (type === 'skeleton') {
    hostile = true;
    hp = 20;
    width = 0.62;
    height = 1.95;
    const ribcage = track(makePart(0.46, 0.7, 0.22, 0xd8d8d8, 0.65));
    ribcage.position.set(0, 1.08, 0);
    group.add(ribcage);

    head.position.set(0, 1.44, 0);
    const skull = track(makePart(0.44, 0.44, 0.44, 0xe3e3e3, 0.65));
    skull.position.y = 0.22;
    const eyeL = track(makePart(0.09, 0.07, 0.03, 0x181818));
    eyeL.position.set(-0.1, 0.22, 0.22);
    const eyeR = track(makePart(0.09, 0.07, 0.03, 0x181818));
    eyeR.position.set(0.1, 0.22, 0.22);
    head.add(skull, eyeL, eyeR);
    group.add(head);

    for (const sx of [-0.32, 0.32]) {
      const armPiv = new THREE.Group();
      armPiv.position.set(sx, 1.38, 0);
      armPiv.rotation.x = -Math.PI / 2.4;
      const am = track(makePart(0.12, 0.68, 0.12, 0xd8d8d8, 0.65));
      am.position.y = -0.34;
      armPiv.add(am);
      if (sx > 0) {
        const bow = track(makePart(0.07, 0.5, 0.12, 0x704f29));
        bow.position.set(0, -0.68, 0.12);
        armPiv.add(bow);
      }
      group.add(armPiv);
      arms.push(armPiv);
    }

    for (const lx of [-0.13, 0.13]) {
      const legPiv = new THREE.Group();
      legPiv.position.set(lx, 0.72, 0);
      const lm = track(makePart(0.12, 0.72, 0.12, 0xd0d0d0, 0.65));
      lm.position.y = -0.36;
      legPiv.add(lm);
      group.add(legPiv);
      legs.push(legPiv);
    }
  } else if (type === 'creeper') {
    hostile = true;
    hp = 20;
    width = 0.62;
    height = 1.72;
    const torso = track(makePart(0.46, 0.82, 0.28, 0x3ba835, 0.85));
    torso.position.set(0, 0.82, 0);
    group.add(torso);

    head.position.set(0, 1.24, 0);
    const skull = track(makePart(0.48, 0.48, 0.48, 0x45bd3e, 0.85));
    skull.position.y = 0.24;
    const eyeL = track(makePart(0.09, 0.09, 0.03, 0x111111));
    eyeL.position.set(-0.11, 0.28, 0.24);
    const eyeR = track(makePart(0.09, 0.09, 0.03, 0x111111));
    eyeR.position.set(0.11, 0.28, 0.24);
    const mouth = track(makePart(0.18, 0.12, 0.03, 0x111111));
    mouth.position.set(0, 0.14, 0.24);
    head.add(skull, eyeL, eyeR, mouth);
    group.add(head);

    const legOffsets = [[-0.16, 0.42, 0.18], [0.16, 0.42, 0.18], [-0.16, 0.42, -0.18], [0.16, 0.42, -0.18]];
    for (const [lx, ly, lz] of legOffsets) {
      const piv = new THREE.Group();
      piv.position.set(lx, ly, lz);
      const lm = track(makePart(0.22, 0.42, 0.22, 0x359630));
      lm.position.y = -0.21;
      piv.add(lm);
      group.add(piv);
      legs.push(piv);
    }
  } else if (type === 'spider') {
    hostile = true;
    hp = 16;
    width = 1.2;
    height = 0.78;

    const thorax = track(makePart(0.55, 0.4, 0.5, 0x2a2422, 0.85));
    thorax.position.set(0, 0.36, 0.05);
    const abdomen = track(makePart(0.75, 0.5, 0.72, 0x221c1a, 0.88));
    abdomen.position.set(0, 0.42, -0.55);
    group.add(thorax, abdomen);

    head.position.set(0, 0.38, 0.36);
    const skull = track(makePart(0.5, 0.42, 0.42, 0x2d2624, 0.85));
    skull.position.set(0, 0, 0.14);
    const eyeL = track(makePart(0.08, 0.06, 0.03, 0xdc2626, 0.3));
    eyeL.position.set(-0.12, 0.06, 0.35);
    const eyeR = track(makePart(0.08, 0.06, 0.03, 0xdc2626, 0.3));
    eyeR.position.set(0.12, 0.06, 0.35);
    const eyeL2 = track(makePart(0.05, 0.05, 0.03, 0xef4444, 0.3));
    eyeL2.position.set(-0.2, -0.02, 0.34);
    const eyeR2 = track(makePart(0.05, 0.05, 0.03, 0xef4444, 0.3));
    eyeR2.position.set(0.2, -0.02, 0.34);
    head.add(skull, eyeL, eyeR, eyeL2, eyeR2);
    group.add(head);

    const zOffsets = [0.22, 0.06, -0.1, -0.26];
    for (let i = 0; i < 4; i++) {
      for (const side of [-1, 1]) {
        const legPiv = new THREE.Group();
        legPiv.position.set(side * 0.28, 0.32, zOffsets[i]);
        legPiv.rotation.z = side * -0.45;
        const lm = track(makePart(0.65, 0.11, 0.11, 0x1d1817));
        lm.position.set(side * 0.32, -0.1, 0);
        legPiv.add(lm);
        group.add(legPiv);
        legs.push(legPiv);
      }
    }
  } else if (type === 'enderman') {
    hostile = true;
    hp = 40;
    width = 0.65;
    height = 2.75;

    const torso = track(makePart(0.46, 0.72, 0.24, 0x141418, 0.85));
    torso.position.set(0, 1.75, 0);
    group.add(torso);

    head.position.set(0, 2.12, 0);
    const skull = track(makePart(0.46, 0.46, 0.46, 0x16161b, 0.85));
    skull.position.y = 0.24;
    const eyeL = track(makePart(0.11, 0.05, 0.03, 0xd946ef, 0.2));
    eyeL.position.set(-0.11, 0.24, 0.23);
    const eyeR = track(makePart(0.11, 0.05, 0.03, 0xd946ef, 0.2));
    eyeR.position.set(0.11, 0.24, 0.23);
    head.add(skull, eyeL, eyeR);
    group.add(head);

    for (const sx of [-0.31, 0.31]) {
      const armPiv = new THREE.Group();
      armPiv.position.set(sx, 2.05, 0);
      const am = track(makePart(0.12, 1.35, 0.12, 0x141418));
      am.position.y = -0.68;
      armPiv.add(am);
      group.add(armPiv);
      arms.push(armPiv);
    }

    for (const lx of [-0.12, 0.12]) {
      const legPiv = new THREE.Group();
      legPiv.position.set(lx, 1.4, 0);
      const lm = track(makePart(0.13, 1.4, 0.13, 0x141418));
      lm.position.y = -0.7;
      legPiv.add(lm);
      group.add(legPiv);
      legs.push(legPiv);
    }
  }

  group.position.copy(pos);

  return {
    id,
    type,
    hostile,
    group,
    legs,
    arms,
    head,
    bodyMaterials,
    pos: pos.clone(),
    vel: new THREE.Vector3(),
    yaw: Math.random() * Math.PI * 2,
    hp,
    maxHp: hp,
    width,
    height,
    walkPhase: Math.random() * 10,
    aiTimer: Math.random() * 3,
    wanderYaw: Math.random() * Math.PI * 2,
    isMoving: false,
    hurtFlash: 0,
    attackCooldown: 0,
    fuseTimer: -1,
    fleeTimer: 0,
    soundTimer: 4 + Math.random() * 8,
    onGround: false,
  };
}

export function getMobDrops(type: MobType): { item: ItemId; count: number; xp: number }[] {
  switch (type) {
    case 'sheep':
      return [
        { item: BLOCK_ITEM(BlockId.WoolWhite), count: 1, xp: 2 },
        { item: 'raw_mutton', count: 1 + Math.floor(Math.random() * 2), xp: 1 },
      ];
    case 'cow':
      return [
        { item: 'leather', count: 1 + Math.floor(Math.random() * 2), xp: 2 },
        { item: 'raw_beef', count: 1 + Math.floor(Math.random() * 2), xp: 1 },
      ];
    case 'pig':
      return [{ item: 'raw_porkchop', count: 1 + Math.floor(Math.random() * 2), xp: 2 }];
    case 'zombie':
      return [{ item: 'rotten_flesh', count: 1 + Math.floor(Math.random() * 2), xp: 5 }];
    case 'skeleton':
      return [
        { item: 'bone', count: 1 + Math.floor(Math.random() * 2), xp: 5 },
        { item: 'arrow', count: 1 + Math.floor(Math.random() * 2), xp: 0 },
      ];
    case 'creeper':
      return [{ item: 'gunpowder', count: 1 + Math.floor(Math.random() * 2), xp: 5 }];
    case 'spider':
      return [{ item: 'string', count: 1 + Math.floor(Math.random() * 2), xp: 5 }];
    case 'enderman':
      return [{ item: 'ender_pearl', count: Math.random() < 0.7 ? 1 : 0, xp: 5 }];
  }
}

export function createEnderPearlMesh(): THREE.Mesh {
  return new THREE.Mesh(
    new THREE.SphereGeometry(0.16, 8, 8),
    new THREE.MeshStandardMaterial({
      color: 0x0f766e,
      emissive: 0x134e4a,
      roughness: 0.3,
    })
  );
}

export function createDroppedItemMesh(stack: ItemStack): THREE.Group {
  const g = new THREE.Group();
  let color = 0xc9b58b;
  if (stack.id.startsWith('block:')) {
    const bId = Number(stack.id.slice(6)) as BlockId;
    if (bId === BlockId.GrassBlock || bId === BlockId.OakLeaves) color = 0x559e3c;
    else if (bId === BlockId.Dirt || bId === BlockId.OakLog) color = 0x7d5836;
    else if (bId === BlockId.Stone || bId === BlockId.Cobblestone) color = 0x7d7d7d;
    else if (bId === BlockId.Sand) color = 0xdbd29c;
    else if (bId === BlockId.DiamondOre) color = 0x4eece8;
    else if (bId === BlockId.GoldOre) color = 0xfcee4b;
    else if (bId === BlockId.Tnt) color = 0xd13426;
  } else if (stack.id === 'diamond') color = 0x4eece8;
  else if (stack.id === 'coal' || stack.id === 'charcoal') color = 0x222222;
  else if (stack.id === 'iron_ingot') color = 0xd8d8d8;
  else if (stack.id === 'gold_ingot') color = 0xfcee4b;
  else if (stack.id === 'apple' || stack.id === 'raw_beef') color = 0xd43535;
  else if (stack.id === 'cooked_beef') color = 0x7d4427;

  const box = new THREE.Mesh(
    new THREE.BoxGeometry(0.28, 0.28, 0.28),
    new THREE.MeshStandardMaterial({ color, roughness: 0.7 })
  );
  box.castShadow = true;
  box.position.y = 0.22;
  g.add(box);
  return g;
}

export function createArrowMesh(): THREE.Group {
  const g = new THREE.Group();
  const shaft = new THREE.Mesh(
    new THREE.BoxGeometry(0.05, 0.05, 0.55),
    new THREE.MeshStandardMaterial({ color: 0x7a5934 })
  );
  const tip = new THREE.Mesh(
    new THREE.BoxGeometry(0.08, 0.08, 0.1),
    new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.6, roughness: 0.3 })
  );
  tip.position.z = 0.28;
  g.add(shaft, tip);
  return g;
}

export function moveMobWithCollision(
  mob: MobEntity,
  world: VoxelWorld,
  dt: number
) {
  mob.vel.y -= 24 * dt;
  const hw = mob.width * 0.5;

  // X axis
  const nx = mob.pos.x + mob.vel.x * dt;
  if (!collidesBox(world, nx, mob.pos.y, mob.pos.z, hw, mob.height)) {
    mob.pos.x = nx;
  } else {
    if (mob.onGround && !collidesBox(world, nx, mob.pos.y + 1.05, mob.pos.z, hw, mob.height)) {
      mob.vel.y = 7.6;
    } else {
      mob.vel.x = 0;
    }
  }

  // Z axis
  const nz = mob.pos.z + mob.vel.z * dt;
  if (!collidesBox(world, mob.pos.x, mob.pos.y, nz, hw, mob.height)) {
    mob.pos.z = nz;
  } else {
    if (mob.onGround && !collidesBox(world, mob.pos.x, mob.pos.y + 1.05, nz, hw, mob.height)) {
      mob.vel.y = 7.6;
    } else {
      mob.vel.z = 0;
    }
  }

  // Y axis
  const ny = mob.pos.y + mob.vel.y * dt;
  if (!collidesBox(world, mob.pos.x, ny, mob.pos.z, hw, mob.height)) {
    mob.pos.y = ny;
    mob.onGround = false;
  } else {
    if (mob.vel.y < 0) {
      mob.pos.y = Math.floor(ny + 0.001) + 1;
      mob.onGround = true;
    }
    mob.vel.y = 0;
  }

  // Swim upward if in water
  const feetBlock = world.getBlock(Math.floor(mob.pos.x), Math.floor(mob.pos.y + 0.2), Math.floor(mob.pos.z));
  if (feetBlock === BlockId.Water) {
    mob.vel.y += 32 * dt;
    mob.vel.y = Math.min(mob.vel.y, 4);
  }
}

export function collidesBox(
  world: VoxelWorld,
  cx: number,
  by: number,
  cz: number,
  halfW: number,
  height: number
): boolean {
  const minX = Math.floor(cx - halfW);
  const maxX = Math.floor(cx + halfW);
  const minY = Math.floor(by + 0.001);
  const maxY = Math.floor(by + height - 0.001);
  const minZ = Math.floor(cz - halfW);
  const maxZ = Math.floor(cz + halfW);

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      for (let z = minZ; z <= maxZ; z++) {
        const b = world.getBlock(x, y, z);
        if (BLOCKS[b].solid) return true;
      }
    }
  }
  return false;
}

export function updateMobAmbientSounds(mob: MobEntity, distToPlayer: number, dt: number) {
  mob.soundTimer -= dt;
  if (mob.soundTimer <= 0) {
    mob.soundTimer = 6 + Math.random() * 10;
    if (distToPlayer < 16 && mob.type !== 'creeper') {
      soundEngine.playMobSound(mob.type);
    }
  }
}
