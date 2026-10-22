import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import tableMatImage from "./table.png";

// SECTION constants
const candleRadius = 0.35;
const candleHeight = 3.5;
const candleCount = 2; // دو شمع عددی: ۱ و ۶

const baseRadius = 2.5;
const baseHeight = 2;
const middleRadius = 2;
const middleHeight = 1.25;
const topRadius = 1.5;
const topHeight = 1;

const tableHeightOffset = 1;
const BLOW_THRESHOLD = 0.2;
const BLOW_DURATION = 500;

// پارامترهای تزئین خامه و توت فرنگی
const CREAM_COLOR = 0xFFF5F5;
const STRAWBERRY_COLOR = 0xFF3366;
const CREAM_HEIGHT = 0.3;
const CREAM_DETAIL = 128;
const STRAWBERRY_COUNT = 20;
const CREAM_DROP_COUNT = 30;

// رنگ‌های شمع عددی
const CANDLE_PINK = 0xff69b4;
const CANDLE_GOLD = 0xffd700;
const CANDLE_WAX = 0xfff0f5;

// نام کاربر را از localStorage بگیر
const userName = localStorage.getItem('birthdayUserName') || "دوست";

// Scene setup
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 1, 1000);
camera.position.set(3, 5, 8).setLength(15);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x2a1a12);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

// Orbit controls
const controls = new OrbitControls(camera, renderer.domElement);
controls.enablePan = false;
controls.minPolarAngle = THREE.MathUtils.degToRad(60);
controls.maxPolarAngle = THREE.MathUtils.degToRad(95);
controls.minDistance = 4;
controls.maxDistance = 20;
controls.autoRotate = true;
controls.autoRotateSpeed = 1;
controls.target.set(0, 2, 0);
controls.update();

// Lighting
const directionalLight = new THREE.DirectionalLight(0xfff5e6, 0.4);
directionalLight.position.setScalar(10);
scene.add(directionalLight);
scene.add(new THREE.AmbientLight(0xffe4c4, 0.35));

// نورپردازی اضافی برای نمایش بهتر تزئینات
const cakeLight = new THREE.PointLight(0xffd1dc, 0.8, 20);
cakeLight.position.set(0, 5, 5);
scene.add(cakeLight);

const backLight = new THREE.PointLight(0xffe4b5, 0.5, 25);
backLight.position.set(0, 4, -8);
scene.add(backLight);

// Audio context for blow detection
let audioContext;
let analyser;
let microphone;
let isBlowing = false;
let blowStartTime = 0;
let isAudioEnabled = false;

// Initialize audio for blow detection
async function initAudio() {
    try {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.3;
        
        const stream = await navigator.mediaDevices.getUserMedia({ 
            audio: {
                echoCancellation: false,
                noiseSuppression: false,
                autoGainControl: false
            } 
        });
        
        microphone = audioContext.createMediaStreamSource(stream);
        microphone.connect(analyser);
        isAudioEnabled = true;
        
        console.log('Audio initialized for blow detection');
        startBlowDetection();
    } catch (error) {
        console.error('Error initializing audio:', error);
        document.getElementById('hold-reminder').innerHTML += '<br>(Microphone access denied - using touch only)';
    }
}

// Detect blowing sound
function startBlowDetection() {
    if (!isAudioEnabled) return;
    
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    
    function analyzeAudio() {
        if (!analyser) return;
        
        analyser.getByteFrequencyData(dataArray);
        
        let sum = 0;
        const lowFreqCount = 10;
        for (let i = 0; i < lowFreqCount; i++) {
            sum += dataArray[i];
        }
        const averageVolume = sum / lowFreqCount / 255;
        
        if (averageVolume > BLOW_THRESHOLD) {
            if (!isBlowing) {
                isBlowing = true;
                blowStartTime = Date.now();
            } else {
                const blowDuration = Date.now() - blowStartTime;
                if (blowDuration > BLOW_DURATION) {
                    blowOutCandles();
                    isBlowing = false;
                }
            }
        } else {
            isBlowing = false;
        }
        
        requestAnimationFrame(analyzeAudio);
    }
    
    analyzeAudio();
}

// Flame material shader
function getFlameMaterial(isFrontSide) {
    const side = isFrontSide ? THREE.FrontSide : THREE.BackSide;
    return new THREE.ShaderMaterial({
        uniforms: {
            time: { value: 0 },
            isExtinguished: { value: 0 }
        },
        vertexShader: `
uniform float time;
uniform float isExtinguished;
varying vec2 vUv;
varying float hValue;

float random(in vec2 st) {
    return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
}

float noise(in vec2 st) {
    vec2 i = floor(st);
    vec2 f = fract(st);
    
    float a = random(i);
    float b = random(i + vec2(1.0, 0.0));
    float c = random(i + vec2(0.0, 1.0));
    float d = random(i + vec2(1.0, 1.0));
    
    vec2 u = f*f*(3.0-2.0*f);
    
    return mix(a, b, u.x) + (c - a)* u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
}

void main() {
    vUv = uv;
    vec3 pos = position;
    
    float flameStrength = 1.0 - isExtinguished * 0.8;
    
    pos *= vec3(0.8, 2.0 * flameStrength, 0.725);
    hValue = position.y;
    
    float posXZlen = length(position.xz);
    pos.y *= 1.0 + (cos((posXZlen + 0.25) * 3.1415926) * 0.25 + 
                   noise(vec2(0.0, time)) * 0.125 + 
                   noise(vec2(position.x + time, position.z + time)) * 0.5) * 
                   position.y * flameStrength;
    
    pos.x += noise(vec2(time * 2.0, (position.y - time) * 4.0)) * hValue * 0.0312 * flameStrength;
    pos.z += noise(vec2((position.y - time) * 4.0, time * 2.0)) * hValue * 0.0312 * flameStrength;
    
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
}
`,
        fragmentShader: `
varying float hValue;
varying vec2 vUv;

vec3 heatmapGradient(float t) {
    return clamp((pow(t, 1.5) * 0.8 + 0.2) * vec3(
        smoothstep(0.0, 0.35, t) + t * 0.5,
        smoothstep(0.5, 1.0, t),
        max(1.0 - t * 1.7, t * 7.0 - 6.0)
    ), 0.0, 1.0);
}

void main() {
    float v = abs(smoothstep(0.0, 0.4, hValue) - 1.0);
    float alpha = (1.0 - v) * 0.99;
    alpha -= 1.0 - smoothstep(1.0, 0.97, hValue);
    
    vec3 flameColor = heatmapGradient(smoothstep(0.0, 0.3, hValue)) * vec3(0.95, 0.95, 0.4);
    flameColor = mix(vec3(0.0, 0.0, 1.0), flameColor, smoothstep(0.0, 0.3, hValue));
    flameColor += vec3(1.0, 0.9, 0.5) * (1.25 - vUv.y);
    flameColor = mix(flameColor, vec3(0.66, 0.32, 0.03), smoothstep(0.95, 1.0, hValue));
    
    gl_FragColor = vec4(flameColor, alpha);
}
`,
        transparent: true,
        side: side
    });
}

const flameMaterials = [];

function createFlame() {
    const flameGeo = new THREE.SphereGeometry(0.5, 32, 32);
    flameGeo.translate(0, 0.5, 0);
    const flameMat = getFlameMaterial(true);
    flameMaterials.push(flameMat);
    const flame = new THREE.Mesh(flameGeo, flameMat);
    flame.position.set(0.06, candleHeight, 0.06);
    flame.rotation.y = THREE.MathUtils.degToRad(-45);
    return flame;
}

// Smoke particle system for extinguished candles
function createSmokeParticles() {
    const particleCount = 30;
    const particles = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);
    const sizes = new Float32Array(particleCount);
    
    for (let i = 0; i < particleCount; i++) {
        const i3 = i * 3;
        positions[i3] = (Math.random() - 0.5) * 0.3;
        positions[i3 + 1] = Math.random() * 0.5;
        positions[i3 + 2] = (Math.random() - 0.5) * 0.3;
        
        const grayValue = 0.3 + Math.random() * 0.3;
        colors[i3] = grayValue;
        colors[i3 + 1] = grayValue;
        colors[i3 + 2] = grayValue;
        
        sizes[i] = Math.random() * 0.3 + 0.1;
    }
    
    particles.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    particles.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    particles.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    
    const smokeMaterial = new THREE.PointsMaterial({
        size: 0.1,
        vertexColors: true,
        transparent: true,
        opacity: 0.6,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });
    
    const smoke = new THREE.Points(particles, smokeMaterial);
    smoke.visible = false;
    
    return smoke;
}

// تابع ایجاد توت فرنگی
function createStrawberry() {
    const group = new THREE.Group();
    
    // بدنه توت فرنگی (کره کشیده)
    const bodyGeometry = new THREE.SphereGeometry(0.3, 32, 32, 0, Math.PI * 2, 0, Math.PI / 2);
    bodyGeometry.scale(1, 1.5, 1);
    const bodyMaterial = new THREE.MeshPhongMaterial({ 
        color: STRAWBERRY_COLOR,
        shininess: 100,
        specular: 0x444444
    });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.castShadow = true;
    group.add(body);
    
    // دانه‌های توت فرنگی
    const seedGeometry = new THREE.SphereGeometry(0.02, 8, 8);
    const seedMaterial = new THREE.MeshPhongMaterial({ color: 0xFFDDDD });
    
    for (let i = 0; i < 15; i++) {
        const angle = (i / 15) * Math.PI * 2;
        const height = Math.random() * 0.3 + 0.1;
        const radius = 0.25 * (1 - height * 0.8);
        
        const seed = new THREE.Mesh(seedGeometry, seedMaterial);
        seed.position.set(
            Math.cos(angle) * radius,
            height,
            Math.sin(angle) * radius
        );
        seed.castShadow = true;
        group.add(seed);
    }
    
    // برگ توت فرنگی
    const leafGeometry = new THREE.ConeGeometry(0.15, 0.1, 5);
    const leafMaterial = new THREE.MeshPhongMaterial({ color: 0x228B22 });
    const leaf = new THREE.Mesh(leafGeometry, leafMaterial);
    leaf.position.y = 0.5;
    leaf.rotation.x = Math.PI;
    leaf.castShadow = true;
    group.add(leaf);
    
    return group;
}

// تابع ایجاد قطره خامه
function createCreamDrop() {
    const group = new THREE.Group();
    
    // بدنه قطره
    const dropGeometry = new THREE.SphereGeometry(0.1, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2);
    const dropMaterial = new THREE.MeshPhongMaterial({ 
        color: CREAM_COLOR,
        shininess: 50,
        specular: 0xFFFFFF
    });
    const drop = new THREE.Mesh(dropGeometry, dropMaterial);
    drop.castShadow = true;
    group.add(drop);
    
    // نوک قطره
    const tipGeometry = new THREE.ConeGeometry(0.05, 0.15, 8);
    const tip = new THREE.Mesh(tipGeometry, dropMaterial);
    tip.position.y = 0.08;
    tip.castShadow = true;
    group.add(tip);
    
    return group;
}

// تابع ایجاد لایه خامه روی کیک
function createCreamLayer(radius, height, yPosition) {
    const group = new THREE.Group();
    
    // لایه اصلی خامه
    const creamGeometry = new THREE.CylinderGeometry(
        radius + 0.1, 
        radius + 0.1, 
        CREAM_HEIGHT, 
        CREAM_DETAIL
    );
    
    // ایجاد بافت ناهموار برای خامه
    const positions = creamGeometry.attributes.position;
    for (let i = 0; i < positions.count; i++) {
        const vertex = new THREE.Vector3();
        vertex.fromBufferAttribute(positions, i);
        
        if (vertex.y > CREAM_HEIGHT / 2 - 0.05) {
            const angle = Math.atan2(vertex.z, vertex.x);
            const distance = Math.sqrt(vertex.x * vertex.x + vertex.z * vertex.z);
            const noise = Math.sin(angle * 8) * 0.05 + Math.cos(distance * 20) * 0.03;
            vertex.x += Math.cos(angle) * noise;
            vertex.z += Math.sin(angle) * noise;
        }
        
        positions.setXYZ(i, vertex.x, vertex.y, vertex.z);
    }
    creamGeometry.computeVertexNormals();
    
    const creamMaterial = new THREE.MeshPhongMaterial({ 
        color: CREAM_COLOR,
        shininess: 30,
        specular: 0xFFFFFF,
        flatShading: false
    });
    
    const creamLayer = new THREE.Mesh(creamGeometry, creamMaterial);
    creamLayer.position.y = yPosition;
    creamLayer.castShadow = true;
    creamLayer.receiveShadow = true;
    group.add(creamLayer);
    
    return group;
}

// تابع ایجاد تزئین خامه روی لبه‌ها
function createCreamDecoration(baseRadius, yPosition) {
    const group = new THREE.Group();
    
    // حلقه تزئین خامه
    const points = [];
    const detail = 64;
    
    for (let i = 0; i <= detail; i++) {
        const angle = (i / detail) * Math.PI * 2;
        const radius = baseRadius + 0.15;
        const heightVariation = Math.sin(angle * 6) * 0.05 + Math.cos(angle * 8) * 0.03;
        
        points.push(new THREE.Vector3(
            Math.cos(angle) * (radius + heightVariation),
            Math.sin(angle * 12) * 0.02,
            Math.sin(angle) * (radius + heightVariation)
        ));
    }
    
    const curve = new THREE.CatmullRomCurve3(points);
    const tubeGeometry = new THREE.TubeGeometry(curve, 200, 0.08, 8, false);
    
    const creamMaterial = new THREE.MeshPhongMaterial({ 
        color: CREAM_COLOR,
        shininess: 40,
        specular: 0xFFFFFF
    });
    
    const creamTube = new THREE.Mesh(tubeGeometry, creamMaterial);
    creamTube.position.y = yPosition;
    creamTube.castShadow = true;
    creamTube.receiveShadow = true;
    group.add(creamTube);
    
    // اضافه کردن قطره‌های خامه
    for (let i = 0; i < CREAM_DROP_COUNT; i++) {
        const angle = (i / CREAM_DROP_COUNT) * Math.PI * 2;
        const dropRadius = baseRadius + 0.2;
        
        const creamDrop = createCreamDrop();
        creamDrop.position.set(
            Math.cos(angle) * dropRadius,
            yPosition - 0.05,
            Math.sin(angle) * dropRadius
        );
        
        // تغییر اندازه‌های تصادفی
        const scale = 0.5 + Math.random() * 0.5;
        creamDrop.scale.setScalar(scale);
        
        // چرخش تصادفی
        creamDrop.rotation.y = Math.random() * Math.PI * 2;
        
        group.add(creamDrop);
    }
    
    return group;
}

// تابع ایجاد توت فرنگی‌های روی کیک
function createStrawberriesOnCake(baseRadius, yPosition, count) {
    const group = new THREE.Group();
    
    for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2;
        const radius = baseRadius + 0.15;
        const heightOffset = Math.random() * 0.1;
        
        const strawberry = createStrawberry();
        strawberry.position.set(
            Math.cos(angle) * radius,
            yPosition + heightOffset,
            Math.sin(angle) * radius
        );
        
        // چرخش و اندازه تصادفی
        strawberry.rotation.y = Math.random() * Math.PI * 2;
        const scale = 0.8 + Math.random() * 0.4;
        strawberry.scale.setScalar(scale);
        
        // کمی کج کردن توت فرنگی‌ها
        strawberry.rotation.x = Math.random() * 0.3 - 0.15;
        strawberry.rotation.z = Math.random() * 0.3 - 0.15;
        
        group.add(strawberry);
    }
    
    return group;
}

// ================== شمع‌های عددی طلایی حرفه‌ای با ExtrudeGeometry ==================
const DIGIT_HEIGHT = 3.6;
const DIGIT_DEPTH = 0.55;   // ضخامت اکستروژن (عمق شمع)

// متریال طلایی براق و فلزی دقیقاً مثل شمع‌های عکس
function createGoldCandleMaterial() {
    return new THREE.MeshStandardMaterial({
        color: 0xffd700,
        metalness: 0.95,
        roughness: 0.15,
        emissive: 0xb8860b,
        emissiveIntensity: 0.15,
        envMapIntensity: 1.6
    });
}

function createWick(height = DIGIT_HEIGHT) {
    const wickGroup = new THREE.Group();
    const wickGeo = new THREE.CylinderGeometry(0.04, 0.05, 0.4, 10);
    const wickMat = new THREE.MeshStandardMaterial({ color: 0x1a120a, roughness: 0.95 });
    const wick = new THREE.Mesh(wickGeo, wickMat);
    wick.position.y = height + 0.2;
    wick.castShadow = true;
    wickGroup.add(wick);

    const tipGeo = new THREE.SphereGeometry(0.06, 10, 10);
    const tipMat = new THREE.MeshBasicMaterial({ color: 0xffcc55 });
    const tip = new THREE.Mesh(tipGeo, tipMat);
    tip.position.y = height + 0.4;
    wickGroup.add(tip);

    return wickGroup;
}

// پایه چوبی نازک
function createCandleStick(height = 1.0) {
    const stickGroup = new THREE.Group();
    const stickGeo = new THREE.CylinderGeometry(0.05, 0.055, height, 12);
    const stickMat = new THREE.MeshStandardMaterial({
        color: 0xf5f0e6,
        roughness: 0.7,
        metalness: 0.05
    });
    const stick = new THREE.Mesh(stickGeo, stickMat);
    stick.position.y = -height / 2 - 0.02;
    stick.castShadow = true;
    stickGroup.add(stick);
    return stickGroup;
}

// ساخت شکل ۲بعدی عدد ۱ و اکسترود کردن به ۳بعدی
function createDigitOne() {
    const group = new THREE.Group();
    const mat = createGoldCandleMaterial();

    // شکل عدد ۱ (مستطیل عمودی ضخیم + پایه + سری کوچک)
    const shape = new THREE.Shape();
    const w = 0.55;          // عرض بدنه
    const h = DIGIT_HEIGHT;
    const baseW = 0.95;      // عرض پایه پایین
    const topW = 0.7;        // عرض سری بالا

    // شروع از پایین سمت چپ پایه
    shape.moveTo(-baseW / 2, 0);
    shape.lineTo(baseW / 2, 0);
    shape.lineTo(baseW / 2, 0.28);
    shape.lineTo(w / 2, 0.28);
    shape.lineTo(w / 2, h - 0.35);
    // سری مایل بالا سمت چپ
    shape.lineTo(topW / 2, h - 0.35);
    shape.lineTo(topW / 2, h);
    shape.lineTo(-w / 2 - 0.15, h);
    shape.lineTo(-w / 2 - 0.15, h - 0.28);
    shape.lineTo(-w / 2, h - 0.28);
    shape.lineTo(-w / 2, 0.28);
    shape.lineTo(-baseW / 2, 0.28);
    shape.lineTo(-baseW / 2, 0);

    const extrudeSettings = {
        depth: DIGIT_DEPTH,
        bevelEnabled: true,
        bevelThickness: 0.08,
        bevelSize: 0.06,
        bevelSegments: 4
    };

    const geo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    geo.center(); // مرکز هندسی را به (0,0,0) بیاور
    // بعد از center، ارتفاع را دوباره تنظیم می‌کنیم
    geo.translate(0, DIGIT_HEIGHT / 2, 0);

    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);

    // فتیله در مرکز بالا
    group.add(createWick(DIGIT_HEIGHT));

    // پایه چوبی
    group.add(createCandleStick(1.15));

    // دود
    const smoke = createSmokeParticles();
    smoke.position.y = DIGIT_HEIGHT + 0.6;
    group.add(smoke);

    group.userData.flameX = 0;
    return group;
}

// ساخت شکل ۲بعدی عدد ۶ و اکسترود کردن به ۳بعدی
function createDigitSix() {
    const group = new THREE.Group();
    const mat = createGoldCandleMaterial();

    // روش مطمئن‌تر: ترکیب چند بخش (ستون + حلقه کامل)
    // --- ۱. ستون عمودی سمت چپ ---
    const stemW = 0.58;
    const stemH = DIGIT_HEIGHT;
    const stemShape = new THREE.Shape();
    stemShape.moveTo(-stemW / 2, 0);
    stemShape.lineTo(stemW / 2, 0);
    stemShape.lineTo(stemW / 2, stemH);
    stemShape.lineTo(-stemW / 2, stemH);
    stemShape.lineTo(-stemW / 2, 0);

    const extrudeSettings = {
        depth: DIGIT_DEPTH,
        bevelEnabled: true,
        bevelThickness: 0.09,
        bevelSize: 0.07,
        bevelSegments: 5
    };

    const stemGeo = new THREE.ExtrudeGeometry(stemShape, extrudeSettings);
    stemGeo.translate(0, 0, -DIGIT_DEPTH / 2);
    const stemMesh = new THREE.Mesh(stemGeo, mat);
    stemMesh.castShadow = true;
    stemMesh.receiveShadow = true;

    // موقعیت ستون سمت چپ
    const loopR = 1.0;
    const stemX = -loopR + stemW * 0.35;
    stemMesh.position.x = stemX;
    group.add(stemMesh);

    // --- ۲. حلقه پایین (دایره کامل با سوراخ) ---
    const outerR = loopR;
    const innerR = 0.42;
    const loopCenterY = outerR + 0.12;

    const loopShape = new THREE.Shape();
    // دایره بیرونی
    const segs = 48;
    for (let i = 0; i <= segs; i++) {
        const a = (i / segs) * Math.PI * 2;
        const x = Math.cos(a) * outerR;
        const y = Math.sin(a) * outerR;
        if (i === 0) loopShape.moveTo(x, y);
        else loopShape.lineTo(x, y);
    }

    // سوراخ داخلی
    const hole = new THREE.Path();
    for (let i = 0; i <= segs; i++) {
        const a = (i / segs) * Math.PI * 2;
        const x = Math.cos(a) * innerR;
        const y = Math.sin(a) * innerR;
        if (i === 0) hole.moveTo(x, y);
        else hole.lineTo(x, y);
    }
    loopShape.holes.push(hole);

    const loopGeo = new THREE.ExtrudeGeometry(loopShape, extrudeSettings);
    loopGeo.translate(0, 0, -DIGIT_DEPTH / 2);
    const loopMesh = new THREE.Mesh(loopGeo, mat);
    loopMesh.position.y = loopCenterY;
    loopMesh.castShadow = true;
    loopMesh.receiveShadow = true;
    group.add(loopMesh);

    // --- ۳. اتصال نرم بالای حلقه به ستون ---
    const joinShape = new THREE.Shape();
    joinShape.moveTo(-0.35, 0);
    joinShape.lineTo(0.35, 0);
    joinShape.lineTo(0.35, 0.55);
    joinShape.lineTo(-0.35, 0.55);
    joinShape.lineTo(-0.35, 0);
    const joinGeo = new THREE.ExtrudeGeometry(joinShape, {
        depth: DIGIT_DEPTH * 0.95,
        bevelEnabled: true,
        bevelThickness: 0.06,
        bevelSize: 0.05,
        bevelSegments: 3
    });
    joinGeo.translate(0, 0, -DIGIT_DEPTH * 0.475);
    const joinMesh = new THREE.Mesh(joinGeo, mat);
    joinMesh.position.set(stemX + 0.15, loopCenterY + outerR * 0.55, 0);
    group.add(joinMesh);

    // فتیله روی بالای ستون
    const flameX = stemX;
    const wick = createWick(DIGIT_HEIGHT);
    wick.position.x = flameX;
    group.add(wick);

    // پایه چوبی
    const stick = createCandleStick(1.15);
    stick.position.x = 0.05;
    group.add(stick);

    // دود
    const smoke = createSmokeParticles();
    smoke.position.set(flameX, DIGIT_HEIGHT + 0.6, 0);
    group.add(smoke);

    group.userData.flameX = flameX;
    return group;
}

// Candle lights برای شمع عددی
function addCandleLights(candle, flameY = DIGIT_HEIGHT) {
    // نور قوی‌تر برای بازتاب بهتر روی شمع طلایی براق
    const candleLight = new THREE.PointLight(0xffbb55, 1.55, 7, 2);
    candleLight.position.set(0, flameY + 0.25, 0);
    candleLight.castShadow = true;
    candle.add(candleLight);

    const candleLight2 = new THREE.PointLight(0xffaa33, 1.1, 14, 2);
    candleLight2.position.set(0, flameY + 1.3, 0);
    candleLight2.castShadow = true;
    candle.add(candleLight2);

    return [candleLight, candleLight2];
}

// شعله برای شمع عددی (موقعیت قابل تنظیم)
function createFlameAt(y = DIGIT_HEIGHT, x = 0) {
    const flameGeo = new THREE.SphereGeometry(0.42, 32, 32);
    flameGeo.translate(0, 0.48, 0);
    const flameMat = getFlameMaterial(true);
    flameMaterials.push(flameMat);
    const flame = new THREE.Mesh(flameGeo, flameMat);
    flame.position.set(x + 0.02, y + 0.18, 0.03);
    flame.rotation.y = THREE.MathUtils.degToRad(-45);
    flame.scale.set(0.78, 1.25, 0.78); // کمی بلندتر و طبیعی‌تر مثل عکس
    return flame;
}

// Table
const tableGeo = new THREE.CylinderGeometry(14, 14, 0.5, 64);
tableGeo.translate(0, -tableHeightOffset, 0);
const textureLoader = new THREE.TextureLoader();
const tableTexture = textureLoader.load(tableMatImage);
const tableMat = new THREE.MeshStandardMaterial({ map: tableTexture, metalness: 0, roughness: 0.75 });
const tableMesh = new THREE.Mesh(tableGeo, tableMat);
tableMesh.receiveShadow = true;
scene.add(tableMesh);

// Cake creation with cream, strawberry decoration and PNG strawberries
function createCake() {
    const cakeGroup = new THREE.Group();
    
    // استفاده از توت‌فرنگی سه‌بعدی به جای تکسچر (برای سازگاری بهتر)
    function createStrawberrySprite(size = 0.8) {
        const strawberry = createStrawberry();
        strawberry.scale.setScalar(size * 0.8);
        return strawberry;
    }
    
    // لایه پایه کیک
    const baseGeometry = new THREE.CylinderGeometry(baseRadius, baseRadius, baseHeight, 32);
    const baseMaterial = new THREE.MeshPhongMaterial({ 
        color: 0xF5DEB3,
        shininess: 10
    });
    const baseMesh = new THREE.Mesh(baseGeometry, baseMaterial);
    baseMesh.castShadow = true;
    baseMesh.receiveShadow = true;
    
    // خامه روی لایه پایه
    const baseCream = createCreamLayer(
        baseRadius,
        CREAM_HEIGHT,
        baseHeight / 2 + CREAM_HEIGHT / 2
    );
    cakeGroup.add(baseMesh);
    cakeGroup.add(baseCream);
    
    // تزیین خامه دور لبه لایه پایه
    const baseDecoration = createCreamDecoration(
        baseRadius,
        baseHeight / 2 + CREAM_HEIGHT
    );
    cakeGroup.add(baseDecoration);
    
    // لایه میانی
    const middleGeometry = new THREE.CylinderGeometry(middleRadius, middleRadius, middleHeight, 32);
    const middleMaterial = new THREE.MeshPhongMaterial({ 
        color: 0xF5DEB3,
        shininess: 10
    });
    const middleMesh = new THREE.Mesh(middleGeometry, middleMaterial);
    middleMesh.position.y = baseHeight / 2 + CREAM_HEIGHT + middleHeight / 2;
    middleMesh.castShadow = true;
    middleMesh.receiveShadow = true;
    
    const middleCream = createCreamLayer(
        middleRadius,
        CREAM_HEIGHT,
        baseHeight / 2 + CREAM_HEIGHT + middleHeight / 2 + CREAM_HEIGHT / 2
    );
    cakeGroup.add(middleMesh);
    cakeGroup.add(middleCream);
    
    const middleDecoration = createCreamDecoration(
        middleRadius,
        baseHeight / 2 + CREAM_HEIGHT + middleHeight / 2 + CREAM_HEIGHT
    );
    cakeGroup.add(middleDecoration);
    
    // لایه بالایی
    const topGeometry = new THREE.CylinderGeometry(topRadius, topRadius, topHeight, 32);
    const topMaterial = new THREE.MeshPhongMaterial({ 
        color: 0xF5DEB3,
        shininess: 10
    });
    const topMesh = new THREE.Mesh(topGeometry, topMaterial);
    topMesh.position.y =
        baseHeight / 2 + CREAM_HEIGHT + middleHeight + topHeight / 2;
    topMesh.castShadow = true;
    topMesh.receiveShadow = true;
    
    const topCream = createCreamLayer(
        topRadius,
        CREAM_HEIGHT,
        baseHeight / 2 + CREAM_HEIGHT + middleHeight + topHeight / 2 + CREAM_HEIGHT / 2
    );
    cakeGroup.add(topMesh);
    cakeGroup.add(topCream);
    
    const topDecoration = createCreamDecoration(
        topRadius,
        baseHeight / 2 + CREAM_HEIGHT + middleHeight + topHeight / 2 + CREAM_HEIGHT
    );
    cakeGroup.add(topDecoration);
    
    // قطره‌های خامه اضافی روی دیواره‌ها
    for (let i = 0; i < 10; i++) {
        const angle = Math.random() * Math.PI * 2;
        const height = Math.random() * baseHeight - baseHeight / 2;
        const drop = createCreamDrop();
        drop.position.set(
            Math.cos(angle) * (baseRadius + 0.05),
            height,
            Math.sin(angle) * (baseRadius + 0.05)
        );
        drop.scale.setScalar(0.3 + Math.random() * 0.3);
        cakeGroup.add(drop);
    }
    
    // ---------- اضافه کردن توت‌فرنگی‌های PNG ----------
    
    const topY =
        baseHeight / 2 + CREAM_HEIGHT + middleHeight + topHeight / 2 + CREAM_HEIGHT;
    
    // توت‌فرنگی‌ها فقط روی لایه بالایی (موقعیت بدون تغییر)
    for (let i = 0; i < 12; i++) {
        const angle = (i / 12) * Math.PI * 2 + (Math.random() - 0.5) * 0.8;
        const distance = topRadius * 0.6 * (0.5 + Math.random() * 0.5);
        
        const strawberry = createStrawberrySprite(
            0.7 + Math.random() * 0.4
        );
        
        strawberry.position.set(
            Math.cos(angle) * distance,
            topY + 0.1 + Math.random() * 0.2,
            Math.sin(angle) * distance
        );
        
        cakeGroup.add(strawberry);
    }
    
    return cakeGroup;
}

const cake = createCake();
scene.add(cake);

// Create number candles: "1" and "6" side by side on the cake
const candles = new THREE.Group();
const extinguishedCandles = new Set();

function createNumberCandles() {
    const cakeTopY = baseHeight / 2 + CREAM_HEIGHT + middleHeight + topHeight / 2 + CREAM_HEIGHT + 0.1;
    const scale = 0.38; // مقیاس مناسب برای قرار گرفتن روی کیک

    // ----- عدد ۱ طلایی براق -----
    const digit1 = createDigitOne();
    digit1.scale.set(scale, scale, scale);
    digit1.position.set(-0.65, cakeTopY, 0);
    digit1.rotation.y = -0.05;

    const lights1 = addCandleLights(digit1, DIGIT_HEIGHT);
    lights1[0].position.set(0, DIGIT_HEIGHT + 0.3, 0);
    lights1[1].position.set(0, DIGIT_HEIGHT + 1.4, 0);

    const flame1a = createFlameAt(DIGIT_HEIGHT, 0);
    const flame1b = createFlameAt(DIGIT_HEIGHT, 0);
    flame1b.scale.multiplyScalar(0.65);
    flame1b.position.y += 0.15;
    digit1.add(flame1a);
    digit1.add(flame1b);

    let smoke1 = null;
    digit1.traverse(child => {
        if (child.isPoints) smoke1 = child;
    });

    digit1.userData = {
        lights: lights1,
        flames: [flame1a, flame1b],
        flameMaterials: [flame1a.material, flame1b.material],
        smoke: smoke1,
        isExtinguished: false,
        smokeActive: false,
        smokeTime: 0
    };
    candles.add(digit1);

    // ----- عدد ۶ طلایی براق -----
    const digit6 = createDigitSix();
    digit6.scale.set(scale, scale, scale);
    digit6.position.set(0.75, cakeTopY, 0);
    digit6.rotation.y = 0.08;

    const sixFlameX = digit6.userData.flameX || -0.7;
    const lights6 = addCandleLights(digit6, DIGIT_HEIGHT);
    lights6[0].position.set(sixFlameX, DIGIT_HEIGHT + 0.3, 0);
    lights6[1].position.set(sixFlameX, DIGIT_HEIGHT + 1.4, 0);

    const flame6a = createFlameAt(DIGIT_HEIGHT, sixFlameX);
    const flame6b = createFlameAt(DIGIT_HEIGHT, sixFlameX);
    flame6b.scale.multiplyScalar(0.65);
    flame6b.position.y += 0.15;
    digit6.add(flame6a);
    digit6.add(flame6b);

    let smoke6 = null;
    digit6.traverse(child => {
        if (child.isPoints) smoke6 = child;
    });

    digit6.userData = {
        lights: lights6,
        flames: [flame6a, flame6b],
        flameMaterials: [flame6a.material, flame6b.material],
        smoke: smoke6,
        isExtinguished: false,
        smokeActive: false,
        smokeTime: 0,
        flameX: sixFlameX
    };
    candles.add(digit6);

    return candles;
}

const allCandles = createNumberCandles();
cake.add(allCandles);

// Ambient light for the scene
const ambientLight = new THREE.AmbientLight(0xffe4c4, 0.25);
scene.add(ambientLight);

// Adjust camera
camera.position.set(0, 5, 10);
camera.lookAt(cake.position);

// Hold event variables
let holdTimeout;
let allowBlowout = false;
const holdReminder = document.getElementById('hold-reminder');
const audio = document.getElementById("happy-birthday-audio");

// Enable blowout after song plays
audio.addEventListener('ended', function() {
    holdReminder.style.display = 'flex';
    setTimeout(function() {
        holdReminder.classList.add('show');
        initAudio();
    }, 10);
    allowBlowout = true;
});

// Hold events
function handleHoldStart() {
    if (!allowBlowout) return;
    holdTimeout = setTimeout(() => {
        blowOutCandles();
    }, 500);
}

function handleHoldEnd() {
    clearTimeout(holdTimeout);
}

document.addEventListener('mousedown', handleHoldStart);
document.addEventListener('touchstart', handleHoldStart);
document.addEventListener('mouseup', handleHoldEnd);
document.addEventListener('touchend', handleHoldEnd);

// Congratulation overlay
function showCongratulation() {
    const overlay = document.getElementById('congratulation-overlay');
    overlay.style.pointerEvents = 'auto';
    overlay.style.background = 'rgba(255, 105, 180, 0.25)';
    overlay.style.opacity = '1';
    
    // Update the personalized name in the congratulation
    const personalizedNameElement = document.getElementById('personalized-name');
    if (personalizedNameElement) {
        personalizedNameElement.innerHTML = `<i class="fas fa-birthday-cake"></i> ${userName}! <i class="fas fa-balloon"></i>`;
    }
    
    overlay.classList.add('show');
    
    // افکت‌های جشن فقط بعد از خاموش شدن کامل شمع‌ها
    if (typeof window.startCelebrationEffects === 'function') {
        window.startCelebrationEffects();
    }
}

// Update smoke animation for a candle
function updateSmokeAnimation(candle, deltaTime) {
    if (!candle.userData.smokeActive || !candle.userData.smoke) return;
    
    const smoke = candle.userData.smoke;
    const positions = smoke.geometry.attributes.position.array;
    const colors = smoke.geometry.attributes.color.array;
    
    candle.userData.smokeTime += deltaTime;
    
    for (let i = 0; i < positions.length / 3; i++) {
        const i3 = i * 3;
        
        positions[i3 + 1] += deltaTime * 0.5;
        positions[i3] += (Math.random() - 0.5) * deltaTime * 0.1;
        positions[i3 + 2] += (Math.random() - 0.5) * deltaTime * 0.1;
        
        const age = candle.userData.smokeTime;
        const fadeStart = 2.0;
        const fadeDuration = 1.0;
        
        if (age > fadeStart) {
            const fadeAmount = Math.min(1.0, (age - fadeStart) / fadeDuration);
            colors[i3] *= (1 - fadeAmount * 0.1);
            colors[i3 + 1] *= (1 - fadeAmount * 0.1);
            colors[i3 + 2] *= (1 - fadeAmount * 0.1);
        }
        
        if (positions[i3 + 1] > 2.0) {
            positions[i3] = (Math.random() - 0.5) * 0.3;
            positions[i3 + 1] = Math.random() * 0.5;
            positions[i3 + 2] = (Math.random() - 0.5) * 0.3;
            
            const grayValue = 0.3 + Math.random() * 0.3;
            colors[i3] = grayValue;
            colors[i3 + 1] = grayValue;
            colors[i3 + 2] = grayValue;
        }
    }
    
    smoke.geometry.attributes.position.needsUpdate = true;
    smoke.geometry.attributes.color.needsUpdate = true;
    
    if (candle.userData.smokeTime > 10) {
        candle.userData.smokeActive = false;
        smoke.visible = false;
    }
}

// Activate smoke for a candle
function activateSmoke(candle) {
    if (!candle.userData.smoke) return;
    
    candle.userData.smokeActive = true;
    candle.userData.smokeTime = 0;
    candle.userData.smoke.visible = true;
    
    const smoke = candle.userData.smoke;
    const positions = smoke.geometry.attributes.position.array;
    const colors = smoke.geometry.attributes.color.array;
    
    for (let i = 0; i < positions.length / 3; i++) {
        const i3 = i * 3;
        positions[i3] = (Math.random() - 0.5) * 0.3;
        positions[i3 + 1] = Math.random() * 0.5;
        positions[i3 + 2] = (Math.random() - 0.5) * 0.3;
        
        const grayValue = 0.3 + Math.random() * 0.3;
        colors[i3] = grayValue;
        colors[i3 + 1] = grayValue;
        colors[i3 + 2] = grayValue;
    }
    
    smoke.geometry.attributes.position.needsUpdate = true;
    smoke.geometry.attributes.color.needsUpdate = true;
}

// Extinguish single candle
function extinguishCandle(candle, speed) {
    if (candle.userData.isExtinguished) return;
    
    candle.userData.isExtinguished = true;
    extinguishedCandles.add(candle);
    
    const lights = candle.userData.lights;
    const flames = candle.userData.flames;
    const flameMats = candle.userData.flameMaterials;
    
    let progress = 0;
    const extinguishInterval = setInterval(() => {
        progress += 0.02 * speed;
        
        if (progress >= 1) {
            clearInterval(extinguishInterval);
            flames.forEach(flame => {
                flame.visible = false;
            });
            lights.forEach(light => {
                light.intensity = 0;
            });
            setTimeout(() => {
                activateSmoke(candle);
            }, 100);
        } else {
            flames.forEach((flame, index) => {
                flame.material.opacity = 1 - progress;
                flame.material.uniforms.isExtinguished.value = progress;
                flame.scale.setScalar(1 - progress * 0.7);
            });
            
            lights.forEach(light => {
                light.intensity = Math.max(0, 1 - progress);
            });
        }
    }, 30);
}

// Blow out all candles
function blowOutCandles() {
    if (extinguishedCandles.size >= candleCount) return;
    
    // صدای فوت (اختیاری – اگر فایل وجود نداشت مشکلی نیست)
    try {
        const blowSound = new Audio('./blow-sound.mp3');
        blowSound.volume = 0.5;
        blowSound.play().catch(() => {});
    } catch (e) {}
    
    allCandles.children.forEach(candle => {
        if (!candle.userData.isExtinguished) {
            const speed = 1 + Math.random() * 3;
            extinguishCandle(candle, speed);
        }
    });
    
    let ambientLightIntensity = ambientLight.intensity;
    const ambientInterval = setInterval(() => {
        ambientLightIntensity += 0.01;
        if (ambientLightIntensity >= 0.4) {
            clearInterval(ambientInterval);
            ambientLight.intensity = 0.4;
            showCongratulation();
        } else {
            ambientLight.intensity = ambientLightIntensity;
        }
    }, 50);
    
    holdReminder.style.display = 'none';
    
    if (microphone) {
        microphone.disconnect();
    }
}

// Animation loop
const clock = new THREE.Clock();
let time = 0;

function render() {
    requestAnimationFrame(render);
    const deltaTime = clock.getDelta();
    time += deltaTime;
    
    // Update flame materials
    flameMaterials.forEach((material, index) => {
        if (material.uniforms && material.uniforms.time) {
            material.uniforms.time.value = time;
        }
    });
    
    // Update candle lights animation
    allCandles.children.forEach(candle => {
        if (!candle.userData.isExtinguished && candle.userData.lights && candle.userData.lights[1]) {
            const light = candle.userData.lights[1];
            light.position.x = Math.sin(time * Math.PI) * 0.25;
            light.position.z = Math.cos(time * Math.PI * 0.75) * 0.25;
            light.intensity = 2 + Math.sin(time * Math.PI * 2) * Math.cos(time * Math.PI * 1.5) * 0.25;
        }
        
        if (candle.userData.isExtinguished) {
            updateSmokeAnimation(candle, deltaTime);
        }
    });
    
    // چرخش آرام کیک برای نمایش بهتر تزئینات
    cake.rotation.y += deltaTime * 0.1;
    
    controls.update();
    renderer.render(scene, camera);
}

render();

// Handle window resize
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// Initialize
console.log('Birthday cake with cream and strawberry decoration initialized');