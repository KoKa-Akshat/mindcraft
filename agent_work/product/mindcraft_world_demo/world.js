import * as THREE from 'three';

const $ = (selector) => document.querySelector(selector);

const canvas = $('#worldCanvas');
const loading = $('#worldLoading');
const hoverLabel = $('#hoverLabel');
const hoverEyebrow = $('#hoverEyebrow');
const hoverTitle = $('#hoverTitle');
const focusNote = $('#focusNote');
const focusEyebrow = $('#focusEyebrow');
const focusTitle = $('#focusTitle');
const focusBody = $('#focusBody');
const focusMetrics = $('#focusMetrics');
const focusAction = $('#focusAction');
const flowDeck = $('#flowDeck');
const flowKicker = $('#flowKicker');
const flowTitle = $('#flowTitle');
const flowTrack = $('#flowTrack');
const nodeControlLabel = $('#nodeControlLabel');
const nodeControlValue = $('#nodeControlValue');
const nodeControlHint = $('#nodeControlHint');
const nodeSlider = $('#nodeSlider');
const hearthWorkspace = $('#hearthWorkspace');
const curiosityForm = $('#curiosityForm');
const curiosityInput = $('#curiosityInput');
const hearthResponse = $('#hearthResponse');
const buildButton = $('#buildButton');
const hotbarButtons = [...document.querySelectorAll('[data-build]')];
const toast = $('#toast');
const jesseLine = $('#jesseLine');
const missionFill = $('#missionFill');
const missionScore = $('#missionScore');
const worldLevel = $('#worldLevel');
const worldEnergy = $('#worldEnergy');
const worldBooks = $('#worldBooks');

const palette = {
  paper: 0xfff8e9,
  paper2: 0xf3efe4,
  surface: 0xfffdf8,
  ink: 0x143a2e,
  forest: 0x247a4d,
  sage: 0x8fb89a,
  lime: 0xc4f547,
  gold: 0xe8bd3f,
  coral: 0xef806a,
  sky: 0x8bc9dd,
};

const state = {
  activeObject: null,
  activeSystem: null,
  activeNode: null,
  selectedBlock: 'sun',
  building: false,
  sound: true,
  cameraMode: 'world',
  cameraZoom: 1,
  placed: 0,
  mission: new Set(['arrive']),
};

const scene = new THREE.Scene();
scene.background = new THREE.Color(palette.paper);
scene.fog = new THREE.Fog(palette.paper, 21, 42);

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  alpha: false,
  powerPreference: 'high-performance',
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = window.innerWidth > 620;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
camera.position.set(13, 12, 16);
const cameraLook = new THREE.Vector3(0, 0.7, 0);
const desiredCamera = camera.position.clone();
const desiredLook = cameraLook.clone();

scene.add(new THREE.HemisphereLight(palette.surface, palette.sage, 2.3));
const sunLight = new THREE.DirectionalLight(palette.surface, 3.2);
sunLight.position.set(-8, 15, 9);
sunLight.castShadow = true;
sunLight.shadow.mapSize.set(1024, 1024);
sunLight.shadow.camera.left = -16;
sunLight.shadow.camera.right = 16;
sunLight.shadow.camera.top = 16;
sunLight.shadow.camera.bottom = -16;
sunLight.shadow.bias = -0.0004;
scene.add(sunLight);

const lineMaterial = new THREE.LineBasicMaterial({ color: palette.ink, transparent: true, opacity: 0.78 });
const materialCache = new Map();

function material(color) {
  if (!materialCache.has(color)) {
    materialCache.set(color, new THREE.MeshStandardMaterial({
      color,
      roughness: 0.88,
      metalness: 0.02,
      flatShading: true,
    }));
  }
  return materialCache.get(color);
}

function outlined(geometry, color, { shadow = true, edgeOpacity = 0.72 } = {}) {
  const group = new THREE.Group();
  const mesh = new THREE.Mesh(geometry, material(color));
  mesh.castShadow = shadow;
  mesh.receiveShadow = shadow;
  group.add(mesh);
  const edges = new THREE.LineSegments(
    new THREE.EdgesGeometry(geometry, 24),
    edgeOpacity === 0.72 ? lineMaterial : new THREE.LineBasicMaterial({
      color: palette.ink,
      transparent: true,
      opacity: edgeOpacity,
    }),
  );
  group.add(edges);
  group.userData.surface = mesh;
  return group;
}

function block(width, height, depth, color, options) {
  return outlined(new THREE.BoxGeometry(width, height, depth), color, options);
}

function cylinder(radiusTop, radiusBottom, height, segments, color, options) {
  return outlined(new THREE.CylinderGeometry(radiusTop, radiusBottom, height, segments), color, options);
}

function setInteractive(group, id) {
  group.userData.interactiveId = id;
  group.traverse((child) => {
    if (child.isMesh || child.isLineSegments) child.userData.interactiveId = id;
  });
}

function worldLabel(text, color = '#fffdf8') {
  const labelCanvas = document.createElement('canvas');
  labelCanvas.width = 512;
  labelCanvas.height = 128;
  const context = labelCanvas.getContext('2d');
  context.fillStyle = color;
  context.fillRect(8, 8, 496, 112);
  context.strokeStyle = '#143a2e';
  context.lineWidth = 10;
  context.strokeRect(8, 8, 496, 112);
  context.fillStyle = '#143a2e';
  context.font = '600 42px IBM Plex Mono, monospace';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(text, 256, 66);
  const texture = new THREE.CanvasTexture(labelCanvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true }));
  sprite.scale.set(3.6, 0.9, 1);
  return sprite;
}

function addGround() {
  const base = block(25, 0.55, 21, palette.paper2);
  base.position.y = -0.31;
  scene.add(base);

  const grid = new THREE.GridHelper(24, 24, palette.ink, palette.ink);
  grid.position.y = 0.012;
  grid.material.transparent = true;
  grid.material.opacity = 0.12;
  scene.add(grid);

  const pathPoints = [
    [-0.5, 4.4], [-0.5, 3.4], [-0.5, 2.4], [-1.5, 1.6], [-2.5, 1.0],
    [-3.5, 0.3], [-4.4, -0.5], [0.5, 1.6], [1.5, 1.0], [2.5, 0.3],
    [3.5, -0.7], [4.5, -1.7], [-1.2, -1.6], [-2.2, -2.5], [-3.2, -3.4],
  ];
  pathPoints.forEach(([x, z], index) => {
    const tile = block(0.74, 0.08, 0.74, index % 3 === 0 ? palette.gold : palette.surface, { shadow: false, edgeOpacity: 0.35 });
    tile.position.set(x, 0.06, z);
    tile.rotation.y = (index % 2 ? -1 : 1) * 0.05;
    scene.add(tile);
  });

  const patchColors = [palette.sage, palette.lime, palette.coral, palette.sky];
  [
    [-8, 5], [-7, -5], [8, 4], [8, -6], [2, 7], [-4, 7], [6, 7], [-9, 0],
  ].forEach(([x, z], index) => {
    const patch = block(0.86, 0.07, 0.86, patchColors[index % patchColors.length], { shadow: false, edgeOpacity: 0.3 });
    patch.position.set(x, 0.055, z);
    scene.add(patch);
  });

  const groundHit = new THREE.Mesh(
    new THREE.PlaneGeometry(25, 21),
    new THREE.MeshBasicMaterial({ visible: false }),
  );
  groundHit.rotation.x = -Math.PI / 2;
  groundHit.position.y = 0.04;
  groundHit.userData.isGround = true;
  scene.add(groundHit);
  return groundHit;
}

const groundHit = addGround();

function createTree(x, z, scale = 1) {
  const tree = new THREE.Group();
  const trunk = block(0.42, 1.6, 0.42, palette.gold);
  trunk.position.y = 0.8;
  tree.add(trunk);
  const crownA = outlined(new THREE.IcosahedronGeometry(0.9, 0), palette.forest);
  crownA.position.set(0, 1.9, 0);
  tree.add(crownA);
  const crownB = outlined(new THREE.IcosahedronGeometry(0.68, 0), palette.sage);
  crownB.position.set(0.5, 1.72, 0.1);
  tree.add(crownB);
  tree.position.set(x, 0, z);
  tree.scale.setScalar(scale);
  scene.add(tree);
  return tree;
}

createTree(-9.2, 6.4, 1.1);
createTree(9.1, 6.2, 0.92);
createTree(-9.4, -7.2, 0.85);
createTree(9.2, -7.1, 1.08);
createTree(1.8, -8.1, 0.7);

function createAvatar() {
  const avatar = new THREE.Group();
  const torso = block(0.62, 0.82, 0.38, palette.forest);
  torso.position.y = 1.1;
  avatar.add(torso);
  const head = block(0.56, 0.56, 0.56, palette.gold);
  head.position.y = 1.8;
  avatar.add(head);
  const hair = block(0.58, 0.18, 0.58, palette.ink);
  hair.position.set(0, 2.08, -0.01);
  avatar.add(hair);
  const scarf = block(0.68, 0.16, 0.43, palette.coral);
  scarf.position.y = 1.46;
  avatar.add(scarf);

  const leftArmPivot = new THREE.Group();
  const rightArmPivot = new THREE.Group();
  const leftArm = block(0.2, 0.72, 0.22, palette.gold);
  const rightArm = block(0.2, 0.72, 0.22, palette.gold);
  leftArm.position.y = -0.3;
  rightArm.position.y = -0.3;
  leftArmPivot.position.set(-0.44, 1.4, 0);
  rightArmPivot.position.set(0.44, 1.4, 0);
  leftArmPivot.add(leftArm);
  rightArmPivot.add(rightArm);
  avatar.add(leftArmPivot, rightArmPivot);

  const leftLegPivot = new THREE.Group();
  const rightLegPivot = new THREE.Group();
  const leftLeg = block(0.24, 0.72, 0.3, palette.ink);
  const rightLeg = block(0.24, 0.72, 0.3, palette.ink);
  leftLeg.position.y = -0.32;
  rightLeg.position.y = -0.32;
  leftLegPivot.position.set(-0.2, 0.68, 0);
  rightLegPivot.position.set(0.2, 0.68, 0);
  leftLegPivot.add(leftLeg);
  rightLegPivot.add(rightLeg);
  avatar.add(leftLegPivot, rightLegPivot);

  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.55, 24),
    new THREE.MeshBasicMaterial({ color: palette.ink, transparent: true, opacity: 0.16, depthWrite: false }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.025;
  avatar.add(shadow);
  avatar.position.set(0, 0, 5.2);
  avatar.userData.limbs = { leftArmPivot, rightArmPivot, leftLegPivot, rightLegPivot };
  scene.add(avatar);
  return avatar;
}

const avatar = createAvatar();
const avatarTarget = avatar.position.clone();

function createGarden() {
  const garden = new THREE.Group();
  garden.position.set(0, 0, -0.4);

  const plot = block(5.2, 0.34, 3.8, palette.forest);
  plot.position.y = 0.16;
  garden.add(plot);
  for (let x = -2; x <= 2; x += 1) {
    for (let z = -1.35; z <= 1.35; z += 0.9) {
      const soil = block(0.72, 0.12, 0.62, (x + Math.round(z)) % 2 ? palette.paper2 : palette.gold, { shadow: false, edgeOpacity: 0.32 });
      soil.position.set(x, 0.39, z);
      garden.add(soil);
    }
  }

  const plant = new THREE.Group();
  const stem = cylinder(0.13, 0.16, 2.25, 6, palette.forest);
  stem.position.y = 1.48;
  plant.add(stem);
  const crown = outlined(new THREE.IcosahedronGeometry(0.86, 1), palette.lime);
  crown.position.y = 2.65;
  plant.add(crown);
  const leafLeft = block(1.1, 0.17, 0.55, palette.sage);
  leafLeft.position.set(-0.52, 1.65, 0);
  leafLeft.rotation.z = 0.35;
  plant.add(leafLeft);
  const leafRight = block(1.1, 0.17, 0.55, palette.sage);
  leafRight.position.set(0.52, 2.02, 0);
  leafRight.rotation.z = -0.35;
  plant.add(leafRight);
  plant.position.set(0, 0.3, 0);
  garden.add(plant);

  const solar = block(1.1, 0.15, 0.8, palette.sky);
  solar.position.set(-1.8, 1.0, -1.0);
  solar.rotation.x = -0.55;
  garden.add(solar);
  const solarPost = block(0.15, 1.1, 0.15, palette.ink);
  solarPost.position.set(-1.8, 0.55, -1.0);
  garden.add(solarPost);

  const tank = cylinder(0.48, 0.48, 1.15, 12, palette.sky);
  tank.position.set(1.9, 0.92, -1.05);
  garden.add(tank);
  const label = worldLabel('LIVING GARDEN', '#c4f547');
  label.position.set(0, 3.95, 0);
  garden.add(label);

  garden.userData.plant = plant;
  setInteractive(garden, 'garden');
  scene.add(garden);
  return garden;
}

const garden = createGarden();

function createHearth() {
  const hearth = new THREE.Group();
  hearth.position.set(-5.2, 0, 0.7);
  const pad = cylinder(1.45, 1.65, 0.28, 8, palette.paper2);
  pad.position.y = 0.14;
  hearth.add(pad);
  for (let i = 0; i < 3; i += 1) {
    const log = block(1.5, 0.28, 0.3, palette.gold);
    log.position.y = 0.42;
    log.rotation.y = (Math.PI / 3) * i;
    hearth.add(log);
  }
  const flames = new THREE.Group();
  const flameA = outlined(new THREE.ConeGeometry(0.72, 1.9, 5), palette.coral);
  flameA.position.y = 1.25;
  flames.add(flameA);
  const flameB = outlined(new THREE.ConeGeometry(0.45, 1.35, 5), palette.gold);
  flameB.position.set(0.18, 1.0, 0.12);
  flames.add(flameB);
  const flameC = outlined(new THREE.ConeGeometry(0.22, 0.8, 5), palette.lime);
  flameC.position.set(-0.12, 0.82, 0.16);
  flames.add(flameC);
  hearth.add(flames);
  const label = worldLabel('LEARNING HEARTH', '#ef806a');
  label.position.set(0, 3.15, 0);
  hearth.add(label);
  hearth.userData.flames = flames;
  setInteractive(hearth, 'hearth');
  scene.add(hearth);
  return hearth;
}

const hearth = createHearth();

function createDataCenter() {
  const center = new THREE.Group();
  center.position.set(5.2, 0, -3.2);
  const foundation = block(4.4, 0.35, 3.3, palette.ink);
  foundation.position.y = 0.18;
  center.add(foundation);
  const body = block(3.8, 2.35, 2.8, palette.surface);
  body.position.y = 1.52;
  center.add(body);
  const roof = block(4.12, 0.3, 3.1, palette.gold);
  roof.position.y = 2.84;
  center.add(roof);
  const door = block(0.78, 1.5, 0.16, palette.forest);
  door.position.set(-0.9, 1.12, 1.48);
  center.add(door);
  const screen = block(1.18, 0.74, 0.16, palette.ink);
  screen.position.set(0.75, 1.7, 1.49);
  center.add(screen);
  const pulse = block(0.85, 0.16, 0.17, palette.lime);
  pulse.position.set(0.75, 1.7, 1.59);
  center.add(pulse);

  const fans = [];
  [-0.82, 0.82].forEach((x) => {
    const fan = new THREE.Group();
    const ring = outlined(new THREE.TorusGeometry(0.42, 0.08, 8, 16), palette.sage);
    ring.rotation.x = Math.PI / 2;
    fan.add(ring);
    for (let bladeIndex = 0; bladeIndex < 4; bladeIndex += 1) {
      const blade = block(0.48, 0.12, 0.14, palette.forest, { shadow: false });
      blade.position.x = 0.22;
      blade.rotation.z = bladeIndex * Math.PI / 2;
      fan.add(blade);
    }
    fan.position.set(x, 1.0, 1.55);
    center.add(fan);
    fans.push(fan);
  });
  const label = worldLabel('DATA CENTER LAB', '#8bc9dd');
  label.position.set(0, 3.65, 0);
  center.add(label);
  center.userData.fans = fans;
  center.userData.pulse = pulse;
  setInteractive(center, 'datacenter');
  scene.add(center);
  return center;
}

const dataCenter = createDataCenter();

function createBookAtelier() {
  const atelier = new THREE.Group();
  atelier.position.set(-5.0, 0, -4.3);
  const base = block(3.6, 0.3, 2.8, palette.sage);
  base.position.y = 0.15;
  atelier.add(base);
  const bookColors = [palette.coral, palette.gold, palette.sky, palette.lime, palette.surface];
  for (let index = 0; index < 9; index += 1) {
    const book = block(1.65, 0.28, 1.05, bookColors[index % bookColors.length]);
    book.position.set(index % 2 ? 0.43 : -0.4, 0.5 + index * 0.28, index % 3 === 0 ? 0.1 : -0.08);
    book.rotation.y = (index % 2 ? 1 : -1) * 0.12;
    atelier.add(book);
  }
  const page = block(1.9, 1.25, 0.12, palette.surface);
  page.position.set(0.85, 1.3, 0.95);
  page.rotation.z = -0.06;
  atelier.add(page);
  const pageLineA = block(1.25, 0.08, 0.14, palette.forest);
  pageLineA.position.set(0.85, 1.48, 1.03);
  atelier.add(pageLineA);
  const pageLineB = block(0.9, 0.08, 0.14, palette.coral);
  pageLineB.position.set(0.68, 1.22, 1.03);
  atelier.add(pageLineB);
  const label = worldLabel('BOOK ATELIER', '#fffdf8');
  label.position.set(0, 3.75, 0);
  atelier.add(label);
  setInteractive(atelier, 'atelier');
  scene.add(atelier);
  return atelier;
}

createBookAtelier();

function addWorldDetails() {
  const rocks = [
    [-7, 2.8, palette.coral], [7.8, 1.5, palette.gold], [3.4, 5.8, palette.sky],
    [-2.8, 6.5, palette.lime], [7.7, -7.2, palette.sage],
  ];
  rocks.forEach(([x, z, color], index) => {
    const rock = outlined(new THREE.DodecahedronGeometry(0.28 + index * 0.025, 0), color);
    rock.position.set(x, 0.27, z);
    rock.rotation.set(index * 0.2, index * 0.4, 0);
    scene.add(rock);
  });

  const clouds = [];
  for (let cloudIndex = 0; cloudIndex < 4; cloudIndex += 1) {
    const cloud = new THREE.Group();
    for (let part = 0; part < 4; part += 1) {
      const puff = outlined(new THREE.IcosahedronGeometry(0.58 + part * 0.08, 1), palette.surface, { shadow: false, edgeOpacity: 0.18 });
      puff.position.set(part * 0.7, Math.sin(part) * 0.18, 0);
      cloud.add(puff);
    }
    cloud.position.set(-12 + cloudIndex * 7, 8 + cloudIndex, -8 - cloudIndex * 1.8);
    scene.add(cloud);
    clouds.push(cloud);
  }
  return clouds;
}

const clouds = addWorldDetails();

const systems = {
  garden: {
    kicker: 'Living garden',
    title: 'Every block changes the harvest',
    values: { sun: 72, pump: 64, soil: 58 },
    active: 'sun',
    nodes: [
      { id: 'sun', eyebrow: 'Environment input', title: 'Sun collector', control: 'Sun angle', unit: '%', hint: 'This changes the light reaching every block downstream.' },
      { id: 'pump', eyebrow: 'Transfer block', title: 'Water pump', control: 'Pump power', unit: 'L', hint: 'The pump turns stored energy into water moving through the garden.' },
      { id: 'soil', eyebrow: 'Living output', title: 'Root bed', control: 'Soil health', unit: '%', hint: 'Healthy soil decides how much light and water the plant can actually use.' },
    ],
    compute(values) {
      const light = Math.round(values.sun);
      const water = Math.round(values.pump * (0.55 + values.sun / 250));
      const growth = Math.round(Math.min(light * 0.92, water * 1.16, values.soil * 1.18));
      return { sun: light, pump: water, soil: growth };
    },
  },
  datacenter: {
    kicker: 'Data center system',
    title: 'Power becomes compute, heat, and questions',
    values: { grid: 78, cooling: 62, load: 70 },
    active: 'grid',
    nodes: [
      { id: 'grid', eyebrow: 'Energy input', title: 'Power grid', control: 'Available power', unit: 'MW', hint: 'The grid limits how much the whole system can attempt at once.' },
      { id: 'cooling', eyebrow: 'Constraint block', title: 'Cooling loop', control: 'Cooling effort', unit: 'C', hint: 'Cooling protects the machines, but it also consumes energy and water.' },
      { id: 'load', eyebrow: 'Useful output', title: 'Compute hall', control: 'Compute demand', unit: 'jobs', hint: 'Demand only becomes useful work when power and cooling can support it.' },
    ],
    compute(values) {
      const power = Math.round(values.grid);
      const temperature = Math.round(45 - values.cooling * 0.28 + values.load * 0.11);
      const jobs = Math.max(0, Math.round(Math.min(values.load, values.grid * 0.95, values.cooling * 1.12)));
      return { grid: power, cooling: temperature, load: jobs };
    },
  },
};

const objectCopy = {
  garden: {
    eyebrow: 'Living system',
    title: "Maya's garden",
    body: 'Sunlight, stored water, and soil health are producing one shared outcome right now.',
    action: 'Open live flow',
    system: 'garden',
  },
  datacenter: {
    eyebrow: 'Unlocked from your book',
    title: 'Data center lab',
    body: 'A miniature system built from power, cooling, and compute blocks you can inspect or rebuild.',
    action: 'Open live flow',
    system: 'datacenter',
  },
  hearth: {
    eyebrow: 'Learning hearth',
    title: 'Bring a question',
    body: 'Questions become models here. Models become simulations, chapters, and new blocks for your world.',
    action: 'Learn by building',
    workspace: 'learn',
  },
  atelier: {
    eyebrow: 'Book atelier',
    title: 'Your ideas have a spine',
    body: 'Every tested model can become a chapter. Your current field book is three chapters deep.',
    action: 'Open living draft',
    workspace: 'book',
  },
};

function systemOutputs(systemId) {
  const system = systems[systemId];
  return system.compute(system.values);
}

function metricsFor(id) {
  if (id === 'garden') {
    const output = systemOutputs('garden');
    return [
      ['Growth', `${output.soil}%`],
      ['Water', `${output.pump} L`],
      ['Light', `${output.sun}%`],
    ];
  }
  if (id === 'datacenter') {
    const output = systemOutputs('datacenter');
    return [
      ['Compute', `${output.load} jobs`],
      ['Heat', `${output.cooling} C`],
      ['Power', `${output.grid} MW`],
    ];
  }
  if (id === 'hearth') return [['Questions', '12'], ['Blocks', '7'], ['Streak', '4 days']];
  return [['Chapters', '3 / 8'], ['Readers', '24'], ['Royalty', '$6.40']];
}

function renderMetrics(id) {
  focusMetrics.replaceChildren(...metricsFor(id).map(([label, value]) => {
    const metric = document.createElement('span');
    metric.innerHTML = `<small>${label}</small><b>${value}</b>`;
    return metric;
  }));
}

function showToast(message) {
  toast.textContent = message;
  toast.hidden = false;
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => { toast.hidden = true; }, 2400);
}

function sound(frequency = 420, duration = 0.07) {
  if (!state.sound) return;
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return;
  const context = sound.context || new AudioContext();
  sound.context = context;
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = 'sine';
  oscillator.frequency.value = frequency;
  gain.gain.setValueAtTime(0.0001, context.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.045, context.currentTime + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + duration);
  oscillator.connect(gain).connect(context.destination);
  oscillator.start();
  oscillator.stop(context.currentTime + duration + 0.01);
}

function updateMission(step) {
  state.mission.add(step);
  const score = Math.min(3, state.mission.size);
  missionScore.textContent = `${score} / 3`;
  missionFill.style.width = `${(score / 3) * 100}%`;
  if (score === 3) {
    missionScore.textContent = 'complete';
    jesseLine.textContent = 'Your world learned something new.';
  }
}

function closeFloatingUI({ keepFocus = false } = {}) {
  flowDeck.hidden = true;
  hearthWorkspace.hidden = true;
  if (!keepFocus) focusNote.hidden = true;
  state.activeSystem = null;
  state.activeNode = null;
}

function focusCameraAt(position, distance = 7) {
  state.cameraMode = 'focus';
  desiredLook.copy(position).add(new THREE.Vector3(0, 1.1, 0));
  desiredCamera.copy(position).add(new THREE.Vector3(distance, distance * 0.72, distance));
}

function openFocus(id) {
  const copy = objectCopy[id];
  if (!copy) return;
  state.activeObject = id;
  state.building = false;
  buildButton.setAttribute('aria-pressed', 'false');
  canvas.classList.remove('is-building');
  closeFloatingUI();
  focusEyebrow.textContent = copy.eyebrow;
  focusTitle.textContent = copy.title;
  focusBody.textContent = copy.body;
  focusAction.textContent = copy.action;
  renderMetrics(id);
  focusNote.hidden = false;
  const target = id === 'garden' ? garden : id === 'datacenter' ? dataCenter : id === 'hearth' ? hearth : scene.getObjectByProperty('name', 'atelier');
  if (target) focusCameraAt(target.position, id === 'datacenter' ? 6.8 : 6.2);
  sound(520);
  if (copy.system) {
    window.setTimeout(() => openFlow(copy.system), 180);
  }
}

function outputForNode(system, nodeId) {
  return system.compute(system.values)[nodeId];
}

function selectFlowNode(systemId, nodeId) {
  const system = systems[systemId];
  const node = system.nodes.find((item) => item.id === nodeId);
  if (!node) return;
  system.active = nodeId;
  state.activeNode = nodeId;
  nodeControlLabel.textContent = node.control;
  nodeControlValue.textContent = `${Math.round(system.values[nodeId])}%`;
  nodeControlHint.textContent = node.hint;
  nodeSlider.min = '0';
  nodeSlider.max = '100';
  nodeSlider.step = '1';
  nodeSlider.value = String(system.values[nodeId]);
  flowTrack.querySelectorAll('[data-flow-node]').forEach((button) => {
    button.classList.toggle('is-active', button.dataset.flowNode === nodeId);
  });
}

function renderFlow(systemId) {
  const system = systems[systemId];
  const outputs = system.compute(system.values);
  flowKicker.textContent = system.kicker;
  flowTitle.textContent = system.title;
  flowTrack.replaceChildren(...system.nodes.map((node) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `flow-node${node.id === system.active ? ' is-active' : ''}`;
    button.dataset.flowNode = node.id;
    button.innerHTML = `<span class="port in" aria-hidden="true"></span><small>${node.eyebrow}</small><strong>${node.title}</strong><output>${outputs[node.id]} ${node.unit}</output><span class="port out" aria-hidden="true"></span>`;
    button.addEventListener('click', () => {
      selectFlowNode(systemId, node.id);
      sound(620);
    });
    return button;
  }));
  selectFlowNode(systemId, system.active);
}

function openFlow(systemId) {
  state.activeSystem = systemId;
  focusNote.hidden = true;
  hearthWorkspace.hidden = true;
  renderFlow(systemId);
  flowDeck.hidden = false;
  updateMission('inspect');
  jesseLine.textContent = systemId === 'garden' ? 'One value moves the whole garden.' : 'Trace the energy before changing it.';
}

function updateWorldFromSystems() {
  const gardenOutput = systemOutputs('garden');
  const growth = THREE.MathUtils.clamp(gardenOutput.soil / 70, 0.55, 1.35);
  const plant = garden.userData.plant;
  plant.scale.y = THREE.MathUtils.lerp(plant.scale.y, growth, 0.13);
  plant.scale.x = THREE.MathUtils.lerp(plant.scale.x, 0.82 + growth * 0.15, 0.13);
  plant.scale.z = plant.scale.x;
  worldEnergy.textContent = `${Math.round((gardenOutput.sun + systemOutputs('datacenter').grid) / 2)} energy`;

  const dataOutput = systemOutputs('datacenter');
  const pulse = dataCenter.userData.pulse;
  pulse.scale.x = 0.35 + dataOutput.load / 100;
  pulse.userData.surface.material.emissive = new THREE.Color(palette.lime);
  pulse.userData.surface.material.emissiveIntensity = dataOutput.load / 180;
}

function openWorkspace(mode) {
  closeFloatingUI();
  const title = hearthWorkspace.querySelector('h2');
  const kicker = hearthWorkspace.querySelector('header small');
  const formLabel = hearthWorkspace.querySelector('form label');
  if (mode === 'book') {
    kicker.textContent = 'Book atelier';
    title.textContent = 'Build the chapter inside your world.';
    formLabel.textContent = 'What should this chapter help someone understand?';
    curiosityInput.value = 'How does cooling move heat away from computers?';
    hearthResponse.querySelector('span').textContent = 'Chapter thread';
    hearthResponse.querySelector('p').textContent = 'Show the energy entering, moving, and leaving. Let the reader test each step.';
  } else {
    kicker.textContent = 'Learning hearth';
    title.textContent = 'Turn a question into a world.';
    formLabel.textContent = 'What are you trying to understand?';
    curiosityInput.value = 'Why do data centers need so much water?';
    hearthResponse.querySelector('span').textContent = "Jesse's first nudge";
    hearthResponse.querySelector('p').textContent = 'Start with what you can observe. What enters the data center, and what leaves it?';
  }
  hearthWorkspace.dataset.mode = mode;
  hearthWorkspace.hidden = false;
  focusNote.hidden = true;
  state.activeObject = mode === 'book' ? 'atelier' : 'hearth';
}

function selectedTemplateColor(type) {
  return { sun: palette.lime, water: palette.sky, sensor: palette.sage, fan: palette.coral }[type] || palette.gold;
}

function makeBuildBlock(type, x, z, ghost = false) {
  const group = new THREE.Group();
  const color = selectedTemplateColor(type);
  const base = block(0.96, 0.6, 0.96, color);
  base.position.y = 0.3;
  group.add(base);
  if (type === 'sun') {
    const disc = cylinder(0.27, 0.27, 0.12, 12, palette.gold);
    disc.rotation.x = Math.PI / 2;
    disc.position.set(0, 0.92, 0);
    group.add(disc);
  } else if (type === 'water') {
    const tank = cylinder(0.3, 0.3, 0.62, 10, palette.sky);
    tank.position.y = 0.94;
    group.add(tank);
  } else if (type === 'sensor') {
    const mast = block(0.12, 0.78, 0.12, palette.ink);
    mast.position.y = 0.92;
    group.add(mast);
    const eye = outlined(new THREE.SphereGeometry(0.22, 10, 8), palette.lime);
    eye.position.y = 1.38;
    group.add(eye);
  } else {
    const rotor = outlined(new THREE.TorusGeometry(0.3, 0.08, 8, 14), palette.surface);
    rotor.rotation.x = Math.PI / 2;
    rotor.position.y = 0.96;
    group.add(rotor);
  }
  group.position.set(x, 0.04, z);
  if (ghost) {
    group.traverse((child) => {
      if (child.isMesh) {
        child.material = child.material.clone();
        child.material.transparent = true;
        child.material.opacity = 0.48;
        child.material.depthWrite = false;
      }
      if (child.isLineSegments) child.material = new THREE.LineBasicMaterial({ color: palette.ink, transparent: true, opacity: 0.3 });
    });
  }
  return group;
}

let buildGhost = makeBuildBlock(state.selectedBlock, 0, 0, true);
buildGhost.visible = false;
scene.add(buildGhost);

function rebuildGhost() {
  scene.remove(buildGhost);
  buildGhost = makeBuildBlock(state.selectedBlock, 0, 0, true);
  buildGhost.visible = state.building;
  scene.add(buildGhost);
}

function placeBuild(point) {
  const x = THREE.MathUtils.clamp(Math.round(point.x), -10, 10);
  const z = THREE.MathUtils.clamp(Math.round(point.z), -8, 8);
  const placed = makeBuildBlock(state.selectedBlock, x, z);
  const id = `placed-${++state.placed}`;
  objectCopy[id] = {
    eyebrow: 'Student-built sim',
    title: `${state.selectedBlock[0].toUpperCase()}${state.selectedBlock.slice(1)} block`,
    body: 'A reusable simulation primitive in your world. Connect it to a system to make its output matter.',
    action: 'Inspect this block',
  };
  setInteractive(placed, id);
  scene.add(placed);
  state.building = false;
  buildButton.setAttribute('aria-pressed', 'false');
  canvas.classList.remove('is-building');
  buildGhost.visible = false;
  updateMission('build');
  showToast(`${objectCopy[id].title} added to your world`);
  jesseLine.textContent = 'Now connect it to something alive.';
  sound(760, 0.11);
}

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let hoverId = null;
let lastPointer = { x: 0, y: 0 };

function updatePointer(event) {
  const rect = canvas.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  lastPointer = { x: event.clientX, y: event.clientY };
  raycaster.setFromCamera(pointer, camera);
}

function intersections() {
  return raycaster.intersectObjects(scene.children, true);
}

function firstGroundHit() {
  return intersections().find((hit) => hit.object === groundHit);
}

function firstInteractiveHit() {
  return intersections().find((hit) => hit.object.userData.interactiveId);
}

canvas.addEventListener('pointermove', (event) => {
  updatePointer(event);
  const ground = firstGroundHit();
  if (state.building && ground) {
    buildGhost.visible = true;
    buildGhost.position.set(Math.round(ground.point.x), 0.04, Math.round(ground.point.z));
  }

  const hit = firstInteractiveHit();
  hoverId = hit?.object.userData.interactiveId || null;
  canvas.classList.toggle('is-hovering', Boolean(hoverId) && !state.building);
  if (hoverId && objectCopy[hoverId] && !state.building) {
    hoverEyebrow.textContent = objectCopy[hoverId].eyebrow;
    hoverTitle.textContent = objectCopy[hoverId].title;
    hoverLabel.style.left = `${Math.min(event.clientX, window.innerWidth - 170)}px`;
    hoverLabel.style.top = `${Math.min(event.clientY, window.innerHeight - 100)}px`;
    hoverLabel.hidden = false;
  } else {
    hoverLabel.hidden = true;
  }
});

canvas.addEventListener('pointerleave', () => {
  hoverLabel.hidden = true;
  hoverId = null;
  if (state.building) buildGhost.visible = false;
});

canvas.addEventListener('pointerup', (event) => {
  updatePointer(event);
  const ground = firstGroundHit();
  if (state.building && ground) {
    placeBuild(ground.point);
    return;
  }
  const interactive = firstInteractiveHit();
  const id = interactive?.object.userData.interactiveId;
  if (id) {
    openFocus(id);
    return;
  }
  if (ground) {
    closeFloatingUI();
    state.activeObject = null;
    state.cameraMode = 'player';
    avatarTarget.set(
      THREE.MathUtils.clamp(ground.point.x, -10.5, 10.5),
      0,
      THREE.MathUtils.clamp(ground.point.z, -8.5, 8.5),
    );
    sound(320, 0.04);
  }
});

nodeSlider.addEventListener('input', () => {
  const system = systems[state.activeSystem];
  if (!system || !state.activeNode) return;
  system.values[state.activeNode] = Number(nodeSlider.value);
  nodeControlValue.textContent = `${Math.round(system.values[state.activeNode])}%`;
  renderFlow(state.activeSystem);
  updateWorldFromSystems();
  if (state.activeObject) renderMetrics(state.activeObject);
});

focusAction.addEventListener('click', () => {
  const copy = objectCopy[state.activeObject];
  if (copy?.system) openFlow(copy.system);
  else if (copy?.workspace) openWorkspace(copy.workspace);
  else showToast('This block is ready for a wire');
  sound(640);
});

$('#focusClose').addEventListener('click', () => {
  focusNote.hidden = true;
  state.activeObject = null;
  state.cameraMode = 'world';
});

$('#flowClose').addEventListener('click', () => {
  flowDeck.hidden = true;
  state.activeSystem = null;
  state.activeNode = null;
  state.cameraMode = 'world';
});

document.querySelectorAll('[data-close-workspace]').forEach((button) => {
  button.addEventListener('click', () => {
    hearthWorkspace.hidden = true;
    state.cameraMode = 'world';
  });
});

curiosityForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const question = curiosityInput.value.trim();
  if (!question) return;
  const mode = hearthWorkspace.dataset.mode;
  hearthResponse.querySelector('span').textContent = mode === 'book' ? 'Next chapter move' : "Jesse's next nudge";
  hearthResponse.querySelector('p').textContent = mode === 'book'
    ? 'Choose one relationship your reader can change. That relationship becomes the chapter simulation.'
    : 'Pick one input you can measure. What would you expect to change when that input doubles?';
  const fanButton = hotbarButtons.find((button) => button.dataset.build === 'fan');
  fanButton.classList.remove('is-locked');
  fanButton.removeAttribute('aria-disabled');
  fanButton.title = 'Cooling fan';
  worldLevel.textContent = 'Level 8';
  worldBooks.textContent = '3 books';
  updateMission('question');
  showToast('Cooling fan unlocked from your learning path');
  sound(880, 0.14);
});

hotbarButtons.forEach((button) => {
  button.addEventListener('click', () => {
    if (button.classList.contains('is-locked')) {
      showToast('The Learning Hearth can unlock this block');
      sound(210);
      return;
    }
    state.selectedBlock = button.dataset.build;
    hotbarButtons.forEach((item) => {
      const active = item === button;
      item.classList.toggle('is-active', active);
      item.setAttribute('aria-pressed', String(active));
    });
    rebuildGhost();
    sound(560);
  });
});

buildButton.addEventListener('click', () => {
  state.building = !state.building;
  buildButton.setAttribute('aria-pressed', String(state.building));
  canvas.classList.toggle('is-building', state.building);
  buildGhost.visible = false;
  if (state.building) {
    closeFloatingUI();
    showToast(`${state.selectedBlock[0].toUpperCase()}${state.selectedBlock.slice(1)} block ready`);
  }
  sound(state.building ? 680 : 310);
});

$('#overviewButton').addEventListener('click', () => {
  state.cameraMode = state.cameraMode === 'overview' ? 'world' : 'overview';
  if (state.cameraMode === 'overview') {
    desiredCamera.set(0, 19, 20);
    desiredLook.set(0, 0, 0);
  }
  sound(500);
});

$('#soundButton').addEventListener('click', (event) => {
  state.sound = !state.sound;
  event.currentTarget.setAttribute('aria-pressed', String(state.sound));
  event.currentTarget.style.background = state.sound ? '' : 'var(--paper-2)';
  if (state.sound) sound(700);
});

const keys = new Set();
window.addEventListener('keydown', (event) => {
  if (event.target.matches('input')) return;
  keys.add(event.key.toLowerCase());
  if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(event.key.toLowerCase())) event.preventDefault();
  if (/^[1-4]$/.test(event.key)) hotbarButtons[Number(event.key) - 1]?.click();
  if (event.key.toLowerCase() === 'b') buildButton.click();
  if (event.key === 'Escape') {
    closeFloatingUI();
    state.building = false;
    buildButton.setAttribute('aria-pressed', 'false');
    buildGhost.visible = false;
    canvas.classList.remove('is-building');
    state.cameraMode = 'world';
  }
});
window.addEventListener('keyup', (event) => keys.delete(event.key.toLowerCase()));

canvas.addEventListener('wheel', (event) => {
  event.preventDefault();
  state.cameraZoom = THREE.MathUtils.clamp(state.cameraZoom + Math.sign(event.deltaY) * 0.08, 0.72, 1.45);
}, { passive: false });

function resize() {
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  renderer.setSize(width, height, false);
  camera.aspect = width / Math.max(1, height);
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

const clock = new THREE.Clock();

function updateAvatar(delta, elapsed) {
  const movement = new THREE.Vector3();
  if (keys.has('w') || keys.has('arrowup')) movement.z -= 1;
  if (keys.has('s') || keys.has('arrowdown')) movement.z += 1;
  if (keys.has('a') || keys.has('arrowleft')) movement.x -= 1;
  if (keys.has('d') || keys.has('arrowright')) movement.x += 1;
  if (movement.lengthSq() > 0) {
    movement.normalize();
    avatarTarget.copy(avatar.position).addScaledVector(movement, delta * 4.2);
    avatarTarget.x = THREE.MathUtils.clamp(avatarTarget.x, -10.5, 10.5);
    avatarTarget.z = THREE.MathUtils.clamp(avatarTarget.z, -8.5, 8.5);
    state.cameraMode = 'player';
  }

  const toTarget = avatarTarget.clone().sub(avatar.position);
  const moving = toTarget.lengthSq() > 0.003;
  if (moving) {
    const step = Math.min(toTarget.length(), delta * 3.2);
    avatar.position.addScaledVector(toTarget.normalize(), step);
    avatar.rotation.y = Math.atan2(toTarget.x, toTarget.z);
  }
  const swing = moving ? Math.sin(elapsed * 10) * 0.52 : 0;
  const limbs = avatar.userData.limbs;
  limbs.leftArmPivot.rotation.x = swing;
  limbs.rightArmPivot.rotation.x = -swing;
  limbs.leftLegPivot.rotation.x = -swing;
  limbs.rightLegPivot.rotation.x = swing;
  avatar.position.y = moving ? Math.abs(Math.sin(elapsed * 10)) * 0.04 : 0;
}

function updateCamera() {
  if (state.cameraMode === 'world') {
    desiredLook.set(0, 0.7, -0.7);
    desiredCamera.set(13, 12, 16).multiplyScalar(state.cameraZoom);
  } else if (state.cameraMode === 'player') {
    desiredLook.copy(avatar.position).add(new THREE.Vector3(0, 0.9, -1.4));
    desiredCamera.copy(avatar.position).add(new THREE.Vector3(8.5, 8.3, 10.5).multiplyScalar(state.cameraZoom));
  } else if (state.cameraMode === 'overview') {
    desiredCamera.set(0, 19, 20).multiplyScalar(state.cameraZoom);
    desiredLook.set(0, 0, -0.6);
  }
  camera.position.lerp(desiredCamera, 0.055);
  cameraLook.lerp(desiredLook, 0.07);
  camera.lookAt(cameraLook);
}

function animateWorld(elapsed) {
  const flames = hearth.userData.flames;
  flames.rotation.y = Math.sin(elapsed * 2.2) * 0.12;
  flames.scale.y = 0.96 + Math.sin(elapsed * 5.3) * 0.06;
  garden.userData.plant.rotation.z = Math.sin(elapsed * 1.4) * 0.018;
  dataCenter.userData.fans.forEach((fan, index) => {
    fan.rotation.z = elapsed * (index ? -1.8 : 1.8);
  });
  clouds.forEach((cloud, index) => {
    cloud.position.x += 0.0015 * (index + 1);
    if (cloud.position.x > 15) cloud.position.x = -15;
  });
}

function frame() {
  const delta = Math.min(clock.getDelta(), 0.05);
  const elapsed = clock.elapsedTime;
  updateAvatar(delta, elapsed);
  updateCamera();
  animateWorld(elapsed);
  updateWorldFromSystems();
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

updateWorldFromSystems();
requestAnimationFrame(frame);

window.setTimeout(() => {
  loading.classList.add('is-gone');
  jesseLine.textContent = 'Your garden kept growing.';
}, 700);

window.mindcraftWorld = {
  scene,
  camera,
  renderer,
  avatar,
  systems,
  openObject: openFocus,
  openFlow,
  place(type, x, z) {
    state.selectedBlock = type;
    placeBuild(new THREE.Vector3(x, 0, z));
  },
};
