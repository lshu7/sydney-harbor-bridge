import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { SSAOPass } from 'three/examples/jsm/postprocessing/SSAOPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import './style.css';

const DURATION = 165;
const chapters = [
  { start: 0, end: 8, short: '序章', date: '1923 · 悉尼港', title: '从港湾两岸开始', copy: '没有 GPS、塔吊或计算机模型。工程师依靠几何测量、钢缆、铆钉，以及两台会沿拱架前进的巨型吊机。', fact: ['503 m', '主拱跨度'] },
  { start: 8, end: 18, short: '两岸基础', date: '1923—1928 · 基础工程', title: '把重量交给砂岩', copy: '工人先开挖两岸基础和引桥。花岗岩桥塔主要塑造轮廓，真正承受主拱推力的是两岸砂岩基础与钢制拱脚支座。', fact: ['4 座', '花岗岩外饰桥塔'] },
  { start: 18, end: 47, short: '岩层锚固', date: '1928 · 临时锚固系统', title: '先把半座桥拴住', copy: '完整拱形成之前，每一侧都是伸向港湾的巨大悬臂。高强钢丝绳越过鞍座，穿入岸后的砂岩锚固隧道，用拉力抵抗半拱向海中倾覆的趋势。', fact: ['128 根/侧', '史料所载临时钢丝绳'] },
  { start: 47, end: 93, short: '悬臂架拱', date: '1928—1930 · 主拱架设', title: '吊机沿着桥向前爬', copy: '驳船把预制钢构件运到下方，两台爬行吊机逐段吊装、铆接。每伸出一步，半拱就更重——临时钢缆始终把它拉住。', fact: ['约 580 t', '每台爬行吊机自重'] },
  { start: 93, end: 118, short: '拱顶合拢', date: '1930.08.19 · 港湾中央', title: '让两座悬臂成为一座拱', copy: '液压设备细调钢缆张力，让两侧半拱落到设计位置。中央节点接合后，荷载改由完整拱肋以压力传向两岸，钢缆不再受力。', fact: ['22:00', '两半拱首次接触'] },
  { start: 118, end: 144, short: '吊装桥面', date: '1930—1931 · 桥面工程', title: '吊机转身铺设桥面', copy: '主拱自承后，临时钢缆逐步卸载。爬行吊机向两岸返回，同时安装垂直吊杆、横梁，以及承载铁路、公路和人行道的桥面。', fact: ['52,800 t', '大桥钢材约重'] },
  { start: 144, end: 158, short: '荷载试验', date: '1932.02 · 开放前测试', title: '用蒸汽机车压满桥面', copy: '正式开放前，96 台蒸汽机车被排满四条铁路轨道。工程师记录结构在重载下的挠度，核对桥梁是否符合设计预期。', fact: ['96 台', '蒸汽机车参与测试'] },
  { start: 158, end: 165.01, short: '开放通行', date: '1932.03.19 · 正式开放', title: '钢缆退场，拱桥留下', copy: '临时锚固系统完成使命后被拆除。建造时期的吊机、驳船和脚手架消失，503 米钢拱成为悉尼港的新地标。', fact: ['8 年', '主体工程历时约'] }
];

function splitSentences(text) {
  const matches = text.match(/[^。！？；]*[。！？；]?/g) || [text];
  return matches.map((s) => s.trim()).filter(Boolean);
}
chapters.forEach((chapter) => { chapter.sentences = splitSentences(chapter.copy); });

const $ = (selector) => document.querySelector(selector);
const clamp = (v, min = 0, max = 1) => Math.min(max, Math.max(min, v));
const smooth = (v) => { const n = clamp(v); return n * n * (3 - 2 * n); };
const range = (t, a, b) => smooth((t - a) / (b - a));
const formatTime = (value) => `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(Math.floor(value % 60)).padStart(2, '0')}`;

let scene;
let camera;
let renderer;
let controls;
let composer = null;
let clock;
let currentTime = 0;
let lastFrame = 0;
let playing = false;
let speed = 2;
let freeCamera = false;
let forceMode = true;
let activeChapter = -1;

const objects = {
  archLeft: [], archRight: [], deckLeft: [], deckRight: [],
  archPivotLeft: null, archPivotRight: null,
  cranes: [], barges: [], cables: [], cableCurves: [], cableMarkers: [],
  archFlowCurves: [], archFlowMarkers: [],
  tensionArrows: [], weightArrow: null, thrustArrows: [],
  tunnel: null, cableCutaway: null, foundationDetail: null, pylons: null,
  trains: null, water: null, waterMat: null, ghost: null,
  constructionLights: [], crownSpark: null
};

const materials = {};
const cableColorRed = new THREE.Color(0xff5a3a);
const cableColorSlack = new THREE.Color(0x5f7076);
const cableEmissiveRed = new THREE.Color(0xff2a10);
const cableEmissiveSlack = new THREE.Color(0x0a0d0e);
const temp = {
  v1: new THREE.Vector3(), v2: new THREE.Vector3(), projected: new THREE.Vector3()
};

const ui = {
  timeline: $('#timeline'), progress: $('#timeline-progress'), current: $('#current-time'),
  play: $('#play-toggle'), speed: $('#speed'), restart: $('#restart'),
  title: $('#stage-title'), copy: $('#subtitle'), date: $('#stage-date'),
  factValue: $('#fact-value'), factLabel: $('#fact-label'), chapterIndex: $('#chapter-index'),
  force: $('#force-toggle'), camera: $('#camera-toggle'), legend: $('#force-legend'),
  info: $('#info-panel'), infoToggle: $('#info-toggle'), infoClose: $('#info-close'),
  scrim: $('#scrim'), fullscreen: $('#fullscreen'),
  startGate: $('#start-gate'), start: $('#start-demo'),
  anchorRoute: $('#anchor-route'), principleCallout: $('#principle-callout'), tipWarning: $('#tip-warning')
};

function cylinderBetween(a, b, radius, material, radialSegments = 8) {
  const start = a instanceof THREE.Vector3 ? a : new THREE.Vector3(...a);
  const end = b instanceof THREE.Vector3 ? b : new THREE.Vector3(...b);
  const delta = temp.v1.copy(end).sub(start);
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, delta.length(), radialSegments), material);
  mesh.position.copy(start).add(end).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize());
  return mesh;
}

function addMember(parent, a, b, radius, material, opts = {}) {
  const mesh = cylinderBetween(a, b, radius, material, opts.segments || 7);
  mesh.castShadow = opts.shadow !== false;
  mesh.receiveShadow = opts.receive !== false;
  parent.add(mesh);
  return mesh;
}

function addBox(parent, size, position, material, rotation = null) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
  mesh.position.set(...position);
  if (rotation) mesh.rotation.set(...rotation);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function makeArrow(from, to, color, headLength = 5, headWidth = 2.2) {
  const dir = new THREE.Vector3().subVectors(to, from);
  const length = dir.length();
  dir.normalize();
  return new THREE.ArrowHelper(dir, from, length, color, headLength, headWidth);
}

// Variable-depth arch: deeper near the supports, shallower at the crown.
function archY(x, upper = false) {
  const n = clamp(1 - (x / 252) ** 2);
  const lower = 27 + 80 * n;
  const depth = 9 + 6 * (1 - n);
  return upper ? lower + depth : lower;
}

function makeGrainTexture(size = 256, base = 150, spread = 46) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(size, size);
  for (let i = 0; i < size * size; i++) {
    const v = base + (Math.random() * 2 - 1) * spread;
    img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v;
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function makeMaterials() {
  const steelGrain = makeGrainTexture(256, 168, 30);
  steelGrain.repeat.set(4, 4);
  const stoneGrain = makeGrainTexture(256, 150, 52);
  stoneGrain.repeat.set(3, 3);

  materials.steel = new THREE.MeshStandardMaterial({ color: 0x45545b, roughness: 0.5, metalness: 0.85, roughnessMap: steelGrain });
  materials.steelDark = new THREE.MeshStandardMaterial({ color: 0x27363c, roughness: 0.55, metalness: 0.82, roughnessMap: steelGrain });
  materials.steelGhost = new THREE.LineBasicMaterial({ color: 0x9fb4b4, transparent: true, opacity: 0.14, depthWrite: false });
  materials.stone = new THREE.MeshStandardMaterial({ color: 0x8c846e, roughness: 0.92, roughnessMap: stoneGrain, bumpMap: stoneGrain, bumpScale: 0.018 });
  materials.stoneDark = new THREE.MeshStandardMaterial({ color: 0x4e4a3e, roughness: 1, roughnessMap: stoneGrain });
  materials.land = new THREE.MeshStandardMaterial({ color: 0x1b2c2a, roughness: 1 });
  materials.earth = new THREE.MeshStandardMaterial({ color: 0x6d5940, roughness: 1 });
  materials.crane = new THREE.MeshStandardMaterial({ color: 0xc08c3e, roughness: 0.55, metalness: 0.6, roughnessMap: steelGrain });
  materials.craneDark = new THREE.MeshStandardMaterial({ color: 0x5f4c30, roughness: 0.7, metalness: 0.4 });
  materials.deck = new THREE.MeshStandardMaterial({ color: 0x303d42, roughness: 0.72, metalness: 0.6, roughnessMap: steelGrain });
  materials.rail = new THREE.MeshStandardMaterial({ color: 0x9aa4a0, roughness: 0.35, metalness: 0.85 });
  materials.cable = new THREE.MeshStandardMaterial({ color: 0xff5a3a, emissive: 0xff2a10, emissiveIntensity: 1.7, roughness: 0.4, metalness: 0.4, transparent: true, opacity: 1, depthTest: false });
  materials.cableMarker = new THREE.MeshBasicMaterial({ color: 0xffd0a0, transparent: true, opacity: 1, depthTest: false });
  materials.flowMarker = new THREE.MeshBasicMaterial({ color: 0x7fd4e8, transparent: true, opacity: 0.95, depthTest: false });
  materials.tunnel = new THREE.MeshStandardMaterial({ color: 0xf1bd62, emissive: 0x704214, emissiveIntensity: 0.9, roughness: 0.6, depthTest: false });
  materials.train = new THREE.MeshStandardMaterial({ color: 0x161d1e, roughness: 0.5, metalness: 0.7 });
  materials.trainTrim = new THREE.MeshStandardMaterial({ color: 0x7b2f25, roughness: 0.6, metalness: 0.4 });
}

function createWater() {
  const geometry = new THREE.PlaneGeometry(1100, 650, 90, 50);
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uDeep: { value: new THREE.Color(0x0e2a36) },
      uShallow: { value: new THREE.Color(0x2f6e80) },
      uLight: { value: new THREE.Color(0x8ab0ae) }
    },
    vertexShader: `
      uniform float uTime;
      varying float vWave;
      varying vec3 vWorld;
      void main() {
        vec3 p = position;
        float w = sin(p.x * .032 + uTime * .55) * 1.1;
        w += sin(p.y * .051 - uTime * .72) * .55;
        w += sin((p.x + p.y) * .018 + uTime * .32) * .7;
        p.z += w;
        vWave = w;
        vec4 world = modelMatrix * vec4(p, 1.0);
        vWorld = world.xyz;
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,
    fragmentShader: `
      uniform vec3 uDeep;
      uniform vec3 uShallow;
      uniform vec3 uLight;
      varying float vWave;
      varying vec3 vWorld;
      void main() {
        float bands = smoothstep(-1.2, 1.7, vWave);
        float glint = pow(max(0.0, sin(vWorld.x * .055 + vWorld.z * .08)), 16.0) * .28;
        vec3 col = mix(uDeep, uShallow, bands * .55) + uLight * glint;
        gl_FragColor = vec4(col, .95);
      }
    `,
    transparent: true,
    side: THREE.DoubleSide
  });
  const water = new THREE.Mesh(geometry, material);
  water.rotation.x = -Math.PI / 2;
  water.position.y = 0;
  scene.add(water);
  objects.water = water;
  objects.waterMat = material;
}

function createEnvironment() {
  const land = new THREE.Group();
  addBox(land, [360, 28, 650], [-430, -11, 0], materials.land);
  addBox(land, [360, 28, 650], [430, -11, 0], materials.land);
  addBox(land, [95, 9, 110], [-298, 0, 0], materials.earth);
  addBox(land, [95, 9, 110], [298, 0, 0], materials.earth);
  scene.add(land);

  // Recessed, sparse skyline so the bridge stays the focus.
  const city = new THREE.Group();
  const buildingMat = new THREE.MeshStandardMaterial({ color: 0x1d2b2d, roughness: 1 });
  for (const side of [-1, 1]) {
    for (let i = 0; i < 16; i++) {
      const w = 12 + (i * 7 % 19);
      const h = 16 + (i * 19 % 58);
      const d = 12 + (i * 11 % 22);
      const x = side * (340 + (i * 37 % 210));
      const z = -230 + (i * 53 % 460);
      addBox(city, [w, h, d], [x, h / 2 + 3, z], buildingMat);
    }
  }
  scene.add(city);

  const stars = new THREE.BufferGeometry();
  const points = [];
  for (let i = 0; i < 200; i++) {
    const theta = Math.random() * Math.PI * 2;
    const r = 460 + Math.random() * 380;
    points.push(Math.cos(theta) * r, 120 + Math.random() * 300, Math.sin(theta) * r);
  }
  stars.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
  scene.add(new THREE.Points(stars, new THREE.PointsMaterial({ color: 0xbccdcc, size: .7, transparent: true, opacity: .42 })));
}

function createPylons() {
  const group = new THREE.Group();
  for (const x of [-277, 277]) {
    for (const z of [-20, 20]) {
      addBox(group, [19, 63, 19], [x, 31.5, z], materials.stone);
      addBox(group, [23, 4, 23], [x, 63, z], materials.stoneDark);
      addBox(group, [15, 8, 15], [x, 69, z], materials.stone);
      addBox(group, [21, 3, 21], [x, 74, z], materials.stoneDark);
    }
    addBox(group, [18, 9, 50], [x, 8, 0], materials.stoneDark);
  }
  scene.add(group);
  objects.pylons = group;
}

function createFoundationDetail() {
  const group = new THREE.Group();
  const concrete = new THREE.MeshStandardMaterial({ color: 0x9c927a, roughness: .94 });
  const bearing = new THREE.MeshStandardMaterial({ color: 0xc58b43, roughness: .35, metalness: .8 });
  addBox(group, [76, 7, 58], [-277, 2, 0], concrete);
  addBox(group, [58, 8, 43], [-264, 8.5, 0], materials.stoneDark);
  addBox(group, [34, 5, 34], [-253, 15, 0], concrete);
  const pin = new THREE.Mesh(new THREE.CylinderGeometry(7, 7, 30, 18), bearing);
  pin.rotation.x = Math.PI / 2;
  pin.position.set(-252, 22, 0);
  pin.castShadow = true;
  group.add(pin);
  for (const z of [-12, 12]) {
    group.add(cylinderBetween([-258, 27, z], [-246, 27, z], 1.7, bearing, 10));
    group.add(cylinderBetween([-258, 27, z], [-252, 20, z], 1.1, materials.steelDark, 8));
  }
  const tripodTop = new THREE.Vector3(-315, 24, 24);
  for (const dx of [-5, 0, 5]) group.add(cylinderBetween(tripodTop, [-315 + dx, 7, 24 + dx * .35], .22, bearing, 6));
  addBox(group, [4, 3, 3], [-315, 25.5, 24], bearing);
  const light = new THREE.PointLight(0xf0aa58, 0, 90, 2);
  light.position.set(-270, 44, 35);
  group.add(light);
  group.userData.light = light;
  group.visible = false;
  scene.add(group);
  objects.foundationDetail = group;
}

function createGhostArch() {
  const group = new THREE.Group();
  for (const z of [-11, 11]) {
    for (const upper of [false, true]) {
      const pts = [];
      for (let i = 0; i <= 56; i++) {
        const x = -252 + i * 9;
        pts.push(new THREE.Vector3(x, archY(x, upper), z));
      }
      const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), materials.steelGhost);
      group.add(line);
    }
  }
  scene.add(group);
  objects.ghost = group;
}

// One panel of the lattice truss arch. Each panel has two longitudinal
// trusses (z = ±11) connected by top and bottom lateral bracing.
function createArchPanel(x0, x1, parent) {
  const group = new THREE.Group();
  for (const z of [-11, 11]) {
    const L0 = new THREE.Vector3(x0, archY(x0, false), z);
    const L1 = new THREE.Vector3(x1, archY(x1, false), z);
    const U0 = new THREE.Vector3(x0, archY(x0, true), z);
    const U1 = new THREE.Vector3(x1, archY(x1, true), z);
    addMember(group, L0, L1, 1.12, materials.steel, { segments: 8 });
    addMember(group, U0, U1, 0.95, materials.steel, { segments: 8 });
    addMember(group, L1, U1, 0.5, materials.steelDark, { segments: 6, shadow: false });
    addMember(group, L0, U1, 0.42, materials.steelDark, { segments: 6, shadow: false });
    addMember(group, U0, L1, 0.42, materials.steelDark, { segments: 6, shadow: false });
  }
  const lowerA = new THREE.Vector3(x1, archY(x1, false), -11);
  const lowerB = new THREE.Vector3(x1, archY(x1, false), 11);
  const upperA = new THREE.Vector3(x1, archY(x1, true), -11);
  const upperB = new THREE.Vector3(x1, archY(x1, true), 11);
  addMember(group, lowerA, lowerB, 0.48, materials.steelDark, { segments: 6, shadow: false });
  addMember(group, upperA, upperB, 0.4, materials.steelDark, { segments: 6, shadow: false });
  group.visible = false;
  parent.add(group);
  return group;
}

function createArch() {
  const panels = 18;
  const step = 252 / panels;
  const buildPivot = (side) => {
    const pivot = new THREE.Group();
    const px = side * 252, py = 27, pz = 0;
    pivot.position.set(px, py, pz);
    const inner = new THREE.Group();
    inner.position.set(-px, -py, -pz);
    pivot.add(inner);
    scene.add(pivot);
    return { pivot, inner };
  };
  const left = buildPivot(-1);
  const right = buildPivot(1);
  objects.archPivotLeft = left.pivot;
  objects.archPivotRight = right.pivot;

  for (let i = 0; i < panels; i++) {
    objects.archLeft.push(createArchPanel(-252 + i * step, -252 + (i + 1) * step, left.inner));
    objects.archRight.push(createArchPanel(252 - i * step, 252 - (i + 1) * step, right.inner));
  }
  // Starter verticals at each springing point.
  addMember(left.inner, [-252, archY(-252, false), -11], [-252, archY(-252, true), -11], 0.5, materials.steelDark, { shadow: false });
  addMember(left.inner, [-252, archY(-252, false), 11], [-252, archY(-252, true), 11], 0.5, materials.steelDark, { shadow: false });
  addMember(right.inner, [252, archY(252, false), -11], [252, archY(252, true), -11], 0.5, materials.steelDark, { shadow: false });
  addMember(right.inner, [252, archY(252, false), 11], [252, archY(252, true), 11], 0.5, materials.steelDark, { shadow: false });
}

function createCableSystem() {
  const cableGroup = new THREE.Group();
  for (const side of [-1, 1]) {
    for (let i = 0; i < 7; i++) {
      const z = 10 + i * 1.7;
      const points = [
        new THREE.Vector3(side * 225, 43 + i * .2, z),
        new THREE.Vector3(side * 272, 71 + i * .12, z),
        new THREE.Vector3(side * 313, 14, z),
        new THREE.Vector3(side * 345, -8, z),
        new THREE.Vector3(side * 380, 3, z)
      ];
      const curve = new THREE.CatmullRomCurve3(points);
      const cable = new THREE.Mesh(new THREE.TubeGeometry(curve, 72, .42, 7, false), materials.cable);
      cable.renderOrder = 7;
      cableGroup.add(cable);
      objects.cables.push(cable);
      objects.cableCurves.push(curve);
      if (i === 3) {
        objects[side === -1 ? 'refCurveLeft' : 'refCurveRight'] = curve;
        for (let n = 0; n < 6; n++) {
          const marker = new THREE.Mesh(new THREE.SphereGeometry(1.15, 10, 8), materials.cableMarker);
          marker.renderOrder = 8;
          marker.userData = { curve, offset: n / 6 };
          cableGroup.add(marker);
          objects.cableMarkers.push(marker);
        }
      }
    }
  }
  scene.add(cableGroup);

  const tunnelGroup = new THREE.Group();
  const cutaway = new THREE.Group();
  const cutMat = new THREE.MeshBasicMaterial({ color: 0x382c20, transparent: true, opacity: .78, depthWrite: false });
  for (const side of [-1, 1]) {
    const z = 15;
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(side * 313, 12, z),
      new THREE.Vector3(side * 342, -10, z),
      new THREE.Vector3(side * 375, -10, z),
      new THREE.Vector3(side * 391, 5, z)
    ]);
    const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 42, 2.3, 10, false), materials.tunnel);
    tube.renderOrder = 5;
    tunnelGroup.add(tube);
    const panel = addBox(cutaway, [92, 35, 2], [side * 350, -3, 8], cutMat);
    panel.renderOrder = 1;
    const edgeMat = new THREE.LineBasicMaterial({ color: 0xb59a6c, transparent: true, opacity: .7, depthTest: false });
    const edge = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(92, 35, 2)), edgeMat);
    edge.position.set(side * 350, -3, 9.1);
    edge.renderOrder = 4;
    cutaway.add(edge);
  }
  scene.add(cutaway);
  scene.add(tunnelGroup);
  objects.tunnel = tunnelGroup;
  objects.cableCutaway = cutaway;
}

function createArchFlow() {
  const group = new THREE.Group();
  for (const side of [-1, 1]) {
    const pts = [];
    for (let i = 0; i <= 30; i++) {
      const x = side * i * (252 / 30);
      pts.push(new THREE.Vector3(x, archY(x, false), side * 11));
    }
    const curve = new THREE.CatmullRomCurve3(pts);
    objects.archFlowCurves.push(curve);
    for (let n = 0; n < 8; n++) {
      const marker = new THREE.Mesh(new THREE.SphereGeometry(0.95, 10, 8), materials.flowMarker);
      marker.renderOrder = 6;
      marker.userData = { curve, offset: n / 8 };
      group.add(marker);
      objects.archFlowMarkers.push(marker);
    }
  }
  scene.add(group);
}

function createForceArrows() {
  const tensionGroup = new THREE.Group();
  for (const side of [-1, 1]) {
    const curve = objects[side === -1 ? 'refCurveLeft' : 'refCurveRight'];
    if (!curve) continue;
    for (let k = 0; k < 3; k++) {
      const p = curve.getPoint(0.5 + k * 0.14);
      const arrow = makeArrow(p, new THREE.Vector3(p.x + side * 17, p.y - 4, p.z), 0xff6a45, 5, 2.4);
      tensionGroup.add(arrow);
      objects.tensionArrows.push(arrow);
    }
  }
  tensionGroup.visible = false;
  scene.add(tensionGroup);

  const weight = makeArrow(new THREE.Vector3(0, 116, 0), new THREE.Vector3(0, 86, 0), 0xffb44a, 7, 3);
  weight.visible = false;
  scene.add(weight);
  objects.weightArrow = weight;

  const thrustGroup = new THREE.Group();
  for (const side of [-1, 1]) {
    const arrow = makeArrow(
      new THREE.Vector3(side * 252, 31, 0),
      new THREE.Vector3(side * 252 + side * 30, 19, 0),
      0x5bb7d0, 7, 3
    );
    thrustGroup.add(arrow);
    objects.thrustArrows.push(arrow);
  }
  thrustGroup.visible = false;
  scene.add(thrustGroup);
}

function createCrane(side) {
  const group = new THREE.Group();
  const base = new THREE.Group();
  addBox(base, [25, 3.5, 25], [0, 1.75, 0], materials.craneDark);
  addBox(base, [17, 3, 18], [0, 4.8, 0], materials.crane);
  for (const z of [-8, 8]) {
    base.add(cylinderBetween([-7, 6, z], [-3, 23, z], .65, materials.crane));
    base.add(cylinderBetween([7, 6, z], [3, 23, z], .65, materials.crane));
    base.add(cylinderBetween([-3, 23, z], [3, 23, z], .65, materials.crane));
  }
  const inward = -side;
  base.add(cylinderBetween([0, 23, -8], [0, 23, 8], .8, materials.craneDark));
  base.add(cylinderBetween([0, 23, 0], [inward * 28, 18, 0], 1, materials.crane));
  base.add(cylinderBetween([inward * 8, 22, 0], [inward * 28, 18, 0], .42, materials.craneDark));
  addBox(base, [7, 6, 7], [side * 6, 20, 0], materials.craneDark);

  const hookMaterial = new THREE.LineBasicMaterial({ color: 0xd6c79a });
  const hookGeometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
  const hook = new THREE.Line(hookGeometry, hookMaterial);
  base.add(hook);
  group.add(base);
  group.userData = { side, hook };
  scene.add(group);
  objects.cranes.push(group);
  return group;
}

function createBarge(side) {
  const group = new THREE.Group();
  addBox(group, [48, 4, 18], [0, 2.1, 0], materials.steelDark);
  addBox(group, [28, 1.5, 13], [0, 4.7, 0], materials.earth);
  addBox(group, [15, 2, 3], [0, 6, 0], materials.steel);
  group.userData.side = side;
  scene.add(group);
  objects.barges.push(group);
  return group;
}

function createDeckSegment(x0, x1) {
  const group = new THREE.Group();
  const mid = (x0 + x1) / 2;
  const width = Math.abs(x1 - x0) + .4;
  addBox(group, [width, 2.2, 32], [mid, 49.8, 0], materials.deck);
  for (const z of [-7, -2.3, 2.3, 7]) addBox(group, [width, .28, .32], [mid, 51.15, z], materials.rail);
  const y = archY(mid, false);
  if (y > 53) {
    group.add(cylinderBetween([mid, 51, -11], [mid, y, -11], .32, materials.steelDark, 6));
    group.add(cylinderBetween([mid, 51, 11], [mid, y, 11], .32, materials.steelDark, 6));
  }
  group.visible = false;
  scene.add(group);
  return group;
}

function createDeck() {
  const panels = 14;
  const step = 252 / panels;
  for (let i = 0; i < panels; i++) {
    objects.deckLeft.push(createDeckSegment(-252 + i * step, -252 + (i + 1) * step));
    objects.deckRight.push(createDeckSegment(252 - i * step, 252 - (i + 1) * step));
  }
  addBox(scene, [95, 2.2, 32], [-299, 49.8, 0], materials.deck);
  addBox(scene, [95, 2.2, 32], [299, 49.8, 0], materials.deck);
}

function createTrainUnit(x, z) {
  const group = new THREE.Group();
  addBox(group, [10, 3.2, 3.1], [x, 53.4, z], materials.trainTrim);
  addBox(group, [7, 4.2, 3], [x - 1, 56.6, z], materials.train);
  const boiler = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.15, 5.8, 10), materials.train);
  boiler.rotation.z = Math.PI / 2;
  boiler.position.set(x + 4.3, 56.1, z);
  boiler.castShadow = true;
  group.add(boiler);
  const stack = new THREE.Mesh(new THREE.CylinderGeometry(.28, .55, 2.1, 8), materials.train);
  stack.position.set(x + 6.1, 58.2, z);
  group.add(stack);
  for (const dx of [-3.5, 0, 3.5]) {
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(.72, .72, 3.5, 12), materials.steelDark);
    wheel.rotation.x = Math.PI / 2;
    wheel.position.set(x + dx, 52.3, z);
    group.add(wheel);
  }
  return group;
}

function createTrains() {
  const group = new THREE.Group();
  for (const z of [-7, -2.3, 2.3, 7]) {
    for (let i = 0; i < 10; i++) group.add(createTrainUnit(-180 + i * 40, z));
  }
  group.visible = false;
  scene.add(group);
  objects.trains = group;
}

function createConstructionLights() {
  for (const x of [-230, -170, -110, -50, 50, 110, 170, 230]) {
    const light = new THREE.PointLight(0xe7aa5b, 0, 36, 2);
    light.position.set(x, archY(x, true) + 4, x < 0 ? -10 : 10);
    scene.add(light);
    objects.constructionLights.push(light);
  }
  const spark = new THREE.PointLight(0xffb05e, 0, 85, 2);
  spark.position.set(0, archY(0, true), 0);
  scene.add(spark);
  objects.crownSpark = spark;
}

function buildScene() {
  makeMaterials();
  createWater();
  createEnvironment();
  createPylons();
  createFoundationDetail();
  createGhostArch();
  createArch();
  createArchFlow();
  createCableSystem();
  createForceArrows();
  createCrane(-1);
  createCrane(1);
  createBarge(-1);
  createBarge(1);
  createDeck();
  createTrains();
  createConstructionLights();
}

function setupPostprocessing() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const ssao = new SSAOPass(scene, camera, w, h);
  ssao.kernelRadius = 6;
  ssao.minDistance = 0.001;
  ssao.maxDistance = 0.06;
  composer.addPass(ssao);
  const bloom = new UnrealBloomPass(new THREE.Vector2(w, h), 0.55, 0.6, 0.72);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
}

function setupThree() {
  try {
    renderer = new THREE.WebGLRenderer({ canvas: $('#scene'), antialias: true, powerPreference: 'high-performance' });
  } catch (error) {
    $('#webgl-error').hidden = false;
    throw error;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x10242e);
  scene.fog = new THREE.FogExp2(0x0e2229, 0.0015);

  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.55;

  camera = new THREE.PerspectiveCamera(43, window.innerWidth / window.innerHeight, 0.5, 1700);
  camera.position.set(0, 118, 335);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.055;
  controls.minDistance = 85;
  controls.maxDistance = 620;
  controls.maxPolarAngle = Math.PI * .48;
  controls.target.set(0, 60, 0);
  controls.addEventListener('start', () => {
    if (!freeCamera) {
      freeCamera = true;
      ui.camera.setAttribute('aria-pressed', 'true');
    }
  });

  scene.add(new THREE.HemisphereLight(0x9fc0ca, 0x17241f, 1.0));
  const moon = new THREE.DirectionalLight(0xd7e7df, 2.5);
  moon.position.set(-220, 310, 150);
  moon.castShadow = true;
  moon.shadow.mapSize.set(2048, 2048);
  moon.shadow.camera.left = -360;
  moon.shadow.camera.right = 360;
  moon.shadow.camera.top = 260;
  moon.shadow.camera.bottom = -80;
  scene.add(moon);
  const warm = new THREE.DirectionalLight(0xffb869, .8);
  warm.position.set(320, 120, -220);
  scene.add(warm);

  buildScene();
  try {
    setupPostprocessing();
  } catch (error) {
    console.warn('Post-processing unavailable, falling back to direct render.', error);
    composer = null;
  }
  clock = new THREE.Clock();
  window.addEventListener('resize', onResize);
}

const cameraShots = [
  { start: 0, end: 8, pos: [0, 116, 335], target: [0, 58, 0] },
  { start: 8, end: 18, pos: [-340, 75, 150], target: [-275, 24, 0] },
  { start: 18, end: 47, pos: [-356, 34, 82], target: [-313, 18, 15] },
  { start: 47, end: 93, pos: [-155, 112, 250], target: [-20, 63, 0] },
  { start: 93, end: 118, pos: [0, 128, 205], target: [0, 93, 0] },
  { start: 118, end: 144, pos: [175, 96, 230], target: [20, 59, 0] },
  { start: 144, end: 158, pos: [-150, 73, 150], target: [0, 51, 0] },
  { start: 158, end: 165.01, pos: [0, 112, 320], target: [0, 56, 0] }
];

function updateCamera(t) {
  if (freeCamera) return;
  const index = chapters.findIndex((chapter) => t >= chapter.start && t < chapter.end);
  const current = cameraShots[Math.max(index, 0)];
  const next = cameraShots[Math.min(index + 1, cameraShots.length - 1)];
  const transitionStart = Math.max(current.start, current.end - 3.2);
  const mix = smooth((t - transitionStart) / Math.max(.01, current.end - transitionStart));
  const drift = Math.sin(t * .065) * 4;
  temp.v1.fromArray(current.pos).lerp(temp.v2.fromArray(next.pos), mix);
  temp.v1.x += drift;
  camera.position.lerp(temp.v1, .045);
  temp.v1.fromArray(current.target).lerp(temp.v2.fromArray(next.target), mix);
  controls.target.lerp(temp.v1, .05);
}

// Piecewise erection: build to 65%, hold for the "what-if" beat, then finish.
function erectionProgress(t) {
  if (t <= 47) return 0;
  if (t <= 69) return range(t, 47, 69) * 0.65;
  if (t <= 83) return 0.65;
  return 0.65 + range(t, 83, 93) * 0.35;
}

function updateConstruction(t) {
  const intro = t < 8;
  const erection = erectionProgress(t);
  const deckBuild = range(t, 118, 142);
  const whatIfWindow = t >= 71 && t < 82;
  const whatIfK = whatIfWindow ? clamp((t - 71) / 11) : 0;
  const whatIfPulse = Math.sin(Math.PI * whatIfK);

  let cableOpacity = range(t, 19, 25) * (1 - range(t, 111, 125));
  cableOpacity *= (1 - whatIfPulse * 0.85);
  const cableVisible = cableOpacity > .02;
  const slack = range(t, 103, 113);
  const tension = 1 - slack;

  objects.pylons.visible = intro || t >= 8;
  objects.foundationDetail.visible = t >= 8 && t < 21;
  objects.foundationDetail.userData.light.intensity = objects.foundationDetail.visible ? 2.4 : 0;
  objects.ghost.visible = !intro && t < 158;
  materials.steelGhost.opacity = t > 93 ? .08 : .15;

  objects.archLeft.forEach((group, i) => { group.visible = intro || erection >= i / objects.archLeft.length; });
  objects.archRight.forEach((group, i) => { group.visible = intro || erection >= i / objects.archRight.length; });
  objects.deckLeft.forEach((group, i) => { group.visible = intro || deckBuild >= i / objects.deckLeft.length; });
  objects.deckRight.forEach((group, i) => { group.visible = intro || deckBuild >= i / objects.deckRight.length; });

  // Tipping demonstration: without cables the half-arch rotates into the harbour.
  const tilt = whatIfPulse * 0.09;
  objects.archPivotLeft.rotation.z = -tilt;
  objects.archPivotRight.rotation.z = tilt;

  materials.cable.opacity = cableOpacity * (forceMode ? 1 : .92);
  materials.cable.color.copy(cableColorRed).lerp(cableColorSlack, slack);
  materials.cable.emissive.copy(cableEmissiveRed).lerp(cableEmissiveSlack, slack);
  materials.cable.emissiveIntensity = 1.7 * tension;
  objects.cables.forEach((cable) => { cable.visible = cableVisible; });
  const anchorCloseup = t >= 18 && t < 47;
  objects.tunnel.visible = t >= 18 && t < 75;
  objects.cableCutaway.visible = anchorCloseup;
  objects.cableMarkers.forEach((marker) => {
    marker.visible = cableVisible && forceMode && tension > 0.06;
    if (marker.visible) {
      const flowSpeed = 0.14 * (0.25 + 0.75 * tension);
      const flow = (t * flowSpeed + marker.userData.offset) % 1;
      marker.position.copy(marker.userData.curve.getPoint(flow));
      const pulse = .75 + Math.sin(t * 5 + marker.userData.offset * 10) * .22;
      marker.scale.setScalar(pulse);
    }
  });

  objects.archFlowMarkers.forEach((marker) => {
    marker.visible = forceMode && t >= 47 && t < 123;
    if (marker.visible) {
      const flow = (t * .07 + marker.userData.offset) % 1;
      marker.position.copy(marker.userData.curve.getPoint(flow));
    }
  });

  objects.tensionArrows.forEach((arrow) => { arrow.visible = forceMode && t >= 23 && t < 103 && !whatIfWindow; });
  objects.weightArrow.visible = forceMode && whatIfWindow;
  objects.thrustArrows.forEach((arrow) => { arrow.visible = forceMode && t >= 93 && t < 123; });

  const craneVisible = t >= 41 && t < 143;
  objects.cranes.forEach((crane) => {
    const side = crane.userData.side;
    let x;
    if (t < 93) x = side * (252 - erection * 243);
    else if (t < 118) x = side * 9;
    else x = side * (9 + range(t, 118, 141) * 243);
    const y = archY(x, true) + 4.5;
    crane.visible = craneVisible;
    crane.position.set(x, y, 0);
    const inward = -side;
    const hookTop = new THREE.Vector3(inward * 28, 18, 0);
    const liftCycle = (Math.sin(t * 1.1 + side) + 1) * .5;
    const bottomLocalY = 7 - y + liftCycle * 20;
    const hookBottom = new THREE.Vector3(inward * 28, bottomLocalY, 0);
    crane.userData.hook.geometry.setFromPoints([hookTop, hookBottom]);
  });

  objects.barges.forEach((barge) => {
    const side = barge.userData.side;
    const x = side * (252 - erection * 243) + side * 18;
    barge.visible = t >= 43 && t < 120;
    barge.position.set(x, .2 + Math.sin(t * .8 + side) * .25, side * 6);
  });

  objects.trains.visible = t >= 144;
  if (objects.trains.visible) {
    const arrive = range(t, 144, 149);
    objects.trains.position.x = (1 - arrive) * -130;
  }

  const closurePulse = t >= 93 && t < 119 ? Math.max(0, Math.sin((t - 93) * 2.7)) : 0;
  objects.crownSpark.intensity = closurePulse * 5;
  objects.constructionLights.forEach((light, i) => {
    const active = t >= 53 && t < 134;
    light.intensity = active ? .6 + Math.sin(t * 2 + i) * .18 : 0;
  });

  const forceShow = forceMode && t >= 18 && t < 123;
  materials.steel.color.set(forceShow ? 0x3f7f96 : 0x45545b);
  materials.steelDark.color.set(forceShow ? 0x2f5f72 : 0x27363c);

  ui.anchorRoute.hidden = !anchorCloseup;
  ui.principleCallout.hidden = !(t >= 21 && t < 51);
  ui.tipWarning.hidden = !whatIfWindow;
  ui.legend.hidden = !forceMode;
}

const labelConfig = {
  bearing: { position: () => new THREE.Vector3(-250, 29, 15), show: (t) => t >= 9 && t < 18 },
  bedrock: { position: () => new THREE.Vector3(-304, 4, 26), show: (t) => t >= 11 && t < 18 },
  crane: { position: () => new THREE.Vector3(objects.cranes[0]?.position.x || -130, (objects.cranes[0]?.position.y || 70) + 22, 0), show: (t) => (t >= 50 && t < 92) || (t >= 119 && t < 140) },
  cable: { position: () => new THREE.Vector3(-281, 61, 20), show: (t) => t >= 20 && t < 47 },
  anchor: { position: () => new THREE.Vector3(-355, -7, 16), show: (t) => t >= 22 && t < 47 },
  slack: { position: () => new THREE.Vector3(-281, 61, 20), show: (t) => t >= 101 && t < 125 },
  crown: { position: () => new THREE.Vector3(0, 120, 0), show: (t) => t >= 94 && t < 119 },
  trains: { position: () => new THREE.Vector3(0, 60, 0), show: (t) => t >= 145 && t < 158 }
};

function collectChromeRects() {
  const rects = [];
  ['#subtitle', '.narrative', '.transport', '.chapter-nav', '#force-legend', '#anchor-route', '#principle-callout', '.topbar', '#tip-warning'].forEach((selector) => {
    const el = document.querySelector(selector);
    if (!el) return;
    const r = el.getBoundingClientRect();
    const style = getComputedStyle(el);
    if (r.width > 0 && style.display !== 'none' && !el.hidden) {
      rects.push({ l: r.left, t: r.top, r: r.right, b: r.bottom });
    }
  });
  return rects;
}

function placeLabel(element, anchorX, anchorY) {
  const chrome = collectChromeRects();
  const w = element.offsetWidth || 170;
  const h = element.offsetHeight || 44;
  const candidates = [
    { x: anchorX, y: anchorY - h / 2 },
    { x: anchorX + 16, y: anchorY - h / 2 },
    { x: anchorX - w - 16, y: anchorY - h / 2 },
    { x: anchorX, y: anchorY - h - 16 },
    { x: anchorX, y: anchorY + 16 }
  ];
  for (const candidate of candidates) {
    const x = clamp(candidate.x, 12, window.innerWidth - w - 12);
    const y = clamp(candidate.y, 78, window.innerHeight - h - 12);
    const box = { l: x, t: y, r: x + w, b: y + h };
    if (!chrome.some((cr) => box.l < cr.r && box.r > cr.l && box.t < cr.b && box.b > cr.t)) {
      element.style.left = `${x}px`;
      element.style.top = `${y}px`;
      return;
    }
  }
  element.style.left = `${clamp(anchorX, 180, window.innerWidth - w - 180)}px`;
  element.style.top = `${clamp(anchorY - h / 2, 200, window.innerHeight * 0.6)}px`;
}

function updateLabels(t) {
  document.querySelectorAll('.scene-label').forEach((element) => {
    const config = labelConfig[element.dataset.label];
    if (!config.show(t)) {
      element.classList.remove('visible');
      return;
    }
    const p = config.position().project(camera);
    const visible = p.z < 1 && p.z > -1;
    element.classList.toggle('visible', visible);
    if (visible) {
      const x = (p.x * .5 + .5) * window.innerWidth;
      const y = (-p.y * .5 + .5) * window.innerHeight;
      placeLabel(element, x, y);
    }
  });
}

function revealedCopy(chapter, t) {
  const sentences = chapter.sentences || [chapter.copy];
  const duration = Math.max(.01, chapter.end - chapter.start);
  const local = clamp(t - chapter.start, 0, duration);
  const interval = (duration * 0.7) / sentences.length;
  const index = Math.min(sentences.length - 1, Math.floor(local / interval));
  return sentences[index];
}

function setChapter(index) {
  if (index === activeChapter) return;
  activeChapter = index;
  const chapter = chapters[index];
  ui.chapterIndex.textContent = `${String(index).padStart(2, '0')} / 07`;
  ui.date.textContent = chapter.date;
  ui.title.textContent = chapter.title;
  ui.factValue.textContent = chapter.fact[0];
  ui.factLabel.textContent = chapter.fact[1];
  document.querySelectorAll('.chapter-button').forEach((button, i) => button.classList.toggle('active', i === index));
}

function updateUI(t) {
  const chapter = Math.max(0, chapters.findIndex((item) => t >= item.start && t < item.end));
  setChapter(chapter);
  ui.copy.textContent = revealedCopy(chapters[chapter], t);
  ui.timeline.value = t;
  ui.current.textContent = formatTime(t);
  ui.progress.style.width = `${t / DURATION * 100}%`;
  ui.play.classList.toggle('paused', !playing);
  ui.play.setAttribute('aria-label', playing ? '暂停演示' : '继续演示');
}

function snapCameraToTime(t) {
  if (freeCamera) return;
  const index = Math.max(0, chapters.findIndex((chapter) => t >= chapter.start && t < chapter.end));
  camera.position.fromArray(cameraShots[index].pos);
  controls.target.fromArray(cameraShots[index].target);
  controls.update();
}

function setTime(value) {
  currentTime = clamp(Number(value), 0, DURATION);
  snapCameraToTime(currentTime);
  updateConstruction(currentTime);
  updateCamera(currentTime);
  updateUI(currentTime);
}

function buildUI() {
  const list = $('#chapter-list');
  const markers = $('#timeline-markers');

  const beginExperience = () => {
    playing = true;
    currentTime = 0;
    activeChapter = -1;
    ui.startGate.classList.add('dismissed');
    setTime(0);
  };
  ui.start.addEventListener('click', beginExperience);

  chapters.forEach((chapter, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'chapter-button';
    button.innerHTML = `<span>${String(index).padStart(2, '0')}</span>${chapter.short}`;
    button.addEventListener('click', () => {
      playing = false;
      setTime(chapter.start + .05);
      updateUI(currentTime);
    });
    list.appendChild(button);
    if (index > 0) {
      const marker = document.createElement('i');
      marker.className = 'timeline-marker';
      marker.style.left = `${chapter.start / DURATION * 100}%`;
      markers.appendChild(marker);
    }
  });

  ui.play.addEventListener('click', () => {
    if (currentTime >= DURATION - .05) {
      currentTime = 0;
      activeChapter = -1;
    }
    playing = !playing;
    updateUI(currentTime);
  });
  ui.timeline.addEventListener('input', (event) => {
    playing = false;
    setTime(event.target.value);
  });
  ui.speed.addEventListener('change', (event) => {
    speed = Number(event.target.value);
  });
  ui.restart.addEventListener('click', () => {
    currentTime = 0;
    activeChapter = -1;
    playing = true;
    freeCamera = false;
    ui.camera.setAttribute('aria-pressed', 'false');
    setTime(0);
  });
  ui.force.addEventListener('click', () => {
    forceMode = !forceMode;
    ui.force.setAttribute('aria-pressed', String(forceMode));
    updateConstruction(currentTime);
    updateUI(currentTime);
  });
  ui.camera.addEventListener('click', () => {
    freeCamera = !freeCamera;
    ui.camera.setAttribute('aria-pressed', String(freeCamera));
  });

  const openInfo = (open) => {
    ui.info.classList.toggle('open', open);
    ui.info.setAttribute('aria-hidden', String(!open));
    ui.infoToggle.setAttribute('aria-expanded', String(open));
    ui.scrim.hidden = !open;
    if (open) {
      playing = false;
    }
    updateUI(currentTime);
  };
  ui.infoToggle.addEventListener('click', () => openInfo(!ui.info.classList.contains('open')));
  ui.infoClose.addEventListener('click', () => openInfo(false));
  ui.scrim.addEventListener('click', () => openInfo(false));

  ui.fullscreen.addEventListener('click', async () => {
    try {
      if (!document.fullscreenElement) await $('#app').requestFullscreen();
      else await document.exitFullscreen();
    } catch (_) { /* Fullscreen is optional on embedded and mobile browsers. */ }
  });

  window.addEventListener('keydown', (event) => {
    if (event.code === 'Space' && event.target.tagName !== 'INPUT') {
      event.preventDefault();
      playing = !playing;
      updateUI(currentTime);
    }
    if (event.code === 'ArrowLeft') setTime(currentTime - 5);
    if (event.code === 'ArrowRight') setTime(currentTime + 5);
    if (event.code === 'Escape' && ui.info.classList.contains('open')) openInfo(false);
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      playing = false;
    }
  });
}

function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  if (composer) composer.setSize(window.innerWidth, window.innerHeight);
}

function animate(now = 0) {
  requestAnimationFrame(animate);
  const dt = lastFrame ? Math.min((now - lastFrame) / 1000, .1) : 0;
  lastFrame = now;
  if (playing) {
    currentTime += dt * speed;
    if (currentTime >= DURATION) {
      currentTime = DURATION;
      playing = false;
    }
  }

  objects.waterMat.uniforms.uTime.value += dt;
  updateConstruction(currentTime);
  updateCamera(currentTime);
  updateLabels(currentTime);
  updateUI(currentTime);
  controls.update();
  if (composer) composer.render();
  else renderer.render(scene, camera);
}

try {
  setupThree();
  buildUI();
  setTime(0);
  animate();
} catch (error) {
  console.error(error);
  $('#webgl-error').hidden = false;
}
